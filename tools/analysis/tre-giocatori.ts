// Gioco esatto di un turno a 3 giocatori con i segnalini CADE / NON CADE / VOTI NULLI! (proposta), senza la frase.
// Carte: 0 = di A, 1 = di B, 2 = del mazzo. Votano A, B e il Megafono (M). M posa fino a 2 segnalini coperti su carte diverse (tipi diversi);
// A e B vedono QUALI carte sono segnate, non con cosa. Punti: +2 voto giusto (voto valido), +2 al proprietario della carta caduta,
// CADE +4 se la carta cade (−malus se no), NON CADE +1 se non cade (−malus se cade), VOTI NULLI!: i voti su quella carta non valgono.
// Pareggio: se M ha votato una delle carte in testa cade solo quella, altrimenti tutte (variante "mazzo": tre voti tutti diversi → cade la carta del mazzo).
// Ognuno vuole stare davanti: utilità = propri punti − media degli altri due. Equilibrio cercato con risposte "morbide" che si induriscono (QRE → Nash).
// Uso: npx tsx tools/analysis/tre-giocatori.ts

type Tok = [card: number, type: number];            // type: 0 CADE, 1 NON CADE, 2 VOTI NULLI
interface Variant { name: string; types: number[]; malus: number; noCoup: boolean; deckTie: boolean; max: number; /** pareggio a tre (1-1-1): nessuna carta cade */ noneTie?: boolean; /** il voto del Megafono non conta sulla carta del suo CADE */ megaNoCade?: boolean; /** CADE vale solo con almeno un voto della Folla sulla carta */ cadeNeedsFolla?: boolean; /** «Il Megafono sa»: la terza carta è del Megafono (niente carta del mazzo) */ megaSa?: boolean; /** spareggio: vince la carta con CADE se è tra quelle in parità, altrimenti cadono tutte (il voto del Megafono non decide) */ cadeTie?: boolean }
const TN = ["CADE", "NON CADE", "NULLI"], CN = ["carta A", "carta B", "terza carta (mazzo o del Megafono)"];

function placements(v: Variant): Tok[][] {
  const out: Tok[][] = [[]];
  for (const t of v.types) for (let c = 0; c < 3; c++) out.push([[c, t]]);
  if (v.max >= 2) for (let c1 = 0; c1 < 3; c1++) for (let c2 = c1 + 1; c2 < 3; c2++) for (const t1 of v.types) for (const t2 of v.types) {
    if (t1 === t2) continue;
    if (v.noCoup && ((t1 === 0 && t2 === 2) || (t1 === 2 && t2 === 0))) continue;
    out.push([[c1, t1], [c2, t2]]);
  }
  return out;
}
const markOf = (P: Tok[]) => P.reduce((m, [c]) => m | (1 << c), 0);

/** Punti di M, A, B dati segnalini e voti. */
function score(v: Variant, P: Tok[], vm: number, va: number, vb: number): [number, number, number] {
  const nul = P.find((t) => t[1] === 2)?.[0] ?? -1, cade = P.find((t) => t[1] === 0)?.[0] ?? -1, votes = [vm, va, vb], valid = votes.map((x, i) => x !== nul && !(v.megaNoCade && i === 0 && x === cade));
  const cnt = [0, 0, 0]; votes.forEach((x, i) => { if (valid[i]) cnt[x]++; });
  const top = Math.max(...cnt), lead = [0, 1, 2].filter((k) => cnt[k] === top);
  let fallen: number[];
  if (v.noneTie && lead.length === 3 && top === 1) fallen = [];
  else if (v.deckTie && lead.length === 3 && top === 1) fallen = [2];
  else if (v.cadeTie) fallen = lead.length > 1 && lead.includes(cade) ? [cade] : lead;
  else fallen = lead.length > 1 && lead.includes(vm) ? [vm] : lead;
  const pts: [number, number, number] = [0, 0, 0];
  votes.forEach((x, i) => { if (valid[i] && fallen.includes(x)) pts[i] += 2; });
  if (fallen.includes(0)) pts[1] += 2; if (fallen.includes(1)) pts[2] += 2; if (v.megaSa && fallen.includes(2)) pts[0] += 2;
  for (const [c, t] of P) { if (t === 0) pts[0] += fallen.includes(c) && (!v.cadeNeedsFolla || va === c || vb === c) ? 4 : -v.malus; if (t === 1) pts[0] += fallen.includes(c) ? -v.malus : 1; }
  return pts;
}
const rel = (p: [number, number, number], i: number) => p[i]! - (p[0]! + p[1]! + p[2]! - p[i]!) / 2;

