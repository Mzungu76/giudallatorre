import { nextRandom } from "./rng.ts";
import type { Award, AwardId, PlayerId, TurnRecord } from "./types.ts";

/**
 * Premio della serata: a fine partita se ne assegna UNO, estratto con pesi tra quelli la cui soglia è stata raggiunta.
 * Se nessuno raggiunge la soglia va il premio di consolazione («Il Tabellone Vuoto», a chi ha meno punti).
 * Funzioni pure sul registro dei turni: il sorteggio usa lo stato rng del motore, quindi è deterministico e uguale per tutti i client.
 */

/** Peso di ogni premio nel sorteggio (più alto = più probabile). */
export const AWARD_WEIGHTS: Record<Exclude<AwardId, "tabellone">, number> = {
  bugiardo: 3, pollo: 3, ingenuo: 3, segugio: 2, bersaglio: 2, ruffiano: 2, lupo: 2, narciso: 2, veggente: 1, bocciato: 1,
};
export const AWARD_IDS = [...Object.keys(AWARD_WEIGHTS), "tabellone"] as AwardId[];

export interface AwardInput { playerIds: PlayerId[]; scores: Record<PlayerId, number>; history: TurnRecord[]; botIds?: PlayerId[] }
export interface AwardCandidate { id: Exclude<AwardId, "tabellone">; winners: PlayerId[]; n: number; of: number }

const count = <T>(xs: T[], f: (x: T) => boolean) => xs.reduce((a, x) => a + (f(x) ? 1 : 0), 0);
const ownedPos = (t: TurnRecord, p: PlayerId): number | null => { for (const [pos, o] of Object.entries(t.owners)) if (o === p) return Number(pos); return null; };

/** Chi può vincere: i giocatori veri (se ci sono solo giocatori virtuali, tutti). */
export function eligiblePlayers(i: Pick<AwardInput, "playerIds" | "botIds">): PlayerId[] {
  const humans = i.playerIds.filter((p) => !(i.botIds ?? []).includes(p));
  return humans.length ? humans : i.playerIds.slice();
}

/** I premi la cui soglia è stata raggiunta, con i vincitori a pari merito e il numero che li motiva. */
export function awardCandidates(i: AwardInput): AwardCandidate[] {
  const H = i.history, T = H.length, elig = eligiblePlayers(i), out: AwardCandidate[] = [];
  if (T === 0) return out;
  // `best`: tra i giocatori eleggibili vince chi ha il valore più alto (o più basso con `low`) che supera la soglia
  const best = (id: AwardCandidate["id"], stat: (p: PlayerId) => { n: number; of: number }, ok: (n: number, of: number) => boolean, low = false) => {
    const rows = elig.map((p) => ({ p, ...stat(p) })).filter((r) => r.of > 0 && ok(r.n, r.of));
    if (!rows.length) return;
    const top = low ? Math.min(...rows.map((r) => r.n)) : Math.max(...rows.map((r) => r.n));
    const w = rows.filter((r) => r.n === top);
    out.push({ id, winners: w.map((r) => r.p), n: top, of: w[0]!.of });
  };
  const folla = (p: PlayerId) => H.filter((t) => t.megafonoId !== p);
  const voted = (p: PlayerId) => H.filter((t) => t.votes[p] !== undefined);
  const received = (p: PlayerId) => {
    let n = 0, of = 0;
    for (const t of H) { const pos = ownedPos(t, p); if (pos === null) continue; of++; n += count(Object.entries(t.votes), ([v, vp]) => v !== p && vp === pos); }
    return { n, of };
  };

  // Il Pollo: ha votato la carta su cui il Megafono aveva posato il segnalino
  best("pollo", (p) => { const f = folla(p).filter((t) => t.mark); return { n: count(f, (t) => t.votes[p] === t.mark!.position), of: f.length }; }, (n, of) => n >= 2 && n / of >= 0.6);
  // Il Segugio: ha votato più spesso la carta che poi è caduta
  best("segugio", (p) => { const v = voted(p); return { n: count(v, (t) => t.fallen.includes(t.votes[p]!)), of: v.length }; }, (n, of) => n >= 3 && n / of >= 0.6);
  // L'Ingenuo: ha votato più spesso carte che non sono cadute
  best("ingenuo", (p) => { const v = voted(p); return { n: count(v, (t) => !t.fallen.includes(t.votes[p]!)), of: v.length }; }, (n, of) => n >= 3 && n / of >= 0.6);
  // Il Bugiardo di Stato: le sue carte hanno preso pochissimi voti degli altri (nessuno lo ha sospettato)
  best("bugiardo", received, (n, of) => of >= 3 && n <= of * 0.25, true);
  // Il Bersaglio: le sue carte hanno preso moltissimi voti degli altri
  best("bersaglio", received, (n, of) => of >= 3 && n / of >= 1.25);
  // Il Ruffiano: ha votato la carta del Megafono di turno
  best("ruffiano", (p) => { const f = folla(p); return { n: count(f, (t) => ownedPos(t, t.megafonoId) === t.votes[p]), of: f.length }; }, (n, of) => n >= 2 && n / of >= 0.5);
  // Il Lupo Solitario: ha votato spesso una carta che nessun altro ha votato
  best("lupo", (p) => { const v = voted(p); return { n: count(v, (t) => !Object.entries(t.votes).some(([q, pos]) => q !== p && pos === t.votes[p])), of: v.length }; }, (n, of) => n >= 2 && n / of >= 0.4);
  // Il Narciso: ha votato la propria carta
  best("narciso", (p) => { const v = voted(p); return { n: count(v, (t) => t.owners[t.votes[p]!] === p), of: v.length }; }, (n, of) => n >= 2 && n / of >= 0.4);

  // Il Veggente / Il Visionario Bocciato: da Megafono ha azzeccato (o sbagliato) tutti i segnalini. Premio solo se non vale per tutti.
  const marks = (p: PlayerId) => H.filter((t) => t.megafonoId === p && t.mark);
  const allOrNone = (id: "veggente" | "bocciato", hit: boolean) => {
    const w = elig.filter((p) => { const m = marks(p); return m.length > 0 && m.every((t) => t.mark!.hit === hit); });
    if (w.length && w.length < elig.length) out.push({ id, winners: w, n: marks(w[0]!).length, of: marks(w[0]!).length });
  };
  allOrNone("veggente", true); allOrNone("bocciato", false);
  return out;
}

/** Sceglie il premio della serata. Aggiorna `holder.rng`. Restituisce sempre un premio (al peggio quello di consolazione). */
export function pickAward(i: AwardInput, holder: { rng: number }): Award | null {
  const draw = () => { const r = nextRandom(holder.rng); holder.rng = r.state; return r.value; };
  const elig = eligiblePlayers(i);
  if (!elig.length) return null;
  const pickOf = <T>(xs: T[]) => xs[Math.min(xs.length - 1, Math.floor(draw() * xs.length))]!;
  const cands = awardCandidates(i);
  if (cands.length) {
    const total = cands.reduce((a, c) => a + AWARD_WEIGHTS[c.id], 0);
    let r = draw() * total, chosen = cands[cands.length - 1]!;
    for (const c of cands) { r -= AWARD_WEIGHTS[c.id]; if (r < 0) { chosen = c; break; } }
    return { id: chosen.id, winnerId: pickOf(chosen.winners), n: chosen.n, of: chosen.of };
  }
  const low = Math.min(...elig.map((p) => i.scores[p] ?? 0));
  return { id: "tabellone", winnerId: pickOf(elig.filter((p) => (i.scores[p] ?? 0) === low)), n: low, of: 0, consolation: true };
}
