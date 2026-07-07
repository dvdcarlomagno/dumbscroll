(() => {
  const tracker = DoomscrollPostTracker.create({
    platform: "x",
    postSelector: 'article[data-testid="tweet"]',
    getPostId(el) {
      const link = el.querySelector('a[href*="/status/"]');
      if (!link) {
        return null;
      }

      const match = link.href.match(/status\/(\d+)/);
      return match ? match[1] : link.href;
    },
    isPost(el) {
      return el instanceof HTMLElement && el.matches('article[data-testid="tweet"]');
    },
  });

  function boot() {
    DumbscrollOverlay.init();
    tracker.init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
