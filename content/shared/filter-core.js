const DumbscrollFilterCore = (() => {
  const SETTINGS_KEY = "dumbscrollFilter";
  const DAY_KEY = "dumbscrollFilterDay";
  const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
  const JEV_MODEL = "jev-latest";
  const DEFAULT_THRESHOLD = 0.7;
  const MIN_THRESHOLD = 0.5;
  const MAX_THRESHOLD = 0.95;
  const MAX_TEXT_CHARS = 4000;
  const MIN_TEXT_CHARS = 12;

  const CATEGORIES = [
    {
      id: "ai_slop",
      label: "AI slop",
      instructions:
        "Was this social media post most likely written or heavily padded by an AI model with little human substance? Signs: generic formulaic phrasing, listicle cadence, emoji bullet points, 'Here's the thing', 'Let that sink in', one-line dramatic paragraphs, vague lessons with no concrete detail.",
    },
    {
      id: "promoted",
      label: "Promoted",
      instructions:
        "Is this post an ad, sponsored content, or a paid promotion of a product, service, course, or event?",
    },
    {
      id: "engagement_bait",
      label: "Engagement bait",
      instructions:
        "Is this post mainly fishing for engagement, e.g. 'comment YES', 'agree?', 'repost if', 'follow for more', polls or questions posted only for reach, or giveaways gated on likes/comments?",
    },
    {
      id: "humblebrag",
      label: "Humblebrag",
      instructions:
        "Is this post self-promotion disguised as a lesson, story, or gratitude, where the real point is showing off the author's achievements, job, or success?",
    },
    {
      id: "ragebait",
      label: "Rage bait",
      instructions:
        "Is this post deliberately provocative or inflammatory to trigger outrage, arguments, or dunking rather than to inform?",
    },
    {
      id: "scam",
      label: "Scam",
      instructions:
        "Is this post a scam or spam: crypto or get-rich-quick schemes, fake giveaways, suspicious links, impersonation, or bot-like replies?",
    },
  ];

  const CATEGORY_IDS = CATEGORIES.map((category) => category.id);

  function clampThreshold(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return DEFAULT_THRESHOLD;
    }

    return Math.min(Math.max(parsed, MIN_THRESHOLD), MAX_THRESHOLD);
  }

  function normalizeSettings(raw) {
    const enabled = {};
    CATEGORY_IDS.forEach((id) => {
      enabled[id] = raw?.enabled?.[id] !== false;
    });

    return {
      apiKey: typeof raw?.apiKey === "string" ? raw.apiKey.trim() : "",
      enabled,
      threshold: clampThreshold(raw?.threshold ?? DEFAULT_THRESHOLD),
    };
  }

  function todayKey(now = new Date()) {
    return now.toLocaleDateString("en-CA");
  }

  function freshDay(date = todayKey()) {
    return {
      date,
      cache: {},
      blocked: {},
      revealed: [],
      status: null,
    };
  }

  function normalizeDay(raw, date = todayKey()) {
    if (!raw || raw.date !== date) {
      return freshDay(date);
    }

    return {
      date,
      cache: raw.cache ?? {},
      blocked: raw.blocked ?? {},
      revealed: Array.isArray(raw.revealed) ? raw.revealed : [],
      status: raw.status ?? null,
    };
  }

  function cacheKey(platform, id) {
    return `${platform}:${id}`;
  }

  function cleanText(text) {
    return String(text ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_TEXT_CHARS);
  }

  function isClassifiable(post) {
    return cleanText(post?.text).length >= MIN_TEXT_CHARS;
  }

  function buildJevRequest({ platform, author, text }) {
    const questions = {};
    CATEGORIES.forEach((category) => {
      questions[category.id] = {
        type: "noul",
        instructions: category.instructions,
      };
    });

    return {
      model: JEV_MODEL,
      state: {
        platform,
        author: cleanText(author).slice(0, 200),
        post: cleanText(text),
      },
      questions,
    };
  }

  function probabilitiesFromResponse(response) {
    const probabilities = {};
    CATEGORY_IDS.forEach((id) => {
      const value = Number(response?.answers?.[id]?.noul);
      if (Number.isFinite(value)) {
        probabilities[id] = Math.min(Math.max(value, 0), 1);
      }
    });

    return probabilities;
  }

  function labelFor(categoryId) {
    return CATEGORIES.find((category) => category.id === categoryId)?.label ?? categoryId;
  }

  function decide(probabilities, settings) {
    const { enabled, threshold } = normalizeSettings(settings);
    let best = null;

    CATEGORY_IDS.forEach((id) => {
      if (!enabled[id]) {
        return;
      }

      const probability = probabilities?.[id];
      if (typeof probability !== "number" || probability < threshold) {
        return;
      }

      if (!best || probability > best.probability) {
        best = { category: id, probability };
      }
    });

    if (!best) {
      return { flagged: false };
    }

    return {
      flagged: true,
      category: best.category,
      probability: best.probability,
      label: labelFor(best.category),
    };
  }

  function adLabelDecision() {
    return {
      flagged: true,
      category: "promoted",
      probability: 1,
      label: labelFor("promoted"),
      local: true,
    };
  }

  function pillText(decision) {
    if (decision.local) {
      return decision.label;
    }

    return `${decision.label} · ${Math.round(decision.probability * 100)}%`;
  }

  return {
    SETTINGS_KEY,
    DAY_KEY,
    JEV_ENDPOINT,
    JEV_MODEL,
    DEFAULT_THRESHOLD,
    MIN_THRESHOLD,
    MAX_THRESHOLD,
    CATEGORIES,
    CATEGORY_IDS,
    clampThreshold,
    normalizeSettings,
    normalizeDay,
    freshDay,
    todayKey,
    cacheKey,
    cleanText,
    isClassifiable,
    buildJevRequest,
    probabilitiesFromResponse,
    decide,
    adLabelDecision,
    labelFor,
    pillText,
  };
})();

if (typeof module !== "undefined") {
  module.exports = DumbscrollFilterCore;
}
