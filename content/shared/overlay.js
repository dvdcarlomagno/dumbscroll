/* global DumbscrollStorage, DumbscrollWindDown, DumbscrollOverlayMode */
const DumbscrollBrand = {
  yellowDeep: "#EDB100",
  yellowMid: "#FFD100",
  yellowLight: "#FFED66",
  ink: "#111111",
};

const DumbscrollOverlay = (() => {
  let el = null;
  let contentEl = null;
  let valueEl = null;
  let storageListenerAttached = false;
  let windDownTimer = null;
  const MIN_HEIGHT_PX = 1;
  const ICON_SVG = `
    <svg viewBox="5 5 14 14" width="1em" height="1em" aria-hidden="true" focusable="false">
      <path transform="translate(8.3 9.6) rotate(-16.04)" d="M-2.4 0a2.4 2.4 0 0 0 4.8 0Z" fill="currentColor"/>
      <path d="M17.4 7.9 14.6 9.4 17.1 10.9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M7.80 15.60 L8.01 15.69 L8.22 15.77 L8.43 15.85 L8.64 15.92 L8.85 15.99 L9.06 16.04 L9.27 16.09 L9.48 16.12 L9.69 16.14 L9.90 16.15 L10.11 16.14 L10.32 16.12 L10.53 16.09 L10.74 16.04 L10.95 15.99 L11.16 15.92 L11.37 15.85 L11.58 15.77 L11.79 15.69 L12.00 15.60 L12.21 15.51 L12.42 15.43 L12.63 15.35 L12.84 15.28 L13.05 15.21 L13.26 15.16 L13.47 15.11 L13.68 15.08 L13.89 15.06 L14.10 15.05 L14.31 15.06 L14.52 15.08 L14.73 15.11 L14.94 15.16 L15.15 15.21 L15.36 15.28 L15.57 15.35 L15.78 15.43 L15.99 15.51 L16.20 15.60" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;

  function progressFor(count, max) {
    if (max <= 0) {
      return 0;
    }

    return Math.min(Math.max(count / max, 0), 1);
  }

  function normalizeMode(overlayMode) {
    if (typeof DumbscrollOverlayMode !== "undefined") {
      return DumbscrollOverlayMode.normalizeOverlayMode(overlayMode);
    }

    return overlayMode === "fade" || overlayMode === "filter" ? overlayMode : "grow";
  }

  function resolveOverlayView({
    count,
    max,
    windDownTime,
    overlayMode,
    now = new Date(),
  }) {
    const windDown = DumbscrollWindDown.isWindDownActive(now, windDownTime);
    const countProgress = progressFor(count, max);
    const mode = normalizeMode(overlayMode);
    const fade = mode === "fade";
    const hidden = mode === "filter" && !windDown;
    const heightProgress = hidden ? 0 : fade || windDown ? 1 : countProgress;
    const opacity = hidden ? 0 : windDown ? 1 : fade ? countProgress : 1;
    const atMax = windDown || count >= max;
    const label = windDown
      ? DumbscrollWindDown.WIND_DOWN_LABEL
      : String(count);

    return {
      windDown,
      hidden,
      overlayMode: mode,
      heightProgress,
      opacity,
      atMax,
      label,
      count,
      max,
      countProgress,
    };
  }

  function heightForProgress(progress, count, { windDown, fade }) {
    const viewportHeight = window.innerHeight;

    if (fade || windDown) {
      return Math.max(MIN_HEIGHT_PX, viewportHeight);
    }

    if (count <= 0) {
      return MIN_HEIGHT_PX;
    }

    return Math.max(MIN_HEIGHT_PX, progress * viewportHeight);
  }

  function fontSizeFor(progress, viewportHeight) {
    const scaled = 14 + progress * Math.min(viewportHeight * 0.18, 160);
    return Math.max(14, scaled);
  }

  function ensure() {
    if (el && document.documentElement.contains(el)) {
      return el;
    }

    el = document.createElement("div");
    el.id = "dumbscroll-counter-overlay";
    el.setAttribute("aria-live", "polite");
    el.setAttribute("aria-label", "Today's combined dumbscroll count");

    contentEl = document.createElement("div");
    contentEl.className = "dumbscroll-counter-content";

    const icon = document.createElement("span");
    icon.className = "dumbscroll-counter-icon";
    icon.innerHTML = ICON_SVG;

    valueEl = document.createElement("span");
    valueEl.className = "dumbscroll-counter-value";

    contentEl.append(valueEl, icon);
    el.append(contentEl);
    document.documentElement.appendChild(el);
    return el;
  }

  function applyLayout(view) {
    const overlay = ensure();
    const viewportHeight = window.innerHeight;
    const fade = view.overlayMode === "fade";
    const heightPx = heightForProgress(view.heightProgress, view.count, {
      windDown: view.windDown,
      fade,
    });
    const fontProgress = fade || view.windDown ? 1 : view.heightProgress;

    valueEl.textContent = view.label;
    overlay.dataset.max = String(view.max);
    overlay.dataset.progress = String(view.heightProgress);
    overlay.dataset.opacity = String(view.opacity);
    overlay.dataset.overlayMode = view.overlayMode;
    overlay.dataset.windDown = view.windDown ? "true" : "false";
    overlay.style.height = `${heightPx}px`;
    overlay.style.fontSize = `${fontSizeFor(fontProgress, viewportHeight)}px`;
    overlay.style.setProperty("--dumbscroll-fade-opacity", String(view.opacity));
    overlay.classList.toggle("overlay-fade", fade);
    overlay.classList.toggle("overlay-hidden", Boolean(view.hidden));
    overlay.classList.toggle("at-max", view.atMax);
    overlay.classList.toggle(
      "has-content",
      view.windDown || (fade && view.count > 0) || (!fade && heightPx >= 56)
    );
    overlay.classList.toggle("wind-down", view.windDown);
    overlay.setAttribute(
      "aria-label",
      view.windDown
        ? DumbscrollWindDown.WIND_DOWN_LABEL
        : "Today's combined dumbscroll count"
    );
  }

  function clearWindDownTimer() {
    if (windDownTimer !== null) {
      clearTimeout(windDownTimer);
      windDownTimer = null;
    }
  }

  function scheduleWindDownRefresh(windDownTime, now = new Date()) {
    clearWindDownTimer();

    const ms = DumbscrollWindDown.msUntilNextWindDownTransition(now, windDownTime);
    if (ms === null) {
      return;
    }

    // Timers above ~24d are unreliable; clamp to one day + buffer.
    const delay = Math.min(ms + 25, 24 * 60 * 60 * 1000);
    windDownTimer = setTimeout(() => {
      refresh();
    }, delay);
  }

  async function refresh() {
    const now = new Date();
    const [count, max, windDownTime, overlayMode] = await Promise.all([
      DumbscrollStorage.getCombinedTotal(),
      DumbscrollStorage.getDailyMax(),
      DumbscrollStorage.getWindDownTime(),
      DumbscrollStorage.getOverlayMode(),
    ]);

    const view = resolveOverlayView({ count, max, windDownTime, overlayMode, now });
    applyLayout(view);
    scheduleWindDownRefresh(windDownTime, now);
  }

  function attachStorageListener() {
    if (storageListenerAttached) {
      return;
    }

    storageListenerAttached = true;

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") {
        return;
      }

      if (
        changes.dumbscroll ||
        changes.dumbscrollSettings ||
        changes.doomscroll ||
        changes.doomscrollSettings
      ) {
        refresh();
      }
    });

    window.addEventListener("resize", () => {
      refresh();
    });
  }

  function init() {
    attachStorageListener();
    refresh();
  }

  return {
    refresh,
    init,
    resolveOverlayView,
    brand: DumbscrollBrand,
  };
})();

const DoomscrollOverlay = DumbscrollOverlay;

if (typeof module !== "undefined") {
  module.exports = DumbscrollOverlay;
}
