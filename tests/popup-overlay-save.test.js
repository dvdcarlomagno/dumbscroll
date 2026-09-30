const test = require("node:test");
const assert = require("node:assert/strict");

function createClassList() {
  return {
    toggle() {},
  };
}

function createFakeDocument() {
  const radios = [
    { name: "overlay-mode", value: "grow", checked: true, addEventListener() {} },
    { name: "overlay-mode", value: "fade", checked: false, addEventListener() {} },
  ];

  const elements = {
    "daily-max": {
      value: "100",
      disabled: false,
      classList: createClassList(),
      matches() {
        return false;
      },
      addEventListener() {},
    },
    "wind-down": {
      value: "19:00",
      disabled: false,
      classList: createClassList(),
      matches() {
        return false;
      },
      addEventListener() {},
    },
    "overlay-mode-help": { textContent: "" },
    "overlay-mode-status": { textContent: "" },
    "settings-help": { textContent: "" },
    "wind-down-help": { textContent: "" },
    "max-status": { textContent: "" },
    "wind-down-status": { textContent: "" },
    "date-label": { textContent: "" },
    "count-linkedin": { textContent: "" },
    "count-x": { textContent: "" },
    "count-youtube": { textContent: "" },
    "count-total": { textContent: "" },
  };

  return {
    radios,
    elements,
    getElementById(id) {
      return elements[id] ?? null;
    },
    querySelector(selector) {
      if (selector === 'input[name="overlay-mode"]:checked') {
        return radios.find((radio) => radio.checked) ?? null;
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'input[name="overlay-mode"]') {
        return radios;
      }
      return [];
    },
  };
}

function selectedMode(document) {
  return document.radios.find((radio) => radio.checked)?.value ?? null;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

test("clicking fade stays on fade even if a stale render/load races the save", async () => {
  const today = new Date().toLocaleDateString("en-CA");
  let settings = { dailyMax: 100, windDownTime: "19:00", overlayMode: "grow" };
  const state = {
    date: today,
    counts: { linkedin: 0, x: 0, youtube: 0 },
  };
  const listeners = [];
  let getDelayMs = 40;

  global.document = createFakeDocument();
  global.DumbscrollWindDown = require("../content/shared/wind-down.js");
  global.DumbscrollOverlayMode = require("../content/shared/overlay-mode.js");
  global.DumbscrollLimitLock = require("../content/shared/limit-lock.js");
  global.DumbscrollFilterCore = require("../content/shared/filter-core.js");
  global.chrome = {
    storage: {
      local: {
        async get() {
          await delay(getDelayMs);
          return {
            dumbscroll: state,
            dumbscrollSettings: { ...settings },
          };
        },
        async set(values) {
          if (values.dumbscrollSettings) {
            settings = { ...values.dumbscrollSettings };
          }
          listeners.forEach((fn) =>
            fn({ dumbscrollSettings: { newValue: settings } }, "local")
          );
        },
      },
      onChanged: {
        addListener(fn) {
          listeners.push(fn);
        },
      },
    },
  };

  const popup = require("../popup/popup.js");

  document.radios[0].checked = false;
  document.radios[1].checked = true;

  const save = popup.saveOverlayMode(true, "fade");
  const staleRender = popup.render();
  await save;
  await staleRender;
  await delay(60);

  assert.equal(settings.overlayMode, "fade");
  assert.equal(selectedMode(document), "fade");
  assert.equal(document.elements["overlay-mode-status"].textContent, "Saved");
});
