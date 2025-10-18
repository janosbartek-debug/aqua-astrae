// pages/api/oraculum.js
import OpenAI from "openai";

/** JSON válasz (UTF-8) */
function json(res, status, obj) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Tier → modell (run-szintű override a Assistants futtatáskor is) */
function modelFromTier(tier) {
  if (tier === "astral_depth" || tier === 3 || tier === "3") return "gpt-4o";
  return "gpt-4o-mini";
}

/** Tier presetek a fallback-hez (Chat Completions) */
const TIERS = {
  aqua_spark: {
    name: "💧 Aqua Spark",
    model: "gpt-4o-mini",
    system:
      "Adj gyors, lényegre törő, de érző tarot-értelmezést magyarul. " +
      "Kerüld a kártyák külön-külön felsorolását; a lényeget foglald össze.",
    userTemplate: `Tarot olvasás.
Kérdés: {user_question}
Helyzet: {context}
Lapok: {cards}
Értelmezd röviden, hogyan kapcsolódnak a lapok egymáshoz és a helyzethez.
Ne írd le külön a kártyák jelentését, hanem foglald össze, mit üzennek együtt.`,
    max_tokens: 350,
  },
  lumen_flow: {
    name: "🌊 Lumen Flow",
    model: "gpt-4o-mini",
    system:
      "Te egy érzékeny, intuitív tarot-olvasó vagy. Magyarul, természetes, áramló stílusban válaszolj.",
    userTemplate: `Kérdés: {user_question}
Helyzet: {context}
Lapok: {cards}
Értelmezd a lapokat együtt, mintha egy történetet mesélnének erről a helyzetről.
Mutasd meg, milyen irányba tart az energia, és mit tanácsol a kombináció.
Végül adj egy rövid összegzést: „Üzenet összefoglalva: …”`,
    max_tokens: 600,
  },
  astral_depth: {
    name: "🌕 Astral Depth",
    model: "gpt-4o",
    system:
      "Te egy tapasztalt, empatikus tarot-olvasó vagy, aki pszichológiai és spirituális szinten is értelmez. " +
      "Ne magyarázd külön a kártyákat; mutasd meg a rezonanciákat és tanításokat.",
    userTemplate: `Kérdés: {user_question}
Helyzet: {context}
Lapok: {cards}
Feladatod, hogy a felhasználó kérdését és helyzetét mélyen átlátva összekapcsold a lapok üzenetét egy egységes történetbe.
Írj természetes, intuitív stílusban, szimbolikus és pszichológiai szinten is érthetően.
Zárd „🌙 Összegzés:” résszel, ami egyetlen mondatban összefoglalja a fő üzenetet.`,
    max_tokens: 900,
  },
};

/** Kártyák normalizálása */
function normalizeCards(cards) {
  return cards
    .slice(0, 10)
    .map((c, i) => {
      const o = typeof c === "string" ? { name: c } : c || {};
      const name = String(o.name || "").trim();
      const reversed = !!o.reversed;
      const pos = String(o.positionLabel || o.positionKey || `p${i + 1}`).trim();
      if (!name) return null;
      return `${pos}: ${name}${reversed ? " (fejjel lefelé)" : ""}`;
    })
    .filter(Boolean)
    .join("; ");
}

/** Assistants API futtatás (elsődleges út, usage-lekéréssel) */
async function runWithAssistant({ tier, question, context, normCards, jumpersLine }) {
  if (!process.env.ORACULUM_ASSISTANT_ID) {
    throw new Error("ORACULUM_ASSISTANT_ID missing (env).");
  }
  const model = modelFromTier(tier);

  const thread = await client.beta.threads.create({});

  const content =
    `Kérdés: ${question}\n` +
    `Helyzet: ${context?.toString().trim() || "nincs megadva"}\n` +
    `Lapok: ${normCards}\n` +
    (jumpersLine || "") +
    `\nKérlek, a saját hangodon (HU), koherensen, a lapok kapcsolatára fókuszálva adj értelmezést.`;

  await client.beta.threads.messages.create(thread.id, {
    role: "user",
    content,
  });

  const run = await client.beta.threads.runs.create(thread.id, {
    assistant_id: process.env.ORACULUM_ASSISTANT_ID,
    model,
  });

  const started = Date.now();
  let status = run.status;
  while (["queued", "in_progress"].includes(status)) {
    if (Date.now() - started > 60_000) throw new Error("Run timeout (60s).");
    await new Promise((r) => setTimeout(r, 900));
    const rget = await client.beta.threads.runs.retrieve(thread.id, run.id);
    status = rget.status;
    if (["failed", "cancelled", "expired"].includes(status)) throw new Error(`Run ${status}`);
  }

  // ✅ ÚJ: tokenhasználat lekérése
  const runInfo = await client.beta.threads.runs.retrieve(thread.id, run.id);
  const usage = runInfo?.usage || {};

  const msgs = await client.beta.threads.messages.list(thread.id, { limit: 5 });
  const latest = msgs.data?.[0]?.content ?? [];
  const text = latest
    .map((p) => (p.type === "text" ? p.text?.value : null))
    .filter(Boolean)
    .join("\n\n")
    .trim();

  return {
    interpretation: text,
    modelUsed: model,
    tierUsed: tier,
    tokens: usage.total_tokens ?? null,
  };
}

