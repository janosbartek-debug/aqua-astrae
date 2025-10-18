// pages/api/oraculum.js

/**
 * Aqua Astræ Oraculum — biztonságos backend (v2)
 * Főbb elemek:
 *  - Origin védelem (CORS allowlist)
 *  - Szigorú input validáció (spread/focus/tone/depth)
 *  - Modell-routing (general → 4o-mini, medium → 4.1-mini, deep → o3-mini)
 *  - Kettős OpenAI hívás: Chat Completions (4o/4.1) + Responses (o3*)
 *  - Havi költségkeret (hard cap) ENV-ből
 *  - Árbecslés ENV-ből felülírható alapértelmezéssel
 *
 * Fontos:
 *  - Ne tárolj API kulcsot a kódban; használj .env-t / Vercel Secrets-t
 *  - Productionben a monthlyUsage-t tedd tartós storage-ba (pl. Supabase/Redis)
 *  - Az itt használt árak hozzávetőlegesek; állítsd az ENV-ben!
 */

let monthlyUsage = { monthKey: "", usdSpent: 0 }; // demo cache — PROD: Supabase/Redis

// ---------- Helpers

function getMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Árbecslés: ENV felülírhatja a defaultokat
function getPricePer1k(model) {
  const envKey = {
    "gpt-4o-mini": "PRICE_GPT4O_MINI",
    "gpt-4o": "PRICE_GPT4O",
    "gpt-4.1-mini": "PRICE_GPT41_MINI",
    "gpt-4.1": "PRICE_GPT41",
    "o3-mini": "PRICE_O3_MINI",
  }[model];

  if (envKey && process.env[envKey]) return parseFloat(process.env[envKey]);

  // Biztonságos, konzervatív defaultok (USD / 1k token) — állítsd ENV-ben pontosra!
  const defaults = {
    "gpt-4o-mini": 0.002,
    "gpt-4o": 0.010,
    "gpt-4.1-mini": 0.006,
    "gpt-4.1": 0.030,
    "o3-mini": 0.015,
  };
  return defaults[model] ?? 0.002;
}

function estimateCost(tokens = 400, model = "gpt-4o-mini") {
  return (tokens / 1000) * getPricePer1k(model);
}

function isString(x) {
  return typeof x === "string" && x.trim().length > 0;
}
function isStringArray(a) {
  return Array.isArray(a) && a.every((x) => isString(x));
}

function normalizeEnum(value, allowed, fallback) {
  if (!isString(value)) return fallback;
  const v = value.toLowerCase();
  return allowed.includes(v) ? v : fallback;
}

/**
 * Routing logika:
 * - Ha explicit tier van (general|medium|deep) → azt használjuk (whitelisttel)
 * - Egyébként szabályok:
 *    - mély: depth==="mély" || spread in (celtic_cross, shadow) || cards.length >= 8
 *    - közepes: cards.length in [5..7] || hosszú kérdés
 *    - általános: különben
 */
function chooseTier({ depth, spreadType, cards, question }) {
  // explicit tier (opcionális, UI-ból)
  if (depth === "tier:general") return "general";
  if (depth === "tier:medium") return "medium";
  if (depth === "tier:deep") return "deep";

  const longQuestion = isString(question) && question.trim().length > 220;

  const deepSpreads = new Set(["celtic_cross", "shadow"]);
  if (
    depth === "mély" ||
    deepSpreads.has(spreadType) ||
    (Array.isArray(cards) && cards.length >= 8)
  ) {
    return "deep";
  }
  if (
    (Array.isArray(cards) && cards.length >= 5 && cards.length <= 7) ||
    longQuestion
  ) {
    return "medium";
  }
  return "general";
}

const ALLOWED_MODELS = {
  general: "gpt-4o-mini",
  medium: "gpt-4.1-mini",
  deep: "o3-mini", // Responses API-val hívjuk
};

