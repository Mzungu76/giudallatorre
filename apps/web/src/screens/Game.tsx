import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PlayerView, TurnResult } from "@gdt/game-engine";
import type { ClientMessage } from "@gdt/game-protocol";
import { MAX_PHRASE_CHARS } from "@gdt/game-protocol";
import { Btn, Chips, Countdown, Disc, FAST, PLAYER_COLORS, useStage } from "../ui.tsx";
import { cardFull } from "../lib/cards.ts";
import SceneHost from "../components/SceneHost.tsx";
import Zoom from "../components/Zoom.tsx";
import { Climb, Reveal, Terrace } from "../components/Terrace.tsx";
import type { Voter, VoteTok } from "../components/Terrace.tsx";
import { voteTok, luiTok } from "../scene/draw.ts";
import type { RoomMsg } from "../hooks/useRoom.ts";
import type { SceneApi } from "../scene/fallScene.ts";
import HowTo from "../components/HowTo.tsx";

export interface GameProps { room: RoomMsg; view: PlayerView; deadline: number | null; send: (m: ClientMessage) => void; readOnly?: boolean; sound: boolean }
const lineText = (l: { kind: string; pts: number; n?: number }) => {
  const pts = l.pts < 0 ? `−${-l.pts}` : `+${l.pts}`;
  switch (l.kind) {
    case "voto": return `voto giusto ${pts}`;
    case "carta": return `carta caduta ${pts}`;
    case "raccolti": return `${l.n} ${l.n === 1 ? "voto raccolto" : "voti raccolti"} ${pts}`;
    case "lui-cade": return `Lui! cade ${pts}`;
    case "lui-non-cade": return `Lui! resta su ${pts}`;
    default: return `Lui! sbagliato ${pts}`;
  }
};
const TITLES: Record<string, string> = { PROCLAIM: "TOCCA AL MEGAFONO", PLAY: "SCEGLI LA CARTA", SUSPECT: "IL MEGAFONO SCOMMETTE", VOTE: "VOTA IN SEGRETO", RESULTS: "GIÙ DALLA TORRE!", GAME_OVER: "FINE PARTITA" };
const BANNERS: Record<string, [string, string]> = {
  PLAY: ["Scegliete la carta!", "quella che sta meglio sulla torre"],
  SUSPECT: ["Salgono le carte!", "il Megafono sta per scommettere"],
  VOTE: ["Votate!", "in segreto: chi cade?"],
};
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

export function usePeople(room: RoomMsg) {
  return useMemo(() => {
    const m = new Map(room.players.map((p, i) => [p.id, { name: p.nickname, color: PLAYER_COLORS[i % 8]!, index: i, bot: !!p.isBot }]));
    return { get: (id: string) => m.get(id) ?? { name: "?", color: "#999", index: 0, bot: false }, all: room.players.map((p, i) => ({ ...p, color: PLAYER_COLORS[i % 8]! })) };
  }, [room.players]);
}

function PhraseHead({ phrase, megaName, onBottom }: { phrase: PlayerView["phrase"]; megaName: string; onBottom?: (b: number) => void }) {
  const { H } = useStage(), ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (ref.current && onBottom) onBottom(ref.current.offsetTop + ref.current.offsetHeight); });
  if (!phrase) return null;
  const cmp = H < 700 ? " cmp" : "";
  let label = "Il Megafono urla:", body: string;
  if (phrase.mode === "free") { label = "Oggi sale sulla torre…"; body = phrase.text ?? "una frase tutta sua (detta a voce)!"; }
  else {
    const m = phrase.text.match(/^Oggi (sale|salgono) sulla torre /);
    if (m) { label = `Oggi ${m[1]} sulla torre…`; body = phrase.text.slice(m[0].length); } else body = phrase.text;
  }
  const theme = phrase.mode === "card" ? phrase.theme : undefined;
  const len = body.length, size = len > 80 ? " xl" : len > 50 ? " l" : "";
  return (
    <div ref={ref} className={`phrase-card${size}${cmp}`} style={{ top: 122 }} data-testid="phrase" aria-label={`${megaName} urla: ${label} ${body}`}>
      <span className="mega-ic" aria-hidden>📣</span>{theme && <span className="ctx" data-testid="phrase-theme">{theme}</span>}<small>{label}</small><b>{body}</b>
    </div>
  );
}

