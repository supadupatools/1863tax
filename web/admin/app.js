const appPanel = document.getElementById("app-panel");
const userMeta = document.getElementById("user-meta");
const logoutBtn = document.getElementById("logout-btn");
const nav = document.getElementById("nav");
const pageHeader = document.getElementById("page-header");
const pageContent = document.getElementById("page-content");
const drawer = document.getElementById("drawer");
const drawerTitle = document.getElementById("drawer-title");
const drawerForm = document.getElementById("drawer-form");
const drawerClose = document.getElementById("drawer-close");
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modal-title");
const modalMessage = document.getElementById("modal-message");
const modalCancel = document.getElementById("modal-cancel");
const modalConfirm = document.getElementById("modal-confirm");
const adminSearch = document.getElementById("admin-search");
const envBadge = document.getElementById("env-badge");
const schema = window.ARCHIVE_SCHEMA || "archive1863";
const initialToken = localStorage.getItem("archive_admin_token") || null;
const hasSupabaseJs = Boolean(window.supabase?.createClient);
const supabaseClient = hasSupabaseJs
  ? window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_PUBLISHABLE_KEY,
    initialToken
      ? {
        global: {
          headers: {
            Authorization: `Bearer ${initialToken}`
          }
        }
      }
      : undefined
  )
  : null;

const state = {
  token: initialToken,
  user: getStoredUser(),
  route: "dashboard",
  drawerSubmit: null,
  modalConfirm: null,
  cache: new Map(),
  selectedPage: null,
  imageViewer: { zoom: 1, rotate: 0, brightness: 100, contrast: 100 }
};

const ROUTES = {
  dashboard: {
    title: "Dashboard",
    desc: "Throughput overview and workflow bottlenecks.",
    render: renderDashboard
  },
  "coverage-counties": {
    title: "Coverage: Counties",
    desc: "Maintain county metadata and publication status.",
    render: () => renderEntityScreen("counties")
  },
  "coverage-districts": {
    title: "Coverage: Districts",
    desc: "Map tax districts and township structures.",
    render: () => renderEntityScreen("districts")
  },
  "sources-repositories": {
    title: "Sources: Repositories",
    desc: "Archive repositories and locations.",
    render: () => renderEntityScreen("repositories")
  },
  "sources-sources": {
    title: "Sources",
    desc: "Source records and citation settings.",
    render: () => renderEntityScreen("sources")
  },
  "sources-items": {
    title: "Source Items",
    desc: "Volumes, rolls, and sub-items.",
    render: () => renderEntityScreen("source_items")
  },
  "sources-pages": {
    title: "Pages (Scans)",
    desc: "Scan management, assignment, and detail editing.",
    render: renderPagesScreen
  },
  "transcription-queue": {
    title: "Transcription Queue",
    desc: "Prioritize pages ready for transcription.",
    render: renderTranscriptionQueue
  },
  "transcription-workspace": {
    title: "Transcription Workspace",
    desc: "Image viewer + structured entry builder.",
    render: renderTranscriptionWorkspace
  },
  "transcription-drafts": {
    title: "My Drafts",
    desc: "Resume and submit your draft entries.",
    render: renderMyDrafts
  },
  "review-queue": {
    title: "Review Queue",
    desc: "Approve, reject, or request revisions.",
    render: () => renderReviewStatus("queue")
  },
  "review-approved": {
    title: "Approved",
    desc: "Published entries visible to public search.",
    render: () => renderReviewStatus("approved")
  },
  "review-rejected": {
    title: "Rejected",
    desc: "Rejected entries and correction history.",
    render: () => renderReviewStatus("rejected")
  },
  "people-taxpayers": {
    title: "Taxpayers",
    desc: "Directory of taxpayer entities and links.",
    render: () => renderEntityScreen("taxpayers")
  },
  "people-enslaved": {
    title: "Enslaved People",
    desc: "Name directory with appearance context.",
    render: () => renderEntityScreen("enslaved_people")
  },
  "people-aliases": {
    title: "Aliases",
    desc: "Optional alias variants for search support.",
    render: () => renderEntityScreen("aliases")
  },
  imports: {
    title: "Imports",
    desc: "CSV/JSON import wizard and validation.",
    render: renderImports
  },
  "audit-log": {
    title: "Audit Log",
    desc: "Trace data edits by user, entity, and date.",
    render: renderAuditLog
  },
  settings: {
    title: "Settings",
    desc: "Users, roles, normalization, and publishing rules.",
    render: renderSettings
  }
};

