# AI filter knowledge

- Jev (TypeSafe) has one evaluation endpoint: `POST https://api.typesafe.ai/v1/systemone` with `{ model, state, questions }`. Questions are typed (`noul`, `choice`, `score`) and all run in parallel in one call, so asking 6 categories costs about the same latency as 1.
- `noul` answers return `answers[id].noul` (0-1 probability of yes) with no separate confidence. Only input tokens are billed.
- Without a key, the endpoint returns HTTP 403 `authentication_error` (checked 2026-09-30), not 401. The classifier treats 401 and 403 as "API key rejected".
- The request shape comes from third-party docs (learnjev.com, jevtypesafeai.com, the docs.rs crate); TypeSafe's own `/docs` page returned 404.
- The service worker calls Jev (it needs the `https://api.typesafe.ai/*` host permission); content scripts never see the key.
- Raw probabilities are cached per `platform:postId` for the day, and the decision is recomputed from the current settings, so changing categories or the threshold needs no new API calls.
- Ad labels are detected locally, with no API call: LinkedIn text `Promoted` / `Promoted by …` / `Sponsored`, and X `Ad`. X's `placementTracking` test id was rejected as an ad signal because it also wraps non-ad media.
- Blurring the post's children (`> :not(.dumbscroll-pill)`) rather than the post itself keeps the pill sharp.
