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
    <svg viewBox="4 4 16 16" width="1em" height="1em" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8" fill="currentColor"/>
      <path fill="var(--dumbscroll-yellow-mid)" d="M7.3 10.6a1.9 1.9 0 0 0 3.8 0Z M12.9 10.6a1.9 1.9 0 0 0 3.8 0Z M13.8 16.1Q13.2 16.9 13.2 17.5a0.6 0.6 0 0 0 1.2 0Q14.4 16.9 13.8 16.1Z"/>
      <path d="M9.4 15.2 13.6 14.9" stroke="var(--dumbscroll-yellow-mid)" stroke-width="1.35" stroke-linecap="round" fill="none"/>
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
