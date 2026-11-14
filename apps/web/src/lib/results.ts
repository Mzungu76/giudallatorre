import type { ScoreLine } from "@gdt/game-engine";

/**
 * Riepilogo visivo dei punti sulla torre: dove mettere i punteggi vicino ai gettoni e come sommarli. Funzioni pure (si provano con i test).
 * Le coordinate sono quelle del «disegno» della terrazza (come Terrace.tsx / scene/draw.ts).
 */
export interface Tok { p: number; c: string; id?: string; mega?: boolean }
export interface CardPos { x: number; f: number; w: number; h: number }

/** Punti guadagnati da ogni giocatore nel turno, dal più alto al più basso (a pari punti resta l'ordine dato). */
export function totals(lines: Record<string, ScoreLine[]>, ids: string[]): { id: string; gain: number }[] {
  return ids.map((id, i) => ({ id, gain: (lines[id] ?? []).reduce((a, l) => a + l.pts, 0), i })).sort((a, b) => b.gain - a.gain || a.i - b.i).map(({ id, gain }) => ({ id, gain }));
}

/** Quanto si abbassano le carte che stanno per cadere (spoglio). */
export const SINK = 14;
/** Le posizioni con le carte indicate (numeri da 1) abbassate di SINK. */
export function sunk(pos: Record<number, CardPos>, sink?: number[]): Record<number, CardPos> {
  if (!sink?.length) return pos;
  return Object.fromEntries(Object.entries(pos).map(([k, p]) => [k, sink.includes(Number(k) + 1) ? { ...p, f: p.f + SINK } : p]));
}
export interface Rect { x: number; y: number; w: number; h: number }
/**
 * La parte di una carta che si vede davvero: le carte della fila davanti coprono il fondo di quelle della fila dietro, quindi segnalini,
 * riquadri e frecce devono stare sopra il bordo alto delle carte davanti. `i` = indice della carta (0..n-1).
 */
export function visibleRect(pos: Record<number, CardPos>, i: number): Rect {
  const p = pos[i]!, top = p.f - p.h - 6; let vb = p.f - 6 - 4;
  for (const [k, q] of Object.entries(pos)) {
    if (Number(k) === i || q.f <= p.f + 20) continue;
    if (Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x) > 6) vb = Math.min(vb, q.f - q.h - 6 - 2);
  }
  const y = top + 3;
  return { x: p.x, y, w: p.w, h: Math.max(28, vb - y) };
}

/** Perché si prendono punti, a icone: accanto ai punti compare il simbolo del motivo (come il ⚡ del più veloce). I punti a 0 non hanno icona. */
export type Reason = "target" | "bolt" | "card" | "hand";
export const REASON_ICON: Record<ScoreLine["kind"], Reason | ""> = {
  voto: "target", "mini-giusto": "target", "mini-veloce": "bolt", carta: "card",
  lui: "hand", "lui-folla": "hand", "lui-mancato": "",
};
/** I punti per ogni icona (stesso motivo = una sola icona, punti sommati), con il ⚡ in testa. Le righe a 0 non hanno icona. */
export function iconPts(ls: ScoreLine[]): { k: Reason; pts: number }[] {
  const m = new Map<Reason, number>();
  for (const l of ls) { const ic = REASON_ICON[l.kind]; if (ic && l.pts !== 0) m.set(ic, (m.get(ic) ?? 0) + l.pts); }
  return [...m.entries()].map(([k, pts]) => ({ k, pts })).sort((a, b) => Number(b.k === "bolt") - Number(a.k === "bolt"));
}
/** Le icone dei motivi di un insieme di righe, senza doppioni e nell'ordine in cui compaiono (bolt per primo). */
export function iconsOf(ls: ScoreLine[]): Reason[] {
  const out: Reason[] = [];
  for (const l of [...ls].sort((a, b) => Number(b.kind === "mini-veloce") - Number(a.kind === "mini-veloce"))) { const ic = l.pts > 0 ? REASON_ICON[l.kind] : ""; if (ic && !out.includes(ic)) out.push(ic); }
  return out;
}

