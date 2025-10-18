import { useMemo, useState, useEffect } from "react";
import SpreadDiagram from "./components/SpreadDiagram";
import { motion } from "framer-motion";
import Image from "next/image";

/**
 * Aqua Astræ — Oraculum UI
 * - Tier-ek: 💧 Aqua Spark, 🌊 Lumen Flow, 🌕 Astral Depth
 * - Auto tier-választás kártyaszám alapján (felülírható)
 * - Kérdés + Kontextus mező, kártyák + reversed + kiesett kártyák
 * - /api/oraculum (v3) hívás
 */

const SPREADS = {
  freeform: {
    label: "Szabad (intuitív)",
    positions: [],
    help: {
      oneLiner:
        "Intuíció-vezérelt húzás — engedd, hogy a kezed válasszon, az elme csak figyel.",
      text:
        "Vegyél ki tetszőleges számú lapot (1–10). Írd be a kártyák nevét és jelöld, ha fejjel lefelé érkezett.",
      focus:
        "Keverés közben lélegezz lassan: belégzés négyig, kilégzés hatig; engedd, hogy a kérdés képpé sűrűsödjön.",
      layout:
        "Teríts spontán: körben vagy lágy sorban — ahogy az áramlás hív; jegyezd meg a felbukkanás sorrendjét.",
      image: null,
    },
  },
  one_card: {
    label: "Egykártyás üzenet",
    positions: [{ key: "p1", label: "Üzenet a napra" }],
    help: {
      oneLiner: "Egy koncentrált üzenet a jelen pillanat fókuszáról.",
      text:
        "Egy lap. Lélegezz mélyeket, majd húzz egyet. A lap az aznapi fókuszt jelöli.",
      focus:
        "Mondd csendben: „Mit üzen ma a csillagvíz?” és tartsd a kezed a pakli felett három lélegzetig.",
      layout:
        "Egy lapot helyezz középre, szívvonalad elé; a kártya közvetlenül neked szól.",
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
      oneLiner:
        "Három ponton átívelő történet: honnan jössz, merre állsz, hová tart az áramlás.",
      text:
        "Helyezd el a három lapot bal→jobb sorrendben. Bal: múlt vagy opció A, Közép: jelen/irány, Jobb: jövő vagy opció B.",
      focus:
        "Képzeld el a múlt–jelen–jövő hullámzását; ne választ erőltess, hanem irányt kérj.",
      layout:
        "Balról jobbra, enyhe félkörben (p1 → p2 → p3), hogy a történet folyhasson.",
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
      oneLiner: "Két part és a köztük áramló víz: a kapcsolat élő mezeje.",
      text:
        "Három lap háromszögben: fent az Én, bal lent a Te/Partner, jobb lent a Kapcsolat tere.",
      focus:
        "Lélegezz együtt a kapcsolat emlékével; ne a konfliktusra, hanem a közös pulzusra hangolódj.",
      layout:
        "Háromszög: p1 fent, p2 bal lent, p3 jobb lent; a tekinteted köröző mozgással járja be.",
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
      oneLiner:
        "A négy elem egyensúlya mutatja, hol áradj és hol terelj partot.",
      text:
        "Négy lap négy égtáj szerint. Jelöld, ha valamelyik fejjel lefelé érkezett — ez blokkra utalhat.",
      focus:
        "Érezd, ahogy a tested négy sarka a négy elemmel lélegzik; kérdezd: „Hol billen az egyensúly?”",
      layout:
        "Égtájak szerint: Észak–Víz (p1), Kelet–Levegő (p4), Dél–Tűz (p2), Nyugat–Föld (p3) — óramutató szerint körbejárva.",
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
      oneLiner: "A Hold ritmusa: vetés, növekedés, aratás, elengedés.",
      text:
        "Négy lap körben: újholdtól teliholdig. A körív mozgását kövesd a kirakásnál.",
      focus:
        "Hangolódj a légzés ciklusára és kérdezd: „Melyik fázisban vagyok most, és mi támogat?”",
      layout:
        "Körívben p1 → p2 → p3 → p4; újholdtól indulva óramutató szerint haladj.",
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
      oneLiner:
        "Átfogó térkép a helyzetről: gyökértől a kimenetig, belsőtől a külsőig.",
      text:
        "Rakd ki a klasszikus kereszt + személyoszlop elrendezést (1→10). Csatolhatsz képet az infó-blokkba.",
      focus:
        "Fogalmazd meg a kérdést egyetlen tiszta mondatban; lélegezz be higgadtan, ki hosszabban.",
      layout:
        "Sorrend: p1 és p2 keresztben, majd p3 (lent), p4 (bal), p5 (felül), p6 (jobb), ezután a személyoszlop p7→p10 alulról felfelé.",
      image: null,
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
      oneLiner:
        "Tükröt tart a rejtett részeknek — gyengéden, de őszintén.",
      text:
        "Fókuszált, önismereti kirakásra. Időt hagyj a lapokra, jegyzetelj.",
      focus:
        "Mondd: „Készen állok látni azt, ami eddig rejtve volt.” — és engedd feljönni az érzéseket ítélet nélkül.",
      layout:
        "Függőleges fonal: p1 alul (gyökér), p2 fölötte, p3 közép, p4 felette, p5 legfelül (összegző fény).",
      image: null,
    },
  },
};

