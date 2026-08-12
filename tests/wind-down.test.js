const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_WIND_DOWN_TIME,
  WIND_DOWN_LABEL,
  normalizeWindDownTime,
  isWindDownActive,
  msUntilNextWindDownTransition,
  canChangeWindDownTime,
  windDownLockReason,
} = require("../content/shared/wind-down.js");

function atLocal(year, monthIndex, day, hours, minutes, seconds = 0) {
  return new Date(year, monthIndex, day, hours, minutes, seconds, 0);
}

test("default wind-down time is 19:00", () => {
  assert.equal(DEFAULT_WIND_DOWN_TIME, "19:00");
});

test("label is the settings name", () => {
  assert.equal(WIND_DOWN_LABEL, "Wind down");
});

test("normalizes valid times and falls back for invalid", () => {
  assert.equal(normalizeWindDownTime("7:30"), "07:30");
  assert.equal(normalizeWindDownTime("19:00:45"), "19:00");
  assert.equal(normalizeWindDownTime("21:30"), "21:30");
  assert.equal(normalizeWindDownTime("25:00"), DEFAULT_WIND_DOWN_TIME);
  assert.equal(normalizeWindDownTime(""), DEFAULT_WIND_DOWN_TIME);
  assert.equal(normalizeWindDownTime(null), DEFAULT_WIND_DOWN_TIME);
});

test("inactive before default wind-down time", () => {
  assert.equal(isWindDownActive(atLocal(2026, 7, 11, 18, 59), "19:00"), false);
});

test("active at and after default wind-down time", () => {
  assert.equal(isWindDownActive(atLocal(2026, 7, 11, 19, 0), "19:00"), true);
  assert.equal(isWindDownActive(atLocal(2026, 7, 11, 22, 15), "19:00"), true);
});

test("supports a custom wind-down time", () => {
  assert.equal(isWindDownActive(atLocal(2026, 7, 11, 21, 29), "21:30"), false);
  assert.equal(isWindDownActive(atLocal(2026, 7, 11, 21, 30), "21:30"), true);
});

test("stays active until end of current day and clears next midnight", () => {
  assert.equal(isWindDownActive(atLocal(2026, 7, 11, 23, 59), "19:00"), true);
  assert.equal(isWindDownActive(atLocal(2026, 7, 12, 0, 0), "19:00"), false);
});

test("schedules transition at wind-down when still inactive", () => {
  const now = atLocal(2026, 7, 11, 18, 0);
  const ms = msUntilNextWindDownTransition(now, "19:00");
  assert.equal(ms, 60 * 60 * 1000);
});

test("schedules transition at next midnight when already active", () => {
  const now = atLocal(2026, 7, 11, 20, 0);
  const ms = msUntilNextWindDownTransition(now, "19:00");
  assert.equal(ms, 4 * 60 * 60 * 1000);
});

test("allows changing wind-down time before it starts", () => {
  assert.equal(canChangeWindDownTime(atLocal(2026, 7, 11, 18, 59), "19:00"), true);
  assert.equal(windDownLockReason(atLocal(2026, 7, 11, 18, 59), "19:00"), null);
});

test("locks wind-down time after it starts until next day", () => {
  assert.equal(canChangeWindDownTime(atLocal(2026, 7, 11, 19, 0), "19:00"), false);
  assert.equal(canChangeWindDownTime(atLocal(2026, 7, 11, 23, 59), "19:00"), false);
  assert.match(windDownLockReason(atLocal(2026, 7, 11, 19, 0), "19:00"), /tomorrow/i);
});

test("unlocks wind-down time the next day before wind down", () => {
  assert.equal(canChangeWindDownTime(atLocal(2026, 7, 12, 0, 0), "19:00"), true);
  assert.equal(windDownLockReason(atLocal(2026, 7, 12, 0, 0), "19:00"), null);
});
