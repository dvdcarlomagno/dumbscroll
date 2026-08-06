# Dumbscroll

A Chromium extension that counts how many social posts and videos you consume each day — with a yellow counter that grows until it covers two-thirds of the screen.

Inspired by the visual language of [Look Away](https://github.com/dvdcarlomagno/look-away): bold color field, rounded corners, black icon on top.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Features

- **LinkedIn & X** — counts each post once when ≥25% is visible, or any part stays visible for 800ms
- **YouTube** — counts each distinct video when playback starts
- **Combined daily total** across all three platforms
- **Growing yellow bar** — starts as a 1px line at the top; height scales linearly with today's total vs your max (100% = full screen); black eye icon + count centered on the bar
- **Popup** — per-platform breakdown, total vs max, editable daily limit (default 100)
- **Local-only** — `chrome.storage.local`, resets at local midnight

## Install (load unpacked)

**Download the latest release zip:**  
[dumbscroll-v1.3.3.zip](https://github.com/dvdcarlomagno/dumbscroll/archive/refs/tags/v1.3.3.zip)

Unzip, then:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the unzipped `dumbscroll-1.3.3` folder
5. After updates, click **Reload** and refresh open tabs

Or clone from source:

```bash
git clone git@github.com:dvdcarlomagno/dumbscroll.git
cd dumbscroll
```

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
