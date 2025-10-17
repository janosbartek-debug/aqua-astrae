// pages/api/oraculum.js
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Csak POST metódus engedélyezett." });
  }

  const { cards, question } = req.body || {};
  if (!Array.isArray(cards) || !question) {
    return res.status(400).json({ error: "Hiányzó kártyák vagy kérdés." });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "Hiányzó OPENAI_API_KEY a környezetben." });
  }

  try {
    const prompt = `
Te vagy az Aqua Astræ Orákuluma. Magyarul válaszolj.
Szerkezet: 1) rövid összefoglaló, 2) 3 kulcs-értelmezés (•), 3) 3 gyakorlati lépés (•, víz-elem fókusz).
Kártyák: ${cards.join(", ")}
Kérdés: ${question}
`;

    // Modell-fallback: ha az első nem elérhető, próbáld a másodikat.
    const modelCandidates = ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo-0125"];
    let lastErr;
    for (const model of modelCandidates) {
      try {
        const completion = await client.chat.completions.create({
          model,
          messages: [
            { role: "system", content: "Te vagy az Aqua Astræ Orákuluma. Fluat lux stellae in aqua mea." },
            { role: "user", content: prompt },
          ],
        });
        const interpretation = completion.choices?.[0]?.message?.content?.trim();
        if (interpretation) {
          return res.status(200).json({ interpretation, modelUsed: model });
        }
      } catch (e) {
        lastErr = e;
      }
    }

    console.error("OpenAI hívás sikertelen:", lastErr?.message || lastErr);
    return res.status(502).json({ error: "OpenAI hívás sikertelen (modell/engedély). Nézd meg a Function logokat." });
  } catch (err) {
    console.error("Oraculum hiba:", err);
    return res.status(500).json({ error: "Hiba az orákulum válasz generálásakor." });
  }
}


