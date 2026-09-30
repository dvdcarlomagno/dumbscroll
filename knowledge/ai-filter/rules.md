# AI filter rules

1. Fail open: if there is no key, a Jev error, a timeout, or text under 12 characters, leave the post visible. Never blur on uncertainty.
2. Only the service worker holds and uses the API key; content scripts send `{ platform, id, text, author, isAdLabel }`.
3. Cache raw probabilities, not decisions, so settings changes apply instantly without new API calls.
4. Count a blocked post once per day (`countedAs`), no matter how often it re-enters the viewport.
5. Wind down still wins in filter mode: the full-screen overlay covers the page after the wind-down time.
6. OpenRouter is the only Jev provider (the user asked to drop TypeSafe direct in 2.3.0). A 2.2.0 `apiKeys.openrouter` key is migrated to `apiKey`.
7. Key the blur on the pill (`:has(> .dumbscroll-pill)`), never on a class set on the post. X's React re-renders reset `className` and drop the blur while the pill stays.
8. Give categories that misfire on ordinary posts a `minThreshold` floor (Humblebrag: 0.9) instead of raising the global threshold.
9. Show what classification costs: per-post cost on the pill and the daily total in the popup. The goal is to make the cost of doomscrolling visible, not to hide it.
10. Never commit API keys: the repo is public. A local key goes in the git-ignored `config.local.js`, which the service worker loads with `importScripts` inside a try/catch. It seeds `chrome.storage.local` only when no key is saved, and is excluded from release zips.