/** Cosa devo fare adesso: una riga chiara, sempre visibile. */
function Tip({ children, style, className = "" }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) { return <div className={`tip ${className}`} style={style} data-testid="tip">{children}</div>; }

function Waiting({ text, sub, flags, people, bottom }: { text: string; sub?: string; flags: { id: string; done: boolean }[]; people: ReturnType<typeof usePeople>; bottom?: boolean }) {
  const { H } = useStage();
  if (bottom) return (
    <div className="bottom" data-testid="waiting">{sub && <Tip>{sub}</Tip>}<div className="pp mini"><b>{text}</b></div><div className="flags">{flags.map((f) => <span key={f.id} className="chip">{<Disc color={people.get(f.id).color} />}{people.get(f.id).name}{f.done ? " ✓" : " …"}</span>)}</div></div>
  );
  return (
    <div className="wait" data-testid="waiting" style={{ top: Math.round(H * 0.4) }}>
      <div className="pp"><b>{text}</b>{sub && <small className="sub">{sub}</small>}</div>
      <div className="flags">{flags.map((f) => <span key={f.id} className="chip">{<Disc color={people.get(f.id).color} />}{people.get(f.id).name}{f.done ? " ✓" : " …"}</span>)}</div>
    </div>
  );
}

/** Il Megafono sceglie cosa urlare: la frase della carta oppure la propria (“Oggi sale sulla torre…” + testo libero, anche solo a voce). */
function PhrasePicker({ view, send }: { view: PlayerView; send: GameProps["send"] }) {
  const card = view.proclaimCard!, single = card.phrases.length === 1;
  const [own, setOwn] = useState(false), [text, setText] = useState(""), [voice, setVoice] = useState(false);
  const say = (i: number) => send({ t: "act", action: { type: "choosePhrase", mode: "card", index: i } });
  const goOwn = () => send({ t: "act", action: { type: "choosePhrase", mode: "free", ...(voice || !text.trim() ? {} : { text: text.trim() }) } });
  return (
    <div className="picker" data-testid="phrase-picker">
      <div className="h" style={{ top: 124, fontSize: 30 }}><small>{own ? "Una frase tutta tua" : "Sei il Megafono!"}</small>{own ? "Inventala!" : "Tocca la frase da urlare"}</div>
      <div className="opts">
        {!own && card.phrases.map((t, k) => (
          <button key={k} className="opt" onClick={() => say(k)} data-testid={`phrase-${k}`}>{card.themes?.[k] && <span className="opt-ctx">{card.themes[k]}</span>}{single ? <b>{t}</b> : t}<em className="opt-go">📣</em></button>
        ))}
        {own && (
          <div className="phr-opts">
            <div className="phr-fixed">Oggi sale sulla torre…</div>
            <textarea className="phr-in" maxLength={MAX_PHRASE_CHARS} value={text} disabled={voice} onChange={(e) => setText(e.target.value)} placeholder="…chi ha la scusa più creativa" data-testid="phrase-text" aria-label="La tua frase" />
            <div className="hint" style={{ textAlign: "right" }}>{text.length}/{MAX_PHRASE_CHARS}</div>
            <label className="hint" style={{ display: "flex", gap: 8, alignItems: "center", textAlign: "left" }}><input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} data-testid="phrase-voice" /> La dico solo a voce (non la scrivo)</label>
          </div>
        )}
      </div>
      {(!single || own) && (
        <div className="bottom two">
          <Btn kind="pap" onClick={() => setOwn(!own)} style={{ fontSize: 16, padding: 10 }} testId="phrase-free">{own ? "Torna alle frasi" : "Preferisco dire la mia"}</Btn>
          {own && <Btn kind="red" onClick={goOwn} testId="phrase-go">📣 Proclama!</Btn>}
        </div>
      )}
    </div>
  );
}

