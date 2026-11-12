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

/** Perché si prendono punti, a icone: accanto ai punti compare il simbolo del motivo (come il ⚡ del più veloce). I punti a 0 non hanno icona. */
export type Reason = "target" | "bolt" | "card" | "hand" | "flag";
export const REASON_ICON: Record<ScoreLine["kind"], Reason | ""> = {
  voto: "target", "mini-giusto": "target", "mini-veloce": "bolt", carta: "card",
  lui: "hand", "lui-gregge": "hand", "lui-folla": "hand", "lui-mancato": "", obiettivo: "flag", "obiettivo-folla": "flag", "obiettivo-mancato": "",
};
/** Le icone dei motivi di un insieme di righe, senza doppioni e nell'ordine in cui compaiono (bolt per primo). */
export function iconsOf(ls: ScoreLine[]): Reason[] {
  const out: Reason[] = [];
  for (const l of [...ls].sort((a, b) => Number(b.kind === "mini-veloce") - Number(a.kind === "mini-veloce"))) { const ic = l.pts > 0 ? REASON_ICON[l.kind] : ""; if (ic && !out.includes(ic)) out.push(ic); }
  return out;
}

/**
 * I riquadri dei punti: uno per giocatore che ha votato quella carta o che ha preso punti per quella carta (la propria carta, il segnalino
 * del Megafono): faccia, punti e, sull'angolo, le icone dei motivi. Stanno in basso sulla carta, su una o due colonne, e occupano al più
 * metà carta: l'immagine resta visibile. `pos[i]` = posizione della carta i+1 (come terracePos).
 */
export interface Chip { key: string; id: string; color: string; pos: number; gain: number; fast: boolean; icons: Reason[]; x: number; y: number; w: number; h: number }
export function chipsFor(toks: Tok[], lines: Record<string, ScoreLine[]>, pos: Record<number, CardPos>, colorOf: (id: string) => string): Chip[] {
  const by = new Map<number, Map<string, { color: string; ls: ScoreLine[] }>>();
  const add = (cardPos: number, id: string, color: string, ls: ScoreLine[]) => {
    const m = by.get(cardPos) ?? new Map(); by.set(cardPos, m);
    const cur = m.get(id) ?? { color, ls: [] };
    m.set(id, { color, ls: [...cur.ls, ...ls] });
  };
  for (const t of toks) if (t.id) add(t.p, t.id, t.c, (lines[t.id] ?? []).filter((l) => l.pos === t.p));
  for (const [id, ls] of Object.entries(lines)) { const g = new Map<number, ScoreLine[]>(); for (const l of ls) g.set(l.pos, [...(g.get(l.pos) ?? []), l]); for (const [cp, group] of g) { if (!(by.get(cp)?.has(id))) add(cp, id, colorOf(id), group); } }
  const out: Chip[] = [];
  for (const [cp, m] of by) {
    const p = pos[cp - 1]; if (!p) continue;
    const list = [...m.entries()].map(([id, v]) => ({ id, color: v.color, gain: v.ls.reduce((a, l) => a + l.pts, 0), fast: v.ls.some((l) => l.kind === "mini-veloce"), icons: iconsOf(v.ls) })).sort((a, b) => b.gain - a.gain || (a.id < b.id ? -1 : 1));
    const cnt = list.length;
    let h = 20, w = 0, cols = 1, rows = cnt;
    for (; h >= 14; h--) { w = Math.round(h * 2.3); cols = Math.max(1, Math.floor((p.w - 2) / (w + 2))); rows = Math.ceil(cnt / cols); if (rows * (h + 1) <= p.h * 0.5) break; }
    const bottom = p.f - 6 - 4, top = bottom - rows * (h + 1);
    list.forEach((v, j) => {
      const r = Math.floor(j / cols), inRow = Math.min(cols, cnt - r * cols), c = j - r * cols, rowW = inRow * (w + 2) - 2;
      out.push({ key: `${v.id}-${cp}`, id: v.id, color: v.color, pos: cp, gain: v.gain, fast: v.fast, icons: v.icons, x: p.x + (p.w - rowW) / 2 + c * (w + 2), y: top + r * (h + 1), w, h });
    });
  }
  return out;
}
