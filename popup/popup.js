const DEFAULT_DAILY_MAX = 100;
const DEFAULT_WIND_DOWN_TIME = DumbscrollWindDown.DEFAULT_WIND_DOWN_TIME;
const DEFAULT_OVERLAY_MODE = DumbscrollOverlayMode.DEFAULT_OVERLAY_MODE;
const STATE_KEY = "dumbscroll";
const LEGACY_STATE_KEY = "doomscroll";
const SETTINGS_KEY = "dumbscrollSettings";
const LEGACY_SETTINGS_KEY = "doomscrollSettings";
let saveTimer = null;
let windDownSaveTimer = null;
let overlayModeSaveTimer = null;
let pendingOverlayMode = null;
let settingsLoadGen = 0;

function todayKey() {
  return new Date().toLocaleDateString("en-CA");
}

function formatDateLabel(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function normalizeMax(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_DAILY_MAX;
  }

  return Math.min(Math.round(parsed), 9999);
}

function normalizeWindDownTime(value) {
  return DumbscrollWindDown.normalizeWindDownTime(value ?? DEFAULT_WIND_DOWN_TIME);
}

function normalizeOverlayMode(value) {
  return DumbscrollOverlayMode.normalizeOverlayMode(value ?? DEFAULT_OVERLAY_MODE);
}

async function readStoredSettings() {
  const stored = await chrome.storage.local.get([SETTINGS_KEY, LEGACY_SETTINGS_KEY]);
  return stored[SETTINGS_KEY] ?? stored[LEGACY_SETTINGS_KEY];
}

async function readTodayUsage() {
  const today = todayKey();
  const stored = await chrome.storage.local.get([STATE_KEY, LEGACY_STATE_KEY]);
  const doomscroll = stored[STATE_KEY] ?? stored[LEGACY_STATE_KEY];

  if (!doomscroll || doomscroll.date !== today) {
    return 0;
  }

  const counts = doomscroll.counts;
  return counts.linkedin + counts.x + counts.youtube;
}

function updateLimitControl(total, dailyMax) {
  const input = document.getElementById("daily-max");
  const help = document.getElementById("settings-help");
  const locked = !DumbscrollLimitLock.canChangeDailyLimit(total, dailyMax);
  const reason = DumbscrollLimitLock.lockReason(total, dailyMax);

  input.disabled = locked;
  input.classList.toggle("is-locked", locked);

  if (locked && reason) {
    help.textContent = reason;
  } else {
    help.textContent = dailyMaxHelpText(readSelectedOverlayMode());
  }
}

function dailyMaxHelpText(overlayMode) {
  const fills = {
    [DumbscrollOverlayMode.FADE]: "At this total, the yellow screen is fully opaque.",
    [DumbscrollOverlayMode.FILTER]:
      "In AI filter mode the yellow overlay stays off, but today's total still counts toward this max.",
  };
  const fill = fills[overlayMode] ?? "At this total, the yellow bar fills the full screen height.";

  return `${fill} You can change the limit only while below 50% of today's usage.`;
}

function updateWindDownControl(windDownTime, now = new Date()) {
  const input = document.getElementById("wind-down");
  const help = document.getElementById("wind-down-help");
  const locked = !DumbscrollWindDown.canChangeWindDownTime(now, windDownTime);
  const reason = DumbscrollWindDown.windDownLockReason(now, windDownTime);

  input.disabled = locked;
  input.classList.toggle("is-locked", locked);

  if (locked && reason) {
    help.textContent = reason;
  } else {
    help.textContent =
      "After this time, the yellow overlay covers the screen until midnight — no matter how many posts you've seen. You can change the time only before wind down starts.";
  }
}

function overlayModeHelpText(overlayMode) {
  if (overlayMode === DumbscrollOverlayMode.FADE) {
    return "The yellow screen covers the page. Opacity matches posts seen vs your daily max.";
  }

  if (overlayMode === DumbscrollOverlayMode.FILTER) {
    return "No overlay. Jev blurs AI slop, promoted posts, and bait on LinkedIn and X as you scroll.";
  }

  return "The yellow bar starts as a thin line and grows with posts you've seen.";
}

