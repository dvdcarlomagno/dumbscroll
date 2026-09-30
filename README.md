# Dumbscroll

A Chromium extension that counts how many social posts and videos you consume each day — with a yellow overlay that grows or fades as you scroll, or an AI filter that blurs slop, ads, and bait on LinkedIn and X.

Inspired by the visual language of [Look Away](https://github.com/dvdcarlomagno/look-away): bold color field, rounded corners, a woozy 🥴 black face on top, set in [Gluten](https://github.com/Etcetera-Type-Co/Gluten) and [Fredoka](https://github.com/hafontia/Fredoka-One).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Features

- **LinkedIn & X** — counts each post once when ≥25% is visible, or any part stays visible for 800ms
- **YouTube** — counts each distinct video when playback starts
- **Combined daily total** across all three platforms
- **Three modes** — **Bar** (a yellow bar that starts as a 1px line; height scales with today's total vs your max), **Fade** (covers the page; opacity matches today's total vs your max, 0% → 100%), or **AI filter** (no overlay; flagged posts are blurred in place). The face icon and count stay centered on the overlay.
- **AI filter (LinkedIn & X)** — each post is classified in real time by TypeSafe's [Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev) model, via [OpenRouter](https://openrouter.ai/blog/tutorials/how-to-use-jev), before it scrolls into view. Posts it flags are blurred behind a yellow pill (e.g. `AI slop · 91%`) with a **Show** button. Categories: AI slop, Promoted, Engagement bait, Humblebrag, Rage bait, Scam — each toggleable (Humblebrag needs at least 90% confidence, since plain career news is not a humblebrag), with an adjustable confidence threshold (default 70%). Posts labelled **Promoted** / **Ad** are blurred locally with no API call.
- **Wind down** — after a set local time (default 7:00 PM), the overlay covers the screen until midnight regardless of post count or mode, and shows **Wind down** instead of the number; the time can only be changed before wind down starts
- **Popup** — today's total with a progress meter, per-platform counts, mode switcher, AI filter panel (blocked-today counts per category, API key, threshold), and a collapsible **Limits** section (daily limit, default 100, and wind-down time). Limits only apply when you press **Save limits**, so typing `2` on the way to `20:00` never starts wind down early; the popup warns you if the time you typed has already passed today
- **Local-first** — counts and settings live in `chrome.storage.local` and reset at local midnight

## AI filter setup

Jev runs through OpenRouter's Decisions API (`openrouter.ai/api/alpha/decisions`, model `~typesafe/jev-latest`). Any [OpenRouter key](https://openrouter.ai/keys) works and is billed to your OpenRouter credits.

1. Open the popup and pick **AI filter**.
2. Paste your OpenRouter key and press **Test**.
3. Scroll LinkedIn or X. Classifications are cached per post for the day, and at most 4 requests run at once. OpenRouter's guide reports about $0.00005 per call.

**Privacy:** in AI filter mode, the text and author name of LinkedIn and X posts near your viewport are sent to Jev via OpenRouter. Your key is stored in `chrome.storage.local` and only the extension's service worker uses it. Bar and Fade modes send nothing anywhere.

## Install (load unpacked)

**Download the latest release zip:**  
[dumbscroll-v2.3.0.zip](https://github.com/dvdcarlomagno/dumbscroll/releases/download/v2.3.0/dumbscroll-v2.3.0.zip) (extension files only; [source zip](https://github.com/dvdcarlomagno/dumbscroll/archive/refs/tags/v2.3.0.zip))

Unzip, then:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the unzipped `dumbscroll-2.3.0` folder
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

The logo is a woozy face, modelled on 🥴: one droopy half-open eye, one squeezed shut, flushed cheeks and a wavy mouth, tilted on the yellow squircle. `icons/logo.svg` is the vector source (also used in the popup and overlay).

Type: **Gluten** (wordmark, counts, overlay and filter pill, leaning on its slant axis) and **Fredoka** (UI text). Both are bundled from `fonts/` under the SIL Open Font License.

Regenerate extension icons:

```bash
swift scripts/generate_icons.swift icons            # woozy face (default)
swift scripts/generate_icons.swift icons/preview all  # preview every face variant
```

## Project structure

```
dumbscroll/
├── manifest.json
├── background.js
├── background/
│   └── classifier.js      # Jev calls, cache, concurrency, blocked counts
├── fonts/                 # Gluten + Fredoka (OFL)
├── icons/
│   └── logo.svg
├── scripts/generate_icons.swift
├── content/
│   ├── shared/
│   │   ├── wind-down.js
│   │   ├── overlay-mode.js
│   │   ├── storage.js
│   │   ├── overlay.js
│   │   ├── limit-lock.js
│   │   ├── post-tracker.js
│   │   ├── filter-core.js  # categories, Jev request, threshold decision
│   │   └── post-filter.js  # blur + reveal pill on flagged posts
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
