const searchForm = document.getElementById("search-form");
const countySelect = document.getElementById("county_id");
const districtSelect = document.getElementById("district_id");
const filtersNote = document.getElementById("filters-note");
const resultsBody = document.getElementById("results-body");
const summary = document.getElementById("summary");
const detail = document.getElementById("detail");
const menuToggle = document.getElementById("menu-toggle");
const siteMenu = document.getElementById("site-menu");
const supabaseClient = createSupabaseClient();

let currentRows = [];

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
});

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(searchForm);
  const params = new URLSearchParams();

  for (const [key, value] of form.entries()) {
    if (value !== "") {
      params.set(key, value);
    }
  }

  summary.textContent = "Searching...";
  const payload = await searchEntries(params);
  currentRows = payload;
  summary.textContent = `${payload.length} records found`;
  renderRows();
});

async function init() {
  try {
    await loadCounties();
    await loadDistricts(null);
    filtersNote.textContent = "County and district filters loaded from database.";
  } catch (_error) {
    filtersNote.textContent = "Could not load county/district lists. You can still search by name.";
  }
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
  if (apiPayload) {
    return apiPayload;
  }

  const dbPayload = await fetchFiltersFromSupabase(countyId);
  if (dbPayload) {
    return dbPayload;
  }

  throw new Error("filters_fetch_failed");
}

async function fetchFiltersFromApi(countyId = null) {
  try {
    const params = new URLSearchParams();
    if (countyId) {
      params.set("county_id", countyId);
    }
    const url = `/api/public/filters${params.toString() ? `?${params.toString()}` : ""}`;
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return response.json();
  } catch (_error) {
    return null;
  }
}

async function fetchFiltersFromSupabase(countyId = null) {
  if (!supabaseClient) {
    return null;
  }

  const countiesQuery = supabaseClient.schema("archive1863").from("counties").select("id,name").eq("enabled", true).order("name", { ascending: true });
  const districtsQuery = supabaseClient
    .schema("archive1863")
    .from("districts")
    .select("id,county_id,name")
    .eq("enabled", true)
    .order("name", { ascending: true });

  if (countyId) {
    districtsQuery.eq("county_id", Number(countyId));
  }

  const [{ data: counties, error: countiesError }, { data: districts, error: districtsError }] = await Promise.all([
    countiesQuery,
    districtsQuery
  ]);

  if (countiesError || districtsError) {
    return null;
  }

  return {
    counties: counties || [],
    districts: districts || []
  };
}

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
  const entry = await getEntryDetail(entryId);
  if (!entry) {
    detail.innerHTML = "<p>Failed to load detail.</p>";
    return;
  }

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
      ${showHighlight ? "<p><strong>Entry Highlight:</strong> Approximate row marker shown from line/sequence metadata.</p>" : ""}
      ${entry.image_thumbnail_url ? `<p><a href="${escapeHtml(entry.image_url)}" target="_blank" rel="noopener">Open scan image</a></p>` : ""}
    </div>
  `;
}

async function searchEntries(params) {
  const apiPayload = await searchEntriesFromApi(params);
  if (apiPayload) {
    return apiPayload.entries || [];
  }

  const dbPayload = await searchEntriesFromSupabase(params);
  if (dbPayload) {
    return dbPayload;
  }

  summary.textContent = "Search failed";
  return [];
}

async function getEntryDetail(entryId) {
  const apiPayload = await getEntryDetailFromApi(entryId);
  if (apiPayload) {
    return apiPayload.entry || null;
  }

  return getEntryDetailFromSupabase(entryId);
}

async function searchEntriesFromApi(params) {
  try {
    const response = await fetch(`/api/public/search?${params.toString()}`);
    if (!response.ok) {
      const errorPayload = await safeJson(response);
      if (errorPayload?.error === "name_required") {
        summary.textContent = "Name is required";
      }
      return null;
    }
    return response.json();
  } catch (_error) {
    return null;
  }
}

async function searchEntriesFromSupabase(params) {
  if (!supabaseClient) {
    return null;
  }

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

  if (error) {
    return null;
  }
  return data || [];
}

async function getEntryDetailFromApi(entryId) {
  try {
    const response = await fetch(`/api/public/entries/${Number(entryId)}`);
    if (!response.ok) {
      return null;
    }
    return response.json();
  } catch (_error) {
    return null;
  }
}

async function getEntryDetailFromSupabase(entryId) {
  if (!supabaseClient) {
    return null;
  }

  const { data, error } = await supabaseClient.rpc("public_get_entry_detail", {
    p_entry_id: Number(entryId)
  });

  if (error || !data?.length) {
    return null;
  }
  return data[0];
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch (_error) {
    return null;
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

function createSupabaseClient() {
  if (!window.supabase?.createClient) {
    return null;
  }
  if (!window.SUPABASE_URL || !window.SUPABASE_PUBLISHABLE_KEY) {
    return null;
  }
  return window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY);
}