const TABLE_SCHEMAS = {
  counties: {
    title: "Counties",
    columns: ["id", "name", "state", "enabled", "notes"],
    fields: [
      { key: "name", label: "County Name", required: true },
      { key: "state", label: "State", defaultValue: "NC", required: true },
      { key: "enabled", label: "Enabled", type: "checkbox", defaultValue: true },
      { key: "notes", label: "Notes", type: "textarea" }
    ]
  },
  districts: {
    title: "Districts",
    columns: ["id", "county_id", "name", "type", "enabled", "notes"],
    fields: [
      { key: "county_id", label: "County", type: "number", required: true },
      { key: "name", label: "District/Township Name", required: true },
      {
        key: "type",
        label: "Type",
        type: "select",
        options: ["Township", "Tax District", "Captain's District", "Other"]
      },
      { key: "enabled", label: "Enabled", type: "checkbox", defaultValue: true },
      { key: "notes", label: "Notes", type: "textarea" }
    ]
  },
  repositories: {
    title: "Repositories",
    columns: ["id", "name", "location", "url", "notes"],
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "location", label: "Location" },
      { key: "url", label: "URL" },
      { key: "notes", label: "Notes", type: "textarea" }
    ]
  },
  sources: {
    title: "Sources",
    columns: ["id", "title", "county_id", "year", "format", "call_number", "rights"],
    fields: [
      { key: "repository_id", label: "Repository", type: "number", required: true },
      { key: "county_id", label: "County", type: "number", required: true },
      { key: "year", label: "Year", type: "number", defaultValue: 1863 },
      { key: "title", label: "Title", required: true },
      {
        key: "format",
        label: "Format",
        type: "select",
        options: ["microfilm", "bound book", "digital scans", "other"]
      },
      { key: "call_number", label: "Call Number" },
      { key: "microfilm_roll", label: "Microfilm Roll" },
      { key: "rights", label: "Rights / Usage", type: "textarea" },
      { key: "citation_preferred", label: "Preferred Citation", type: "textarea" },
      { key: "notes", label: "Notes", type: "textarea" }
    ]
  },
  source_items: {
    title: "Source Items",
    columns: ["id", "source_id", "label", "date_range", "notes"],
    fields: [
      { key: "source_id", label: "Source", type: "number", required: true },
      { key: "label", label: "Label", required: true },
      { key: "date_range", label: "Date Range" },
      { key: "notes", label: "Notes", type: "textarea" }
    ]
  },
  pages: {
    title: "Pages",
    columns: [
      "id",
      "page_number_label",
      "county_id",
      "district_id",
      "needs_review",
      "image_thumbnail_url"
    ],
    fields: [
      { key: "source_item_id", label: "Source Item", type: "number", required: true },
      { key: "county_id", label: "County", type: "number", required: true },
      { key: "district_id", label: "District", type: "number" },
      { key: "page_number_label", label: "Page Label", required: true },
      { key: "image_url", label: "Image URL", required: true },
      { key: "image_thumbnail_url", label: "Thumbnail URL" },
      { key: "captured_at", label: "Captured At", type: "datetime-local" },
      { key: "needs_review", label: "Needs Review", type: "checkbox" },
      { key: "notes", label: "Notes", type: "textarea" }
    ]
  },
  taxpayers: {
    title: "Taxpayers",
    columns: ["id", "name_original", "name_normalized", "county_id", "district_id", "notes"],
    fields: [
      { key: "name_original", label: "Name (original)", required: true },
      { key: "name_normalized", label: "Name (normalized)", required: true },
      { key: "county_id", label: "County", type: "number" },
      { key: "district_id", label: "District", type: "number" },
      { key: "notes", label: "Notes", type: "textarea" }
    ]
  },
  enslaved_people: {
    title: "Enslaved People",
    columns: [
      "id",
      "name_original",
      "name_normalized",
      "gender",
      "approx_birth_year",
      "notes"
    ],
    fields: [
      { key: "name_original", label: "Name (original)", required: true },
      { key: "name_normalized", label: "Name (normalized)", required: true },
      { key: "gender", label: "Gender" },
      { key: "approx_birth_year", label: "Approx Birth Year", type: "number" },
      { key: "notes", label: "Notes", type: "textarea" }
    ]
  },
  aliases: {
    title: "Aliases",
    columns: ["id", "entity_type", "entity_id", "alias_original", "alias_normalized", "notes"],
    fields: [
      {
        key: "entity_type",
        label: "Entity Type",
        type: "select",
        options: ["taxpayer", "enslaved_person"],
        required: true
      },
      { key: "entity_id", label: "Entity ID", type: "number", required: true },
      { key: "alias_original", label: "Alias (original)", required: true },
      { key: "alias_normalized", label: "Alias (normalized)", required: true },
      { key: "notes", label: "Notes", type: "textarea" }
    ]
  }
};

logoutBtn.addEventListener("click", handleLogout);
drawerClose.addEventListener("click", closeDrawer);
modalCancel.addEventListener("click", closeModal);
adminSearch.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    runGlobalSearch(adminSearch.value.trim());
  }
});

nav.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    state.route = button.dataset.route;
    renderRoute();
  });
});

if (window.location.hostname.includes("localhost")) {
  envBadge.textContent = "Staging";
} else {
  envBadge.textContent = "Prod";
}

hydrateAuth();

function handleLogout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem("archive_admin_token");
  localStorage.removeItem("archive_admin_user");
  supabaseClient.auth.signOut().catch(() => {});
  window.location.replace("/admin/login");
}

async function hydrateAuth() {
  if (!hasSupabaseJs) {
    appPanel.classList.remove("hidden");
    pageHeader.innerHTML = "<h2>Admin Runtime Error</h2><p>Supabase JS SDK failed to load.</p>";
    pageContent.innerHTML =
      "<p>Cannot load admin app because Supabase SDK is unavailable. Check CDN/network and redeploy cache-busted assets.</p>";
    return;
  }

  if (!state.token) {
    window.location.replace("/admin/login");
    return;
  }

  await refreshUserProfileFromSupabase();

  const allowedRoles = new Set(["admin", "reviewer", "transcriber"]);
  if (!state.user?.isActive || !allowedRoles.has(state.user?.role)) {
    localStorage.removeItem("archive_admin_token");
    localStorage.removeItem("archive_admin_user");
    window.location.replace("/admin/login?reason=role");
    return;
  }

  appPanel.classList.remove("hidden");
  userMeta.textContent = `Role: ${state.user?.role || "authenticated"}`;
  renderRoute();
}

async function refreshUserProfileFromSupabase() {
  if (!state.token || !hasSupabaseJs) return;
  const allowedRoles = new Set(["admin", "reviewer", "transcriber"]);
  if (state.user?.isActive && allowedRoles.has(state.user?.role)) return;

  try {
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(state.token);
    if (userError || !userData?.user?.id) return;

    const { data: profile, error: profileError } = await supabaseClient
      .schema(schema)
      .from("user_profiles")
      .select("auth_user_id, email, display_name, role, is_active")
      .eq("auth_user_id", userData.user.id)
      .maybeSingle();

    if (profileError || !profile) return;

    state.user = {
      id: profile.auth_user_id,
      email: profile.email || userData.user.email,
      role: profile.role,
      displayName: profile.display_name || userData.user.email,
      isActive: profile.is_active
    };
    localStorage.setItem("archive_admin_user", JSON.stringify(state.user));
  } catch (_error) {
    // Keep existing local user payload if lookup fails.
  }
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem("archive_admin_user");
    if (raw) return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
  return null;
}

async function renderRoute() {
  const def = ROUTES[state.route] || ROUTES.dashboard;
  nav.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.route === state.route);
  });

  pageHeader.innerHTML = `<h2>${def.title}</h2><p>${def.desc}</p>`;
  pageContent.innerHTML = "<p>Loading...</p>";

  try {
    await def.render();
  } catch (error) {
    pageContent.innerHTML = `<p>${escapeHtml(error.message || "Failed to load screen")}</p>`;
  }
}