function readSelectedOverlayMode() {
  const selected = document.querySelector('input[name="overlay-mode"]:checked');
  return normalizeOverlayMode(selected?.value);
}

function setSelectedOverlayMode(overlayMode) {
  const mode = normalizeOverlayMode(overlayMode);
  document.querySelectorAll('input[name="overlay-mode"]').forEach((input) => {
    input.checked = input.value === mode;
  });
}

function updateOverlayModeControl(overlayMode) {
  const mode = normalizeOverlayMode(overlayMode);
  setSelectedOverlayMode(mode);
  document.getElementById("overlay-mode-help").textContent = overlayModeHelpText(mode);

  const filterPanel = document.getElementById("filter-panel");
  if (filterPanel) {
    filterPanel.hidden = mode !== DumbscrollOverlayMode.FILTER;
  }
}

function overlayModeFromStorage(storedMode) {
  return pendingOverlayMode ?? normalizeOverlayMode(storedMode);
}

async function buildSettingsPayload({ dailyMax, windDownTime, overlayMode }) {
  const settings = await readStoredSettings();
  return {
    dailyMax: normalizeMax(dailyMax ?? settings?.dailyMax ?? DEFAULT_DAILY_MAX),
    windDownTime: normalizeWindDownTime(
      windDownTime ?? settings?.windDownTime ?? DEFAULT_WIND_DOWN_TIME
    ),
    overlayMode: normalizeOverlayMode(
      overlayMode ?? settings?.overlayMode ?? DEFAULT_OVERLAY_MODE
    ),
  };
}

async function loadSettings() {
  const gen = ++settingsLoadGen;
  const settings = await readStoredSettings();
  if (gen !== settingsLoadGen) {
    return;
  }

  const dailyMax = normalizeMax(settings?.dailyMax ?? DEFAULT_DAILY_MAX);
  const windDownTime = normalizeWindDownTime(settings?.windDownTime);
  const overlayMode = normalizeOverlayMode(settings?.overlayMode);
  const total = await readTodayUsage();
  if (gen !== settingsLoadGen) {
    return;
  }

  document.getElementById("daily-max").value = String(dailyMax);
  document.getElementById("wind-down").value = windDownTime;
  updateOverlayModeControl(overlayModeFromStorage(overlayMode));
  updateLimitControl(total, dailyMax);
  updateWindDownControl(windDownTime);
}

async function saveDailyMax(showStatus = true) {
  const overlayMode = readSelectedOverlayMode();
  const input = document.getElementById("daily-max");
  const settings = await readStoredSettings();
  const currentMax = normalizeMax(settings?.dailyMax ?? DEFAULT_DAILY_MAX);
  const total = await readTodayUsage();

  if (!DumbscrollLimitLock.canChangeDailyLimit(total, currentMax)) {
    input.value = String(currentMax);
    updateLimitControl(total, currentMax);

    if (showStatus) {
      const status = document.getElementById("max-status");
      status.textContent = "Locked";
      setTimeout(() => {
        status.textContent = "";
      }, 1200);
    }

    return;
  }

  const dailyMax = normalizeMax(input.value);
  input.value = String(dailyMax);

  const storedWindDown = normalizeWindDownTime(settings?.windDownTime);
  const windDownTime = DumbscrollWindDown.canChangeWindDownTime(new Date(), storedWindDown)
    ? document.getElementById("wind-down").value
    : storedWindDown;

  const payload = await buildSettingsPayload({
    dailyMax,
    windDownTime,
    overlayMode,
  });
  await chrome.storage.local.set({ [SETTINGS_KEY]: payload });
  updateLimitControl(total, dailyMax);
  updateWindDownControl(normalizeWindDownTime(windDownTime));
  updateOverlayModeControl(payload.overlayMode);

  if (showStatus) {
    const status = document.getElementById("max-status");
    status.textContent = "Saved";
    setTimeout(() => {
      status.textContent = "";
    }, 1200);
  }
}

