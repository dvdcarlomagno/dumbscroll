# Releases knowledge

## Facts

- Extension version lives in `manifest.json` (`version` field). Current: `2.4.0`.
- GitHub serves source archives for any tag at:
  - `https://github.com/dvdcarlomagno/dumbscroll/archive/refs/tags/<tag>.zip`
  - Unzipped folder name is typically `dumbscroll-<semver>` (without the leading `v`).
- Annotated tags matching `v` + manifest version enable direct zip download without a GitHub Release asset.
- Tag `v1.3.3` points at commit `2c22cba` (main at time of tagging).
- `2.0.0` is a major bump for the Wind down setting (evening full-screen block).
- `2.0.1` locks the wind-down time after it starts (until next day).
- `2.1.0` adds the overlay style setting (growing bar vs fading full-screen).
- `2.1.1` fixes the popup fade option snapping back to Growing bar after Save.
- `2.1.2` inverts fade opacity so it matches posts seen vs max (`0` → `1`).
- `2.1.3` removes the fade-mode count chip and applies the same opacity to the number.
- `2.2.0` adds the AI filter mode (Jev), the face logo and the popup redesign.
- `2.3.0` fixes the X blur, tones down Humblebrag, goes OpenRouter-only, adds Save limits, and brings in the woozy face and Gluten/Fredoka.
- `2.4.0` brings the Coach popup (serif sentences, fill-in-the-blank settings), a sentence card for blocked posts with the cost of each check, the meme filter, platform logos, and Source Serif 4 in place of Gluten/Fredoka.
- The user asked twice for a downloadable release zip after merging. From 2.3.0, each GitHub Release has an attached extension-only zip (`dumbscroll-vX.Y.Z.zip` containing a `dumbscroll-X.Y.Z/` folder).

## Patterns

- Prefer annotated tags: `git tag -a vX.Y.Z -m "..."`.
- Keep tag version in sync with `manifest.json`.
- README should link the latest tag zip for load-unpacked install.