function HandPicker({ view, send, top }: { view: PlayerView; send: GameProps["send"]; top: number }) {
  const { H } = useStage(), hand = view.myHand, [sel, setSel] = useState<number | null>(null), [zoom, setZoom] = useState(false);
  const step = Math.min(66, (372 - 104 - 16) / Math.max(1, hand.length - 1)), left0 = (372 - (104 + step * (hand.length - 1))) / 2;
  const play = (idx: number) => send({ t: "act", action: { type: "playCard", cardId: hand[idx]! } });
  const cardsTop = top + Math.max(44, (H - 140 - top - 190) / 2);   // carte centrate tra la frase e il suggerimento, che sta in basso
  return (
    <div className="picker" data-testid="hand">
      <Tip className="tip-sm" style={{ top: "auto", bottom: 92 }}>Scegli il personaggio che farebbe questa cosa. Tocca una carta, poi ancora per vederla bene. Resta segreta!<strong className="tip-warn tip-gain" data-testid="tip-gain"> Se la tua carta è la più votata, cade ma ti porta +2 punti.</strong></Tip>
      {hand.map((c, i) => {
        const mid = (hand.length - 1) / 2, d = i - mid, lifted = sel === i;
        return <button key={c} className={`card ${lifted ? "sel" : ""}`} data-testid={`hand-card-${i}`} aria-label={`Carta ${i + 1}`}
          style={{ left: left0 + step * i, top: cardsTop + d * d * 7 - (lifted ? 34 : 0), backgroundImage: `url(${cardFull(c)})`, transform: `rotate(${d * 6}deg)`, zIndex: 10 + i + (lifted ? 20 : 0) }}
          onClick={() => (sel === i ? setZoom(true) : setSel(i))} />;
      })}
      <div className="bottom"><Btn disabled={sel === null} onClick={() => sel !== null && play(sel)} testId="play-card">{sel === null ? "Scegli una carta" : "Gioca questa carta"}</Btn></div>
      {zoom && sel !== null && (
        <div className="zoom on" role="dialog" data-testid="hand-zoom"><div className="zc"><img className="fullcard" src={cardFull(hand[sel]!)} alt="La tua carta" /></div>
          <div className="zb"><Btn onClick={() => { setZoom(false); play(sel); }}>Gioca questa carta</Btn><Btn kind="pap" onClick={() => setZoom(false)} style={{ fontSize: 18, padding: 10 }}>Indietro</Btn></div></div>
      )}
    </div>
  );
}