// TIER-ek
const TIERS = [
  { value: "aqua_spark", label: "💧 Aqua Spark (Gyors)" },
  { value: "lumen_flow", label: "🌊 Lumen Flow (Kiegyensúlyozott)" },
  { value: "astral_depth", label: "🌕 Astral Depth (Mély)" },
];

function createEmptyPositions(spreadKey) {
  const pos = SPREADS[spreadKey]?.positions || [];
  return pos.map((p) => ({ key: p.key, label: p.label, name: "", reversed: false }));
}

export default function Oraculum() {
  const [spread, setSpread] = useState("three_card");
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState("");
  const [tier, setTier] = useState("aqua_spark");
  const [tierTouched, setTierTouched] = useState(false);

  const [jumpers, setJumpers] = useState("");
  const [freeCards, setFreeCards] = useState("Star,Fool,Moon");
  const [positions, setPositions] = useState(createEmptyPositions("three_card"));

  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState(null);
  const [err, setErr] = useState("");

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

  // Automatikus tier-választás a megadott kártyaszám alapján (felhasználó felülírhatja)
  useEffect(() => {
    // kártyaszám meghatározása
    let count = 0;
    if (spread === "freeform") {
      count = freeCards
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean).length;
    } else {
      count = positions.filter((p) => (p.name || "").trim()).length;
    }

    if (tierTouched) return; // ha a user már választott, nem írjuk felül

    let autoTier = "aqua_spark";
    if (count <= 1) autoTier = "aqua_spark";
    else if (count <= 4) autoTier = "lumen_flow";
    else autoTier = "astral_depth";

    setTier(autoTier);
  }, [positions, freeCards, spread, tierTouched]);

  async function submit() {
    setLoading(true);
    setErr("");
    setResp(null);

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
        .map((p) => ({
          name: p.name.trim(),
          reversed: !!p.reversed,
          positionKey: p.key,
          positionLabel: p.label,
        }));
    }

    if (cardsPayload.length === 0) {
      setErr("Adj meg legalább egy kártyát.");
      setLoading(false);
      return;
    }

    const effectiveQuestion =
      spread === "one_card" && !((question || "").trim())
        ? "Mit üzen az univerzum a mai napra?"
        : (question || "").trim();

    if (!effectiveQuestion) {
      setErr("Adj meg egy kérdést, vagy használd az egykártyás alapértelmezést.");
      setLoading(false);
      return;
    }

    const body = {
      cards: cardsPayload,
      question: effectiveQuestion,
      context: (context || "").trim(),
      spreadType: spread,
      tier,
      jumpers: jumpers.split(",").map((s) => s.trim()).filter(Boolean),
    };

    try {
      const r = await fetch("/api/oraculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const ct = r.headers.get("content-type") || "";
      const data = ct.includes("application/json") ? await r.json() : { error: await r.text() };

      if (!r.ok) throw new Error(data?.error || `Hiba (status ${r.status})`);
      setResp(data);
    } catch (e) {
      setErr(e.message || "Ismeretlen hiba");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="aa-container mt-8">
      {/* Banner + középre írt cím */}
      <div className="mb-6 relative w-full aspect-[3/1] rounded-2xl overflow-hidden shadow-sm">
        <Image src="/banner.jpg" alt="Aqua Astræ Banner" fill className="object-cover" priority />
        <div className="absolute inset-0 flex items-center justify-center">
          <h1 className="text-white text-3xl sm:text-4xl md:text-5xl font-[Cormorant_Garamond] tracking-wide drop-shadow-lg">
            Aqua Astræ — Oraculum
          </h1>
        </div>
      </div>

      {/* Spread selector + info */}
      <label className="mt-4 block text-sm">Húzás típusa</label>
      <select
        value={spread}
        onChange={(e) => onSpreadChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-300 p-2"
      >
        {Object.entries(SPREADS).map(([k, v]) => (
          <option key={k} value={k}>{v.label}</option>
        ))}
      </select>

      <div className="mt-4 rounded-2xl border border-gray-200 p-4 shadow-sm">
        <div className="font-semibold">{spreadDef.help.oneLiner}</div>
        <div className="mt-1">{spreadDef.help.text}</div>
        {spreadDef.help.focus && (
          <div className="mt-2 italic">💧 Keverés közben: {spreadDef.help.focus}</div>
        )}
        {spreadDef.help.layout && (
          <div className="mt-1">📜 Terítés: {spreadDef.help.layout}</div>
        )}
        {spreadDef.help.image && (
          <div className="mt-2">
            <img src={spreadDef.help.image} alt="spread-diagram" className="max-w-full" />
          </div>
        )}
        {spreadDef.positions?.length > 0 && (
          <div className="mt-3 text-sm">
            <strong>Pozíciók és sorrend:</strong>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5">
              {spreadDef.positions.map((p) => (
                <li key={p.key}>
                  {p.label} <span className="opacity-70">({p.key})</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* Vizuális diagram */}
      <SpreadDiagram spreadKey={spread} positions={spreadDef.positions} />

      {/* Tier kiválasztó */}
      <div className="mt-4">
        <label className="text-sm">Válasz szintje (Tier)</label>
        <select
          value={tier}
          onChange={(e) => { setTier(e.target.value); setTierTouched(true); }}
          className="mt-1 w-full rounded-lg border border-gray-300 p-2"
        >
          {TIERS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div className="mt-1 text-xs text-gray-500">
          Automatikusan választ a kártyaszám alapján (1 → 💧, 2–4 → 🌊, 5+ → 🌕), de bármikor átírhatod.
        </div>
      </div>

      {/* Question */}
      <div className="mt-4">
        <label className="text-sm">Kérdés</label>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Írd ide a kérdésed…"
          className="mt-1 w-full rounded-lg border border-gray-300 p-2"
        />
        {spread === "one_card" && !((question || "").trim()) ? (
          <div className="mt-1 text-xs text-gray-500">
            Egykártyásnál üresen is mehet — alapértelmezés: „Mit üzen az univerzum a mai napra?”
          </div>
        ) : null}
      </div>

      {/* Context */}
      <div className="mt-4">
        <label className="text-sm">Kontextus (opcionális)</label>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Rövid helyzetleírás: mi a háttér, mi történt eddig, milyen korlátok vannak…"
          className="mt-1 w-full rounded-lg border border-gray-300 p-2 min-h-[96px]"
        />
      </div>

      {/* Cards input section */}
      {spread === "freeform" ? (
        <div className="mt-4">
          <label className="text-sm">Kártyák (vesszővel)</label>
          <input
            value={freeCards}
            onChange={(e) => setFreeCards(e.target.value)}
            placeholder="Star,Fool,Moon"
            className="mt-1 w-full rounded-lg border border-gray-300 p-2"
          />
        </div>
      ) : (
        <div className="mt-4">
          <label className="text-sm">Kártyák pozíció szerint</label>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {positions.map((p, idx) => (
              <div key={p.key} className="rounded-xl border border-gray-200 p-3">
                <div className="mb-1 text-xs opacity-80">{p.label}</div>
                <input
                  value={p.name}
                  onChange={(e) => handlePosChange(idx, "name", e.target.value)}
                  placeholder="pl. The Star"
                  className="w-full rounded-lg border border-gray-300 p-2"
                />
                <label className="mt-3 flex flex-col items-center text-sm text-sky-900">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-sky-700"
                    checked={!!p.reversed}
                    onChange={(e) => handlePosChange(idx, "reversed", e.target.checked)}
                  />
                  <span className="mt-1 leading-tight text-center">Reversed</span>
                  <span className="opacity-60 leading-tight text-center">(fejjel lefelé)</span>
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Jumpers */}
      <div className="mt-4">
        <label className="text-sm">Kiesett kártyák (opcionális, vesszővel)</label>
        <input
          value={jumpers}
          onChange={(e) => setJumpers(e.target.value)}
          placeholder="Ha keverés közben esett ki lap: pl. Tower,Star"
          className="mt-1 w-full rounded-lg border border-gray-300 p-2"
        />
      </div>

      {/* Submit */}
      <button
        onClick={submit}
        disabled={loading}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-sky-700 hover:bg-sky-800 transition text-white px-4 py-2 font-semibold shadow-sm disabled:opacity-60"
      >
        {loading && (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        )}
        {loading ? "Kérdezek…" : "Kérdezek"}
      </button>

      {/* 💧 Motion aura (loading közben) */}
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="mt-4 text-center text-sky-700 italic"
        >
          Várjá csaje, varázsolok…
        </motion.div>
      )}

      {/* Error toast */}
      {err && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">
          <strong>Hiba:</strong> {err}
        </div>
      )}

      {/* Output */}
      {resp && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mt-6 rounded-2xl border border-gray-200 p-4 shadow-sm"
        >
          <h3 className="text-xl font-semibold">Eredmény</h3>
          <pre className="mt-2 whitespace-pre-wrap font-mono text-sm">
            {resp.interpretation}
          </pre>
          <div className="mt-2 text-xs opacity-80">
            {resp.modelUsed ? <>Modell: {resp.modelUsed} | </> : null}
            {resp.tierUsed ? <>Tier: {resp.tierUsed} | </> : null}
            {typeof resp.tokens === "number" ? <>Tokenek: {resp.tokens} | </> : null}
            {typeof resp.costUSD === "number" ? <>Költség: ${resp.costUSD?.toFixed?.(4)}</> : null}
          </div>
        </motion.div>
      )}
    </div>
  );
}
