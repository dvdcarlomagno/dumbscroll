const DumbscrollOverlayMode = (() => {
  const GROW = "grow";
  const FADE = "fade";
  const FILTER = "filter";
  const DEFAULT_OVERLAY_MODE = GROW;
  const MODES = [GROW, FADE, FILTER];

  function normalizeOverlayMode(value) {
    if (typeof value !== "string") {
      return DEFAULT_OVERLAY_MODE;
    }

    const normalized = value.trim().toLowerCase();
    return MODES.includes(normalized) ? normalized : DEFAULT_OVERLAY_MODE;
  }

  function isFade(mode) {
    return normalizeOverlayMode(mode) === FADE;
  }

  function isFilter(mode) {
    return normalizeOverlayMode(mode) === FILTER;
  }

  return {
    GROW,
    FADE,
    FILTER,
    MODES,
    DEFAULT_OVERLAY_MODE,
    normalizeOverlayMode,
    isFade,
    isFilter,
  };
})();

const DoomscrollOverlayMode = DumbscrollOverlayMode;

if (typeof module !== "undefined") {
  module.exports = DumbscrollOverlayMode;
}
