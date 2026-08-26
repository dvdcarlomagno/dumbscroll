const DumbscrollOverlayMode = (() => {
  const GROW = "grow";
  const FADE = "fade";
  const DEFAULT_OVERLAY_MODE = GROW;
  const MODES = [GROW, FADE];

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

  return {
    GROW,
    FADE,
    DEFAULT_OVERLAY_MODE,
    normalizeOverlayMode,
    isFade,
  };
})();

const DoomscrollOverlayMode = DumbscrollOverlayMode;

if (typeof module !== "undefined") {
  module.exports = DumbscrollOverlayMode;
}
