// Gioco esatto di un turno a 3 giocatori, «Il Megafono sa», segnalini coperti CADE (+4) / NON CADE (+1) [/ VOTI NULLI!], senza malus,
// con la FRASE: situazioni reali (Torre e frase vere, affinità carta↔frase come nel gioco, crowdProbs) e il SEGRETO dei proprietari.
//
// Regole:
//  - 3 carte sulla Torre, una di A, una di B, una del Megafono (M). Ognuno conosce la propria; A non sa quale delle altre due sia di B e quale di M (e viceversa).
//    Il Megafono ha scelto la sua carta conoscendo la frase: a priori gli altri sospettano di più le carte più affini (probabilità ∝ affinità^GAMMA).
//  - M posa da 0 a 2 segnalini coperti su carte diverse, di tipo diverso; A e B vedono quali carte sono segnate, non con cosa.
//  - Tutti votano (anche la propria carta). Cade la più votata (voti validi). Pareggio: se tra le pari c'è la carta con CADE cade solo lei,
//    altrimenti cadono tutte (il voto del Megafono non ha ruolo). [variante di confronto: pareggio vinto dalla carta votata dal Megafono]
//  - Punti: +2 voto giusto (voto valido), +2 al proprietario di ogni carta caduta, CADE +4 se cade, NON CADE +1 se non cade, VOTI NULLI!: voti nulli, nessun punto.
//  - Ognuno vuole stare davanti: propri punti − media degli altri due. La Folla è attratta dalla carta affine: + BETA × ln(3 × affinità) a voto (la «frase»).
// Equilibrio bayesiano cercato con risposte morbide che si induriscono. Uso: npx tsx tools/analysis/tre-giocatori-frase.ts [situazioni]
import { applyAction, chooseBotAction, createGame, newBotMemory } from "../../packages/game-engine/src/index.ts";
import { crowdProbs } from "../../packages/game-engine/src/ai.ts";
import { nextRandom } from "../../packages/game-engine/src/rng.ts";
import { DECK, PHRASE_DECK } from "../../worker/src/content.ts";

type Tok = [card: number, type: number];
interface V { name: string; types: number[]; megaTie: boolean; beta: number; /** chi della Folla vota la carta del Megafono, se cade, non prende il +2 */ noFollaOnMega?: boolean }
const SITS = Number(process.argv[2] ?? 24), GAMMA = 1;
const PERMS: number[][] = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]; // perm[k] = proprietario della carta k (0 M, 1 A, 2 B)

function situations(): number[][] {
  const out: number[][] = [];
  for (let g = 0; out.length < SITS && g < SITS * 4; g++) {
    let s = createGame({ players: [0, 1, 2].map((i) => ({ id: "p" + i, name: "P" + i })), seed: 5300 + g, deck: DECK, phraseDeck: PHRASE_DECK, mixPhrases: true, megafonoSa: true }).state;
    const mem = newBotMemory(); let r = g * 7 + 3; const rand = () => { const x = nextRandom(r); r = x.state; return x.value; };
    for (let k = 0; k < 40 && s.phase !== "SUSPECT"; k++) for (const p of s.playerIds) { const a = chooseBotAction(s, p, "hard", mem, rand); if (a) { s = applyAction(s, a).state; break; } }
    if (s.phase === "SUSPECT" && s.tower.length === 3) out.push(crowdProbs(s, mem, "hard"));
  }
  return out;
}
function placements(types: number[]): Tok[][] {
  const out: Tok[][] = [[]];
  for (const t of types) for (let c = 0; c < 3; c++) out.push([[c, t]]);
  for (let c1 = 0; c1 < 3; c1++) for (let c2 = c1 + 1; c2 < 3; c2++) for (const t1 of types) for (const t2 of types) if (t1 !== t2) out.push([[c1, t1], [c2, t2]]);
  return out;
}
const markOf = (P: Tok[]) => P.reduce((m, [c]) => m | (1 << c), 0);
/** Punti [M, A, B] e carte cadute. votes[i] = carta votata dal giocatore i (0 M, 1 A, 2 B). */
function score(v: V, perm: number[], P: Tok[], votes: number[]) {
  const nul = P.find((t) => t[1] === 2)?.[0] ?? -1, cade = P.find((t) => t[1] === 0)?.[0] ?? -1;
  const valid = votes.map((x) => x !== nul), cnt = [0, 0, 0]; votes.forEach((x, i) => { if (valid[i]) cnt[x]++; });
  const top = Math.max(...cnt), lead = [0, 1, 2].filter((k) => cnt[k] === top);
  const fallen = lead.length > 1 ? (v.megaTie ? (lead.includes(votes[0]!) ? [votes[0]!] : lead) : lead.includes(cade) ? [cade] : lead) : lead;
  const pts = [0, 0, 0];
  const mc = perm.indexOf(0);
  votes.forEach((x, i) => { if (valid[i] && fallen.includes(x) && !(v.noFollaOnMega && i > 0 && x === mc)) pts[i] += 2; });
  for (const c of fallen) pts[perm[c]!] += 2;
  for (const [c, t] of P) { if (t === 0 && fallen.includes(c)) pts[0] += 4; if (t === 1 && !fallen.includes(c)) pts[0] += 1; }
  return { pts, fallen };
}
const rel = (p: number[], i: number) => p[i]! - (p[0]! + p[1]! + p[2]! - p[i]!) / 2;
const soft = (u: number[], tau: number) => { const m = Math.max(...u), e = u.map((x) => Math.exp((x - m) / tau)), z = e.reduce((a, b) => a + b, 0); return e.map((x) => x / z); };

