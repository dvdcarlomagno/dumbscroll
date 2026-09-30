const test = require("node:test");
const assert = require("node:assert/strict");

const core = require("../content/shared/filter-core.js");
const DumbscrollClassifier = require("../background/classifier.js");

const SLOP = "I got rejected from 47 jobs. Here's what I learned 👇 Consistency beats talent. Let that sink in.";

function createStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    async get(keys) {
      const out = {};
      [].concat(keys).forEach((key) => {
        if (key in data) {
          out[key] = structuredClone(data[key]);
        }
      });
      return out;
    },
    async set(values) {
      Object.assign(data, structuredClone(values));
    },
  };
}

function jevResponse(nouls) {
  const answers = {};
  Object.entries(nouls).forEach(([id, noul]) => {
    answers[id] = { type: "noul", noul };
  });
  return { model: "jev-1.13.0", answers, usage: { input_tokens: 300, output_tokens: 6, cost: 0.00005 } };
}

function createFetch(nouls, { status = 200, delayMs = 0 } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    if (delayMs) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    return {
      ok: status >= 200 && status < 300,
      status,
      async json() {
        return jevResponse(nouls);
      },
    };
  };
  return { fetchImpl, calls };
}

test("request body asks one noul per category with the post as state", () => {
  const body = core.buildJevRequest({ platform: "x", author: "Guru", text: `  ${SLOP}  ` });

  assert.equal(body.model, "~typesafe/jev-latest");
  assert.deepEqual(body.state, { platform: "x", author: "Guru", post: SLOP, media: { images: 0, videos: 0, alt_text: "" } });
  assert.deepEqual(Object.keys(body.questions), core.CATEGORY_IDS);
  Object.values(body.questions).forEach((question) => {
    assert.equal(question.type, "noul");
    assert.ok(question.instructions.length > 20);
    assert.ok(question.criteria.true.length > 20);
    assert.ok(question.criteria.false.length > 20);
  });
});

test("humblebrag needs 90% even when the global threshold is lower", () => {
  assert.equal(core.decide({ humblebrag: 0.85 }, { threshold: 0.7 }).flagged, false);
  assert.equal(core.decide({ humblebrag: 0.92 }, { threshold: 0.7 }).category, "humblebrag");
  assert.equal(core.thresholdFor("humblebrag", 0.95), 0.95);
  assert.equal(core.thresholdFor("ai_slop", 0.7), 0.7);
});

test("decide flags the highest enabled category at or above threshold", () => {
  const probabilities = { ai_slop: 0.91, engagement_bait: 0.95, promoted: 0.2 };

  const decision = core.decide(probabilities, { threshold: 0.7 });
  assert.equal(decision.flagged, true);
  assert.equal(decision.category, "engagement_bait");
  assert.equal(decision.label, "Engagement bait");
  assert.equal(core.pillText(decision), "Engagement bait · 95%");

  const withoutBait = core.decide(probabilities, {
    threshold: 0.7,
    enabled: { engagement_bait: false },
  });
  assert.equal(withoutBait.category, "ai_slop");

  assert.equal(core.decide(probabilities, { threshold: 0.95, enabled: { engagement_bait: false } }).flagged, false);
  assert.equal(core.decide({ ai_slop: 0.7 }, { threshold: 0.7 }).flagged, true);
});

test("threshold is clamped and categories default to enabled", () => {
  const settings = core.normalizeSettings({ threshold: 2, enabled: { scam: false } });
  assert.equal(settings.threshold, core.MAX_THRESHOLD);
  assert.equal(settings.enabled.scam, false);
  assert.equal(settings.enabled.ai_slop, true);
  assert.equal(core.normalizeSettings({ threshold: "x" }).threshold, core.DEFAULT_THRESHOLD);
  assert.equal(core.normalizeSettings(null).apiKey, "");
});

test("ad label is flagged as Promoted without calling Jev", async () => {
  const storage = createStorage({ dumbscrollFilter: { apiKey: "k" } });
  const { fetchImpl, calls } = createFetch({});
  const classifier = DumbscrollClassifier.create({ storage, fetchImpl, core });

  const decision = await classifier.classify({ platform: "linkedin", id: "a1", text: "Buy now", isAdLabel: true });

  assert.equal(decision.flagged, true);
  assert.equal(decision.category, "promoted");
  assert.equal(core.pillText(decision), "Promoted");
  assert.equal(calls.length, 0);
  assert.equal(storage.data.dumbscrollFilterDay.blocked.promoted, 1);
});

test("classifies once, then serves repeats from the daily cache", async () => {
  const storage = createStorage({ dumbscrollFilter: { apiKey: "secret" } });
  const { fetchImpl, calls } = createFetch({ ai_slop: 0.91, scam: 0.02 }, { delayMs: 10 });
  const classifier = DumbscrollClassifier.create({ storage, fetchImpl, core });
  const post = { platform: "x", id: "42", author: "Guru", text: SLOP };

  const [first, concurrent] = await Promise.all([classifier.classify(post), classifier.classify(post)]);
  const repeat = await classifier.classify(post);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://openrouter.ai/api/alpha/decisions");
  assert.equal(calls[0].init.headers.Authorization, "Bearer secret");
  assert.equal(first.flagged, true);
  assert.equal(first.category, "ai_slop");
  assert.equal(concurrent.category, "ai_slop");
  assert.equal(repeat.cached, true);
  assert.equal(storage.data.dumbscrollFilterDay.blocked.ai_slop, 1);
  assert.equal(storage.data.dumbscrollFilterDay.status.ok, true);
});

