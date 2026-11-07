// Confronto di formule per il segnalino Lui! e i punti del Megafono, su partite reali tra bot. Uso: npx tsx tools/analysis/lui-formulas.ts
import { applyAction, chooseBotAction, createGame, learnFromResult, newBotMemory } from "../../packages/game-engine/src/index.ts";
import { crowdProbs } from "../../packages/game-engine/src/ai.ts";
import { nextRandom } from "../../packages/game-engine/src/rng.ts";
import { DECK, PHRASE_DECK } from "../../worker/src/content.ts";

type Kind = "CADE" | "NON_CADE";
/** Punti del solo segnalino: c = voti sulla carta, fell = la carta cade. */
type Formula = { name: string; lui: (kind: Kind, c: number, fell: boolean, top: number, n: number) => number; collect?: boolean };
const hit = (k: Kind, fell: boolean) => (k === "CADE" ? fell : !fell);
const F: Formula[] = [
  { name: "A  oggi: Cade +4 / Non cade +1 / −1, +1 per voto raccolto", lui: (k, c, f) => (hit(k, f) ? (k === "CADE" ? 4 : 1) : -1), collect: true },
  { name: "B  Cade +4 / Non cade +4 / −1", lui: (k, c, f) => (hit(k, f) ? 4 : -1) },
  { name: "C  Cade +4 / Non cade +2 / −1", lui: (k, c, f) => (hit(k, f) ? (k === "CADE" ? 4 : 2) : -1) },
  { name: "D  2 × voti sulla carta (entrambe) / −1", lui: (k, c, f) => (hit(k, f) ? 2 * c : -1) },
  { name: "E  2 × voti, minimo 2 / −1", lui: (k, c, f) => (hit(k, f) ? Math.max(2, 2 * c) : -1) },
  { name: "F  2 + voti sulla carta (entrambe) / −1", lui: (k, c, f) => (hit(k, f) ? 2 + c : -1) },
  { name: "G  Cade: 2 × voti; Non cade: 2 + voti / −1", lui: (k, c, f) => (hit(k, f) ? (k === "CADE" ? 2 * c : 2 + c) : -1) },
  { name: "H  Cade: voti + 2; Non cade: 3 fissi / −1", lui: (k, c, f) => (hit(k, f) ? (k === "CADE" ? c + 2 : 3) : -1) },
];

interface Turn { n: number; p: number[]; counts: Record<number, number>; fallen: number[]; megaVote: number; others: number; collected: number }
function collect(n: number, games: number): Turn[] {
  const out: Turn[] = [];
  for (let g = 0; g < games; g++) {
    let s = createGame({ players: Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i })), seed: 3000 + g, deck: DECK, phraseDeck: PHRASE_DECK, mixPhrases: true }).state;
    const mem = newBotMemory(); let r = g * 11 + 5; const rand = () => { const x = nextRandom(r); r = x.state; return x.value; }; let k = 0, p: number[] = [];
    while (s.phase !== "GAME_OVER" && k++ < 6000) {
      if (s.phase === "RESULTS") { const res = s.lastResult!, m = res.megafonoId;
        const others = Object.entries(res.points).filter(([id]) => id !== m).reduce((a, [, v]) => a + v, 0) / (n - 1);
        out.push({ n, p, counts: res.counts, fallen: res.fallenPositions, megaVote: res.votes[m]!, others, collected: res.collected });
        learnFromResult(mem, s.tower, res); s = applyAction(s, { type: "advance" }).state; continue; }
      if (s.phase === "SUSPECT") p = crowdProbs(s, mem, "hard");
      for (let i = 0; i < n; i++) { const a = chooseBotAction(s, s.playerIds[i]!, "hard", mem, rand); if (a) { s = applyAction(s, a).state; break; } }
    }
  }
  return out;
}
/** Esito simulato dei voti dalla stima p (n votanti). */
function sampleOutcome(p: number[], n: number, rand: () => number) {
  const counts = new Array(p.length).fill(0);
  for (let i = 0; i < n; i++) { let u = rand(), k = 0; for (; k < p.length - 1; k++) { u -= p[k]!; if (u <= 0) break; } counts[k]++; }
  const top = Math.max(...counts); return { counts, top, fallen: counts.flatMap((c, i) => (c === top ? [i] : [])) };
}
let rs = 17; const rnd = () => { const x = nextRandom(rs); rs = x.state; return x.value; };

console.log("Per ogni formula: il Megafono sceglie (tipo, carta) massimizzando il valore atteso stimato come un bot Difficile, poi si incassa l'esito reale.\n");
for (const n of [4, 6, 8]) {
  const turns = collect(n, 30);
  console.log(`=== ${n} giocatori · ${turns.length} turni ===`);
  const rows: string[] = [];
  for (const f of F) {
    let mega = 0, others = 0, cade = 0, onTop = 0, hits = 0, close = 0, gain = 0, rndGain = 0, spread = 0;
    for (const t of turns) {
      const N = t.p.length; const cands: { kind: Kind; pos: number; ev: number }[] = [];
      const S = Array.from({ length: 160 }, () => sampleOutcome(t.p, N, rnd));
      for (const kind of ["CADE", "NON_CADE"] as Kind[]) for (let pos = 0; pos < N; pos++) {
        let ev = 0; for (const o of S) ev += f.lui(kind, o.counts[pos]!, o.fallen.includes(pos), o.top, N); cands.push({ kind, pos: pos + 1, ev: ev / S.length });
      }
      cands.sort((a, b) => b.ev - a.ev); const best = cands[0]!, second = cands.find((c) => c.kind !== best.kind || c.pos !== best.pos)!;
      const real = (c: { kind: Kind; pos: number }) => f.lui(c.kind, t.counts[c.pos] ?? 0, t.fallen.includes(c.pos), Math.max(...Object.values(t.counts)), N);
      const base = (t.fallen.includes(t.megaVote) ? 2 : 0) + (f.collect ? t.collected : 0);
      mega += base + real(best); others += t.others;
      if (best.kind === "CADE") cade++; if (best.pos === 1 + t.p.indexOf(Math.max(...t.p))) onTop++; if (real(best) > 0) hits++;
      if (best.ev - second.ev < 0.12 * Math.max(1, Math.abs(best.ev))) close++;
      const rc = cands[Math.floor(rnd() * cands.length)]!; gain += real(best); rndGain += real(rc);
      spread += cands.filter((c) => c.ev > best.ev * 0.85).length;
    }
    const T = turns.length;
    rows.push(`${f.name.padEnd(58)} Megafono ${(mega / T).toFixed(1).padStart(4)} vs altri ${(others / T).toFixed(1)} (×${(mega / others).toFixed(1)}) · sceglie CADE ${(100 * cade / T).toFixed(0).padStart(3)}% · sulla carta più probabile ${(100 * onTop / T).toFixed(0).padStart(3)}% · azzecca ${(100 * hits / T).toFixed(0).padStart(3)}% · dilemma (2 opzioni quasi pari) ${(100 * close / T).toFixed(0).padStart(3)}% · opzioni buone ${(spread / T).toFixed(1)} · vantaggio su scelta a caso ${((gain - rndGain) / T).toFixed(1)}`);
  }
  console.log(rows.join("\n") + "\n");
}
