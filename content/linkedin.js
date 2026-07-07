(() => {
  const tracker = DoomscrollPostTracker.create({
    platform: "linkedin",
    postSelector: ".feed-shared-update-v2, [data-urn*='activity']",
    getPostId(el) {
      const urn = el.getAttribute("data-urn");
      if (urn) {
        return urn;
      }

      const link = el.querySelector('a[href*="/feed/update/"], a[href*="urn:li:activity"]');
      return link ? link.href : null;
    },
    isPost(el) {
      if (!(el instanceof HTMLElement)) {
        return false;
      }

      if (el.matches(".feed-shared-update-v2")) {
        return true;
      }

      const urn = el.getAttribute("data-urn");
      return Boolean(urn && urn.includes("activity"));
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
