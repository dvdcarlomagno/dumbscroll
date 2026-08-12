const DEFAULT_DAILY_MAX = 100;
const DEFAULT_WIND_DOWN_TIME = DumbscrollWindDown.DEFAULT_WIND_DOWN_TIME;
const STATE_KEY = "dumbscroll";
const LEGACY_STATE_KEY = "doomscroll";
const SETTINGS_KEY = "dumbscrollSettings";
const LEGACY_SETTINGS_KEY = "doomscrollSettings";
let saveTimer = null;
let windDownSaveTimer = null;

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
    help.textContent =
      "At this total, the yellow bar fills the full screen height. You can change the limit only while below 50% of today's usage.";
  }
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
      "After this time, the yellow bar fills the screen until midnight — no matter how many posts you've seen. You can change the time only before wind down starts.";
  }
}

async function buildSettingsPayload({ dailyMax, windDownTime }) {
  const settings = await readStoredSettings();
  return {
    dailyMax: normalizeMax(dailyMax ?? settings?.dailyMax ?? DEFAULT_DAILY_MAX),
    windDownTime: normalizeWindDownTime(
      windDownTime ?? settings?.windDownTime ?? DEFAULT_WIND_DOWN_TIME
    ),
  };
}

async function loadSettings() {
  const settings = await readStoredSettings();
  const dailyMax = normalizeMax(settings?.dailyMax ?? DEFAULT_DAILY_MAX);
  const windDownTime = normalizeWindDownTime(settings?.windDownTime);
  const total = await readTodayUsage();

  document.getElementById("daily-max").value = String(dailyMax);
  document.getElementById("wind-down").value = windDownTime;
  updateLimitControl(total, dailyMax);
  updateWindDownControl(windDownTime);
}

async function saveDailyMax(showStatus = true) {
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
  });
  await chrome.storage.local.set({ [SETTINGS_KEY]: payload });
  updateLimitControl(total, dailyMax);
  updateWindDownControl(normalizeWindDownTime(windDownTime));

  if (showStatus) {
    const status = document.getElementById("max-status");
    status.textContent = "Saved";
    setTimeout(() => {
      status.textContent = "";
    }, 1200);
  }
}

async function saveWindDown(showStatus = true) {
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
  });
  await chrome.storage.local.set({ [SETTINGS_KEY]: payload });
  updateWindDownControl(windDownTime);

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

  updateLimitControl(total, dailyMax);
  updateWindDownControl(windDownTime);
}

const maxInput = document.getElementById("daily-max");
const windDownInput = document.getElementById("wind-down");

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

loadSettings();
render();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    render();
    if (changes[SETTINGS_KEY] || changes[LEGACY_SETTINGS_KEY]) {
      loadSettings();
    }
  }
});
