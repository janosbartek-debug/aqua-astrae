import { useMemo, useState } from "react";

/**
 * Aqua Astræ — Oraculum UI (dynamic spreads + reversed + jumpers)
 * Single-file MVP for Next.js pages/ router → pages/index.js
 * - Spread selection shows instructions + optional image
 * - Dynamic card slots per spread with Reversed checkbox
 * - Extra text input for "kiesett kártyák" (jumpers)
 * - Builds request body expected by /api/oraculum (v2)
 */

// --- 1) Spread config (can be extracted to /lib/spreads.js later)
const SPREADS = {
  freeform: {
    label: "Szabad (intuitív)",
    positions: [],
    help: {
      text:
        "Vegyél ki tetszőleges számú lapot (1–10). Írd be a kártyák nevét és jelöld, ha fejjel lefelé érkezett.",
      image: null,
    },
  },
  one_card: {
    label: "Egykártyás üzenet",
    positions: [
      { key: "p1", label: "Üzenet a napra" },
    ],
    help: {
      text:
        "Egy lap. Lélegezz mélyeket, majd húzz egyet. A lap az aznapi fókuszt jelöli.",
      image: null,
    },
  },
  three_card: {
    label: "Háromkártyás (múlt–jelen–jövő / döntési mérleg)",
    positions: [
      { key: "p1", label: "Múlt / Opció A" },
      { key: "p2", label: "Jelen / Köztes tanács" },
      { key: "p3", label: "Jövő / Opció B" },
    ],
    help: {
      text:
        "Helyezd el a három lapot bal→jobb sorrendben. Bal: múlt vagy opció A, Közép: jelen/irány, Jobb: jövő vagy opció B.",
      image: null,
    },
  },
  relationship: {
    label: "Kapcsolati háromszög (én–te–kapcsolat)",
    positions: [
      { key: "p1", label: "Én" },
      { key: "p2", label: "Te/Partner" },
      { key: "p3", label: "Kapcsolat/mező" },
    ],
    help: {
      text:
        "Három lap háromszögben: fent az Én, bal lent a Te/Partner, jobb lent a Kapcsolat tere.",
      image: null,
    },
  },
  elements: {
    label: "Elem-harmonizáló (víz–tűz–föld–levegő)",
    positions: [
      { key: "p1", label: "Víz (érzelem)" },
      { key: "p2", label: "Tűz (akarat)" },
      { key: "p3", label: "Föld (stabilitás)" },
      { key: "p4", label: "Levegő (gondolat)" },
    ],
    help: {
      text:
        "Négy lap négy égtáj szerint. Jelöld, ha valamelyik fejjel lefelé érkezett — ez blokkra utalhat.",
      image: null,
    },
  },
  moon: {
    label: "Holdút / ciklikus",
    positions: [
      { key: "p1", label: "Újhold – szándék" },
      { key: "p2", label: "Első negyed – lépés" },
      { key: "p3", label: "Telihold – csúcspont" },
      { key: "p4", label: "Utolsó negyed – elengedés" },
    ],
    help: {
      text:
        "Négy lap körben: újholdtól teliholdig. A körív mozgását kövesd a kirakásnál.",
      image: null,
    },
  },
  celtic_cross: {
    label: "Kelta kereszt (10 lap)",
    positions: [
      { key: "p1", label: "Kereszt – Jelen helyzet" },
      { key: "p2", label: "Kereszt – Kihívás" },
      { key: "p3", label: "Tudat alatti" },
      { key: "p4", label: "Múlt" },
      { key: "p5", label: "Tudatos/cél" },
      { key: "p6", label: "Közeljövő" },
      { key: "p7", label: "Saját hozzáállás" },
      { key: "p8", label: "Külső hatások" },
      { key: "p9", label: "Remények/félelmek" },
      { key: "p10", label: "Kimenet" },
    ],
    help: {
      text:
        "Rakd ki a klasszikus kereszt + személyoszlop elrendezést (1→10). Csatolhatsz képet az infó-blokkba.",
      image: null, // pl. "/spreads/celtic-cross.png"
    },
  },
  shadow: {
    label: "Árnyékmunka",
    positions: [
      { key: "p1", label: "Árnyék-gyökér" },
      { key: "p2", label: "Maszk/Persona" },
      { key: "p3", label: "Kiváltó helyzet" },
      { key: "p4", label: "Tanulás/Fény" },
      { key: "p5", label: "Integráció" },
    ],
    help: {
      text:
        "Fókuszált, önismereti kirakásra. Időt hagyj a lapokra, jegyzetelj.",
      image: null,
    },
  },
};

const FOCUS = [
  { value: "pszichológiai", label: "Pszichológiai" },
  { value: "mágikus", label: "Mágikus" },
  { value: "energetikai", label: "Energetikai" },
  { value: "pragmatikus", label: "Pragmatikus" },
];
const TONE = [
  { value: "empatikus", label: "Empatikus" },
  { value: "rituális", label: "Rituális" },
  { value: "coaching", label: "Coaching" },
];
const DEPTH = [
  { value: "rövid", label: "Rövid" },
  { value: "közepes", label: "Közepes" },
  { value: "mély", label: "Mély" },
];

// --- 2) Simple helper: create empty positional state for selected spread
function createEmptyPositions(spreadKey) {
  const pos = SPREADS[spreadKey]?.positions || [];
  return pos.map((p) => ({ key: p.key, label: p.label, name: "", reversed: false }));
}

