import { luiForbidden, luiTokens, megafonoOf, requiredPlayers, tallyMarks } from "./engine.ts";
import { affinity, phraseTagCount } from "./tags.ts";
import type { Action, CardId, GameState, LuiSpec, LuiToken, PlayerId, TurnResult } from "./types.ts";
import { NEUTRAL_STYLE } from "./botstyle.ts";
import type { BotStyle } from "./botstyle.ts";

/**
 * Giocatori virtuali. Usano le etichette nascoste (personaggio ↔ frase, vedi tags.ts) per stimare chi cadrà, il punteggio atteso,
 * i voti raccolti dal Megafono e il suo bluff. Senza etichette (mazzi di prova) ripiegano sulla memoria dei personaggi caduti.
 */
export const BOT_LEVELS = ["easy", "medium", "hard"] as const;
export type BotLevel = (typeof BOT_LEVELS)[number];

/** Memoria della stanza: quante volte ogni personaggio è stato mostrato e quante è caduto. Serializzabile. */
export interface BotMemory { shown: Record<CardId, number>; fell: Record<CardId, number>; turns: number }
export const newBotMemory = (): BotMemory => ({ shown: {}, fell: {}, turns: 0 });
export function learnFromResult(mem: BotMemory, tower: { cardId: CardId }[], result: TurnResult): void {
  for (const t of tower) mem.shown[t.cardId] = (mem.shown[t.cardId] ?? 0) + 1;
  for (const c of result.fallenCardIds ?? [result.fallenCardId]) mem.fell[c] = (mem.fell[c] ?? 0) + 1; mem.turns += 1;
}
/** Stima dalla sola storia: uniforme senza dati, poi inclina verso le carte che cadono spesso. */
function histProbs(s: GameState, mem: BotMemory): number[] {
  const w = s.tower.map((t) => 1 + ((mem.fell[t.cardId] ?? 0) + 0.5) / ((mem.shown[t.cardId] ?? 0) + 2) * s.tower.length);
  const z = w.reduce((a, b) => a + b, 0); return w.map((x) => x / z);
}
const softmax = (xs: number[]) => { const m = Math.max(...xs), e = xs.map((x) => Math.exp(x - m)), z = e.reduce((a, b) => a + b, 0); return e.map((x) => x / z); };
const phraseText = (s: GameState) => (s.phrase ? s.phrase.text : undefined);   // anche la frase inventata: è visibile a tutti, i bot ne deducono le etichette dalle parole

