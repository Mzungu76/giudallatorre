import { useEffect, useMemo, useRef, useState } from "react";
import { terraceBaseHtml, terraceCardsHtml, terracePos, profileShaft } from "../scene/draw.ts";
import { cardFull } from "../lib/cards.ts";
import { FAST, useStage } from "../ui.tsx";
import { sfx } from "../lib/sfx.ts";

export interface VoteTok { p: number; c: string; mega?: boolean }
export interface TerraceProps {
  cardIds: string[]; down?: boolean; show?: number[]; pop?: number; flip?: Record<number, number>;
  votes?: VoteTok[]; lui?: { pos: number; kind: "CADE" | "NON_CADE" | null } | null;
  selected?: number | null; onPick?: (pos: number) => void;
}

/** La terrazza vista dall'alto: carte intere su piedini neri, gettoni sopra. Disegno dal mockup approvato. */
export function Terrace(p: TerraceProps) {
  const { dy } = useStage(), n = p.cardIds.length;
  const base = useMemo(() => terraceBaseHtml(), []);
  const pos = useMemo(() => terracePos(n), [n]);
  const urls = useMemo(() => p.cardIds.map(cardFull), [p.cardIds.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const key = JSON.stringify([urls, p.down, p.show, p.pop, p.flip, p.votes, p.lui]);
  const cards = useMemo(() => terraceCardsHtml(urls, n, { down: p.down, show: p.show, pop: p.pop, flip: p.flip, votes: p.votes, lui: p.lui?.pos, luiKind: p.lui?.kind ?? "CADE", luiBack: !!p.lui && !p.lui.kind }), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="layer" style={{ transform: `translateY(${dy}px)` }} data-testid="terrace">
      <div style={{ left: 0, top: 0, width: 372, height: 826 }} dangerouslySetInnerHTML={{ __html: base }} />
      <div style={{ left: 0, top: 0, width: 372, height: 826 }} dangerouslySetInnerHTML={{ __html: cards }} />
      {p.onPick && Object.entries(pos).map(([i, c]) => {
        const num = Number(i) + 1;
        return <button key={i} className={`hit ${p.selected === num ? "sel" : ""}`} data-pos={num} data-testid={`card-${num}`} aria-label={`Carta numero ${num}`}
          style={{ left: c.x, top: c.f - c.h - 6, width: c.w, height: c.h + 10, zIndex: 100 }} onClick={() => p.onPick!(num)} />;
      })}
    </div>
  );
}

const rnd = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
export function shuffled(n: number, seed: number): number[] { const r = rnd(seed % 2147483647 || 7), a = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; } return a; }
const ease = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Orologio a requestAnimationFrame: restituisce il tempo in secondi; chiama onEnd una volta sola (anche con skip). */
export function useClock(end: number, onEnd: () => void, skip: number): number {
  const [T, setT] = useState(FAST ? end : 0), cb = useRef(onEnd), done = useRef(false), t0 = useRef(performance.now()), off = useRef(0);
  cb.current = onEnd;
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
  const cap = T < TC ? "Le carte salgono la scala…" : T < TF0 ? "Tutti hanno giocato!" : "La Torre si svela…";
  return (
    <>
      {climbing && <div className="layer" style={{ opacity: T < TC ? 1 : 1 - (T - TC) / 0.2, transform: `translateY(${-cam}px)` }} dangerouslySetInnerHTML={{ __html: `<div style="position:absolute;left:0;top:0;width:372px;height:1800px">${tower}</div>` }} data-testid="climb" />}
      {T >= TC - 0.01 && <div style={{ opacity: T < TC + 0.2 ? (T - TC) / 0.2 + 0.05 : 1 }}><Terrace cardIds={cardIds} show={show} pop={placed < n || T < TP + 0.1 ? (placeOrder[placed - 1] ?? -1) + 1 : undefined} flip={flip} /></div>}
      <div className="capx" style={{ top: "auto", bottom: 52, fontSize: 28 }}>{cap}</div>
    </>
  );
}

export interface Voter { id: string; name: string; color: string; mega: boolean }
/** Lo spoglio: buio, rullo, un voto alla volta direttamente sulla carta, “manca un voto…”, il Lui! si gira, timbro. */
export function Reveal({ cardIds, voters, votes, counts, lui, tie, fallPos, sound, skip, onDone }: {
  cardIds: string[]; voters: Voter[]; votes: Record<string, number>; counts: Record<number, number>; lui: { pos: number; kind: "CADE" | "NON_CADE" } | null;
  tie: boolean; fallPos: number; sound: boolean; skip: number; onDone: () => void;
}) {
  const m = voters.length, S = m <= 5 ? 0.45 : 0.28, TD = 0.7, pause = m > 1 ? 0.9 : 0;
  const times = voters.map((_, i) => (i < m - 1 ? TD + i * S : TD + Math.max(0, m - 2) * S + S + pause));
  const tLast = times[m - 1] ?? TD, tLui = tLast + 0.7, tStamp = tLui + 0.5, END = tStamp + 1.1;
  const T = useClock(END, onDone, skip);
  const fired = useRef<Set<string>>(new Set());
  useEffect(() => {
    const once = (k: string, f: () => void) => { if (!fired.current.has(k)) { fired.current.add(k); f(); } };
    once("d", () => sfx.drum(sound, 0.6));
    times.forEach((t, i) => { if (T >= t) once("v" + i, () => sfx.tap(sound, 480 + i * 30)); });
    if (m > 1 && T >= times[m - 2]! + 0.2 && T < tLast) once("pz", () => sfx.drum(sound, 0.35));
    if (T >= tStamp) once("s", () => sfx.stamp(sound));
  }, [Math.floor(T * 20)]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = voters.map((v, i) => ({ v, i })).filter(({ i }) => T >= times[i]!);
  const toks: VoteTok[] = shown.map(({ v }) => ({ p: votes[v.id]!, c: v.color, mega: v.mega }));
  const last = shown[shown.length - 1], lastPos = last ? votes[last.v.id]! : 0;
  const cnt = last ? shown.filter(({ v }) => votes[v.id] === lastPos).length : 0;
  const inPause = shown.length === m - 1 && m > 1 && T < tLast;
  const pos = useMemo(() => terracePos(cardIds.length), [cardIds.length]), pp = lastPos ? pos[lastPos - 1] : null;
  const nextName = voters[shown.length]?.name, { dy } = useStage();
  return (
    <>
      <Terrace cardIds={cardIds} votes={toks} lui={lui ? { pos: lui.pos, kind: T >= tLui ? lui.kind : null } : null} />
      <div className="darkv" />
      <div className="capx" style={{ top: "auto", bottom: 60 }}>
        {T < TD && <div style={{ fontSize: 36 }}>Lo spoglio!</div>}
        {last && T < tStamp && <>
          <div style={{ fontSize: inPause ? 36 : 26, color: inPause ? "#ffc72c" : "#fff" }}>{tie && T >= tLast ? "Pareggio! Decide il Megafono" : inPause ? "Manca un voto…" : `Voto n. ${shown.length} di ${m}`}</div>
          <div style={{ marginTop: 6 }}><span className="who" style={{ position: "static", display: "inline-block", fontSize: 13 }} data-testid="who">{last.v.name} ha votato… il {lastPos}!{inPause && nextName ? ` Manca ${nextName}…` : ""}</span></div>
        </>}
      </div>
      {last && T < tStamp && pp && <div className="counter" style={{ left: pp.x + pp.w / 2 - 14, top: pp.f - pp.h - 44 + dy }} key={`${lastPos}-${cnt}`}>{cnt}</div>}
      {T >= tStamp && <div className="stampbox" style={{ top: 190 }} data-testid="stamp">{tie ? "Pareggio!" : `Cade il n. ${fallPos}!`}<small>{tie ? `Decide il Megafono: cade il n. ${fallPos}` : `${counts[fallPos] ?? 0} voti su ${m}${lui && lui.kind === "CADE" && lui.pos === fallPos ? " · lui lo sapeva!" : ""}`}</small></div>}
    </>
  );
}
