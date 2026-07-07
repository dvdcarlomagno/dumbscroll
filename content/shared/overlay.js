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
  const MIN_HEIGHT_PX = 1;
  const ICON_SVG = `
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M12 5.25C7.17 5.25 3.047 8.882 1.5 12c1.547 3.118 5.67 6.75 10.5 6.75s8.953-3.632 10.5-6.75C20.953 8.882 16.83 5.25 12 5.25Zm0 11.25a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9Zm0-2.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z"/>
    </svg>
  `;

  function progressFor(count, max) {
    if (max <= 0) {
      return 0;
    }

    return Math.min(Math.max(count / max, 0), 1);
  }

  function heightFor(count, max) {
    const progress = progressFor(count, max);
    const viewportHeight = window.innerHeight;

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

  function applyLayout(count, max) {
    const overlay = ensure();
    const progress = progressFor(count, max);
    const viewportHeight = window.innerHeight;
    const heightPx = heightFor(count, max);
    const atMax = count >= max;

    valueEl.textContent = String(count);
    overlay.dataset.max = String(max);
    overlay.dataset.progress = String(progress);
    overlay.style.height = `${heightPx}px`;
    overlay.style.fontSize = `${fontSizeFor(progress, viewportHeight)}px`;
    overlay.classList.toggle("at-max", atMax);
    overlay.classList.toggle("has-content", heightPx >= 56);
  }

  async function refresh() {
    const [count, max] = await Promise.all([
      DumbscrollStorage.getCombinedTotal(),
      DumbscrollStorage.getDailyMax(),
    ]);

    applyLayout(count, max);
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

  return { refresh, init, brand: DumbscrollBrand };
})();

const DoomscrollOverlay = DumbscrollOverlay;
