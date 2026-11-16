import type { PlayerView } from "@gdt/game-engine";

/**
 * Statistiche personali, salvate SOLO nel dispositivo (IndexedDB, con ripiego su localStorage): non vengono mai inviate al server.
 * Un solo documento `Db`: contatori complessivi (restano per sempre) + le ultime partite. Si aggiorna guardando la vista di gioco del giocatore:
 * ogni turno risolto, ogni intervallo e la fine della partita si contano una volta sola (chiavi in `seen`), anche se l'app si ricarica o si riconnette.
 */
export interface Totals {
  games: number; wins: number; podiums: number; points: number; best: number; turns: number;
  /** Voti dati da Folla (non Megafono), quante volte la carta votata è caduta, quante volte è caduta una carta giocata da te. */
  votes: number; voteHits: number; cardFell: number;
  /** Turni da Megafono, segnalini usati e quanti hanno colpito; quante volte i tuoi voti sono stati annullati (VOTI NULLI!). */
  megaTurns: number; cade: number; cadeHit: number; noncade: number; noncadeHit: number; nulli: number; nulliHit: number; caught: number;
  minis: number; miniVotes: number; miniHits: number; miniFast: number;
  /** Voti dati e, tra questi, quanti «per luogo comune» (stima della stanza); `stereoC` = somma di quanto sarebbe stato per caso. */
  stereoN: number; stereoS: number; stereoC: number;
}
export interface GameRec { id: string; at: number; players: number; bots: boolean; score: number; rank: number; won: boolean }
export interface Db { v: 1; since: number; totals: Totals; games: GameRec[]; seen: string[]; cur: { code: string; key: string; lastTurn: number; done: boolean } | null }

export const MAX_GAMES = 30, MAX_SEEN = 400;
const ZERO: Totals = { games: 0, wins: 0, podiums: 0, points: 0, best: 0, turns: 0, votes: 0, voteHits: 0, cardFell: 0, megaTurns: 0, cade: 0, cadeHit: 0, noncade: 0, noncadeHit: 0, nulli: 0, nulliHit: 0, caught: 0, minis: 0, miniVotes: 0, miniHits: 0, miniFast: 0, stereoN: 0, stereoS: 0, stereoC: 0 };
export const emptyDb = (now = Date.now()): Db => ({ v: 1, since: now, totals: { ...ZERO }, games: [], seen: [], cur: null });

/** Aggiorna `db` guardando la vista del giocatore. Restituisce true se è cambiato qualcosa. Funzione pura (niente archivio): si prova nei test. */
export function observe(db: Db, code: string, view: PlayerView, bots: boolean, now = Date.now()): boolean {
  const me = view.viewerId; if (!view.players.some((p) => p.id === me)) return false;   // solo chi gioca (non chi guarda)
  let changed = false;
  // una partita = stessa stanza finché i turni non tornano indietro o non è finita (rivincita nella stessa stanza)
  if (!db.cur || db.cur.code !== code || (db.cur.done && view.phase !== "GAME_OVER") || view.turn < db.cur.lastTurn) { db.cur = { code, key: `${code}@${now}`, lastTurn: view.turn, done: false }; changed = true; }
  const cur = db.cur; if (view.turn > cur.lastTurn) { cur.lastTurn = view.turn; changed = true; }
  const once = (k: string): boolean => { const id = `${cur.key}:${k}`; if (db.seen.includes(id)) return false; db.seen.push(id); if (db.seen.length > MAX_SEEN) db.seen.splice(0, db.seen.length - MAX_SEEN); changed = true; return true; };
  const T = db.totals;

  const r = view.lastResult;
  if ((view.phase === "RESULTS" || view.phase === "GAME_OVER") && r && once(`t${r.turn}`)) {
    T.turns++;
    const mega = r.megafonoId === me, fallen = r.fallenPositions ?? [r.fallenPosition];
    if (r.fallenOwnerIds?.includes(me)) T.cardFell++;
    { const f = r.stereo?.voti[me]; if (f !== undefined) { T.stereoN++; if (f) T.stereoS++; T.stereoC += r.stereo!.caso; } }
    if (mega) {
      T.megaTurns++;
      for (const m of r.marks ?? []) { if (m.effect === "cade") { T.cade++; if (m.hit) T.cadeHit++; } else if (m.effect === "noncade") { T.noncade++; if (m.hit) T.noncadeHit++; } else { T.nulli++; if (m.hit) T.nulliHit++; } }
    } else {
      const v = r.votes[me];
      if (v !== undefined) { T.votes++; if (fallen.includes(v)) T.voteHits++; }
      if ((r.marks ?? []).some((m) => m.caught?.includes(me))) T.caught++;
    }
  }
  const mr = view.miniResult;
  if ((view.phase === "MINI_RESULTS" || view.phase === "RESULTS" || view.phase === "PROCLAIM") && mr && once("mini")) {
    T.minis++;
    if (mr.votes[me] !== undefined) { T.miniVotes++; if ((mr.lines[me] ?? []).some((l) => l.kind === "mini-giusto")) T.miniHits++; }
    if (mr.fastest === me) T.miniFast++;
  }
  if (view.phase === "GAME_OVER" && once("end")) {
    const mine = view.players.find((p) => p.id === me)!, rank = 1 + view.players.filter((p) => p.score > mine.score).length, won = !!view.winners?.includes(me);
    T.games++; T.points += mine.score; T.best = Math.max(T.best, mine.score); if (won) T.wins++; if (rank <= 3 && view.players.length >= 3) T.podiums++;
    db.games.unshift({ id: cur.key, at: now, players: view.players.length, bots, score: mine.score, rank, won }); if (db.games.length > MAX_GAMES) db.games.length = MAX_GAMES;
    cur.done = true;
  }
  return changed;
}

