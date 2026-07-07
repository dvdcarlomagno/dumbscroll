/* global chrome */
const DumbscrollStorage = (() => {
  const PLATFORMS = ["linkedin", "x", "youtube"];
  const DEFAULT_DAILY_MAX = 100;
  const LEGACY_STATE_KEY = "doomscroll";
  const LEGACY_SETTINGS_KEY = "doomscrollSettings";
  const STATE_KEY = "dumbscroll";
  const SETTINGS_KEY = "dumbscrollSettings";

  function todayKey() {
    return new Date().toLocaleDateString("en-CA");
  }

  function freshState(date) {
    return {
      date,
      counts: { linkedin: 0, x: 0, youtube: 0 },
      seen: { linkedin: [], x: [], youtube: [] },
    };
  }

  async function migrateLegacyStorage() {
    const stored = await chrome.storage.local.get([
      LEGACY_STATE_KEY,
      STATE_KEY,
      LEGACY_SETTINGS_KEY,
      SETTINGS_KEY,
    ]);

    const updates = {};

    if (stored[LEGACY_STATE_KEY] && !stored[STATE_KEY]) {
      updates[STATE_KEY] = stored[LEGACY_STATE_KEY];
    }

    if (stored[LEGACY_SETTINGS_KEY] && !stored[SETTINGS_KEY]) {
      updates[SETTINGS_KEY] = stored[LEGACY_SETTINGS_KEY];
    }

    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
    }
  }

  async function getSettings() {
    await migrateLegacyStorage();
    const { [SETTINGS_KEY]: settings } = await chrome.storage.local.get(SETTINGS_KEY);
    const dailyMax = Number(settings?.dailyMax);

    return {
      dailyMax:
        Number.isFinite(dailyMax) && dailyMax >= 1
          ? Math.round(dailyMax)
          : DEFAULT_DAILY_MAX,
    };
  }

  async function getDailyMax() {
    return (await getSettings()).dailyMax;
  }

  async function getState() {
    await migrateLegacyStorage();
    const { [STATE_KEY]: stored } = await chrome.storage.local.get(STATE_KEY);
    const today = todayKey();

    if (!stored || stored.date !== today) {
      const state = freshState(today);
      await chrome.storage.local.set({ [STATE_KEY]: state });
      return state;
    }

    return stored;
  }

  async function getCombinedTotal() {
    const state = await getState();
    return state.counts.linkedin + state.counts.x + state.counts.youtube;
  }

  async function increment(platform, id) {
    if (!PLATFORMS.includes(platform) || !id) {
      return getCombinedTotal();
    }

    const state = await getState();
    const seen = new Set(state.seen[platform]);

    if (seen.has(id)) {
      return getCombinedTotal();
    }

    seen.add(id);
    state.seen[platform] = [...seen];
    state.counts[platform] += 1;

    await chrome.storage.local.set({ [STATE_KEY]: state });
    return getCombinedTotal();
  }

  async function getCount(platform) {
    const state = await getState();
    return state.counts[platform] ?? 0;
  }

  return {
    getState,
    getCount,
    getCombinedTotal,
    getSettings,
    getDailyMax,
    increment,
    todayKey,
    PLATFORMS,
    DEFAULT_DAILY_MAX,
  };
})();

// Backward compatibility for content scripts loaded before cache refresh.
const DoomscrollStorage = DumbscrollStorage;
