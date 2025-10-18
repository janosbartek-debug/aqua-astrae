// pages/api/oraculum.js
export default async function handler(req, res) {
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

  // Szerveroldali whitelist — a kliens nem kényszeríthet drága modellt
  const TIER_TO_MODEL = {
    general: "gpt-4o-mini",
    deep: "gpt-4o",
  };
  const chosenTier = tier === "deep" ? "deep" : "general";
  const model = TIER_TO_MODEL[chosenTier];

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
        ...(process.env.OPENAI_ORG_ID ? { "OpenAI-Organization": process.env.OPENAI_ORG_ID } : {}),
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

    const interpretation = data?.choices?.[0]?.message?.content?.trim();
    return res.status(200).json({ interpretation, modelUsed: model, tierUsed: chosenTier });
  } catch (err) {
    console.error("Oraculum hiba:", err);
    return res.status(500).json({ error: "Hiba az orákulum válasz generálásakor." });
  }
}
