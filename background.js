/* global chrome */

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