/** Probabilità stimata che il gruppo voti (e quindi cada) ciascuna posizione della Torre. */
export function crowdProbs(s: GameState, mem: BotMemory, level: BotLevel): number[] {
  const hist = histProbs(s, mem), text = phraseText(s);
  const aff = text ? s.tower.map((t) => affinity(t.cardId, text)) : [];
  if (!text || aff.some((a) => a === null)) return hist;
  const p = softmax((aff as number[]).map((a) => a / (level === "hard" ? TUNE.tempHard : 3)));
  return p.map((x, i) => 0.85 * x + 0.15 * hist[i]!);
}
const sampleOne = (p: number[], rand: () => number) => { let u = rand(), k = 0; for (; k < p.length - 1; k++) { u -= p[k]!; if (u <= 0) break; } return k + 1; };
/** Voti simulati di tutti tranne `skip` (posizioni 1..N), dalla stima del gruppo. */
function propSample(s: GameState, p: number[], skip: PlayerId[], rand: () => number): Record<PlayerId, number>[] {
  return Array.from({ length: TUNE.propSamples }, () => Object.fromEntries(s.playerIds.filter((x) => !skip.includes(x)).map((x) => [x, sampleOne(p, rand)])));
}
// ---------- gioco base «Cade / Non cade» ----------
const CNC_TYPES = ["cade", "noncade", "nulli"] as const;
type Mark = { effect: string; position: number };
/** Punti di un turno «Cade / Non cade» per il Megafono e media della Folla (senza le carte degli altri, che il Megafono non conosce). */
function cncPoints(s: GameState, mega: PlayerId, votes: Record<PlayerId, number>, marks: Mark[]) {
  const T = tallyMarks(s.tower.map((t) => t.position), votes, marks), own = s.tower.find((t) => t.ownerId === mega)?.position;
  let m = T.fallen.includes(votes[mega]!) ? 2 : 0; if (own && T.fallen.includes(own)) m += 2;
  let f = 0; const folla = s.playerIds.filter((p) => p !== mega);
  for (const mk of marks) { if (mk.effect === "nulli") continue; const ok = mk.effect === "cade" ? T.fallen.includes(mk.position) : !T.fallen.includes(mk.position), pts = mk.effect === "cade" ? 4 : 1; if (ok) { m += pts; f += pts * folla.filter((p) => votes[p] === mk.position).length; } }
  for (const p of folla) if (votes[p] !== marks.find((x) => x.effect === "nulli")?.position && T.fallen.includes(votes[p]!)) f += 2;
  return { m, f: f / Math.max(1, folla.length), T };
}
/** «Cade / Non cade», il Megafono: per ogni carta e segnalino, il valore medio (vantaggio sulla Folla) sui voti simulati, con il proprio voto migliore. */
/** Quanto un bot sa leggere i bluff e quanto ne fa: dipende dal livello (facile non legge né bluffa, difficile al massimo). */
const SKILL = { easy: { depth: 0, bluff: 0 }, medium: { depth: 0.5, bluff: 0.5 }, hard: { depth: 1, bluff: 1 } } as const;
type Skill = (typeof SKILL)[BotLevel];
/** Convinzione degli altri sul segnalino posato su una carta: dato il valore (per il Megafono) di ogni scelta (carta, tipo), con che probabilità un osservatore pensa
 *  che sia ciascun tipo. Chi legge bene i bluff immagina il Megafono che sceglie bene (poco rumore); il sospettoso lo immagina più imprevedibile. */
export function typeBelief(evOf: (type: string) => number, tau: number, susp: number, depth: number): number[] {
  const post = softmax(CNC_TYPES.map((t) => evOf(t) / (tau * (1 + 1.5 * susp))));
  return post.map((x) => depth * x + (1 - depth) / CNC_TYPES.length);
}
function cncPlace(s: GameState, me: PlayerId, level: BotLevel, mem: BotMemory, rand: () => number, sk: Skill, st: BotStyle): Action {
  const p = crowdProbs(s, mem, level), n = s.tower.length, smp = propSample(s, p, [me], rand), cands: { marks: Mark[]; ev: number; pos: number; type: string }[] = [];
  for (let a = 1; a <= n; a++) for (const ta of CNC_TYPES) {
    const marks = [{ effect: ta, position: a }], nul = marks.find((x) => x.effect === "nulli")?.position;
    let best = -Infinity;
    for (let mv = 1; mv <= n; mv++) { if (mv === nul) continue; let ev = 0; for (const v of smp) { const r = cncPoints(s, me, { ...v, [me]: mv }, marks); ev += r.m - r.f; } best = Math.max(best, ev / smp.length); }
    // il gusto del rischio: il temerario ama il CADE (+4), il prudente il NON CADE (punti più sicuri)
    best += (st.risk - 0.5) * (ta === "cade" ? 0.5 : ta === "noncade" ? -0.25 : 0);
    cands.push({ marks, ev: best, pos: a, type: ta });
  }
  const tau = level === "hard" ? TUNE.cncTempHard : TUNE.propTempMed;
  // bluff: si preferisce la scelta che gli osservatori più probabilmente leggono male (il tipo vero ha poca probabilità nella loro convinzione), a costo di un po' di valore
  const lam = TUNE.bluffLambda * sk.bluff * st.bluff;
  if (lam > 0) for (const c of cands) { const bel = typeBelief((t) => cands.find((x) => x.pos === c.pos && x.type === t)!.ev, TUNE.cncTempHard, 0.4, 1); c.ev += lam * -Math.log(bel[CNC_TYPES.indexOf(c.type as (typeof CNC_TYPES)[number])]! + 0.05); }
  const top = Math.max(...cands.map((c) => c.ev)), ch = cands[pickProb(softmax(cands.map((c) => (c.ev - top) / (tau * (1.3 - 0.6 * st.conf)))), rand)]!;
  return { type: "placeMarks", playerId: me, marks: ch.marks.map((m) => ({ slot: m.effect, position: m.position })) };
}
/** «Cade / Non cade», voto. Il Megafono conosce il suo segnalino (e non può votare VOTI NULLI!); gli altri vedono solo dov'è: pesano i tre possibili
 *  con la convinzione che si sono fatti su come il Megafono sceglie (leggere i bluff) e col proprio carattere. */
