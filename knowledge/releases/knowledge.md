# Releases knowledge

## Facts

- Extension version lives in `manifest.json` (`version` field). Current: `2.0.0`.
- GitHub serves source archives for any tag at:
  - `https://github.com/dvdcarlomagno/dumbscroll/archive/refs/tags/<tag>.zip`
  - Unzipped folder name is typically `dumbscroll-<semver>` (without the leading `v`).
- Annotated tags matching `v` + manifest version enable direct zip download without a GitHub Release asset.
- Tag `v1.3.3` points at commit `2c22cba` (main at time of tagging).
- `2.0.0` is a major bump for the Wind down setting (evening full-screen block).

## Patterns

- Prefer annotated tags: `git tag -a vX.Y.Z -m "..."`.
- Keep tag version in sync with `manifest.json`.
- README should link the latest tag zip for load-unpacked install.
