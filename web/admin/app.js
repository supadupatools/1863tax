const loginForm = document.getElementById("login-form");
const authState = document.getElementById("auth-state");
const sourceForm = document.getElementById("source-form");
const sourceOutput = document.getElementById("source-output");
const transcriptionForm = document.getElementById("transcription-form");
const transcriptionOutput = document.getElementById("transcription-output");
const loadReviewBtn = document.getElementById("load-review");
const reviewList = document.getElementById("review-list");
const bulkForm = document.getElementById("bulk-form");
const bulkOutput = document.getElementById("bulk-output");

let authToken = localStorage.getItem("archive_admin_token") || null;
setAuthState();

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(loginForm);
  const payload = {
    email: form.get("email"),
    password: form.get("password")
  };

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

  authToken = data.token;
  localStorage.setItem("archive_admin_token", authToken);
  authState.textContent = `Authenticated as ${data.user.email} (${data.user.role})`;
});

for (const button of document.querySelectorAll("[data-load]")) {
  button.addEventListener("click", () => loadTable(button.dataset.load));
}

sourceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(sourceForm);
  const table = form.get("table");
  const payloadRaw = form.get("payload");

  let payload;
  try {
    payload = JSON.parse(payloadRaw);
  } catch {
    sourceOutput.textContent = "Payload must be valid JSON.";
    return;
  }

  const response = await apiFetch(`/api/admin/${table}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  sourceOutput.textContent = JSON.stringify(data, null, 2);
});

transcriptionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(transcriptionForm);
  const payload = Object.fromEntries(form.entries());
  payload.status = "draft";

  for (const key of [
    "page_id",
    "county_id",
    "district_id",
    "sequence_on_page",
    "year",
    "transcription_confidence"
  ]) {
    if (payload[key] === "") delete payload[key];
  }

  const response = await apiFetch("/api/transcriptions/entries", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  transcriptionOutput.textContent = JSON.stringify(data, null, 2);
});

loadReviewBtn.addEventListener("click", loadReviewQueue);

bulkForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(bulkForm);

  const response = await fetch("/api/transcriptions/bulk-import", {
    method: "POST",
    headers: authToken ? { authorization: `Bearer ${authToken}` } : {},
    body: form
  });

  const data = await response.json();
  bulkOutput.textContent = JSON.stringify(data, null, 2);
});

async function loadTable(table) {
  const response = await apiFetch(`/api/admin/${table}`);
  const data = await response.json();
  sourceOutput.textContent = JSON.stringify(data, null, 2);
}

async function loadReviewQueue() {
  const response = await apiFetch("/api/review/queue");
  const items = await response.json();
  reviewList.innerHTML = "";

  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "review-card";
    card.innerHTML = `
      <p><strong>Entry #${item.id}</strong> ${escapeHtml(item.enslaved_name_original)} linked to ${escapeHtml(item.taxpayer_name_original)}</p>
      <p>${escapeHtml(item.county_name || "")} ${item.district_name ? "/ " + escapeHtml(item.district_name) : ""}</p>
      <p>Status: ${escapeHtml(item.status)}</p>
      <div class="review-actions">
        <button data-action="approved">Approve</button>
        <button data-action="rejected">Reject</button>
      </div>
    `;

    card.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const decision = btn.dataset.action;
        const response = await apiFetch(`/api/review/entries/${item.id}/decision`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision })
        });

        const data = await response.json();
        btn.closest(".review-card").append(
          document.createTextNode(`\nUpdated: ${JSON.stringify(data)}`)
        );
      });
    });

    reviewList.appendChild(card);
  });
}

async function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (authToken) headers.set("authorization", `Bearer ${authToken}`);
  return fetch(url, { ...options, headers });
}

function setAuthState() {
  if (authToken) {
    authState.textContent = "Authenticated token loaded from local storage.";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
