import { affinity as affinityOld } from "../tags.ts";
import { hash32 } from "./lens.ts";
import type { Lens } from "./lens.ts";

/**
 * Etichette v2 («occhi dei bot»): catalogo unico di tipi e temi, con peso 1–3 (quanto l'etichetta è centrale) su carte e frasi.
 * Usate SOLO dal bot v2 e solo con TUNE.labelsV2 = 1 (registro vuoto o leva a 0 → comportamento identico a prima). Non toccano tags.ts.
 *
 * `affinityV2` (esatta): per ogni etichetta in comune, base (tipo 3, tema 2) × (peso carta + peso frase) / 6.
 * `affinityV2m` (morbida, TUNE.labelsSmooth): conta anche le etichette *imparentate* (es. «avaro» ~ «soldi»), perché le coincidenze esatte sono rare
 * (con 5 carte a caso, per quasi 4 frasi su 10 nessuna carta ha un'etichetta in comune: il bot non ha alcun indizio). La parentela tra due etichette è il coseno
 * dei loro profili (in quali frasi e carte compaiono insieme). E per le frasi scritte a mano (senza etichette) deduce le etichette dalle parole, ma solo se
 * l'indizio è abbastanza forte: meglio nessun indizio che un indizio sbagliato.
 */
export interface Tag2 { tipi: Record<string, number>; temi: Record<string, number> }
let CARDS: Record<string, Tag2> = {}, PHRASES: Record<string, Tag2> = {};
/** Parentela tra etichette: soglia minima del coseno e quanto pesa rispetto a una coincidenza esatta. */
export const SMOOTH = { theta: 0.2, beta: 0.6, minDf: 2, minScore: 1.0 };
const SIM = new Map<string, number>();
const NEIGH = new Map<string, [string, number][]>(), PROF = new Map<string, { sal: number; fun: number }>();
let DF = new Map<string, number>(), CNT = new Map<string, Map<string, number>>(), NDOC = 0;

const FUNNY = new Set(["eccentrico", "goffo", "drammatico", "festaiolo", "vanitoso", "influencer", "artista", "guru", "complottista", "mangione", "pettegolo", "ribelle"]);
const feats = (x: Tag2): [string, number][] => [...Object.entries(x.tipi).map(([k, w]) => ["t:" + k, w] as [string, number]), ...Object.entries(x.temi).map(([k, w]) => ["m:" + k, w] as [string, number])];
const STOP = new Set("sale salgono sulla torre oggi troppo tutto chi che con per una uno degli delle dello nella nelle sono come piu anche questo questa quelli quelle tutti tutte loro suo sua suoi sue sempre molto dopo prima ogni cosa cose essere fare fatto sarebbe primo quando senza dalla alla della".split(" "));
const stems = (t: string): string[] => [...new Set(t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 4 && !STOP.has(w)).map((w) => w.slice(0, 5)))];

