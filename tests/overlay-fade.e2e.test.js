const test = require("node:test");
const assert = require("node:assert/strict");

global.DumbscrollWindDown = require("../content/shared/wind-down.js");
global.DumbscrollOverlayMode = require("../content/shared/overlay-mode.js");
const { resolveOverlayView } = require("../content/shared/overlay.js");
const { WIND_DOWN_LABEL } = global.DumbscrollWindDown;

function atLocal(year, monthIndex, day, hours, minutes) {
  return new Date(year, monthIndex, day, hours, minutes, 0, 0);
}

test("e2e: fade mode keeps full height and raises opacity as posts increase", () => {
  const none = resolveOverlayView({
    count: 0,
    max: 100,
    windDownTime: "19:00",
    overlayMode: "fade",
    now: atLocal(2026, 7, 11, 12, 0),
  });
  const half = resolveOverlayView({
    count: 50,
    max: 100,
    windDownTime: "19:00",
    overlayMode: "fade",
    now: atLocal(2026, 7, 11, 12, 0),
  });
  const full = resolveOverlayView({
    count: 100,
    max: 100,
    windDownTime: "19:00",
    overlayMode: "fade",
    now: atLocal(2026, 7, 11, 12, 0),
  });

  assert.equal(none.overlayMode, "fade");
  assert.equal(none.heightProgress, 1);
  assert.equal(none.opacity, 0);
  assert.equal(none.label, "0");

  assert.equal(half.heightProgress, 1);
  assert.equal(half.opacity, 0.5);
  assert.equal(half.atMax, false);
  assert.equal(half.label, "50");

  assert.equal(full.heightProgress, 1);
  assert.equal(full.opacity, 1);
  assert.equal(full.atMax, true);
  assert.equal(full.label, "100");
});

test("e2e: grow mode keeps solid opacity and scales height", () => {
  const view = resolveOverlayView({
    count: 25,
    max: 100,
    windDownTime: "19:00",
    overlayMode: "grow",
    now: atLocal(2026, 7, 11, 12, 0),
  });

  assert.equal(view.overlayMode, "grow");
  assert.equal(view.heightProgress, 0.25);
  assert.equal(view.opacity, 1);
  assert.equal(view.label, "25");
});

test("e2e: fade mode still goes fully opaque during wind down", () => {
  const view = resolveOverlayView({
    count: 80,
    max: 100,
    windDownTime: "19:00",
    overlayMode: "fade",
    now: atLocal(2026, 7, 11, 21, 0),
  });

  assert.equal(view.windDown, true);
  assert.equal(view.heightProgress, 1);
  assert.equal(view.opacity, 1);
  assert.equal(view.atMax, true);
  assert.equal(view.label, WIND_DOWN_LABEL);
});

test("e2e: filter mode hides the overlay until wind down", () => {
  const day = resolveOverlayView({
    count: 80,
    max: 100,
    windDownTime: "19:00",
    overlayMode: "filter",
    now: atLocal(2026, 7, 11, 12, 0),
  });
  const evening = resolveOverlayView({
    count: 80,
    max: 100,
    windDownTime: "19:00",
    overlayMode: "filter",
    now: atLocal(2026, 7, 11, 21, 0),
  });

  assert.equal(day.overlayMode, "filter");
  assert.equal(day.hidden, true);
  assert.equal(day.opacity, 0);

  assert.equal(evening.hidden, false);
  assert.equal(evening.heightProgress, 1);
  assert.equal(evening.opacity, 1);
  assert.equal(evening.label, WIND_DOWN_LABEL);
});

test("e2e: unknown overlay mode falls back to grow", () => {
  const view = resolveOverlayView({
    count: 40,
    max: 100,
    windDownTime: "19:00",
    overlayMode: "mystery",
    now: atLocal(2026, 7, 11, 12, 0),
  });

  assert.equal(view.overlayMode, "grow");
  assert.equal(view.heightProgress, 0.4);
  assert.equal(view.opacity, 1);
});
