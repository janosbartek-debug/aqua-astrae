import { useState } from 'react';

export default function Home() {
  const [cards, setCards] = useState('Star,Fool');
  const [question, setQuestion] = useState('Mi az első lépés?');
  const [out, setOut] = useState('');

  async function ask() {
    const r = await fetch('/api/oraculum', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cards: cards.split(',').map(s => s.trim()), question })
    });
    const j = await r.json();
    setOut(JSON.stringify(j, null, 2));
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Aqua Astræ — Oraculum</h1>
      <p>Kártyák (vesszővel):</p>
      <input value={cards} onChange={e => setCards(e.target.value)} />
      <p>Kérdés:</p>
      <input value={question} onChange={e => setQuestion(e.target.value)} />
      <div><button onClick={ask}>Kérdezek</button></div>
      <pre>{out}</pre>
    </main>
  );
}

