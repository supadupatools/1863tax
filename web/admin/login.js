const loginForm = document.getElementById("login-form");
const loginBtn = document.getElementById("login-btn");
const authState = document.getElementById("auth-state");
const schema = window.ARCHIVE_SCHEMA || "archive1863";
const reason = new URLSearchParams(window.location.search).get("reason");
const hasSupabaseJs = Boolean(window.supabase?.createClient);
const supabase = hasSupabaseJs
  ? window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_PUBLISHABLE_KEY
  )
  : null;
window.__adminLoginReady = true;

if (reason === "role") {
  authState.textContent = "Your account does not have an active admin/reviewer/transcriber profile.";
}

if (localStorage.getItem("archive_admin_token")) {
  window.location.replace("/admin/");
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
});

loginBtn.addEventListener("click", async () => {
  const form = new FormData(loginForm);
  const payload = {
    email: form.get("email"),
    password: form.get("password")
  };

  authState.textContent = "Signing in...";

  try {
    const { data, error } = hasSupabaseJs
      ? await supabase.auth.signInWithPassword({
        email: payload.email,
        password: payload.password
      })
      : await signInWithRest(payload);
    if (error) {
      authState.textContent = `Login failed: ${error.message}`;
      return;
    }

    const accessToken = data.session?.access_token;
    const authUser = data.user;
    if (!accessToken || !authUser?.id) {
      authState.textContent = "Login failed: missing Supabase session.";
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

    authState.textContent = "Login successful. Redirecting...";
    window.location.assign("/admin/");
  } catch (error) {
    authState.textContent =
      `Login failed: ${error.message}. ` +
      "Check Supabase config and user profile/role setup.";
  }
});

if (!hasSupabaseJs) {
  authState.textContent =
    "Supabase JS SDK unavailable, using REST fallback. If login fails, verify CDN/network policy.";
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
  const url = new URL(`${window.SUPABASE_URL}/rest/v1/user_profiles`);
  url.searchParams.set("select", "auth_user_id,role,display_name,is_active,email");
  url.searchParams.set("auth_user_id", `eq.${userId}`);
  const response = await fetch(url.toString(), {
    headers: {
      apikey: window.SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${accessToken}`
    }
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data?.[0] || null;
}

async function signInWithRest(payload) {
  const response = await fetch(
    `${window.SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: window.SUPABASE_PUBLISHABLE_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        email: payload.email,
        password: payload.password
      })
    }
  );
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
