import { useEffect, useMemo } from "react";
import type { ScoreLine } from "@gdt/game-engine";
import { terracePos, voteTok } from "../scene/draw.ts";
import { Disc, useStage } from "../ui.tsx";
import { sfx } from "../lib/sfx.ts";
import { chipsFor, iconsOf, sunk, totals, visibleRect } from "../lib/results.ts";
import type { Rect, Tok } from "../lib/results.ts";
import { PtIcon } from "./Pt.tsx";
import { ReasonIcon } from "./ReasonIcon.tsx";

/** La grossa freccia rossa sulla carta che cade (nello spoglio scatta con un colpo; nel riepilogo rimbalza). */
export function FallArrow({ rect, slam, delay = 0 }: { rect: Rect | undefined; slam?: boolean; delay?: number }) {
  if (!rect) return null;
  const sz = Math.max(30, Math.min(48, rect.w * 0.7, rect.h * 0.55));
  return (
    <div className={`rs-fall${slam ? " slam" : ""}`} data-testid="card-fell" style={{ ...(delay ? { "--d": `${delay}s` } as React.CSSProperties : {}), left: rect.x, top: rect.y, width: rect.w, height: rect.h }}>
      <i className="rs-tint" />
      <svg className="rs-arrow" viewBox="0 0 60 70" style={{ width: sz, left: rect.w / 2 - sz / 2, top: rect.h - sz * 1.12 }} aria-hidden>
        <path d="M18 2h24v34h14L30 66 4 36h14z" fill="#e8362b" stroke="#fff" strokeWidth="5" strokeLinejoin="round" /><path d="M18 2h24v34h14L30 66 4 36h14z" fill="none" stroke="#13224a" strokeWidth="2.4" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

const sign = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
const cls = (n: number) => (n > 0 ? "up" : n < 0 ? "dn" : "zz");

/**
 * Il risultato disegnato sopra la torre, senza testi: accanto a ogni gettone di voto i punti di quella carta, sulle carte cadute una grossa
 * freccia rossa (nella Storia d'amore, un cuore sulle carte che vincono) e un velo rosso. Va messo subito dopo la `Terrace`.
 */
/** L'ordine in cui compaiono i punteggi: dal più alto, il Megafono per ultimo (il suo è il più atteso). */
export function popOrder(lines: Record<string, ScoreLine[]>, ids: string[], megaId?: string): string[] {
  const all = totals(lines, ids).map((r) => r.id);
  return megaId ? [...all.filter((i) => i !== megaId), ...all.filter((i) => i === megaId)] : all;
}
const STEP = 0.32;

export function ResultMarks({ n, votes, lines, fallen, win, colorOf, meId, megaId, sink, still, slam, luiPos, spread }: {
  /** Fila davanti più in basso (come la Terrace). */ spread?: boolean;
  n: number; votes: Tok[]; lines: Record<string, ScoreLine[]>; fallen: number[]; win?: number[]; colorOf: (id: string) => string; meId?: string; megaId?: string;
  /** Carte abbassate (quelle che cadono): i riquadri le seguono. */ sink?: number[]; /** Già visti: senza animazione. */ still?: boolean;
  /** Spoglio: la freccia scatta una carta alla volta e i punteggi arrivano dopo. */ slam?: boolean; /** Carte col Lui!: a sinistra resta posto per il segnalino. */ luiPos?: number[];
}) {
  const { ts, ty } = useStage(), pos = useMemo(() => sunk(terracePos(Math.max(3, n), spread), sink), [n, sink, spread]);
  const chips = useMemo(() => chipsFor(votes, lines, pos, colorOf, luiPos), [votes, lines, pos, luiPos]); // eslint-disable-line react-hooks/exhaustive-deps
  const order = useMemo(() => popOrder(lines, [...new Set([...Object.keys(lines), ...chips.map((c) => c.id)])], megaId), [lines, chips, megaId]);
  const t0 = still ? 0 : slam ? 0.3 + fallen.length * 0.45 : 0.3;
  return (
    <div className="layer rs-layer" style={{ transformOrigin: "186px 300px", transform: `translateY(${ty}px) scale(${ts})` }} data-testid="result-marks">
      {fallen.map((c, i) => <FallArrow key={`f${c}`} rect={pos[c - 1] ? visibleRect(pos, c - 1) : undefined} slam={slam && !still} delay={i * 0.45} />)}
      {(win ?? []).map((c) => { const p = pos[c - 1]; return p ? (
        <div key={`w${c}`} className="rs-win" data-testid="card-won" style={{ left: p.x, top: p.f - p.h - 6, width: p.w, height: p.h }}>
          <svg className="rs-heart" viewBox="0 0 32 29" style={{ width: Math.min(48, p.w * 0.55), left: p.w / 2 - Math.min(48, p.w * 0.55) / 2, top: p.h - Math.min(48, p.w * 0.55) * 0.5 }} aria-hidden><path d="M16 27C-6 12 3 -3 16 7 29 -3 38 12 16 27Z" fill="#ff4f7b" stroke="#fff" strokeWidth="4" strokeLinejoin="round" /><path d="M16 27C-6 12 3 -3 16 7 29 -3 38 12 16 27Z" fill="none" stroke="#13224a" strokeWidth="2" strokeLinejoin="round" /></svg>
        </div>) : null; })}
      {chips.map((c) => (
        <div key={c.key} className={`rs-pt ${cls(c.gain)}${c.id === meId ? " me" : ""}${still ? " still" : ""}`} data-testid="result-chip" style={{ left: c.x, top: c.y, width: c.w, height: c.h, fontSize: Math.round(c.h * 0.7), animationDelay: `${t0 + order.indexOf(c.id) * STEP}s` }}>
          <span className="rs-face" dangerouslySetInnerHTML={{ __html: voteTok(c.color, Math.max(12, c.h - 3), c.id === megaId, false) }} />
          {c.icons[0] && <span className="rs-ics" aria-hidden><ReasonIcon k={c.icons[0]} s={Math.round(c.h * 0.95)} className={c.icons[0] === "bolt" ? "rs-fast" : ""} /></span>}
          <b>{sign(c.gain)}</b>
        </div>
      ))}
    </div>
  );
}

/** La riga dei guadagni del turno: la faccia di ognuno e i suoi punti, dal più alto. `annullati` = chi ha perso il voto (VOTI NULLI!, Imbroglio!). */
export function ScoreStrip({ ids, lines, colorOf, meId, annullati, sound, interactive, onContinue, megaId, still, base = 0.3, quiet }: {
  megaId?: string; /** Già visto: senza animazione. */ still?: boolean; /** Attesa prima del primo punteggio (s). */ base?: number; /** Niente fanfara né avanzamento automatico (spoglio). */ quiet?: boolean;
  ids: string[]; lines: Record<string, ScoreLine[]>; colorOf: (id: string) => string; meId?: string; annullati?: string[]; sound: boolean; interactive: boolean; onContinue: () => void;
}) {
  useEffect(() => { if (!quiet && !still) sfx.tada(sound); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!interactive && !quiet) { const t = setTimeout(onContinue, 40000); return () => clearTimeout(t); } return undefined; }, [interactive]); // eslint-disable-line react-hooks/exhaustive-deps
  const ord = popOrder(lines, ids, megaId), rows = totals(lines, ids), icons = Object.fromEntries(ids.map((id) => [id, iconsOf(lines[id] ?? [])]));
  return (
    <div className="rs-strip" data-testid="points-panel">
      {rows.map(({ id, gain }, i) => (
        <div key={id} className={`rs-pl ${cls(gain)}${id === meId ? " me" : ""}${still ? " still" : ""}`} data-testid="points-block" style={{ animationDelay: `${base + Math.max(0, ord.indexOf(id)) * STEP}s` }}>
          <Disc color={colorOf(id)} size="l" />
          {annullati?.includes(id) ? <u className="rs-no" aria-hidden>🚫</u> : null}
          <b>{gain > 0 && <PtIcon s={19} />}{sign(gain)}</b>
          {(icons[id] ?? []).length > 0 && <span className="rs-sic" aria-hidden>{icons[id]!.map((ic) => <ReasonIcon key={ic} k={ic} s={24} className={ic === "bolt" ? "rs-fast" : ""} />)}</span>}
        </div>
      ))}
    </div>
  );
}