function solve(v: Variant) {
  const PL = placements(v), MA = PL.flatMap((P) => [0, 1, 2].map((vm) => ({ P, vm }))), OBS = 8;
  let sM = MA.map(() => 1 / MA.length);
  let sA = Array.from({ length: OBS }, () => [1 / 3, 1 / 3, 1 / 3]), sB = sA.map((r) => r.slice());
  const soft = (u: number[], tau: number) => { const m = Math.max(...u), e = u.map((x) => Math.exp((x - m) / tau)), z = e.reduce((a, b) => a + b, 0); return e.map((x) => x / z); };
  for (const tau of [3, 2, 1.4, 1, 0.7, 0.5, 0.35, 0.25, 0.18, 0.12, 0.08, 0.05]) for (let it = 0; it < 400; it++) {
    const uM = MA.map(({ P, vm }) => { const o = markOf(P); let s = 0; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) s += sA[o]![a]! * sB[o]![b]! * rel(score(v, P, vm, a, b), 0); return s; });
    const nA = sA.map((r) => r.slice()), nB = sB.map((r) => r.slice());
    for (let o = 0; o < OBS; o++) {
      // convinzioni di A e B: le mosse di M compatibili con ciò che vedono (se M non le gioca mai, uniformi: "errore" di M)
      let w = MA.map((m, i) => (markOf(m.P) === o ? sM[i]! : 0)), z = w.reduce((x, y) => x + y, 0);
      if (z < 1e-9) { w = MA.map((m) => (markOf(m.P) === o ? 1 : 0)); z = w.reduce((x, y) => x + y, 0); }
      if (z === 0) continue;
      const uA = [0, 1, 2].map((a) => MA.reduce((s, m, i) => s + (w[i]! / z) * [0, 1, 2].reduce((t, b) => t + sB[o]![b]! * rel(score(v, m.P, m.vm, a, b), 1), 0), 0));
      const uB = [0, 1, 2].map((b) => MA.reduce((s, m, i) => s + (w[i]! / z) * [0, 1, 2].reduce((t, a) => t + sA[o]![a]! * rel(score(v, m.P, m.vm, a, b), 2), 0), 0));
      const ra = soft(uA, tau), rb = soft(uB, tau);
      nA[o] = sA[o]!.map((x, k) => 0.8 * x + 0.2 * ra[k]!); nB[o] = sB[o]!.map((x, k) => 0.8 * x + 0.2 * rb[k]!);
    }
    const rm = soft(uM, tau); sM = sM.map((x, k) => 0.8 * x + 0.2 * rm[k]!); sA = nA; sB = nB;
  }
  // risultati attesi in equilibrio
  let pm = 0, pa = 0, pb = 0, same = 0, cadeP = 0, cadeOk = 0, nonP = 0, nonOk = 0, nulP = 0, nulAnn = 0, mFalls = 0;
  const nTok = [0, 0, 0], combos: Record<string, number> = {}, clean: Record<string, number> = {};
  MA.forEach((m, i) => {
    const pr = sM[i]!; if (pr < 1e-6) return; const o = markOf(m.P);
    nTok[m.P.length]! += pr;
    const key = m.P.map(([c, t]) => `${TN[t]}→${CN[c]}`).join(" + ") || "nessuno"; combos[key] = (combos[key] ?? 0) + pr;
    if (m.P.length === 2) { const c = [0, 1, 2].find((k) => !(o & (1 << k)))!; clean[CN[c]!] = (clean[CN[c]!] ?? 0) + pr; }
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
      const q = pr * sA[o]![a]! * sB[o]![b]!, p = score(v, m.P, m.vm, a, b); pm += q * p[0]; pa += q * p[1]; pb += q * p[2]; if (a === b) same += q;
      const nul = m.P.find((t) => t[1] === 2)?.[0] ?? -1, cd = m.P.find((t) => t[1] === 0)?.[0] ?? -1, valid = [m.vm, a, b].filter((x, i) => x !== nul && !(v.megaNoCade && i === 0 && x === cd));
      const cnt = [0, 0, 0]; valid.forEach((x) => cnt[x]++);
      for (const [c, t] of m.P) {
        const fell = (() => { const top = Math.max(...cnt), lead = [0, 1, 2].filter((k) => cnt[k] === top); const f = v.noneTie && lead.length === 3 && top === 1 ? [] : v.deckTie && lead.length === 3 && top === 1 ? [2] : v.cadeTie ? (lead.length > 1 && lead.includes(cd) ? [cd] : lead) : lead.length > 1 && lead.includes(m.vm) ? [m.vm] : lead; return f.includes(c); })();
        if (t === 0) { cadeP += q; if (fell && (!v.cadeNeedsFolla || a === c || b === c)) cadeOk += q; } if (t === 1) { nonP += q; if (!fell) nonOk += q; } if (t === 2) { nulP += q; nulAnn += q * [a, b].filter((x) => x === c).length; }
      }
    }
  });
  const pc = (x: number) => `${Math.round(100 * x)}%`;
  console.log(`\n== ${v.name}`);
  console.log(`  punti medi nel turno: Megafono ${pm.toFixed(2)} · A ${pa.toFixed(2)} · B ${pb.toFixed(2)}  (vantaggio del Megafono ${(pm - (pa + pb) / 2).toFixed(2)})`);
  console.log(`  segnalini giocati: 0 → ${pc(nTok[0]!)} · 1 → ${pc(nTok[1]!)} · 2 → ${pc(nTok[2]!)}   · A e B votano la stessa carta ${pc(same)}`);
  console.log(`  CADE giocato ${pc(cadeP)}${cadeP ? `, riesce ${pc(cadeOk / cadeP)}` : ""} · NON CADE giocato ${pc(nonP)}${nonP ? `, riesce ${pc(nonOk / nonP)}` : ""}${v.types.includes(2) ? ` · VOTI NULLI! giocato ${pc(nulP)}${nulP ? `, voti annullati della Folla in media ${(nulAnn / nulP).toFixed(2)}` : ""}` : ""}`);
  if (Object.keys(clean).length) console.log(`  con 2 segnalini, carta lasciata pulita: ${Object.entries(clean).map(([k, x]) => `${k} ${pc(x / nTok[2]!)}`).join(" · ")}`);
  console.log(`  mosse più usate dal Megafono: ${Object.entries(combos).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, x]) => `${k} (${pc(x)})`).join(" · ")}`);
  void mFalls;
}

