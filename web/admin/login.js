const loginForm = document.getElementById("login-form");
const authState = document.getElementById("auth-state");
const supabase = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_PUBLISHABLE_KEY
);
const schema = window.ARCHIVE_SCHEMA || "archive1863";

if (localStorage.getItem("archive_admin_token")) {
  window.location.replace("/admin/");
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(loginForm);
  const payload = {
    email: form.get("email"),
    password: form.get("password")
  };

  authState.textContent = "Signing in...";

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: payload.email,
      password: payload.password
    });
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

    const { data: profile, error: profileError } = await supabase
      .schema(schema)
      .from("user_profiles")
      .select("auth_user_id, role, display_name, is_active, email")
      .eq("auth_user_id", authUser.id)
      .maybeSingle();

    if (profileError) {
      authState.textContent = `Login failed: ${profileError.message}`;
      return;
    }

    if (!profile?.is_active) {
      authState.textContent = "Login failed: account is disabled or missing profile.";
      await supabase.auth.signOut();
      return;
    }

    if (!["admin", "reviewer", "transcriber"].includes(profile.role)) {
      authState.textContent = "Login failed: insufficient admin role.";
      await supabase.auth.signOut();
      return;
    }

    localStorage.setItem("archive_admin_token", accessToken);
    localStorage.setItem(
      "archive_admin_user",
      JSON.stringify({
        id: authUser.id,
        email: profile.email || authUser.email,
        role: profile.role,
        displayName: profile.display_name || authUser.email
      })
    );
    window.location.replace("/admin/");
  } catch (error) {
    authState.textContent =
      `Login failed: ${error.message}. ` +
      "Check Supabase config and user profile/role setup.";
  }
});
