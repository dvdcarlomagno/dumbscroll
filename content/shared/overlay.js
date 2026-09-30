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
      <g transform="rotate(-8.02 12 12)">
      <circle cx="12" cy="12" r="8" fill="currentColor"/>
      <ellipse cx="7" cy="13.75" rx="1.4" ry="0.85" fill="#FF6B5C"/>
      <ellipse cx="17" cy="13.75" rx="1.4" ry="0.85" fill="#FF6B5C"/>
      <path transform="translate(9 10.2) rotate(-17.19)" d="M-2.2 0a2.2 2.2 0 0 0 4.4 0Z" fill="var(--dumbscroll-yellow-mid)"/>
      <path d="M16.2 8.9 13.9 10.1 15.9 11.3" fill="none" stroke="var(--dumbscroll-yellow-mid)" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M8.60 15.70 L8.81 15.86 L9.03 16.00 L9.24 16.12 L9.45 16.19 L9.66 16.22 L9.88 16.19 L10.09 16.12 L10.30 16.00 L10.51 15.84 L10.72 15.66 L10.94 15.47 L11.15 15.28 L11.36 15.12 L11.57 14.98 L11.79 14.89 L12.00 14.85 L12.21 14.86 L12.42 14.92 L12.64 15.02 L12.85 15.16 L13.06 15.31 L13.27 15.47 L13.49 15.62 L13.70 15.75 L13.91 15.84 L14.12 15.88 L14.34 15.88 L14.55 15.82 L14.76 15.71 L14.97 15.56 L15.19 15.39 L15.40 15.20" fill="none" stroke="var(--dumbscroll-yellow-mid)" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
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
