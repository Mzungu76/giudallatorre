import { useMemo } from "react";
import { animalMarkup } from "../lib/animals.ts";
import { useStage } from "../ui.tsx";

export interface StandRow { id: string; name: string; color: string; score: number }
const NV = "#13224a";

/** Pedina: disco colorato con l'animale del giocatore. */
export function Pawn({ color, size = 40 }: { color: string; size?: number }) {
  const html = `<svg width="${size}" height="${size + 8}" viewBox="-20 -20 40 48" style="overflow:visible"><ellipse cx="0" cy="19" rx="15" ry="5" fill="#0005"/><circle r="19" fill="${color}" stroke="${NV}" stroke-width="3.4"/><circle r="13.6" fill="#fff" stroke="${NV}" stroke-width="2.4"/><g transform="translate(-9.4 -9.4) scale(.188)">${animalMarkup(color, true)}</g></svg>`;
  return <span className="pawn" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Classifica come salita lungo la torre: le pedine stanno al centro e salgono in base ai punti.
 *  Oltre l'ultima tacca la torre si allunga (la scala passa a multipli di 10), così nessuno "esce" dal disegno. */
export default function Standings({ rows, turn, total, onClose }: { rows: StandRow[]; turn: number; total: number; onClose: () => void }) {
  const { H } = useStage();
  const best = Math.max(0, ...rows.map((r) => r.score));
  const top = Math.max(30, Math.ceil((best + 1) / 10) * 10), step = top > 60 ? 10 : 5;
  const yTop = 186, yBot = Math.max(yTop + 260, H - 142), span = yBot - yTop;
  const y = (s: number) => yBot - (Math.max(0, Math.min(top, s)) / top) * span;
  const ticks = useMemo(() => Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step), [top, step]);
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  const leader = sorted[0]?.score ?? 0;
  // pedine: stesso punteggio → affiancate al centro; etichette a destra/sinistra senza sovrapporsi
  const placed = useMemo(() => {
    const groups = new Map<number, number>();
    const items = [...rows].sort((a, b) => a.score - b.score).map((r) => { const k = groups.get(r.score) ?? 0; groups.set(r.score, k + 1); return { r, k }; });
    const lastY: Record<string, number> = { L: 99999, R: 99999 };
    return items.map(({ r, k }, i) => {
      const n = rows.filter((x) => x.score === r.score).length, dx = n > 1 ? (k - (n - 1) / 2) * 34 : 0, py = y(r.score);
      const side = (i % 2 === 0 ? "R" : "L") as "L" | "R";
      let ly = py - 10; if (lastY[side]! - ly < 34) ly = lastY[side]! - 34; lastY[side] = ly;
      return { r, dx, py, side, ly };
    });
  }, [rows, top, span]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="zoom on top stbd" role="dialog" aria-label="Classifica" data-testid="standings" style={{ height: H }}>
      <div className="stbd-sky" /><div className="stbd-rays" />
      <div className="stbd-title"><b>Classifica</b><small>{turn <= total ? `Turno ${turn} di ${total}` : "Spareggio"}{top > 30 ? ` · la torre è arrivata a ${top}!` : ""}</small></div>
      <button className="stbd-x" onClick={onClose} aria-label="Chiudi" data-testid="standings-close">×</button>
      <div className="stbd-tower" style={{ top: yTop - 34, height: span + 78 }}>
        <div className="stbd-merl">{Array.from({ length: 5 }, (_, i) => <i key={i} />)}</div>
        <div className="stbd-body" />
        <div className="stbd-door" />
      </div>
      <div className="stbd-flag" style={{ top: yTop - 84 }}><i /><b>{top}</b></div>
      {ticks.map((s) => (
        <div className={`stbd-tick ${s === top ? "top" : ""}`} key={s} style={{ top: y(s) }}><span>{s === 0 ? "VIA" : s}</span></div>
      ))}
      {placed.map(({ r, dx, py, side, ly }) => (
        <div key={r.id} className="stbd-grp">
          <div className={`stbd-lead ${side}`} style={{ top: py - 2, ["--dx" as string]: `${dx}px` }} />
          <div className={`stbd-tag ${side}`} style={{ top: ly - 12 }} data-testid="standings-row"><i className="dc" style={{ background: r.color }} /><span>{r.name}</span><b>{r.score}</b></div>
          <div className="stbd-pawn" style={{ left: `calc(50% + ${dx}px)`, top: py - 36, animationDelay: `${0.1 + (1 - r.score / Math.max(1, leader)) * 0.3}s` }}>
            {r.score === leader && leader > 0 && <em className="stbd-crown">👑</em>}
            <Pawn color={r.color} size={40} />
          </div>
        </div>
      ))}
      <button className="stbd-ok" onClick={onClose} data-testid="standings-ok">Chiudi</button>
    </div>
  );
}