function solveSit(v: V, aff: number[]) {
  const PL = placements(v.types), MA = PL.flatMap((P) => [0, 1, 2].map((vm) => ({ P, vm }))), NA = MA.length;
  const prior = PERMS.map((pm) => Math.pow(aff[pm.indexOf(0)]!, GAMMA)); const zp = prior.reduce((a, b) => a + b, 0); prior.forEach((_, i) => (prior[i]! /= zp));
  const focal = aff.map((a) => v.beta * Math.log(3 * a));
  // tabella dei punti: [perm][azione M][voto A][voto B] → utilità relative di M, A, B
  const U = PERMS.map((pm) => MA.map(({ P, vm }) => [0, 1, 2].map((a) => [0, 1, 2].map((b) => { const { pts } = score(v, pm, P, [vm, a, b]); return [rel(pts, 0), rel(pts, 1), rel(pts, 2)]; }))));
  let sM = PERMS.map(() => MA.map(() => 1 / NA));
  // A e B: strategia per (propria carta, carte segnate)
  let sA = [0, 1, 2].map(() => Array.from({ length: 8 }, () => [1 / 3, 1 / 3, 1 / 3])), sB = sA.map((x) => x.map((r) => r.slice()));
  const own = (pm: number[], who: number) => pm.indexOf(who);
  for (const tau of [3, 1.8, 1.1, 0.7, 0.45, 0.3, 0.2, 0.13, 0.08]) for (let it = 0; it < 160; it++) {
    const nM = PERMS.map((pm, w) => { const oa = own(pm, 1), ob = own(pm, 2); const u = MA.map((m, i) => { const o = markOf(m.P); let s = 0; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) s += sA[oa]![o]![a]! * sB[ob]![o]![b]! * U[w]![i]![a]![b]![0]!; return s; }); return soft(u, tau); });
    const nA = sA.map((x) => x.map((r) => r.slice())), nB = sB.map((x) => x.map((r) => r.slice()));
    for (const [who, S, N, Oth] of [[1, sA, nA, sB], [2, sB, nB, sA]] as const) for (let oc = 0; oc < 3; oc++) for (let o = 0; o < 8; o++) {
      const u = [0, 0, 0]; let z = 0;
      PERMS.forEach((pm, w) => {
        if (own(pm, who) !== oc) return; const other = own(pm, who === 1 ? 2 : 1);
        MA.forEach((m, i) => { if (markOf(m.P) !== o) return; const q = prior[w]! * Math.max(sM[w]![i]!, 1e-7); z += q;
          for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) { const ab = who === 1 ? [x, y] : [y, x]; u[x] += q * Oth[other]![o]![y]! * U[w]![i]![ab[0]!]![ab[1]!]![who]!; } });
      });
      if (z === 0) continue;
      const r = soft(u.map((x, k) => x / z + focal[k]!), tau);
      N[oc]![o] = S[oc]![o]!.map((x, k) => 0.8 * x + 0.2 * r[k]!);
    }
    sM = sM.map((row, w) => row.map((x, i) => 0.8 * x + 0.2 * nM[w]![i]!)); sA = nA; sB = nB;
  }
  // risultati, mediati sui proprietari possibili (come il Megafono sceglie la carta) e sulle mosse
  const R = { pm: 0, pf: 0, cadeP: 0, cadeOk: 0, cadeOwn: 0, nonP: 0, nonOk: 0, nulP: 0, ann: 0, megaFell: 0, follaOnMega: 0, strongFell: 0, two: 0, tok0: 0 };
  const strong = aff.indexOf(Math.max(...aff));
  PERMS.forEach((pm, w) => MA.forEach((m, i) => {
    const pr = prior[w]! * sM[w]![i]!; if (pr < 1e-7) return; const o = markOf(m.P), oa = own(pm, 1), ob = own(pm, 2), mc = own(pm, 0);
    if (m.P.length === 2) R.two += pr; if (m.P.length === 0) R.tok0 += pr;
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
      const q = pr * sA[oa]![o]![a]! * sB[ob]![o]![b]!, { pts, fallen } = score(v, pm, m.P, [m.vm, a, b]);
      R.pm += q * pts[0]!; R.pf += q * (pts[1]! + pts[2]!) / 2;
      if (fallen.includes(mc)) R.megaFell += q; R.follaOnMega += q * ((a === mc ? 1 : 0) + (b === mc ? 1 : 0)) / 2; if (fallen.includes(strong)) R.strongFell += q;
      for (const [c, t] of m.P) { if (t === 0) { R.cadeP += q; if (fallen.includes(c)) R.cadeOk += q; if (c === mc) R.cadeOwn += q; } if (t === 1) { R.nonP += q; if (!fallen.includes(c)) R.nonOk += q; } if (t === 2) { R.nulP += q; R.ann += q * ((a === c ? 1 : 0) + (b === c ? 1 : 0)); } }
    }
  }));
  return R;
}

