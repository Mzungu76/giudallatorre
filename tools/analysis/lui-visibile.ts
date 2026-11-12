// Proposte di Lui! VISIBILE (un solo segnalino, scoperto, che il Megafono posa su una carta) — modello di comportamento, non i bot del gioco.
//
//  B0  riferimento: il Lui! non fa nulla (gioco con +2 voto giusto e +2 carta caduta).
//  V1  «+1»: se la carta del Lui! cade, chi l'ha votata prende +1 in più; il Megafono prende 1 punto per ogni voto degli ALTRI sulla carta.
//  V1b come V1, ma conta anche il voto del Megafono («ogni voto presente sulla carta»).
//  V2  «+2 con trappola»: se la carta del Lui! cade, chi l'ha votata prende +2 in più (il Megafono niente);
//      ma se l'hanno votata TUTTI gli altri, nessuno della Folla fa punti nel turno e il Megafono prende 1 punto per voto.
//
// Situazioni reali (carte, frasi, quanto ogni carta è «ovvia» per il gruppo: crowdProbs). La Folla sceglie con un equilibrio «a risposta morbida»:
// ognuno vota in proporzione a ovvietà × convenienza, dove convenienza = i propri punti attesi meno λ × la media di quelli degli avversari
// (λ 0 = tavolo avido, 1 = tavolo che pensa a stare davanti, 0,5 = misto). Il Megafono sceglie carta del Lui! e proprio voto sapendo come reagirà la Folla.
// Uso: npx tsx tools/analysis/lui-visibile.ts [situazioni per numero di giocatori]
import { applyAction, chooseBotAction, createGame, megafonoOf, newBotMemory } from "../../packages/game-engine/src/index.ts";
import { crowdProbs } from "../../packages/game-engine/src/ai.ts";
import { nextRandom } from "../../packages/game-engine/src/rng.ts";
import { DECK, PHRASE_DECK } from "../../worker/src/content.ts";

type Variant = "B0" | "V1" | "V1b" | "V2";
const SITS = Number(process.argv[2] ?? 40), S = 160, ITERS = 14, TAU = 0.9, ALPHA = 1.0, MEGA_TAU = 0.6;
let rs = 99; const rnd = () => { const x = nextRandom(rs); rs = x.state; return x.value; };
const pickP = (p: number[]) => { let u = rnd(), k = 0; for (; k < p.length - 1; k++) { u -= p[k]!; if (u <= 0) break; } return k; };
const norm = (w: number[]) => { const z = w.reduce((a, b) => a + b, 0); return w.map((x) => x / z); };

/** Situazioni reali: Torre e frase del primo turno di partite giocate dai bot, con l'ovvietà di ogni carta. */
function situations(n: number): number[][] {
  const out: number[][] = [];
  for (let g = 0; out.length < SITS && g < SITS * 3; g++) {
    let s = createGame({ players: Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i })), seed: 3100 + g, deck: DECK, phraseDeck: PHRASE_DECK, mixPhrases: true }).state;
    const mem = newBotMemory(); let r = g * 13 + 1; const rand = () => { const x = nextRandom(r); r = x.state; return x.value; };
    for (let k = 0; k < 50 && s.phase !== "SUSPECT"; k++) for (const p of s.playerIds) { const a = chooseBotAction(s, p, "hard", mem, rand); if (a) { s = applyAction(s, a).state; break; } }
    if (s.phase === "SUSPECT") out.push(crowdProbs(s, mem, "hard"));
    void megafonoOf;
  }
  return out;
}

/** Esito di un profilo di voti: Folla (indici 0..F-1) e Megafono; punti di tutti. */
function outcome(v: Variant, N: number, folla: number[], mv: number, X: number) {
  const counts = new Array(N).fill(0); for (const k of folla) counts[k]++; counts[mv]++;
  const top = Math.max(...counts), lead = counts.map((c, k) => (c === top ? k : -1)).filter((k) => k >= 0);
  const fallen = lead.length > 1 && lead.includes(mv) ? [mv] : lead, xFell = fallen.includes(X);
  const others = folla.filter((k) => k === X).length, unanimous = others === folla.length;
  const pts = folla.map((k) => (fallen.includes(k) ? 2 : 0) + (xFell && k === X ? (v === "V2" ? 2 : v === "B0" ? 0 : 1) : 0));
  let mega = fallen.includes(mv) ? 2 : 0;
  if (v === "V1" && xFell) mega += others;
  if (v === "V1b" && xFell) mega += others + (mv === X ? 1 : 0);
  if (v === "V2" && unanimous) { mega += folla.length; for (let i = 0; i < pts.length; i++) pts[i] = 0; }
  return { pts, mega, xFell, others, unanimous };
}

