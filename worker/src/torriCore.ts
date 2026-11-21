import { nicknameAmmesso, valuta } from "@gdt/game-protocol";
import type { Eta } from "@gdt/game-protocol";

/**
 * Torri degli utenti (docs/TORRI_UTENTE.md): una torre è un sondaggio a tempo creato da un giocatore.
 * Questo modulo è la logica pura (nessun I/O): lo usa il Durable Object `TowerPoll` e i test.
 */
export const LIMITI = {
  minCarte: 3, maxCarte: 6, maxFrase: 80, minFrase: 8, maxNick: 20, maxVoti: 5000, annullaMs: 10 * 60_000, risultatiMs: 24 * 3600_000, segnalazioniNascondi: 3,
  durate: { "24h": 24 * 3600_000, "3g": 3 * 24 * 3600_000, "7g": 7 * 24 * 3600_000 } as Record<string, number>,
};
export type Effetto = "cade" | "noncade" | "nulli";
export type Stato = "aperta" | "chiusa" | "annullata" | "nascosta";
export interface Voto { dev: string; pos: number; at: number; nick: string | null }
export interface TorreData {
  id: string; creata: number; chiude: number; elimina: number | null;
  carte: string[]; verbo: "sale" | "salgono"; frase: string; eta: Eta; personaggioPubblico: boolean;
  segnalino: { pos: number; effetto: Effetto }; votoAutore: number;
  adminHash: string; voti: Voto[]; segnalazioni: string[]; og: string | null; chiusaPrima: { motivo: string; at: number } | null; annullata: boolean;
}
export type Errore = "CARTE" | "CARTA_NON_VALIDA" | "FRASE" | "FRASE_VIETATA" | "FRASE_ETA" | "NOME_PERSONA" | "SEGNALINO" | "VOTO" | "DURATA" | "NON_TROVATA" | "CHIUSA" | "GIA_VOTATO" | "PIENA" | "NICK" | "NON_AUTORE" | "TARDI" | "CONFERMA" | "NON_AMMESSO" | "MODERAZIONE";
export class TorreErrore extends Error { constructor(public codice: Errore, msg = codice) { super(msg); } }

export interface Contesto { /** Carte valide (base + espansioni). */ cartaValida: (id: string) => boolean; /** Nomi di persone noti dei mazzi, per la moderazione. */ nomi?: ReadonlySet<string> }
export interface Creazione { carte: string[]; frase: string; eta?: number; personaggioPubblico?: boolean; segnalino: { pos: number; effetto: Effetto }; votoAutore: number; durata: string }

/** La frase ripulita (spazi, minuscola iniziale, niente «Oggi sale sulla torre») e il verbo. */
export function normalizzaFrase(testo: string): { testo: string; verbo: "sale" | "salgono" } {
  let t = testo.normalize("NFKC").replace(/\s+/g, " ").trim().replace(/^oggi\s+(sale|salgono)\s+sulla\s+torre\s*/i, "");
  t = t.charAt(0).toLowerCase() + t.slice(1); if (t && !/[.!?…]$/.test(t)) t += ".";
  return { testo: t, verbo: /^(i più|quelli che)(?=\s)/i.test(t) ? "salgono" : "sale" };
}