async function saveWindDown(showStatus = true) {
  const overlayMode = readSelectedOverlayMode();
  const input = document.getElementById("wind-down");
  const settings = await readStoredSettings();
  const currentWindDownTime = normalizeWindDownTime(settings?.windDownTime);

  if (!DumbscrollWindDown.canChangeWindDownTime(new Date(), currentWindDownTime)) {
    input.value = currentWindDownTime;
    updateWindDownControl(currentWindDownTime);

    if (showStatus) {
      const status = document.getElementById("wind-down-status");
      status.textContent = "Locked";
      setTimeout(() => {
        status.textContent = "";
      }, 1200);
    }

    return;
  }

  const windDownTime = normalizeWindDownTime(input.value);
  input.value = windDownTime;

  const payload = await buildSettingsPayload({
    dailyMax: document.getElementById("daily-max").value,
    windDownTime,
    overlayMode,
  });
  await chrome.storage.local.set({ [SETTINGS_KEY]: payload });
  updateWindDownControl(windDownTime);
  updateOverlayModeControl(payload.overlayMode);

  if (showStatus) {
    const status = document.getElementById("wind-down-status");
    status.textContent = "Saved";
    setTimeout(() => {
      status.textContent = "";
    }, 1200);
  }
}

async function render() {
  const today = todayKey();
  const stored = await chrome.storage.local.get([
    STATE_KEY,
    LEGACY_STATE_KEY,
    SETTINGS_KEY,
    LEGACY_SETTINGS_KEY,
    DumbscrollFilterCore.DAY_KEY,
  ]);

  const doomscroll = stored[STATE_KEY] ?? stored[LEGACY_STATE_KEY];
  const settings = stored[SETTINGS_KEY] ?? stored[LEGACY_SETTINGS_KEY];

  const counts =
    doomscroll && doomscroll.date === today
      ? doomscroll.counts
      : { linkedin: 0, x: 0, youtube: 0 };

  const total = counts.linkedin + counts.x + counts.youtube;
  const dailyMax = normalizeMax(settings?.dailyMax ?? DEFAULT_DAILY_MAX);
  const windDownTime = normalizeWindDownTime(settings?.windDownTime);

  document.getElementById("date-label").textContent = `Today · ${formatDateLabel(today)}`;
  document.getElementById("count-linkedin").textContent = counts.linkedin;
  document.getElementById("count-x").textContent = counts.x;
  document.getElementById("count-youtube").textContent = counts.youtube;
  document.getElementById("count-total").textContent = String(total);
  setText("max-label", String(dailyMax));
  setText("limits-summary", `${dailyMax} posts · ${windDownTime}`);

  const meterFill = document.getElementById("meter-fill");
  if (meterFill) {
    meterFill.style.width = `${Math.min(total / dailyMax, 1) * 100}%`;
  }

  renderFilterDay(DumbscrollFilterCore.normalizeDay(stored[DumbscrollFilterCore.DAY_KEY], today));

  const maxInput = document.getElementById("daily-max");
  if (!maxInput.matches(":focus")) {
    maxInput.value = String(dailyMax);
  }

  const windDownInput = document.getElementById("wind-down");
  if (!windDownInput.matches(":focus")) {
    windDownInput.value = windDownTime;
  }

  // Overlay radios are owned by the click handler + loadSettings.
  // A stale render() must not snap them back to the previous stored mode.
  updateLimitControl(total, dailyMax);
  updateWindDownControl(windDownTime);
}

async function saveOverlayMode(
  showStatus = true,
  overlayMode = readSelectedOverlayMode()
) {
  const mode = normalizeOverlayMode(overlayMode);
  pendingOverlayMode = mode;
  updateOverlayModeControl(mode);

  const settings = await readStoredSettings();
  const currentMax = normalizeMax(settings?.dailyMax ?? DEFAULT_DAILY_MAX);
  const currentWindDownTime = normalizeWindDownTime(settings?.windDownTime);
  const total = await readTodayUsage();
  const dailyMax = DumbscrollLimitLock.canChangeDailyLimit(total, currentMax)
    ? document.getElementById("daily-max").value
    : currentMax;
  const windDownTime = DumbscrollWindDown.canChangeWindDownTime(
    new Date(),
    currentWindDownTime
  )
    ? document.getElementById("wind-down").value
    : currentWindDownTime;

  const payload = await buildSettingsPayload({
    dailyMax,
    windDownTime,
    overlayMode: mode,
  });
  try {
    await chrome.storage.local.set({ [SETTINGS_KEY]: payload });
    updateOverlayModeControl(mode);
    updateLimitControl(total, payload.dailyMax);

    if (showStatus) {
      const status = document.getElementById("overlay-mode-status");
      status.textContent = "Saved";
      setTimeout(() => {
        status.textContent = "";
      }, 1200);
    }
  } finally {
    pendingOverlayMode = null;
  }
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = text;
  }
}

