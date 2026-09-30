# AI filter hypotheses

- A 0.7 `noul` threshold balances false positives vs missed slop. Test by revealing flagged posts for a day and counting wrong flags.
- A 1500 px `rootMargin` pre-classification is enough that posts are decided before they scroll into view (Jev takes about 70-500 ms). Watch for posts that visibly flash unblurred and then blur.
- Asking one `noul` per category is more accurate than a single `choice` over categories, because a post can be several things at once (slop and bait).
- "Humblebrag" will have the highest false-positive rate on LinkedIn, since genuine career news reads similarly.
- The LinkedIn text selectors (`.update-components-text`, `feed-commentary`) will drift. The fallback to `innerText` of the whole post keeps classification working, but adds noise (reaction counts, button labels).
