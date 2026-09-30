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
  return { model: "jev-1.13.0", answers, usage: { input_tokens: 300, output_tokens: 6 } };
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
  assert.equal(core.buildJevRequest({ text: SLOP }, "typesafe").model, "jev-latest");
  assert.deepEqual(body.state, { platform: "x", author: "Guru", post: SLOP });
  assert.deepEqual(Object.keys(body.questions), core.CATEGORY_IDS);
  Object.values(body.questions).forEach((question) => {
    assert.equal(question.type, "noul");
    assert.ok(question.instructions.length > 20);
  });
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

test("keys are stored per provider and default to OpenRouter", () => {
  const defaults = core.normalizeSettings(null);
  assert.equal(defaults.provider, "openrouter");
  assert.equal(defaults.apiKey, "");

  const settings = core.normalizeSettings({
    provider: "typesafe",
    apiKeys: { openrouter: " sk-or-1 ", typesafe: "ts-1" },
  });
  assert.equal(settings.apiKey, "ts-1");
  assert.equal(settings.apiKeys.openrouter, "sk-or-1");

  assert.equal(core.normalizeSettings({ provider: "nope", apiKey: "legacy" }).apiKeys.openrouter, "legacy");
});

test("TypeSafe provider calls the TypeSafe endpoint with its own key", async () => {
  const storage = createStorage({
    dumbscrollFilter: { provider: "typesafe", apiKeys: { openrouter: "or", typesafe: "ts" } },
  });
  const { fetchImpl, calls } = createFetch({ scam: 0.9 });
  const classifier = DumbscrollClassifier.create({ storage, fetchImpl, core });

  const decision = await classifier.classify({ platform: "x", id: "t1", text: SLOP });

  assert.equal(decision.category, "scam");
  assert.equal(calls[0].url, "https://api.typesafe.ai/v1/systemone");
  assert.equal(calls[0].init.headers.Authorization, "Bearer ts");
  assert.equal(calls[0].body.model, "jev-latest");
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
