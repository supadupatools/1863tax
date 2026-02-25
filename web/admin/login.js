const loginForm = document.getElementById("login-form");
const authState = document.getElementById("auth-state");

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
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      authState.textContent = `Login failed: ${data.error || "unknown"}`;
      return;
    }

    localStorage.setItem("archive_admin_token", data.token);
    localStorage.setItem("archive_admin_user", JSON.stringify(data.user || {}));
    window.location.replace("/admin/");
  } catch (error) {
    authState.textContent = `Login failed: ${error.message}`;
  }
});
