# Releases rules

1. **Tag every shippable version.** When `manifest.json` version changes and is ready for users, create and push an annotated tag `vX.Y.Z` matching that version.
2. **Zip URL convention.** Attach an extension-only zip to the GitHub Release (`gh release create`) and point install docs at `https://github.com/dvdcarlomagno/dumbscroll/releases/download/vX.Y.Z/dumbscroll-vX.Y.Z.zip`, with the tag archive as the source link.
4. **Push to `main` directly** when the user asks; otherwise use a PR.
3. **Folder name after unzip.** Instruct users to load `dumbscroll-X.Y.Z` (no leading `v`).
