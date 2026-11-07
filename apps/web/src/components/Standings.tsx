import { useEffect, useMemo, useState } from "react";
import { tokenUrl } from "../lib/characters.ts";
import { useStage } from "../ui.tsx";

export interface StandRow { id: string; name: string; color: string; score: number; /** Punteggio prima del turno: se c'è, le pedine partono da lì e salgono al nuovo. */ prev?: number }
const NV = "#13224a";

/** Pedina: il segnalino del personaggio. */
export function Pawn({ color, size = 40 }: { color: string; size?: number }) {
  return <span className="pawn"><img src={tokenUrl(color)} width={size} height={size} alt="" style={{ display: "block", filter: "drop-shadow(0 3px 0 #13224a88)" }} /></span>;
}

/** Classifica come salita lungo la torre: le pedine stanno al centro e salgono in base ai punti.
 *  Oltre l'ultima tacca la torre si allunga (la scala passa a multipli di 10), così nessuno "esce" dal disegno. */
export default function Standings({ rows, turn, total, onClose, action, title }: { rows: StandRow[]; turn: number; total: number; onClose: () => void; /** Pulsante principale (es. "Prosegui") o un messaggio di attesa al suo posto. */ action?: { label: string; onClick: () => void } | { wait: string }; title?: string }) {
  const { H } = useStage(), animate = rows.some((r) => r.prev !== undefined && r.prev !== r.score), [moved, setMoved] = useState(!animate);
  useEffect(() => { if (!animate) return undefined; const t = setTimeout(() => setMoved(true), 900); return () => clearTimeout(t); }, [animate]);
  const shown = (r: StandRow) => (moved ? r.score : r.prev ?? r.score);
  const best = Math.max(0, ...rows.map((r) => r.score));
  const top = Math.max(30, Math.ceil((best + 1) / 10) * 10), step = top > 60 ? 10 : 5;
  const yTop = 186, yBot = Math.max(yTop + 260, H - 142), span = yBot - yTop;
  const y = (s: number) => yBot - (Math.max(0, Math.min(top, s)) / top) * span;
  const ticks = useMemo(() => Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step), [top, step]);
  const leader = Math.max(0, ...rows.map(shown));
  // pedine: stesso punteggio → affiancate al centro; etichette a destra/sinistra senza sovrapporsi
  const placed = useMemo(() => {
    const groups = new Map<number, number>();
    const items = [...rows].sort((a, b) => shown(a) - shown(b)).map((r) => { const k = groups.get(shown(r)) ?? 0; groups.set(shown(r), k + 1); return { r, k }; });
    const lastY: Record<string, number> = { L: 99999, R: 99999 };
    return items.map(({ r, k }, i) => {
      const n = rows.filter((x) => shown(x) === shown(r)).length, dx = n > 1 ? (k - (n - 1) / 2) * 34 : 0, py = y(shown(r));
      const side = (i % 2 === 0 ? "R" : "L") as "L" | "R";
      let ly = py - 10; if (lastY[side]! - ly < 34) ly = lastY[side]! - 34; lastY[side] = ly;
      return { r, dx, py, side, ly };
    });
  }, [rows, top, span, moved]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="zoom on top stbd" role="dialog" aria-label="Classifica" data-testid="standings" style={{ height: H }}>
      <div className="stbd-sky" /><div className="stbd-rays" />
      <div className="stbd-title"><b>{title ?? "Classifica"}</b><small>{turn <= total ? `Turno ${turn} di ${total}` : "Spareggio"}{top > 30 ? ` · la torre è arrivata a ${top}!` : ""}</small></div>
      {!action && <button className="stbd-x" onClick={onClose} aria-label="Chiudi" data-testid="standings-close">×</button>}
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
          <div className={`stbd-tag ${side}`} style={{ top: ly - 12 }} data-testid="standings-row"><i className="dc" style={{ background: r.color }} /><span>{r.name}</span><b>{shown(r)}</b>{r.prev !== undefined && r.score !== r.prev && <u className={`stbd-d ${r.score < r.prev ? "neg" : ""}`}>{r.score > r.prev ? "+" : "−"}{Math.abs(r.score - r.prev)}</u>}</div>
          <div className="stbd-pawn" style={{ left: `calc(50% + ${dx}px)`, top: py - 36, animationDelay: `${0.1 + (1 - shown(r) / Math.max(1, leader)) * 0.3}s` }}>
            {shown(r) === leader && leader > 0 && <em className="stbd-crown">👑</em>}
            <Pawn color={r.color} size={40} />
          </div>
        </div>
      ))}
      {action && "wait" in action ? <div className="stbd-wait" data-testid="standings-wait">{action.wait}</div>
        : <button className="stbd-ok" onClick={action ? action.onClick : onClose} data-testid={action ? "standings-action" : "standings-ok"}>{action ? action.label : "Chiudi"}</button>}
    </div>
  );
}
