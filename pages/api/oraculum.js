import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { cards, question } = req.body || {};
    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({ error: "Hiányzó vagy hibás 'cards' mező." });
    }
    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "Hiányzó vagy hibás 'question' mező." });
    }

    const systemPrompt = `
You are Oraculum Aquae Astræ, the voice of the Star Water (nőies–víz–intuíció).
Tarot-értelmezést adsz magyarul, lágy, misztikus, de gyakorlatias hangon.
Adj: 1) rövid összefoglaló, 2) 3 kulcs-értelmezés, 3) 3 gyakorlati lépés (víz-elem fókusz).
`;

    const userPrompt = `Kérdés: \${question}\nKártyák: \${cards.join(", ")}\nKérlek az értelmezést most add meg.\`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
    });

    const content = completion.choices?.[0]?.message?.content || "";
    return res.status(200).json({ interpretation: content });
  } catch (err) {
    console.error("Oraculum API error:", err);
    return res.status(500).json({ error: "Szerverhiba az értelmezés során." });
  }
}
