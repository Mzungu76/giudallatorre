import { useEffect, useMemo, useRef, useState } from "react";
import { terraceBaseHtml, terraceCardsHtml, terracePos, profileShaft } from "../scene/draw.ts";
import { cardFull } from "../lib/cards.ts";
import { FAST, useStage } from "../ui.tsx";
import { usePersona } from "./Persona.tsx";
import { sfx } from "../lib/sfx.ts";
import type { LuiSpec, MarkOutcome, ScoreLine } from "@gdt/game-engine";
import { luiLabel } from "../lib/lui.ts";
import { SINK, sunk, visibleRect } from "../lib/results.ts";
import { FallArrow, ResultMarks, ScoreStrip } from "./ResultsView.tsx";
import { t as tx, ts as txs } from "../lib/testi.ts";
import type { TestoKey } from "../lib/testi.ts";

export interface VoteTok { p: number; c: string; /** Giocatore del gettone (serve al riepilogo dei punti). */ id?: string; mega?: boolean; glow?: boolean }
export interface TerraceProps {
  cardIds: string[]; down?: boolean; show?: number[]; pop?: number; flip?: Record<number, number>;
  votes?: VoteTok[]; lastVote?: number;
  /** Gioco base «Cade / Non cade»: i due segnalini (coperti se `spec` è null). */ marks?: { pos: number; spec: LuiSpec | null }[] | null;
  /** Fila davanti più in basso: più spazio sulle carte dietro per i riquadri dei punti. */ spread?: boolean;
  /** Carte «abbassate» di poco (quelle che stanno per cadere, nello spoglio). */ sink?: number[];
  selected?: number | null; onPick?: (pos: number) => void;
  /** Tocco sul gettone Lui! posato sulla carta (apre la spiegazione). */ onLui?: () => void;
}

