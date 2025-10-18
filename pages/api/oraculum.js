// pages/api/oraculum.js

/**
 * Aqua Astræ Oraculum — biztonságos backend
 * Tartalmaz:
 *  - domain ellenőrzést (CORS)
 *  - modell whitelistet
 *  - havi költségkeret ellenőrzést (hard cap)
 */

let monthlyUsage = { monthKey: "", usdSpent: 0 }; // helyi cache — productionben: Supabase/Redis

function getMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
}

function estimateCost(tokens = 400, model = "gpt-4o-mini") {
  // hozzávetőleges token-árak (USD / 1k token)
  const prices = {
    "gpt-4o-mini": 0.002,
    "gpt-4o": 0.01,
  };
  return (tokens / 1000) * (prices[model] || 0.002);
}

export default async function handler(req, res) {
  // 6️⃣ Origin-védelem
  const allowedOrigin = "https://aqua-astrae.vercel.app";
  const origin = req.headers.origin;
  if (origin && origin !== allowedOrigin) {
    return res.status(403).json({ error: "Tiltott domain." });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Csak POST metódus engedélyezett." });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "Hiányzó OPENAI_API_KEY a környezetben." });
  }

  const { cards, question, tier } = req.body || {};
  if (!Array.isArray(cards) || !question) {
    return res.status(400).json({ error: "Hiányzó kártyák vagy kérdés." });
  }

  // 3️⃣ Modell-whitelist — kliens nem tud mást beállítani
  const ALLOWED_MODELS = {
    general: "gpt-4o-mini",
    deep: "gpt-4o",
  };
  const chosenTier = tier === "deep" ? "deep" : "general";
  const model = ALLOWED_MODELS[chosenTier];

  // 4️⃣ Hard cap — védelem túlköltés ellen
  const MONTHLY_CAP = parseFloat(process.env.MONTHLY_CAP_DOLLARS || "5.0");
  const monthKey = getMonthKey();
  if (monthlyUsage.monthKey !== monthKey) {
    monthlyUsage = { monthKey, usdSpent: 0 };
  }
  const estimatedCost = estimateCost(400, model);
  if (monthlyUsage.usdSpent + estimatedCost > MONTHLY_CAP) {
    return res.status(429).json({
      error: "A havi költségkeret kimerült. Próbáld újra jövő hónapban.",
      capUSD: MONTHLY_CAP,
      currentUSD: monthlyUsage.usdSpent.toFixed(3),
    });
  }

  // prompt összeállítása
  const prompt = `
Te vagy az Aqua Astræ Orákuluma. Magyarul válaszolj.
Szerkezet: 1) rövid összefoglaló, 2) 3 kulcs-értelmezés (•), 3) 3 gyakorlati lépés (•, víz-elem fókusz).
Kártyák: ${cards.join(", ")}
Kérdés: ${question}
`;

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "Te vagy az Aqua Astræ Orákuluma. Fluat lux stellae in aqua mea." },
          { role: "user", content: prompt },
        ],
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error("OpenAI API hiba:", resp.status, data);
      return res.status(502).json({
        error: "OpenAI hívás sikertelen",
        status: resp.status,
        details: data?.error?.message || data,
      });
    }

    const interpretation = data?.choices?.[0]?.message?.content?.trim() || "(nincs válasz)";
    const usedTokens = data?.usage?.total_tokens || 400;
    const actualCost = estimateCost(usedTokens, model);

    // költség rögzítése (productionben: adatbázis)
    monthlyUsage.usdSpent += actualCost;

    return res.status(200).json({
      interpretation,
      modelUsed: model,
      tierUsed: chosenTier,
      costUSD: actualCost.toFixed(4),
      totalUSDThisMonth: monthlyUsage.usdSpent.toFixed(3),
    });
  } catch (err) {
    console.error("Oraculum hiba:", err);
    return res.status(500).json({ error: "Hiba az orákulum válasz generálásakor." });
  }
}