export function registerTagsV2(cards: Record<string, Tag2>, phrases: Record<string, Tag2>): void {
  CARDS = cards; PHRASES = phrases; SIM.clear(); NEIGH.clear(); PROF.clear(); DF = new Map(); CNT = new Map(); NDOC = 0;
  if (!Object.keys(cards).length) return;
  // parentela tra etichette: coseno dei profili (in quali frasi/carte compaiono, pesate)
  const vec = new Map<string, Map<number, number>>(); let i = 0;
  for (const it of [...Object.values(phrases), ...Object.values(cards)]) { for (const [k, w] of feats(it)) { let m = vec.get(k); if (!m) vec.set(k, (m = new Map())); m.set(i, w / 3); } i++; }
  const norm = (m: Map<number, number>) => Math.sqrt([...m.values()].reduce((s, x) => s + x * x, 0)), tags = [...vec.keys()];
  for (const a of tags) for (const b of tags) { if (a === b) continue; const va = vec.get(a)!, vb = vec.get(b)!; let d = 0; for (const [j, w] of va) { const u = vb.get(j); if (u) d += w * u; } const c = d / (norm(va) * norm(vb)); if (c >= SMOOTH.theta) { SIM.set(a + "|" + b, c); let n = NEIGH.get(a); if (!n) NEIGH.set(a, (n = [])); n.push([b, c]); } }
  // profilo di ogni carta: salienza (ricchezza di tratti forti) e gusto per il buffo
  let mx = 0; const raw = Object.entries(cards).map(([id, c]) => { const t = feats(c).reduce((s, [, w]) => s + w, 0), f = Object.entries(c.tipi).filter(([k]) => FUNNY.has(k)).reduce((s, [, w]) => s + w, 0); mx = Math.max(mx, t); return [id, t, f] as const; });
  for (const [id, t, f] of raw) PROF.set(id, { sal: mx ? t / mx : 0.5, fun: Math.min(1, f / 5) });
  // dizionario parole → etichette (dalle frasi etichettate) per le frasi scritte a mano
  for (const [text, tg] of Object.entries(phrases)) { NDOC++; for (const w of stems(text)) { DF.set(w, (DF.get(w) ?? 0) + 1); let m = CNT.get(w); if (!m) CNT.set(w, (m = new Map())); for (const [t, wt] of feats(tg)) m.set(t, (m.get(t) ?? 0) + wt / 3); } }
}
/** Luoghi comuni su ruoli e mestieri (content/etichette/stereotipi.json): `ruolo` (un tipo della carta) → `tratto` (un tipo), con forza 1–3. */
export interface Stereo { ruolo: string; tratto: string; forza: number; /** «ruolo» (asse dei ruoli, ruoli.json) oppure «tipo» (un tipo della carta). */ asse?: "ruolo" | "aspetto" | "tipo" }
const STEREO = new Map<string, [string, number][]>();
/** Tetto: un luogo comune non può aggiungere a una carta più di questo peso totale (nessuna carta attira voti solo per i pregiudizi). */
export const STEREO_CAP = 2;
export function registerStereotypes(voci: Stereo[]): void { STEREO.clear(); for (const v of voci) { const k = (v.asse === "ruolo" ? "r:" : v.asse === "aspetto" ? "a:" : "t:") + v.ruolo; let a = STEREO.get(k); if (!a) STEREO.set(k, (a = [])); a.push(["t:" + v.tratto, v.forza]); } }
/** I tratti che questa lente aggiunge a una carta per luogo comune: solo alcuni dei luoghi comuni (a caso ma fissi per lente e carta), pesati dalla forza e dal pregiudizio del bot, con tetto. */
export function stereoTags(cardId: string, lens: Lens): [string, number][] {
  const c = CARDS[cardId]; if (!c || lens.stereo <= 0) return [];
  const out: [string, number][] = []; let tot = 0;
  const cues = [...Object.keys(c.tipi).map((x) => "t:" + x), ...(CARDROLES.get(cardId) ?? []).map((x) => "r:" + x), ...(CARDLOOKS.get(cardId) ?? []).map((x) => "a:" + x)];
  for (const cue of cues) for (const [tratto, f] of STEREO.get(cue) ?? []) {
    const ruolo = cue;
    if ((hash32(`${lens.seed}|${cardId}|${ruolo}|${tratto}`) % 1000) / 1000 >= lens.stereo) continue;   // questo bot non ha quel luogo comune
    const w = Math.min(STEREO_CAP - tot, f * lens.stereo * 0.8); if (w <= 0.05) continue; out.push([tratto, w]); tot += w;
  }
  return out;
}
/** Asse dei ruoli (content/etichette/ruoli.json): ruoli di ogni carta e temi di contesto che ogni ruolo porta con sé. */
const CARDROLES = new Map<string, string[]>(), ROLETEMI = new Map<string, string[]>();
export function registerRoles(ruoli: { id: string; temi: string[] }[], carte: Record<string, string[]>): void {
  CARDROLES.clear(); ROLETEMI.clear(); for (const r of ruoli) ROLETEMI.set(r.id, r.temi); for (const [c, rs] of Object.entries(carte)) CARDROLES.set(c, rs);
}
/** Asse dell'aspetto scelto (content/etichette/aspetto.json): abbigliamento e accessori di ogni carta. Serve solo ai luoghi comuni. */
const CARDLOOKS = new Map<string, string[]>();
const LOOKNAME = new Map<string, string>();
export function registerLooks(carte: Record<string, string[]>, nomi: Record<string, string> = {}): void { CARDLOOKS.clear(); LOOKNAME.clear(); for (const [c, a] of Object.entries(carte)) CARDLOOKS.set(c, a); for (const [k, v] of Object.entries(nomi)) LOOKNAME.set(k, v); }
/** Etichette della carta per le letture «morbide»: le sue, più i temi di contesto dei suoi ruoli (peso 2) se non li ha già. */
function cardFeats(cardId: string): [string, number][] {
  const f = feats(CARDS[cardId]!), have = new Set(f.map(([k]) => k));
  for (const r of CARDROLES.get(cardId) ?? []) for (const t of ROLETEMI.get(r) ?? []) if (!have.has("m:" + t)) { f.push(["m:" + t, 2]); have.add("m:" + t); }
  return f;
}
export const hasTagsV2 = (): boolean => Object.keys(CARDS).length > 0;
/** Parentela (0 se assente o sotto soglia) tra due etichette «t:nome» / «m:nome». Per i test. */
export const tagSimilarity = (a: string, b: string): number => (a === b ? 1 : SIM.get(a + "|" + b) ?? 0);