/** Fallback: Chat Completions (ugyanazzal a hanggal) */
async function runWithChatCompletions({ tier, question, context, normCards, jumpersLine }) {
  const chosen =
    tier === "astral_depth" || tier === 3 || tier === "3"
      ? TIERS.astral_depth
      : tier === "lumen_flow" || tier === 2 || tier === "2"
      ? TIERS.lumen_flow
      : TIERS.aqua_spark;

  const userPrompt =
    chosen.userTemplate
      .replace("{user_question}", question)
      .replace("{context}", (context && String(context).trim()) || "nincs megadva")
      .replace("{cards}", normCards) + "\n" + (jumpersLine || "");

  const completion = await client.chat.completions.create({
    model: chosen.model,
    temperature: 0.8,
    max_tokens: chosen.max_tokens,
    messages: [
      { role: "system", content: chosen.system },
      { role: "user", content: userPrompt },
    ],
  });

  const interpretation = completion?.choices?.[0]?.message?.content || "";
  const usage = completion?.usage || {};
  const tokens =
    usage.total_tokens ??
    (usage.prompt_tokens && usage.completion_tokens
      ? usage.prompt_tokens + usage.completion_tokens
      : undefined);

  return {
    interpretation,
    modelUsed: chosen.model,
    tierUsed: chosen.name,
    tokens,
    costUSD: null,
    totalUSDThisMonth: null,
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return json(res, 405, { error: "Only POST" });

    const { cards, question, context, spreadType, tier, jumpers } = req.body || {};

    if (!Array.isArray(cards) || cards.length === 0)
      return json(res, 400, { error: "Missing 'cards' (non-empty array required)." });
    if (typeof question !== "string" || !question.trim())
      return json(res, 400, { error: "Missing 'question' (non-empty string required)." });

    const normCards = normalizeCards(cards);
    const jumpersLine =
      Array.isArray(jumpers) && jumpers.length ? `Kiesett kártyák: ${jumpers.join(", ")}\n` : "";

    if (!process.env.OPENAI_API_KEY)
      return json(res, 500, {
        error: "OPENAI_API_KEY missing. Add it to .env.local (dev) or Vercel env vars (prod).",
      });

    try {
      const r = await runWithAssistant({ tier, question, context, normCards, jumpersLine });
      if (!r.interpretation) throw new Error("Empty interpretation from Assistants.");

      return json(res, 200, {
        interpretation: r.interpretation,
        modelUsed: r.modelUsed,
        tierUsed:
          tier === "astral_depth" || tier === 3 || tier === "3"
            ? TIERS.astral_depth.name
            : tier === "lumen_flow" || tier === 2 || tier === "2"
            ? TIERS.lumen_flow.name
            : TIERS.aqua_spark.name,
        tokens: r.tokens,
        costUSD: null,
        totalUSDThisMonth: null,
      });
    } catch {
      const r = await runWithChatCompletions({ tier, question, context, normCards, jumpersLine });
      if (!r.interpretation) throw new Error("Empty response from fallback.");
      return json(res, 200, r);
    }
  } catch (err) {
    return json(res, 500, {
      error: "Server error while generating interpretation.",
      debug:
        process.env.NODE_ENV !== "production"
          ? { name: err?.name, message: err?.message, stack: err?.stack }
          : undefined,
    });
  }
}
