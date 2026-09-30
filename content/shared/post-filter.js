/* global chrome, DumbscrollFilterCore, DumbscrollOverlayMode */
const DumbscrollPostFilter = (() => {
  const PRELOAD_MARGIN = "1500px 0px";
  const FILTERED_CLASS = "dumbscroll-filtered";
  const PILL_CLASS = "dumbscroll-pill";
  const MAX_TEXT_NODES = 400;

  function hasExactLabel(root, pattern) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let visited = 0;
    let node = walker.nextNode();

    while (node && visited < MAX_TEXT_NODES) {
      if (pattern.test(node.nodeValue.trim())) {
        return true;
      }

      visited += 1;
      node = walker.nextNode();
    }

    return false;
  }

  function create({ platform, collectPosts, getPostId, extract }) {
    const core = DumbscrollFilterCore;
    const states = new WeakMap();
    const tracked = new Set();
    let active = false;
    let settings = core.normalizeSettings(null);

    function removePill(el) {
      el.querySelectorAll(`:scope > .${PILL_CLASS}`).forEach((pill) => pill.remove());
    }

    function unfilter(el) {
      el.classList.remove(FILTERED_CLASS);
      removePill(el);
    }

    function applyDecision(el, id, decision) {
      if (!active || !decision?.flagged || decision.revealed) {
        unfilter(el);
        return;
      }

      removePill(el);
      el.classList.add(FILTERED_CLASS);

      const pill = document.createElement("div");
      pill.className = PILL_CLASS;

      const label = document.createElement("span");
      label.className = `${PILL_CLASS}-label`;
      label.textContent = core.pillText(decision);

      const button = document.createElement("button");
      button.type = "button";
      button.className = `${PILL_CLASS}-show`;
      button.textContent = "Show";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        states.set(el, { id, decision: { ...decision, revealed: true } });
        unfilter(el);
        send({ type: "dumbscroll:reveal", post: { platform, id } });
      });

      pill.append(label, button);
      el.prepend(pill);
    }

    async function send(message) {
      try {
        return await chrome.runtime.sendMessage(message);
      } catch {
        // Extension was reloaded; this tab's content script is orphaned.
        return null;
      }
    }

    async function evaluate(el) {
      if (!active || !el.isConnected) {
        return;
      }

      const id = getPostId(el);
      if (!id) {
        return;
      }

      const previous = states.get(el);
      if (previous?.id === id && (previous.pending || previous.decision)) {
        return;
      }

      const post = { platform, id, ...extract(el) };

      if (post.isAdLabel && settings.enabled.promoted) {
        applyDecision(el, id, core.adLabelDecision());
      }

      states.set(el, { id, pending: true });
      const decision = await send({ type: "dumbscroll:classify", post });

      if (getPostId(el) !== id) {
        return;
      }

      states.set(el, { id, decision });
      applyDecision(el, id, decision);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            evaluate(entry.target);
          }
        });
      },
      { rootMargin: PRELOAD_MARGIN, threshold: 0 }
    );

    function track(el) {
      if (tracked.has(el)) {
        return;
      }

      tracked.add(el);
      observer.observe(el);
    }

    function scan(root = document) {
      collectPosts(root).forEach(track);
    }

    function pruneDisconnected() {
      tracked.forEach((el) => {
        if (!el.isConnected) {
          observer.unobserve(el);
          tracked.delete(el);
        }
      });
    }

    function reevaluateAll() {
      pruneDisconnected();
      tracked.forEach((el) => {
        states.delete(el);
        if (active) {
          observer.unobserve(el);
          observer.observe(el);
        } else {
          unfilter(el);
        }
      });
    }

    async function loadSettings() {
      const stored = await chrome.storage.local.get([core.SETTINGS_KEY, "dumbscrollSettings"]);
      settings = core.normalizeSettings(stored[core.SETTINGS_KEY]);
      active = DumbscrollOverlayMode.isFilter(stored.dumbscrollSettings?.overlayMode);
    }

    async function init() {
      await loadSettings();
      scan();

      new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement && !node.classList.contains(PILL_CLASS)) {
              scan(node);
            }
          });
        });
      }).observe(document.body, { childList: true, subtree: true });

      setInterval(pruneDisconnected, 30000);

      chrome.storage.onChanged.addListener(async (changes, area) => {
        if (area !== "local" || !(changes[core.SETTINGS_KEY] || changes.dumbscrollSettings)) {
          return;
        }

        const wasActive = active;
        const before = JSON.stringify(settings);
        await loadSettings();
        if (wasActive !== active || before !== JSON.stringify(settings)) {
          reevaluateAll();
        }
      });
    }

    return { init, scan };
  }

  return { create, hasExactLabel, FILTERED_CLASS, PILL_CLASS };
})();
