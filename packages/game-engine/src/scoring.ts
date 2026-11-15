import { tallyMarks } from "./engine.ts";
import type { LuiEffect, LuiSlot, MarkOutcome, PlayerId, ScoreLine, TowerSlot } from "./types.ts";

/**
 * «Cade / Non cade»: punti di un turno, calcolabili anche su turni IPOTETICI (è ciò che serve a un motore che simula).
 * Funzione pura. Il conteggio dei voti passa da `tallyMarks` del motore; i punti riproducono `resolve()` di engine.ts.
 * ATTENZIONE: engine.ts resta la fonte ufficiale delle regole e NON è stato modificato; l'uguaglianza con `resolve()` è garantita da
 * `tests/scoring.equivalence.test.ts` (migliaia di turni reali). Se le regole cambiano, quel test fallisce finché non si aggiornano entrambe.
 * `tower` può avere i proprietari nascosti (`ownerId: null`): allora non si assegna il +2 della carta. `votes` deve contenere tutti i giocatori.
 * `withLines = false` salta il dettaglio delle voci (più veloce, per le simulazioni).
 */
export function scoreTurn(tower: TowerSlot[], playerIds: PlayerId[], mega: PlayerId, votes: Record<PlayerId, number>, marks: { slot: LuiSlot; effect: string; position: number }[], withLines = true) {
  const positions: number[] = []; for (const t of tower) positions.push(t.position);
  const T = tallyMarks(positions, votes, marks), { annulled, fallen } = T;
  const slots: TowerSlot[] = []; for (const f of fallen) slots.push(tower.find((t) => t.position === f)!);
  const points: Record<PlayerId, number> = {}, lines: Record<PlayerId, ScoreLine[]> = {};
  for (const p of playerIds) { points[p] = 0; if (withLines) lines[p] = []; }
  const L = withLines ? lines : null;
  // voto giusto (voto valido) e carta caduta (anche quella del Megafono)
  for (const p of playerIds) if (!annulled.includes(p) && fallen.includes(votes[p]!)) give(points, L, p, 2, "voto", votes[p]!);
  for (const sl of slots) if (sl.ownerId !== null) give(points, L, sl.ownerId, 2, "carta", sl.position);
  // segnalini: CADE +4 se cade, NON CADE +2 se resta su, al Megafono (ovunque abbia votato, una volta sola) e a ognuno della Folla che l'ha votata
  const outs: MarkOutcome[] = [];
  for (const m of marks) {
    const fell = fallen.includes(m.position), voters: PlayerId[] = [];
    for (const p of playerIds) if (p !== mega && !annulled.includes(p) && votes[p] === m.position) voters.push(p);
    if (m.effect === "nulli") { const caught = annulled.slice(); outs.push({ slot: m.slot, effect: "nulli", position: m.position, hit: caught.length > 0, voters: [], caught }); continue; }
    const effect: LuiEffect = m.effect === "cade" ? "cade" : "noncade", hit = effect === "cade" ? fell : !fell, pts = effect === "cade" ? 4 : 2;
    if (hit) { give(points, L, mega, pts, "lui", m.position, voters.length); for (const p of voters) give(points, L, p, pts, "lui-folla", m.position); }
    else if (L) L[mega]!.push({ kind: "lui-mancato", pts: 0, pos: m.position });
    outs.push({ slot: m.slot, effect, position: m.position, hit, voters });
  }
  return { T, slots, points, lines, outs };
}
function give(points: Record<PlayerId, number>, lines: Record<PlayerId, ScoreLine[]> | null, p: PlayerId, pts: number, kind: ScoreLine["kind"], pos: number, n?: number): void {
  points[p]! += pts; if (lines) lines[p]!.push(n === undefined ? { kind, pts, pos } : { kind, pts, pos, n });
}
