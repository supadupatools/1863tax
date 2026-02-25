const searchForm = document.getElementById("search-form");
const resultsBody = document.getElementById("results-body");
const summary = document.getElementById("summary");
const detail = document.getElementById("detail");

let currentRows = [];

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(searchForm);
  const params = new URLSearchParams();

  for (const [key, value] of form.entries()) {
    if (value !== "") params.set(key, value);
  }

  summary.textContent = "Searching...";

  const response = await fetch(`/api/public/search?${params.toString()}`);
  const payload = await response.json();

  if (!response.ok) {
    summary.textContent = payload.message || payload.error || "Search failed";
    return;
  }

  currentRows = payload.entries;
  summary.textContent = `${payload.count} records found`;
  renderRows();
});

function renderRows() {
  resultsBody.innerHTML = "";
  currentRows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(row.enslaved_name_original || "")}</td>
      <td>${escapeHtml(row.enslaved_name_normalized || "")}</td>
      <td>${escapeHtml(row.county_name || "")}${row.district_name ? ` / ${escapeHtml(row.district_name)}` : ""}</td>
      <td>${escapeHtml(row.taxpayer_name_original || "")}${row.taxpayer_name_normalized ? `<br><small>${escapeHtml(row.taxpayer_name_normalized)}</small>` : ""}</td>
      <td>
        ${escapeHtml(row.age_original || "")}
        ${row.category_original ? ` | ${escapeHtml(row.category_original)}` : ""}
        ${row.value_original ? ` | ${escapeHtml(row.value_original)}` : ""}
      </td>
    `;

    tr.addEventListener("click", () => loadDetail(row.id));
    resultsBody.appendChild(tr);
  });
}

async function loadDetail(entryId) {
  const response = await fetch(`/api/public/entries/${entryId}`);
  const payload = await response.json();
  if (!response.ok) {
    detail.innerHTML = `<p>${escapeHtml(payload.error || "Failed to load detail")}</p>`;
    return;
  }

  const entry = payload.entry;
  const sequence = Number(entry.sequence_on_page || 0);
  const line = String(entry.line_number || "").trim();
  const estimatedTop = Math.max(5, Math.min(95, sequence > 0 ? sequence * 3 : 50));
  const showHighlight = Boolean(sequence > 0 || line);
  detail.innerHTML = `
    <h3>${escapeHtml(entry.enslaved_name_original || "Unknown")}</h3>
    <p><strong>Normalized:</strong> ${escapeHtml(entry.enslaved_name_normalized || "")}</p>
    <p><strong>Taxpayer:</strong> ${escapeHtml(entry.taxpayer_name_original || "")}${entry.taxpayer_name_normalized ? ` (${escapeHtml(entry.taxpayer_name_normalized)})` : ""}</p>
    <p><strong>County / District:</strong> ${escapeHtml(entry.county_name || "")}${entry.district_name ? ` / ${escapeHtml(entry.district_name)}` : ""}</p>
    <p><strong>Year:</strong> ${escapeHtml(String(entry.year || ""))}</p>
    <p><strong>Line / Sequence:</strong> ${escapeHtml(entry.line_number || "Unknown")}${entry.sequence_on_page ? ` / ${escapeHtml(String(entry.sequence_on_page))}` : ""}</p>
    <p><strong>Attributes:</strong> Age ${escapeHtml(entry.age_original || "")}, Category ${escapeHtml(entry.category_original || "")}, Value ${escapeHtml(entry.value_original || "")}</p>
    <p><strong>Remarks:</strong> ${escapeHtml(entry.remarks_original || "")}</p>
    ${entry.image_url ? `
      <div class="scan-wrap">
        <img src="${escapeHtml(entry.image_url)}" alt="Source scan for selected entry" />
        ${showHighlight ? `<div class="scan-highlight" style="top:${estimatedTop}%;" title="Estimated entry location"></div>` : ""}
      </div>
    ` : ""}
    <div class="citation">
      <h4>Citation Chain</h4>
      <p><strong>Repository:</strong> ${escapeHtml(entry.repository_name || "")} ${entry.repository_location ? `(${escapeHtml(entry.repository_location)})` : ""}</p>
      <p><strong>Source:</strong> ${escapeHtml(entry.source_title || "")}</p>
      <p><strong>Source Item:</strong> ${escapeHtml(entry.source_item_label || "")}</p>
      <p><strong>Page:</strong> ${escapeHtml(entry.page_number_label || "")}</p>
      ${entry.citation_preferred ? `<p><strong>Preferred Citation:</strong> ${escapeHtml(entry.citation_preferred)}</p>` : ""}
      ${showHighlight ? `<p><strong>Entry Highlight:</strong> Approximate row marker shown from line/sequence metadata.</p>` : ""}
      ${entry.image_thumbnail_url ? `<p><a href="${escapeHtml(entry.image_url)}" target="_blank" rel="noopener">Open scan image</a></p>` : ""}
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
