# Wind down knowledge

## Facts

- Settings key `dumbscrollSettings` shape: `{ dailyMax, windDownTime }`.
- `windDownTime` is local `HH:MM`, default `"19:00"`.
- When local now is at/after today's wind-down time, the overlay is forced to full height and the label is `"Wind down"` (settings name), independent of seen-post count.
- Clears at local midnight via the same calendar-day boundary as daily counts (`toLocaleDateString("en-CA")`).
- Overlay schedules a timeout to the next wind-down transition (activate at time, or clear at midnight) so the fill appears without a storage event.
- Popup save must merge both settings fields; writing only `dailyMax` would wipe `windDownTime`.
- Once wind down is active for the day, `canChangeWindDownTime` is false and the popup input is disabled until local midnight (mirrors daily-max lock UX).

## Patterns

- Pure helpers live in `content/shared/wind-down.js` (same IIFE + `module.exports` pattern as `limit-lock.js`).
- Overlay decision path is testable via `DumbscrollOverlay.resolveOverlayView`.