test("missing key, short text, and API errors leave posts visible", async () => {
  const noKey = DumbscrollClassifier.create({ storage: createStorage(), fetchImpl: createFetch({}).fetchImpl, core });
  assert.equal((await noKey.classify({ platform: "x", id: "1", text: SLOP })).skipped, "no-key");

  const storage = createStorage({ dumbscrollFilter: { apiKey: "bad" } });
  const { fetchImpl } = createFetch({}, { status: 401 });
  const classifier = DumbscrollClassifier.create({ storage, fetchImpl, core });

  assert.equal((await classifier.classify({ platform: "x", id: "2", text: "ok" })).skipped, "too-short");

  const failed = await classifier.classify({ platform: "x", id: "3", text: SLOP });
  assert.equal(failed.flagged, false);
  assert.equal(failed.error, "API key rejected");
  assert.equal(storage.data.dumbscrollFilterDay.status.ok, false);
});

test("revealed posts stay revealed and limit Jev to 4 concurrent requests", async () => {
  const storage = createStorage({ dumbscrollFilter: { apiKey: "k" } });
  let active = 0;
  let peak = 0;
  const fetchImpl = async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return { ok: true, status: 200, json: async () => jevResponse({ ai_slop: 0.99 }) };
  };
  const classifier = DumbscrollClassifier.create({ storage, fetchImpl, core });

  await Promise.all(
    Array.from({ length: 10 }, (_, i) => classifier.classify({ platform: "x", id: `p${i}`, text: SLOP }))
  );
  assert.equal(peak, 4);
  assert.equal(storage.data.dumbscrollFilterDay.blocked.ai_slop, 10);

  await classifier.reveal({ platform: "x", id: "p0" });
  const again = await classifier.classify({ platform: "x", id: "p0", text: SLOP });
  assert.equal(again.flagged, true);
  assert.equal(again.revealed, true);
  assert.equal(storage.data.dumbscrollFilterDay.blocked.ai_slop, 10);
});

test("OpenRouter key migrates from the 2.2.0 per-provider shape", () => {
  assert.equal(core.normalizeSettings(null).apiKey, "");
  assert.equal(core.normalizeSettings({ apiKeys: { openrouter: " sk-or-1 ", typesafe: "ts" } }).apiKey, "sk-or-1");
  assert.equal(core.normalizeSettings({ apiKey: "sk-or-2" }).apiKey, "sk-or-2");
});

test("OpenRouter 402 surfaces as out of credits", async () => {
  const storage = createStorage({ dumbscrollFilter: { apiKey: "k" } });
  const { fetchImpl } = createFetch({}, { status: 402 });
  const classifier = DumbscrollClassifier.create({ storage, fetchImpl, core });

  const result = await classifier.classify({ platform: "x", id: "c1", text: SLOP });
  assert.equal(result.error, "Out of credits");
});

test("day state resets on a new date", () => {
  const stale = { date: "2000-01-01", cache: { "x:1": {} }, blocked: { ai_slop: 3 }, revealed: ["x:1"] };
  const day = core.normalizeDay(stale, "2026-09-30");
  assert.deepEqual(day, core.freshDay("2026-09-30"));
});

test("each Jev call's cost is tagged on the post and added to the day's spend once", async () => {
  const storage = createStorage({ dumbscrollFilter: { apiKey: "k" } });
  const { fetchImpl, calls } = createFetch({ ai_slop: 0.91 });
  const classifier = DumbscrollClassifier.create({ storage, fetchImpl, core });
  const post = { platform: "x", id: "s1", text: SLOP };

  const first = await classifier.classify(post);
  const repeat = await classifier.classify(post);
  await classifier.classify({ platform: "x", id: "s2", text: SLOP });

  assert.equal(calls.length, 2);
  assert.equal(first.cost, 0.00005);
  assert.equal(repeat.cost, 0.00005);
  assert.equal(core.pillText(first), "AI slop · 91%");
  assert.equal(core.costText(first), "$0.00005");
  assert.equal(core.costText({ flagged: true, local: true }), null);
  assert.deepEqual(storage.data.dumbscrollFilterDay.spend, { usd: 0.0001, calls: 2 });
});

test("blocked-post sentence reads as plain English", () => {
  assert.equal(
    core.pillSentence({ category: "ai_slop", label: "AI slop", probability: 0.912 }),
    "Hidden. Jev is 91% sure this is AI slop."
  );
  assert.equal(
    core.pillSentence({ category: "meme", label: "Meme", probability: 0.77 }),
    "Hidden. Jev is 77% sure this is a meme."
  );
  assert.equal(core.pillSentence(core.adLabelDecision()), "Hidden. This post is labelled as an ad.");
});

test("cost formatting keeps two significant digits below a cent", () => {
  assert.equal(core.formatCost(0), "$0");
  assert.equal(core.formatCost(0.00005), "$0.00005");
  assert.equal(core.formatCost(0.0000532), "$0.000053");
  assert.equal(core.formatCost(0.0021), "$0.0021");
  assert.equal(core.formatCost(0.1234), "$0.12");
  assert.equal(core.costFromResponse({ usage: {} }), null);
});

test("media goes to Jev as state and lets short meme captions be classified", () => {
  const body = core.buildJevRequest({
    platform: "x",
    author: "a",
    text: "me rn",
    media: { images: 1, videos: 0, alt: ["Dog in a burning room", "This is fine"] },
  });
  assert.deepEqual(body.state.media, { images: 1, videos: 0, alt_text: "Dog in a burning room | This is fine" });
  assert.ok(core.CATEGORY_IDS.includes("meme"));

  assert.equal(core.isClassifiable({ text: "me rn", media: { images: 1 } }), true);
  assert.equal(core.isClassifiable({ text: "me rn" }), false);
  assert.equal(core.isClassifiable({ text: "ok", media: { images: 1 } }), false);
  assert.deepEqual(core.buildJevRequest({ text: SLOP }).state.media, { images: 0, videos: 0, alt_text: "" });
});
