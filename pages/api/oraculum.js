// pages/api/oraculum.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { cards, question } = req.body || {};
  if (!Array.isArray(cards) || !question) {
    return res.status(400).json({ error: 'Invalid payload: { cards: string[], question: string } required' });
  }

  if (!process.env.OPENAI_API_KEY) {
    // Ne bukjon buildkor – ez futásidőben ellenőriz.
    return res.status(500).json({ error: 'Server misconfig: missing OPENAI_API_KEY' });
  }

  // Csak itt importáljuk, hogy ne menjen kliens bundle-be.
  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Itt jöhet a saját promptod – most egy "ping" válasz a gyors füstteszthez:
  return res.status(200).json({
    oracle: 'Aqua Astræ / Oraculum online',
    echo: { cards, question }
  });
}