async function renderDashboard() {
  const [stats, drafts, queue] = await Promise.all([
    apiJson("/api/admin/dashboard/stats"),
    apiJson("/api/admin/my-drafts"),
    apiJson("/api/admin/transcription-queue")
  ]);

  const recentDrafts = drafts.slice(0, 8);
  const queueItems = queue.slice(0, 8);

  pageContent.innerHTML = `
    <div class="stat-grid">
      <article class="stat-card"><h3>Pages scanned</h3><p>${stats.pages_scanned}</p></article>
      <article class="stat-card"><h3>Entries created (draft)</h3><p>${stats.entries_draft}</p></article>
      <article class="stat-card"><h3>Awaiting review</h3><p>${stats.awaiting_review}</p></article>
      <article class="stat-card"><h3>Approved public</h3><p>${stats.approved_public}</p></article>
    </div>

    <div class="two-col">
      <article class="card">
        <h3>My Work</h3>
        ${recentDrafts.length ? `
          <ul>
            ${recentDrafts.map((row) => `<li>Page ${escapeHtml(row.page_number_label || "-")} • ${escapeHtml(row.enslaved_name_original || "-")} • ${statusPill(row.status)}</li>`).join("")}
          </ul>
        ` : "<p>No drafts assigned.</p>"}
      </article>

      <article class="card">
        <h3>System Alerts</h3>
        <ul>
          <li>Missing district mapping: ${stats.alerts.missing_district_mapping}</li>
          <li>Pages without thumbnails: ${stats.alerts.pages_without_thumbnails}</li>
          <li>Sources missing citations: ${stats.alerts.sources_missing_citations}</li>
        </ul>
      </article>
    </div>

    <article class="card" style="margin-top:0.8rem;">
      <h3>Transcription Queue Snapshot</h3>
      ${renderMiniTable(
        ["page_number_label", "county_name", "district_name", "draft_entries", "last_activity"],
        queueItems
      )}
    </article>
  `;
}

async function renderEntityScreen(tableName) {
  const schema = TABLE_SCHEMAS[tableName];
  const rows = await apiJson(`/api/admin/${tableName}`);
  renderEntityTable({ tableName, schema, rows, withCitation: tableName === "sources" });
}

function renderEntityTable({ tableName, schema, rows, withCitation = false }) {
  const pageSize = 50;
  let page = 1;
  let sortKey = schema.columns[0];
  let sortDirection = "desc";
  let filterText = "";

  pageContent.innerHTML = `
    <div class="toolbar">
      <input id="filter-input" placeholder="Filter rows..." />
      <button id="add-row" class="primary-btn" type="button">Add ${escapeHtml(schema.title.slice(0, -1) || "Record")}</button>
      <button id="refresh-rows" class="ghost-btn" type="button">Refresh</button>
    </div>
    <div id="entity-table"></div>
    ${withCitation ? '<div id="citation-preview" class="citation-preview" style="margin-top:0.7rem;">Citation preview will appear while editing source records.</div>' : ""}
  `;

  const filterInput = document.getElementById("filter-input");
  const tableRoot = document.getElementById("entity-table");
  const addBtn = document.getElementById("add-row");
  const refreshBtn = document.getElementById("refresh-rows");

  addBtn.addEventListener("click", () => openEntityDrawer({ tableName, schema }));
  refreshBtn.addEventListener("click", () => renderRoute());
  filterInput.addEventListener("input", () => {
    filterText = filterInput.value.trim().toLowerCase();
    page = 1;
    draw();
  });

  function draw() {
    const filtered = rows.filter((row) => {
      if (!filterText) return true;
      return Object.values(row).some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(filterText)
      );
    });

    const sorted = [...filtered].sort((a, b) => compareRows(a, b, sortKey, sortDirection));
    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    page = Math.min(page, totalPages);
    const slice = sorted.slice((page - 1) * pageSize, page * pageSize);

    tableRoot.innerHTML = `
      <div class="entity-table-wrap">
        <table>
          <thead>
            <tr>
              ${schema.columns
                .map((column) => `<th><button class="ghost-btn sort-btn" data-sort="${column}">${escapeHtml(column)}</button></th>`)
                .join("")}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${slice
              .map((row) => `
                <tr>
                  ${schema.columns.map((column) => `<td>${formatCell(column, row[column])}</td>`).join("")}
                  <td>
                    <button class="ghost-btn edit-row" data-id="${row.id}">Edit</button>
                    <button class="danger-btn delete-row" data-id="${row.id}">Delete</button>
                  </td>
                </tr>
              `)
              .join("")}
          </tbody>
        </table>
      </div>
      <div class="toolbar" style="margin-top:0.5rem;">
        <span>Showing ${slice.length} of ${filtered.length}</span>
        <button class="ghost-btn" id="prev-page" ${page <= 1 ? "disabled" : ""}>Prev</button>
        <span>Page ${page} / ${totalPages}</span>
        <button class="ghost-btn" id="next-page" ${page >= totalPages ? "disabled" : ""}>Next</button>
      </div>
    `;

    tableRoot.querySelectorAll(".sort-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.sort;
        if (sortKey === key) {
          sortDirection = sortDirection === "asc" ? "desc" : "asc";
        } else {
          sortKey = key;
          sortDirection = "asc";
        }
        draw();
      });
    });

    tableRoot.querySelectorAll(".edit-row").forEach((btn) => {
      btn.addEventListener("click", () => {
        const row = rows.find((r) => String(r.id) === btn.dataset.id);
        openEntityDrawer({ tableName, schema, row });
      });
    });

    tableRoot.querySelectorAll(".delete-row").forEach((btn) => {
      btn.addEventListener("click", () => {
        confirmAction({
          title: "Delete Record",
          message: `Delete ${schema.title.slice(0, -1)} #${btn.dataset.id}?`,
          onConfirm: async () => {
            await apiFetch(`/api/admin/${tableName}/${btn.dataset.id}`, { method: "DELETE" });
            await renderRoute();
          }
        });
      });
    });

    tableRoot.querySelector("#prev-page").addEventListener("click", () => {
      page -= 1;
      draw();
    });

    tableRoot.querySelector("#next-page").addEventListener("click", () => {
      page += 1;
      draw();
    });
  }

  draw();
}