function cncVote(s: GameState, me: PlayerId, level: BotLevel, mem: BotMemory, rand: () => number, sk: Skill, st: BotStyle): Action {
  const p = crowdProbs(s, mem, level), n = s.tower.length, mega = megafonoOf(s), hard = level === "hard", vals: number[] = [];
  if (me === mega) {
    const marks = (s.marks ?? []).map((m) => ({ effect: m.slot, position: m.position })), nul = luiForbidden(s, me), smp = propSample(s, p, [me], rand);
    for (let mv = 1; mv <= n; mv++) vals.push(mv === nul ? -1e9 : smp.reduce((a, v) => { const r = cncPoints(s, me, { ...v, [me]: mv }, marks); return a + r.m - r.f; }, 0) / smp.length);
  } else {
    const pos = (s.marks ?? []).map((m) => m.position), own = s.tower.find((t) => t.ownerId === me)?.position, smp = propSample(s, p, [me, mega], rand);
    // i segnalini possibili sulla carta segnata, pesati con quanto è plausibile che il Megafono li abbia posati lì (leggere il bluff)
    const combos: Mark[][] = pos.length ? CNC_TYPES.map((t) => [{ effect: t, position: pos[0]! }]) : [];
    let wc = combos.map(() => 1);
    if (pos.length && sk.depth > 0) {
      const sPub = { ...s, tower: s.tower.map((t) => ({ ...t, ownerId: null })) }, smM = propSample(s, p, [mega], rand), evAt = (type: string) => { let best = -Infinity; for (let mv = 1; mv <= n; mv++) { if (type === "nulli" && mv === pos[0]) continue; let ev = 0; for (const v of smM) { const r = cncPoints(sPub, mega, { ...v, [mega]: mv }, [{ effect: type, position: pos[0]! }]); ev += r.m - r.f; } best = Math.max(best, ev / smM.length); } return best; };
      const evs = Object.fromEntries(CNC_TYPES.map((t) => [t, evAt(t)]));
      wc = typeBelief((t) => evs[t]!, TUNE.cncTempHard, st.susp, sk.depth).map((x) => x * CNC_TYPES.length);
    }
    const fear = 1 + 0.4 * (st.susp - 0.5), wcc = wc.map((x, i) => (CNC_TYPES[i] === "nulli" ? x * fear : x));
    for (let k = 1; k <= n; k++) {
      let ev = 0, wz = 0;
      combos.forEach((marks, ci) => {
        const nul = marks.find((m) => m.effect === "nulli")?.position; let e = 0;
        for (const v of smp) {
          let mv = sampleOne(p, rand); if (mv === nul) mv = (mv % n) + 1;
          const votes = { ...v, [mega]: mv, [me]: k }, T = tallyMarks(s.tower.map((t) => t.position), votes, marks), valid = k !== nul;
          if (valid && T.fallen.includes(k)) e += 2; if (own && T.fallen.includes(own)) e += 2;
          const mk = marks.find((m) => m.position === k);
          if (valid && mk?.effect === "cade" && T.fallen.includes(k)) e += 4; if (valid && mk?.effect === "noncade" && !T.fallen.includes(k)) e += 2;
        }
        ev += wcc[ci]! * e / smp.length; wz += wcc[ci]!;
      });
      vals.push(combos.length ? ev / wz : p[k - 1]! * 2);
    }
  }
  const temp = (hard ? TUNE.cncVoteTempHard : TUNE.propVoteTempMed) * (1.5 - 0.9 * st.conf);
  const ww = softmax(vals.map((x) => x / temp)).map((x, k) => (vals[k]! <= -1e8 ? 0 : x + 0.03));
  // il carattere: il gregario si accoda alla stima del gruppo, il bastian contrario la rovescia
  const a = (st.herd - 0.5) * 0.4;
  const z = ww.reduce((x, y) => x + y, 0), mixed = ww.map((x, k) => (vals[k]! <= -1e8 ? 0 : a >= 0 ? (1 - a) * (x / z) + a * p[k]! : (1 + a) * (x / z) - a * (1 - p[k]!) / (n - 1)));
  return { type: "vote", playerId: me, position: pickProb(mixed, rand) + 1 };
}
const pickProb = (w: number[], rand: () => number) => { const z = w.reduce((a, b) => a + b, 0); let u = rand() * z; for (let k = 0; k < w.length; k++) { u -= w[k]!; if (u <= 0) return k; } return w.length - 1; };
/** Parametri di taratura dei bot (modificabili dai test di taratura). */
export const TUNE = { tempHard: 1.6, hardNoise: 0.12, medNoise: 1.0, propTempMed: 1.2, propVoteTempMed: 0.6, propSamples: 36, cncTempHard: 0.3, cncVoteTempHard: 0.12, bluffLambda: 0.5, easyLapse: 0.6, mediumLapse: 0.2 };

