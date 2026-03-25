const STORAGE_KEY = "safe-circle-state-v1";

const defaultState = {
  contacts: [],
  history: [],
  plan: {
    meetingPoint: "",
    backupInstructions: "",
  },
};

const state = loadState();

const elements = {
  contactForm: document.getElementById("contactForm"),
  contactList: document.getElementById("contactList"),
  checkInForm: document.getElementById("checkInForm"),
  planForm: document.getElementById("planForm"),
  statusBadge: document.getElementById("statusBadge"),
  latestStatusText: document.getElementById("latestStatusText"),
  latestLocation: document.getElementById("latestLocation"),
  latestTimestamp: document.getElementById("latestTimestamp"),
  planSummary: document.getElementById("planSummary"),
  historyList: document.getElementById("historyList"),
  safeCheckInButton: document.getElementById("safeCheckInButton"),
  needHelpButton: document.getElementById("needHelpButton"),
  copySummaryButton: document.getElementById("copySummaryButton"),
  shareSmsButton: document.getElementById("shareSmsButton"),
  shareEmailButton: document.getElementById("shareEmailButton"),
  installAppButton: document.getElementById("installAppButton"),
  contactItemTemplate: document.getElementById("contactItemTemplate"),
  historyItemTemplate: document.getElementById("historyItemTemplate"),
  meetingPoint: document.getElementById("meetingPoint"),
  backupInstructions: document.getElementById("backupInstructions"),
};

let deferredInstallPrompt = null;

hydrateForms();
render();
bindEvents();
registerServiceWorker();
setupInstallPrompt();

function bindEvents() {
  elements.contactForm.addEventListener("submit", handleAddContact);
  elements.checkInForm.addEventListener("submit", handleCheckInSubmit);
  elements.planForm.addEventListener("submit", handleSavePlan);
  elements.safeCheckInButton.addEventListener("click", () => quickCheckIn("safe"));
  elements.needHelpButton.addEventListener("click", () => quickCheckIn("help"));
  elements.copySummaryButton.addEventListener("click", copySummary);
  elements.shareSmsButton.addEventListener("click", shareBySms);
  elements.shareEmailButton.addEventListener("click", shareByEmail);
  elements.installAppButton.addEventListener("click", installApp);
  elements.contactList.addEventListener("click", handleContactRemoval);
}

function handleAddContact(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.contacts.unshift({
    id: crypto.randomUUID(),
    name: form.get("name").toString().trim(),
    relationship: form.get("relationship").toString().trim(),
    method: form.get("method").toString().trim(),
  });
  persistState();
  event.currentTarget.reset();
  renderContacts();
}

function handleCheckInSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  addHistoryItem({
    type: "check-in",
    level: form.get("level").toString(),
    message: form.get("message").toString().trim() || "Status updated.",
    location: form.get("location").toString().trim() || "Location not shared",
  });
  event.currentTarget.reset();
}

function handleSavePlan(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.plan = {
    meetingPoint: form.get("meetingPoint").toString().trim(),
    backupInstructions: form.get("backupInstructions").toString().trim(),
  };
  persistState();
  renderPlan();
}

function handleContactRemoval(event) {
  const button = event.target.closest(".remove-contact-button");
  if (!button) {
    return;
  }

  const id = button.dataset.contactId;
  state.contacts = state.contacts.filter((contact) => contact.id !== id);
  persistState();
  renderContacts();
}

function quickCheckIn(level) {
  const presets = {
    safe: {
      message: "Quick check-in: I'm safe and reachable.",
      location: "Location not shared",
    },
    help: {
      message: "Emergency alert: I need help. Please check in now.",
      location: "Location not shared",
    },
  };

  addHistoryItem({
    type: "check-in",
    level,
    message: presets[level].message,
    location: presets[level].location,
  });
}

function addHistoryItem(entry) {
  state.history.unshift({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  });
  state.history = state.history.slice(0, 12);
  persistState();
  render();
}

function render() {
  renderContacts();
  renderPlan();
  renderHistory();
  renderStatus();
}

function renderContacts() {
  elements.contactList.innerHTML = "";

  if (state.contacts.length === 0) {
    elements.contactList.append(emptyState("No contacts yet. Add at least one person you trust."));
    return;
  }

  for (const contact of state.contacts) {
    const fragment = elements.contactItemTemplate.content.cloneNode(true);
    fragment.querySelector(".contact-name").textContent = contact.name;
    fragment.querySelector(".contact-meta").textContent = `${contact.relationship} - ${contact.method}`;
    fragment.querySelector(".remove-contact-button").dataset.contactId = contact.id;
    elements.contactList.append(fragment);
  }
}

function renderPlan() {
  const { meetingPoint, backupInstructions } = state.plan;
  elements.meetingPoint.value = meetingPoint;
  elements.backupInstructions.value = backupInstructions;

  if (!meetingPoint && !backupInstructions) {
    elements.planSummary.textContent = "No plan saved yet.";
    return;
  }

  const parts = [];
  if (meetingPoint) {
    parts.push(`Meet at ${meetingPoint}.`);
  }
  if (backupInstructions) {
    parts.push(backupInstructions);
  }
  elements.planSummary.textContent = parts.join(" ");
}

