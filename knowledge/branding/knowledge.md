# Branding knowledge

- 2.2.0 replaced the SF Symbol `eye.fill` logo (the user disliked it) with a zoned-out face drawn in CoreGraphics: a black disc, yellow half-lidded eyes, a flat mouth, and a drool drop. Candidates were spiral "hypnotized" eyes and X eyes; the zoned face read best at 16 px.
- The 16 px icon drops the mouth and drool and scales the face up 1.3x; below that size the features merge.
- 2.3.0 swapped the zoned face for a woozy one after the user asked for something more "woozy". It follows the 🥴 emoji cues: one droopy half-open eye, one squeezed `<` eye pointing at the nose, coral flushed cheeks, a wavy mouth, and the whole face tilted about 8° counterclockwise. At 16 px it keeps only the two eyes.
- A droopy eye whose lid slopes down toward the nose reads as angry, not woozy. The lid must slope down toward the outside.
- Fonts: Gluten (Etcetera Type Co, OFL, variable weight and slant) for the wordmark, counts, overlay and pill; Fredoka (OFL, rounded) for UI text. They are bundled as latin woff2 in `fonts/`. Content scripts load Gluten through `chrome-extension://__MSG_@@extension_id__/fonts/…` and need `web_accessible_resources`.
- `icons/logo.svg` mirrors the Swift geometry in a 24x24 y-down grid. Keep the two in sync when changing the face.
- The popup uses a yellow gradient hero with a big total and an ink progress meter, white cards for everything else, and a segmented control for mode.
