const DoomscrollPostTracker = (() => {
  const DWELL_MS = 800;
  const RATIO_THRESHOLD = 0.25;

  function create({ platform, getPostId, isPost, postSelector }) {
    const observed = new WeakSet();
    const counted = new WeakSet();
    const dwellTimers = new WeakMap();

    function clearDwell(el) {
      const timer = dwellTimers.get(el);
      if (timer) {
        clearTimeout(timer);
        dwellTimers.delete(el);
      }
    }

    async function countPost(el) {
      if (counted.has(el)) {
        return;
      }

      const id = getPostId(el);
      if (!id) {
        return;
      }

      counted.add(el);
      clearDwell(el);
      observer.unobserve(el);

      await DumbscrollStorage.increment(platform, id);
      await DumbscrollOverlay.refresh();
    }

    function startDwell(el) {
      if (counted.has(el) || dwellTimers.has(el)) {
        return;
      }

      const timer = setTimeout(() => {
        dwellTimers.delete(el);
        countPost(el);
      }, DWELL_MS);

      dwellTimers.set(el, timer);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target;

          if (counted.has(el)) {
            return;
          }

          if (!entry.isIntersecting || entry.intersectionRatio <= 0) {
            clearDwell(el);
            return;
          }

          if (entry.intersectionRatio >= RATIO_THRESHOLD) {
            clearDwell(el);
            countPost(el);
            return;
          }

          startDwell(el);
        });
      },
      { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] }
    );

    function observePost(el) {
      if (!(el instanceof HTMLElement) || !isPost(el) || observed.has(el)) {
        return;
      }

      observed.add(el);
      observer.observe(el);
    }

    function scan(root = document) {
      if (root instanceof HTMLElement && isPost(root)) {
        observePost(root);
      }

      root.querySelectorAll(postSelector).forEach(observePost);
    }

    function init() {
      DumbscrollOverlay.refresh();
      scan();

      const mo = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              scan(node);
            }
          });
        });
      });

      mo.observe(document.body, { childList: true, subtree: true });
    }

    return { init, scan };
  }

  return { create, DWELL_MS, RATIO_THRESHOLD };
})();

const DumbscrollPostTracker = DoomscrollPostTracker;
