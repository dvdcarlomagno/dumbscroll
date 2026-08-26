# Overlay mode knowledge

## Facts

- Settings key `dumbscrollSettings` shape: `{ dailyMax, windDownTime, overlayMode }`.
- `overlayMode` is `"grow"` (default) or `"fade"`.
- **Grow** keeps the original bar: height scales with `count / dailyMax`; opacity stays `1`.
- **Fade** covers the full viewport. Yellow opacity equals posts seen vs max (`count/max`): 0 posts → opacity `0`, at the limit → opacity `1`. The count/icon sit on a yellow chip so they stay readable at mid-opacity.
- Missing or invalid `overlayMode` falls back to `"grow"`.
- Wind down still forces a full-screen, fully opaque overlay and the `Wind down` label in both modes.
- Overlay style is a display preference and is not locked by usage or wind-down time.
- Popup radios are owned by the click handler and `loadSettings`. `render()` must not reset them from storage, or a stale read snaps Fade back to Growing bar after Save.
- `saveOverlayMode` captures the clicked mode before any `await`. A `pendingOverlayMode` plus a load generation counter ignore in-flight startup reads.

## Patterns

- Pure helpers live in `content/shared/overlay-mode.js` (same IIFE + `module.exports` pattern as `wind-down.js`).
- Overlay decision path is testable via `DumbscrollOverlay.resolveOverlayView`.
- Popup save must merge `overlayMode` with `dailyMax` and `windDownTime`; writing only one field would wipe the others.
