(() => {
  const POST_SELECTOR = 'article[data-testid="tweet"]';
  const AD_LABEL = /^(Ad|Promoted)$/;

  function getPostId(el) {
    const link = el.querySelector('a[href*="/status/"]');
    if (!link) {
      return null;
    }

    const match = link.href.match(/status\/(\d+)/);
    return match ? match[1] : link.href;
  }

  function isPost(el) {
    return el instanceof HTMLElement && el.matches(POST_SELECTOR);
  }

  function collectPosts(root = document) {
    const posts = [];
    if (isPost(root)) {
      posts.push(root);
    }

    root.querySelectorAll(POST_SELECTOR).forEach((el) => posts.push(el));
    return posts;
  }

  function extract(el) {
    const text = [...el.querySelectorAll('[data-testid="tweetText"]')]
      .map((node) => node.innerText)
      .join("\n");
    const author = el.querySelector('[data-testid="User-Name"]')?.innerText ?? "";
    const media = DumbscrollPostFilter.describeMedia(el, {
      imageSelector: '[data-testid="tweetPhoto"] img',
      videoSelector: '[data-testid="videoPlayer"]',
    });
    return { text, author, media, isAdLabel: DumbscrollPostFilter.hasExactLabel(el, AD_LABEL) };
  }

  const tracker = DoomscrollPostTracker.create({
    platform: "x",
    postSelector: POST_SELECTOR,
    getPostId,
    isPost,
  });

  const filter = DumbscrollPostFilter.create({
    platform: "x",
    collectPosts,
    getPostId,
    extract,
  });

  function boot() {
    DumbscrollOverlay.init();
    tracker.init();
    filter.init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