const ALL = [0, 1, 2], CN2 = [0, 1];
const V: Variant[] = [
  { name: "Riferimento: nessun segnalino (solo voti, pareggio al Megafono)", types: [], malus: 1, noCoup: false, deckTie: false, max: 0 },
  { name: "CADE / NON CADE, fino a 2, malus −1", types: CN2, malus: 1, noCoup: false, deckTie: false, max: 2 },
  { name: "+ VOTI NULLI!, tutto libero, malus −1", types: ALL, malus: 1, noCoup: false, deckTie: false, max: 2 },
  { name: "+ VOTI NULLI!, opzione A (niente CADE + NULLI), malus −1", types: ALL, malus: 1, noCoup: true, deckTie: false, max: 2 },
  { name: "CORREZIONE 1 · pareggio a tre: non cade nessuna carta", types: ALL, malus: 1, noCoup: false, deckTie: false, max: 2, noneTie: true },
  { name: "CORREZIONE 2 · il voto del Megafono non conta sulla carta del suo CADE", types: ALL, malus: 1, noCoup: false, deckTie: false, max: 2, megaNoCade: true },
  { name: "CORREZIONE 3 · CADE vale solo se almeno uno della Folla vota la carta", types: ALL, malus: 1, noCoup: false, deckTie: false, max: 2, cadeNeedsFolla: true },
  { name: "CORREZIONE 1 + 2", types: ALL, malus: 1, noCoup: false, deckTie: false, max: 2, noneTie: true, megaNoCade: true },
  { name: "CORREZIONE 2 + opzione A", types: ALL, malus: 1, noCoup: true, deckTie: false, max: 2, megaNoCade: true },
];
V.push(
  { name: "«IL MEGAFONO SA» · CADE / NON CADE, fino a 2, malus −1", types: CN2, malus: 1, noCoup: false, deckTie: false, max: 2, megaSa: true },
  { name: "«IL MEGAFONO SA» · + VOTI NULLI!, tutto libero, malus −1", types: ALL, malus: 1, noCoup: false, deckTie: false, max: 2, megaSa: true },
  { name: "«IL MEGAFONO SA» · + VOTI NULLI!, opzione A, malus −1", types: ALL, malus: 1, noCoup: true, deckTie: false, max: 2, megaSa: true },
  { name: "«IL MEGAFONO SA» · + VOTI NULLI!, pareggio a tre: non cade nessuna", types: ALL, malus: 1, noCoup: false, deckTie: false, max: 2, megaSa: true, noneTie: true },
);
if (process.argv[2] === "cade") {
  V.splice(0, V.length,
    { name: "SPAREGGIO AL CADE · CADE / NON CADE, fino a 2, malus −1 (carta del mazzo)", types: CN2, malus: 1, noCoup: false, deckTie: false, max: 2, cadeTie: true },
    { name: "SPAREGGIO AL CADE · CADE / NON CADE, fino a 2, senza malus (carta del mazzo)", types: CN2, malus: 0, noCoup: false, deckTie: false, max: 2, cadeTie: true },
    { name: "SPAREGGIO AL CADE · + VOTI NULLI!, tutto libero, malus −1 (carta del mazzo)", types: ALL, malus: 1, noCoup: false, deckTie: false, max: 2, cadeTie: true },
    { name: "SPAREGGIO AL CADE · + VOTI NULLI!, niente CADE + NULLI insieme, malus −1 (carta del mazzo)", types: ALL, malus: 1, noCoup: true, deckTie: false, max: 2, cadeTie: true },
    { name: "SPAREGGIO AL CADE · CADE / NON CADE, malus −1, «Il Megafono sa»", types: CN2, malus: 1, noCoup: false, deckTie: false, max: 2, cadeTie: true, megaSa: true },
    { name: "SPAREGGIO AL CADE · + VOTI NULLI!, malus −1, «Il Megafono sa»", types: ALL, malus: 1, noCoup: false, deckTie: false, max: 2, cadeTie: true, megaSa: true },
  );
}
if (process.argv[2] === "sa") V.splice(0, V.length - 4);
for (const v of V) solve(v);
