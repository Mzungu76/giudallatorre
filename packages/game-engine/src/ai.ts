import { luiAvailable, luiForbidden, luiTokens, megafonoOf, objectiveHit, requiredPlayers, tallyMarks, tallyVotes } from "./engine.ts";
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

/** Memoria della stanza: personaggi mostrati/caduti e, per ogni Megafono, quante volte ha scommesso "Cade lui!" (reputazione). Serializzabile. */
export interface BotMemory { shown: Record<CardId, number>; fell: Record<CardId, number>; turns: number; lui?: Record<PlayerId, { c: number; n: number }>; /** «Il gregge»: Lui! scoperti negli spogli, e quanti erano l'Imbroglio!. */ imb?: { t: number; n: number } }
export const newBotMemory = (): BotMemory => ({ shown: {}, fell: {}, turns: 0, lui: {} });
export function learnFromResult(mem: BotMemory, tower: { cardId: CardId }[], result: TurnResult): void {
  for (const t of tower) mem.shown[t.cardId] = (mem.shown[t.cardId] ?? 0) + 1;
  for (const c of result.fallenCardIds ?? [result.fallenCardId]) mem.fell[c] = (mem.fell[c] ?? 0) + 1; mem.turns += 1;
  if (result.lui && (result.lui.trap || result.lui.herd)) { const m = (mem.imb ??= { t: 0, n: 0 }); m.n += 1; if (result.lui.trap) m.t += 1; }
}
/** Stima dalla sola storia: uniforme senza dati, poi inclina verso le carte che cadono spesso. */
function histProbs(s: GameState, mem: BotMemory): number[] {
  const w = s.tower.map((t) => 1 + ((mem.fell[t.cardId] ?? 0) + 0.5) / ((mem.shown[t.cardId] ?? 0) + 2) * s.tower.length);
  const z = w.reduce((a, b) => a + b, 0); return w.map((x) => x / z);
}
const softmax = (xs: number[]) => { const m = Math.max(...xs), e = xs.map((x) => Math.exp(x - m)), z = e.reduce((a, b) => a + b, 0); return e.map((x) => x / z); };
const normalize = (p: number[]) => { const z = p.reduce((a, b) => a + b, 0); return p.map((x) => x / z); };
const phraseText = (s: GameState) => (s.phrase ? s.phrase.text : undefined);   // anche la frase inventata: è visibile a tutti, i bot ne deducono le etichette dalle parole

/** Probabilità stimata che il gruppo voti (e quindi cada) ciascuna posizione della Torre. */
export function crowdProbs(s: GameState, mem: BotMemory, level: BotLevel): number[] {
  const hist = histProbs(s, mem), text = phraseText(s);
  const aff = text ? s.tower.map((t) => affinity(t.cardId, text)) : [];
  if (!text || aff.some((a) => a === null)) return hist;
  const p = softmax((aff as number[]).map((a) => a / (level === "hard" ? TUNE.tempHard : 3)));
  return p.map((x, i) => 0.85 * x + 0.15 * hist[i]!);
}
/** Estrae i voti di `n` votanti dalla stima p e restituisce i conteggi per carta. */
function sampleVotes(p: number[], n: number, rand: () => number): number[] {
  const c = new Array(p.length).fill(0);
  for (let i = 0; i < n; i++) { let u = rand(), k = 0; for (; k < p.length - 1; k++) { u -= p[k]!; if (u <= 0) break; } c[k]++; }
  return c;
}
const luiHit = (zero: boolean, k: number, others: number) => (zero ? others === 0 : others >= k);
/** Valore per il Megafono di un segnalino sulla carta `pos` con i voti degli altri `c`.
 *  «Il gregge»: conta il vantaggio sugli avversari (i miei punti meno la media dei loro, su `opp` avversari). L'Imbroglio! dà i suoi punti se annulla almeno un voto
 *  e toglie i +2 del voto giusto a chi ci casca; la soglia riuscita dà i punti a me ma anche a chi ha votato la carta. */
