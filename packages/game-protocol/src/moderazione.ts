import dati from "../../../content/moderazione.json";

/**
 * Moderazione delle frasi e dei nickname, uguale per tutta l'app (docs/TORRI_UTENTE.md).
 * Regole nostre, senza servizi esterni: gli elenchi stanno in `content/moderazione.json`.
 * Dà l'ETÀ MINIMA di un testo (6, 10, 14, 18) oppure lo dichiara «vietato» (non ammesso a nessuna età).
 * Non capisce il contesto: è un primo filtro, a cui si affianca la segnalazione dei giocatori.
 */
export type Eta = 6 | 10 | 14 | 18;
export const ETA_MODERAZIONE: readonly Eta[] = [6, 10, 14, 18];

interface Categoria { eta: number | null; nota?: string; parole?: string[]; radici?: string[]; frasi?: string[]; eccezioni?: string[] }
export interface Motivo { categoria: string; termine: string; eta: Eta | null }
export interface Esito {
  /** Testo non ammesso a nessuna età (odio, minacce, bestemmie, dati personali). */
  vietata: boolean;
  /** Età minima consigliata (6 se non c'è nulla di segnalato). Con `vietata` non conta. */
  etaMin: Eta;
  motivi: Motivo[];
  /** Possibili nomi di persona (parole con la maiuscola a metà frase che non sono tra quelle note): ammessi solo i personaggi pubblici. */
  nomiSospetti: string[];
}

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "€": "e", "!": "i", "|": "i" };
/** Minuscolo, senza accenni (à → a), cifre-lettera sostituite dentro le parole. */
const base = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const leet = (t: string) => (/\p{L}/u.test(t) ? t.replace(/[013457@$€!|]/g, (c) => LEET[c] ?? c) : t);
/** Lettere ripetute ridotte a una (caaazzo = cazo = cazzo). */
const collassa = (t: string) => t.replace(/(.)\1+/gu, "$1");

const cats = Object.entries((dati as { categorie: Record<string, Categoria> }).categorie);
type Voce = { categoria: string; eta: Eta | null; parole: Set<string>; radici: string[]; frasi: string[]; eccezioni: Set<string> };
const voci: Voce[] = cats.map(([categoria, c]) => ({
  categoria, eta: c.eta === null ? null : (c.eta as Eta),
  parole: new Set((c.parole ?? []).map((w) => collassa(base(w)))), radici: (c.radici ?? []).map((w) => collassa(base(w))),
  frasi: (c.frasi ?? []).map((f) => ` ${base(f).split(/\s+/).map(collassa).join(" ")} `), eccezioni: new Set((c.eccezioni ?? []).map((w) => collassa(base(w)))),
}));
const NOMI_AMMESSI = new Set(((dati as { nomiAmmessi?: string[] }).nomiAmmessi ?? []).map((n) => base(n)));

/** Le parole del testo, in tutte le forme in cui qualcuno può averle camuffate (c.a.z.z.o, ca*zo, c a z z o). */
function parole(testo: string): string[] {
  const n = base(testo), dividi = (s: string) => s.split(/[^\p{L}\p{N}@$€!|]+/u).filter(Boolean);
  const a = dividi(n);                                                   // parole separate da spazi e segni
  const b = dividi(n.replace(/(?<=[\p{L}\p{N}])[*._\-+]+(?=[\p{L}\p{N}])/gu, ""));   // segni dentro la parola: ca*zo, c.a.z.z.o
  const unite: string[] = []; let run = "";                              // lettere staccate: «c a z z o»
  for (const w of [...a, ""]) { if (w.length === 1 && /\p{L}/u.test(w)) run += w; else { if (run.length >= 3) unite.push(run); run = ""; } }
  return [...new Set([...a, ...b, ...unite])];
}

