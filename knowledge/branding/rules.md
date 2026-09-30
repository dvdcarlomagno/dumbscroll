# Branding rules

1. Check any icon change at 16 px (upscaled with `sips`) before committing; the toolbar is where it is seen most.
2. Render candidates with `swift scripts/generate_icons.swift icons/preview all` and do not commit `icons/preview/`.
3. When the face changes, update all three copies together: `scripts/generate_icons.swift` (PNG icons), `icons/logo.svg`, and `ICON_SVG` in `content/shared/overlay.js`.