const luiValue = (sp: LuiSpec, c: number[], pos: number, opp = 1) => {
  if (sp.herd) return luiHit(false, sp.k, c[pos]!) ? sp.pts * (1 - c[pos]! / opp) : 0;
  if (!sp.trap) return luiHit(sp.slot === "zero", sp.k, c[pos]!) ? sp.pts : 0;
  return (c[pos]! >= sp.k ? sp.pts : 0) + (c[pos]! === Math.max(...c) ? (c[pos]! * 2) / opp : 0);
};
/** Carattere di un bot (da -1 diffidente a +1 fiducioso), fisso per tutta la partita: rende i bot diversi tra loro, così non vanno tutti nella stessa direzione. */
const trait = (id: PlayerId) => { let h = 7; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0; return ((Math.abs(h) % 1000) / 1000) * 2 - 1; };
/** «Il gregge»: per chi vota, quanto vale (vantaggio sugli avversari) votare la carta X del Lui!, dati i pesi dei due gettoni `post`.
 *  `so`: voti simulati degli altri (né io né il Megafono). */
function luiVoteValue(s: GameState, p: number[], X: number, post: number[], own2: number, so: number[][]): number {
  const opp = s.playerIds.length - 1, specs = luiTokens(s); let vX = 0;
  specs.forEach((sp, i) => {
    if (!(post[i]! > 0)) return;
    // Imbroglio!: il mio voto non vale e, se sono il primo, regalo i punti al Megafono
    if (sp.trap) { vX += post[i]! * -(sp.pts / opp) * (so.filter((c) => c[X]! === 0).length / so.length); return; }
    // soglia: se ci si arriva prendo i punti anch'io, ma li prendono anche il Megafono e gli altri che l'hanno votata
    let d = 0; for (const c of so) { const x = c[X]!, withMe = x + 1 >= sp.k, without = x >= sp.k; d += (withMe ? sp.pts : 0) - ((withMe ? sp.pts * (1 + x) : 0) - (without ? sp.pts * (1 + x) : 0)) / opp; }
    vX += post[i]! * (p[X]! * (2 + own2) + d / so.length);
  });
  return vX;
}
/** «Il gregge»: quanto la carta del Lui! attira (>1) o respinge (<1) i voti. Chi vota non vede il gettone, quindi la reazione è la stessa per i due:
 *  dipende da quanto conviene votarla senza sapere quale sia (con le stime a priori). */
function luiPull(s: GameState, p: number[], pos: number, prior: number[], rand: () => number): number {
  const so = Array.from({ length: Math.ceil(TUNE.luiSamples / 2) }, () => sampleVotes(p, s.playerIds.length - 2, rand));
  const v = luiVoteValue(s, p, pos, prior, 0, so), base = p[pos]! * 2;
  return Math.max(0.2, Math.min(4, Math.exp((v - base) / TUNE.greggeReact)));
}
/** «Il gregge»: valore per il Megafono di ogni (gettone, carta), con la reazione di chi vota alla carta del Lui! (uguale per i due gettoni)
 *  e sapendo che la carta del Lui! lui non potrà votarla (forse perde il +2). */
function greggeEv(s: GameState, p: number[], specs: LuiSpec[], prior: number[], rand: () => number): number[][] {
  const n = s.tower.length, voters = s.playerIds.length - 1, pull = Array.from({ length: n }, (_, pos) => luiPull(s, p, pos, prior, rand));
  return specs.map((sp) => Array.from({ length: n }, (_, pos) => {
    const q = p.map((x, k) => (k === pos ? x * pull[pos]! : x)), z = q.reduce((a, b) => a + b, 0), pq = q.map((x) => x / z);
    let ev = 0; for (let i = 0; i < TUNE.luiSamples; i++) ev += luiValue(sp, sampleVotes(pq, voters, rand), pos, voters);
    return ev / TUNE.luiSamples - 2 * p[pos]!;
  }));
}
/** Stima a priori dei due gettoni del Megafono: quali gli restano e quanto spesso finora è uscito l'Imbroglio! negli spogli (informazione pubblica). */
function greggePrior(s: GameState, mem: BotMemory): number[] {
  const av = luiAvailable(s, megafonoOf(s)), im = mem.imb ?? { t: 0, n: 0 }, pt = (im.t + 1) / (im.n + 2);
  return luiTokens(s).map((sp) => (!av.includes(sp.slot) ? 0 : av.length === 1 ? 1 : sp.trap ? pt : 1 - pt));
}
/**
 * «Il gregge»: come il Megafono sceglie gettone e carta, come probabilità di ogni (gettone, carta). Prima il gettone, poi la carta, tutti e due in modo
 * imprevedibile: non sempre il gettone che rende di più, non sempre la carta più votata (bluff). Lo stesso modello lo usano gli altri per indovinare il gettone.
 */
