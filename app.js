const searchForm = document.getElementById("search-form");
const nameInput = document.getElementById("name-input");
const countySelect = document.getElementById("county-select");
const panelViewBtn = document.getElementById("panel-view-btn");
const tableViewBtn = document.getElementById("table-view-btn");
const panelView = document.getElementById("panel-view");
const tableView = document.getElementById("table-view");
const emptyState = document.getElementById("empty-state");
const recordList = document.getElementById("record-list");
const recordDetail = document.getElementById("record-detail");
const resultsTableBody = document.getElementById("results-table-body");
const resultSummary = document.getElementById("result-summary");

let currentRecords = [];
let activeRecordId = null;

// Temporary data until Supabase is connected.
const sampleRecords = [
  {
    id: "rec-01",
    name: "Mary Whitfield",
    county: "Jefferson",
    recordType: "Church Registry",
    date: "1863-03-18",
    reference: "Book C, Folio 41",
    details:
      "Listed as witness in a baptism entry. Household recorded near Mill Road parish district.",
  },
  {
    id: "rec-02",
    name: "John Whitfield",
    county: "Jefferson",
    recordType: "Tax Ledger",
    date: "1863-07-05",
    reference: "Ledger 12, Line 223",
    details:
      "Property tax account under farm lot 9. Adjacent household references include two Whitfield relatives.",
  },
  {
    id: "rec-03",
    name: "Sarah Boone",
    county: "Madison",
    recordType: "Census Fragment",
    date: "1863-11-12",
    reference: "Ward 2, Sheet 8",
    details:
      "Entry appears with spouse initials only. Enumerator notes indicate uncertain surname spelling.",
  },
  {
    id: "rec-04",
    name: "Thomas Fletcher",
    county: "Franklin",
    recordType: "Probate Notice",
    date: "1863-01-29",
    reference: "Notice Roll 4",
    details:
      "Executor announcement tied to estate transfer. Includes three witness signatures and court seal note.",
  },
];

panelViewBtn.addEventListener("click", () => setViewMode("panel"));
tableViewBtn.addEventListener("click", () => setViewMode("table"));

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const queryName = nameInput.value.trim();
  const queryCounty = countySelect.value;
  if (!queryName || !queryCounty) return;

  // Replace this with a Supabase query once backend is connected.
  currentRecords = await fetchRecords(queryName, queryCounty);
  activeRecordId = currentRecords[0]?.id ?? null;

  renderResults(queryName, queryCounty);
});

function setViewMode(mode) {
  const showPanel = mode === "panel";

  panelView.classList.toggle("hidden", !showPanel);
  tableView.classList.toggle("hidden", showPanel);
  panelViewBtn.classList.toggle("active", showPanel);
  tableViewBtn.classList.toggle("active", !showPanel);
  panelViewBtn.setAttribute("aria-selected", String(showPanel));
  tableViewBtn.setAttribute("aria-selected", String(!showPanel));
}

function renderResults(queryName, queryCounty) {
  const count = currentRecords.length;
  resultSummary.textContent = `${count} record${count === 1 ? "" : "s"} found for "${queryName}" in ${queryCounty}.`;
  emptyState.classList.toggle("hidden", count > 0);

  renderRecordList();
  renderRecordDetail(activeRecordId);
  renderTable();
}

function renderRecordList() {
  recordList.innerHTML = "";

  currentRecords.forEach((record) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = activeRecordId === record.id ? "active" : "";
    button.innerHTML = `<strong>${escapeHtml(record.name)}</strong><br>${escapeHtml(record.recordType)} • ${escapeHtml(record.date)}`;
    button.addEventListener("click", () => {
      activeRecordId = record.id;
      renderRecordList();
      renderRecordDetail(record.id);
      highlightTableRow(record.id);
    });
    li.appendChild(button);
    recordList.appendChild(li);
  });
}

function renderRecordDetail(recordId) {
  const selected = currentRecords.find((record) => record.id === recordId);
  if (!selected) {
    recordDetail.innerHTML = "<h3>Record Detail</h3><p>No record selected.</p>";
    return;
  }

  recordDetail.innerHTML = `
    <h3>${escapeHtml(selected.name)}</h3>
    <div class="meta">
      <p><strong>County:</strong> ${escapeHtml(selected.county)}</p>
      <p><strong>Record Type:</strong> ${escapeHtml(selected.recordType)}</p>
      <p><strong>Date:</strong> ${escapeHtml(selected.date)}</p>
      <p><strong>Reference:</strong> ${escapeHtml(selected.reference)}</p>
    </div>
    <p><strong>Transcript Notes:</strong></p>
    <p>${escapeHtml(selected.details)}</p>
  `;
}

function renderTable() {
  resultsTableBody.innerHTML = "";

  currentRecords.forEach((record) => {
    const row = document.createElement("tr");
    row.tabIndex = 0;
    row.dataset.recordId = record.id;
    row.innerHTML = `
      <td>${escapeHtml(record.name)}</td>
      <td>${escapeHtml(record.county)}</td>
      <td>${escapeHtml(record.recordType)}</td>
      <td>${escapeHtml(record.date)}</td>
      <td>${escapeHtml(record.reference)}</td>
    `;
    row.addEventListener("click", () => activateFromTable(record.id));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activateFromTable(record.id);
      }
    });
    resultsTableBody.appendChild(row);
  });

  highlightTableRow(activeRecordId);
}

function highlightTableRow(recordId) {
  const rows = resultsTableBody.querySelectorAll("tr");
  rows.forEach((row) => {
    row.style.background = row.dataset.recordId === recordId ? "#e6e6e6" : "";
  });
}

function activateFromTable(recordId) {
  activeRecordId = recordId;
  renderRecordDetail(recordId);
  renderRecordList();
  highlightTableRow(recordId);
}

async function fetchRecords(name, county) {
  const lowered = name.toLowerCase();
  return sampleRecords.filter(
    (record) =>
      record.county === county &&
      record.name.toLowerCase().includes(lowered),
  );

  // Supabase-ready placeholder:
  // const { data, error } = await supabase
  //   .from("records")
  //   .select("*")
  //   .ilike("name", `%${name}%`)
  //   .eq("county", county);
  // if (error) throw error;
  // return data ?? [];
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