const sits = situations();
const pc = (x: number) => `${Math.round(100 * x)}%`.padStart(4);
console.log(`${sits.length} situazioni reali a 3 giocatori («Il Megafono sa»). Affinità media della carta più affine: ${pc(sits.reduce((a, p) => a + Math.max(...p), 0) / sits.length)}\n`);
const variants: V[] = [];
for (const beta of [0, 1, 2]) for (const types of [[0, 1], [0, 1, 2]]) variants.push({ name: `frase ${beta === 0 ? "senza peso" : beta === 1 ? "peso medio" : "peso forte"} · ${types.length === 3 ? "CADE / NON CADE / VOTI NULLI!" : "CADE / NON CADE"}`, types, megaTie: false, beta });
for (const types of [[0, 1], [0, 1, 2]]) variants.push({ name: `PROVA · chi vota la carta del Megafono non prende il +2 · frase peso medio · ${types.length === 3 ? "CADE / NON CADE / VOTI NULLI!" : "CADE / NON CADE"}`, types, megaTie: false, beta: 1, noFollaOnMega: true });
variants.push({ name: "CONFRONTO pareggio al voto del Megafono · frase peso medio · CADE / NON CADE / VOTI NULLI!", types: [0, 1, 2], megaTie: true, beta: 1 });
for (const v of variants) {
  const T: Record<string, number> = {};
  for (const aff of sits) { const r = solveSit(v, aff) as unknown as Record<string, number>; for (const k in r) T[k] = (T[k] ?? 0) + r[k]! / sits.length; }
  console.log(`== ${v.name}`);
  console.log(`   punti nel turno: Megafono ${T.pm!.toFixed(2)} · Folla ${T.pf!.toFixed(2)} (vantaggio ${(T.pm! - T.pf!).toFixed(2)}) · cade la carta del Megafono ${pc(T.megaFell!)} · la Folla la vota ${pc(T.follaOnMega!)} · cade la carta più affine ${pc(T.strongFell!)}`);
  console.log(`   segnalini: nessuno ${pc(T.tok0!)} · due ${pc(T.two!)} · CADE giocato ${pc(T.cadeP!)}${T.cadeP ? `, riesce ${pc(T.cadeOk! / T.cadeP!)}, sulla propria carta ${pc(T.cadeOwn! / T.cadeP!)}` : ""} · NON CADE ${pc(T.nonP!)}${T.nonP ? `, riesce ${pc(T.nonOk! / T.nonP!)}` : ""}${v.types.length === 3 ? ` · VOTI NULLI! ${pc(T.nulP!)}${T.nulP ? `, voti della Folla annullati ${(T.ann! / T.nulP!).toFixed(2)}` : ""}` : ""}`);
}