/** Equilibrio della Folla (tutti uguali): probabilità di voto su ogni carta, dato il Lui! su X. Il voto del Megafono la Folla non lo vede: lo stima dall'ovvietà. */
function crowd(v: Variant, p: number[], X: number, lambda: number): number[] {
  const N = p.length, F = N - 1 + 0; // Torre di N carte = N giocatori (N−1 della Folla + carta del mazzo); la Folla è N−1
  const f = F; let sig = p.slice();
  for (let it = 0; it < ITERS; it++) {
    const U = new Array(N).fill(0);
    for (let s = 0; s < S; s++) {
      const rest = Array.from({ length: f - 1 }, () => pickP(sig)), mv = pickP(p);
      for (let k = 0; k < N; k++) {
        const o = outcome(v, N, [k, ...rest], mv, X), mine = o.pts[0]!, opp = (o.pts.slice(1).reduce((a, b) => a + b, 0) + o.mega) / f;
        U[k] += mine - lambda * opp;
      }
    }
    const next = norm(U.map((u, k) => Math.pow(p[k]!, ALPHA) * Math.exp(u / S / TAU)));
    sig = sig.map((x, k) => 0.5 * x + 0.5 * next[k]!);
  }
  return sig;
}

const variants: Variant[] = ["B0", "V1", "V1b", "V2"], lambdas: [string, number][] = [["avido", 0], ["misto", 0.5], ["relativo", 1]];
console.log("Per ogni proposta e tipo di tavolo: dove il Megafono mette il Lui! (sulla carta più ovvia?), se poi la vota, quanto la Folla la vota rispetto al normale,\nquanto spesso cade, quante volte la votano tutti (V2), punti nel turno del Megafono e della Folla.\n");
for (const n of [3, 4, 5, 6, 8]) {
  const sits = situations(n), F = n - 1;
  console.log(`== ${n} giocatori (${sits.length} situazioni reali)`);
  for (const [lname, lambda] of lambdas) for (const v of variants) {
    let onTop = 0, megaOnX = 0, share = 0, base = 0, fell = 0, unan = 0, mega = 0, folla = 0, T = 0;
    for (const p of sits) {
      const N = p.length, top = p.indexOf(Math.max(...p));
      // il Megafono valuta ogni carta per il Lui! e ogni proprio voto (vantaggio sugli altri), poi sceglie in modo un po' imprevedibile
      const opts: { X: number; mv: number; ev: number; sig: number[] }[] = [];
      for (let X = 0; X < N; X++) {
        const sig = v === "B0" ? crowd("B0", p, X, lambda) : crowd(v, p, X, lambda);
        for (let mv = 0; mv < N; mv++) {
          let ev = 0; for (let s = 0; s < S / 2; s++) { const o = outcome(v, N, Array.from({ length: F }, () => pickP(sig)), mv, X); ev += o.mega - o.pts.reduce((a, b) => a + b, 0) / F; }
          opts.push({ X, mv, ev: ev / (S / 2), sig });
        }
        if (v === "B0") break;                                           // senza effetto la carta del Lui! non conta
      }
      const best = Math.max(...opts.map((o) => o.ev)), w = norm(opts.map((o) => Math.exp((o.ev - best) / MEGA_TAU)));
      for (let r = 0; r < 6; r++) {
        const ch = opts[pickP(w)]!, X = v === "B0" ? top : ch.X;
        const fv = Array.from({ length: F }, () => pickP(ch.sig)), o = outcome(v, N, fv, ch.mv, X);
        T++; if (X === top) onTop++; if (ch.mv === X) megaOnX++; share += o.others / F; base += p[X]!;
        if (o.xFell) fell++; if (o.unanimous) unan++; mega += o.mega; folla += o.pts.reduce((a, b) => a + b, 0) / F;
      }
    }
    const pc = (x: number) => `${Math.round((100 * x) / T)}%`.padStart(4);
    console.log(`  ${lname.padEnd(8)} ${v.padEnd(3)}  Lui! sulla più ovvia ${pc(onTop)} · Megafono la vota ${pc(megaOnX)} · Folla la vota ${pc(share)} (normale ~${pc(base).trim()}) · cade ${pc(fell)}${v === "V2" ? ` · votata da tutti ${pc(unan)}` : ""} · punti Megafono ${(mega / T).toFixed(1)} · Folla ${(folla / T).toFixed(1)}`);
  }
}
