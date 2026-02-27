import {
  buildStoredUser,
  canAccessAdminPortal,
  loginErrorMessage,
  normalizeCredentials,
  toAuthResult
} from "./login-auth.js";

const DEFAULT_SUPABASE_URL = "https://woudkcanrrgcyqcmhapo.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_G6BgX_qLFP3MvG0QYpv1kg_Q3bpg_sV";
const SCHEMA = window.ARCHIVE_SCHEMA || "archive1863";
const SUPABASE_URL = window.SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_KEY = window.SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_KEY;

const loginForm = document.getElementById("login-form");
const authState = document.getElementById("auth-state");
const logoutCurrentBtn = document.getElementById("logout-current-btn");
const reason = new URLSearchParams(window.location.search).get("reason");

const hasSupabaseClient = Boolean(window.supabase?.createClient);
const supabase = hasSupabaseClient
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

if (reason === "role") {
  setAuthState("Your account must have an active admin, reviewer, or transcriber profile.");
}

if (localStorage.getItem("archive_admin_token")) {
  window.location.replace("/admin/");
}

loginForm?.addEventListener("submit", handleSubmit);
logoutCurrentBtn?.addEventListener("click", clearSession);

if (!hasSupabaseClient) {
  setAuthState("Supabase SDK unavailable. Using REST fallback.");
}

async function handleSubmit(event) {
  event.preventDefault();

  const credentials = normalizeCredentials(new FormData(loginForm));
  if (!credentials.email || !credentials.password) {
    setAuthState("Email and password are required.");
    return;
  }

  setAuthState("Signing in...");

  try {
    const { authResult, authError } = hasSupabaseClient
      ? await signInWithClient(credentials)
      : await signInWithRest(credentials);

    if (authError) {
      setAuthState(`Login failed: ${loginErrorMessage({ authError })}`);
      return;
    }

    const sessionToken = authResult?.session?.accessToken;
    const authUser = authResult?.user;
    if (!sessionToken || !authUser?.id) {
      setAuthState(`Login failed: ${loginErrorMessage({ authResult })}`);
      return;
    }

    const claimedProfile = await claimProfileIfNeeded({
      hasSupabaseClient,
      supabase,
      sessionToken
    });

    const profile = claimedProfile || (hasSupabaseClient
      ? await queryProfileViaClient(authUser.id)
      : await queryProfileViaRest(authUser.id, sessionToken));

    const user = buildStoredUser(authUser, profile);
    if (!canAccessAdminPortal(user)) {
      setAuthState(
        `Access denied: role=${user?.role || "unknown"}, active=${String(user?.isActive)}, profile=${profile ? "found" : "missing"}`
      );
      await clearSession({ quiet: true });
      return;
    }

    localStorage.setItem("archive_admin_token", sessionToken);
    localStorage.setItem("archive_admin_user", JSON.stringify(user));

    setAuthState("Login successful. Redirecting...");
    window.location.assign("/admin/");
  } catch (error) {
    setAuthState(`Login failed: ${error?.message || "Unknown error"}`);
  }
}

function setAuthState(message) {
  if (authState) authState.textContent = message;
}

async function clearSession({ quiet = false } = {}) {
  localStorage.removeItem("archive_admin_token");
  localStorage.removeItem("archive_admin_user");
  await supabase?.auth?.signOut().catch(() => {});
  if (!quiet) {
    setAuthState("Local session cleared.");
  }
}

async function signInWithClient(credentials) {
  const { data, error } = await supabase.auth.signInWithPassword(credentials);
  return {
    authResult: {
      session: { accessToken: data?.session?.access_token || null },
      user: { id: data?.user?.id || null, email: data?.user?.email || null }
    },
    authError: error || null
  };
}

async function signInWithRest(credentials) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      "content-type": "application/json"
    },
    body: JSON.stringify(credentials)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      authResult: null,
      authError: {
        message: payload.error_description || payload.msg || `HTTP ${response.status}`
      }
    };
  }

  return { authResult: toAuthResult(payload), authError: null };
}

async function queryProfileViaClient(userId) {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from("user_profiles")
    .select("auth_user_id, role, display_name, is_active, email")
    .eq("auth_user_id", userId)
    .maybeSingle();

  return error ? null : data || null;
}

async function queryProfileViaRest(userId, accessToken) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/user_profiles`);
  url.searchParams.set("select", "auth_user_id,role,display_name,is_active,email");
  url.searchParams.set("auth_user_id", `eq.${userId}`);

  const response = await fetch(url.toString(), {
    headers: {
      "accept-profile": SCHEMA,
      apikey: SUPABASE_KEY,
      authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) return null;
  const rows = await response.json();
  return rows?.[0] || null;
}

async function claimProfileIfNeeded({ hasSupabaseClient, supabase, sessionToken }) {
  try {
    if (hasSupabaseClient && supabase) {
      const { data, error } = await supabase.rpc("claim_user_profile");
      if (error) {
        return null;
      }
      return Array.isArray(data) ? (data[0] || null) : (data || null);
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/claim_user_profile`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        authorization: `Bearer ${sessionToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      return null;
    }
    const payload = await response.json().catch(() => null);
    return Array.isArray(payload) ? (payload[0] || null) : (payload || null);
  } catch (_error) {
    return null;
  }
}