function buildPrompt({ cards, question, spreadType, readingFocus, tone }) {
  const spreadLabelMap = {
    one_card: "Egylapos üzenet",
    three_card: "Háromlapos (múlt–jelen–jövő / döntési mérleg)",
    relationship: "Kapcsolati háromszög (én–te–kapcsolat)",
    elements: "Elem-harmonizáló (víz–tűz–föld–levegő)",
    moon: "Holdút / ciklikus olvasás",
    celtic_cross: "Kelta kereszt (10 lap)",
    shadow: "Árnyékmunka",
    freeform: "Szabad, intuitív elrendezés",
  };
  const spreadLabel = spreadLabelMap[spreadType] || "Szabad olvasás";

  const focusText = {
    pszichológiai:
      "Fókusz: pszichológiai-archetipikus értelmezés, belső minták és narratív integráció.",
    mágikus:
      "Fókusz: mágikus-sorsvonalas értelmezés, jelképek és rituális tanácsok.",
    energetikai:
      "Fókusz: energetikai-szomatikus értelmezés, érzelmi blokkok és harmonizálás.",
    pragmatikus:
      "Fókusz: pragmatikus döntéstámogatás, opciók összevetése és következő lépések.",
  }[readingFocus];

  const toneText = {
    empatikus:
      "Hangnem: empatikus-terápiás, kíméletes tükrözés, remény- és erőforrás-fókusz.",
    rituális:
      "Hangnem: rituális, misztikus, de felelősen gyakorlatias; víz-elem motívumokkal.",
    coaching:
      "Hangnem: coaching, akció-orientált, világos prioritások és SMART lépések.",
  }[tone];

  return `
Te az Aqua Astræ Orákuluma vagy. Magyarul válaszolj. Mantra: "Fluat lux stellae in aqua mea."
Válasz-struktúra: 
1) rövid összefoglaló (2–3 mondat),
2) 3 kulcs-értelmezés (• jelöléssel),
3) 3 gyakorlati lépés (• jelöléssel, víz-elem fókusz, konkrét).

Elrendezés: ${spreadLabel}
${focusText || ""}
${toneText || ""}

Szabályok:
- Ne legyél végzetes/fatalista, ne adj egészségügyi/jogi diagnózist.
- Legyél együttérző, de határozott; legyen íve a történetnek.
- Légy tömör: max ~1800 karakter.

Kártyák: ${cards.join(", ")}
Kérdés: ${question}
`;
}

// ---------- Handler