function useCount(from: number, to: number, delay: number, dur = 0.9): number {
  const [v, setV] = useState(FAST ? to : from);
  useEffect(() => {
    if (FAST) { setV(to); return; }
    let raf = 0; const t0 = performance.now();
    const loop = (now: number) => { const u = Math.max(0, Math.min(1, ((now - t0) / 1000 - delay) / dur)); setV(Math.round(from + (to - from) * u)); if (u < 1) raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [from, to, delay, dur]);
  return v;
}
function ScoreRow({ rank, name, color, why, delta, from, to, delay, leader, max }: { max: number; rank: number; name: string; color: string; why: string; delta: number; from: number; to: number; delay: number; leader: boolean }) {
  const v = useCount(from, to, delay);
  return (
    <div className={`rw ${delta !== 0 ? "up" : ""}`} data-testid="score-row" style={{ ["--w" as string]: `${Math.max(0, Math.round((100 * Math.max(0, to)) / Math.max(1, max)))}%` }}>
      <span className="rk">{leader ? "👑" : rank}</span><Disc color={color} />
      <span className="nm">{name}<small>{why}</small></span>
      <span className={`dl ${delta > 0 ? "" : delta < 0 ? "n" : "z"}`}>{signed(delta)}</span>
      <span className="tt" data-testid="score-total">{v < 0 ? `−${Math.abs(v)}` : v}</span>
    </div>
  );
}

/** Classifica di fine turno: i punti del turno e il totale che si somma in tempo reale. A fine giro diventa la classifica del giro. */
function Scoreboard({ H, res, view, people, canAdvance, deadline, onAdvance, final }: { H: number; res: TurnResult; view: PlayerView; people: ReturnType<typeof usePeople>; canAdvance: boolean; deadline: number | null; onAdvance: () => void; final: boolean }) {
  const rows = view.players.map((p) => ({ p, d: res.points[p.id] ?? 0, from: p.score - (res.points[p.id] ?? 0), to: p.score }));
  const ranked = [...rows].sort((a, b) => b.to - a.to), top = ranked[0]?.to ?? 0, compact = rows.length > 6 || H < 700;
  const title = view.roundEnd ? `Classifica · giro ${Math.min(view.round, view.rounds)}/${view.rounds}` : res.tie ? "Pareggio: cadono insieme" : "Classifica del turno";
  return (
    <div className={`score ${compact ? "c8" : ""}`} data-testid="result-panel">
      <h3>{view.goldenGoal ? "⚡ Spareggio · classifica" : title}</h3>
      <div>{ranked.map((r, i) => <ScoreRow key={r.p.id} rank={i + 1} name={people.get(r.p.id).name} color={people.get(r.p.id).color} leader={r.to === top && top > 0 && i === 0}
        why={(res.lines[r.p.id] ?? []).map(lineText).join(" · ") || "—"} delta={r.d} from={r.from} to={r.to} delay={0.15 + i * 0.12} max={top} />)}</div>
      {canAdvance
        ? <Btn onClick={onAdvance} testId="advance" style={{ marginTop: 8, padding: 11, fontSize: 21 }}>{final ? "Vedi la classifica finale" : view.roundEnd ? "Nuovo giro" : "Prossimo turno"}</Btn>
        : <div className="hint" style={{ marginTop: 8 }}>Prosegue il Megafono… <Countdown deadline={deadline} /></div>}
    </div>
  );
}

/** Classifica attuale, consultabile quando si vuole. */
function Standings({ view, people, onClose }: { view: PlayerView; people: ReturnType<typeof usePeople>; onClose: () => void }) {
  const ranked = [...view.players].sort((a, b) => b.score - a.score), top = Math.max(1, ranked[0]?.score ?? 1);
  return (
    <div className="zoom on top" onClick={onClose} role="dialog" aria-label="Classifica" data-testid="standings">
      <div className="sheet stand" style={{ position: "absolute" }}>
        <h3>Classifica · turno {Math.min(view.turn, view.totalTurns)}/{view.totalTurns}</h3>
        {ranked.map((p, i) => (
          <div className="sr2" key={p.id}>
            <span className="rk">{i === 0 && p.score > 0 ? "👑" : i + 1}</span><Disc color={people.get(p.id).color} size="l" />
            <span className="nm">{people.get(p.id).name}<i style={{ width: `${Math.max(4, (100 * Math.max(0, p.score)) / top)}%` }} /></span>
            <b>{p.score}</b>
          </div>))}
        <div className="hint" style={{ textAlign: "center", marginTop: 8 }}>tocca per chiudere</div>
      </div>
    </div>
  );
}

function Legend({ onClose }: { onClose: () => void }) {
  const row = (ic: string, t: string, sub: string, pt: string, neg = false) => <div className="sr"><span className="ic" dangerouslySetInnerHTML={{ __html: ic }} /><span>{t}<small>{sub}</small></span><span className={`pt ${neg ? "neg" : ""}`}>{pt}</span></div>;
  return (
    <div className="zoom on" onClick={onClose} role="dialog" aria-label="Come si fanno punti" data-testid="legend">
      <div className="sheet" style={{ position: "absolute" }}>
        <h3>Come si fanno punti</h3>
        {row(voteTok("#2f7be0", 30), "Hai votato il personaggio caduto", "il tuo gettone è sulla sua carta", "+2")}
        {row(`<div style="width:24px;height:34px;border-radius:4px;border:3px solid #fff;background:#14a3a1;box-shadow:1px 2px 0 #13224a"></div>`, "La carta che hai giocato è quella caduta", "la carta del mazzo non è di nessuno", "+2")}
        {row(voteTok("#e8362b", 30, true), "Megafono: voti raccolti", "1 punto per ogni voto degli altri sulla carta che ha votato (+2 se cade)", "+1")}
        {row(luiTok("CADE", 32), "Megafono: “CADE LUI!” azzeccato", "il gettone è sul personaggio caduto", "+4")}
        {row(luiTok("NON", 32), "Megafono: “NON CADE” azzeccato", "il gettone è su uno che resta su", "+1")}
        {row(luiTok("CADE", 32, true), "Megafono: scommessa sbagliata", "il Lui! non azzecca la carta", "−1", true)}
        <div className="hint" style={{ textAlign: "center", marginTop: 8 }}>tocca per chiudere</div>
      </div>
    </div>
  );
}

export default function Game({ room, view, deadline, send, readOnly, sound }: GameProps) {
  const people = usePeople(room), { H, dy } = useStage(), me = view.viewerId, isMega = me === view.megafonoId, isHost = room.hostId === me;
  const [phraseB, setPhraseB] = useState(220), [skipLock, setSkipLock] = useState(false), [board, setBoard] = useState(false);
  const megaBot = people.get(view.megafonoId).bot;
  const [pick, setPick] = useState<number | null>(null);
  const [zoomPos, setZoomPos] = useState<number | null>(null), [legend, setLegend] = useState(false);
  const [intro, setIntro] = useState(() => { try { return !FAST && !readOnly && localStorage.getItem("gdt.intro") !== "1"; } catch { return false; } });
  const [climbDone, setClimbDone] = useState(0), [revealDone, setRevealDone] = useState(0), [fallDone, setFallDone] = useState(0), [skip, setSkip] = useState(0);
  const [banner, setBanner] = useState<{ k: string; title: string; sub: string } | null>(null);
  const phaseRef = useRef(view.phase), apiRef = useRef<SceneApi | null>(null), sawPlay = useRef(0), sawVote = useRef(0), prevPhase = useRef<string | null>(null);
  const tower = [...view.tower].sort((a, b) => a.position - b.position), ids = tower.map((t) => t.cardId), N = ids.length;
  phaseRef.current = view.phase;
  const turn = view.turn, phase = view.phase, mine = view.players.find((p) => p.id === me);
  const res = phase === "RESULTS" ? view.lastResult : null;

  useEffect(() => {
    if (phase === "PLAY") sawPlay.current = turn;
    if (phase === "VOTE") sawVote.current = turn;
    if (prevPhase.current !== null && prevPhase.current !== phase) {
      setPick(null); setZoomPos(null);
      const b = BANNERS[phase];
      const extra = phase === "PROCLAIM" && view.goldenGoal ? ["⚡ Spareggio!", "Golden goal: chi ha più punti vince"] as [string, string] : null;
      const t = extra ?? b;
      if (t && !FAST && phase !== "VOTE" && phase !== "SUSPECT") { setBanner({ k: `${turn}-${phase}`, title: t[0], sub: t[1] }); }
    }
    prevPhase.current = phase;
  }, [phase, turn]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!banner) return; const id = setTimeout(() => setBanner(null), 1400); return () => clearTimeout(id); }, [banner]);

  const watched = sawVote.current === turn;
  const climbing = (phase === "SUSPECT" || phase === "VOTE") && sawPlay.current === turn && climbDone !== turn && !FAST;
  const revealing = !!res && watched && revealDone !== turn && !FAST;
  const falling = !!res && watched && !revealing && fallDone !== turn && !FAST;
  const showFallScene = !!res && watched && !revealing && !FAST;
  const showPanel = !!res && (!watched || FAST || fallDone === turn);

  const voters: Voter[] = useMemo(() => {
    // Gli altri in ordine di tavolo, il Megafono per ultimo (rullo di tamburi).
    const order = people.all, i0 = Math.max(0, order.findIndex((p) => p.id === view.megafonoId));
    return [...order.slice(i0 + 1), ...order.slice(0, i0), order[i0]!].filter((p) => res?.votes[p.id] !== undefined).map((p) => ({ id: p.id, name: p.nickname, color: p.color, mega: p.id === view.megafonoId }));
  }, [people, res, view.megafonoId]);
  const seed = useMemo(() => { let h = 7; for (const c of room.code) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) + turn; }, [room.code, turn]);

  const canVote = phase === "VOTE" && !readOnly && view.myVote === null;
  const canPick = !readOnly && !climbing && (canVote || (phase === "SUSPECT" && isMega));
  const luiShown = phase === "SUSPECT" && isMega && pick ? { pos: pick, kind: null } : view.luiPosition != null ? { pos: view.luiPosition, kind: view.luiKind } : null;
  const voteToks: VoteTok[] = useMemo(() => {
    if (res) return voters.map((v) => ({ p: res.votes[v.id]!, c: v.color, mega: v.mega }));
    if (phase === "VOTE" && view.myVote) return [{ p: view.myVote, c: people.get(me).color, mega: isMega }];
    return [];
  }, [res, voters, phase, view.myVote, me, isMega, people]);
  const flagsPlay = view.players.filter((p) => view.megafonoSa || p.id !== view.megafonoId).map((p) => ({ id: p.id, done: p.hasPlayed }));
  const flagsVote = view.players.map((p) => ({ id: p.id, done: p.hasVoted }));
  const act = (a: ClientMessage) => send(a);
  const needTerrace = N > 0 && (phase === "SUSPECT" || phase === "VOTE" || (phase === "RESULTS" && !showFallScene));
  const animating = climbing || revealing || falling;
  const resLui = res?.lui ? { pos: res.lui.position, kind: res.lui.kind } : null;
  const stripText = view.goldenGoal && phase === "PROCLAIM" ? "SPAREGGIO: GOLDEN GOAL" : isMega && phase === "PROCLAIM" ? "SEI IL MEGAFONO" : TITLES[phase];
  const tag = phase === "PROCLAIM" && view.turn > 1 && !view.goldenGoal && (view.turn - 1) % view.players.length === 0 ? `Giro ${view.round}/${view.rounds}` : null;

  return (
    <>
      {showFallScene && res && <SceneHost cardIds={ids} cue={{ fallPositions: res.fallenPositions ?? [res.fallenPosition], seed }} sound={sound} onDone={() => setFallDone(turn)} apiRef={apiRef} />}
      {climbing && <Climb cardIds={ids} sound={sound} skip={skip} onDone={() => { setClimbDone(turn); if (!FAST) { const v = phaseRef.current === "VOTE"; setBanner({ k: `${turn}-after`, title: v ? "Votate!" : "Il Megafono scommette", sub: v ? "in segreto: chi cade?" : "cade o non cade?" }); } }} />}
      {!climbing && needTerrace && !revealing && (
        <Terrace cardIds={ids} votes={voteToks} lui={res ? resLui : luiShown} selected={phase === "RESULTS" ? null : pick} onPick={canPick ? (n) => (phase === "SUSPECT" ? setPick(n) : setZoomPos(n)) : undefined} />
      )}
      {revealing && res && (
        <Reveal cardIds={ids} voters={voters} votes={res.votes} counts={res.counts} lui={resLui} tie={res.tie} fallPositions={res.fallenPositions ?? [res.fallenPosition]} lines={res.lines} onLock={setSkipLock} megaName={people.get(view.megafonoId).name} sound={sound} skip={skip} interactive={!readOnly} onDone={() => setRevealDone(turn)} />
      )}
      <Chips left={<><Disc color={people.get(me).color} />{readOnly ? "Schermo condiviso" : people.get(me).name}</>} mid={<>📣 {people.get(view.megafonoId).name}</>} right={view.goldenGoal ? "⚡ Spareggio" : `Turno ${view.turn}/${view.totalTurns}`} />
      <div className="strip" data-testid="strip">★ {stripText} ★</div>
      {deadline && phase !== "RESULTS" && <div className="cd"><Countdown deadline={deadline} /></div>}
      {phase !== "PROCLAIM" && !(phase === "RESULTS" && showFallScene) && <PhraseHead phrase={view.phrase} megaName={people.get(view.megafonoId).name} onBottom={setPhraseB} />}
      <button className="trophybtn" onClick={() => setBoard(true)} aria-label="Classifica attuale" data-testid="standings-btn">🏆</button>
      {needTerrace && !animating && <button className="legend2" onClick={() => setLegend(true)} aria-label="Come si fanno punti" data-testid="legend-btn">?</button>}
      {tag && <div className="roundtag" style={{ top: 130 }}><b>{tag}</b></div>}
      {banner && <div className="banner" style={{ top: Math.round(H * 0.3) - dy / 2 }} key={banner.k} data-testid="banner"><b>{banner.title}</b><small>{banner.sub}</small></div>}

      {phase === "PROCLAIM" && (isMega && !readOnly ? <PhrasePicker view={view} send={act} /> : <Waiting text={`${people.get(view.megafonoId).name} è il Megafono e sta scegliendo cosa urlare…`} sub="Poi sceglierai, in segreto, dalla tua mano il personaggio che quella cosa la farebbe di sicuro." flags={[]} people={people} />)}
      {phase === "PLAY" && !readOnly && !mine?.hasPlayed && (view.megafonoSa || !isMega) && <HandPicker view={view} send={act} top={phraseB} />}
      {phase === "PLAY" && (readOnly || mine?.hasPlayed || (!view.megafonoSa && isMega)) && <Waiting text={!readOnly && !view.megafonoSa && isMega ? "Hai pescato la tua carta dal mazzo. Aspetta la Folla…" : "Carta giocata! Aspettiamo gli altri…"} sub="Tra poco le carte salgono sulla torre." flags={flagsPlay} people={people} />}

      {phase === "SUSPECT" && !climbing && (isMega && !readOnly ? (
        <div className="bottom" data-testid="lui-chooser">
          {!pick
            ? <Tip>👆 Tocca la carta su cui vuoi scommettere col gettone Lui!</Tip>
            : <>
              <Tip>Gettone Lui! sul <b>n. {pick}</b>. Cosa scommetti?</Tip>
              <div className="lui-opts">
                <button className="lk red" onClick={() => act({ t: "act", action: { type: "placeLui", kind: "CADE", position: pick } })} data-testid="kind-cade"><span dangerouslySetInnerHTML={{ __html: luiTok("CADE", 40) }} />Cade lui!<small>+4 se cade · −1 se sbagli</small></button>
                <button className="lk" onClick={() => act({ t: "act", action: { type: "placeLui", kind: "NON_CADE", position: pick } })} data-testid="kind-non"><span dangerouslySetInnerHTML={{ __html: luiTok("NON", 40) }} />Non cade<small>+1 se resta su · −1 se cade</small></button>
              </div>
              <button className="linkbtn" onClick={() => setZoomPos(pick)} data-testid="look-card">🔍 Guarda bene la carta · tocca un'altra carta per cambiare</button>
            </>}
        </div>
      ) : <div className="bottom"><Tip>{people.get(view.megafonoId).name} scommette col gettone Lui!: “cade” o “non cade”?</Tip></div>)}

      {phase === "VOTE" && !readOnly && !climbing && (canVote
        ? <div className="bottom">
            <Tip>{view.luiPosition ? `Lui! del Megafono sul n. ${view.luiPosition} (bordo giallo). ` : ""}Vota chi farebbe di più questa cosa: il più votato cade e chi l'ha votato fa +2.{!isMega ? <strong className="tip-warn" data-testid="tip-herd"> Evita di votare come il Megafono: ogni voto uguale al suo gli regala 1 punto.</strong> : <strong className="tip-warn" data-testid="tip-herd"> Ogni voto degli altri sulla carta che voti ti dà +1 (cada o no).</strong>}</Tip>
            <Btn disabled={!pick} onClick={() => pick && act({ t: "act", action: { type: "vote", position: pick } })} testId="confirm-vote">{!pick ? "Scegli chi cade" : `Conferma il n. ${pick}`}</Btn></div>
        : <Waiting bottom sub="Il tuo gettone è sulla carta scelta. Lo spoglio parte quando hanno votato tutti." text="Voto inviato 🔒 Aspettiamo gli altri…" flags={flagsVote} people={people} />)}
      {phase === "VOTE" && readOnly && !climbing && <div className="bottom"><div className="pp mini">{view.players.filter((p) => p.hasVoted).length} su {view.players.length} hanno votato</div></div>}

      {animating && !readOnly && !skipLock && <button className="skip" onClick={() => { setSkip((s) => s + 1); apiRef.current?.skip(); }} data-testid="skip">Salta ›</button>}
      {showPanel && res && (
        <Scoreboard H={H} res={res} view={view} people={people} canAdvance={!readOnly && (isMega || isHost || megaBot)} deadline={deadline} final={view.turn >= view.totalTurns}
          onAdvance={() => act({ t: "act", action: { type: "advance" } })} />
      )}

      {zoomPos !== null && ids[zoomPos - 1] && (
        <Zoom cardId={ids[zoomPos - 1]!} pos={zoomPos} total={N} onClose={() => setZoomPos(null)} onNav={setZoomPos}
          actionLabel={phase === "SUSPECT" ? `Il Lui! va sul n. ${zoomPos}` : `Voto il n. ${zoomPos}`} onAction={() => { setPick(zoomPos); setZoomPos(null); }} />
      )}
      {legend && <Legend onClose={() => setLegend(false)} />}
      {board && <Standings view={view} people={people} onClose={() => setBoard(false)} />}
      {intro && <HowTo onClose={() => { setIntro(false); try { localStorage.setItem("gdt.intro", "1"); } catch { /* */ } }} />}
    </>
  );
}
