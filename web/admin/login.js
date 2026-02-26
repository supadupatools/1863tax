const DEFAULT_SUPABASE_URL = "https://woudkcanrrgcyqcmhapo.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_G6BgX_qLFP3MvG0QYpv1kg_Q3bpg_sV";
const schema = window.ARCHIVE_SCHEMA || "archive1863";

const loginForm = document.getElementById("login-form");
const loginBtn = document.getElementById("login-btn");
const logoutCurrentBtn = document.getElementById("logout-current-btn");
const authState = document.getElementById("auth-state");

const SUPABASE_URL = window.SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = window.SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_KEY;
const reason = new URLSearchParams(window.location.search).get("reason");

let hasSupabaseJs = Boolean(window.supabase?.createClient);
let supabase = null;

try {
  if (hasSupabaseJs) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  }
} catch (_error) {
  hasSupabaseJs = false;
  supabase = null;
}

window.__adminLoginSubmit = async () => {
  await attemptLogin();
};

if (reason === "role" && authState) {
  authState.textContent = "Your account does not have an active admin/reviewer/transcriber profile.";
}

if (localStorage.getItem("archive_admin_token")) {
  window.location.replace("/admin/");
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await attemptLogin();
  });
}

if (loginBtn) {
  loginBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    await attemptLogin();
  });
}

if (logoutCurrentBtn) {
  logoutCurrentBtn.addEventListener("click", async () => {
    localStorage.removeItem("archive_admin_token");
    localStorage.removeItem("archive_admin_user");
    try {
      await supabase?.auth?.signOut();
    } catch (_error) {
      // Ignore; local session is already cleared.
    }
    setAuthState("Local session cleared.");
  });
}

if (!hasSupabaseJs) {
  setAuthState(
    "Supabase JS SDK unavailable, using REST fallback. If login fails, verify CDN/network policy."
  );
}

async function attemptLogin() {
  if (!loginForm) {
    setAuthState("Login failed: form is unavailable.");
    return;
  }

  const form = new FormData(loginForm);
  const payload = {
    email: String(form.get("email") || "").trim(),
    password: String(form.get("password") || "")
  };

  if (!payload.email || !payload.password) {
    setAuthState("Email and password are required.");
    return;
  }

  setAuthState("Signing in...");

  try {
    const { data, error } = hasSupabaseJs
      ? await supabase.auth.signInWithPassword({
        email: payload.email,
        password: payload.password
      })
      : await signInWithRest(payload);

    if (error) {
      setAuthState(`Login failed: ${error.message}`);
      return;
    }

    const accessToken = data.session?.access_token;
    const authUser = data.user;
    if (!accessToken || !authUser?.id) {
      setAuthState("Login failed: missing Supabase session.");
      return;
    }

    let profile = null;
    try {
      profile = hasSupabaseJs
        ? await queryProfileViaClient(authUser.id)
        : await queryProfileViaRest(authUser.id, accessToken);
    } catch (_profileError) {
      profile = null;
    }

    localStorage.setItem("archive_admin_token", accessToken);
    localStorage.setItem(
      "archive_admin_user",
      JSON.stringify({
        id: authUser.id,
        email: profile?.email || authUser.email,
        role: profile?.role || "public",
        displayName: profile?.display_name || authUser.email,
        isActive: profile?.is_active ?? true
      })
    );

    setAuthState("Login successful. Redirecting...");
    window.location.assign("/admin/");
  } catch (error) {
    const message = error?.message || "Unknown error";
    setAuthState(`Login failed: ${message}. Check Supabase config and user profile setup.`);
  }
}

function setAuthState(message) {
  if (authState) authState.textContent = message;
}

async function queryProfileViaClient(userId) {
  const result = await supabase
    .schema(schema)
    .from("user_profiles")
    .select("auth_user_id, role, display_name, is_active, email")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (result.error) return null;
  return result.data || null;
}

async function queryProfileViaRest(userId, accessToken) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/user_profiles`);
  url.searchParams.set("select", "auth_user_id,role,display_name,is_active,email");
  url.searchParams.set("auth_user_id", `eq.${userId}`);
  const response = await fetch(url.toString(), {
    headers: {
      "accept-profile": schema,
      apikey: SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${accessToken}`
    }
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data?.[0] || null;
}

async function signInWithRest(payload) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      email: payload.email,
      password: payload.password
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      data: null,
      error: { message: data.error_description || data.msg || `HTTP ${response.status}` }
    };
  }
  return {
    data: {
      session: {
        access_token: data.access_token
      },
      user: {
        id: data.user?.id,
        email: data.user?.email
      }
    },
    error: null
  };
}