export default function Oraculum() {
  const [spread, setSpread] = useState("three_card");
  const [question, setQuestion] = useState("Mi az első lépés?");
  const [focus, setFocus] = useState("pszichológiai");
  const [tone, setTone] = useState("empatikus");
  const [depth, setDepth] = useState("közepes");
  const [jumpers, setJumpers] = useState(""); // kiesett kártyák, vesszővel
  const [freeCards, setFreeCards] = useState("Star,Fool,Moon"); // used only in freeform
  const [positions, setPositions] = useState(createEmptyPositions("three_card"));

  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState(null);
  const [err, setErr] = useState("");

  // When spread changes, reset positions
  function onSpreadChange(next) {
    setSpread(next);
    setPositions(createEmptyPositions(next));
  }

  const spreadDef = useMemo(() => SPREADS[spread], [spread]);

  function handlePosChange(idx, field, value) {
    setPositions((old) => {
      const cp = [...old];
      cp[idx] = { ...cp[idx], [field]: value };
      return cp;
    });
  }

  async function submit() {
    setLoading(true);
    setErr("");
    setResp(null);

    // Build cards payload
    let cardsPayload = [];
    if (spread === "freeform") {
      cardsPayload = freeCards
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name, i) => ({ name, reversed: false, positionKey: `f${i + 1}` }));
    } else {
      cardsPayload = positions
        .filter((p) => p.name && p.name.trim())
        .map((p) => ({ name: p.name.trim(), reversed: !!p.reversed, positionKey: p.key }));
    }

    if (cardsPayload.length === 0) {
      setErr("Adj meg legalább egy kártyát.");
      setLoading(false);
      return;
    }

    const body = {
      cards: cardsPayload, // v2: array of objects
      question,
      spreadType: spread,
      readingFocus: focus,
      tone,
      depth,
      jumpers: jumpers
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    try {
      const r = await fetch("/api/oraculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || `Hiba (status ${r.status})`);
      setResp(data);
    } catch (e) {
      setErr(e.message || "Ismeretlen hiba");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 920, margin: "40px auto", fontFamily: "serif" }}>
      <h1>Aqua Astræ — Oraculum</h1>

      {/* Spread selector + info */}
      <label>Húzás típusa</label>
      <select
        value={spread}
        onChange={(e) => onSpreadChange(e.target.value)}
        style={{ width: "100%", padding: 8, margin: "6px 0 12px" }}
      >
        {Object.entries(SPREADS).map(([k, v]) => (
          <option key={k} value={k}>{v.label}</option>
        ))}
      </select>

      <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginBottom: 16 }}>
        <strong>Instrukció:</strong>
        <div style={{ marginTop: 6 }}>{spreadDef.help.text}</div>
        {spreadDef.help.image && (
          <div style={{ marginTop: 10 }}>
            <img src={spreadDef.help.image} alt="spread-diagram" style={{ maxWidth: "100%" }} />
          </div>
        )}
      </div>

      {/* Focus/Tone/Depth */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <div>
          <label>Fókusz</label>
          <select value={focus} onChange={(e) => setFocus(e.target.value)} style={{ width: "100%", padding: 8, marginTop: 6 }}>
            {FOCUS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Hang</label>
          <select value={tone} onChange={(e) => setTone(e.target.value)} style={{ width: "100%", padding: 8, marginTop: 6 }}>
            {TONE.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Mélység</label>
          <select value={depth} onChange={(e) => setDepth(e.target.value)} style={{ width: "100%", padding: 8, marginTop: 6 }}>
            {DEPTH.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Question */}
      <div style={{ marginTop: 16 }}>
        <label>Kérdés</label>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Mi az első lépés?"
          style={{ width: "100%", padding: 8, marginTop: 6 }}
        />
      </div>

      {/* Cards input section */}
      {spread === "freeform" ? (
        <div style={{ marginTop: 16 }}>
          <label>Kártyák (vesszővel)</label>
          <input
            value={freeCards}
            onChange={(e) => setFreeCards(e.target.value)}
            placeholder="Star,Fool,Moon"
            style={{ width: "100%", padding: 8, marginTop: 6 }}
          />
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          <label>Kártyák pozíció szerint</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginTop: 8 }}>
            {positions.map((p, idx) => (
              <div key={p.key} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>{p.label}</div>
                <input
                  value={p.name}
                  onChange={(e) => handlePosChange(idx, "name", e.target.value)}
                  placeholder="pl. The Star"
                  style={{ width: "100%", padding: 8 }}
                />
                <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                  <input
                    type="checkbox"
                    checked={!!p.reversed}
                    onChange={(e) => handlePosChange(idx, "reversed", e.target.checked)}
                  />
                  Reversed (fejjel lefelé)
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Jumpers */}
      <div style={{ marginTop: 16 }}>
        <label>Kiesett kártyák (opcionális, vesszővel)</label>
        <input
          value={jumpers}
          onChange={(e) => setJumpers(e.target.value)}
          placeholder="Ha keverés közben esett ki lap: pl. Tower,Star"
          style={{ width: "100%", padding: 8, marginTop: 6 }}
        />
      </div>

      {/* Submit */}
      <button onClick={submit} disabled={loading} style={{ marginTop: 18, padding: "10px 16px" }}>
        {loading ? "Kérdezek…" : "Kérdezek"}
      </button>

      {/* Output */}
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
            Modell: {resp.modelUsed} | Tier: {resp.tierUsed} | Tokenek: {resp.tokens} | Költség: ${'{'}resp.costUSD{'}'} | Havi összes: ${'{'}resp.totalUSDThisMonth{'}'}
          </div>
        </div>
      )}
    </div>
  );
}