async function renderPagesScreen() {
  const pages = await apiJson("/api/admin/pages");
  state.selectedPage = pages[0] || null;

  pageContent.innerHTML = `
    <div class="toolbar">
      <button id="bulk-upload" class="primary-btn">Upload scans (bulk)</button>
      <button id="generate-thumbs" class="ghost-btn">Generate thumbnails</button>
      <button id="assign-districts" class="ghost-btn">Assign districts (bulk)</button>
      <button id="add-page" class="primary-btn">Add Page</button>
    </div>
    <div class="two-col" style="grid-template-columns: 58% 42%;">
      <div>
        <div class="entity-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Thumbnail</th>
                <th>Page label</th>
                <th>County</th>
                <th>District</th>
                <th>Needs review</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="pages-body"></tbody>
          </table>
        </div>
      </div>
      <div id="page-detail" class="card"></div>
    </div>
  `;

  document.getElementById("add-page").addEventListener("click", () => {
    openEntityDrawer({ tableName: "pages", schema: TABLE_SCHEMAS.pages });
  });

  document.getElementById("bulk-upload").addEventListener("click", () => {
    alert("Use Imports > Pages in import wizard for bulk uploads.");
  });
  document.getElementById("generate-thumbs").addEventListener("click", () => {
    alert("Thumbnail generation queued. (Hook storage worker in production.)");
  });
  document.getElementById("assign-districts").addEventListener("click", () => {
    alert("Use row edits for now. Bulk district assignment endpoint can be added next.");
  });

  const body = document.getElementById("pages-body");
  const detail = document.getElementById("page-detail");

  pages.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.image_thumbnail_url ? `<img src="${escapeHtml(row.image_thumbnail_url)}" alt="thumb" style="width:46px;height:46px;object-fit:cover;"/>` : "-"}</td>
      <td>${escapeHtml(row.page_number_label || "")}</td>
      <td>${escapeHtml(String(row.county_id || ""))}</td>
      <td>${escapeHtml(String(row.district_id || ""))}</td>
      <td>${statusPill(row.needs_review ? "needs_review" : "draft")}</td>
      <td><button class="ghost-btn" data-id="${row.id}">Select</button></td>
    `;
    tr.querySelector("button").addEventListener("click", () => {
      state.selectedPage = row;
      paintDetail();
    });
    body.appendChild(tr);
  });

  paintDetail();

  function paintDetail() {
    const row = state.selectedPage;
    if (!row) {
      detail.innerHTML = "<p>No page selected.</p>";
      return;
    }

    detail.innerHTML = `
      <h3>Page Detail</h3>
      <p><strong>Page:</strong> ${escapeHtml(row.page_number_label || "")}</p>
      <p><strong>County ID:</strong> ${escapeHtml(String(row.county_id || ""))}</p>
      <p><strong>District ID:</strong> ${escapeHtml(String(row.district_id || ""))}</p>
      <p><strong>Source Item ID:</strong> ${escapeHtml(String(row.source_item_id || ""))}</p>
      <p><strong>Needs review:</strong> ${escapeHtml(String(row.needs_review))}</p>
      ${row.image_url ? `<div class="viewer-stage" style="margin:0.5rem 0;"><img src="${escapeHtml(row.image_url)}" alt="page image"/></div>` : ""}
      <div class="toolbar">
        <button class="primary-btn" id="open-workspace">Open in Workspace</button>
        <button class="ghost-btn" id="mark-ready">Mark Ready</button>
        <button class="ghost-btn" id="download-image">Download image</button>
        <button class="ghost-btn" id="edit-page">Edit</button>
      </div>
    `;

    detail.querySelector("#open-workspace").addEventListener("click", () => {
      state.cache.set("workspace.page", row);
      state.route = "transcription-workspace";
      renderRoute();
    });

    detail.querySelector("#mark-ready").addEventListener("click", async () => {
      await apiFetch(`/api/admin/pages/${row.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ needs_review: false })
      });
      renderRoute();
    });

    detail.querySelector("#download-image").addEventListener("click", () => {
      window.open(row.image_url, "_blank", "noopener");
    });

    detail.querySelector("#edit-page").addEventListener("click", () => {
      openEntityDrawer({ tableName: "pages", schema: TABLE_SCHEMAS.pages, row });
    });
  }
}

async function renderTranscriptionQueue() {
  const queue = await apiJson("/api/admin/transcription-queue");

  pageContent.innerHTML = `
    <div class="toolbar">
      <input id="queue-county" placeholder="County ID" />
      <input id="queue-district" placeholder="District ID" />
      <select id="queue-status">
        <option value="">All status</option>
        <option value="needs_review">needs_review</option>
        <option value="draft">draft</option>
        <option value="pending_review">pending_review</option>
      </select>
      <button id="queue-filter" class="ghost-btn">Apply</button>
    </div>
    ${renderMiniTable(["page_id", "page_number_label", "county_name", "district_name", "draft_entries", "last_activity"], queue, true)}
  `;

  pageContent.querySelectorAll("button[data-page-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pageId = Number(btn.dataset.pageId);
      const page = queue.find((q) => Number(q.page_id) === pageId);
      state.cache.set("workspace.page", page);
      state.route = "transcription-workspace";
      renderRoute();
    });
  });

  document.getElementById("queue-filter").addEventListener("click", async () => {
    const countyId = document.getElementById("queue-county").value.trim();
    const districtId = document.getElementById("queue-district").value.trim();
    const status = document.getElementById("queue-status").value;
    const params = new URLSearchParams();
    if (countyId) params.set("county_id", countyId);
    if (districtId) params.set("district_id", districtId);
    if (status) params.set("status", status);
    const data = await apiJson(`/api/admin/transcription-queue?${params.toString()}`);
    pageContent.innerHTML = `${renderMiniTable(["page_id", "page_number_label", "county_name", "district_name", "draft_entries", "last_activity"], data, true)}`;
  });
}

