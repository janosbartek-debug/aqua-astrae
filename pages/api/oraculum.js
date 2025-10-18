// pages/api/oraculum.js
import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const NODE_ENV = process.env.NODE_ENV;

// Warn in dev if key missing
if (!OPENAI_API_KEY) {
  console.warn("[Oraculum] OPENAI_API_KEY is missing. Set it in .env.local");
}

const client = new OpenAI({ apiKey: OPENAI_API_KEY });

export default async function handler(req, res) {
  const startedAt = Date.now();

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        error: "Config error: OPENAI_API_KEY is missing. Set it in .env.local",
      });
    }

    // ---- INPUT VALIDATION (v2) ----
    const {
      cards,
      question,
      spreadType,
      readingFocus,
      tone,
      depth,
      jumpers,
    } = req.body || {};

    const errors = [];
    if (!Array.isArray(cards) || cards.length === 0) {
      errors.push("Missing or invalid 'cards' (non-empty array required).");
    }
    if (typeof question !== "string" || question.trim().length === 0) {
      errors.push("Missing or invalid 'question' (non-empty string required).");
    }
    if (errors.length) {
      return res.status(400).json({ error: errors.join(" ") });
    }

    // Sanitize cards: accept both string[] and object[]
    const normalizedCards = cards
      .slice(0, 10)
      .map((c, i) => {
        if (typeof c === "string") {
          return {
            name: c.trim(),
            reversed: false,
            positionKey: `p${i + 1}`,
          };
        }
        const name = String(c?.name || "").trim();
        const reversed = Boolean(c?.reversed);
        const positionKey = String(c?.positionKey || `p${i + 1}`).trim();
        const positionLabel = c?.positionLabel ? String(c.positionLabel).trim() : undefined;
        return { name, reversed, positionKey, positionLabel };
      })
      .filter((c) => c.name);

    const jumpersList = Array.isArray(jumpers)
      ? jumpers.map((s) => String(s).trim()).filter(Boolean).slice(0, 6)
      : [];

    // Build a compact card line like: "p1 (Múlt): The Star upright; p2: The Moon reversed; ..."
    const cardLine = normalizedCards
      .map((c) => {
        const pos = c.positionLabel ? `${c.positionLabel}` : c.positionKey;
        const rev = c.reversed ? "fejjel lefelé" : "egyenes";
        return `${pos}: ${c.name} (${rev})`;
      })
      .join("; ");

    const model = "gpt-4o-mini"; // lightweight, jó magyar kimenethez

    const systemPrompt =
      "Te Oraculum Aquae Astrae vagy, a Csillag Vize hangja.\n" +
      "Adj magyar nyelvű, gyengéd, mégis gyakorlati tarot-értelmezést.\n" +
      "Szerkezet KÖTELEZŐ:\n" +
      "1) rövid összefoglaló (2–3 mondat),\n" +
      "2) 3 kulcs-értelmezés (•),\n" +
      "3) 3 gyakorlati lépés (•) VÍZ-elem fókuszú ötletekkel (légzés, rítus, naplózás).\n" +
      "Légy empatikus és világos, kerüld a végletességet/fatalizmust.";

    const userPrompt =
      `Kérdés: ${question}\n` +
      `Kirakás típusa: ${spreadType || "ismeretlen"}\n` +
      `Fókusz: ${readingFocus || "n/a"} | Hang: ${tone || "n/a"} | Mélység: ${depth || "n/a"}\n` +
      `Kártyák (pozíció: név (állás)): ${cardLine}\n` +
      (jumpersList.length ? `Kiesett kártyák: ${jumpersList.join(", ")}\n` : "") +
      "Kérlek, a fenti szerkezetben válaszolj, természetes magyar ékezetekkel.";

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 700,
    });

    const choice = completion?.choices?.[0]?.message?.content || "";
    if (!choice) {
      console.error("[Oraculum] Empty response from OpenAI");
      return res.status(502).json({
        error:
          "Az orákulum most nem adott választ. Próbáld újra, vagy módosítsd a kérdést/kártyákat.",
      });
    }

    // Meta
    const usage = completion?.usage || {};
    const tokens =
      (typeof usage.total_tokens === "number" && usage.total_tokens) ||
      (typeof usage.prompt_tokens === "number" && typeof usage.completion_tokens === "number"
        ? usage.prompt_tokens + usage.completion_tokens
        : undefined);

    // (Opcionális) becsült költség — ha nem szeretnéd, hagyd null-on
    const costUSD = null;
    const totalUSDThisMonth = null;

    const ms = Date.now() - startedAt;
    console.log("[Oraculum] ✓ success in " + ms + " ms (model: " + model + ")");

    return res.status(200).json({
      interpretation: choice,
      modelUsed: model,
      tierUsed: "standard",
      tokens,
      costUSD,
      totalUSDThisMonth,
    });
  } catch (err) {
    const ms = Date.now() - startedAt;
    console.error("[Oraculum] ✖ error", {
      elapsedMs: ms,
      name: err && err.name,
      message: err && err.message,
      status:
        (err && err.status) ||
        (err && err.response && err.response.status),
      data: err && err.response && err.response.data,
    });

    const publicMessage =
      "Szerverhiba történt az értelmezés közben. Ellenőrizd az internetkapcsolatot és az API-kulcsot, majd próbáld újra.";

    if (NODE_ENV !== "production") {
      return res.status(500).json({
        error: publicMessage,
        debug: {
          name: err && err.name,
          message: err && err.message,
          status:
            (err && err.status) ||
            (err && err.response && err.response.status),
        },
      });
    }

    return res.status(500).json({ error: publicMessage });
  }
}
