import type { PhraseCard } from "./types.ts";
import { shuffle } from "./rng.ts";

/** Fasce d'età delle frasi e della stanza. Un gruppo con fascia N pesca da tutte le frasi con età ≤ N. */
export type AgeBand = 6 | 10 | 14 | 18;
export const AGE_BANDS: readonly AgeBand[] = [6, 10, 14, 18];
export const DEFAULT_AGE_BAND: AgeBand = 14;
export const isAgeBand = (n: unknown): n is AgeBand => AGE_BANDS.includes(n as AgeBand);
/** «14+» → 14. */
export const parseAge = (s: string): AgeBand => { const n = parseInt(s, 10); if (!isAgeBand(n)) throw new Error(`età non valida: ${s}`); return n; };

export type PhraseFamily = "etichetta" | "collettivo" | "confronto" | "convinzione" | "ribaltato";
export const PHRASE_FAMILIES: readonly PhraseFamily[] = ["etichetta", "collettivo", "confronto", "convinzione", "ribaltato"];

/** Frase del Megafono nel mazzo (content/frasi-megafono.json). Completa: «Oggi {verb} sulla torre {text}». */
export interface PoolPhrase { id: string; text: string; verb: "sale" | "salgono"; family: PhraseFamily; age: AgeBand }
/** Confessione «Ammetto che…» (content/confessioni.json): carta a frase singola. */
export interface PoolConfession { id: string; text: string; age: AgeBand }

export const fullPhrase = (p: Pick<PoolPhrase, "verb" | "text">): string => `Oggi ${p.verb} sulla torre ${p.text}`;

export interface BuildOptions {
  /** Fascia d'età del gruppo. */
  age: AgeBand;
  seed: number;
  /** Frasi per carta (default 4). */
  perCard?: number;
  /** Numero massimo di carte a più frasi (default 48: più dei turni possibili, tiene piccolo lo stato salvato). */
  maxCards?: number;
  /** Includere le confessioni (default sì). */
  confessions?: boolean;
  /** Quota di carte-confessione sul mazzo (default 0,15). */
  confessionShare?: number;
}

/**
 * Costruisce il mazzo dalla riserva di frasi, filtrata per età.
 * - Ogni carta ha `perCard` frasi di **famiglie diverse**, così il Megafono sceglie fra forme diverse.
 * - **Pesca pesata**: almeno 2 frasi per carta vengono dalle due fasce più alte consentite al gruppo (le più miti fanno da riempitivo).
 * - Le confessioni entrano come carte a frase singola, in quota `confessionShare`.
 * Deterministico per `seed`.
 */
export function buildPhraseDeck(pool: readonly PoolPhrase[], confessions: readonly PoolConfession[], opts: BuildOptions): PhraseCard[] {
  const per = opts.perCard ?? 4, maxCards = opts.maxCards ?? 48, share = opts.confessionShare ?? 0.15, h = { rng: opts.seed | 0 };
  const eligible = pool.filter((p) => p.age <= opts.age);
  const allowed = AGE_BANDS.filter((a) => a <= opts.age), highMin = allowed[Math.max(0, allowed.length - 2)]!;
  type Bucket = { hi: PoolPhrase[]; lo: PoolPhrase[] };
  const buckets = new Map<PhraseFamily, Bucket>();
  for (const f of PHRASE_FAMILIES) {
    const items = shuffle(eligible.filter((p) => p.family === f), h);
    buckets.set(f, { hi: items.filter((p) => p.age >= highMin), lo: items.filter((p) => p.age < highMin) });
  }
  const left = (b: Bucket) => b.hi.length + b.lo.length;
  const take = (f: PhraseFamily, preferHigh: boolean): PoolPhrase => {
    const b = buckets.get(f)!, first = preferHigh ? b.hi : b.lo, second = preferHigh ? b.lo : b.hi;
    return (first.length ? first : second).shift()!;
  };
  const cards: PhraseCard[] = [];
  while (cards.length < maxCards) {
    const fams = shuffle(PHRASE_FAMILIES.filter((f) => left(buckets.get(f)!) > 0), h);
    // le prime due frasi (quelle "alte") vanno a famiglie che hanno ancora frasi delle fasce alte; le altre a caso fra le restanti
    const withHigh = fams.filter((f) => buckets.get(f)!.hi.length > 0), hiSlots = withHigh.slice(0, 2);
    if (hiSlots.length < Math.min(2, per)) break;   // finite le frasi delle fasce alte: meglio meno carte che una base di frasi miti
    const chosen = [...hiSlots, ...fams.filter((f) => !hiSlots.includes(f))].slice(0, per), picked: PoolPhrase[] = [];
    chosen.forEach((f, i) => picked.push(take(f, i < hiSlots.length)));
    while (picked.length < per) {
      const f = PHRASE_FAMILIES.find((x) => left(buckets.get(x)!) > 0);
      if (!f) break;
      picked.push(take(f, false));
    }
    if (picked.length < per) break;
    const ordered = shuffle(picked, h);
    cards.push({ id: `m-${cards.length + 1}`, phrases: ordered.map(fullPhrase) });
  }
  if (opts.confessions === false) return cards;
  const conf = shuffle(confessions.filter((c) => c.age <= opts.age), h);
  const n = Math.min(conf.length, Math.round((cards.length * share) / (1 - share)));
  return shuffle([...cards, ...conf.slice(0, n).map((c) => ({ id: c.id, phrases: [c.text] }))], h);
}
