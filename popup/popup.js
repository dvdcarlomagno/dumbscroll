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
  const fill =
    overlayMode === DumbscrollOverlayMode.FADE
      ? "At this total, the yellow screen becomes fully transparent."
      : "At this total, the yellow bar fills the full screen height.";

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
    return "The yellow screen covers the page. It becomes more transparent as you see more posts.";
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
  document.getElementById("count-total").textContent = `${total} / ${dailyMax}`;

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
    }
  });
}

function initPopup() {
  bindPopupControls();
  loadSettings();
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
