const DumbscrollLimitLock = (() => {
  const CHANGE_THRESHOLD = 0.5;

  function canChangeDailyLimit(total, dailyMax) {
    const max = Number(dailyMax);
    const used = Number(total);

    if (!Number.isFinite(max) || max < 1) {
      return true;
    }

    if (!Number.isFinite(used) || used < 0) {
      return true;
    }

    return used < max * CHANGE_THRESHOLD;
  }

  function lockReason(total, dailyMax) {
    if (canChangeDailyLimit(total, dailyMax)) {
      return null;
    }

    const used = Number(total);
    const max = Number(dailyMax);

    if (used >= max) {
      return "Daily limit reached. You can change the limit again tomorrow.";
    }

    return "Over 50% of today's limit used. You can change the limit again tomorrow.";
  }

  return {
    canChangeDailyLimit,
    lockReason,
    CHANGE_THRESHOLD,
  };
})();

const DoomscrollLimitLock = DumbscrollLimitLock;

if (typeof module !== "undefined") {
  module.exports = DumbscrollLimitLock;
}