export function creaTorre(c: Creazione, ctx: Contesto, id: string, adminHash: string, now: number): TorreData {
  if (!Array.isArray(c.carte) || c.carte.length < LIMITI.minCarte || c.carte.length > LIMITI.maxCarte || new Set(c.carte).size !== c.carte.length) throw new TorreErrore("CARTE");
  for (const x of c.carte) if (typeof x !== "string" || !ctx.cartaValida(x)) throw new TorreErrore("CARTA_NON_VALIDA");
  const f = normalizzaFrase(String(c.frase ?? ""));
  if (f.testo.length < LIMITI.minFrase || f.testo.length > LIMITI.maxFrase) throw new TorreErrore("FRASE");
  const e = valuta(f.testo, ctx.nomi ? { nomiNoti: ctx.nomi } : {});
  if (e.vietata) throw new TorreErrore("FRASE_VIETATA");
  if (e.nomiSospetti.length && !c.personaggioPubblico) throw new TorreErrore("NOME_PERSONA");
  const scelta = [6, 10, 14, 18].includes(c.eta as number) ? (c.eta as Eta) : 6;
  if ([6, 10, 14, 18].includes(c.eta as number) && scelta < e.etaMin) throw new TorreErrore("FRASE_ETA");   // l'età può solo salire
  const eta = Math.max(scelta, e.etaMin) as Eta;
  const n = c.carte.length, seg = c.segnalino, ok = (p: unknown) => Number.isInteger(p) && (p as number) >= 1 && (p as number) <= n;
  if (!seg || !ok(seg.pos) || !["cade", "noncade", "nulli"].includes(seg.effetto)) throw new TorreErrore("SEGNALINO");
  if (!ok(c.votoAutore) || (seg.effetto === "nulli" && c.votoAutore === seg.pos)) throw new TorreErrore("VOTO");   // il Megafono non può votare la carta con VOTI NULLI!
  const durata = LIMITI.durate[c.durata]; if (!durata) throw new TorreErrore("DURATA");
  return { id, creata: now, chiude: now + durata, elimina: null, carte: c.carte.slice(), verbo: f.verbo, frase: f.testo, eta, personaggioPubblico: !!c.personaggioPubblico,
    segnalino: { pos: seg.pos, effetto: seg.effetto }, votoAutore: c.votoAutore, adminHash, voti: [], segnalazioni: [], og: null, chiusaPrima: null, annullata: false };
}

export function statoDi(d: TorreData, now: number): Stato {
  if (d.annullata) return "annullata";
  if (d.segnalazioni.length >= LIMITI.segnalazioniNascondi) return "nascosta";
  return now >= (d.chiusaPrima?.at ?? d.chiude) ? "chiusa" : "aperta";
}
/** Istante in cui la torre chiude davvero (anticipata o a scadenza) e in cui sparisce. */
export const chiusuraEffettiva = (d: TorreData) => d.chiusaPrima?.at ?? d.chiude;
export const scadenzaDati = (d: TorreData) => chiusuraEffettiva(d) + LIMITI.risultatiMs;

export interface Riga { nick: string; punti: number; ordine: number; tu: boolean }
export interface Risultati { conteggi: number[]; totale: number; percento: number[]; cadono: number[]; segnalinoCaduta: boolean; classifica: Riga[]; effetto: Effetto; posSegnalino: number; votoAutore: number; annullati: number }

/** Voti, carte che cadono e punti, con le regole del gioco: cade la più votata (pari merito: tutte), +2 a chi vota una carta che cade, CADE +4, NON CADE +2, VOTI NULLI annulla i voti su quella carta. */
export function calcola(d: TorreData, dev?: string): Risultati {
  const n = d.carte.length, nul = d.segnalino.effetto === "nulli" ? d.segnalino.pos : 0;
  const validi = (p: number) => p !== nul, conteggi = Array(n).fill(0) as number[];
  const tutti: { pos: number }[] = [{ pos: d.votoAutore }, ...d.voti];
  for (const v of tutti) if (validi(v.pos)) conteggi[v.pos - 1]!++;
  const max = Math.max(0, ...conteggi), cadono = max > 0 ? conteggi.map((c, i) => (c === max ? i + 1 : 0)).filter(Boolean) : [];
  const cadeSeg = cadono.includes(d.segnalino.pos);
  const righe = d.voti.map((v, i) => {
    let p = 0;
    if (validi(v.pos) && cadono.includes(v.pos)) p += 2;
    if (v.pos === d.segnalino.pos) { if (d.segnalino.effetto === "cade" && cadeSeg) p += 4; else if (d.segnalino.effetto === "noncade" && !cadeSeg) p += 2; }
    return { v, i, p };
  });
  righe.sort((a, b) => b.p - a.p || a.v.at - b.v.at || a.i - b.i);   // a pari punti vince chi ha votato prima
  const classifica = righe.map((r, k) => ({ nick: r.v.nick || "Anonimo", punti: r.p, ordine: k + 1, tu: !!dev && r.v.dev === dev }));
  const totale = conteggi.reduce((a, b) => a + b, 0);
  return { conteggi, totale, percento: conteggi.map((c) => (totale ? Math.round((c / totale) * 100) : 0)), cadono, segnalinoCaduta: cadeSeg, classifica, effetto: d.segnalino.effetto, posSegnalino: d.segnalino.pos,
    votoAutore: d.votoAutore, annullati: nul ? tutti.filter((v) => v.pos === nul).length : 0 };
}