export function affinityV2(cardId: string, phraseText: string): number | null {
  const c = CARDS[cardId], p = PHRASES[phraseText];
  if (!c || !p) return affinityOld(cardId, phraseText);   // frasi non etichettate (accuse, confessioni, frasi nuove): si resta sul vecchio sistema
  let a = 0;
  for (const [t, w] of Object.entries(p.tipi)) { const wc = c.tipi[t]; if (wc) a += 3 * (wc + w) / 6; }
  for (const [t, w] of Object.entries(p.temi)) { const wc = c.temi[t]; if (wc) a += 2 * (wc + w) / 6; }
  return a;
}

/** Etichette dedotte dalle parole di una frase nuova; null se l'indizio non è abbastanza forte (parole viste almeno `minDf` volte e punteggio ≥ `minScore`). */
export function inferV2(text: string): Tag2 | null {
  const sc = new Map<string, number>();
  for (const w of stems(text)) { const df = DF.get(w) ?? 0; if (df < SMOOTH.minDf) continue; const m = CNT.get(w)!, tot = [...m.values()].reduce((a, b) => a + b, 0), idf = Math.log(NDOC / df); for (const [t, c] of m) sc.set(t, (sc.get(t) ?? 0) + (c / tot) * idf); }
  const rk = [...sc.entries()].filter(([, v]) => v >= SMOOTH.minScore).sort((a, b) => b[1] - a[1]);
  if (!rk.length) return null;
  const out: Tag2 = { tipi: {}, temi: {} }, top = rk[0]![1];
  for (const [k, v] of rk.slice(0, 4)) { const w = v >= top * 0.8 ? 2 : 1, name = k.slice(2); if (k[0] === "t") { if (Object.keys(out.tipi).length < 2) out.tipi[name] = w; } else if (Object.keys(out.temi).length < 3) out.temi[name] = w; }
  return out;
}

/** Affinità «morbida»: come la esatta, ma conta anche le etichette imparentate (peso `beta` × parentela) e deduce le etichette delle frasi libere. */
export function affinityV2m(cardId: string, phraseText: string): number | null {
  const c = CARDS[cardId]; if (!c) return affinityOld(cardId, phraseText);
  const p = PHRASES[phraseText] ?? inferV2(phraseText); if (!p) return null;
  let a = 0;
  for (const [x, wx] of cardFeats(cardId)) for (const [y, wy] of feats(p)) {
    const s = x === y ? 1 : SIM.get(x + "|" + y) !== undefined ? SMOOTH.beta * SIM.get(x + "|" + y)! : 0;
    if (s > 0) a += (x[0] === "t" && y[0] === "t" ? 3 : x[0] === "m" && y[0] === "m" ? 2 : 2.5) * s * (wx + wy) / 6;
  }
  return a;
}

/** Salienza (0–1) e gusto per il buffo (0–1) di una carta, dalle sue etichette. */
export const cardProfile = (cardId: string): { sal: number; fun: number } => PROF.get(cardId) ?? { sal: 0.5, fun: 0 };

