const DEFAULT_DAILY_MAX = 100;
const DEFAULT_WIND_DOWN_TIME = DumbscrollWindDown.DEFAULT_WIND_DOWN_TIME;
const DEFAULT_OVERLAY_MODE = DumbscrollOverlayMode.DEFAULT_OVERLAY_MODE;
const STATE_KEY = "dumbscroll";
const LEGACY_STATE_KEY = "doomscroll";
const SETTINGS_KEY = "dumbscrollSettings";
const LEGACY_SETTINGS_KEY = "doomscrollSettings";
let overlayModeSaveTimer = null;
let pendingOverlayMode = null;
let settingsLoadGen = 0;
let limitsDirty = false;
let storedWindDownTime = DEFAULT_WIND_DOWN_TIME;

function todayKey() {
  return new Date().toLocaleDateString("en-CA");
}

function formatDateLabel(now = new Date()) {
  const hour = now.getHours();
  const part =
    hour < 5 ? "night" : hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 21 ? "evening" : "night";
  return `${now.toLocaleDateString(undefined, { weekday: "long" })} ${part}`;
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

  help.textContent = locked && reason ? reason : "";
}

function updateWindDownControl(windDownTime, now = new Date()) {
  storedWindDownTime = windDownTime;
  const input = document.getElementById("wind-down");
  const help = document.getElementById("wind-down-help");
  const locked = !DumbscrollWindDown.canChangeWindDownTime(now, windDownTime);
  const reason = DumbscrollWindDown.windDownLockReason(now, windDownTime);

  input.disabled = locked;
  input.classList.toggle("is-locked", locked);

  const pending = normalizeWindDownTime(input.value || windDownTime);
  const startsNow = !locked && limitsDirty && DumbscrollWindDown.isWindDownActive(now, pending);
  help.classList.toggle("is-warning", startsNow);

  if (locked && reason) {
    help.textContent = reason;
  } else if (startsNow) {
    help.textContent = `${pending} has already passed today, so wind down would start as soon as you save.`;
  } else {
    help.textContent = "";
  }
}

function overlayModeHelpText(overlayMode) {
  if (overlayMode === DumbscrollOverlayMode.FADE) {
    return "A yellow veil darkens the page as you get closer to your limit.";
  }

  if (overlayMode === DumbscrollOverlayMode.FILTER) {
    return "No veil. Jev hides the posts you pick below as you scroll LinkedIn and X.";
  }

  return "A yellow bar grows down from the top of the page as you scroll.";
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
  renderStory();
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

  if (!limitsDirty) {
    document.getElementById("daily-max").value = String(dailyMax);
    document.getElementById("wind-down").value = windDownTime;
  }
  updateOverlayModeControl(overlayModeFromStorage(overlayMode));
  updateLimitControl(total, dailyMax);
  updateWindDownControl(windDownTime);
}

function setLimitsDirty(dirty) {
  limitsDirty = dirty;
  const saveButton = document.getElementById("limits-save");
  if (saveButton) {
    saveButton.disabled = !dirty;
  }
  const cancelButton = document.getElementById("limits-cancel");
  if (cancelButton) {
    cancelButton.hidden = !dirty;
  }
}

function flashStatus(id, text) {
  const status = document.getElementById(id);
  if (!status) {
    return;
  }

  status.textContent = text;
  setTimeout(() => {
    status.textContent = "";
  }, 1600);
}

async function saveLimits() {
  const settings = await readStoredSettings();
  const currentMax = normalizeMax(settings?.dailyMax ?? DEFAULT_DAILY_MAX);
  const currentWindDownTime = normalizeWindDownTime(settings?.windDownTime);
  const total = await readTodayUsage();
  const canChangeMax = DumbscrollLimitLock.canChangeDailyLimit(total, currentMax);
  const canChangeWindDown = DumbscrollWindDown.canChangeWindDownTime(new Date(), currentWindDownTime);

  const maxInput = document.getElementById("daily-max");
  const windDownInput = document.getElementById("wind-down");
  const dailyMax = canChangeMax ? normalizeMax(maxInput.value) : currentMax;
  const windDownTime = canChangeWindDown
    ? normalizeWindDownTime(windDownInput.value)
    : currentWindDownTime;

  const payload = await buildSettingsPayload({
    dailyMax,
    windDownTime,
    overlayMode: pendingOverlayMode ?? settings?.overlayMode,
  });
  await chrome.storage.local.set({ [SETTINGS_KEY]: payload });

  setLimitsDirty(false);
  maxInput.value = String(dailyMax);
  windDownInput.value = windDownTime;
  updateLimitControl(total, dailyMax);
  updateWindDownControl(windDownTime);
  flashStatus("limits-status", canChangeMax && canChangeWindDown ? "Saved" : "Saved · locked fields kept");
}

