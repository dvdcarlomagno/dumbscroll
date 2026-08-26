# Overlay mode rules

1. Default overlay mode is `grow` so existing installs keep the growing bar.
2. Fade mode is always full viewport height; opacity is `1 - count/max` unless wind down is active.
3. Wind down always wins: full screen and opacity `1`, regardless of overlay mode.
4. Persist `overlayMode` alongside `dailyMax` and `windDownTime` on every settings write.
5. Do not lock overlay mode changes; it is a visual preference, not a limit.
6. Capture the clicked overlay mode before any storage `await`. Never let `render()` overwrite the radios from a stale settings read.