/** La seconda lettura personale di una carta per una lente: un'etichetta vicina (parentela) che per lui spicca. Stabile (dipende da lente e carta). */
export function angleOf(cardId: string, seed: number, prob: number): [string, number] | null {
  const c = CARDS[cardId]; if (!c || (hash32(`${cardId}:${seed}`) % 1000) / 1000 >= prob) return null;
  const mine = new Set(feats(c).map(([k]) => k)), cand = new Map<string, number>();
  for (const a of mine) for (const [k, s] of NEIGH.get(a) ?? []) if (!mine.has(k)) cand.set(k, Math.max(cand.get(k) ?? 0, s));
  const top = [...cand.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3); if (!top.length) return null;
  return [top[hash32(`${cardId}#${seed}`) % top.length]![0], 2];
}

/** Affinità carta–frase vista da una lente: parentele con il suo «raggio», seconda lettura della carta ed effetto alone. Null se la frase non dà alcun indizio. */
export function affinityLens(cardId: string, phraseText: string, lens: Lens): number | null {
  const c = CARDS[cardId]; if (!c) return affinityOld(cardId, phraseText);
  const p = PHRASES[phraseText] ?? inferV2(phraseText); if (!p) return null;
  const cf = cardFeats(cardId), ang = angleOf(cardId, lens.seed, lens.angle); if (ang) cf.push(ang);
  for (const st of stereoTags(cardId, lens)) cf.push(st);   // i luoghi comuni del bot sul ruolo della carta
  let a = 0;
  for (const [x, wx] of cf) for (const [y, wy] of feats(p)) {
    const q = SIM.get(x + "|" + y), s = x === y ? 1 : q !== undefined ? lens.reach * q : 0;
    if (s > 0) a += (x[0] === "t" && y[0] === "t" ? 3 : x[0] === "m" && y[0] === "m" ? 2 : 2.5) * s * (wx + wy) / 6;
  }
  return a + (lens.halo * a * a) / 8;
}

/**
 * «Voto per luogo comune»: per una carta e una frase, quanto la tabella dei luoghi comuni (intera, senza i gusti di un bot) spiega la scelta di quella carta (`s`)
 * e quanto la spiegano le etichette della carta (`base`). Il voto è «per luogo comune» se il luogo comune da solo basta a spiegarlo (`s > 0` e `s ≥ base`): la carta
 * ha il ruolo o l'aspetto che fa pensare a quel tratto, ma di suo non c'entra con la frase. È una stima, non una prova delle intenzioni di chi ha votato.
 */
export function stereoExplain(cardId: string, text: string): { s: number; base: number; causa: string | null } | null {
  const c = CARDS[cardId], p = PHRASES[text] ?? inferV2(text); if (!c || !p) return null;
  const cues = [...Object.keys(c.tipi).map((x) => "t:" + x), ...(CARDROLES.get(cardId) ?? []).map((x) => "r:" + x), ...(CARDLOOKS.get(cardId) ?? []).map((x) => "a:" + x)];
  let s = 0, bestR = 0, bestA = 0, causaR: string | null = null, causaA: string | null = null;
  for (const cue of cues) for (const [tratto, f] of STEREO.get(cue) ?? []) {
    const wp = p.tipi[tratto.slice(2)]; if (!wp) continue; const v = 3 * (f + wp) / 6; s += v;
    if (cue[0] === "r" && v > bestR) { bestR = v; causaR = `${cue.slice(2)} → ${tratto.slice(2)}`; }
    if (cue[0] === "a" && v > bestA) { bestA = v; causaA = `@${cue.slice(2)} → ${tratto.slice(2)}`; }   // l'aspetto si distingue con «@»
  }
  const causa = causaR ?? causaA;   // il luogo comune è dato principalmente dal ruolo; l'aspetto solo se il ruolo non c'entra
  return { s, base: affinityV2(cardId, text) ?? 0, causa };
}
export const isStereoVote = (e: { s: number; base: number; causa?: string | null } | null): boolean => !!e && e.s > 0 && e.s >= e.base;

