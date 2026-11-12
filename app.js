// State management backed by localStorage
const STORAGE_KEY = "tracker_guidance_sources_v1";
let sources = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

// DOM Elements
const sourceForm = document.getElementById("sourceForm");
const isOfficialEl = document.getElementById("isOfficial");
const isPublicEl = document.getElementById("isPublic");
const isAlertRelatedEl = document.getElementById("isAlertRelated");
const checklistItems = document.querySelectorAll(".checklist-item");
const comparisonBody = document.getElementById("comparisonBody");
const sourcesBody = document.getElementById("sourcesBody");

// Set default access date to today
document.getElementById("accessDate").valueAsDate = new Date();

// Toggle checklist availability based on inclusion criteria
function updateInclusionUI() {
  const passesFilter =
    isOfficialEl.checked && isPublicEl.checked && isAlertRelatedEl.checked;
  checklistItems.forEach((item) => {
    item.classList.toggle("disabled", !passesFilter);
  });
}

[isOfficialEl, isPublicEl, isAlertRelatedEl].forEach((cb) =>
  cb.addEventListener("change", updateInclusionUI)
);

// Handle Form Submission
sourceForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const included =
    isOfficialEl.checked && isPublicEl.checked && isAlertRelatedEl.checked;

  const newEntry = {
    id: Date.now(),
    provider: document.getElementById("provider").value.trim(),
    pageTitle: document.getElementById("pageTitle").value.trim(),
    url: document.getElementById("sourceUrl").value.trim(),
    accessDate: document.getElementById("accessDate").value,
    included,
    scores: included
      ? {
          C1: parseInt(document.getElementById("c1Score").value, 10),
          C2: parseInt(document.getElementById("c2Score").value, 10),
          C3: parseInt(document.getElementById("c3Score").value, 10),
          C4: parseInt(document.getElementById("c4Score").value, 10),
        }
      : { C1: 0, C2: 0, C3: 0, C4: 0 },
    notes: included
      ? {
          C1: document.getElementById("c1Notes").value.trim(),
          C2: document.getElementById("c2Notes").value.trim(),
          C3: document.getElementById("c3Notes").value.trim(),
          C4: document.getElementById("c4Notes").value.trim(),
        }
      : {},
  };

  sources.push(newEntry);
  saveAndRender();
  sourceForm.reset();
  document.getElementById("accessDate").valueAsDate = new Date();
  isOfficialEl.checked = true;
  isPublicEl.checked = true;
  isAlertRelatedEl.checked = true;
  updateInclusionUI();
});

// Core Algorithm: AnalyzeGuidance(Providers, Checklist)
function analyzeGuidance(allSources) {
  const providerMap = {};

  allSources.forEach((doc) => {
    // Filter(Pages, official, public, alert-related)
    if (!doc.included) return;

    const key = doc.provider.toLowerCase();
    if (!providerMap[key]) {
      providerMap[key] = {
        providerName: doc.provider,
        pageCount: 0,
        best: { C1: 0, C2: 0, C3: 0, C4: 0 },
      };
    }

    const record = providerMap[key];
    record.pageCount += 1;

    // best[item] <- max(best[item], score)
    ["C1", "C2", "C3", "C4"].forEach((item) => {
      record.best[item] = Math.max(record.best[item], doc.scores[item]);
    });
  });

  // Compute coverage = total / 8 and identify gaps (< 2)
  return Object.values(providerMap).map((p) => {
    const total = p.best.C1 + p.best.C2 + p.best.C3 + p.best.C4;
    const coverage = total / 8;
    const gaps = ["C1", "C2", "C3", "C4"].filter((item) => p.best[item] < 2);

    return {
      ...p,
      total,
      coverage,
      gaps,
    };
  });
}

// Render Tables
function saveAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sources));
  renderComparisonTable();
  renderSourcesTable();
}

function renderComparisonTable() {
  const results = analyzeGuidance(sources);

  if (results.length === 0) {
    comparisonBody.innerHTML = `<tr><td colspan="9" class="empty-state">No included sources coded yet. Add a qualifying source above.</td></tr>`;
    return;
  }

  comparisonBody.innerHTML = results
    .map(
      (r) => `
    <tr>
      <td><strong>${escapeHtml(r.providerName)}</strong></td>
      <td>${r.pageCount}</td>
      <td><span class="badge score-${r.best.C1}">${r.best.C1}</span></td>
      <td><span class="badge score-${r.best.C2}">${r.best.C2}</span></td>
      <td><span class="badge score-${r.best.C3}">${r.best.C3}</span></td>
      <td><span class="badge score-${r.best.C4}">${r.best.C4}</span></td>
      <td><strong>${r.total} / 8</strong></td>
      <td><strong>${(r.coverage * 100).toFixed(1)}%</strong> (${r.coverage.toFixed(2)})</td>
      <td>${
        r.gaps.length > 0
          ? r.gaps.map((g) => `<span class="gap-tag">${g}</span>`).join("")
          : '<span class="badge score-2">None</span>'
      }</td>
    </tr>
  `
    )
    .join("");
}

