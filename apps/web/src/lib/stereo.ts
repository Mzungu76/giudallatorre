import type { GameState } from "@gdt/game-engine";
import { ts } from "./testi.ts";
import type { TestoKey } from "./testi.ts";

export interface StereoGame { pct: number; caso: number; n: number; top: { k: string; n: number; pct: number; det: { v: number; m: number; e: number; c: Record<string, number> } | null }[]; /** Voti diretti dietro tutti i luoghi comuni di ruolo (per dire quanto è solida la stima). */ votiLuoghi: number; lancio: { cardId: string; ruolo: string; n: number; text: string } | null; /** La caratteristica (aspetto) comune alle carte dietro i luoghi comuni di ruolo con lo stesso tratto del primo, se c'è. */ comune: { k: string; pct: number; n: number; tot: number } | null }
/** Il pannello «Luoghi comuni» è della PARTITA, non dei giocatori: quanta parte dei voti di tutti si spiega con un luogo comune, quanto sarebbe stato per caso e quali luoghi comuni hanno pesato di più. */
export function stereoGame(st: GameState["stereo"] | null | undefined, max = 3): StereoGame | null {
  if (!st || !st.turni) return null;
  const n = Object.values(st.n).reduce((a, b) => a + b, 0); if (!n) return null;
  const s = Object.values(st.s).reduce((a, b) => a + b, 0);
  // i luoghi comuni sono quelli di RUOLO («politico → bugiardo»); gli aspetti («@cravatta → …») non entrano nella classifica: servono a trovare la caratteristica comune
  const ruoli = Object.entries(st.cause ?? {}).filter(([k]) => !k.startsWith("@")), pesi = ruoli.reduce((a, [, v]) => a + v, 0);   // percentuale = quota del peso totale dei luoghi comuni emersi
  const top = ruoli.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, max).map(([k, v]) => ({ k, n: v, pct: pesi > 0 ? Math.round((v / pesi) * 100) : 0, det: st.det?.[k] ?? null }));
  const votiLuoghi = ruoli.reduce((a, [k]) => a + (st.det?.[k]?.v ?? 0), 0);
  let comune: StereoGame["comune"] = null;
  if (top[0]) {   // tra i luoghi comuni con lo stesso tratto del primo: l'aspetto presente in almeno metà dei voti (e almeno 2)
    const tratto = top[0].k.split(" → ")[1], gruppo = top.filter((x) => x.k.split(" → ")[1] === tratto).map((x) => st.asp?.[x.k]).filter((x): x is NonNullable<typeof x> => !!x);
    const tot = gruppo.reduce((a, x) => a + x.n, 0), conta: Record<string, number> = {}; for (const x of gruppo) for (const [l, c] of Object.entries(x.l)) conta[l] = (conta[l] ?? 0) + c;
    const mig = Object.entries(conta).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (tratto && mig && mig[1] >= 2 && tot > 0 && mig[1] / tot >= 0.5) comune = { k: `@${mig[0]} → ${tratto}`, pct: Math.round((mig[1] / tot) * 100), n: mig[1], tot };
  }
  const L = st.lancio;
  return { pct: Math.round((s / n) * 100), caso: Math.round((st.c / st.turni) * 100), n, top, votiLuoghi, comune, lancio: L ? { cardId: L.cardId, ruolo: ruoloDi(L.causa), n: L.n, text: L.text } : null };
}

/** Nome breve del soggetto di un luogo comune: «politico → bugiardo» → «Politico»; «@cravatta → bugiardo» (aspetto) → «Cravatta». */
export const ruoloDi = (causa: string): string => { const r = (causa.split(" → ")[0] ?? causa).replace(/^@/, "").replace(/_/g, " "); return r.charAt(0).toUpperCase() + r.slice(1); };
const MIN = (x: string) => x.charAt(0).toLowerCase() + x.slice(1);
/** Il tratto al plurale (maschile o femminile): bugiardo → bugiardi / bugiarde, egoista → egoisti / egoiste, drammatico → drammatici / drammatiche, infedele → infedeli. Invariato se non finisce in vocale (nerd). */
export function trattoPlurale(t: string, femm: boolean): string {
  if (/co$/.test(t)) return t.slice(0, -2) + (femm ? "che" : "ci");
  if (/o$/.test(t)) return t.slice(0, -1) + (femm ? "e" : "i");
  if (/a$/.test(t)) return t.slice(0, -1) + (femm ? "e" : "i");
  if (/e$/.test(t)) return t.slice(0, -1) + "i";
  return t;
}
/** Il luogo comune come frase: ruolo → «I politici sono bugiardi»; aspetto → «Chi porta la cravatta è più bugiardo degli altri». Se la voce non è nei testi, ricade sul nome grezzo. */
export function fraseLuogo(causa: string): string {
  const [sogg = "", tratto = ""] = causa.split(" → "); if (!tratto) return causa;
  const asp = sogg.startsWith("@"), id = asp ? sogg.slice(1) : sogg, chiave = (asp ? `lc.a.${id}` : `lc.r.${id}`) as TestoKey, chi = ts(chiave);
  if (chi === chiave) return causa;
  return asp ? ts("lc.frase.a", { chi, tratto }) : ts("lc.frase.r", { chi, tratto: trattoPlurale(tratto, chi.startsWith("Le ")) });
}
/** Umani contro bot: quota dei voti «per luogo comune» di ciascun gruppo (null se il gruppo non ha votato). */
export function stereoGruppi(st: GameState["stereo"] | null | undefined, isBot: (id: string) => boolean): { umani: number | null; bot: number | null } {
  const acc = { u: [0, 0], b: [0, 0] };
  for (const [id, n] of Object.entries(st?.n ?? {})) { const g = isBot(id) ? acc.b : acc.u; g[0]! += st?.s[id] ?? 0; g[1]! += n; }
  const q = (g: number[]) => (g[1] ? Math.round((g[0]! / g[1]!) * 100) : null);
  return { umani: q(acc.u), bot: q(acc.b) };
}

/** Le fasce del pregiudiziometro: ogni voto è già un giudizio a occhio, quindi il tachimetro parte da circa il 35% e le fasce stanno nella parte alta. */
export const SEG_PREGIUDIZIO = [{ a: 0, b: 0.5, c: "#4aa63a" }, { a: 0.5, b: 0.65, c: "#f4c20d" }, { a: 0.65, b: 0.8, c: "#f08a1c" }, { a: 0.8, b: 1, c: "#e5382b" }] as const;
export const fasciaPregiudizio = (pct: number): 0 | 1 | 2 | 3 => (pct < 50 ? 0 : pct < 65 ? 1 : pct < 80 ? 2 : 3);

/** Il messaggio di testo della partita: Pregiudiziometro, i primi luoghi comuni con le percentuali, il mio punteggio. */
export function testoPartita(st: GameState["stereo"] | null | undefined, punti: { punti: number; posto: number; tot: number } | null, url: string): string {
  const g = stereoGame(st), righe: string[] = [];
  if (g) {
    righe.push(ts("share.pg.pgm", { pct: g.pct }));
    if (g.top.length) { righe.push(ts("share.pg.t")); for (const x of g.top) righe.push(ts("share.pg.riga", { frase: fraseLuogo(x.k), pct: x.pct })); }
  }
  if (punti) righe.push(ts("share.pg.punti", punti));
  righe.push(url); return righe.join("\n");
}