async function renderTranscriptionWorkspace() {
  const page = state.cache.get("workspace.page") || null;

  let pageEntries = [];
  if (page?.page_id || page?.id) {
    const pageId = page.page_id || page.id;
    pageEntries = await apiJson(`/api/transcriptions/entries/by-page/${pageId}`);
  }

  const pageContext = pageEntries[0] || null;
  const pageInfo = page
    ? `
      <p><strong>Page:</strong> ${escapeHtml(page.page_number_label || page.page_id || "")}</p>
      <p><strong>County / District:</strong> ${escapeHtml(pageContext?.county_name || page.county_name || page.county_id || "")}${pageContext?.district_name || page.district_name || page.district_id ? ` / ${escapeHtml(pageContext?.district_name || page.district_name || page.district_id || "")}` : ""}</p>
      <p><strong>Source Item:</strong> ${escapeHtml(pageContext?.source_item_label || "N/A")}</p>
      <p><strong>Source Title:</strong> ${escapeHtml(pageContext?.source_title || "N/A")}</p>
      <p><strong>Repository:</strong> ${escapeHtml(pageContext?.repository_name || "N/A")}${pageContext?.repository_location ? ` (${escapeHtml(pageContext.repository_location)})` : ""}</p>
    `
    : "<p>Select a page from Queue or Pages to begin.</p>";

  pageContent.innerHTML = `
    <div class="workspace">
      <section class="viewer">
        <div class="viewer-toolbar">
          <button id="zoom-in" class="ghost-btn">Zoom +</button>
          <button id="zoom-out" class="ghost-btn">Zoom -</button>
          <button id="rotate" class="ghost-btn">Rotate</button>
          <label>Brightness <input id="brightness" type="range" min="50" max="150" value="${state.imageViewer.brightness}" /></label>
          <label>Contrast <input id="contrast" type="range" min="50" max="150" value="${state.imageViewer.contrast}" /></label>
          <button id="fullscreen" class="ghost-btn">Fullscreen</button>
        </div>
        <div class="viewer-stage">
          ${page?.image_url ? `<img id="viewer-image" src="${escapeHtml(page.image_url)}" alt="scan" />` : "<p>No page image loaded.</p>"}
        </div>
        <div class="card" style="margin-top:0.55rem;">${pageInfo}</div>
      </section>

      <section class="card">
        <h3>Entry Builder</h3>
        <p style="margin-top:0;">Each row is anchored to this page and inherits county/district from page metadata.</p>
        <div class="entry-list">
          ${renderMiniTable(["sequence_on_page", "taxpayer_name_original", "enslaved_name_original", "status", "transcription_confidence"], pageEntries)}
        </div>

        <form id="entry-form" class="form-grid two">
          <label>Page ID <input name="page_id" type="number" value="${escapeHtml(String(page?.page_id || page?.id || ""))}" required readonly /></label>
          <label>County ID <input name="county_id" type="number" value="${escapeHtml(String(page?.county_id || ""))}" required readonly /></label>
          <label>District ID <input name="district_id" type="number" value="${escapeHtml(String(page?.district_id || ""))}" readonly /></label>
          <label>Sequence on page <input name="sequence_on_page" type="number" required /></label>
          <label>Line number <input name="line_number" /></label>
          <label>Year <input name="year" type="number" value="1863" /></label>

          <label>Taxpayer search/input <input name="taxpayer_name_original" required /></label>
          <label>Taxpayer normalized <input name="taxpayer_name_normalized" /></label>

          <label>Enslaved name <input name="enslaved_name_original" required /></label>
          <label>Enslaved normalized <input name="enslaved_name_normalized" /></label>

          <label>Category / descriptor <input name="category_original" /></label>
          <label>Age (original) <input name="age_original" /></label>
          <label>Age years <input name="age_years" type="number" /></label>
          <label>Value (original) <input name="value_original" /></label>
          <label>Value cents <input name="value_cents" type="number" /></label>
          <label>Quantity (original) <input name="quantity_original" /></label>
          <label style="grid-column:1/-1;">Remarks <textarea name="remarks_original"></textarea></label>

          <label>Confidence (0-100)
            <input id="confidence" name="transcription_confidence" type="range" min="0" max="100" value="80" />
          </label>
          <label>Status
            <select name="status">
              <option value="draft">draft</option>
              <option value="pending_review">needs_review</option>
            </select>
          </label>

          <div style="grid-column:1/-1;display:flex;gap:0.45rem;flex-wrap:wrap;">
            <button type="submit">Save Draft</button>
            <button id="submit-review" type="button" class="ghost-btn">Submit for Review</button>
            <button id="save-add" type="button" class="ghost-btn">Save + Add Another</button>
          </div>

          <div id="qa-warnings" style="grid-column:1/-1;"></div>
        </form>
      </section>
    </div>
  `;

  const viewerImage = document.getElementById("viewer-image");
  const brightness = document.getElementById("brightness");
  const contrast = document.getElementById("contrast");

  function applyViewerStyles() {
    if (!viewerImage) return;
    viewerImage.style.transform = `scale(${state.imageViewer.zoom}) rotate(${state.imageViewer.rotate}deg)`;
    viewerImage.style.filter = `brightness(${state.imageViewer.brightness}%) contrast(${state.imageViewer.contrast}%)`;
  }

  applyViewerStyles();

  document.getElementById("zoom-in").addEventListener("click", () => {
    state.imageViewer.zoom = Math.min(3, state.imageViewer.zoom + 0.15);
    applyViewerStyles();
  });
  document.getElementById("zoom-out").addEventListener("click", () => {
    state.imageViewer.zoom = Math.max(0.5, state.imageViewer.zoom - 0.15);
    applyViewerStyles();
  });
  document.getElementById("rotate").addEventListener("click", () => {
    state.imageViewer.rotate = (state.imageViewer.rotate + 90) % 360;
    applyViewerStyles();
  });
  brightness.addEventListener("input", () => {
    state.imageViewer.brightness = Number(brightness.value);
    applyViewerStyles();
  });
  contrast.addEventListener("input", () => {
    state.imageViewer.contrast = Number(contrast.value);
    applyViewerStyles();
  });
  document.getElementById("fullscreen").addEventListener("click", () => {
    document.querySelector(".viewer-stage")?.requestFullscreen?.();
  });

  const entryForm = document.getElementById("entry-form");
  const qaWarnings = document.getElementById("qa-warnings");
  let lastCreatedId = null;

  function runQa(payload) {
    const warnings = [];
    if ((payload.enslaved_name_original || "").toLowerCase() !== (payload.enslaved_name_normalized || "").toLowerCase()) {
      warnings.push("Name normalized differs from original; verify intent.");
    }

    const exists = pageEntries.some(
      (row) =>
        String(row.sequence_on_page || "") === String(payload.sequence_on_page || "") &&
        (row.taxpayer_name_original || "").toLowerCase() === (payload.taxpayer_name_original || "").toLowerCase() &&
        (row.enslaved_name_original || "").toLowerCase() === (payload.enslaved_name_original || "").toLowerCase()
    );
    if (exists) {
      warnings.push("Same taxpayer + enslaved name already exists on this page.");
    }

    if (!payload.district_id) {
      warnings.push("District missing for page.");
    }

    qaWarnings.innerHTML = warnings.map((w) => `<div class="qa-warning">${escapeHtml(w)}</div>`).join("");
  }

  entryForm.addEventListener("input", () => {
    const formData = new FormData(entryForm);
    const payload = Object.fromEntries(formData.entries());
    runQa(payload);
  });

  entryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(entryForm);
    const payload = Object.fromEntries(formData.entries());
    if (!payload.page_id) {
      alert("Select a page from Queue or Pages before saving an entry.");
      return;
    }
    payload.transcription_confidence = Number(payload.transcription_confidence || 0) / 100;

    const created = await apiJson("/api/transcriptions/entries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    lastCreatedId = created.id;
    state.cache.set("workspace.lastCreated", created.id);
    alert(`Draft saved for entry #${created.id}`);
    renderRoute();
  });

  document.getElementById("submit-review").addEventListener("click", async () => {
    if (!lastCreatedId && state.cache.get("workspace.lastCreated")) {
      lastCreatedId = state.cache.get("workspace.lastCreated");
    }
    if (!lastCreatedId) {
      alert("Save draft first, then submit for review.");
      return;
    }
    await apiJson(`/api/transcriptions/entries/${lastCreatedId}/submit`, { method: "POST" });
    alert(`Entry #${lastCreatedId} submitted for review.`);
    renderRoute();
  });

  document.getElementById("save-add").addEventListener("click", async () => {
    entryForm.requestSubmit();
    setTimeout(() => {
      entryForm.reset();
      qaWarnings.innerHTML = "";
    }, 100);
  });
}