export function chooseBotAction(s: GameState, me: PlayerId, level0: BotLevel, mem: BotMemory, rand: () => number, style: BotStyle = NEUTRAL_STYLE): Action | null {
  // le sviste: il facile sbaglia spesso (a caso 6 volte su 10, il resto come un medio che non legge i bluff), il medio ogni tanto, il difficile mai
  const lapse = level0 === "easy" ? TUNE.easyLapse : level0 === "medium" ? TUNE.mediumLapse : 0, level: BotLevel = rand() < lapse ? "easy" : level0 === "easy" ? "medium" : level0, sk = SKILL[level0], st = style;
  const mega = megafonoOf(s), pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)]!;
  const noise = level === "hard" ? TUNE.hardNoise : TUNE.medNoise, n = s.tower.length;
  switch (s.phase) {
    case "PROCLAIM": {
      if (me !== mega) return null;
      const c = s.proclaim!; let idx = Math.floor(rand() * c.phrases.length);
      if (level === "hard") { const t = c.phrases.map(phraseTagCount), best = Math.max(...t); if (best > 0) { const top = t.flatMap((v, i) => (v === best ? [i] : [])); idx = pick(top); } }
      return { type: "choosePhrase", playerId: me, mode: "card", index: idx };
    }
    case "PLAY": {
      if (!requiredPlayers(s).includes(me) || s.played[me] !== undefined) return null;
      const hand = s.hands[me]!, text = phraseText(s);
      if (level === "easy") return { type: "playCard", playerId: me, cardId: pick(hand) };
      // la carta che meglio rappresenta la frase è quella che il gruppo voterà: se cade, +2 anche a me
      const hist = (c: CardId) => ((mem.fell[c] ?? 0) + 0.5) / ((mem.shown[c] ?? 0) + 2);
      const score = (c: CardId) => { const a = text ? affinity(c, text) : null; return (a ?? hist(c) * 3) + rand() * (level === "hard" ? 0.6 : 2.5) * (1.4 - 0.8 * st.conf); };
      return { type: "playCard", playerId: me, cardId: hand.slice().sort((a, b) => score(b) - score(a))[0]! };
    }
    case "SUSPECT": {
      if (me !== mega) return null;
      if (level === "easy") return { type: "placeMarks", playerId: me, marks: [{ slot: CNC_TYPES[Math.floor(rand() * 3)]!, position: 1 + Math.floor(rand() * n) }] };
      return cncPlace(s, me, level, mem, rand, sk, st);
    }
    case "VOTE": {
      if (s.votes[me] !== undefined) return null;
      if (level === "easy") { const banned = luiForbidden(s, me), opts = s.tower.map((t) => t.position).filter((x) => x !== banned); return { type: "vote", playerId: me, position: opts[Math.floor(rand() * opts.length)]! }; }
      return cncVote(s, me, level, mem, rand, sk, st);
    }
    case "MINI_RUN": {
      // Fuori programma: il voto lo decide planMiniVote (carta per carta, come una persona); qui solo la posizione, per le simulazioni del motore.
      const plan = planMiniVote(s, me, level0, mem, rand, true, st);
      return plan ? { type: "vote", playerId: me, position: plan.position } : null;
    }
    default: return null;
  }
}