const RE_EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/u, RE_URL = /(https?:\/\/|www\.|\b[\w-]+\.(com|it|net|org|io|me|ly|gl|app|xyz)\b)/iu, RE_HANDLE = /(^|\s)@[\w.]{2,}/u;
function datiPersonali(testo: string): string | null {
  if (RE_EMAIL.test(testo)) return "email"; if (RE_URL.test(testo)) return "link"; if (RE_HANDLE.test(testo)) return "profilo social";
  const cifre = testo.replace(/[^\d]/g, ""); if (/\d[\d\s().+-]{5,}\d/.test(testo) && cifre.length >= 7) return "numero di telefono";
  return null;
}

/** Possibili nomi di persona: parole con l'iniziale maiuscola che non aprono la frase. */
function nomiSospetti(testo: string, extra: ReadonlySet<string>): string[] {
  const out: string[] = []; const re = /(?<![\p{L}\p{N}])\p{Lu}[\p{L}'’]+/gu; let m: RegExpExecArray | null;
  while ((m = re.exec(testo))) {
    const w = m[0], prima = testo.slice(0, m.index).trimEnd();
    if (!prima || /[.!?…:]$/.test(prima)) continue;                      // inizio di frase
    if (w.length > 1 && w === w.toUpperCase()) continue;                 // sigla (TV, ASL)
    const k = base(w); if (NOMI_AMMESSI.has(k) || extra.has(k)) continue;
    out.push(w);
  }
  return [...new Set(out)];
}

export interface OpzioniModerazione { /** Nomi (in minuscolo senza accenti) che non vanno segnalati, per esempio i nomi delle carte di un'espansione. */ nomiNoti?: ReadonlySet<string> }

/** Nomi noti (da elenchi di personaggi: «Donald Trump – Stati Uniti» → donald, trump, stati, uniti). */
export const nomiNoti = (elenco: readonly string[]): Set<string> => new Set(elenco.flatMap((s) => s.split(/[\s–-]+/).filter((w) => w.length > 1).map(base)));

export function valuta(testo: string, opz: OpzioniModerazione = {}): Esito {
  const motivi: Motivo[] = []; const dp = datiPersonali(testo);
  if (dp) motivi.push({ categoria: "dati_personali", termine: dp, eta: null });
  const ws = parole(testo), norm = ws.map((w) => collassa(leet(w)));
  const riga = ` ${base(testo).split(/[^\p{L}\p{N}@$€!|]+/u).filter(Boolean).map((w) => collassa(leet(w))).join(" ")} `;   // le parole in ordine (per le espressioni di più parole)
  for (const v of voci) {
    for (const w of norm) {
      if (v.eccezioni.has(w)) continue;
      if (v.parole.has(w) || v.radici.some((r) => w.startsWith(r))) { if (!motivi.some((m) => m.categoria === v.categoria && m.termine === w)) motivi.push({ categoria: v.categoria, termine: w, eta: v.eta }); }
    }
    for (const f of v.frasi) if (riga.includes(f)) motivi.push({ categoria: v.categoria, termine: f.trim(), eta: v.eta });
  }
  const vietata = motivi.some((m) => m.eta === null);
  const etaMin = motivi.reduce<Eta>((a, m) => (m.eta !== null && m.eta > a ? m.eta : a), 6);
  return { vietata, etaMin, motivi, nomiSospetti: nomiSospetti(testo, opz.nomiNoti ?? new Set()) };
}

/** Esito di una frase per un'età scelta: ammessa solo se non è vietata e l'età minima non supera quella scelta. */
export function verificaFrase(testo: string, etaScelta: number, opz: OpzioniModerazione = {}): Esito & { ok: boolean; motivoBlocco: "vietata" | "eta" | null } {
  const e = valuta(testo, opz), ok = !e.vietata && e.etaMin <= etaScelta;
  return { ...e, ok, motivoBlocco: e.vietata ? "vietata" : e.etaMin > etaScelta ? "eta" : null };
}

/** Un nickname deve andare bene a tutte le età: niente parole vietate, volgarità o dati personali (si ammette fino a 10+). */
export function nicknameAmmesso(nick: string): boolean { const e = valuta(nick); return !e.vietata && e.etaMin <= 10; }
