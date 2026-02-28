const searchForm = document.getElementById("search-form");
const countySelect = document.getElementById("county_id");
const districtSelect = document.getElementById("district_id");
const filtersNote = document.getElementById("filters-note");
const resultsBody = document.getElementById("results-body");
const summary = document.getElementById("summary");
const exportResultsBtn = document.getElementById("export-results");
const detailView = document.getElementById("detail-view");
const detailContent = document.getElementById("detail-content");
const detailBack = document.getElementById("detail-back");
const detailScanImage = document.getElementById("detail-scan-image");
const detailScanEmpty = document.getElementById("detail-scan-empty");
const openScanLink = document.getElementById("open-scan-link");
const detailSideMeta = document.getElementById("detail-side-meta");
const zoomInBtn = document.getElementById("zoom-in");
const zoomOutBtn = document.getElementById("zoom-out");
const zoomResetBtn = document.getElementById("zoom-reset");
const menuToggle = document.getElementById("menu-toggle");
const siteMenu = document.getElementById("site-menu");
const supabaseClient = createSupabaseClient();

let currentRows = [];
let currentDetail = null;
let currentZoom = 1;

init();

menuToggle?.addEventListener("click", () => {
  const expanded = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!expanded));
  siteMenu?.classList.toggle("hidden", expanded);
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!target || !(target instanceof Element)) return;
  if (target.closest(".menuWrap")) return;
  menuToggle?.setAttribute("aria-expanded", "false");
  siteMenu?.classList.add("hidden");
});

countySelect.addEventListener("change", async () => {
  const countyId = countySelect.value || null;
  await loadDistricts(countyId);
  updateUrlFromForm();
});

districtSelect.addEventListener("change", updateUrlFromForm);
searchForm.addEventListener("change", updateUrlFromForm);

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await runSearch({ pushHistory: true, clearEntry: true });
});