let filterSettings = DumbscrollFilterCore.normalizeSettings(null);
let filterSaveTimer = null;
let lastFilterStatus = null;

function thresholdLabel(threshold) {
  return `${Math.round(threshold * 100)}%`;
}

function renderFilterStatus() {
  const el = document.getElementById("jev-status");
  if (!el) {
    return;
  }

  let text = "";
  let tone = "";
  if (!filterSettings.apiKey) {
    const provider = DumbscrollFilterCore.providerFor(filterSettings.provider);
    text = `Add your ${provider.label} API key to start filtering. Promoted/Ad labels work without it.`;
  } else if (lastFilterStatus) {
    text = lastFilterStatus.message;
    tone = lastFilterStatus.ok ? "is-ok" : "is-error";
  }

  el.textContent = text;
  el.classList.toggle("is-ok", tone === "is-ok");
  el.classList.toggle("is-error", tone === "is-error");
}

function renderFilterDay(day) {
  lastFilterStatus = day.status;
  let total = 0;
  DumbscrollFilterCore.CATEGORY_IDS.forEach((id) => {
    const count = day.blocked[id] ?? 0;
    total += count;
    setText(`blocked-${id}`, String(count));
  });
  setText("blocked-total", String(total));
  renderFilterStatus();
}

function renderFilterSettings() {
  const keyInput = document.getElementById("jev-key");
  if (!keyInput) {
    return;
  }

  const provider = DumbscrollFilterCore.providerFor(filterSettings.provider);
  document.querySelectorAll('input[name="jev-provider"]').forEach((input) => {
    input.checked = input.value === provider.id;
  });
  setText("jev-key-label", `${provider.label} API key`);
  setText(
    "jev-privacy",
    `Post text and author name from LinkedIn and X are sent to Jev via ${provider.label} to classify them. Posts labelled Promoted or Ad are blurred locally.`
  );
  keyInput.placeholder = provider.keyPlaceholder;
  if (!keyInput.matches(":focus")) {
    keyInput.value = filterSettings.apiKey;
  }

  DumbscrollFilterCore.CATEGORY_IDS.forEach((id) => {
    const toggle = document.getElementById(`toggle-${id}`);
    if (toggle) {
      toggle.checked = filterSettings.enabled[id];
    }
  });

  const threshold = document.getElementById("jev-threshold");
  if (!threshold.matches(":active")) {
    threshold.value = String(filterSettings.threshold);
  }
  setText("jev-threshold-value", thresholdLabel(filterSettings.threshold));
  renderFilterStatus();
}

async function loadFilterSettings() {
  const { [DumbscrollFilterCore.SETTINGS_KEY]: raw } = await chrome.storage.local.get(
    DumbscrollFilterCore.SETTINGS_KEY
  );
  filterSettings = DumbscrollFilterCore.normalizeSettings(raw);
  renderFilterSettings();
}

async function saveFilterSettings(partial) {
  const { apiKey, ...rest } = partial;
  const provider = rest.provider ?? filterSettings.provider;
  const apiKeys =
    apiKey === undefined ? filterSettings.apiKeys : { ...filterSettings.apiKeys, [provider]: apiKey };

  filterSettings = DumbscrollFilterCore.normalizeSettings({
    ...filterSettings,
    ...rest,
    apiKeys,
    enabled: { ...filterSettings.enabled, ...rest.enabled },
  });
  renderFilterSettings();
  await chrome.storage.local.set({ [DumbscrollFilterCore.SETTINGS_KEY]: filterSettings });
}

