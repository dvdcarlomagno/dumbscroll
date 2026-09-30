# Releases rules

1. **Tag every shippable version.** When `manifest.json` version changes and is ready for users, create and push an annotated tag `vX.Y.Z` matching that version.
2. **Zip URL convention.** Attach an extension-only zip to the GitHub Release (`gh release create`) and point install docs at `https://github.com/dvdcarlomagno/dumbscroll/releases/download/vX.Y.Z/dumbscroll-vX.Y.Z.zip`, with the tag archive as the source link.
4. **Push to `main` directly** when the user asks; otherwise use a PR.
3. **Folder name after unzip.** Instruct users to load `dumbscroll-X.Y.Z` (no leading `v`).
5. **Build the zip from committed files only.** Use `git archive HEAD manifest.json background.js background content fonts icons popup styles LICENSE`, so the git-ignored `config.local.js` (which holds a real key) never ships. Then check the zip has no `sk-or-v1-` string.
