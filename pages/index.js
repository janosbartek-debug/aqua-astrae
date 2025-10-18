// pages/index.js
import { useState } from "react";

export default function Home() {
  const [cards, setCards] = useState("");
  const [question, setQuestion] = useState("");
  const [tier, setTier] = useState("general"); // "general" | "deep"
  const [answer, setAnswer] = useState("");

  async function handleAsk() {
    setAnswer("Kérem, várj…");
    const res = await fetch("/api/oraculum", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cards: cards.split(",").map(c => c.trim()).filter(Boolean),
        question,
        tier, // <-- elküldjük a választott szintet
      }),
    });
    const data = await res.json();
    setAnswer(
      data.interpretation
        ? `${data.interpretation}\n\n— modell: ${data.modelUsed || "ismeretlen"}`
        : data.details || data.error || "Ismeretlen hiba."
    );
  }

  return (
    <main style={{ padding: 20, maxWidth: 720, margin: "0 auto" }}>
      <h1>Aqua Astræ — Oraculum</h1>

      <label style={{ display: "block", marginTop: 12 }}>Kártyák (vesszővel):</label>
      <input
        value={cards}
        onChange={e => setCards(e.target.value)}
        placeholder="Star,Fool,Moon"
        style={{ width: "100%", padding: 8 }}
      />

      <label style={{ display: "block", marginTop: 12 }}>Kérdés:</label>
      <input
        value={question}
        onChange={e => setQuestion(e.target.value)}
        placeholder="Mi az első lépés?"
        style={{ width: "100%", padding: 8 }}
      />

      <label style={{ display: "block", marginTop: 12 }}>Olvasás típusa:</label>
      <select
        value={tier}
        onChange={e => setTier(e.target.value)}
        style={{ width: "100%", padding: 8 }}
      >
        <option value="general">Általános értelmezés (olcsóbb, gyorsabb)</option>
        <option value="deep">Mélyebb jóslás (szebb, drágább)</option>
      </select>

      <button onClick={handleAsk} style={{ marginTop: 16, padding: "8px 16px" }}>
        Kérdezek
      </button>

      {answer && (
        <pre style={{ whiteSpace: "pre-wrap", marginTop: 20 }}>{answer}</pre>
      )}
    </main>
  );
}
