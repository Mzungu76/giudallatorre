/**
 * La «lente» di un bot (v2o): come vede carte e frasi, con i suoi bias. Si estrae a inizio partita da (giocatore, stanza) e resta uguale per tutta la partita
 * (le persone hanno opinioni coerenti, non cambiano gusti a ogni turno). I valori di partenza sono IPOTESI di progetto, da tarare con le partite vere (docs/BOT_LENTI.md).
 *
 * Bias cognitivi (nessun legame con categorie di persone): salienza, posizione, ripetizione/«non può ricadere», effetto alone, fiducia nel segnalino,
 * preferenza per la propria carta, seconda lettura di una carta, gusto per il buffo, illusione di trasparenza, falso consenso.
 */
export type PosKind = "none" | "first" | "last" | "center";
export interface Lens {
  /** Quanto allarga le associazioni (peso delle etichette imparentate): 0 letterale … 1 fantasioso. */ reach: number;
  /** Peso della salienza (carte ricche di tratti forti attirano lo sguardo), in unità di logit. */ sal: number;
  posKind: PosKind; /** Intensità della preferenza di posizione. */ posG: number;
  /** Dopo una caduta: > 0 «è in serie, ricade», < 0 «non può ricadere» (logit sulla carta caduta il turno prima). */ rho: number;
  /** Effetto alone: il tratto più forte trascina le altre associazioni. */ halo: number;
  /** Moltiplica la fiducia nel segnalino (markBoost). */ markGain: number;
  /** Attrazione per la PROPRIA carta (logit): spicca per riconoscimento, anche se non è la più forte. */ own: number;
  /** Probabilità che una carta abbia una seconda lettura personale (un'etichetta vicina che per lui spicca). */ angle: number;
  /** Gusto per il buffo: attrazione per le carte caricaturali, a prescindere dalla frase. */ fun: number;
  /** Illusione di trasparenza: si crede più bravo a leggere il bluff (si somma alla profondità). */ trans: number;
  /** Falso consenso: quanto immagina gli altri simili a sé (0 = li immagina come la media). */ proj: number;
  /** Abitudini da Megafono (in punti attesi): tipo di segnalino preferito, e gusto per la carta più ovvia (+) o per la trappola (−). */ prefCade: number; prefNon: number; prefNul: number; obv: number;
  seed: number;
}
export const LENS_KEYS = ["reach", "sal", "posG", "rho", "halo", "markGain", "own", "angle", "fun", "trans", "proj"] as const;

export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function hash32(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/** Estrae una lente dalla «popolazione» (le ipotesi di partenza). */
export function drawLens(r: () => number, seed = 0): Lens {
  const k = r(), posKind: PosKind = k < 0.4 ? "none" : k < 0.6 ? "first" : k < 0.8 ? "last" : "center";
  return {
    reach: 0.2 + 0.6 * r(), sal: 0.6 * r(), posKind, posG: 0.1 + 0.3 * r(), rho: (r() - 0.5) * 0.8, halo: 0.4 * r(),
    markGain: 0.4 + 1.2 * r(), own: 0.2 + 0.9 * r(), angle: 0.5 * r(), fun: 0.5 * r(), trans: 0.35 * r(), proj: 0.5 * r(), prefCade: (r() - 0.5) * 2, prefNon: (r() - 0.5) * 2, prefNul: (r() - 0.5) * 2, obv: (r() - 0.5) * 1.6, seed: Math.floor(r() * 1e9),
  };
}
/** La lente di un bot: stabile per tutta la partita. */
export const lensFor = (me: string, playerIds: readonly string[]): Lens => { const s = hash32(`${me}|${playerIds.join(",")}`); return drawLens(mulberry(s), s); };

/** Come un bot immagina gli altri: estratti dalla popolazione ma spostati verso sé (falso consenso, `alpha` = lens.proj). */
export function imagineOther(r: () => number, own: Lens): Lens {
  const x = drawLens(r, 0), a = own.proj, out = { ...x } as Lens;
  for (const key of LENS_KEYS) out[key] = (1 - a) * x[key] + a * own[key];
  if (r() < a) { out.posKind = own.posKind; }
  out.seed = x.seed; return out;
}

/** Bias di posizione sulla carta in posizione `k` (1..n). */
export function posBias(l: Lens, k: number, n: number): number {
  if (l.posKind === "first") return k === 1 ? l.posG : 0;
  if (l.posKind === "last") return k === n ? l.posG : 0;
  if (l.posKind === "center") return Math.abs(k - (n + 1) / 2) < 0.75 ? l.posG : 0;
  return 0;
}

/**
 * Gli «sguardi» che non dipendono dalla frase, in unità di logit per ogni carta della torre: salienza, posizione, ripetizione, gusto per il buffo
 * e (solo per il proprio voto) la preferenza per la propria carta. Funzione pura.
 */
export function tasteLogits(l: Lens, n: number, sal: readonly number[], fun: readonly number[], recent: readonly boolean[], ownPos: number | null): number[] {
  const avg = sal.reduce((a, b) => a + b, 0) / Math.max(1, n);
  return Array.from({ length: n }, (_, i) => l.sal * (sal[i]! - avg) + l.fun * fun[i]! + posBias(l, i + 1, n) + (recent[i] ? l.rho : 0) + (ownPos === i + 1 ? l.own : 0));
}