function renderHistory() {
  elements.historyList.innerHTML = "";

  if (state.history.length === 0) {
    elements.historyList.append(emptyState("No activity yet. Your check-ins will appear here."));
    return;
  }

  for (const item of state.history) {
    const fragment = elements.historyItemTemplate.content.cloneNode(true);
    const marker = fragment.querySelector(".history-marker");
    fragment.querySelector(".history-title").textContent = labelForLevel(item.level);
    fragment.querySelector(".history-detail").textContent = `${item.message} ${item.location ? `(${item.location})` : ""}`.trim();
    fragment.querySelector(".history-time").textContent = formatDate(item.timestamp);
    marker.style.background = colorForLevel(item.level);
    elements.historyList.append(fragment);
  }
}

function renderStatus() {
  const latest = state.history[0];

  if (!latest) {
    elements.statusBadge.textContent = "No updates yet";
    elements.statusBadge.style.background = "rgba(17, 75, 95, 0.08)";
    elements.statusBadge.style.color = "#114b5f";
    elements.latestStatusText.textContent = "Add your first check-in so your contacts know what normal looks like.";
    elements.latestLocation.textContent = "Not set";
    elements.latestTimestamp.textContent = "Never";
    return;
  }

  elements.statusBadge.textContent = labelForLevel(latest.level);
  elements.statusBadge.style.background = `${colorForLevel(latest.level)}18`;
  elements.statusBadge.style.color = colorForLevel(latest.level);
  elements.latestStatusText.textContent = latest.message;
  elements.latestLocation.textContent = latest.location || "Not shared";
  elements.latestTimestamp.textContent = formatDate(latest.timestamp);
}

function copySummary() {
  navigator.clipboard.writeText(buildSummary()).then(() => {
    elements.copySummaryButton.textContent = "Copied";
    window.setTimeout(() => {
      elements.copySummaryButton.textContent = "Copy Summary";
    }, 1600);
  }).catch(() => {
    elements.copySummaryButton.textContent = "Copy failed";
    window.setTimeout(() => {
      elements.copySummaryButton.textContent = "Copy Summary";
    }, 1600);
  });
}

function shareBySms() {
  window.location.href = `sms:?&body=${encodeURIComponent(buildSummary())}`;
}

function shareByEmail() {
  const subject = "SafeCircle emergency check-in";
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(buildSummary())}`;
}

async function installApp() {
  if (!deferredInstallPrompt) {
    elements.installAppButton.hidden = false;
    elements.installAppButton.textContent = "Install Unavailable";
    window.setTimeout(() => {
      elements.installAppButton.textContent = "Install App";
    }, 1600);
    return;
  }

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  elements.installAppButton.hidden = true;
}

function buildSummary() {
  const latest = state.history[0];
  return [
    "SafeCircle summary",
    latest ? `Latest status: ${labelForLevel(latest.level)} - ${latest.message}` : "Latest status: none",
    latest ? `Location: ${latest.location || "Not shared"}` : "Location: not shared",
    latest ? `Updated: ${formatDate(latest.timestamp)}` : "Updated: never",
    state.plan.meetingPoint ? `Meeting point: ${state.plan.meetingPoint}` : "Meeting point: not set",
    state.plan.backupInstructions ? `Instructions: ${state.plan.backupInstructions}` : "Instructions: not set",
    state.contacts.length
      ? `Contacts: ${state.contacts.map((contact) => `${contact.name} (${contact.method})`).join(", ")}`
      : "Contacts: none",
  ].join("\n");
}

function emptyState(message) {
  const item = document.createElement("li");
  item.className = "empty-state";
  item.textContent = message;
  return item;
}

function labelForLevel(level) {
  if (level === "help") {
    return "Need help";
  }
  if (level === "watchful") {
    return "Watchful";
  }
  return "Safe";
}

function colorForLevel(level) {
  if (level === "help") {
    return "#9b1c1c";
  }
  if (level === "watchful") {
    return "#9a6700";
  }
  return "#246b4f";
}

function formatDate(isoString) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoString));
}

function hydrateForms() {
  elements.meetingPoint.value = state.plan.meetingPoint;
  elements.backupInstructions.value = state.plan.backupInstructions;
}

function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return structuredClone(defaultState);
    }
    const parsed = JSON.parse(raw);
    return {
      contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
      plan: {
        meetingPoint: parsed.plan?.meetingPoint ?? "",
        backupInstructions: parsed.plan?.backupInstructions ?? "",
      },
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function persistState() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

function setupInstallPrompt() {
  if (window.matchMedia("(display-mode: standalone)").matches) {
    elements.installAppButton.hidden = true;
    return;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    elements.installAppButton.hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    elements.installAppButton.hidden = true;
  });
}