async function renderMyDrafts() {
  const drafts = await apiJson("/api/admin/my-drafts");
  pageContent.innerHTML = renderMiniTable(
    [
      "id",
      "page_number_label",
      "county_name",
      "district_name",
      "sequence_on_page",
      "taxpayer_name_original",
      "enslaved_name_original",
      "status"
    ],
    drafts
  );
}

async function renderReviewStatus(kind) {
  const endpoint =
    kind === "queue"
      ? "/api/review/queue"
      : kind === "approved"
        ? "/api/review/status/approved"
        : "/api/review/status/rejected";

  const rows = await apiJson(endpoint);

  pageContent.innerHTML = `
    <div class="two-col" style="grid-template-columns: 42% 58%;">
      <section class="card">
        <h3>${escapeHtml(kind === "queue" ? "Awaiting review" : kind)}</h3>
        <div id="review-list"></div>
      </section>
      <section class="card" id="review-detail">
        <p>Select an entry to review details and decision controls.</p>
      </section>
    </div>
  `;

  const list = document.getElementById("review-list");
  const detail = document.getElementById("review-detail");

  rows.forEach((row) => {
    const btn = document.createElement("button");
    btn.className = "nav-item";
    btn.type = "button";
    btn.innerHTML = `#${row.id} • ${escapeHtml(row.enslaved_name_original || "")} • ${statusPill(row.status)}`;
    btn.addEventListener("click", () => {
      detail.innerHTML = `
        <h3>Entry #${row.id}</h3>
        <p><strong>Taxpayer:</strong> ${escapeHtml(row.taxpayer_name_original || "")} (${escapeHtml(row.taxpayer_name_normalized || "")})</p>
        <p><strong>Enslaved name:</strong> ${escapeHtml(row.enslaved_name_original || "")} (${escapeHtml(row.enslaved_name_normalized || "")})</p>
        <p><strong>County / District:</strong> ${escapeHtml(row.county_name || "")} / ${escapeHtml(row.district_name || "")}</p>
        <p><strong>Confidence:</strong> ${escapeHtml(String(row.transcription_confidence || ""))}</p>
        <p><strong>Remarks:</strong> ${escapeHtml(row.remarks_original || "")}</p>
        ${row.image_thumbnail_url ? `<div class="viewer-stage"><img src="${escapeHtml(row.image_thumbnail_url)}" alt="thumbnail" /></div>` : ""}
        <div class="toolbar">
          <textarea id="review-notes" placeholder="Reviewer notes"></textarea>
          <button id="approve-btn" class="primary-btn">Approve & Publish</button>
          <button id="revise-btn" class="ghost-btn">Send Back for Revision</button>
          <button id="reject-btn" class="danger-btn">Reject</button>
        </div>
      `;

      const notesEl = document.getElementById("review-notes");
      document.getElementById("approve-btn").addEventListener("click", () => submitDecision(row.id, "approved", notesEl.value));
      document.getElementById("revise-btn").addEventListener("click", () => submitDecision(row.id, "rejected", `[needs_revision] ${notesEl.value}`));
      document.getElementById("reject-btn").addEventListener("click", () => submitDecision(row.id, "rejected", notesEl.value));
    });
    list.appendChild(btn);
  });
}

async function submitDecision(entryId, decision, notes) {
  await apiJson(`/api/review/entries/${entryId}/decision`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ decision, notes })
  });
  renderRoute();
}

async function renderImports() {
  pageContent.innerHTML = `
    <form id="import-form" class="card form-grid two">
      <label>Step 1: Upload file <input type="file" name="file" required /></label>
      <label>Step 2: Import type
        <select name="import_type">
          <option value="pages">Pages</option>
          <option value="taxpayers">Taxpayers</option>
          <option value="enslaved_people">Enslaved People</option>
          <option value="entries" selected>Entries + Details</option>
        </select>
      </label>
      <label>Step 3: Format
        <select name="format">
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </select>
      </label>
      <label><input type="checkbox" name="auto_create" checked /> Auto-create missing taxpayers/enslaved people</label>
      <label><input type="checkbox" name="parse_values" checked /> Attempt parse age/value</label>
      <label><input type="checkbox" name="set_needs_review" /> Set all to needs_review</label>
      <button type="submit">Commit import</button>
      <div style="grid-column:1/-1;font-size:0.92rem;">
        Required columns for entry import: <code>page_id</code>, <code>taxpayer_name_original</code>, <code>enslaved_name_original</code>.
        Optional: <code>sequence_on_page</code>, <code>line_number</code>, <code>year</code>, age/value/category/remarks fields.
      </div>
      <pre id="import-output" style="grid-column:1/-1;"></pre>
    </form>
  `;

  const form = document.getElementById("import-form");
  const output = document.getElementById("import-output");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    output.textContent = "Running import...";
    try {
      const body = await apiFetch("/api/transcriptions/bulk-import", {
        method: "POST",
        body: data
      });
      output.textContent = JSON.stringify(body, null, 2);
    } catch (error) {
      output.textContent = `Import failed: ${error.message || "Unknown error"}\nIf this runtime does not support bulk import, use Transcription Workspace page-by-page entry.`;
    }
  });
}

async function renderAuditLog() {
  const logs = await apiJson("/api/admin/audit-log");
  pageContent.innerHTML = `
    <div class="toolbar">
      <input id="audit-user" placeholder="User ID" />
      <input id="audit-entity" placeholder="Entity table" />
      <input id="audit-since" type="date" />
      <button id="audit-filter" class="ghost-btn">Filter</button>
    </div>
    ${renderMiniTable(["created_at", "actor_email", "action", "table_name", "record_id"], logs)}
  `;

  document.getElementById("audit-filter").addEventListener("click", async () => {
    const params = new URLSearchParams();
    const user = document.getElementById("audit-user").value.trim();
    const entity = document.getElementById("audit-entity").value.trim();
    const since = document.getElementById("audit-since").value;
    if (user) params.set("user_id", user);
    if (entity) params.set("entity", entity);
    if (since) params.set("since", `${since}T00:00:00Z`);
    const filtered = await apiJson(`/api/admin/audit-log?${params.toString()}`);
    pageContent.innerHTML = renderMiniTable(["created_at", "actor_email", "action", "table_name", "record_id"], filtered);
  });
}

