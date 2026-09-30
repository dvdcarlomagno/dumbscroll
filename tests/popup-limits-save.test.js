const test = require("node:test");
const assert = require("node:assert/strict");

function input(value) {
  const listeners = {};
  return {
    value,
    disabled: false,
    classList: { toggle() {} },
    matches() {
      return false;
    },
    addEventListener(type, fn) {
      listeners[type] = fn;
    },
    type(next) {
      this.value = next;
      listeners.input?.();
    },
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function text() {
  return { textContent: "", classList: { toggle() {} } };
}

test("typing limits never saves until Save, and mode changes keep stored limits", async () => {
  const today = new Date().toLocaleDateString("en-CA");
  let settings = { dailyMax: 100, windDownTime: "23:59", overlayMode: "grow" };
  const radios = [
    { value: "grow", checked: true, addEventListener() {} },
    { value: "fade", checked: false, addEventListener() {} },
    { value: "filter", checked: false, addEventListener() {} },
  ];
  const elements = {
    "daily-max": input("100"),
    "wind-down": input("23:59"),
    "limits-save": { disabled: true, addEventListener() {} },
    "limits-cancel": { hidden: true, addEventListener() {} },
    "limits-status": text(),
    "wind-down-help": text(),
    "settings-help": text(),
    "overlay-mode-help": text(),
    "overlay-mode-status": text(),
    "date-label": text(),
    "count-linkedin": text(),
    "count-x": text(),
    "count-youtube": text(),
    "count-total": text(),
  };

  global.document = {
    getElementById: (id) => elements[id] ?? null,
    querySelector: (selector) =>
      selector === 'input[name="overlay-mode"]:checked' ? radios.find((r) => r.checked) : null,
    querySelectorAll: (selector) => (selector === 'input[name="overlay-mode"]' ? radios : []),
  };
  global.DumbscrollWindDown = require("../content/shared/wind-down.js");
  global.DumbscrollOverlayMode = require("../content/shared/overlay-mode.js");
  global.DumbscrollLimitLock = require("../content/shared/limit-lock.js");
  global.DumbscrollFilterCore = require("../content/shared/filter-core.js");
  global.chrome = {
    storage: {
      local: {
        async get() {
          return {
            dumbscroll: { date: today, counts: { linkedin: 0, x: 0, youtube: 0 } },
            dumbscrollSettings: { ...settings },
          };
        },
        async set(values) {
          if (values.dumbscrollSettings) {
            settings = { ...values.dumbscrollSettings };
          }
        },
      },
      onChanged: { addListener() {} },
    },
  };

  const popup = require("../popup/popup.js");
  await delay(10);

  // Half-typed "2" for "20:00": nothing is written.
  elements["wind-down"].type("02:00");
  elements["daily-max"].type("150");
  assert.equal(elements["limits-save"].disabled, false);
  await popup.saveOverlayMode(false, "fade");
  await popup.render();
  assert.equal(settings.overlayMode, "fade");
  assert.equal(settings.windDownTime, "23:59");
  assert.equal(settings.dailyMax, 100);
  assert.equal(elements["daily-max"].value, "150");

  elements["wind-down"].type("22:30");
  await popup.saveLimits();
  assert.equal(settings.windDownTime, "22:30");
  assert.equal(settings.dailyMax, 150);
  assert.equal(settings.overlayMode, "fade");
  assert.equal(elements["limits-save"].disabled, true);
});