function greggePlan(s: GameState, p: number[], level: BotLevel, mem: BotMemory, rand: () => number, blur = 1): number[][] {
  const mega = megafonoOf(s), specs = luiTokens(s), av = luiAvailable(s, mega), ev = greggeEv(s, p, specs, greggePrior(s, mem), rand), hard = level === "hard";
  // il carattere del Megafono: chi è più bluffone azzarda di più (carte meno ovvie, gettone meno scontato). `blur`: chi lo immagina da fuori lo vede più sfocato
  const bl = (1 + TUNE.greggeBluff * trait(mega)) * blur;
  const tTok = (hard ? TUNE.greggeTokTempHard : TUNE.greggeTokTempMed) * bl, tPos = (hard ? TUNE.greggePosTempHard : TUNE.greggePosTempMed) * bl;
  const best = ev.map((row, i) => (av.includes(specs[i]!.slot) ? Math.max(...row) : -Infinity)), pTok = softmax(best.map((b) => (b === -Infinity ? -1e9 : b / tTok)));
  return ev.map((row, i) => { const pp = softmax(row.map((e) => e / tPos)); return pp.map((x) => x * pTok[i]!); });
}
/** «Il gregge»: chi vota vede il Lui! ma non il gettone. Lo stima con il modello del Megafono (quale gli conveniva posare proprio lì),
 *  con quanto spesso finora è uscito l'Imbroglio! negli spogli (informazione pubblica) e con un po' di dubbio. */
function greggePosterior(s: GameState, p: number[], level: BotLevel, mem: BotMemory, rand: () => number): number[] {
  const X = s.lui!.position - 1, prior = greggePrior(s, mem);
  // non conosco il carattere del Megafono né come ragiona di preciso: me lo immagino un po' sfocato (il Medio di più)
  const plan = greggePlan(s, p, "hard", mem, rand, level === "hard" ? TUNE.greggeBlurHard : TUNE.greggeBlurMed), like = plan.map((row, i) => (prior[i]! > 0 ? row[X]! : 0)), t = like.reduce((a, b) => a + b, 0);
  if (!(t > 0)) return prior;
  const a = level === "hard" ? TUNE.greggeDoubtHard : TUNE.greggeDoubtMed;
  return like.map((l, i) => (1 - a) * (l / t) + a * prior[i]!);
}
// ---------- variante PROPAGANDA ----------
const sampleOne = (p: number[], rand: () => number) => { let u = rand(), k = 0; for (; k < p.length - 1; k++) { u -= p[k]!; if (u <= 0) break; } return k + 1; };
/** PROPAGANDA: voti simulati di tutti tranne `skip` (posizioni 1..N), dalla stima del gruppo. */
function propSample(s: GameState, p: number[], skip: PlayerId[], rand: () => number): Record<PlayerId, number>[] {
  return Array.from({ length: TUNE.propSamples }, () => Object.fromEntries(s.playerIds.filter((x) => !skip.includes(x)).map((x) => [x, sampleOne(p, rand)])));
}
/** PROPAGANDA: quanto vale per il Megafono un esito (vantaggio sugli altri): +2 se cade la carta che vota, +2 se cade la sua (variante «Il Megafono sa»),
 *  obiettivo centrato (+punti) o mancato (i punti vanno a chi ha votato il personaggio: per lui sono punti regalati). */
