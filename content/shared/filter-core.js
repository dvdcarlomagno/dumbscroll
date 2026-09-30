const DumbscrollFilterCore = (() => {
  const SETTINGS_KEY = "dumbscrollFilter";
  const DAY_KEY = "dumbscrollFilterDay";
  const ENDPOINT = "https://openrouter.ai/api/alpha/decisions";
  const MODEL = "~typesafe/jev-latest";
  const DEFAULT_THRESHOLD = 0.7;
  const MIN_THRESHOLD = 0.5;
  const MAX_THRESHOLD = 0.95;
  const MAX_TEXT_CHARS = 4000;
  const MIN_TEXT_CHARS = 12;
  const MIN_MEDIA_CAPTION_CHARS = 3;
  const MAX_ALT_CHARS = 400;

  // `minThreshold` raises the bar for categories that misfire on ordinary posts.
  const CATEGORIES = [
    {
      id: "ai_slop",
      label: "AI slop",
      phrase: "AI slop",
      instructions:
        "Was `post` most likely generated or heavily padded by an AI model, with little real human substance?",
      criteria: {
        true: "Generic formulaic phrasing, listicle cadence, emoji bullet points, stock hooks like 'Here's the thing' or 'Let that sink in', one-line dramatic paragraphs, and vague lessons with no concrete names, numbers, or events.",
        false: "Reads like a specific person wrote it: concrete details, a real opinion, an actual event, casual or messy wording, even if the topic is professional.",
      },
    },
    {
      id: "promoted",
      label: "Promoted",
      phrase: "an ad",
      instructions:
        "Is `post` an ad, sponsored content, or a paid promotion of a product, service, course, or event?",
      criteria: {
        true: "It sells or advertises something: a call to buy, sign up, book a demo, use a discount code, or join a paid course or event.",
        false: "It shares news, work, or an opinion without asking the reader to buy or sign up for anything.",
      },
    },
    {
      id: "engagement_bait",
      label: "Engagement bait",
      phrase: "engagement bait",
      instructions: "Is `post` mainly fishing for likes, comments, reposts, or follows?",
      criteria: {
        true: "Asks readers to 'comment YES', 'agree?', 'repost if', 'follow for more', gates a freebie on comments, or asks a throwaway question only for reach.",
        false: "Any question or call to action is incidental to real content the author wanted to share.",
      },
    },
    {
      id: "humblebrag",
      label: "Humblebrag",
      phrase: "a humblebrag",
      minThreshold: 0.9,
      instructions:
        "Is `post` a humblebrag: bragging about the author's own success while pretending to be humble, grateful, or teaching a lesson?",
      criteria: {
        true: "The lesson or gratitude is a thin wrapper and the real point is the author's status, e.g. 'I'm humbled to announce I turned down a 7-figure offer' or a hardship story that exists to end on the author's big win.",
        false: "Plain career news (new job, promotion, launch, award, graduation), sincere thanks, or a lesson with real substance. Announcing an achievement directly is NOT a humblebrag.",
      },
    },
    {
      id: "ragebait",
      label: "Rage bait",
      phrase: "rage bait",
      instructions:
        "Is `post` deliberately provocative to trigger outrage or arguments rather than to inform?",
      criteria: {
        true: "Inflammatory framing, sweeping insults of a group, or a hot take designed to make people angry enough to reply.",
        false: "A strong or unpopular opinion argued in good faith, or news that happens to be upsetting.",
      },
    },
    {
      id: "meme",
      label: "Meme",
      phrase: "a meme",
      instructions:
        "Is `post` a meme or joke post made for a quick laugh rather than to inform or share something real? `media` says how many images or videos it has and any image alt text.",
      criteria: {
        true: "A meme or joke format: a short caption on an image or GIF, reaction posts, templates like 'POV:', 'Me when…', 'Nobody: / Me:', 'Tell me you… without telling me', relatable-humor one-liners, or shitposts.",
        false: "Informative or personal content where any image shows real information (a chart, a screenshot of work, a product or event photo), or a real opinion that only uses a joke along the way.",
      },
    },
    {
      id: "scam",
      label: "Scam",
      phrase: "a scam",
      instructions: "Is `post` a scam or spam?",
      criteria: {
        true: "Crypto or get-rich-quick schemes, fake giveaways, suspicious links, impersonation, or bot-like replies.",
        false: "A legitimate post, even if it mentions money, investing, or a link.",
      },
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

    const legacyKey = raw?.apiKeys?.openrouter ?? raw?.apiKey;

    return {
      apiKey: typeof legacyKey === "string" ? legacyKey.trim() : "",
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
      spend: { usd: 0, calls: 0 },
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
      spend: {
        usd: Number.isFinite(raw.spend?.usd) ? raw.spend.usd : 0,
        calls: Number.isFinite(raw.spend?.calls) ? raw.spend.calls : 0,
      },
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

  function normalizeMedia(media) {
    const count = (value) => (Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);
    return {
      images: count(media?.images),
      videos: count(media?.videos),
      alt_text: cleanText((media?.alt ?? []).join(" | ")).slice(0, MAX_ALT_CHARS),
    };
  }

  function hasMedia(media) {
    const normalized = normalizeMedia(media);
    return normalized.images + normalized.videos > 0;
  }

  // Memes are often an image with a two-word caption, so media lowers the text bar.
  function isClassifiable(post) {
    const length = cleanText(post?.text).length;
    return length >= MIN_TEXT_CHARS || (hasMedia(post?.media) && length >= MIN_MEDIA_CAPTION_CHARS);
  }

  function buildJevRequest({ platform, author, text, media }) {
    const questions = {};
    CATEGORIES.forEach((category) => {
      questions[category.id] = {
        type: "noul",
        instructions: category.instructions,
        criteria: category.criteria,
      };
    });

    return {
      model: MODEL,
      state: {
        platform,
        author: cleanText(author).slice(0, 200),
        post: cleanText(text),
        media: normalizeMedia(media),
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

  // OpenRouter bills in USD credits and reports each call's charge as `usage.cost`.
  function costFromResponse(response) {
    const cost = Number(response?.usage?.cost);
    return Number.isFinite(cost) && cost >= 0 ? cost : null;
  }

  function formatCost(usd) {
    if (!Number.isFinite(usd) || usd <= 0) {
      return "$0";
    }

    if (usd >= 0.01) {
      return `$${usd.toFixed(2)}`;
    }

    const decimals = Math.min(8, 1 - Math.floor(Math.log10(usd)));
    return `$${usd.toFixed(decimals).replace(/0+$/, "")}`;
  }

  function labelFor(categoryId) {
    return CATEGORIES.find((category) => category.id === categoryId)?.label ?? categoryId;
  }

  function thresholdFor(categoryId, threshold) {
    const floor = CATEGORIES.find((category) => category.id === categoryId)?.minThreshold ?? 0;
    return Math.max(threshold, floor);
  }

  function decide(probabilities, settings) {
    const { enabled, threshold } = normalizeSettings(settings);
    let best = null;

    CATEGORY_IDS.forEach((id) => {
      if (!enabled[id]) {
        return;
      }

      const probability = probabilities?.[id];
      if (typeof probability !== "number" || probability < thresholdFor(id, threshold)) {
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

  function costText(decision) {
    return Number.isFinite(decision?.cost) ? formatCost(decision.cost) : null;
  }

  function phraseFor(categoryId) {
    return CATEGORIES.find((category) => category.id === categoryId)?.phrase ?? labelFor(categoryId);
  }

  function pillSentence(decision) {
    if (decision.local) {
      return "Hidden. This post is labelled as an ad.";
    }

    return `Hidden. Jev is ${Math.round(decision.probability * 100)}% sure this is ${phraseFor(decision.category)}.`;
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
    ENDPOINT,
    MODEL,
    thresholdFor,
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
    normalizeMedia,
    buildJevRequest,
    probabilitiesFromResponse,
    costFromResponse,
    formatCost,
    costText,
    decide,
    adLabelDecision,
    labelFor,
    pillText,
    pillSentence,
    phraseFor,
  };
})();

if (typeof module !== "undefined") {
  module.exports = DumbscrollFilterCore;
}
