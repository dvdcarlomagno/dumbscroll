(() => {
  const PLATFORM = "youtube";

  function getVideoIdFromUrl(url = location.href) {
    try {
      const parsed = new URL(url);

      if (parsed.pathname.startsWith("/shorts/")) {
        const id = parsed.pathname.split("/")[2];
        return id && id.length >= 11 ? id.slice(0, 11) : null;
      }

      const watchId = parsed.searchParams.get("v");
      if (watchId) {
        return watchId.slice(0, 11);
      }

      const embedMatch = parsed.pathname.match(/^\/embed\/([\w-]{11})/);
      if (embedMatch) {
        return embedMatch[1];
      }
    } catch {
      return null;
    }

    return null;
  }

  function getVideoIdFromSrc(src) {
    if (!src) {
      return null;
    }

    const match = src.match(/(?:embed\/|v=|\/shorts\/|youtu\.be\/|\/vi\/)([\w-]{11})/);
    return match ? match[1] : null;
  }

  function resolveVideoId(video) {
    const fromUrl = getVideoIdFromUrl();
    if (fromUrl) {
      return fromUrl;
    }

    const fromSrc = getVideoIdFromSrc(video.currentSrc || video.src);
    if (fromSrc) {
      return fromSrc;
    }

    const titleHref = video
      .closest("ytd-rich-item-renderer")
      ?.querySelector("a#video-title")
      ?.href;

    return titleHref ? getVideoIdFromUrl(titleHref) : null;
  }

  function attachVideo(video) {
    if (!(video instanceof HTMLVideoElement) || video.dataset.doomscrollTracked) {
      return;
    }

    video.dataset.doomscrollTracked = "1";

    video.addEventListener(
      "play",
      async () => {
        const id = resolveVideoId(video);
        if (!id) {
          return;
        }

        await DumbscrollStorage.increment(PLATFORM, id);
        await DumbscrollOverlay.refresh();
      },
      { passive: true }
    );
  }

  function scanVideos(root = document) {
    root.querySelectorAll("video").forEach(attachVideo);
  }

  function init() {
    DumbscrollOverlay.init();
    scanVideos();

    const mo = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLVideoElement) {
            attachVideo(node);
          } else if (node instanceof HTMLElement) {
            scanVideos(node);
          }
        });
      });
    });

    mo.observe(document.body, { childList: true, subtree: true });

    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        scanVideos();
      }
    });

    urlObserver.observe(document.querySelector("title") || document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    window.addEventListener("yt-navigate-finish", () => {
      lastUrl = location.href;
      scanVideos();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
