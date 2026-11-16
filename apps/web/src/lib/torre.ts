import { ts } from "./testi.ts";
/** «Torre del giorno»: un solo turno già pronto (frase, carte, segnalino), si vota e si vede l'esito. I punti si accumulano sul dispositivo (mai inviati). */
import { applyAction } from "@gdt/game-engine";
import type { GameState, TurnResult } from "@gdt/game-engine";
export interface Torre { v: 2; n: number; umano: string; giocatori: { id: string; nickname: string; char: number; isBot: boolean }[]; stato: GameState }
export interface Indice { inizio: string; giorni: number }
export interface TorreDay { n: number; pts: number; cella: string }   // n = numero della Torre del giorno
export interface TorreDb { v: 1; totale: number; giocati: number; migliore: number; serie: number; record: number; ultimo: string; oggi: { day: string; k: number }; giorni: Record<string, TorreDay> }

const KEY = "gdt.torre", STEP = 37, MAX_DAYS = 60;
export const emptyTorre = (): TorreDb => ({ v: 1, totale: 0, giocati: 0, migliore: 0, serie: 0, record: 0, ultimo: "", oggi: { day: "", k: 0 }, giorni: {} });

/** Giorno locale «AAAA-MM-GG». */
export const dayId = (d: Date = new Date()): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const utc = (id: string): number => { const [y, m, d] = id.split("-").map(Number); return Date.UTC(y!, m! - 1, d!); };
export const daysBetween = (a: string, b: string): number => Math.round((utc(b) - utc(a)) / 86_400_000);
/** Quale Torre è «del giorno» (si ripete dopo `giorni` giorni) e quale è la k-esima giocata nello stesso giorno (k = 0: la Torre del giorno, uguale per tutti). */
export const torreIndex = (idx: Indice, day: string, k = 0): number => { const d = daysBetween(idx.inizio, day), N = idx.giorni; return (((d % N) + N) % N + k * STEP) % N; };
/** Numero della Torre del giorno, da mostrare e condividere (parte da 1). */
export const numeroDelGiorno = (idx: Indice, day: string): number => Math.max(1, daysBetween(idx.inizio, day) + 1);

/** Carica (con ripiego se l'archivio non c'è o è guasto). */
export function loadTorre(): TorreDb { try { const x = JSON.parse(localStorage.getItem(KEY) ?? "null") as TorreDb | null; return x?.v === 1 ? { ...emptyTorre(), ...x } : emptyTorre(); } catch { return emptyTorre(); } }
export function saveTorre(db: TorreDb): void { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* vale per questa visita */ } }

/** Quante Torri ha già giocato oggi (per sapere quale Torre proporre). */
export const playedToday = (db: TorreDb, day: string): number => (db.oggi.day === day ? db.oggi.k : 0);

/** Applica il voto del giocatore allo stato della Torre (mancava solo il suo): lo stato dopo il conteggio e il risultato del turno. */
export function risolvi(t: Torre, posizione: number): { stato: GameState; risultato: TurnResult } {
  const stato = applyAction(t.stato, { type: "vote", playerId: t.umano, position: posizione }).state;
  return { stato, risultato: stato.lastResult! };
}
/** Cella a emoji: 🟩 voto giusto, 🟥 voto annullato, ⬛ carta votata rimasta su; poi come si scopriva il segnalino (🔻 CADE, 🧱 NON CADE, 🛑 VOTI NULLI!). */
export function cella(r: TurnResult, me: string): string {
  const m = r.marks![0]!, annullato = m.caught?.includes(me) ?? false, cadute = r.fallenPositions ?? [r.fallenPosition];
  return (annullato ? "🟥" : cadute.includes(r.votes[me]!) ? "🟩" : "⬛") + ({ cade: "🔻", noncade: "🧱", nulli: "🛑" } as Record<string, string>)[m.effect];
}

/** Registra una Torre giocata: punti, serie di giorni (conta solo la Torre del giorno) e riepilogo del giorno. Funzione pura: restituisce il nuovo archivio. */
export function registra(db: TorreDb, day: string, numero: number, k: number, r: TurnResult, me: string): TorreDb {
  const pts = r.points[me] ?? 0, x: TorreDb = { ...db, giorni: { ...db.giorni }, oggi: { day, k: k + 1 } };
  x.totale += pts; x.giocati += 1; x.migliore = Math.max(x.migliore, pts);
  if (k === 0) {
    x.giorni[day] = { n: numero, pts, cella: cella(r, me) };
    if (x.ultimo !== day) { x.serie = x.ultimo && daysBetween(x.ultimo, day) === 1 ? x.serie + 1 : 1; x.ultimo = day; x.record = Math.max(x.record, x.serie); }
    const keys = Object.keys(x.giorni).sort(); for (const old of keys.slice(0, Math.max(0, keys.length - MAX_DAYS))) delete x.giorni[old];
  }
  return x;
}

/** Testo da condividere (solo testo: si incolla ovunque). */
export const testoDaCondividere = (numero: number, cellaTxt: string, pts: number, serie: number, url: string): string =>
  [ts("torre.share.t", { n: numero, cella: cellaTxt, pts }), serie > 1 ? ts("torre.share.serie", { n: serie }) : "", url].filter(Boolean).join("\n");

/** Secondi alla prossima Torre del giorno (mezzanotte locale). */
export const secondiAMezzanotte = (now: Date = new Date()): number => { const m = new Date(now); m.setHours(24, 0, 0, 0); return Math.max(0, Math.round((m.getTime() - now.getTime()) / 1000)); };
