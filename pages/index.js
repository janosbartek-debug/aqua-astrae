import { useState } from "react";

export default function Home() {
  const [cards, setCards] = useState("Star,Fool,Moon");
  const [question, setQuestion] = useState("Mi az első lépés?");
  const [spreadType, setSpreadType] = useState("freeform");
  const [readingFocus, setReadingFocus] = useState("pszichológiai");
  const [tone, setTone] = useState("empatikus");
  const [depth, setDepth] = useState("közepes"); // vagy használd a tier-t közvetlenül
  const [tier, setTier] = useState(""); // "", "general", "medium", "deep" — opcionális override

  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState(null);
  const [err, setErr] = useState("");

  async function ask() {
    setLoading(true);
    setErr("");
    setResp(null);
    try {
      const body = {
        cards: cards.split(",").map((s) => s.trim()).filter(Boolean),
        question,
        spreadType,
        readingFocus,
        tone,
        depth,
      };
      if (tier) body.tier = tier;

      const r = await fetch("/api/oraculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) {
        setErr(`${data?.error || "Hiba"} (status: ${r.status})`);
      } else {
        setResp(data);
      }
    } catch (e) {
      setErr(e.message || "Ismeretlen hiba");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 780, margin: "40px auto", fontFamily: "serif" }}>
      <h1>Aqua Astræ — Oraculum</h1>

      <label>Kártyák (vesszővel):</label>
      <input
        value={cards}
        onChange={(e) => setCards(e.target.value)}
        placeholder="Star,Fool,Moon"
        style={{ width: "100%", padding: 8, margin: "6px 0 16px" }}
      />

      <label>Kérdés:</label>
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Mi az első lépés?"
        style={{ width: "100%", padding: 8, margin: "6px 0 16px" }}
      />

      <label>Húzás típusa (spreadType):</label>
      <select value={spreadType} onChange={(e) => setSpreadType(e.target.value)} style={{ width: "100%", padding: 8, margin: "6px 0 16px" }}>
        <option value="freeform">Szabad (intuitív)</option>
        <option value="one_card">Egykártyás</option>
        <option value="three_card">Háromkártyás (múlt–jelen–jövő / döntési mérleg)</option>
        <option value="relationship">Kapcsolati háromszög</option>
        <option value="elements">Elem-harmonizáló</option>
        <option value="moon">Holdút / ciklikus</option>
        <option value="celtic_cross">Kelta kereszt (10 lap)</option>
        <option value="shadow">Árnyékmunka</option>
      </select>

      <label>Fókusz (readingFocus):</label>
      <select value={readingFocus} onChange={(e) => setReadingFocus(e.target.value)} style={{ width: "100%", padding: 8, margin: "6px 0 16px" }}>
        <option value="pszichológiai">Pszichológiai</option>
        <option value="mágikus">Mágikus</option>
        <option value="energetikai">Energetikai</option>
        <option value="pragmatikus">Pragmatikus</option>
      </select>

      <label>Hang (tone):</label>
      <select value={tone} onChange={(e) => setTone(e.target.value)} style={{ width: "100%", padding: 8, margin: "6px 0 16px" }}>
        <option value="empatikus">Empatikus</option>
        <option value="rituális">Rituális</option>
        <option value="coaching">Coaching</option>
      </select>

      <label>Mélység (depth):</label>
      <select value={depth} onChange={(e) => setDepth(e.target.value)} style={{ width: "100%", padding: 8, margin: "6px 0 16px" }}>
        <option value="rövid">Rövid</option>
        <option value="közepes">Közepes</option>
        <option value="mély">Mély</option>
      </select>

      <details style={{ marginBottom: 16 }}>
        <summary>Haladó: Tier override (opcionális)</summary>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={() => setTier("")}>Auto</button>
          <button onClick={() => setTier("general")}>General</button>
          <button onClick={() => setTier("medium")}>Medium</button>
          <button onClick={() => setTier("deep")}>Deep</button>
        </div>
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>Aktuális tier: {tier || "auto"}</div>
      </details>

      <button onClick={ask} disabled={loading} style={{ padding: "8px 14px" }}>
        {loading ? "Kérdezek…" : "Kérdezek"}
      </button>

      {err && (
        <div style={{ marginTop: 16, color: "crimson" }}>
          <strong>Hiba:</strong> {err}
        </div>
      )}

      {resp && (
        <div style={{ marginTop: 24 }}>
          <h3>Eredmény</h3>
          <pre style={{ whiteSpace: "pre-wrap" }}>{resp.interpretation}</pre>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 8 }}>
            Modell: {resp.modelUsed} | Tier: {resp.tierUsed} | Tokenek: {resp.tokens} | Költség: ${resp.costUSD} | Havi összes: ${resp.totalUSDThisMonth}
          </div>
        </div>
      )}
    </div>
  );
}
