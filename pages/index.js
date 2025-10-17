import { useState } from "react";

export default function Home() {
  const [cards, setCards] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(""); setAnswer(""); setLoading(true);
    try {
      const res = await fetch("/api/oraculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cards: cards.split(",").map(s => s.trim()).filter(Boolean),
          question,
        }),
      });
      const data = await res.json();
      if (!res.ok) setErr(data?.error || "Ismeretlen hiba.");
      else setAnswer(data.interpretation);
    } catch {
      setErr("Hálózati vagy szerver hiba.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{
      minHeight: "100vh", background: "#1E2B3A", color: "#F9FAFB",
      fontFamily: "Georgia, 'Times New Roman', serif", padding: "2rem"
    }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <header style={{ marginBottom: "2rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🔮 Aqua Astræ Oraculum</h1>
          <p style={{ opacity: 0.9 }}>
            <em>Fluat lux stellæ in aqua mea.</em> — Áradjon a csillag fénye vizembe.
          </p>
        </header>

        <form onSubmit={handleSubmit} style={{
          background: "#223244", padding: "1.25rem", borderRadius: 16,
          boxShadow: "0 0 24px rgba(138,211,230,0.15)"
        }}>
          <label style={{ display: "block", marginBottom: 8 }}>
            Kártyák (vesszővel – pl. <code>The Star, Queen of Cups, Two of Swords</code>)
          </label>
          <input
            value={cards} onChange={e => setCards(e.target.value)}
            placeholder="The Star, Queen of Cups, Two of Swords"
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 10,
              border: "1px solid #8AD3E6", marginBottom: 16, background: "#1E2B3A", color: "#F9FAFB"
            }}
          />
          <label style={{ display: "block", marginBottom: 8 }}>Kérdés</label>
          <textarea
            value={question} onChange={e => setQuestion(e.target.value)} rows={4}
            placeholder="Miről szeretnéd hallani az Orákulum üzenetét?"
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 10,
              border: "1px solid #8AD3E6", marginBottom: 16, background: "#1E2B3A", color: "#F9FAFB"
            }}
          />
          <button type="submit" disabled={loading} style={{
            background: "#8AD3E6", color: "#1E2B3A", fontWeight: 700,
            border: "none", padding: "10px 16px", borderRadius: 12, cursor: "pointer"
          }}>
            {loading ? "Értelmezés készül..." : "Értelmezést kérek"}
          </button>
        </form>

        {err && (
          <div style={{ marginTop: 16, padding: 12, borderRadius: 10,
            background: "#3a2430", border: "1px solid #e38" }}>
            ⚠️ {err}
          </div>
        )}
        {answer && (
          <section style={{
            marginTop: 24, background: "#223244", padding: 16, borderRadius: 16,
            boxShadow: "0 0 24px rgba(138,211,230,0.15)", whiteSpace: "pre-wrap"
          }}>
            <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: "1.25rem" }}>✨ Üzenet</h2>
            {answer}
          </section>
        )}
      </div>
    </main>
  );
}
