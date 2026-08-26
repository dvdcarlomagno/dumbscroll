# Overlay mode hypotheses

- Overlay mode is unlikely to need the 50% usage lock applied to daily max.
- Confirmed: calling `render()` in parallel with `saveOverlayMode` resets Fade to Growing bar because `render()` awaited the old stored mode. Fixed in 2.1.1.
- Confirmed: fade opacity must match usage (`count/max`), not remaining budget. Users asked for 0 posts → 0% opacity, more posts → more opaque. Shipped in 2.1.2.