function propMegaValue(s: GameState, mega: PlayerId, votes: Record<PlayerId, number>, spec: LuiSpec | undefined, lui: LuiToken | null): number {
  const pos = s.tower.map((t) => t.position), T = tallyVotes(pos, votes, mega, spec, lui), opp = s.playerIds.length - 1;
  let v = T.fallen.includes(votes[mega]!) ? 2 : 0;
  const own = s.tower.find((t) => t.ownerId === mega)?.position; if (own && T.fallen.includes(own)) v += 2;
  const o = s.objective;
  if (o) { const n = T.counts[o.position] ?? 0; if (objectiveHit(o, n)) v += o.pts; else v -= (o.pts * s.playerIds.filter((x) => x !== mega && !T.annulled.includes(x) && votes[x] === o.position).length) / opp; }
  return v;
}
/** PROPAGANDA, il Megafono: per ogni gettone, carta (e, con Dirottamento!, carta di arrivo) e proprio voto, il valore medio sui voti simulati. Sceglie in modo un po' imprevedibile. */
function propMegaPlace(s: GameState, me: PlayerId, level: BotLevel, mem: BotMemory, rand: () => number): Action {
  const p = crowdProbs(s, mem, level), n = s.tower.length, av = luiAvailable(s, me), specs = luiTokens(s).filter((x) => av.includes(x.slot)), smp = propSample(s, p, [me], rand);
  const cands: { slot: string; pos: number; to?: number; ev: number }[] = [];
  for (const sp of specs) for (let pos = 1; pos <= n; pos++) for (const to of sp.effect === "dirottamento" ? Array.from({ length: n }, (_, i) => i + 1).filter((x) => x !== pos) : [undefined]) {
    const lui: LuiToken = to ? { slot: sp.slot, position: pos, to } : { slot: sp.slot, position: pos };
    // il mio voto lo sceglierò dopo: qui conto il migliore
    let best = -Infinity; for (let mv = 1; mv <= n; mv++) { let ev = 0; for (const v of smp) ev += propMegaValue(s, me, { ...v, [me]: mv }, sp, lui); best = Math.max(best, ev / smp.length); }
    cands.push({ slot: sp.slot, pos, ...(to ? { to } : {}), ev: best });
  }
  const tau = level === "hard" ? TUNE.propTempHard : TUNE.propTempMed, top = Math.max(...cands.map((c) => c.ev)), ch = cands[pickProb(softmax(cands.map((c) => (c.ev - top) / tau)), rand)]!;
  return { type: "placeLui", playerId: me, slot: ch.slot, position: ch.pos, ...(ch.to ? { to: ch.to } : {}) };
}
/** PROPAGANDA, voto. Il Megafono sa quale gettone ha posato e il suo obiettivo; gli altri vedono il Lui! ma non il gettone (pesano i due che può avere)
 *  e non sanno su quale personaggio è l'obiettivo pubblico (se si avvera, prende i punti chi l'ha votato). */