/** Per un turno: quali voti sono «per luogo comune» e quanto sarebbe stato per caso (quota delle carte in torre che il luogo comune spiega). Null se la frase non ha etichette. */
export function stereoVoteFlags(tower: { cardId: string; position: number }[], text: string, votes: Record<string, number>): { voti: Record<string, boolean>; caso: number; cause: Record<string, number>; lancio: { pos: number; n: number; causa: string } | null } | null {
  const byPos: Record<number, string | boolean> = {}; let k = 0;
  for (const t of tower) { const e = stereoExplain(t.cardId, text); if (!e) return null; const f = isStereoVote(e); byPos[t.position] = f ? e.causa ?? true : false; if (f) k++; }
  const voti: Record<string, boolean> = {}, cause: Record<string, number> = {}, perPos: Record<number, number> = {};
  for (const [pid, pos] of Object.entries(votes)) { const c = byPos[pos]; voti[pid] = !!c; if (typeof c === "string") { cause[c] = (cause[c] ?? 0) + 1; perPos[pos] = (perPos[pos] ?? 0) + 1; } }
  let lancio: { pos: number; n: number; causa: string } | null = null;   // la carta che il luogo comune ha colpito di più in questo turno
  for (const [pos, n] of Object.entries(perPos)) if (!lancio || n > lancio.n) lancio = { pos: Number(pos), n, causa: byPos[Number(pos)] as string };
  return { voti, caso: tower.length ? k / tower.length : 0, cause, lancio };
}

/**
 * Il pregiudiziometro. Ogni voto, e ogni segnalino piazzato, è un giudizio a occhio su una faccia e un ruolo; la sua forza è quanto la carta e la frase sono
 * associate (luoghi comuni su ruolo e aspetto, tratti della carta, anche per parentela tra tratti): `1 − e^(−v/3)` con v = la forza dell'associazione (mediana 2, forte oltre 4).
 * Nessun minimo artificiale. Un voto dato altrove rispetto alla carta più «da luogo comune» del turno non è neutro: chi vota così sta evitando quel luogo comune
 * (contro-bluff, scelta di fare cadere altro), e conta almeno `PREGIUDIZIO_EVITATO` volte la forza di quella carta.
 * Un turno in cui nessuna carta ha alcuna associazione con la frase non è misurabile e non entra nel conto (non vale zero).
 */
export const PREGIUDIZIO_EVITATO = 0.5;
const forza = (cardId: string, text: string): number | null => { const e = stereoExplain(cardId, text); return e ? Math.max(e.s, affinityV2m(cardId, text) ?? 0) : null; };
export function pregiudizio(cardId: string, text: string): number | null { const v = forza(cardId, text); return v === null ? null : 1 - Math.exp(-v / 3); }
/** Per un turno: il pregiudizio di ogni voto (0–1) e del segnalino piazzato dal Megafono (vuoti se il turno non è misurabile) e la media su tutte le carte in torre. Null se la frase non ha etichette. */
export function pregiudizioTurno(tower: { cardId: string; position: number }[], text: string, votes: Record<string, number>, markPos?: number): { voti: Record<string, number>; lui: number | null; caso: number } | null {
  const by: Record<number, number> = {}; let sum = 0, pM = 0;
  for (const t of tower) { const p = pregiudizio(t.cardId, text); if (p === null) return null; by[t.position] = p; sum += p; if (p > pM) pM = p; }
  const caso = tower.length ? sum / tower.length : 0; if (pM === 0) return { voti: {}, lui: null, caso };
  const eff = (pos: number) => Math.max(by[pos] ?? 0, PREGIUDIZIO_EVITATO * pM);
  const voti: Record<string, number> = {}; for (const [pid, pos] of Object.entries(votes)) voti[pid] = eff(pos);
  return { voti, lui: markPos !== undefined && by[markPos] !== undefined ? eff(markPos) : null, caso };
}

/**
 * I luoghi comuni evocati in un turno, con i PESI. Ogni voto su una carta che la tabella associa alla frase vale 1 per il suo luogo comune (ruolo → tratto).
 * Il segnalino del Megafono (bot o umano, pesa uguale) è una dichiarazione: CADE o VOTI NULLI su una carta associata aggiunge 1 a quella carta, e se la carta
 * ha anche voti il suo peso si moltiplica per `PESO_LUI_CONFERMA` (il luogo comune si consolida). NON CADE su una carta rimasta senza voti dice «non è lui»:
 * aggiunge 1 alla carta che invece è caduta (se associata). Un segnalino su una carta non associata è una mossa di gioco, non conta.
 * I pesi sono una scelta di progetto (docs/GAME_RULES.md), non una misura. Null se la frase non ha etichette.
 */