/** Il voto di un bot nel fuori programma: quando e su quale carta. */
export interface MiniPlan { position: number; /** Quale uscita dal separé (0 = la prima). */ slot: number; /** Dopo quanti ms dall'uscita della carta preme il bottone. */ delayMs: number }

/**
 * Un bot decide come una persona, senza vantaggi: guarda le carte man mano che escono dal separé (la lista dell'ordine è pubblica, ma una carta si
 * «conosce» solo dopo averla vista), ne dà un giudizio un po' sfocato (più sfocato ai livelli bassi) e preme quando gli pare quella giusta:
 * al primo giro solo se è evidente e la migliore vista finora, al secondo se è la migliore tra tutte quelle viste, all'ultimo giro se è quella e non l'ha ancora fatto.
 * Dopo l'uscita della carta ci mette il tempo di reazione di una persona (più lungo ai livelli bassi, più corto se è impulsivo); a volte è troppo tardi e non vota.
 * Usa solo informazioni pubbliche: le carte in scena, la frase dell'accusa e la storia delle carte cadute.
 */
export function planMiniVote(s: GameState, me: PlayerId, level: BotLevel, mem: BotMemory, rand: () => number, force = false, style: BotStyle = NEUTRAL_STYLE): MiniPlan | null {
  const mini = s.mini; if (!mini || s.votes[me] !== undefined) return null;
  const order = mini.order, cycles = 3, per = Math.max(1, Math.floor(order.length / cycles)), imp = style.speed;   // 0 paziente … 1 impulsivo
  const sigma = level === "easy" ? 3 : level === "medium" ? 1.6 : 0.9, thr = (level === "easy" ? 3 : level === "medium" ? 4.5 : 5.5) - 2 * imp;
  const meanMs = (level === "easy" ? 1900 : level === "medium" ? 1500 : 1200) - 350 * imp, miss = level === "easy" ? 0.12 : level === "medium" ? 0.05 : 0.02;
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rand() + 1e-9)) * Math.cos(2 * Math.PI * rand());
  const text = mini.kind === "accusa" ? mini.text ?? undefined : undefined;
  const taste = (pos: number) => { let h = 11; for (const ch of `${me}:${pos}`) h = (h * 33 + ch.charCodeAt(0)) | 0; return ((Math.abs(h) % 1000) / 1000) * 2; };
  const base = (pos: number): number => {
    const t = s.tower.find((x) => x.position === pos)!;
    if (mini.kind === "accusa") { const a = text ? affinity(t.cardId, text) : null; return (a ?? 0) + taste(pos) * 0.3; }
    if (mini.kind === "peggiore") return 4 * ((mem.fell[t.cardId] ?? 0) / ((mem.shown[t.cardId] ?? 0) + 1)) + taste(pos) * 2.5;
    return taste(pos) * 2.5;   // storia d'amore: nessun indizio, contano i gusti
  };
  const est: Record<number, number> = {};   // il giudizio su una carta si forma la prima volta che la si vede e non cambia
  const react = () => Math.max(650, Math.min(2750, meanMs * Math.exp(0.3 * gauss())));
  for (let i = 0; i < order.length; i++) {
    const pos = order[i]!, cyc = Math.floor(i / per); if (est[pos] === undefined) est[pos] = base(pos) + sigma * gauss();
    const seen = Object.values(est), best = Math.max(...seen), isBest = est[pos]! >= best - 1e-9, all = seen.length >= s.tower.length;
    const go = cyc === 0 ? isBest && est[pos]! >= thr && rand() < 0.5 + 0.5 * imp
      : cyc === 1 ? all && isBest && rand() < 0.55 + 0.35 * imp
      : all && isBest && rand() < 0.93;
    if (go) { if (rand() < miss && !force) return null; return { position: pos, slot: i, delayMs: Math.round(react()) }; }
  }
  if (!force) return null;   // (simulazioni del motore: vota comunque la carta che gli sembrava migliore)
  const top = Number(Object.entries(est).sort((a, b) => b[1] - a[1])[0]?.[0] ?? order[0]);
  return { position: top, slot: order.lastIndexOf(top), delayMs: 1500 };
}
