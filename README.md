# Dumbscroll

A Chromium extension that counts how many social posts and videos you consume each day — with a yellow overlay that either grows or fades as you scroll.

Inspired by the visual language of [Look Away](https://github.com/dvdcarlomagno/look-away): bold color field, rounded corners, black icon on top.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Features

- **LinkedIn & X** — counts each post once when ≥25% is visible, or any part stays visible for 800ms
- **YouTube** — counts each distinct video when playback starts
- **Combined daily total** across all three platforms
- **Yellow overlay** — two styles: **Growing bar** (starts as a 1px line; height scales with today's total vs your max) or **Fading screen** (covers the page; opacity matches today's total vs your max, 0% → 100%). Black eye icon + count stay centered.
- **Wind down** — after a set local time (default 7:00 PM), the overlay covers the screen until midnight regardless of post count, and shows **Wind down** instead of the number; the time can only be changed before wind down starts
- **Popup** — per-platform breakdown, total vs max, overlay style, editable daily limit (default 100) and wind-down time
- **Local-only** — `chrome.storage.local`, resets at local midnight

## Install (load unpacked)

**Download the latest release zip:**  
[dumbscroll-v2.1.2.zip](https://github.com/dvdcarlomagno/dumbscroll/archive/refs/tags/v2.1.2.zip)

Unzip, then:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the unzipped `dumbscroll-2.1.2` folder
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
│   │   ├── wind-down.js
│   │   ├── overlay-mode.js
│   │   ├── storage.js
│   │   ├── overlay.js
│   │   ├── limit-lock.js
│   │   └── post-tracker.js
│   ├── linkedin.js
│   ├── x.js
│   └── youtube.js
├── popup/
├── styles/
│   └── overlay.css
└── tests/
```

## Tests

```bash
node --test tests/*.test.js
```

## License

MIT — see [LICENSE](LICENSE).