/** La terrazza vista dall'alto: carte intere su piedini neri, gettoni sopra. Disegno dal mockup approvato. */
export function Terrace(p: TerraceProps) {
  const { ts, ty } = useStage(), n = p.cardIds.length, openPersona = usePersona();
  const base = useMemo(() => terraceBaseHtml(), []);
  const pos = useMemo(() => terracePos(n, p.spread), [n, p.spread]);
  const urls = useMemo(() => p.cardIds.map(cardFull), [p.cardIds.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const key = JSON.stringify([urls, p.down, p.show, p.pop, p.flip, p.votes, p.lastVote, p.marks, p.sink, p.spread]);
  const cards = useMemo(() => terraceCardsHtml(urls, n, { down: p.down, show: p.show, pop: p.pop, flip: p.flip, votes: p.votes, lastVote: p.lastVote, sink: p.sink, spread: p.spread, ...(p.marks?.length ? { luiList: p.marks } : {}) }), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="layer" style={{ transformOrigin: "186px 300px", transform: `translateY(${ty}px) scale(${ts})` }} data-testid="terrace" onClick={(e) => { const el = (e.target as HTMLElement).closest("[data-pid]") as HTMLElement | null; if (el?.dataset.pid) openPersona?.(el.dataset.pid); }}>
      <div style={{ left: 0, top: 0, width: 372, height: 826 }} dangerouslySetInnerHTML={{ __html: base }} />
      <div style={{ left: 0, top: 0, width: 372, height: 826 }} dangerouslySetInnerHTML={{ __html: cards }} />
      {p.onPick && Object.entries(pos).map(([i, c]) => {
        const num = Number(i) + 1;
        return <button key={i} className={`hit ${p.selected === num ? "sel" : ""}`} data-pos={num} data-testid={`card-${num}`} aria-label={txs("rv.carta.aria", { n: num })}
          style={{ left: c.x, top: c.f - c.h - 6, width: c.w, height: c.h + 10, zIndex: 100 }} onClick={() => p.onPick!(num)} />;
      })}
      {p.onLui && (p.marks ?? []).map((m) => m.pos).map((lp) => { const c = pos[lp - 1]; return c ? (
        <button key={lp} className="hit luihit" aria-label={txs("rv.lui.aria")} data-testid="lui-token" onClick={p.onLui}
          style={{ left: c.x - 24, top: c.f - 6 - c.h / 2 - 27, width: 56, height: 54, zIndex: 120, background: "none", border: 0 }} />) : null; })}
    </div>
  );
}

const rnd = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
export function shuffled(n: number, seed: number): number[] { const r = rnd(seed % 2147483647 || 7), a = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; } return a; }
const ease = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Orologio a requestAnimationFrame: restituisce il tempo in secondi; chiama onEnd una volta sola (anche con skip). */
export function useClock(end: number, onEnd: () => void, skip: number, seekRef?: React.MutableRefObject<((t: number) => void) | null>): number {
  const [T, setT] = useState(FAST ? end : 0), cb = useRef(onEnd), done = useRef(false), t0 = useRef(performance.now()), off = useRef(0);
  cb.current = onEnd;
  if (seekRef) seekRef.current = (t: number) => { off.current = t - (performance.now() - t0.current) / 1000; };
  useEffect(() => {
    let raf = 0;
    const fin = () => { if (!done.current) { done.current = true; cb.current(); } };
    if (FAST) { setT(end); fin(); return; }
    const loop = (now: number) => { const t = (now - t0.current) / 1000 + off.current; if (t >= end) { setT(end); fin(); return; } setT(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [end]);
  const skip0 = useRef(skip);
  useEffect(() => { if (skip > skip0.current) { off.current = 9999; } }, [skip]);
  return T;
}

const queueCard = (x: number, y: number, r: number) => `<div style="position:absolute;left:${x}px;top:${y}px;width:52px;height:78px;border-radius:6px;border:3px solid #fff;background:linear-gradient(135deg,#14a3a1 0 50%,#0e7d7c 50%);transform:rotate(${r}deg);box-shadow:2px 3px 0 #13224a"></div>`;
const WIN_X = [70, 198];

/** La salita: le carte coperte percorrono la scala interna della Torre (si vedono dalle finestre), poi sulla terrazza si piazzano e si girano. */
export function Climb({ cardIds, sound, skip, onDone }: { cardIds: string[]; sound: boolean; skip: number; onDone: () => void }) {
  const { H } = useStage(), n = cardIds.length, seed = useMemo(() => 7 + cardIds.join("").length * 13 + n, [cardIds.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const TC = 2.4, DP = 0.13, TP = TC + n * DP, TF0 = TP + 0.35, DF = 0.16, END = TF0 + (n - 1) * DF + 0.3 + 0.4;
  const T = useClock(END, onDone, skip);
  const placeOrder = useMemo(() => shuffled(n, seed), [n, seed]), flipOrder = useMemo(() => shuffled(n, seed * 3 + 1), [n, seed]);
  const fired = useRef<Set<string>>(new Set());
  useEffect(() => {
    const once = (k: string, f: () => void) => { if (!fired.current.has(k)) { fired.current.add(k); f(); } };
    if (T < TC) for (let k = 0; k < 6; k++) if (T > 0.2 + k * 0.3) once("w" + k, () => sfx.whoosh(sound));
    if (T >= TC) { const m = Math.min(n, Math.floor((T - TC) / DP) + 1); once("p" + m, () => sfx.tap(sound, 420)); }
    flipOrder.forEach((_, r) => { if (T >= TF0 + r * DF) once("f" + r, () => sfx.tap(sound, 700)); });
  }, [Math.floor(T * 20)]); // eslint-disable-line react-hooks/exhaustive-deps
  const climbing = T < TC + 0.2;
  const tower = useMemo(() => {
    if (!climbing) return "";
    const wins = Array.from({ length: 6 }, (_, k) => {
      const cards: number[][] = [];
      for (let j = 0; j < Math.min(n, 7); j++) {
        const u = (T - (0.15 + k * 0.3 + j * 0.1)) / 0.55;
        if (u > 0 && u < 1) { const right = k % 2 === 1; cards.push([right ? 92 - 40 - u * 102 : -36 + u * 102, 138 - u * 168, right ? 18 : -22]); }
      }
      return [WIN_X[k % 2]!, 1250 - 200 * k, cards];
    });
    return profileShaft(0, { windows: wins, height: 1500 - 96, svgH: 1700 })
      + `<div style="position:absolute;left:0;width:372px;top:1500px;height:300px;background:#14a3a1;border-top:4px solid #13224a;z-index:4"></div><div style="position:absolute;left:120px;top:1330px;width:132px;height:170px;background:#1d2740;border:5px solid #13224a;border-radius:66px 66px 0 0;z-index:5"></div>`
      + (T < 0.9 ? queueCard(30, 1420, -14) + queueCard(64, 1442, 10) + queueCard(98, 1456, -6) : "");
  }, [Math.floor(T * 30), climbing]); // eslint-disable-line react-hooks/exhaustive-deps
  const cam = (1500 + 60 - H) + (-60 - (1500 + 60 - H)) * ease(T / TC);
  const placed = T < TC ? 0 : Math.min(n, Math.floor((T - TC) / DP) + 1);
  const show = placeOrder.slice(0, placed);
  const flip: Record<number, number> = {};
  flipOrder.forEach((card, r) => { flip[card] = ease(clamp01((T - (TF0 + r * DF)) / 0.3)); });
  const cap = T < TC ? txs("rv.sale") : T < TF0 ? txs("rv.giocato") : txs("rv.svela");
  return (
    <>
      {climbing && <div className="layer" style={{ opacity: T < TC ? 1 : 1 - (T - TC) / 0.2, transform: `translateY(${-cam}px)` }} dangerouslySetInnerHTML={{ __html: `<div style="position:absolute;left:0;top:0;width:372px;height:1800px">${tower}</div>` }} data-testid="climb" />}
      {T >= TC - 0.01 && <div style={{ opacity: T < TC + 0.2 ? (T - TC) / 0.2 + 0.05 : 1 }}><Terrace cardIds={cardIds} show={show} pop={placed < n || T < TP + 0.1 ? (placeOrder[placed - 1] ?? -1) + 1 : undefined} flip={flip} /></div>}
      <div className="capx" style={{ top: "auto", bottom: 52, fontSize: 28 }}>{cap}</div>
    </>
  );
}

export interface Voter { id: string; name: string; color: string; mega: boolean }


/**
 * Dopo che il Lui! è scoperto, i gettoni sulla Torre mostrano il conteggio ufficiale: spariscono i voti annullati (Imbroglio!) o tolti (Censura!),
 * si sposta quello dirottato (Dirottamento!), compaiono quelli aggiunti (Propaganda!) e il voto doppio del Megafono (Influenza!).
 */
export function luiToks(list: { v: Voter; tok: VoteTok }[], marks?: MarkOutcome[] | null): VoteTok[] {
  // VOTI NULLI!: spariscono i gettoni di chi ha votato la carta con quel segnalino
  const nul = marks?.find((m) => m.effect === "nulli")?.caught ?? [];
  return list.filter((x) => !nul.includes(x.v.id)).map((x) => x.tok);
}
type Step = { t0: number; t1: number; kind: "intro" | "vote" | "suspense" | "tally" | "lui"; i?: number };
export interface FallOwner { pos: number; name: string | null; color: string }
/** Il segnalino com'era, dall'esito (per disegnarlo scoperto). */
export const markSpec = (m: MarkOutcome): LuiSpec => ({ slot: m.slot, k: 0, pts: m.effect === "cade" ? 4 : m.effect === "noncade" ? 2 : 0, effect: m.effect });
/**
 * Lo spoglio per immagini: i gettoni cadono uno alla volta sulle carte (il Megafono per ultimo, dopo una pausa di suspense col rullo),
 * poi il segnalino Lui! si gira (con un colpo di tamburo e uno squillo). Alla fine le carte che cadono si abbassano un poco con la freccia rossa
 * e si aspetta: chi guarda può analizzare i voti con calma e, quando vuole, tocca «Gettalo dalla torre!» (sullo schermo condiviso, senza
 * pulsanti, si prosegue da soli dopo 40 s). Niente frasi, niente conteggi: i punti si vedono dopo la caduta.
 */
export function Reveal({ cardIds, voters, votes, fallPositions, sound, skip, interactive, onDone, marks, points }: {
  /** Per mostrare, a fine spoglio, i riquadri dei punti (sulle carte e in basso): le righe del turno, i colori, ecc. */ points?: { lines: Record<string, ScoreLine[]>; ids: string[]; colorOf: (id: string) => string; meId?: string; annullati?: string[] };
  /** Gioco base «Cade / Non cade»: i due segnalini, scoperti alla fine. */ marks?: MarkOutcome[] | null;
  cardIds: string[]; voters: Voter[]; votes: Record<string, number>;
  fallPositions: number[]; sound: boolean; skip: number; interactive: boolean; onDone: () => void;
}) {
  const { ts, ty } = useStage(), m = voters.length;
  const dv = m > 4 ? 0.6 : 0.75;
  const steps = useMemo(() => {
    const st: Step[] = []; let t = 0;
    const add = (kind: Step["kind"], d: number, i?: number) => { st.push({ t0: t, t1: t + d, kind, i }); t += d; };
    voters.forEach((v, i) => {
      if (i === m - 1 && m > 1) add("suspense", 1.5);
      add("vote", i === m - 1 ? 0.9 : dv, i);
    });
    if (marks?.length) add("lui", 2.0); else add("tally", 0.5);
    return st;
  }, [voters, m, marks]);
  const END = steps[steps.length - 1]!.t1;
  const seek = useRef<((t: number) => void) | null>(null);
  const [phase, setPhase] = useState<"clock" | "stamp">("clock");
  const T = useClock(END, () => setPhase("stamp"), 0, seek);
  const skip0 = useRef(skip);
  useEffect(() => { if (skip > skip0.current) { skip0.current = skip; if (phase === "clock") seek.current?.(END); } }, [skip]); // eslint-disable-line react-hooks/exhaustive-deps
  // a fine spoglio si aspetta il tocco; senza pulsanti (schermo condiviso) si prosegue dopo 40 s
  useEffect(() => { if (phase === "stamp") { sfx.stamp(sound); if (!interactive) { const tt = setTimeout(onDone, 40000); return () => clearTimeout(tt); } } return undefined; }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = steps.find((s) => T >= s.t0 && T < s.t1) ?? steps[steps.length - 1]!;
  const fired = useRef<Set<string>>(new Set());
  const once = (k: string, f: () => void) => { if (!fired.current.has(k)) { fired.current.add(k); f(); } };
  useEffect(() => {
    once(`${cur.kind}${cur.i ?? ""}`, () => {
      if (cur.kind === "vote") sfx.tap(sound, 480 + (cur.i ?? 0) * 40);
      else if (cur.kind === "suspense") sfx.drum(sound, 1.5);
      else if (cur.kind === "lui") sfx.drum(sound, 0.5);
    });
  }, [cur.kind, cur.i]); // eslint-disable-line react-hooks/exhaustive-deps
  const voteStep = (i: number) => steps.find((s) => s.kind === "vote" && s.i === i)!;
  const shown = voters.map((v, i) => ({ v, i })).filter(({ i }) => T >= voteStep(i).t0);
  const luiStart = steps.find((s) => s.kind === "lui")?.t0 ?? 0;
  const luiOpen = !!marks?.length && (cur.kind === "lui" || phase !== "clock") && T >= luiStart + 0.5;
  useEffect(() => { if (luiOpen) once("luiflip", () => { sfx.stamp(sound); sfx.ding(sound); }); }, [luiOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  // quando il segnalino è scoperto, i gettoni passano al conteggio ufficiale (voti annullati, tolti, spostati, aggiunti)
  const manip = !!marks?.length && luiOpen && T >= luiStart + 1.2;
  const base = shown.map(({ v }) => ({ v, tok: { p: votes[v.id]!, c: v.color, mega: v.mega, id: v.id } as VoteTok }));
  const toks: VoteTok[] = manip ? luiToks(base, marks) : base.map((x) => x.tok);
  const pos = useMemo(() => terracePos(cardIds.length, true), [cardIds.length]);
  const nextT = () => steps.find((s) => s.t0 > T + 0.05)?.t0 ?? END;
  const plural = fallPositions.length > 1, stamp = phase === "stamp";
  // «Gettalo dalla torre!»: la vista dello spoglio sale e svanisce, poi la scena della caduta compare in dissolvenza (niente scatto netto)
  const [leaving, setLeaving] = useState(false);
  const go = () => { if (leaving) return; setLeaving(true); setTimeout(onDone, 650); };
  const megaId = voters.find((v) => v.mega)?.id;
  return (
    <div className={`rv-wrap${leaving ? " leaving" : ""}`}>
      <Terrace cardIds={cardIds} spread votes={toks} lastVote={cur.kind === "vote" ? toks.length - 1 : -1} sink={stamp ? fallPositions : undefined} marks={marks?.length ? marks.map((x) => ({ pos: x.position, spec: luiOpen ? markSpec(x) : null })) : null} />
      {stamp && points && <ResultMarks n={cardIds.length} fallen={fallPositions} sink={fallPositions} spread slam />}
      {stamp && !points && <div className="layer rv-layer" style={{ transformOrigin: "186px 300px", transform: `translateY(${ty}px) scale(${ts})` }} data-testid="reveal-panel">{fallPositions.map((q, i) => <FallArrow key={`a${q}`} rect={visibleRect(sunk(pos, fallPositions), q - 1)} slam delay={i * 0.45} />)}</div>}
      {stamp && points && <div className="rv-strip"><ScoreStrip ids={points.ids} lines={points.lines} colorOf={points.colorOf} meId={points.meId} annullati={points.annullati} megaId={megaId} sound={sound} interactive={interactive} onContinue={onDone} base={0.3 + fallPositions.length * 0.45} quiet /></div>}
      {interactive && phase === "clock" && <button className="next" onClick={() => seek.current?.(nextT())} data-testid="reveal-next" aria-label={txs("rv.avanti")}>⏭</button>}
      {interactive && stamp && <button className="throw" onClick={go} data-testid="reveal-throw" style={{ animationDelay: `${0.5 + fallPositions.length * 0.45 + (points ? points.ids.length * 0.32 : 0)}s` }}>{txs(plural ? "rv.gettali" : "rv.gettalo")}</button>}
    </div>
  );
}
