import { ts } from "./testi.ts";
/** «Torre del giorno»: un solo turno già pronto (frase, carte, segnalino), si vota e si vede l'esito. I punti si accumulano sul dispositivo (mai inviati). */
import { applyAction } from "@gdt/game-engine";
import type { GameState, TurnResult } from "@gdt/game-engine";
export interface Torre { v: 2; n: number; umano: string; giocatori: { id: string; nickname: string; char: number; isBot: boolean }[]; stato: GameState }
/** `date`: i giorni con una Torre pronta (il server dà solo quelli già pubblicati); `riserva`: quante Torri di scorta per le altre partite dello stesso giorno. */
export interface Indice { inizio: string; date: string[]; riserva: number }
export interface TorreDay { n: number; pts: number; cella: string }   // n = numero della Torre del giorno
export interface TorreDb { v: 1; totale: number; giocati: number; migliore: number; serie: number; record: number; ultimo: string; /** Ultimo giorno in cui ha aperto la Torre del giorno (per evidenziare quella nuova). */ visto: string; giorni: Record<string, TorreDay> }

const KEY = "gdt.torre", STEP = 37, MAX_DAYS = 60;
export const emptyTorre = (): TorreDb => ({ v: 1, totale: 0, giocati: 0, migliore: 0, serie: 0, record: 0, ultimo: "", visto: "", giorni: {} });

/** Giorno di gioco «AAAA-MM-GG»: la data di Roma un minuto fa, così la nuova Torre compare a mezzanotte e un minuto, uguale per tutti ovunque siano. */
export const dayId = (now: number = Date.now()): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date(now - 60_000));
const utc = (id: string): number => { const [y, m, d] = id.split("-").map(Number); return Date.UTC(y!, m! - 1, d!); };
export const daysBetween = (a: string, b: string): number => Math.round((utc(b) - utc(a)) / 86_400_000);
const hash = (t: string): number => { let h = 2166136261; for (const c of t) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
/** Quale file leggere: la Torre del giorno (l'ultima pubblicata fino a oggi; se non ce n'è nessuna, una di riserva). */
export function torreUrl(idx: Indice, day: string): string {
  const oggi = idx.date.filter((d) => d <= day).pop();
  return oggi ? `/oggi/${oggi}.json` : `/oggi/riserva/${hash(day) % Math.max(1, idx.riserva)}.json`;
}
/** C'è una Torre del giorno che non ha ancora aperto? */
export const nuovaTorre = (db: TorreDb, day: string): boolean => db.visto !== day;
export const segnaVista = (db: TorreDb, day: string): TorreDb => (db.visto === day ? db : { ...db, visto: day });
/** Numero della Torre del giorno, da mostrare e condividere (parte da 1). */
export const numeroDelGiorno = (idx: Indice, day: string): number => Math.max(1, daysBetween(idx.inizio, day) + 1);

/** Carica (con ripiego se l'archivio non c'è o è guasto). */
export function loadTorre(): TorreDb { try { const x = JSON.parse(localStorage.getItem(KEY) ?? "null") as TorreDb | null; return x?.v === 1 ? { ...emptyTorre(), ...x } : emptyTorre(); } catch { return emptyTorre(); } }
export function saveTorre(db: TorreDb): void { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* vale per questa visita */ } }


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

/** Registra la Torre del giorno giocata: punti, serie di giorni e riepilogo del giorno. Funzione pura: restituisce il nuovo archivio. */
export function registra(db: TorreDb, day: string, numero: number, r: TurnResult, me: string): TorreDb {
  if (db.giorni[day]) return db;   // la Torre del giorno si gioca una volta sola
  const pts = r.points[me] ?? 0, x: TorreDb = { ...db, giorni: { ...db.giorni } };
  x.totale += pts; x.giocati += 1; x.migliore = Math.max(x.migliore, pts);
  {
    x.giorni[day] = { n: numero, pts, cella: cella(r, me) };
    if (x.ultimo !== day) { x.serie = x.ultimo && daysBetween(x.ultimo, day) === 1 ? x.serie + 1 : 1; x.ultimo = day; x.record = Math.max(x.record, x.serie); }
    const keys = Object.keys(x.giorni).sort(); for (const old of keys.slice(0, Math.max(0, keys.length - MAX_DAYS))) delete x.giorni[old];
  }
  return x;
}

/** Testo da condividere (solo testo: si incolla ovunque). */
export const testoDaCondividere = (numero: number, cellaTxt: string, pts: number, serie: number, url: string): string =>
  [ts("torre.share.t", { n: numero, cella: cellaTxt, pts }), serie > 1 ? ts("torre.share.serie", { n: serie }) : "", url].filter(Boolean).join("\n");

/** Secondi alla prossima Torre del giorno (00:01 di Roma; nei due giorni dell'ora legale può sbagliare di un'ora). */
export const secondiAllaProssima = (now: number = Date.now()): number => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(now - 60_000)).map((x) => [x.type, Number(x.value)])) as Record<string, number>;
  return 86_400 - (p.hour! * 3600 + p.minute! * 60 + p.second!);
};
