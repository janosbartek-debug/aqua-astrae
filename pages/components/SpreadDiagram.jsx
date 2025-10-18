// components/SpreadDiagram.jsx
import React, { useMemo } from "react";

/**
 * SpreadDiagram — egyszerű SVG alapú elrendezés-rajzoló
 * - Nem igényel külső libet.
 * - Alap elrendezések: one_card, three_card, relationship, elements, moon,
 *   celtic_cross, shadow, freeform.
 * - Pozíciók sorrendjét nyilak mutatják.
 */

const W = 900;
const H = 520;
const R = 24; // "kártya-csomópont" sugarú jelölő
const FONT = { label: 12, index: 12 };

// Segédfüggvény: polár koordinátákból x,y
function polar(cx, cy, radius, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

// Előre definiált elrendezések (0..1 normalizált koordináták W×H-re vetítve)
const LAYOUTS = {
  one_card: (n) => [
    { key: "p1", x: 0.5, y: 0.5 },
  ],
  three_card: (n) => [
    { key: "p1", x: 0.2, y: 0.55 },
    { key: "p2", x: 0.5, y: 0.45 },
    { key: "p3", x: 0.8, y: 0.55 },
  ],
  relationship: (n) => [
    { key: "p1", x: 0.5, y: 0.18 }, // Én (fent)
    { key: "p2", x: 0.22, y: 0.72 }, // Te (bal lent)
    { key: "p3", x: 0.78, y: 0.72 }, // Kapcsolat (jobb lent)
  ],
  elements: (n) => [
    { key: "p1", x: 0.5, y: 0.15 }, // Víz — Észak
    { key: "p2", x: 0.8, y: 0.5 },  // Tűz — Dél (vizuálisan jobb)
    { key: "p3", x: 0.2, y: 0.5 },  // Föld — Nyugat (vizuálisan bal)
    { key: "p4", x: 0.5, y: 0.85 }, // Levegő — Kelet (vizuálisan lent)
  ],
  moon: (n) => {
    const cx = 0.5, cy = 0.5, r = 0.32;
    // Újhold (p1) → Első negyed (p2) → Telihold (p3) → Utolsó negyed (p4)
    // óramutató szerint
    const degs = [270, 0, 90, 180];
    return degs.map((deg, i) => {
      const { x, y } = polar(cx, cy, r, deg);
      return { key: `p${i + 1}`, x, y };
    });
  },
  celtic_cross: (n) => [
    // Kereszt (1–6)
    { key: "p1", x: 0.4, y: 0.5 },  // Jelen
    { key: "p2", x: 0.4, y: 0.5 - 0.12 }, // Kihívás (átlós overlayt nyíl jelzi, de pontot is adunk)
    { key: "p3", x: 0.4, y: 0.75 }, // Tudat alatti (lent)
    { key: "p4", x: 0.18, y: 0.5 }, // Múlt (bal)
    { key: "p5", x: 0.4, y: 0.25 }, // Tudatos/cél (felül)
    { key: "p6", x: 0.62, y: 0.5 }, // Közeljövő (jobb)
    // Személyoszlop (7–10)
    { key: "p7", x: 0.78, y: 0.7 },
    { key: "p8", x: 0.78, y: 0.55 },
    { key: "p9", x: 0.78, y: 0.4 },
    { key: "p10", x: 0.78, y: 0.25 },
  ],
  shadow: (n) => [
    { key: "p1", x: 0.5, y: 0.75 },
    { key: "p2", x: 0.5, y: 0.6 },
    { key: "p3", x: 0.5, y: 0.45 },
    { key: "p4", x: 0.5, y: 0.3 },
    { key: "p5", x: 0.5, y: 0.15 },
  ],
  freeform: (n) => {
    // Szabadság: körív mentén egyenletesen (ha nincs positions array, n lehet 5-8 default)
    const count = Math.max(1, n || 6);
    const cx = 0.5, cy = 0.5, r = 0.32;
    return Array.from({ length: count }).map((_, i) => {
      const deg = 360 * (i / count) - 90;
      const { x, y } = polar(cx, cy, r, deg);
      return { key: `f${i + 1}`, x, y };
    });
  },
};

// Nyíl-rajzolás segéd (egyszerű vonal + háromszög fej)
function Arrow({ x1, y1, x2, y2 }) {
  // lerövidítés, hogy a körök széléhez csatlakozzon
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / len, uy = dy / len;
  const sx1 = x1 + ux * R * 0.8;
  const sy1 = y1 + uy * R * 0.8;
  const ex = x2 - ux * R * 0.8;
  const ey = y2 - uy * R * 0.8;

  // nyílfej
  const ah = 10, aw = 6;
  const leftX = ex - ux * ah - uy * aw;
  const leftY = ey - uy * ah + ux * aw;
  const rightX = ex - ux * ah + uy * aw;
  const rightY = ey - uy * ah - ux * aw;

  return (
    <g>
      <line x1={sx1} y1={sy1} x2={ex} y2={ey} stroke="currentColor" strokeWidth="2" opacity="0.7" />
      <polygon points={`${ex},${ey} ${leftX},${leftY} ${rightX},${rightY}`} fill="currentColor" opacity="0.7" />
    </g>
  );
}

function Node({ x, y, index, label }) {
  return (
    <g>
      <circle cx={x} cy={y} r={R} fill="white" stroke="currentColor" strokeWidth="2" />
      <text x={x} y={y + 4} textAnchor="middle" fontSize={FONT.index} fontFamily="serif">{index}</text>
      {label ? (
        <text
          x={x}
          y={y + R + 16}
          textAnchor="middle"
          fontSize={FONT.label}
          fontFamily="serif"
          opacity="0.9"
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}

export default function SpreadDiagram({ spreadKey, positions }) {
  const pts = useMemo(() => {
    const n = positions?.length || 0;
    const maker = LAYOUTS[spreadKey] || LAYOUTS.freeform;
    const raw = maker(n);
    // skálázás W×H-re
    return raw.map((p) => ({
      key: p.key,
      x: Math.round(p.x * W),
      y: Math.round(p.y * H),
    }));
  }, [spreadKey, positions]);

  const nodes = useMemo(() => {
    // index + címke összeillesztése a megadott positions tömbből (ha van)
    const labelsByKey = new Map((positions || []).map((p) => [p.key, p.label]));
    return pts.map((p, i) => ({
      ...p,
      index: i + 1,
      label: labelsByKey.get(p.key) || p.key,
    }));
  }, [pts, positions]);

  if (!nodes.length) {
    return (
      <div style={{ padding: 12, border: "1px dashed #bbb", borderRadius: 8, fontStyle: "italic" }}>
        Nincs definiált pozíció ehhez a húzáshoz — szabad, intuitív terítés. Helyezd el a lapokat körben vagy lágy sorban.
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 12, marginTop: 8 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Terítés-diagram</div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{ color: "#333" }}>
        {/* háttér finom rács */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#eee" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x="0" y="0" width={W} height={H} fill="url(#grid)" />

        {/* sorrend-nyilak */}
        {nodes.map((n, i) => {
          const next = nodes[i + 1];
          if (!next) return null;
          return <Arrow key={`a${n.key}`} x1={n.x} y1={n.y} x2={next.x} y2={next.y} />;
        })}

        {/* csomópontok */}
        {nodes.map((n) => (
          <Node key={n.key} x={n.x} y={n.y} index={n.index} label={n.label} />
        ))}
      </svg>

      <div style={{ fontSize: 12, opacity: 0.8, marginTop: 8 }}>
        Tipp: a nyilak a kirakás <em>sorrendjét</em> jelzik (1 → 2 → …). A kártyák tényleges mérete és dőlése a fizikai terítés során tőled függ.
      </div>
    </div>
  );
}