async function cancelLimits() {
  setLimitsDirty(false);
  await loadSettings();
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

  setText("date-label", formatDateLabel());
  storyState = { ...storyState, counts, total, dailyMax, windDownTime };
  renderFilterDay(DumbscrollFilterCore.normalizeDay(stored[DumbscrollFilterCore.DAY_KEY], today));
  setText("count-linkedin", String(counts.linkedin));
  setText("count-x", String(counts.x));
  setText("count-youtube", String(counts.youtube));
  setText("count-total", String(total));

  if (!limitsDirty) {
    document.getElementById("daily-max").value = String(dailyMax);
    document.getElementById("wind-down").value = windDownTime;
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

  const total = await readTodayUsage();

  const payload = await buildSettingsPayload({ overlayMode: mode });
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
  if (filterSettings.apiKey && lastFilterStatus) {
    text = lastFilterStatus.message;
    tone = lastFilterStatus.ok ? "is-ok" : "is-error";
  }

  el.textContent = text;
  el.classList.toggle("is-ok", tone === "is-ok");
  el.classList.toggle("is-error", tone === "is-error");
}

function renderFilterDay(day) {
  lastFilterStatus = day.status;
  DumbscrollFilterCore.CATEGORY_IDS.forEach((id) => {
    const count = day.blocked[id] ?? 0;
    setText(`blocked-${id}`, count ? String(count) : "");
  });
  storyState = { ...storyState, day };
  renderFilterStatus();
  renderStory();
}

let storyState = {
  counts: { linkedin: 0, x: 0, youtube: 0 },
  total: 0,
  dailyMax: DEFAULT_DAILY_MAX,
  windDownTime: DEFAULT_WIND_DOWN_TIME,
  day: null,
};

const PLATFORMS = ["linkedin", "x", "youtube"];
const MOSTLY = {
  ai_slop: "AI slop",
  promoted: "ads",
  engagement_bait: "engagement bait",
  humblebrag: "humblebrags",
  ragebait: "rage bait",
  meme: "memes",
  scam: "scams",
};

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

function plural(count, word) {
  return `${count} ${count === 1 ? word : `${word}s`}`;
}

function shareOfLimit(ratio) {
  const steps = [
    [0.1, "barely any"],
    [0.2, "about a fifth"],
    [0.3, "about a quarter"],
    [0.42, "about a third"],
    [0.58, "about half"],
    [0.72, "about two thirds"],
    [0.88, "about three quarters"],
  ];
  return steps.find(([max]) => ratio < max)?.[1] ?? "nearly all";
}

function platformMark(platform, count) {
  const logo = document.querySelector(`#platform-logos`)?.content.querySelector(`[data-platform="${platform}"]`);
  const children = [];
  if (logo) {
    children.push(logo.cloneNode(true));
  }
  if (count !== undefined) {
    children.push(el("span", { id: `count-${platform}`, textContent: String(count) }));
  }
  return el("span", { className: "plat" }, children);
}

function listPhrase(nodes) {
  const out = [];
  nodes.forEach((node, index) => {
    if (index > 0) {
      out.push(index === nodes.length - 1 ? " and " : ", ");
    }
    out.push(node);
  });
  return out;
}

function renderLead({ total, dailyMax, windDownActive }) {
  const posts = el("em", {}, [el("span", { id: "count-total", textContent: String(total) }), total === 1 ? " post" : " posts"]);

  if (windDownActive) {
    return ["The feed is closed for tonight. You saw ", posts, " today."];
  }
  if (total === 0) {
    return ["A clean slate: ", posts, " so far today."];
  }
  if (total >= dailyMax) {
    return ["You've seen ", posts, ` today, past your limit of ${dailyMax}.`];
  }
  return ["You've seen ", posts, ` today, ${shareOfLimit(total / dailyMax)} of your limit.`];
}

function renderPlatforms(counts) {
  const seen = PLATFORMS.filter((platform) => counts[platform] > 0).sort(
    (a, b) => counts[b] - counts[a]
  );

  if (seen.length === 0) {
    return ["Counting ", ...listPhrase(PLATFORMS.map((platform) => platformMark(platform))), "."];
  }
  if (seen.length === 1) {
    return ["All of it on ", platformMark(seen[0], counts[seen[0]]), "."];
  }

  const [first, ...rest] = seen;
  return [
    "Mostly ",
    platformMark(first, counts[first]),
    ", then ",
    ...listPhrase(rest.map((platform) => platformMark(platform, counts[platform]))),
    ".",
  ];
}

function renderFilterLine(day) {
  if (!filterSettings.apiKey) {
    return ["Jev needs an OpenRouter key before it can hide anything. Posts marked as ads are still hidden."];
  }

  const blocked = day ? DumbscrollFilterCore.CATEGORY_IDS.map((id) => [id, day.blocked[id] ?? 0]) : [];
  const total = blocked.reduce((sum, [, count]) => sum + count, 0);
  const calls = day?.spend.calls ?? 0;

  if (calls === 0 && total === 0) {
    return ["Jev hasn't checked any posts yet today."];
  }

  const hid = el("b", { id: "blocked-total", textContent: plural(total, "post") });
  const cost = el("b", { id: "spend-usd", textContent: DumbscrollFilterCore.formatCost(day.spend.usd) });
  const checked = `Checking ${plural(calls, "post")} cost you `;

  if (total === 0) {
    return ["Nothing hidden yet. ", checked, cost, "."];
  }

  const [topId] = blocked.reduce((best, entry) => (entry[1] > best[1] ? entry : best));
  const mostly = MOSTLY[topId] ?? DumbscrollFilterCore.labelFor(topId);
  const topPhrase = blocked.filter(([, count]) => count > 0).length > 1 ? `, mostly ${mostly}` : "";
  return ["Jev hid ", hid, `${topPhrase}. `, checked, cost, "."];
}

function minutesOfDay(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatClockTime(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return `${rest}m`;
  }
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function renderNudge(windDownTime, windDownActive, now) {
  const clock = document.getElementById("coach-clock");
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const target = minutesOfDay(windDownTime);

  clock?.classList.toggle("is-closed", windDownActive);
  if (windDownActive) {
    setText("coach-nudge-title", "Wind down is on.");
    setText("coach-nudge-sub", "The feed reopens at midnight.");
    return;
  }

  clock?.style.setProperty("--elapsed", `${target ? Math.min(nowMinutes / target, 1) * 100 : 100}%`);
  setText("coach-nudge-title", `Wind down in ${formatDuration(Math.max(target - nowMinutes, 1))}.`);
  setText("coach-nudge-sub", `At ${formatClockTime(windDownTime)} the feed closes until midnight.`);
}

function renderDots(total, dailyMax) {
  const dots = document.getElementById("coach-dots");
  if (!dots) {
    return;
  }

  const filled = Math.min(total / dailyMax, 1) * 10;
  dots.replaceChildren(
    ...Array.from({ length: 10 }, (_, index) => {
      const dot = el("i");
      if (index < Math.floor(filled)) {
        dot.className = "on";
      } else if (index === Math.floor(filled) && filled % 1 > 0) {
        dot.className = "now";
      }
      return dot;
    })
  );
}

function renderStory(now = new Date()) {
  const lead = document.getElementById("coach-lead");
  if (!lead) {
    return;
  }

  const { counts, total, dailyMax, windDownTime, day } = storyState;
  const windDownActive = DumbscrollWindDown.isWindDownActive(now, windDownTime);

  lead.replaceChildren(...renderLead({ total, dailyMax, windDownActive }));
  renderDots(total, dailyMax);
  document.getElementById("coach-platforms").replaceChildren(...renderPlatforms(counts));

  const filterLine = document.getElementById("coach-filter");
  const filtering = readSelectedOverlayMode() === DumbscrollOverlayMode.FILTER;
  filterLine.hidden = !filtering;
  if (filtering) {
    filterLine.replaceChildren(...renderFilterLine(day));
  }

  renderNudge(windDownTime, windDownActive, now);
}

function renderFilterSettings() {
  const keyInput = document.getElementById("jev-key");
  if (!keyInput) {
    return;
  }

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

  const hasKey = Boolean(filterSettings.apiKey);
  setText("jev-key-summary", hasKey ? "Jev key connected" : "No Jev key yet");
  const details = document.getElementById("jev-key-details");
  if (details && !hasKey) {
    details.open = true;
  }

  renderFilterStatus();
  renderStory();
}

async function loadFilterSettings() {
  const { [DumbscrollFilterCore.SETTINGS_KEY]: raw } = await chrome.storage.local.get(
    DumbscrollFilterCore.SETTINGS_KEY
  );
  filterSettings = DumbscrollFilterCore.normalizeSettings(raw);
  renderFilterSettings();
}

async function saveFilterSettings(partial) {
  filterSettings = DumbscrollFilterCore.normalizeSettings({
    ...filterSettings,
    ...partial,
    enabled: { ...filterSettings.enabled, ...partial.enabled },
  });
  renderFilterSettings();
  await chrome.storage.local.set({ [DumbscrollFilterCore.SETTINGS_KEY]: filterSettings });
}

function buildCategoryList() {
  const list = document.getElementById("filter-categories");
  if (!list) {
    return;
  }

  const tokens = DumbscrollFilterCore.CATEGORIES.map((category) => {
    const toggle = el("input", { type: "checkbox", id: `toggle-${category.id}` });
    toggle.addEventListener("change", () => {
      saveFilterSettings({ enabled: { [category.id]: toggle.checked } });
    });

    const count = el("sup", { id: `blocked-${category.id}`, title: "Hidden today" });
    return el("label", { className: "cat" }, [toggle, el("span", { textContent: MOSTLY[category.id] ?? category.label }), count]);
  });

  list.replaceChildren(...listPhrase(tokens));
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

  [maxInput, windDownInput].forEach((input) => {
    input.addEventListener("input", () => {
      setLimitsDirty(true);
      updateWindDownControl(storedWindDownTime);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && limitsDirty) {
        event.preventDefault();
        saveLimits();
      }
    });
  });

  document.getElementById("limits-save")?.addEventListener("click", () => {
    saveLimits();
  });
  document.getElementById("limits-cancel")?.addEventListener("click", () => {
    cancelLimits();
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
    saveLimits,
    loadSettings,
    render,
    initPopup,
    readSelectedOverlayMode,
  };
}
