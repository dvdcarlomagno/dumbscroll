/* global DumbscrollFilterCore */
const DumbscrollClassifier = (() => {
  const MAX_CONCURRENT = 4;
  const REQUEST_TIMEOUT_MS = 8000;

  function errorMessage(error) {
    if (error?.status === 401 || error?.status === 403) {
      return "API key rejected";
    }

    if (error?.status === 402) {
      return "Out of credits";
    }

    if (error?.status === 429) {
      return "Rate limited, retrying later";
    }

    if (error?.name === "AbortError") {
      return "Jev timed out";
    }

    return error?.message || "Jev request failed";
  }

  function create({ storage, fetchImpl, core = DumbscrollFilterCore, now = () => new Date() }) {
    const inFlight = new Map();
    const queue = [];
    let active = 0;
    let writeChain = Promise.resolve();

    async function readSettings() {
      const { [core.SETTINGS_KEY]: raw } = await storage.get(core.SETTINGS_KEY);
      return core.normalizeSettings(raw);
    }

    async function readDay() {
      const { [core.DAY_KEY]: raw } = await storage.get(core.DAY_KEY);
      return core.normalizeDay(raw, core.todayKey(now()));
    }

    // Every day-state write is a read-modify-write, so serialize them.
    function updateDay(mutate) {
      writeChain = writeChain
        .then(async () => {
          const day = await readDay();
          mutate(day);
          await storage.set({ [core.DAY_KEY]: day });
          return day;
        })
        .catch(() => null);
      return writeChain;
    }

    function setStatus(status) {
      return updateDay((day) => {
        day.status = { ...status, at: now().toISOString() };
      });
    }

    function runLimited(task) {
      return new Promise((resolve, reject) => {
        queue.push({ task, resolve, reject });
        drain();
      });
    }

    function drain() {
      while (active < MAX_CONCURRENT && queue.length > 0) {
        const { task, resolve, reject } = queue.shift();
        active += 1;
        task()
          .then(resolve, reject)
          .finally(() => {
            active -= 1;
            drain();
          });
      }
    }

    async function callJev(settings, post) {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;

      try {
        const response = await fetchImpl(core.ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${settings.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(core.buildJevRequest(post)),
          signal: controller?.signal,
        });

        if (!response.ok) {
          const error = new Error(`Jev returned HTTP ${response.status}`);
          error.status = response.status;
          throw error;
        }

        const body = await response.json();
        return {
          probabilities: core.probabilitiesFromResponse(body),
          cost: core.costFromResponse(body),
        };
      } finally {
        if (timer) {
          clearTimeout(timer);
        }
      }
    }

    function recordSpend(day, cost) {
      day.spend.calls += 1;
      if (cost !== null) {
        day.spend.usd += cost;
      }
    }

    async function recordFlag(key, decision) {
      if (!decision.flagged) {
        return;
      }

      await updateDay((day) => {
        const entry = day.cache[key] ?? {};
        if (entry.countedAs) {
          return;
        }

        day.cache[key] = { ...entry, countedAs: decision.category };
        day.blocked[decision.category] = (day.blocked[decision.category] ?? 0) + 1;
      });
    }

    async function classify(post) {
      const settings = await readSettings();
      const key = core.cacheKey(post.platform, post.id);
      const day = await readDay();
      const revealed = day.revealed.includes(key);

      if (post.isAdLabel) {
        if (!settings.enabled.promoted) {
          return { flagged: false, revealed };
        }

        const decision = core.adLabelDecision();
        await recordFlag(key, decision);
        return { ...decision, revealed };
      }

      const cached = day.cache[key];
      if (cached?.probabilities) {
        return { ...core.decide(cached.probabilities, settings), cost: cached.cost ?? null, revealed, cached: true };
      }

      if (!settings.apiKey) {
        return { flagged: false, revealed, skipped: "no-key" };
      }

      if (!core.isClassifiable(post)) {
        return { flagged: false, revealed, skipped: "too-short" };
      }

      if (!inFlight.has(key)) {
        const request = runLimited(() => callJev(settings, post))
          .then(async (result) => {
            await updateDay((next) => {
              next.cache[key] = { ...(next.cache[key] ?? {}), ...result };
              recordSpend(next, result.cost);
              if (!next.status?.ok) {
                next.status = { ok: true, message: "Connected", at: now().toISOString() };
              }
            });
            return result;
          })
          .finally(() => {
            inFlight.delete(key);
          });
        inFlight.set(key, request);
      }

      try {
        const { probabilities, cost } = await inFlight.get(key);
        const decision = core.decide(probabilities, settings);
        await recordFlag(key, decision);
        return { ...decision, cost, revealed };
      } catch (error) {
        const message = errorMessage(error);
        await setStatus({ ok: false, message });
        return { flagged: false, revealed, error: message };
      }
    }

    async function reveal({ platform, id }) {
      const key = core.cacheKey(platform, id);
      await updateDay((day) => {
        if (!day.revealed.includes(key)) {
          day.revealed.push(key);
        }
      });
    }

    async function testKey() {
      const settings = await readSettings();
      if (!settings.apiKey) {
        await setStatus({ ok: false, message: "Add an API key" });
        return { ok: false, message: "Add an API key" };
      }

      try {
        const { cost } = await callJev(settings, {
          platform: "test",
          author: "Dumbscroll",
          text: "Agree? Comment YES if you think consistency beats talent. 🚀 Let that sink in.",
        });
        await updateDay((day) => recordSpend(day, cost));
        await setStatus({ ok: true, message: "Connected" });
        return { ok: true, message: "Connected" };
      } catch (error) {
        const message = errorMessage(error);
        await setStatus({ ok: false, message });
        return { ok: false, message };
      }
    }

    return { classify, reveal, testKey, MAX_CONCURRENT };
  }

  return { create, MAX_CONCURRENT };
})();

if (typeof module !== "undefined") {
  module.exports = DumbscrollClassifier;
}
