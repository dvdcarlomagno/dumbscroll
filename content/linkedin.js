(() => {
  const POST_SELECTOR = [
    '[data-view-name="feed-full-update"]',
    "div.feed-shared-update-v2",
    'div[data-id^="urn:li:activity"]',
    'div[data-urn^="urn:li:activity"]',
    'div[data-urn^="urn:li:aggregatedShare"]',
    '[componentkey*="FeedType"]',
  ].join(", ");

  function resolvePostRoot(el) {
    if (!(el instanceof HTMLElement)) {
      return null;
    }

    return (
      el.closest(
        '[data-view-name="feed-full-update"], .feed-shared-update-v2, [data-id^="urn:li:activity"], [data-urn^="urn:li:activity"], [componentkey*="FeedType"]'
      ) || el
    );
  }

  function isPost(el) {
    if (!(el instanceof HTMLElement)) {
      return false;
    }

    if (el.closest("#dumbscroll-counter-overlay")) {
      return false;
    }

    if (el.matches('[data-view-name="feed-full-update"]')) {
      return true;
    }

    if (el.matches(".feed-shared-update-v2")) {
      return true;
    }

    if (el.matches('[data-id^="urn:li:activity"]')) {
      return true;
    }

    if (
      el.matches('[data-urn^="urn:li:activity"]') ||
      el.matches('[data-urn^="urn:li:aggregatedShare"]')
    ) {
      return true;
    }

    const componentKey = el.getAttribute("componentkey");
    return Boolean(componentKey && componentKey.includes("FeedType"));
  }

  function idFromComponentKey(componentKey) {
    if (!componentKey) {
      return null;
    }

    const expandedMatch = componentKey.match(/^expanded(.+?)FeedType/);
    if (expandedMatch) {
      return expandedMatch[1];
    }

    return `componentkey:${componentKey}`;
  }

  function getPostId(el) {
    const root = resolvePostRoot(el);
    if (!root) {
      return null;
    }

    const componentKey = root.getAttribute("componentkey");
    const fromComponentKey = idFromComponentKey(componentKey);
    if (fromComponentKey) {
      return fromComponentKey;
    }

    const dataId = root.getAttribute("data-id");
    if (dataId && dataId.includes("activity")) {
      return dataId;
    }

    const dataUrn = root.getAttribute("data-urn");
    if (dataUrn) {
      const activityMatch = dataUrn.match(/urn:li:activity:(\d+)/);
      if (activityMatch) {
        return `urn:li:activity:${activityMatch[1]}`;
      }

      if (dataUrn.includes("aggregatedShare")) {
        return dataUrn;
      }
    }

    const nested = root.querySelector('[data-urn*="activity"], [data-id*="activity"]');
    if (nested) {
      const nestedUrn = nested.getAttribute("data-urn");
      if (nestedUrn) {
        return nestedUrn;
      }

      const nestedId = nested.getAttribute("data-id");
      if (nestedId) {
        return nestedId;
      }
    }

    const ancestorWithKey = root.closest('[componentkey*="FeedType"]');
    if (ancestorWithKey && ancestorWithKey !== root) {
      const ancestorId = idFromComponentKey(ancestorWithKey.getAttribute("componentkey"));
      if (ancestorId) {
        return ancestorId;
      }
    }

    const link = root.querySelector(
      'a[href*="/feed/update/"], a[href*="urn:li:activity"], a[href*="urn:li:share"]'
    );
    return link ? link.href : null;
  }

  function findPosts(root = document) {
    const posts = [];
    const seenIds = new Set();

    const candidates =
      root instanceof HTMLElement && isPost(root)
        ? [resolvePostRoot(root), ...root.querySelectorAll(POST_SELECTOR)]
        : root.querySelectorAll(POST_SELECTOR);

    candidates.forEach((candidate) => {
      const post = resolvePostRoot(candidate);
      if (!post || !isPost(post)) {
        return;
      }

      const parentPost = post.parentElement?.closest(POST_SELECTOR);
      if (parentPost && parentPost !== post && isPost(parentPost)) {
        return;
      }

      const id = getPostId(post);
      if (!id || seenIds.has(id)) {
        return;
      }

      seenIds.add(id);
      posts.push(post);
    });

    return posts;
  }

  const tracker = DoomscrollPostTracker.create({
    platform: "linkedin",
    postSelector: POST_SELECTOR,
    getPostId,
    isPost,
    findPosts,
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
