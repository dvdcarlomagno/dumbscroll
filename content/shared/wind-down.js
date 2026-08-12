const DumbscrollWindDown = (() => {
  const DEFAULT_WIND_DOWN_TIME = "19:00";
  const WIND_DOWN_LABEL = "Wind down";
  const TIME_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

  function normalizeWindDownTime(value) {
    if (typeof value !== "string") {
      return DEFAULT_WIND_DOWN_TIME;
    }

    const match = value.trim().match(TIME_PATTERN);
    if (!match) {
      return DEFAULT_WIND_DOWN_TIME;
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  function parseTimeParts(windDownTime) {
    const normalized = normalizeWindDownTime(windDownTime);
    const [hours, minutes] = normalized.split(":").map(Number);
    return { hours, minutes };
  }

  function windDownDateFor(now, windDownTime) {
    const { hours, minutes } = parseTimeParts(windDownTime);
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hours,
      minutes,
      0,
      0
    );
  }

  function nextLocalMidnight(now) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  }

  function isWindDownActive(now, windDownTime) {
    const current = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(current.getTime())) {
      return false;
    }

    return current.getTime() >= windDownDateFor(current, windDownTime).getTime();
  }

  function msUntilNextWindDownTransition(now, windDownTime) {
    const current = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(current.getTime())) {
      return null;
    }

    const target = isWindDownActive(current, windDownTime)
      ? nextLocalMidnight(current)
      : windDownDateFor(current, windDownTime);

    const ms = target.getTime() - current.getTime();
    return ms > 0 ? ms : null;
  }

  function canChangeWindDownTime(now, windDownTime) {
    return !isWindDownActive(now, windDownTime);
  }

  function windDownLockReason(now, windDownTime) {
    if (canChangeWindDownTime(now, windDownTime)) {
      return null;
    }

    return "Wind down has started. You can change the time again tomorrow.";
  }

  return {
    DEFAULT_WIND_DOWN_TIME,
    WIND_DOWN_LABEL,
    normalizeWindDownTime,
    isWindDownActive,
    msUntilNextWindDownTransition,
    canChangeWindDownTime,
    windDownLockReason,
  };
})();

const DoomscrollWindDown = DumbscrollWindDown;

if (typeof module !== "undefined") {
  module.exports = DumbscrollWindDown;
}
