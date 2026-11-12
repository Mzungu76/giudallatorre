import { useEffect, useMemo } from "react";
import type { ScoreLine } from "@gdt/game-engine";
import { terracePos, voteTok } from "../scene/draw.ts";
import { Disc, useStage } from "../ui.tsx";
import { sfx } from "../lib/sfx.ts";
import { chipsFor, totals } from "../lib/results.ts";
import type { Tok } from "../lib/results.ts";
import { PtIcon } from "./Pt.tsx";

const sign = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
const cls = (n: number) => (n > 0 ? "up" : n < 0 ? "dn" : "zz");

/**
 * Il risultato disegnato sopra la torre, senza testi: accanto a ogni gettone di voto i punti di quella carta, sulle carte cadute una grossa
 * freccia rossa (nella Storia d'amore, un cuore sulle carte che vincono) e un velo rosso. Va messo subito dopo la `Terrace`.
 */
export function ResultMarks({ n, votes, lines, fallen, win, colorOf, meId }: { n: number; votes: Tok[]; lines: Record<string, ScoreLine[]>; fallen: number[]; win?: number[]; colorOf: (id: string) => string; meId?: string }) {
  const { ts, ty } = useStage(), pos = useMemo(() => terracePos(Math.max(3, n)), [n]);
  const chips = useMemo(() => chipsFor(votes, lines, pos, colorOf), [votes, lines, pos]); // eslint-disable-line react-hooks/exhaustive-deps
  const order = [...chips].sort((a, b) => b.gain - a.gain);
  return (
    <div className="layer rs-layer" style={{ transformOrigin: "186px 300px", transform: `translateY(${ty}px) scale(${ts})` }} data-testid="result-marks">
      {fallen.map((c) => { const p = pos[c - 1]; return p ? (
        <div key={`f${c}`} className="rs-fall" data-testid="card-fell" style={{ left: p.x, top: p.f - p.h - 6, width: p.w, height: p.h }}>
          <i className="rs-tint" />
          <svg className="rs-arrow" viewBox="0 0 60 70" style={{ width: Math.min(56, p.w * 0.62), left: p.w / 2 - Math.min(56, p.w * 0.62) / 2, top: p.h - Math.min(56, p.w * 0.62) * 0.42 }} aria-hidden>
            <path d="M18 2h24v34h14L30 66 4 36h14z" fill="#e8362b" stroke="#fff" strokeWidth="5" strokeLinejoin="round" /><path d="M18 2h24v34h14L30 66 4 36h14z" fill="none" stroke="#13224a" strokeWidth="2.4" strokeLinejoin="round" />
          </svg>
        </div>) : null; })}
      {(win ?? []).map((c) => { const p = pos[c - 1]; return p ? (
        <div key={`w${c}`} className="rs-win" data-testid="card-won" style={{ left: p.x, top: p.f - p.h - 6, width: p.w, height: p.h }}>
          <svg className="rs-heart" viewBox="0 0 32 29" style={{ width: Math.min(48, p.w * 0.55), left: p.w / 2 - Math.min(48, p.w * 0.55) / 2, top: p.h - Math.min(48, p.w * 0.55) * 0.5 }} aria-hidden><path d="M16 27C-6 12 3 -3 16 7 29 -3 38 12 16 27Z" fill="#ff4f7b" stroke="#fff" strokeWidth="4" strokeLinejoin="round" /><path d="M16 27C-6 12 3 -3 16 7 29 -3 38 12 16 27Z" fill="none" stroke="#13224a" strokeWidth="2" strokeLinejoin="round" /></svg>
        </div>) : null; })}
      {chips.map((c) => (
        <div key={c.key} className={`rs-pt ${cls(c.gain)}${c.id === meId ? " me" : ""}`} data-testid="result-chip" style={{ left: c.x, top: c.y, width: c.w, height: c.h, fontSize: Math.round(c.h * 0.7), animationDelay: `${0.35 + order.indexOf(c) * 0.12}s` }}>
          <span className="rs-face" dangerouslySetInnerHTML={{ __html: voteTok(c.color, Math.max(12, c.h - 3), false, false) }} />
          {c.fast && <span className="rs-fast" aria-hidden>⚡</span>}
          <b>{sign(c.gain)}</b>
        </div>
      ))}
    </div>
  );
}

/** La riga dei guadagni del turno: la faccia di ognuno e i suoi punti, dal più alto. `annullati` = chi ha perso il voto (VOTI NULLI!, Imbroglio!). */
export function ScoreStrip({ ids, lines, colorOf, meId, annullati, sound, interactive, onContinue }: {
  ids: string[]; lines: Record<string, ScoreLine[]>; colorOf: (id: string) => string; meId?: string; annullati?: string[]; sound: boolean; interactive: boolean; onContinue: () => void;
}) {
  useEffect(() => { sfx.tada(sound); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!interactive) { const t = setTimeout(onContinue, 7000); return () => clearTimeout(t); } return undefined; }, [interactive]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = totals(lines, ids);
  return (
    <div className="rs-strip" data-testid="points-panel">
      {rows.map(({ id, gain }, i) => (
        <div key={id} className={`rs-pl ${cls(gain)}${id === meId ? " me" : ""}`} data-testid="points-block" style={{ animationDelay: `${0.2 + i * 0.1}s` }}>
          <Disc color={colorOf(id)} size="l" />
          {annullati?.includes(id) ? <u className="rs-no" aria-hidden>🚫</u> : null}
          <b>{gain > 0 && <PtIcon s={19} />}{sign(gain)}</b>
        </div>
      ))}
    </div>
  );
}
