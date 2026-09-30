# AI filter knowledge

- Jev (TypeSafe) direct endpoint: `POST https://api.typesafe.ai/v1/systemone`. It is no longer used (OpenRouter only since 2.3.0), but the request format is the same with `{ model, state, questions }`. Questions are typed (`noul`, `choice`, `score`) and all run in parallel in one call, so asking 6 categories costs about the same latency as 1.
- `noul` answers return `answers[id].noul` (0-1 probability of yes) with no separate confidence. Only input tokens are billed.
- Without a key, the endpoint returns HTTP 403 `authentication_error` (checked 2026-09-30), not 401. The classifier treats 401 and 403 as "API key rejected".
- OpenRouter also serves Jev, through its Decisions API: `POST https://openrouter.ai/api/alpha/decisions`, model `typesafe/jev-1.13` or the alias `~typesafe/jev-latest`. The body (`model`, `state`, `questions`) and `answers[id].noul` are identical to TypeSafe's, and the response adds `usage.cost`, `id` and `provider`. Any OpenRouter key works with no waitlist, and the guide's example costs about $0.00005 per call. Without a key it returns 401 (checked 2026-09-30). Source: https://openrouter.ai/blog/tutorials/how-to-use-jev
- `noul` questions accept optional `criteria: { true, false }` descriptions. OpenRouter's guide recommends describing both sides so near-misses fall on the correct side.
- The request shape comes from third-party docs (learnjev.com, jevtypesafeai.com, the docs.rs crate); TypeSafe's own `/docs` page returned 404.
- The service worker calls Jev (it needs the `https://openrouter.ai/*` host permission); content scripts never see the key.
- Raw probabilities are cached per `platform:postId` for the day, and the decision is recomputed from the current settings, so changing categories or the threshold needs no new API calls.
- Ad labels are detected locally, with no API call: LinkedIn text `Promoted` / `Promoted by …` / `Sponsored`, and X `Ad`. X's `placementTracking` test id was rejected as an ad signal because it also wraps non-ad media.
- Blurring the post's children (`> :not(.dumbscroll-pill)`) rather than the post itself keeps the pill sharp.
- X recycles `article` nodes for different tweets and React rewrites their `className`. 2.2.0 blurred via a class and the blur vanished right after it applied, while the pill (a child node React does not own) stayed. 2.3.0 re-evaluates a post when its id changes and strips the stale pill.
- The user saw too many Humblebrag flags on LinkedIn with 2.2.0 (no criteria, 0.7 threshold). 2.3.0 adds criteria saying plain career news is not a humblebrag, plus a 0.9 floor.
