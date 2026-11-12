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

/**
 * I riquadri dei punti: su ogni carta una colonna ordinata, uno per giocatore che ha votato quella carta o che ha preso punti per quella carta
 * (la propria carta caduta, il segnalino del Megafono): faccia del giocatore e punti, dal più alto. L'altezza si adatta a quanti sono.
 * `pos[i]` = posizione della carta i+1 (come terracePos).
 */
export interface Chip { key: string; id: string; color: string; pos: number; gain: number; fast: boolean; x: number; y: number; w: number; h: number }
export function chipsFor(toks: Tok[], lines: Record<string, ScoreLine[]>, pos: Record<number, CardPos>, colorOf: (id: string) => string): Chip[] {
  const by = new Map<number, Map<string, { color: string; gain: number; fast: boolean }>>();
  const add = (cardPos: number, id: string, color: string, ls: ScoreLine[]) => {
    const m = by.get(cardPos) ?? new Map(); by.set(cardPos, m);
    const cur = m.get(id) ?? { color, gain: 0, fast: false };
    m.set(id, { color, gain: cur.gain + ls.reduce((a, l) => a + l.pts, 0), fast: cur.fast || ls.some((l) => l.kind === "mini-veloce") });
  };
  for (const t of toks) if (t.id) add(t.p, t.id, t.c, (lines[t.id] ?? []).filter((l) => l.pos === t.p));
  for (const [id, ls] of Object.entries(lines)) { const g = new Map<number, ScoreLine[]>(); for (const l of ls) g.set(l.pos, [...(g.get(l.pos) ?? []), l]); for (const [cp, group] of g) { if (!(by.get(cp)?.has(id))) add(cp, id, colorOf(id), group); } }
  const out: Chip[] = [];
  for (const [cp, m] of by) {
    const p = pos[cp - 1]; if (!p) continue;
    const list = [...m.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.gain - a.gain || (a.id < b.id ? -1 : 1)), cnt = list.length;
    const h = Math.max(16, Math.min(24, Math.floor((p.h - 6) / cnt))), w = Math.round(h * 2.4), y0 = p.f - p.h - 6 + (p.h - cnt * h) / 2 + 2;
    list.forEach((v, j) => out.push({ key: `${v.id}-${cp}`, id: v.id, color: v.color, pos: cp, gain: v.gain, fast: v.fast, x: p.x + (p.w - w) / 2, y: y0 + j * h, w, h: h - 1 }));
  }
  return out;
}
