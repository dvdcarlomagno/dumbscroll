# Overlay mode knowledge

## Facts

- Settings key `dumbscrollSettings` shape: `{ dailyMax, windDownTime, overlayMode }`.
- `overlayMode` is `"grow"` (default) or `"fade"`.
- **Grow** keeps the original bar: height scales with `count / dailyMax`; opacity stays `1`.
- **Fade** covers the full viewport. Yellow opacity is remaining budget (`1 - count/max`): more posts → less opaque. The count/icon stay fully visible on a separate yellow chip so they remain readable when the veil is gone.
- Missing or invalid `overlayMode` falls back to `"grow"`.
- Wind down still forces a full-screen, fully opaque overlay and the `Wind down` label in both modes.
- Overlay style is a display preference and is not locked by usage or wind-down time.

## Patterns

- Pure helpers live in `content/shared/overlay-mode.js` (same IIFE + `module.exports` pattern as `wind-down.js`).
- Overlay decision path is testable via `DumbscrollOverlay.resolveOverlayView`.
- Popup save must merge `overlayMode` with `dailyMax` and `windDownTime`; writing only one field would wipe the others.
