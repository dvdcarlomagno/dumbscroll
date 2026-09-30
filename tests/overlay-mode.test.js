const test = require("node:test");
const assert = require("node:assert/strict");

const {
  GROW,
  FADE,
  FILTER,
  DEFAULT_OVERLAY_MODE,
  normalizeOverlayMode,
  isFade,
  isFilter,
} = require("../content/shared/overlay-mode.js");

test("default overlay mode is grow", () => {
  assert.equal(DEFAULT_OVERLAY_MODE, "grow");
  assert.equal(GROW, "grow");
  assert.equal(FADE, "fade");
});

test("normalizes known modes and falls back for invalid", () => {
  assert.equal(normalizeOverlayMode("grow"), GROW);
  assert.equal(normalizeOverlayMode("fade"), FADE);
  assert.equal(normalizeOverlayMode(" FADE "), FADE);
  assert.equal(normalizeOverlayMode("Grow"), GROW);
  assert.equal(normalizeOverlayMode("height"), DEFAULT_OVERLAY_MODE);
  assert.equal(normalizeOverlayMode(""), DEFAULT_OVERLAY_MODE);
  assert.equal(normalizeOverlayMode(null), DEFAULT_OVERLAY_MODE);
  assert.equal(normalizeOverlayMode(undefined), DEFAULT_OVERLAY_MODE);
});

test("isFade is true only for fade mode", () => {
  assert.equal(isFade("fade"), true);
  assert.equal(isFade("grow"), false);
  assert.equal(isFade("nope"), false);
});

test("filter is a valid mode", () => {
  assert.equal(FILTER, "filter");
  assert.equal(normalizeOverlayMode(" Filter "), FILTER);
  assert.equal(isFilter("filter"), true);
  assert.equal(isFilter("fade"), false);
});