/** Cosa può vedere chi guarda. Mai il voto dell'autore né il tipo di segnalino finché la torre è aperta. */
export function vista(d: TorreData, now: number, dev?: string, admin?: boolean) {
  const stato = statoDi(d, now), base = { id: d.id, stato, eta: d.eta, chiude: chiusuraEffettiva(d), creata: d.creata, carte: d.carte, numVoti: d.voti.length, hasOg: !!d.og };
  if (stato === "annullata" || stato === "nascosta") return { id: d.id, stato, eta: d.eta, chiude: base.chiude, creata: d.creata, carte: [] as string[], numVoti: 0, hasOg: false };
  const mio = dev ? d.voti.find((v) => v.dev === dev) : undefined;
  const aperta = { ...base, verbo: d.verbo, frase: d.frase, posSegnalino: d.segnalino.pos, mioVoto: mio?.pos ?? null, mioNick: mio?.nick ?? null, autore: !!admin, annullabile: !!admin && now - d.creata <= LIMITI.annullaMs && stato === "aperta", chiusaPrima: !!d.chiusaPrima };
  if (stato === "aperta") return aperta;
  return { ...aperta, risultati: calcola(d, dev), scadeDati: scadenzaDati(d) };
}

export function vota(d: TorreData, dev: string, pos: number, now: number): void {
  if (statoDi(d, now) !== "aperta") throw new TorreErrore("CHIUSA");
  if (!Number.isInteger(pos) || pos < 1 || pos > d.carte.length) throw new TorreErrore("VOTO");
  if (d.voti.some((v) => v.dev === dev)) throw new TorreErrore("GIA_VOTATO");
  if (d.voti.length >= LIMITI.maxVoti) throw new TorreErrore("PIENA");
  d.voti.push({ dev, pos, at: now, nick: null });
}
export function nickname(d: TorreData, dev: string, nick: string): string {
  const v = d.voti.find((x) => x.dev === dev); if (!v) throw new TorreErrore("VOTO");
  const n = String(nick ?? "").normalize("NFKC").replace(/[\p{Cc}\p{Cf}]/gu, "").replace(/\s+/g, " ").trim().slice(0, LIMITI.maxNick);
  if (!n) { v.nick = null; return "Anonimo"; }
  if (!nicknameAmmesso(n)) throw new TorreErrore("NICK");
  v.nick = n; return n;
}
export function annulla(d: TorreData, admin: boolean, now: number): void {
  if (!admin) throw new TorreErrore("NON_AUTORE");
  if (now - d.creata > LIMITI.annullaMs) throw new TorreErrore("TARDI");
  d.annullata = true; d.elimina = now;
}
/** Chiusura anticipata dell'autore (dopo i primi 10 minuti): serve il motivo e la conferma scritta «CHIUDI». */
export function chiudiPrima(d: TorreData, admin: boolean, motivo: string, conferma: string, now: number): void {
  if (!admin) throw new TorreErrore("NON_AUTORE");
  if (statoDi(d, now) !== "aperta") throw new TorreErrore("CHIUSA");
  if (String(conferma).trim().toUpperCase() !== "CHIUDI" || !["errore", "frase", "altro"].includes(motivo)) throw new TorreErrore("CONFERMA");
  d.chiusaPrima = { motivo, at: now };
}
export function segnala(d: TorreData, dev: string): void { if (!d.segnalazioni.includes(dev)) d.segnalazioni.push(dev); }