function buildCategoryList() {
  const list = document.getElementById("filter-categories");
  if (!list) {
    return;
  }

  DumbscrollFilterCore.CATEGORIES.forEach((category) => {
    const item = document.createElement("li");
    const label = document.createElement("label");
    label.className = "category";

    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.className = "toggle";
    toggle.id = `toggle-${category.id}`;
    toggle.addEventListener("change", () => {
      saveFilterSettings({ enabled: { [category.id]: toggle.checked } });
    });

    const name = document.createElement("span");
    name.className = "category-name";
    name.textContent = category.label;

    const count = document.createElement("span");
    count.className = "category-count";
    count.id = `blocked-${category.id}`;
    count.textContent = "0";

    label.append(toggle, name, count);
    item.append(label);
    list.append(item);
  });
}

function bindFilterControls() {
  const keyInput = document.getElementById("jev-key");
  if (!keyInput) {
    return;
  }

  buildCategoryList();

  keyInput.addEventListener("input", () => {
    clearTimeout(filterSaveTimer);
    filterSaveTimer = setTimeout(() => {
      lastFilterStatus = null;
      saveFilterSettings({ apiKey: keyInput.value });
    }, 400);
  });

  keyInput.addEventListener("change", () => {
    clearTimeout(filterSaveTimer);
    saveFilterSettings({ apiKey: keyInput.value });
  });

  document.querySelectorAll('input[name="jev-provider"]').forEach((input) => {
    input.addEventListener("change", async () => {
      clearTimeout(filterSaveTimer);
      lastFilterStatus = null;
      keyInput.blur();
      await saveFilterSettings({ apiKey: keyInput.value });
      await saveFilterSettings({ provider: input.value });
    });
  });

  const threshold = document.getElementById("jev-threshold");
  threshold.addEventListener("input", () => {
    setText(
      "jev-threshold-value",
      thresholdLabel(DumbscrollFilterCore.clampThreshold(threshold.value))
    );
  });
  threshold.addEventListener("change", () => {
    saveFilterSettings({ threshold: threshold.value });
  });

  const testButton = document.getElementById("jev-test");
  testButton.addEventListener("click", async () => {
    clearTimeout(filterSaveTimer);
    await saveFilterSettings({ apiKey: keyInput.value });
    testButton.disabled = true;
    setText("jev-status", "Testing…");
    try {
      const result = await chrome.runtime.sendMessage({ type: "dumbscroll:test-key" });
      lastFilterStatus = result;
    } catch {
      lastFilterStatus = { ok: false, message: "Could not reach the extension background" };
    } finally {
      testButton.disabled = false;
      renderFilterStatus();
    }
  });
}

function bindPopupControls() {
  const maxInput = document.getElementById("daily-max");
  const windDownInput = document.getElementById("wind-down");
  const overlayModeInputs = document.querySelectorAll('input[name="overlay-mode"]');

  maxInput.addEventListener("input", () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveDailyMax(true);
      render();
    }, 400);
  });

  maxInput.addEventListener("change", () => {
    clearTimeout(saveTimer);
    saveDailyMax(true);
    render();
  });

  windDownInput.addEventListener("input", () => {
    clearTimeout(windDownSaveTimer);
    windDownSaveTimer = setTimeout(() => {
      saveWindDown(true);
      render();
    }, 400);
  });

  windDownInput.addEventListener("change", () => {
    clearTimeout(windDownSaveTimer);
    saveWindDown(true);
    render();
  });

  overlayModeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      const overlayMode = normalizeOverlayMode(input.value);
      pendingOverlayMode = overlayMode;
      updateOverlayModeControl(overlayMode);
      clearTimeout(overlayModeSaveTimer);
      saveOverlayMode(true, overlayMode);
    });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      render();
      if (changes[SETTINGS_KEY] || changes[LEGACY_SETTINGS_KEY]) {
        loadSettings();
      }
      if (changes[DumbscrollFilterCore.SETTINGS_KEY]) {
        loadFilterSettings();
      }
    }
  });
}

function initPopup() {
  bindPopupControls();
  bindFilterControls();
  loadSettings();
  loadFilterSettings();
  render();
}

if (typeof document !== "undefined" && document.getElementById("daily-max")) {
  initPopup();
}

if (typeof module !== "undefined") {
  module.exports = {
    saveOverlayMode,
    loadSettings,
    render,
    initPopup,
    readSelectedOverlayMode,
  };
}
