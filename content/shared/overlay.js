const DumbscrollBrand = {
  yellowDeep: "#EDB100",
  yellowMid: "#FFD100",
  yellowLight: "#FFED66",
  ink: "#111111",
};

const DumbscrollOverlay = (() => {
  let el = null;
  let valueEl = null;
  let storageListenerAttached = false;
  const MAX_COVER_RATIO = 2 / 3;
  const ICON_SVG = `
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M12 3.5a.75.75 0 0 1 .75.75v9.19l2.72-2.72a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 1 1 1.06-1.06l2.72 2.72V4.25A.75.75 0 0 1 12 3.5Zm-8 14.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H4.75a.75.75 0 0 1-.75-.75Z"/>
    </svg>
  `;

  function fontSize(count, max) {
    const progress = Math.min(count / max, 1);
    return 14 + progress * 34;
  }

  function ensure() {
    if (el && document.documentElement.contains(el)) {
      return el;
    }

    el = document.createElement("div");
    el.id = "dumbscroll-counter-overlay";
    el.setAttribute("aria-live", "polite");
    el.setAttribute("aria-label", "Today's combined dumbscroll count");

    const icon = document.createElement("span");
    icon.className = "dumbscroll-counter-icon";
    icon.innerHTML = ICON_SVG;

    valueEl = document.createElement("span");
    valueEl.className = "dumbscroll-counter-value";

    el.append(icon, valueEl);
    document.documentElement.appendChild(el);
    return el;
  }

  function applyLayout(count, max) {
    const overlay = ensure();
    const progress = Math.min(count / max, 1);
    const atMax = count >= max;

    valueEl.textContent = String(count);
    overlay.dataset.max = String(max);
    overlay.classList.toggle("at-max", atMax);
    overlay.classList.toggle("growing", !atMax && progress >= 0.6);

    if (atMax) {
      overlay.style.fontSize = `${Math.min(window.innerHeight * 0.22, 220)}px`;
      overlay.style.width = "100%";
      overlay.style.height = `${MAX_COVER_RATIO * 100}vh`;
      overlay.style.top = "0";
      overlay.style.left = "0";
      overlay.style.transform = "none";
      overlay.style.borderRadius = "0";
      return;
    }

    overlay.style.top = "12px";
    overlay.style.left = "50%";
    overlay.style.transform = "translateX(-50%)";
    overlay.style.borderRadius = progress >= 0.6 ? "18px" : "999px";
    overlay.style.fontSize = `${fontSize(count, max)}px`;

    if (progress >= 0.6) {
      const minHeight = 44;
      const targetHeight = window.innerHeight * MAX_COVER_RATIO;
      const growProgress = (progress - 0.6) / 0.4;
      const height = minHeight + growProgress * (targetHeight - minHeight);
      const width = 132 + growProgress * (window.innerWidth - 132);

      overlay.style.height = `${height}px`;
      overlay.style.width = `${Math.min(width, window.innerWidth)}px`;
    } else {
      overlay.style.height = "";
      overlay.style.width = "";
    }
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

  return { refresh, init, fontSize, brand: DumbscrollBrand };
})();

const DoomscrollOverlay = DumbscrollOverlay;
