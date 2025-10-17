import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Csak POST metódus engedélyezett." });
  }

  const { cards, question } = req.body;

  if (!cards || !question) {
    return res.status(400).json({ error: "Hiányzó kártyák vagy kérdés." });
  }

  try {
    const prompt = `
Te vagy az Aqua Astræ orákuluma. Magyarul válaszolj.
Kártyák: ${cards.join(", ")}.
Kérdés: ${question}.
Adj rövid összefoglalót, három kulcsértelmezést és három gyakorlati víz-elemű tanácsot.
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Te vagy az Aqua Astræ Orákuluma." },
        { role: "user", content: prompt },
      ],
    });

    const interpretation = completion.choices[0].message.content;
    res.status(200).json({ interpretation });
  } catch (err) {
    console.error("Oraculum hiba:", err);
    res.status(500).json({ error: "Hiba az orákulum válasz generálásakor." });
  }
}

