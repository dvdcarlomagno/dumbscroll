/* global chrome, importScripts, DumbscrollClassifier, DumbscrollFilterCore */
importScripts("content/shared/filter-core.js", "background/classifier.js");

// Optional, git-ignored: see config.local.example.js.
try {
  importScripts("config.local.js");
} catch {
  self.DUMBSCROLL_LOCAL_CONFIG = null;
}

async function seedLocalKey() {
  const localKey = self.DUMBSCROLL_LOCAL_CONFIG?.openrouterApiKey?.trim();
  if (!localKey) {
    return;
  }

  const key = DumbscrollFilterCore.SETTINGS_KEY;
  const { [key]: stored } = await chrome.storage.local.get(key);
  if (!DumbscrollFilterCore.normalizeSettings(stored).apiKey) {
    await chrome.storage.local.set({ [key]: { ...(stored ?? {}), apiKey: localKey } });
  }
}

seedLocalKey();

const classifier = DumbscrollClassifier.create({
  storage: chrome.storage.local,
  fetchImpl: (...args) => fetch(...args),
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "dumbscroll:classify") {
    classifier
      .classify(message.post)
      .then(sendResponse, (error) => sendResponse({ flagged: false, error: String(error) }));
    return true;
  }

  if (message?.type === "dumbscroll:reveal") {
    classifier.reveal(message.post).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === "dumbscroll:test-key") {
    classifier.testKey().then(sendResponse);
    return true;
  }

  return false;
});

function todayKey() {
  return new Date().toLocaleDateString("en-CA");
}

async function ensureTodayState() {
  const { dumbscroll, doomscroll } = await chrome.storage.local.get([
    "dumbscroll",
    "doomscroll",
  ]);
  const today = todayKey();
  const stored = dumbscroll ?? doomscroll;

  if (!stored || stored.date !== today) {
    const state = {
      date: today,
      counts: { linkedin: 0, x: 0, youtube: 0 },
      seen: { linkedin: [], x: [], youtube: [] },
    };
    await chrome.storage.local.set({ dumbscroll: state });
    return state;
  }

  if (!dumbscroll && doomscroll) {
    await chrome.storage.local.set({ dumbscroll: doomscroll });
  }

  return stored;
}

async function updateBadge() {
  const state = await ensureTodayState();
  const total =
    state.counts.linkedin + state.counts.x + state.counts.youtube;

  await chrome.action.setBadgeText({ text: total > 0 ? String(total) : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#FFD100" });
  await chrome.action.setBadgeTextColor({ color: "#111111" });
}

chrome.runtime.onInstalled.addListener(() => {
  updateBadge();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (
    area === "local" &&
    (changes.dumbscroll || changes.doomscroll || changes.dumbscrollSettings)
  ) {
    updateBadge();
  }
});

chrome.runtime.onStartup.addListener(() => {
  updateBadge();
});

updateBadge();
