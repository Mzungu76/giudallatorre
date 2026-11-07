import { useEffect, useMemo, useRef, useState } from "react";
import { terraceBaseHtml, terraceCardsHtml, terracePos, profileShaft } from "../scene/draw.ts";
import { cardFull } from "../lib/cards.ts";
import { FAST, useStage } from "../ui.tsx";
import { sfx } from "../lib/sfx.ts";

export interface VoteTok { p: number; c: string; mega?: boolean }
export interface TerraceProps {
  cardIds: string[]; down?: boolean; show?: number[]; pop?: number; flip?: Record<number, number>;
  votes?: VoteTok[]; lastVote?: number; lui?: { pos: number; kind: "CADE" | "NON_CADE" | null } | null;
  selected?: number | null; onPick?: (pos: number) => void;
}

/** La terrazza vista dall'alto: carte intere su piedini neri, gettoni sopra. Disegno dal mockup approvato. */
export function Terrace(p: TerraceProps) {
  const { dy } = useStage(), n = p.cardIds.length;
  const base = useMemo(() => terraceBaseHtml(), []);
  const pos = useMemo(() => terracePos(n), [n]);
  const urls = useMemo(() => p.cardIds.map(cardFull), [p.cardIds.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const key = JSON.stringify([urls, p.down, p.show, p.pop, p.flip, p.votes, p.lastVote, p.lui]);
  const cards = useMemo(() => terraceCardsHtml(urls, n, { down: p.down, show: p.show, pop: p.pop, flip: p.flip, votes: p.votes, lastVote: p.lastVote, lui: p.lui?.pos, luiKind: p.lui?.kind ?? "CADE", luiBack: !!p.lui && !p.lui.kind }), [key]); // eslint-disable-line react-hooks/exhaustive-deps
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
type Step = { t0: number; t1: number; kind: "intro" | "vote" | "suspense" | "tally" | "lui" | "herd" | "stamp"; i?: number };
const thumb = (id: string) => ({ backgroundImage: `url(${cardFull(id)})` });

/** Lo spoglio, un passo alla volta e con calma: ogni voto con chi l'ha dato (e la sua spiegazione), il tabellone dei voti, la scommessa del Megafono, l'eventuale gregge e il timbro. */
export function Reveal({ cardIds, voters, votes, counts, lui, tie, fallPos, herd, megaName, sound, skip, interactive, onDone }: {
  cardIds: string[]; voters: Voter[]; votes: Record<string, number>; counts: Record<number, number>;
  lui: { pos: number; kind: "CADE" | "NON_CADE" } | null; tie: boolean; fallPos: number; herd: boolean; megaName: string; sound: boolean; skip: number; interactive: boolean; onDone: () => void;
}) {
  const { dy } = useStage(), m = voters.length;
  const steps = useMemo(() => {
    const st: Step[] = []; let t = 0;
    const add = (kind: Step["kind"], d: number, i?: number) => { st.push({ t0: t, t1: t + d, kind, i }); t += d; };
    add("intro", 1.8);
    voters.forEach((v, i) => {
      if (i === m - 1 && m > 1) add("suspense", 1.3);
      add("vote", 2.2, i);
    });
    add("tally", 3.0);
    if (lui) add("lui", 3.2);
    if (herd) add("herd", 3.6);
    add("stamp", 2.0);
    return st;
  }, [voters, lui, herd, m]);
  const END = steps[steps.length - 1]!.t1;
  const seek = useRef<((t: number) => void) | null>(null);
  const T = useClock(END, onDone, skip, seek);
  const cur = steps.find((s) => T >= s.t0 && T < s.t1) ?? steps[steps.length - 1]!;
  const fired = useRef<Set<string>>(new Set());
  useEffect(() => {
    const once = (k: string, f: () => void) => { if (!fired.current.has(k)) { fired.current.add(k); f(); } };
    once(`${cur.kind}${cur.i ?? ""}`, () => {
      if (cur.kind === "intro") sfx.drum(sound, 0.7);
      else if (cur.kind === "vote") sfx.tap(sound, 480 + (cur.i ?? 0) * 30);
      else if (cur.kind === "suspense") sfx.drum(sound, 0.8);
      else if (cur.kind === "tally") sfx.tap(sound, 640);
      else if (cur.kind === "lui") sfx.tap(sound, 360);
      else if (cur.kind === "stamp") sfx.stamp(sound);
    });
  }, [cur.kind, cur.i]); // eslint-disable-line react-hooks/exhaustive-deps
  const voteStep = (i: number) => steps.find((s) => s.kind === "vote" && s.i === i)!;
  const shown = voters.map((v, i) => ({ v, i })).filter(({ i }) => T >= voteStep(i).t0);
  const lastShown = shown[shown.length - 1];
  const toks: VoteTok[] = shown.map(({ v }) => ({ p: votes[v.id]!, c: v.color, mega: v.mega }));
  const luiStart = steps.find((s) => s.kind === "lui")?.t0 ?? 0;
  const luiOpen = !!lui && (cur.kind === "lui" || cur.kind === "herd" || cur.kind === "stamp") && T >= luiStart + 0.9;
  const pos = useMemo(() => terracePos(cardIds.length), [cardIds.length]);
  const byCard: Record<number, Voter[]> = {}; shown.forEach(({ v }) => { (byCard[votes[v.id]!] ??= []).push(v); });
  const focusPos = cur.kind === "vote" ? votes[voters[cur.i!]!.id]! : cur.kind === "lui" && lui ? lui.pos : cur.kind === "tally" || cur.kind === "herd" || cur.kind === "stamp" ? fallPos : 0;
  const nextT = () => steps.find((s) => s.t0 > T + 0.05)?.t0 ?? END;
  const v = cur.kind === "vote" ? voters[cur.i!]! : null, vp = v ? votes[v.id]! : 0;
  const luiHit = lui ? (lui.kind === "CADE" ? lui.pos === fallPos : lui.pos !== fallPos) : false;
  const total = voters.length, fp = focusPos > 0 ? pos[focusPos - 1] : null;
  return (
    <>
      <Terrace cardIds={cardIds} votes={toks} lastVote={cur.kind === "vote" ? toks.length - 1 : -1} lui={lui ? { pos: lui.pos, kind: luiOpen ? lui.kind : null } : null} />
      <div className="darkv" />
      {fp && <div className="focus" style={{ left: fp.x - 5, top: fp.f - fp.h - 11 + dy, width: fp.w + 10, height: fp.h + 16 }} />}
      <div className="rv" data-testid="reveal-panel" key={`${cur.kind}${cur.i ?? ""}`}>
        {cur.kind === "intro" && <><b className="rv-t">Lo spoglio!</b><span>Ora si scopre chi ha votato chi. Un voto alla volta.</span></>}
        {cur.kind === "suspense" && <><b className="rv-t">Manca un voto…</b><span>Aspettiamo {voters[m - 1]!.name}.</span></>}
        {cur.kind === "vote" && v && (
          <div className="rv-row">
            <span className="rv-th" style={thumb(cardIds[vp - 1]!)}><i>{vp}</i></span>
            <div className="rv-col"><span className="rv-n">Voto {cur.i! + 1} di {total}</span><b className="rv-who" data-testid="who"><i className="dc" style={{ background: v.color }} />{v.name} ha votato il n. {vp}</b></div>
          </div>
        )}
        {cur.kind === "tally" && <><b className="rv-t">{tie ? "Pareggio!" : `Il più votato: n. ${fallPos}`}</b><span>{tie ? `Decide il Megafono (${megaName}): cade il n. ${fallPos}.` : `${counts[fallPos] ?? 0} voti su ${total}. Cade giù dalla torre!`}</span></>}
        {cur.kind === "lui" && lui && <><b className="rv-t">Il Lui! di {megaName}</b><span>{lui.kind === "CADE" ? `Aveva scommesso: CADE il n. ${lui.pos} (la carta col bordo giallo).` : `Aveva scommesso: il n. ${lui.pos} NON CADE (la carta col bordo giallo).`}</span>{T >= luiStart + 1.2 && <em className={luiHit ? "ok" : "ko"}>{luiHit ? (lui.kind === "CADE" ? "Azzeccato! +4" : "Azzeccato! +1") : "Sbagliato: −1"}</em>}</>}
        {cur.kind === "herd" && <><b className="rv-t">🐑 Regola del gregge</b><span>{megaName} ha indovinato la carta che cade: i +2 di chi l’ha votata vanno solo a lui.</span></>}
        {cur.kind === "stamp" && <b className="rv-t">Cade il n. {fallPos}!</b>}
        {cur.kind !== "stamp" && cur.kind !== "intro" && (
          <div className="rv-tally" aria-label="Voti finora">
            {cardIds.map((id, k) => { const vs = byCard[k + 1] ?? []; const lead = (cur.kind === "tally" || cur.kind === "lui" || cur.kind === "herd") && k + 1 === fallPos;
              return <div key={id} className={`tl ${lead ? "lead" : ""} ${focusPos === k + 1 ? "cur" : ""}`}><span className="th" style={thumb(id)}><i>{k + 1}</i></span><b>{vs.length}</b><span className="dots">{vs.map((x) => <i key={x.id} style={{ background: x.color }} />)}</span></div>; })}
          </div>
        )}
      </div>
      {interactive && cur.kind !== "stamp" && <button className="next" onClick={() => seek.current?.(nextT())} data-testid="reveal-next">Avanti ›</button>}
    </>
  );
}
