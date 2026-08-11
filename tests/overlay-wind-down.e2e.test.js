const test = require("node:test");
const assert = require("node:assert/strict");

global.DumbscrollWindDown = require("../content/shared/wind-down.js");
const { resolveOverlayView } = require("../content/shared/overlay.js");
const { WIND_DOWN_LABEL } = global.DumbscrollWindDown;

function atLocal(year, monthIndex, day, hours, minutes) {
  return new Date(year, monthIndex, day, hours, minutes, 0, 0);
}

test("e2e: before wind-down, low count scales progress and shows the count", () => {
  const view = resolveOverlayView({
    count: 25,
    max: 100,
    windDownTime: "19:00",
    now: atLocal(2026, 7, 11, 12, 0),
  });

  assert.equal(view.windDown, false);
  assert.equal(view.heightProgress, 0.25);
  assert.equal(view.atMax, false);
  assert.equal(view.label, "25");
});

test("e2e: before wind-down, hitting daily max still fills with the count label", () => {
  const view = resolveOverlayView({
    count: 100,
    max: 100,
    windDownTime: "19:00",
    now: atLocal(2026, 7, 11, 12, 0),
  });

  assert.equal(view.windDown, false);
  assert.equal(view.heightProgress, 1);
  assert.equal(view.atMax, true);
  assert.equal(view.label, "100");
});

test("e2e: after wind-down, zero posts still fills and shows Wind down", () => {
  const view = resolveOverlayView({
    count: 0,
    max: 100,
    windDownTime: "19:00",
    now: atLocal(2026, 7, 11, 19, 0),
  });

  assert.equal(view.windDown, true);
  assert.equal(view.heightProgress, 1);
  assert.equal(view.atMax, true);
  assert.equal(view.label, WIND_DOWN_LABEL);
});

test("e2e: after wind-down, mid count is ignored for fill and label", () => {
  const view = resolveOverlayView({
    count: 40,
    max: 100,
    windDownTime: "19:00",
    now: atLocal(2026, 7, 11, 21, 45),
  });

  assert.equal(view.windDown, true);
  assert.equal(view.heightProgress, 1);
  assert.equal(view.atMax, true);
  assert.equal(view.label, "Wind down");
});

test("e2e: next calendar day before wind-down returns to count-based overlay", () => {
  const view = resolveOverlayView({
    count: 10,
    max: 100,
    windDownTime: "19:00",
    now: atLocal(2026, 7, 12, 0, 0),
  });

  assert.equal(view.windDown, false);
  assert.equal(view.heightProgress, 0.1);
  assert.equal(view.atMax, false);
  assert.equal(view.label, "10");
});

test("e2e: custom wind-down time gates the fill independently of posts", () => {
  const before = resolveOverlayView({
    count: 0,
    max: 50,
    windDownTime: "21:30",
    now: atLocal(2026, 7, 11, 21, 29),
  });
  const after = resolveOverlayView({
    count: 0,
    max: 50,
    windDownTime: "21:30",
    now: atLocal(2026, 7, 11, 21, 30),
  });

  assert.equal(before.label, "0");
  assert.equal(before.heightProgress, 0);
  assert.equal(after.label, "Wind down");
  assert.equal(after.heightProgress, 1);
});
