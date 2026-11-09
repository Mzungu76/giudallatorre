import { luiAvailable, luiForbidden, luiTokens, megafonoOf, requiredPlayers } from "./engine.ts";
import { affinity, phraseTagCount } from "./tags.ts";
import type { Action, CardId, GameState, LuiSpec, PlayerId, TurnResult } from "./types.ts";

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
const phraseText = (s: GameState) => (s.phrase && s.phrase.mode === "card" ? s.phrase.text : undefined);

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
const pickProb = (w: number[], rand: () => number) => { const z = w.reduce((a, b) => a + b, 0); let u = rand() * z; for (let k = 0; k < w.length; k++) { u -= w[k]!; if (u <= 0) return k; } return w.length - 1; };
/** Parametri di taratura dei bot (modificabili dai test di taratura). */
export const TUNE = { reactHard: 0.25, reactMed: 0.12, luiTempHard: 0.7, luiTempMed: 1.3, luiSamples: 70, tempHard: 1.6, ownBonus: true, hardNoise: 0.12, feedMega: 0.35, voteTemp: 0.12, voteTempMed: 0.22, medNoise: 1.0, medVary: 0.25, greggeTokTempHard: 2, greggeTokTempMed: 3, greggePosTempHard: 1.6, greggePosTempMed: 2.2, greggeBluff: 0.4, greggeBlurHard: 1.5, greggeBlurMed: 2.2, greggeTrait: 0.4, greggeReact: 1.0, greggeDoubtHard: 0.35, greggeDoubtMed: 0.45 };
const argmax = (a: number[]) => a.indexOf(Math.max(...a));

export function chooseBotAction(s: GameState, me: PlayerId, level: BotLevel, mem: BotMemory, rand: () => number): Action | null {
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
      const score = (c: CardId) => { const a = text ? affinity(c, text) : null; return (a ?? hist(c) * 3) + rand() * (level === "hard" ? 0.6 : 2.5); };
      return { type: "playCard", playerId: me, cardId: hand.slice().sort((a, b) => score(b) - score(a))[0]! };
    }
    case "SUSPECT": {
      if (me !== mega) return null;
      const av = luiAvailable(s, me), specs = luiTokens(s).filter((x) => av.includes(x.slot));
      if (level === "easy") return { type: "placeLui", playerId: me, slot: pick(specs).slot, position: 1 + Math.floor(rand() * n) };
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
    case "MINI_PLAY": {
      if (s.played[me] !== undefined || !s.mini) return null;
      const hand = s.hands[me]!, mini = s.mini;
      if (level === "easy") return { type: "playCard", playerId: me, cardId: pick(hand) };
      if (mini.kind === "peggiore") {
        // il personaggio che più spesso è caduto (quello che il gruppo considera il peggiore) prende più voti, e ogni voto sono punti per me
        const bad = (c: CardId) => ((mem.fell[c] ?? 0) + 0.5) / ((mem.shown[c] ?? 0) + 2) + rand() * (level === "hard" ? 0.25 : 0.7);
        return { type: "playCard", playerId: me, cardId: hand.slice().sort((a, b) => bad(b) - bad(a))[0]! };
      }
      // Accusa: la carta più "colpevole" è quella che il gruppo voterà (e che sale: ×2 per me); Storia d'amore: carta imprevedibile, spesso con gusti simili
      const text = mini.kind === "accusa" ? mini.text ?? undefined : undefined;
      const sc = (c: CardId) => { const a = text ? affinity(c, text) : null; return (a ?? 0) + rand() * (level === "hard" ? 2.2 : 3.2); };
      return { type: "playCard", playerId: me, cardId: hand.slice().sort((x, y) => sc(y) - sc(x))[0]! };
    }
    case "MINI_VOTE": {
      if (s.votes[me] !== undefined || !s.mini) return null;
      const mini = s.mini, vote = (position: number): Action => ({ type: "vote", playerId: me, position });
      const sample = (w: number[]) => { const z = w.reduce((x, y) => x + y, 0); let u = rand() * z; for (let k = 0; k < w.length; k++) { u -= w[k]!; if (u <= 0) return k; } return w.length - 1; };
      const own = s.tower.find((t) => t.ownerId === me)?.position ?? -1;
      if (mini.kind === "peggiore") {
        // la propria carta non si può votare; tra le altre voto il "peggiore": le carte che cadono spesso un po' di più, in modo imprevedibile
        if (level === "easy") return vote(pick(s.tower.map((t) => t.position).filter((p) => p !== own)));
        const w = s.tower.map((t) => (t.position === own ? 0 : 1 + 0.8 * ((mem.fell[t.cardId] ?? 0) / ((mem.shown[t.cardId] ?? 0) + 1))) * (0.6 + rand()));
        return vote(sample(w) + 1);
      }
      if (level === "easy") return vote(1 + Math.floor(rand() * n));
      // Accusa / amore: prendo punti se voto una carta che arriva in testa → seguo il gruppo; la mia carta in testa vale il doppio
      const text = mini.kind === "accusa" ? mini.text ?? undefined : undefined;
      const aff = s.tower.map((t) => { const a = text ? affinity(t.cardId, text) : null; return a === null ? 0 : a; });
      const temp = level === "hard" ? 1.5 : 2.5;
      const w = softmax(aff.map((a, k) => a / temp + (k + 1 === own ? (level === "hard" ? 0.5 : 0.2) : 0)));
      return vote(sample(w.map((x) => x + 0.04)) + 1);
    }
    default: return null;
  }
}