export const PESO_LUI_CONFERMA = 1.5;
/** Peso di chi vota altrove rispetto alla carta più «da luogo comune» del turno: ha evitato quel luogo comune, e questo è un giudizio. */
export const PESO_EVITATO = 0.5;
/** Il luogo comune evocato da una carta e da una frase: la tabella se c'è la riga, altrimenti l'associazione diretta «ruolo (o aspetto) della carta → tratto principale della frase». Null se la carta non ha né ruolo né aspetto. */
function causaGenerica(cardId: string, text: string): string | null {
  const p = PHRASES[text] ?? inferV2(text); if (!p) return null;
  const look = CARDLOOKS.get(cardId)?.[0], nome = CARDROLES.get(cardId)?.[0] ?? (look !== undefined ? `@${look}` : null); if (!nome) return null;
  const tr = Object.entries(p.tipi).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0]; return tr ? `${nome} → ${tr[0]}` : null;
}
export function luoghiTurno(tower: { cardId: string; position: number }[], text: string, votes: Record<string, number>, marks: { position: number; effect: string }[], fallen: number[]): { pesi: Record<string, number>; lancio: { pos: number; n: number; causa: string } | null; aspetti: Record<string, { n: number; l: Record<string, number> }> } | null {
  const causa: Record<number, string> = {};
  const fz: Record<number, number> = {};
  for (const t of tower) { const e = stereoExplain(t.cardId, text); if (!e) return null; const c = e.causa ?? causaGenerica(t.cardId, text); if (c) { causa[t.position] = c; fz[t.position] = Math.max(e.s, affinityV2m(t.cardId, text) ?? 0); } }
  const nv: Record<number, number> = {}; for (const pos of Object.values(votes)) nv[pos] = (nv[pos] ?? 0) + 1;
  const w: Record<number, number> = {}; for (const k of Object.keys(causa)) w[Number(k)] = nv[Number(k)] ?? 0;
  for (const m of marks) {
    if ((m.effect === "cade" || m.effect === "nulli") && causa[m.position] !== undefined) { w[m.position]! += 1; if ((nv[m.position] ?? 0) > 0) w[m.position]! *= PESO_LUI_CONFERMA; }
    else if (m.effect === "noncade" && !nv[m.position]) for (const f of fallen) if (causa[f] !== undefined) w[f]! += 1;
  }
  let M = -1; for (const [k, v] of Object.entries(fz)) if (v > 0 && (M < 0 || v > fz[M]!)) M = Number(k);   // la carta più «da luogo comune»: chi vota altrove l'ha evitata
  if (M >= 0) w[M]! += PESO_EVITATO * Object.values(votes).filter((pos) => pos !== M).length;
  const pesi: Record<string, number> = {}; let lancio: { pos: number; n: number; causa: string } | null = null;
  for (const [k, v] of Object.entries(w)) {
    if (v > 0) pesi[causa[Number(k)]!] = Math.round(((pesi[causa[Number(k)]!] ?? 0) + v) * 100) / 100;
    const n = nv[Number(k)] ?? 0; if (n > 0 && (!lancio || n > lancio.n)) lancio = { pos: Number(k), n, causa: causa[Number(k)]! };
  }
  // la caratteristica comune: per ogni luogo comune di ruolo, gli aspetti delle carte che hanno ricevuto i voti
  const aspetti: Record<string, { n: number; l: Record<string, number> }> = {};
  for (const t of tower) { const c = causa[t.position], n = nv[t.position] ?? 0; if (!c || c.startsWith("@") || !n) continue; const a = (aspetti[c] ??= { n: 0, l: {} }); a.n += n; for (const look of CARDLOOKS.get(t.cardId) ?? []) a.l[look] = (a.l[look] ?? 0) + n; }
  return { pesi, lancio, aspetti };
}