/** Valori derivati per la pagina (percentuali con un solo decimale; null se non c'è ancora il dato). */
export function summary(db: Db) {
  const T = db.totals, pct = (a: number, b: number): number | null => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
  return {
    games: T.games, wins: T.wins, winRate: pct(T.wins, T.games), podiums: T.podiums, points: T.points, best: T.best, avg: T.games ? Math.round((T.points / T.games) * 10) / 10 : null,
    votes: T.votes, voteRate: pct(T.voteHits, T.votes), cardFell: T.cardFell, megaTurns: T.megaTurns,
    cade: T.cade, cadeRate: pct(T.cadeHit, T.cade), noncade: T.noncade, noncadeRate: pct(T.noncadeHit, T.noncade), nulli: T.nulli, nulliRate: pct(T.nulliHit, T.nulli), caught: T.caught,
    stereoN: T.stereoN, stereoRate: pct(T.stereoS, T.stereoN), stereoCaso: pct(T.stereoC, T.stereoN),
    minis: T.minis, miniRate: pct(T.miniHits, T.miniVotes), miniFast: T.miniFast, recent: db.games, since: db.since,
  };
}

// ---------- archivio nel dispositivo ----------
const DB_NAME = "gdt-stats", STORE = "kv", KEY = "db", LS_KEY = "gdt.stats";
const idb = (): Promise<IDBDatabase> => new Promise((ok, ko) => {
  if (typeof indexedDB === "undefined") return ko(new Error("no idb"));
  const rq = indexedDB.open(DB_NAME, 1); rq.onupgradeneeded = () => rq.result.createObjectStore(STORE); rq.onsuccess = () => ok(rq.result); rq.onerror = () => ko(rq.error);
});
const valid = (x: unknown): x is Db => !!x && typeof x === "object" && (x as Db).v === 1 && !!(x as Db).totals && Array.isArray((x as Db).games) && Array.isArray((x as Db).seen);
const fix = (x: Db): Db => ({ ...x, totals: { ...ZERO, ...x.totals } });
export async function loadDb(): Promise<Db> {
  try { const d = await idb(); const v = await new Promise<unknown>((ok, ko) => { const q = d.transaction(STORE).objectStore(STORE).get(KEY); q.onsuccess = () => ok(q.result); q.onerror = () => ko(q.error); }); d.close(); if (valid(v)) return fix(v); } catch { /* ripiego */ }
  try { const v = JSON.parse(localStorage.getItem(LS_KEY) ?? "null"); if (valid(v)) return fix(v); } catch { /* vuoto */ }
  return emptyDb();
}
export async function saveDb(db: Db): Promise<void> {
  try { const d = await idb(); await new Promise<void>((ok, ko) => { const tx = d.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(db, KEY); tx.oncomplete = () => ok(); tx.onerror = () => ko(tx.error); }); d.close(); return; } catch { /* ripiego */ }
  try { localStorage.setItem(LS_KEY, JSON.stringify(db)); } catch { /* archivio non disponibile: le statistiche di questa sessione si perdono */ }
}
export async function resetStats(): Promise<void> { await saveDb(emptyDb()); try { localStorage.removeItem(LS_KEY); } catch { /* */ } }

let chain: Promise<unknown> = Promise.resolve();
/** Registra la vista corrente (una alla volta, in ordine: niente scritture che si pestano i piedi). */
export function recordView(code: string, view: PlayerView, bots: boolean): Promise<void> {
  const job = chain.then(async () => { const db = await loadDb(); if (observe(db, code, view, bots)) await saveDb(db); }).catch(() => undefined);
  chain = job; return job;
}
