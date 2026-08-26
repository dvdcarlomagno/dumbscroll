# Wind down rules

1. Default wind-down time is `19:00` local.
2. While wind-down is active, overlay fill is full screen and label is `Wind down`, not the post count.
3. Wind-down ends at local midnight with the daily reset.
4. Persist `windDownTime` alongside `dailyMax` and `overlayMode` on every settings write.
5. After wind down starts, the time setting is locked until the next day (same spirit as daily-max lock).