async function renderSettings() {
  const users = await apiJson("/api/admin/app_users");

  pageContent.innerHTML = `
    <div class="two-col">
      <section class="card">
        <h3>Users & Roles</h3>
        ${renderMiniTable(["id", "email", "display_name", "role", "is_active"], users)}
        <p style="margin-top:0.6rem;">Invite flow can be added with an auth-create endpoint. Current build supports role edits via table drawer.</p>
      </section>

      <section class="card">
        <h3>Normalization Rules</h3>
        <label><input id="normalize-toggle" type="checkbox" checked /> Auto-normalize names</label>
        <label><input id="strip-punc" type="checkbox" checked /> Strip punctuation</label>
        <label><input id="std-jno" type="checkbox" /> Standardize Jno -> John</label>
        <label><input id="keep-apos" type="checkbox" checked /> Preserve apostrophes</label>
        <label>Test normalization<input id="norm-test" placeholder="Jno. O'Neal" /></label>
        <pre id="norm-out"></pre>

        <h3>Publishing Rules</h3>
        <label><input id="require-review" type="checkbox" checked /> Require reviewer approval before public</label>
        <label><input id="allow-review-edit" type="checkbox" /> Allow reviewer edits</label>
      </section>
    </div>
  `;

  const input = document.getElementById("norm-test");
  const out = document.getElementById("norm-out");
  input.addEventListener("input", () => {
    out.textContent = JSON.stringify({
      original: input.value,
      normalized: normalizeName(input.value, {
        stripPunctuation: document.getElementById("strip-punc").checked,
        standardizeJno: document.getElementById("std-jno").checked,
        preserveApostrophes: document.getElementById("keep-apos").checked
      })
    }, null, 2);
  });
}

function openEntityDrawer({ tableName, schema, row = null }) {
  drawer.classList.remove("hidden");
  drawerTitle.textContent = `${row ? "Edit" : "Add"} ${schema.title.slice(0, -1)}`;

  drawerForm.innerHTML = schema.fields
    .map((field) => renderField(field, row))
    .join("") + `<button type="submit">${row ? "Save Changes" : "Create"}</button>`;

  if (tableName === "sources") {
    const preview = document.getElementById("citation-preview");
    if (preview) preview.textContent = row ? buildCitation(row) : "Citation preview updates as you type in the source drawer.";
  }

  drawerForm.onsubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(drawerForm);
    const payload = {};

    for (const field of schema.fields) {
      if (field.type === "checkbox") {
        payload[field.key] = formData.get(field.key) === "on";
      } else {
        const raw = formData.get(field.key);
        if (raw === null || raw === "") continue;
        payload[field.key] = field.type === "number" ? Number(raw) : raw;
      }
    }

    if (tableName === "sources") {
      const preview = document.getElementById("citation-preview");
      if (preview) preview.textContent = buildCitation(payload);
    }

    if (row) {
      await apiJson(`/api/admin/${tableName}/${row.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
    } else {
      await apiJson(`/api/admin/${tableName}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
    }

    closeDrawer();
    renderRoute();
  };
}

function closeDrawer() {
  drawer.classList.add("hidden");
  drawerForm.innerHTML = "";
}

function confirmAction({ title, message, onConfirm }) {
  modal.classList.remove("hidden");
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  state.modalConfirm = onConfirm;
}

modalConfirm.addEventListener("click", async () => {
  if (state.modalConfirm) await state.modalConfirm();
  closeModal();
});

function closeModal() {
  modal.classList.add("hidden");
  state.modalConfirm = null;
}

function renderField(field, row) {
  const value = row?.[field.key] ?? field.defaultValue ?? "";

  if (field.type === "textarea") {
    return `
      <label>${escapeHtml(field.label)}
        <textarea name="${field.key}" ${field.required ? "required" : ""}>${escapeHtml(String(value || ""))}</textarea>
      </label>
    `;
  }

  if (field.type === "select") {
    return `
      <label>${escapeHtml(field.label)}
        <select name="${field.key}" ${field.required ? "required" : ""}>
          ${field.options
            .map((opt) => `<option value="${escapeHtml(opt)}" ${String(value) === opt ? "selected" : ""}>${escapeHtml(opt)}</option>`)
            .join("")}
        </select>
      </label>
    `;
  }

  if (field.type === "checkbox") {
    return `
      <label>
        <input type="checkbox" name="${field.key}" ${value ? "checked" : ""} />
        ${escapeHtml(field.label)}
      </label>
    `;
  }

  const type = field.type || "text";
  return `
    <label>${escapeHtml(field.label)}
      <input type="${type}" name="${field.key}" value="${escapeHtml(String(value || ""))}" ${field.required ? "required" : ""} />
    </label>
  `;
}

function buildCitation(source) {
  const year = source.year || "1863";
  const title = source.title || "Untitled Source";
  const call = source.call_number ? `, Call #: ${source.call_number}` : "";
  const roll = source.microfilm_roll ? `, Roll: ${source.microfilm_roll}` : "";
  return `${title} (${year})${call}${roll}.`;
}

