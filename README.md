# Dumbscroll

A Chromium extension that counts how many social posts and videos you consume each day — with a yellow counter that grows until it covers two-thirds of the screen.

Inspired by the visual language of [Look Away](https://github.com/dvdcarlomagno/look-away): bold color field, rounded corners, black icon on top.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Features

- **LinkedIn & X** — counts each post once when ≥25% is visible, or any part stays visible for 800ms
- **YouTube** — counts each distinct video when playback starts
- **Combined daily total** across all three platforms
- **Growing yellow overlay** — master-yellow gradient, black scroll icon + count, scales toward 2/3 screen at your daily max
- **Popup** — per-platform breakdown, total vs max, editable daily limit (default 100)
- **Local-only** — `chrome.storage.local`, resets at local midnight

## Install (load unpacked)

```bash
git clone git@github.com:dvdcarlomagno/dumbscroll.git
cd dumbscroll
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dumbscroll` folder
5. After updates, click **Reload** and refresh open tabs

## Brand

| Token | Value |
|-------|-------|
| Yellow deep | `#EDB100` |
| Yellow mid | `#FFD100` |
| Yellow light | `#FFED66` |
| Ink | `#111111` |

Regenerate extension icons:

```bash
swift scripts/generate_icons.swift icons
```

## Project structure

```
dumbscroll/
├── manifest.json
├── background.js
├── icons/
├── scripts/generate_icons.swift
├── content/
│   ├── shared/
│   │   ├── storage.js
│   │   ├── overlay.js
│   │   └── post-tracker.js
│   ├── linkedin.js
│   ├── x.js
│   └── youtube.js
├── popup/
└── styles/
    └── overlay.css
```

## License

MIT — see [LICENSE](LICENSE).
