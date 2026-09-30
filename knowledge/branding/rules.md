# Branding rules

1. Check any icon change at 16 px (upscaled with `sips`) before committing; the toolbar is where it is seen most.
2. Render candidates with `swift scripts/generate_icons.swift icons/preview all` and do not commit `icons/preview/`.
3. When the face changes, update all three copies together: `scripts/generate_icons.swift` (PNG icons), `icons/logo.svg`, and `ICON_SVG` in `content/shared/overlay.js`.
4. Keep the personality in the logo only. The UI stays professional: Inter, no rotations or wobble animations, flat fills.
5. Show UI changes locally (preview page plus screenshots) and get approval before pushing or releasing.
6. When the user rejects a UI, explore several directions that change the UX (what the popup is for, where settings live, how blocked posts behave), not just the skin. Present them on one local comparison page (`design/directions.html`, git-ignored).