detailBack.addEventListener("click", () => {
  const params = new URLSearchParams(window.location.search);
  params.delete("entry");
  history.pushState({}, "", `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  hideDetail();
});

exportResultsBtn.addEventListener("click", exportResultsCsv);
zoomInBtn.addEventListener("click", () => setZoom(currentZoom + 0.2));
zoomOutBtn.addEventListener("click", () => setZoom(Math.max(1, currentZoom - 0.2)));
zoomResetBtn.addEventListener("click", () => setZoom(1));

window.addEventListener("popstate", async () => {
  await hydrateFromUrl();
});

async function init() {
  try {
    await loadCounties();
    await hydrateFromUrl();
    filtersNote.textContent = "County and district filters loaded from database.";
  } catch (_error) {
    filtersNote.textContent = "Could not load county/district lists. You can still search by name.";
  }
}

async function hydrateFromUrl() {
  const params = new URLSearchParams(window.location.search);

  setFormValue("name", params.get("name") || "");
  setFormValue("match_mode", params.get("match_mode") || "fuzzy");
  setFormValue("year", params.get("year") || "1863");
  setFormValue("taxpayer_name", params.get("taxpayer_name") || "");

  const countyId = params.get("county_id") || "";
  countySelect.value = countyId;
  await loadDistricts(countyId || null);

  const districtId = params.get("district_id") || "";
  districtSelect.value = districtId;

  if (params.get("name")) {
    await runSearch({ pushHistory: false, clearEntry: false });
  } else {
    currentRows = [];
    renderRows();
    summary.textContent = "No search yet.";
  }

  const entryId = params.get("entry");
  if (entryId) {
    await loadDetail(entryId, { pushHistory: false });
  } else {
    hideDetail();
  }
}

function setFormValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

async function runSearch({ pushHistory = false, clearEntry = true } = {}) {
  const form = new FormData(searchForm);
  const params = new URLSearchParams();

  for (const [key, value] of form.entries()) {
    if (value !== "") params.set(key, value);
  }

  if (!params.get("name")) {
    summary.textContent = "Enter a name to search.";
    return;
  }

  if (pushHistory) {
    if (clearEntry) params.delete("entry");
    history.pushState({}, "", `${window.location.pathname}?${params.toString()}`);
  }

  summary.textContent = "Searching archive records...";
  const payload = await searchEntries(params);
  currentRows = payload;
  renderRows();
  summary.textContent = payload.length
    ? `Viewing ${payload.length} matching record${payload.length === 1 ? "" : "s"}.`
    : "No matching records found.";
}

async function loadCounties() {
  const payload = await fetchFilters();
  const counties = payload?.counties || [];
  countySelect.innerHTML = '<option value="">All Counties</option>';
  counties.forEach((county) => {
    const option = document.createElement("option");
    option.value = String(county.id);
    option.textContent = county.name;
    countySelect.appendChild(option);
  });
}

async function loadDistricts(countyId) {
  const payload = await fetchFilters(countyId);
  const districts = payload?.districts || [];

  districtSelect.innerHTML = '<option value="">All Districts</option>';
  districts.forEach((district) => {
    const option = document.createElement("option");
    option.value = String(district.id);
    option.textContent = district.name;
    districtSelect.appendChild(option);
  });

  districtSelect.disabled = districts.length === 0;
}

async function fetchFilters(countyId = null) {
  const apiPayload = await fetchFiltersFromApi(countyId);
  if (apiPayload) return apiPayload;

  const dbPayload = await fetchFiltersFromSupabase(countyId);
  if (dbPayload) return dbPayload;

  throw new Error("filters_fetch_failed");
}

async function fetchFiltersFromApi(countyId = null) {
  try {
    const params = new URLSearchParams();
    if (countyId) params.set("county_id", countyId);
    const response = await fetch(`/api/public/filters${params.toString() ? `?${params.toString()}` : ""}`);
    if (!response.ok) return null;
    return response.json();
  } catch (_error) {
    return null;
  }
}

async function fetchFiltersFromSupabase(countyId = null) {
  if (!supabaseClient) return null;

  const countiesQuery = supabaseClient
    .schema("archive1863")
    .from("counties")
    .select("id,name")
    .eq("enabled", true)
    .order("name", { ascending: true });

  const districtsQuery = supabaseClient
    .schema("archive1863")
    .from("districts")
    .select("id,county_id,name")
    .eq("enabled", true)
    .order("name", { ascending: true });

  if (countyId) districtsQuery.eq("county_id", Number(countyId));

  const [{ data: counties, error: countiesError }, { data: districts, error: districtsError }] = await Promise.all([
    countiesQuery,
    districtsQuery
  ]);

  if (countiesError || districtsError) return null;

  return {
    counties: counties || [],
    districts: districts || []
  };
}

function renderRows() {
  resultsBody.innerHTML = "";

  if (!currentRows.length) {
    resultsBody.innerHTML = `
      <article class="resultCard emptyCard">
        <p>Search results will appear here with page, county, taxpayer, and source references.</p>
      </article>
    `;
    return;
  }

  currentRows.forEach((row, index) => {
    const card = document.createElement("article");
    card.className = "resultCard";
    card.innerHTML = `
      <p class="resultNumber">Record #${escapeHtml(String(row.id || index + 1))}</p>
      <h3><button type="button" class="recordLink">${escapeHtml(row.enslaved_name_original || "Unnamed entry")}</button></h3>
      <p class="resultMeta">${escapeHtml(row.repository_name || "Unknown repository")}${row.repository_location ? `, ${escapeHtml(row.repository_location)}` : ""}</p>
      <p class="resultMeta">${escapeHtml(formatDateLine(row))}</p>
      <div class="peopleBlock">
        <h4>Individuals named in record context</h4>
        <p>Enslaved (1), Taxpayer (1)</p>
      </div>
      <div class="matchNote">
        "${escapeHtml(row.enslaved_name_original || "Entry")}" appears in this record under taxpayer
        <em>${escapeHtml(row.taxpayer_name_original || "Unknown")}</em>.
      </div>
    `;

    card.querySelector(".recordLink")?.addEventListener("click", () => {
      loadDetail(row.id, { pushHistory: true });
    });

    resultsBody.appendChild(card);
  });
}

async function loadDetail(entryId, { pushHistory = false } = {}) {
  const entry = await getEntryDetail(entryId);
  if (!entry) return;
  currentDetail = entry;

  if (pushHistory) {
    const params = new URLSearchParams(window.location.search);
    params.set("entry", String(entryId));
    history.pushState({}, "", `${window.location.pathname}?${params.toString()}`);
  }

  renderDetail(entry);
  detailView.classList.remove("hidden");
  detailView.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderDetail(entry) {
  const title = entry.enslaved_name_original || "Unnamed record";
  detailContent.innerHTML = `
    <h2>${escapeHtml(title)}</h2>
    <p class="detailIntro">
      ${escapeHtml(entry.county_name || "Unknown County")}${entry.district_name ? `, ${escapeHtml(entry.district_name)}` : ""}.
      Entry recorded in ${escapeHtml(String(entry.year || "1863"))}.
    </p>

    <section class="detailSection">
      <h3>Record Overview</h3>
      <p>
        Taxpayer: <strong>${escapeHtml(entry.taxpayer_name_original || "Unknown")}</strong>
        ${entry.taxpayer_name_normalized ? `(${escapeHtml(entry.taxpayer_name_normalized)})` : ""}
      </p>
      <p>
        Line / Sequence: ${escapeHtml(entry.line_number || "Unknown")}
        ${entry.sequence_on_page ? ` / ${escapeHtml(String(entry.sequence_on_page))}` : ""}
      </p>
      <p>
        Attributes:
        Age ${escapeHtml(entry.age_original || "n/a")},
        Category ${escapeHtml(entry.category_original || "n/a")},
        Value ${escapeHtml(entry.value_original || "n/a")}
      </p>
      <p>
        Remarks: ${escapeHtml(entry.remarks_original || "No remarks recorded.")}
      </p>
    </section>

    <section class="detailSection">
      <h3>Citation Information</h3>
      <p><strong>Repository:</strong> ${escapeHtml(entry.repository_name || "Unknown")}${entry.repository_location ? `, ${escapeHtml(entry.repository_location)}` : ""}</p>
      <p><strong>Source:</strong> ${escapeHtml(entry.source_title || "Unknown source")}</p>
      <p><strong>Source Item:</strong> ${escapeHtml(entry.source_item_label || "Unknown item")}</p>
      <p><strong>Page:</strong> ${escapeHtml(entry.page_number_label || "Unknown page")}</p>
      ${entry.citation_preferred ? `<p><strong>Preferred citation:</strong> ${escapeHtml(entry.citation_preferred)}</p>` : ""}
    </section>
  `;

  detailSideMeta.innerHTML = `
    <p><strong>Repository</strong><br>${escapeHtml(entry.repository_name || "Unknown")}</p>
    <p><strong>Source</strong><br>${escapeHtml(entry.source_title || "Unknown")}</p>
    <p><strong>Page Label</strong><br>${escapeHtml(entry.page_number_label || "Unknown")}</p>
    <p><strong>County / District</strong><br>${escapeHtml(entry.county_name || "")}${entry.district_name ? ` / ${escapeHtml(entry.district_name)}` : ""}</p>
    ${entry.repository_url ? `<p><a href="${escapeHtml(entry.repository_url)}" target="_blank" rel="noopener">Repository website</a></p>` : ""}
  `;

  if (entry.image_url) {
    detailScanImage.src = entry.image_url;
    detailScanImage.classList.remove("hidden");
    detailScanEmpty.classList.add("hidden");
    openScanLink.href = entry.image_url;
    openScanLink.classList.remove("hidden");
  } else {
    detailScanImage.removeAttribute("src");
    detailScanImage.classList.add("hidden");
    detailScanEmpty.classList.remove("hidden");
    openScanLink.classList.add("hidden");
  }

  setZoom(1);
}

function hideDetail() {
  currentDetail = null;
  detailView.classList.add("hidden");
}

async function searchEntries(params) {
  const apiPayload = await searchEntriesFromApi(params);
  if (apiPayload) return apiPayload.entries || [];

  const dbPayload = await searchEntriesFromSupabase(params);
  if (dbPayload) return dbPayload;

  summary.textContent = "Search failed";
  return [];
}

async function getEntryDetail(entryId) {
  const apiPayload = await getEntryDetailFromApi(entryId);
  if (apiPayload) return apiPayload.entry || null;

  return getEntryDetailFromSupabase(entryId);
}

async function searchEntriesFromApi(params) {
  try {
    const response = await fetch(`/api/public/search?${params.toString()}`);
    if (!response.ok) return null;
    return response.json();
  } catch (_error) {
    return null;
  }
}

async function searchEntriesFromSupabase(params) {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.rpc("public_search_entries", {
    p_name: params.get("name"),
    p_county_id: params.get("county_id") || null,
    p_district_id: params.get("district_id") || null,
    p_year: Number(params.get("year") || 1863),
    p_taxpayer: params.get("taxpayer_name") || null,
    p_mode: params.get("match_mode") || "fuzzy",
    p_limit: 100,
    p_offset: 0
  });
  if (error) return null;
  return data || [];
}

async function getEntryDetailFromApi(entryId) {
  try {
    const response = await fetch(`/api/public/entries/${Number(entryId)}`);
    if (!response.ok) return null;
    return response.json();
  } catch (_error) {
    return null;
  }
}

async function getEntryDetailFromSupabase(entryId) {
  if (!supabaseClient) return null;

  const { data, error } = await supabaseClient.rpc("public_get_entry_detail", {
    p_entry_id: Number(entryId)
  });

  if (error || !data?.length) return null;
  return data[0];
}

function exportResultsCsv() {
  if (!currentRows.length) return;

  const headers = [
    "id",
    "enslaved_name_original",
    "enslaved_name_normalized",
    "taxpayer_name_original",
    "county_name",
    "district_name",
    "year",
    "page_number_label",
    "source_title",
    "repository_name"
  ];

  const lines = [
    headers.join(","),
    ...currentRows.map((row) =>
      headers.map((key) => csvCell(row[key])).join(",")
    )
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "1863-search-results.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function updateUrlFromForm() {
  const params = new URLSearchParams(window.location.search);
  const form = new FormData(searchForm);

  for (const [key, value] of form.entries()) {
    if (value === "") params.delete(key);
    else params.set(key, value);
  }

  history.replaceState({}, "", `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`);
}

function setZoom(value) {
  currentZoom = value;
  detailScanImage.style.transform = `scale(${currentZoom})`;
}

function formatDateLine(row) {
  const left = row.source_title || "Unknown source";
  const right = [row.county_name, row.district_name, row.year].filter(Boolean).join("; ");
  return right ? `${left}. ${right}.` : left;
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function createSupabaseClient() {
  if (!window.supabase?.createClient) return null;
  if (!window.SUPABASE_URL || !window.SUPABASE_PUBLISHABLE_KEY) return null;
  return window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