function renderSourcesTable() {
  if (sources.length === 0) {
    sourcesBody.innerHTML = `<tr><td colspan="6" class="empty-state">No documents logged yet.</td></tr>`;
    return;
  }

  sourcesBody.innerHTML = sources
    .map(
      (s) => `
    <tr>
      <td>
        <span class="badge ${s.included ? "status-included" : "status-excluded"}">
          ${s.included ? "Included" : "Excluded"}
        </span>
      </td>
      <td><strong>${escapeHtml(s.provider)}</strong></td>
      <td>
        <div>${escapeHtml(s.pageTitle)}</div>
        <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" style="font-size: 0.78rem; color: #2563eb;">
          ${escapeHtml(s.url)}
        </a>
      </td>
      <td>${s.accessDate}</td>
      <td>${
        s.included
          ? `C1:${s.scores.C1} | C2:${s.scores.C2} | C3:${s.scores.C3} | C4:${s.scores.C4}`
          : "<em>N/A (Excluded)</em>"
      }</td>
      <td>
        <button class="btn btn-danger" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;" onclick="deleteSource(${s.id})">
          Delete
        </button>
      </td>
    </tr>
  `
    )
    .join("");
}

window.deleteSource = function (id) {
  sources = sources.filter((s) => s.id !== id);
  saveAndRender();
};

// Export CSV for Research Paper Tables
document.getElementById("exportCsvBtn").addEventListener("click", () => {
  const results = analyzeGuidance(sources);
  if (results.length === 0) return alert("No analyzed results to export.");

  const headers = [
    "Provider",
    "Included_Pages",
    "C1_Interpret",
    "C2_Locate_Disable",
    "C3_Retain_Info",
    "C4_Seek_Help",
    "Total_Score",
    "Coverage_Ratio",
    "Gaps",
  ];
  const rows = results.map((r) => [
    `"${r.providerName}"`,
    r.pageCount,
    r.best.C1,
    r.best.C2,
    r.best.C3,
    r.best.C4,
    r.total,
    r.coverage.toFixed(2),
    `"${r.gaps.join(", ") || "None"}"`,
  ]);

  const csvContent =
    "data:text/csv;charset=utf-8," +
    [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(csvContent));
  link.setAttribute("download", "tracker_guidance_analysis.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

// Export Full JSON Dataset (including URLs, Access Dates & Notes)
document.getElementById("exportJsonBtn").addEventListener("click", () => {
  if (sources.length === 0) return alert("No data to export.");
  const payload = {
    study: "From Alert to Action: Safety Guidance for Unwanted Bluetooth Tracker Alerts",
    exportedAt: new Date().toISOString(),
    providerSummary: analyzeGuidance(sources),
    loggedDocuments: sources,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "guidance_content_analysis_full.json";
  link.click();
  URL.revokeObjectURL(url);
});

// Reset Data
document.getElementById("clearAllBtn").addEventListener("click", () => {
  if (confirm("Clear all logged guidance sources?")) {
    sources = [];
    saveAndRender();
  }
});

// Load Sample Dataset to Test the Workflow
document.getElementById("loadSampleBtn").addEventListener("click", () => {
  const sampleData = [
    {
      id: 101,
      provider: "Apple",
      pageTitle: "What to do if you get an alert that an AirTag or Find My accessory is with you",
      url: "https://support.apple.com/en-us/119874",
      accessDate: "2026-11-12",
      included: true,
      scores: { C1: 2, C2: 2, C3: 2, C4: 2 },
      notes: {
        C1: "Explains unknown item moving with user.",
        C2: "Play sound, Precision Finding, battery removal steps.",
        C3: "Tap device via NFC to view serial number and last 4 digits of phone.",
        C4: "Advises contacting local law enforcement if safety is at risk.",
      },
    },
    {
      id: 102,
      provider: "Google",
      pageTitle: "Find unknown trackers - Android Help",
      url: "https://support.google.com/android/answer/13658562",
      accessDate: "2026-11-12",
      included: true,
      scores: { C1: 2, C2: 2, C3: 2, C4: 1 },
      notes: {
        C1: "Clear explanation of tracker traveling with user.",
        C2: "Ring tracker, map view, physical disable instructions.",
        C3: "Instructions to view serial number / info screen.",
        C4: "Mentions contacting authorities briefly without dedicated support resources.",
      },
    },
    {
      id: 103,
      provider: "Tile",
      pageTitle: "Scan and Secure Feature Overview",
      url: "https://support.thetileapp.com/hc/en-us/articles/scan-and-secure",
      accessDate: "2026-11-12",
      included: true,
      scores: { C1: 1, C2: 1, C3: 1, C4: 1 },
      notes: {
        C1: "General description of scanning for unknown Tiles.",
        C2: "Shows signal strength, lacks non-removable battery disable steps.",
        C3: "Basic device ID display.",
        C4: "Generic safety mention.",
      },
    },
  ];
  sources = sampleData;
  saveAndRender();
});

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));
}

// Initial Render
saveAndRender();