function propVote(s: GameState, me: PlayerId, level: BotLevel, mem: BotMemory, rand: () => number): Action {
  const p = crowdProbs(s, mem, level), n = s.tower.length, mega = megafonoOf(s), hard = level === "hard";
  const vals: number[] = [];
  if (me === mega) {
    const spec = s.lui ? luiTokens(s).find((x) => x.slot === s.lui!.slot) : undefined, smp = propSample(s, p, [me], rand);
    for (let mv = 1; mv <= n; mv++) vals.push(smp.reduce((a, v) => a + propMegaValue(s, me, { ...v, [me]: mv }, spec, s.lui), 0) / smp.length);
  } else {
    const av = luiAvailable(s, mega), specs = luiTokens(s).filter((x) => av.includes(x.slot)), own = s.tower.find((t) => t.ownerId === me)?.position;
    const o = s.objective, smp = propSample(s, p, [me, mega], rand), pos = s.tower.map((t) => t.position);
    for (let k = 1; k <= n; k++) {
      let ev = 0;
      for (const v of smp) {
        // il gettone non lo vedo: uno dei due che gli restano, a caso; il voto del Megafono: dalla stima del gruppo; il personaggio dell'obiettivo: uno qualsiasi
        const sp = s.lui ? specs[Math.floor(rand() * specs.length)] : undefined, lui: LuiToken | null = s.lui ? { slot: sp!.slot, position: s.lui.position, ...(sp!.effect === "dirottamento" ? { to: sampleOne(p, rand) } : {}) } : null;
        if (lui?.to === lui?.position) delete lui!.to;
        const votes = { ...v, [mega]: sampleOne(p, rand), [me]: k }, T = tallyVotes(pos, votes, mega, sp, lui), valid = !T.annulled.includes(me);
        if (valid && T.fallen.includes(k)) ev += 2;
        if (own && T.fallen.includes(own)) ev += 2;
        if (o && valid) { const t = 1 + Math.floor(rand() * n); if (t === k && !objectiveHit(o, T.counts[t] ?? 0)) ev += o.pts; }
      }
      vals.push(ev / smp.length);
    }
  }
  const ww = softmax(vals.map((x) => x / (hard ? TUNE.propVoteTempHard : TUNE.propVoteTempMed)));
  return { type: "vote", playerId: me, position: pickProb(ww.map((x) => x + 0.03), rand) + 1 };
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
export const TUNE = { reactHard: 0.25, reactMed: 0.12, luiTempHard: 0.7, luiTempMed: 1.3, luiSamples: 70, tempHard: 1.6, ownBonus: true, hardNoise: 0.12, feedMega: 0.35, voteTemp: 0.12, voteTempMed: 0.22, medNoise: 1.0, medVary: 0.25, greggeTokTempHard: 2, greggeTokTempMed: 3, greggePosTempHard: 1.6, greggePosTempMed: 2.2, greggeBluff: 0.4, bluffLambda: 0.5, easyLapse: 0.6, mediumLapse: 0.2, greggeBlurHard: 1.5, greggeBlurMed: 2.2, greggeTrait: 0.4, greggeReact: 1.0, greggeDoubtHard: 0.35, greggeDoubtMed: 0.45, propSamples: 36, propTempHard: 0.6, cncTempHard: 0.3, cncVoteTempHard: 0.12, propTempMed: 1.2, propVoteTempHard: 0.35, propVoteTempMed: 0.6 };
const argmax = (a: number[]) => a.indexOf(Math.max(...a));

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
      const av = luiAvailable(s, me), specs = luiTokens(s).filter((x) => av.includes(x.slot));
      if (s.cnc) {
        if (level === "easy") return { type: "placeMarks", playerId: me, marks: [{ slot: CNC_TYPES[Math.floor(rand() * 3)]!, position: 1 + Math.floor(rand() * n) }] };
        return cncPlace(s, me, level, mem, rand, sk, st);
      }
      if (level === "easy") { const sp = pick(specs), position = 1 + Math.floor(rand() * n); return { type: "placeLui", playerId: me, slot: sp.slot, position, ...(sp.effect === "dirottamento" ? { to: (position % n) + 1 } : {}) }; }
      if (s.propaganda) return propMegaPlace(s, me, level, mem, rand);
      // scommessa sul numero di voti degli ALTRI sulla carta: valore atteso di ogni (segnalino, carta) con voti simulati dalla stima del gruppo; scelgo in modo imprevedibile tra le migliori
      const p = crowdProbs(s, mem, level), voters = s.playerIds.length - 1, samples = Array.from({ length: TUNE.luiSamples }, () => sampleVotes(p, voters, rand));
      const cands: { slot: string; pos: number; ev: number }[] = [];
      if (s.gregge) {
        const all = luiTokens(s), plan = greggePlan(s, p, level, mem, rand), flat = plan.flatMap((row, i) => row.map((w, pos) => ({ slot: all[i]!.slot, pos, w })));
        const ch = flat[pickProb(flat.map((x) => x.w), rand)]!;
        return { type: "placeLui", playerId: me, slot: ch.slot, position: ch.pos + 1 };
      }
      for (const sp of specs) for (let pos = 0; pos < n; pos++) { let ev = 0; for (const c of samples) ev += luiValue(sp, c, pos); cands.push({ slot: sp.slot, pos, ev: ev / samples.length }); }
      const tau = level === "hard" ? TUNE.luiTempHard : TUNE.luiTempMed, best = Math.max(...cands.map((c) => c.ev));
      const w = softmax(cands.map((c) => (c.ev - best) / tau)), ch = cands[pickProb(w, rand)]!;
      return { type: "placeLui", playerId: me, slot: ch.slot, position: ch.pos + 1 };
    }
    case "VOTE": {
      if (s.votes[me] !== undefined) return null;
      const vote = (position: number): Action => ({ type: "vote", playerId: me, position });
      const banned = luiForbidden(s, me);   // «Il gregge»: il Megafono non vota la carta del suo Lui!
      if (level === "easy") { const opts = s.tower.map((t) => t.position).filter((x) => x !== banned); return vote(opts[Math.floor(rand() * opts.length)]!); }
      if (s.propaganda) return propVote(s, me, level, mem, rand);
      if (s.cnc) return cncVote(s, me, level, mem, rand, sk, st);
      const p = crowdProbs(s, mem, level), lui = s.lui, ownPos = s.tower.find((t) => t.ownerId === me)?.position ?? -1, hard = level === "hard";
      let harm = 0, X = lui ? lui.position - 1 : -1;
      if (lui && me !== mega && !s.gregge) {
        // Vedo il Lui! su X ma non il numero né quali gettoni gli restano: stimo quale ha giocato tra i due della partita e quanto il mio voto su X gli regala o gli toglie
        const specs = luiTokens(s), others = s.playerIds.length - 2;
        const samples = Array.from({ length: TUNE.luiSamples }, () => sampleVotes(p, others, rand));
        const ev = specs.map((sp) => samples.reduce((a, c) => a + luiValue(sp, c, X), 0) / samples.length), top = Math.max(...ev);
        const wt = softmax(ev.map((e) => (e - top) / 1.0));
        specs.forEach((sp, i) => { const d = samples.reduce((a, c) => a + ((luiHit(sp.slot === "zero", sp.k, c[X]! + 1) ? 1 : 0) - (luiHit(sp.slot === "zero", sp.k, c[X]!) ? 1 : 0)) * sp.pts, 0) / samples.length; harm += wt[i]! * d; });
      }
      const w = hard ? TUNE.reactHard : TUNE.reactMed;
      if (lui && me !== mega && s.gregge) {
        // «Il gregge»: il valore del voto sulla carta del Lui! si ricalcola da capo, pesando i due gettoni con quanto è probabile che il Megafono li abbia posati proprio lì
        const post = greggePosterior(s, p, level, mem, rand), so = Array.from({ length: TUNE.luiSamples }, () => sampleVotes(p, s.playerIds.length - 2, rand));
        const tr = trait(me), own2 = (X + 1 === ownPos ? 2 : 0);
        // il mio carattere: chi è diffidente teme di più l'Imbroglio! e si fida meno della soglia
        const qT = post.map((q, i) => (luiTokens(s)[i]!.trap ? q : 0)).reduce((a, b) => a + b, 0), shift = Math.max(0, Math.min(1, qT - tr * TUNE.greggeTrait)) - qT;
        const wpost = luiTokens(s).map((sp, i) => { const t0 = post[i]!; if (!t0) return 0; return sp.trap ? t0 + shift : t0 - shift * (t0 / Math.max(1e-9, 1 - qT)); });
        const vX = luiVoteValue(s, p, X, wpost, own2, so);
        const val = p.map((x, k) => (k === X ? vX : x * (2 + (k + 1 === ownPos ? 2 : 0))));
        const ww = softmax(val.map((x) => x / (hard ? TUNE.voteTemp : TUNE.voteTempMed)));
        return vote(pickProb(ww.map((x) => x + 0.04), rand) + 1);
      }
      // Il Megafono vota la carta che pensa più probabile (+2); gli altri: probabilità di caduta, bonus per la mia carta, e correzione per il Lui!
      const val = p.map((x, k) => x * (2 + (k + 1 === ownPos ? 2 : 0)) - (k === X ? w * harm : 0) * (me === mega ? 0 : 1));
      const ww = softmax(val.map((x) => x / (hard ? TUNE.voteTemp : TUNE.voteTempMed)));
      return vote(pickProb(ww.map((x, k) => (k + 1 === banned ? 0 : x + 0.04)), rand) + 1);
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
