# AI filter rules

1. Fail open: if there is no key, a Jev error, a timeout, or text under 12 characters, leave the post visible. Never blur on uncertainty.
2. Only the service worker holds and uses the API key; content scripts send `{ platform, id, text, author, isAdLabel }`.
3. Cache raw probabilities, not decisions, so settings changes apply instantly without new API calls.
4. Count a blocked post once per day (`countedAs`), no matter how often it re-enters the viewport.
5. Wind down still wins in filter mode: the full-screen overlay covers the page after the wind-down time.
6. Default to OpenRouter as the Jev provider (no waitlist). Keep keys per provider so switching never sends one provider's key to another.