function normalizeName(input, options) {
  let value = String(input || "").trim();
  if (options.standardizeJno) {
    value = value.replace(/\bJno\.?\b/gi, "John");
  }
  if (options.stripPunctuation) {
    if (options.preserveApostrophes) {
      value = value.replace(/[^A-Za-z0-9\s']/g, " ");
    } else {
      value = value.replace(/[^A-Za-z0-9\s]/g, " ");
    }
  }
  return value.replace(/\s+/g, " ").trim();
}

function formatCell(column, value) {
  if (column.includes("status") || column === "needs_review" || column === "enabled") {
    const status = value === true
      ? "approved"
      : value === false
        ? "draft"
        : String(value || "draft");
    return statusPill(status);
  }
  return escapeHtml(String(value ?? ""));
}

function statusPill(status) {
  const clean = String(status || "draft").replace(/[^a-z_]/g, "");
  return `<span class="status-pill status-${clean}">${escapeHtml(clean)}</span>`;
}

function renderMiniTable(columns, rows, queueAction = false) {
  return `
    <div class="entity-table-wrap">
      <table>
        <thead>
          <tr>
            ${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}
            ${queueAction ? "<th>Action</th>" : ""}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
              <tr>
                ${columns.map((column) => `<td>${column === "status" ? statusPill(row[column]) : escapeHtml(String(row[column] ?? ""))}</td>`).join("")}
                ${queueAction ? `<td><button class="ghost-btn" data-page-id="${row.page_id}">Start Transcribing</button></td>` : ""}
              </tr>
            `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function compareRows(a, b, key, direction) {
  const A = a[key];
  const B = b[key];
  const result = String(A ?? "").localeCompare(String(B ?? ""), undefined, {
    numeric: true,
    sensitivity: "base"
  });
  return direction === "asc" ? result : -result;
}

function runGlobalSearch(term) {
  if (!term) return;
  const routes = Object.entries(TABLE_SCHEMAS)
    .filter(([, schema]) => schema.columns.some((col) => col.includes("name") || col.includes("title")))
    .map(([table]) => table)
    .join(", ");
  alert(`Global search target routes: ${routes}\nTerm: ${term}\nTip: open relevant section and use table filter.`);
}

async function apiJson(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const body = options.body ? JSON.parse(options.body) : null;

  if (url.startsWith("/api/admin/dashboard/stats")) {
    return queryDashboardStats();
  }

  if (url.startsWith("/api/admin/my-drafts")) {
    return queryMyDrafts();
  }

  if (url.startsWith("/api/admin/transcription-queue")) {
    const params = new URLSearchParams(url.split("?")[1] || "");
    return queryTranscriptionQueue(params);
  }

  if (url.startsWith("/api/admin/audit-log")) {
    const params = new URLSearchParams(url.split("?")[1] || "");
    return queryAuditLog(params);
  }

  if (url.startsWith("/api/review/queue")) {
    return queryReviewRows("pending_review,rejected");
  }

  if (url.startsWith("/api/review/status/")) {
    const status = url.split("/").pop();
    return queryReviewRows(status);
  }

  if (url.startsWith("/api/review/entries/") && url.endsWith("/decision")) {
    const entryId = Number(url.split("/")[4]);
    return updateReviewDecision(entryId, body);
  }

  if (url.startsWith("/api/transcriptions/entries/by-page/")) {
    const pageId = Number(url.split("/").pop());
    return queryEntriesByPage(pageId);
  }

  if (url === "/api/transcriptions/entries" && method === "POST") {
    return createTranscriptionEntry(body);
  }

  if (url.startsWith("/api/transcriptions/entries/") && url.endsWith("/submit")) {
    const entryId = Number(url.split("/")[4]);
    return submitEntryForReview(entryId);
  }

  if (url === "/api/transcriptions/bulk-import") {
    throw new Error("Bulk import requires backend or edge function. Use SQL/CSV import in Supabase for now.");
  }

  if (url.startsWith("/api/admin/users/invite")) {
    return inviteUser(body);
  }

  if (url.startsWith("/api/admin/")) {
    return handleAdminTableRoute(url, method, body);
  }

  throw new Error(`Unsupported route in Supabase mode: ${url}`);
}

function apiFetch(url, options = {}) {
  return apiJson(url, options);
}

async function handleAdminTableRoute(url, method, payload) {
  const path = url.replace("/api/admin/", "");
  const [table, id] = path.split("/");
  if (!TABLE_SCHEMAS[table] && table !== "app_users") {
    throw new Error(`Unknown table: ${table}`);
  }

  if (method === "GET") {
    let query = supabaseClient.schema(schema).from(table).select("*").order("id", { ascending: false }).limit(300);
    if (table === "app_users") {
      query = supabaseClient
        .schema(schema)
        .from("user_profiles")
        .select("auth_user_id, email, display_name, role, is_active, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(300);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  }

  if (method === "POST") {
    const { data, error } = await supabaseClient
      .schema(schema)
      .from(table)
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  if (method === "PUT") {
    const key = table === "app_users" ? "auth_user_id" : "id";
    const { data, error } = await supabaseClient
      .schema(schema)
      .from(table === "app_users" ? "user_profiles" : table)
      .update(payload)
      .eq(key, id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  if (method === "DELETE") {
    const { error } = await supabaseClient
      .schema(schema)
      .from(table)
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  }

  throw new Error(`Unsupported method ${method} for ${table}`);
}

async function queryDashboardStats() {
  const [pages, drafts, pending, approved, missingDistrict, missingThumb, missingCitation] =
    await Promise.all([
      countRows("pages"),
      countRows("enslavement_details", { status: "draft" }),
      countRows("enslavement_details", { status: "pending_review" }),
      countRows("enslavement_details", { status: "approved" }),
      countRows("pages", { district_id: null }),
      countRows("pages", { image_thumbnail_url: null }),
      countRows("sources", { citation_preferred: null })
    ]);

  return {
    pages_scanned: pages,
    entries_draft: drafts,
    awaiting_review: pending,
    approved_public: approved,
    alerts: {
      missing_district_mapping: missingDistrict,
      pages_without_thumbnails: missingThumb,
      sources_missing_citations: missingCitation
    }
  };
}

async function countRows(table, filters = null) {
  let q = supabaseClient.schema(schema).from(table).select("id", { count: "exact", head: true });
  if (filters) {
    for (const [k, v] of Object.entries(filters)) {
      if (v === null) q = q.is(k, null);
      else q = q.eq(k, v);
    }
  }
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count || 0;
}

async function queryMyDrafts() {
  const { data, error } = await supabaseClient
    .schema(schema)
    .from("v_my_drafts")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  return data || [];
}

async function queryTranscriptionQueue(params) {
  let q = supabaseClient
    .schema(schema)
    .from("v_transcription_queue")
    .select("*")
    .order("last_activity", { ascending: false })
    .limit(300);
  const countyId = params.get("county_id");
  const districtId = params.get("district_id");
  const status = params.get("status");
  if (countyId) q = q.eq("county_id", countyId);
  if (districtId) q = q.eq("district_id", districtId);
  if (status) q = q.eq("entry_status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

async function queryAuditLog(params) {
  let q = supabaseClient
    .schema(schema)
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (params.get("user_id")) q = q.eq("actor_user_id", params.get("user_id"));
  if (params.get("entity")) q = q.eq("table_name", params.get("entity"));
  if (params.get("since")) q = q.gte("created_at", params.get("since"));
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

async function queryReviewRows(statusCsv) {
  let q = supabaseClient
    .schema(schema)
    .from("v_review_queue")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(400);
  const statuses = statusCsv.split(",");
  if (statuses.length === 1) q = q.eq("status", statuses[0]);
  else q = q.in("status", statuses);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

async function updateReviewDecision(entryId, payload) {
  const { data, error } = await supabaseClient
    .schema(schema)
    .from("enslavement_details")
    .update({
      status: payload.decision,
      remarks_original: payload.notes || null
    })
    .eq("entry_id", entryId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function queryEntriesByPage(pageId) {
  const { data, error } = await supabaseClient
    .schema(schema)
    .from("v_entries_by_page")
    .select("*")
    .eq("page_id", pageId)
    .order("sequence_on_page", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

async function createTranscriptionEntry(payload) {
  const { data, error } = await supabaseClient.rpc("create_transcription_entry", {
    p_payload: payload
  });
  if (error) throw new Error(error.message);
  return data;
}

async function submitEntryForReview(entryId) {
  const { data, error } = await supabaseClient
    .schema(schema)
    .from("enslavement_details")
    .update({ status: "pending_review" })
    .eq("entry_id", entryId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function inviteUser(payload) {
  const { data, error } = await supabaseClient
    .schema(schema)
    .from("user_profiles")
    .insert({
      auth_user_id: payload.auth_user_id,
      email: payload.email,
      display_name: payload.display_name || null,
      role: payload.role || "transcriber",
      is_active: true
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { user: data };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
