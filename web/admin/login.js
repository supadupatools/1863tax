const loginForm = document.getElementById("login-form");
const authState = document.getElementById("auth-state");
const API_BASE = String(window.ADMIN_API_BASE || "").replace(/\/+$/, "");

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
    const response = await fetch(resolveApiUrl("/api/auth/login"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (_error) {
      data = {};
    }
    if (!response.ok) {
      authState.textContent = `Login failed: ${data.error || `HTTP ${response.status}`}`;
      return;
    }

    localStorage.setItem("archive_admin_token", data.token);
    localStorage.setItem("archive_admin_user", JSON.stringify(data.user || {}));
    window.location.replace("/admin/");
  } catch (error) {
    authState.textContent =
      `Login failed: ${error.message}. ` +
      "Check ADMIN_API_BASE config and backend availability.";
  }
});

function resolveApiUrl(path) {
  return API_BASE ? `${API_BASE}${path}` : path;
}