export default async function handler(req, res) {
  // 1) Origin-védelem (+ preflight engedés)
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "https://aqua-astrae.vercel.app";
  const origin = req.headers.origin;
  if (req.method === "OPTIONS") {
    if (origin && origin === allowedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      return res.status(200).end();
    }
    return res.status(403).json({ error: "Tiltott domain." });
  }
  if (origin && origin !== allowedOrigin) {
    return res.status(403).json({ error: "Tiltott domain." });
  }
  if (origin === allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Csak POST metódus engedélyezett." });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "Hiányzó OPENAI_API_KEY a környezetben." });
  }

  // 2) Input parse + validáció
  const {
    cards,
    question,
    spreadType: rawSpreadType,
    readingFocus: rawReadingFocus,
    tone: rawTone,
    depth: rawDepth, // "rövid" | "közepes" | "mély" | vagy opcionális tier:*
    tier, // opcionális: "general" | "medium" | "deep" (UI-ból)
  } = req.body || {};

  if (!isStringArray(cards) || !isString(question)) {
    return res.status(400).json({ error: "Hiányzó vagy hibás kártyák/kérdés." });
  }

  const spreadType = normalizeEnum(
    rawSpreadType,
    [
      "one_card",
      "three_card",
      "relationship",
      "elements",
      "moon",
      "celtic_cross",
      "shadow",
      "freeform",
    ],
    "freeform"
  );

  const readingFocus = normalizeEnum(
    rawReadingFocus,
    ["pszichológiai", "mágikus", "energetikai", "pragmatikus"],
    "pszichológiai"
  );

  const tone = normalizeEnum(
    rawTone,
    ["empatikus", "rituális", "coaching"],
    "empatikus"
  );

  const depth = normalizeEnum(rawDepth, ["rövid", "közepes", "mély", "tier:general", "tier:medium", "tier:deep"], "közepes");

  // 3) Modell-routing
  const autoTier = tier || chooseTier({ depth, spreadType, cards, question });
  const ALLOWED_TIERS = ["general", "medium", "deep"];
  const chosenTier = ALLOWED_TIERS.includes(autoTier) ? autoTier : "general";
  const model = ALLOWED_MODELS[chosenTier];

  // 4) Havi hard cap
  const MONTHLY_CAP = parseFloat(process.env.MONTHLY_CAP_DOLLARS || "5.0");
  const monthKey = getMonthKey();
  if (monthlyUsage.monthKey !== monthKey) {
    monthlyUsage = { monthKey, usdSpent: 0 };
  }

  // Előzetes becslés (óvatos)
  const estimatedCost = estimateCost(500, model);
  if (monthlyUsage.usdSpent + estimatedCost > MONTHLY_CAP) {
    return res.status(429).json({
      error: "A havi költségkeret kimerült. Próbáld újra jövő hónapban.",
      capUSD: MONTHLY_CAP,
      currentUSD: monthlyUsage.usdSpent.toFixed(3),
    });
  }

  // 5) Prompt
  const prompt = buildPrompt({ cards, question, spreadType, readingFocus, tone });

  // 6) OpenAI hívás
  const apiKey = process.env.OPENAI_API_KEY;
  let interpretation = "(nincs válasz)";
  let usedTokens = 500; // fallback, ha nincs usage mező
  let httpStatus = 200;
  let providerPayload = null;

  try {
    if (model.startsWith("o3")) {
      // Responses API (reasoning)
      const resp = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          reasoning: { effort: "medium" }, // finomhangolható: "low" | "medium" | "high"
          input: [
            { role: "system", content: "Te vagy az Aqua Astræ Orákuluma. Fluat lux stellae in aqua mea." },
            { role: "user", content: prompt },
          ],
        }),
      });
      const data = await resp.json();
      httpStatus = resp.status;
      if (!resp.ok) {
        console.error("OpenAI Responses API hiba:", resp.status, data);
        return res.status(502).json({
          error: "OpenAI hívás sikertelen (Responses API)",
          status: resp.status,
          details: data?.error?.message || data,
        });
      }
      // Responses output normalizálása
      interpretation = (data?.output_text || data?.content?.[0]?.text || "").trim() || "(nincs válasz)";
      usedTokens = data?.usage?.total_tokens || usedTokens;
      providerPayload = data;
    } else {
      // Chat Completions API
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "Te vagy az Aqua Astræ Orákuluma. Fluat lux stellae in aqua mea." },
            { role: "user", content: prompt },
          ],
          temperature: 0.8,
        }),
      });
      const data = await resp.json();
      httpStatus = resp.status;
      if (!resp.ok) {
        console.error("OpenAI Chat API hiba:", resp.status, data);
        return res.status(502).json({
          error: "OpenAI hívás sikertelen (Chat Completions)",
          status: resp.status,
          details: data?.error?.message || data,
        });
      }
      interpretation = data?.choices?.[0]?.message?.content?.trim() || "(nincs válasz)";
      usedTokens = data?.usage?.total_tokens || usedTokens;
      providerPayload = data;
    }

    // 7) Költség elszámolása
    const actualCost = estimateCost(usedTokens, model);
    monthlyUsage.usdSpent += actualCost;

    return res.status(200).json({
      interpretation,
      modelUsed: model,
      tierUsed: chosenTier,
      tokens: usedTokens,
      costUSD: Number(actualCost.toFixed(4)),
      totalUSDThisMonth: Number(monthlyUsage.usdSpent.toFixed(3)),
      meta: {
        spreadType,
        readingFocus,
        tone,
        depth,
        httpStatus,
      },
    });
  } catch (err) {
    console.error("Oraculum hiba:", err);
    return res.status(500).json({ error: "Hiba az orákulum válasz generálásakor." });
  }
}
