import { useEffect, useMemo, useRef, useState } from "react";
import type { PlayerView, TurnResult } from "@gdt/game-engine";
import type { ClientMessage } from "@gdt/game-protocol";
import { MAX_PHRASE_CHARS } from "@gdt/game-protocol";
import { MAX_REASON_CHARS } from "@gdt/game-engine";
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
const REASON: Record<string, string> = { voto: "voto giusto", carta: "carta giocata", "lui-cade": "Lui! cade", "lui-non-cade": "Lui! resta su", "lui-fallito": "Lui! sbagliato", gregge: "gregge: niente +2" };
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

function PhraseHead({ phrase, megaName }: { phrase: PlayerView["phrase"]; megaName: string }) {
  const { H } = useStage();
  if (!phrase) return null;
  const cmp = H < 700 ? " cmp" : "";
  let label = "Il Megafono urla:", body: string;
  if (phrase.mode === "free") { label = "Oggi sale sulla torre…"; body = phrase.text ?? "una frase tutta sua (detta a voce)!"; }
  else {
    const m = phrase.text.match(/^Oggi (sale|salgono) sulla torre /);
    if (m) { label = `Oggi ${m[1]} sulla torre…`; body = phrase.text.slice(m[0].length); } else body = phrase.text;
  }
  const len = body.length, size = len > 80 ? " xl" : len > 50 ? " l" : "";
  return (
    <div className={`phrase-card${size}${cmp}`} style={{ top: 90 }} data-testid="phrase" aria-label={`${megaName} urla: ${label} ${body}`}>
      <span className="mega-ic" aria-hidden>📣</span><small>{label}</small><b>{body}</b>
    </div>
  );
}

/** Cosa devo fare adesso: una riga chiara, sempre visibile. */
function Tip({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) { return <div className="tip" style={style} data-testid="tip">{children}</div>; }

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
  const [i, setI] = useState(0), [own, setOwn] = useState(false), [text, setText] = useState(""), [voice, setVoice] = useState(false);
  const go = () => send({ t: "act", action: own ? { type: "choosePhrase", mode: "free", ...(voice || !text.trim() ? {} : { text: text.trim() }) } : { type: "choosePhrase", mode: "card", index: i } });
  return (
    <div className="picker" data-testid="phrase-picker">
      <div className="h" style={{ top: 98, fontSize: 34 }}><small>{own ? "Una frase tutta tua" : single ? "Carta a frase singola" : "Sei il Megafono!"}</small>{own ? "Inventala!" : single ? "Questa è obbligatoria" : "Cosa urli alla folla?"}</div>
      <div className="opts">
        {!own && card.phrases.map((t, k) => (
          <button key={k} className={`opt ${k === i ? "on" : ""}`} onClick={() => setI(k)} data-testid={`phrase-${k}`}>{single ? <b>{t}</b> : t}</button>
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
      <div className="bottom two">
        {!single && <Btn kind="pap" onClick={() => setOwn(!own)} style={{ fontSize: 17 }} testId="phrase-free">{own ? "Torna alle frasi" : "Dico la mia"}</Btn>}
        <Btn kind="red" onClick={go} testId="phrase-go" disabled={own && !voice && !text.trim() && false}>📣 Proclama!</Btn>
      </div>
    </div>
  );
}

function HandPicker({ view, send }: { view: PlayerView; send: GameProps["send"] }) {
  const { H } = useStage(), hand = view.myHand, [sel, setSel] = useState<number | null>(null), [zoom, setZoom] = useState(false);
  const step = Math.min(66, (372 - 104 - 16) / Math.max(1, hand.length - 1)), left0 = (372 - (104 + step * (hand.length - 1))) / 2;
  const play = (idx: number) => send({ t: "act", action: { type: "playCard", cardId: hand[idx]! } });
  return (
    <div className="picker" data-testid="hand">
      <Tip style={{ top: Math.max(196, H - 480) }}>Scegli il personaggio che farebbe questa cosa. Tocca una carta, poi ancora per vederla bene. Resta segreta!</Tip>
      {hand.map((c, i) => {
        const mid = (hand.length - 1) / 2, d = i - mid, lifted = sel === i;
        return <button key={c} className={`card ${lifted ? "sel" : ""}`} data-testid={`hand-card-${i}`} aria-label={`Carta ${i + 1}`}
          style={{ left: left0 + step * i, top: H - 386 + d * d * 7 - (lifted ? 34 : 0), backgroundImage: `url(${cardFull(c)})`, transform: `rotate(${d * 6}deg)`, zIndex: 10 + i + (lifted ? 20 : 0) }}
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
function ScoreRow({ rank, name, color, why, delta, from, to, delay, leader }: { rank: number; name: string; color: string; why: string; delta: number; from: number; to: number; delay: number; leader: boolean }) {
  const v = useCount(from, to, delay);
  return (
    <div className={`rw ${delta !== 0 ? "up" : ""}`} data-testid="score-row">
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
  const title = view.roundEnd ? `Classifica · giro ${Math.min(view.round, view.rounds)}/${view.rounds}` : res.tie ? "Pareggio: cade il voto del Megafono" : "Classifica del turno";
  return (
    <div className={`score ${compact ? "c8" : ""}`} data-testid="result-panel">
      <h3>{view.goldenGoal ? "⚡ Spareggio · classifica" : title}</h3>
      <div>{ranked.map((r, i) => <ScoreRow key={r.p.id} rank={i + 1} name={people.get(r.p.id).name} color={people.get(r.p.id).color} leader={r.to === top && top > 0 && i === 0}
        why={(res.reasons[r.p.id] ?? []).map((x) => REASON[x] ?? x).join(" + ") || "—"} delta={r.d} from={r.from} to={r.to} delay={0.15 + i * 0.12} />)}</div>
      {canAdvance
        ? <Btn onClick={onAdvance} testId="advance" style={{ marginTop: 8, padding: 11, fontSize: 21 }}>{final ? "Vedi la classifica finale" : view.roundEnd ? "Nuovo giro" : "Prossimo turno"}</Btn>
        : <div className="hint" style={{ marginTop: 8 }}>Prosegue il Megafono… <Countdown deadline={deadline} /></div>}
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
  const megaBot = people.get(view.megafonoId).bot;
  const [reason, setReason] = useState(""), [pick, setPick] = useState<number | null>(null), [kind, setKind] = useState<"CADE" | "NON_CADE">("CADE");
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
      setPick(null); setZoomPos(null); setReason("");
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
    const order = people.all, i0 = Math.max(0, order.findIndex((p) => p.id === view.megafonoId));
    return [...order.slice(i0), ...order.slice(0, i0)].filter((p) => res?.votes[p.id] !== undefined).map((p) => ({ id: p.id, name: p.nickname, color: p.color, mega: p.id === view.megafonoId }));
  }, [people, res, view.megafonoId]);
  const seed = useMemo(() => { let h = 7; for (const c of room.code) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) + turn; }, [room.code, turn]);

  const canVote = phase === "VOTE" && !readOnly && view.myVote === null;
  const canPick = !readOnly && !climbing && (canVote || (phase === "SUSPECT" && isMega));
  const luiShown = phase === "SUSPECT" && isMega && pick ? { pos: pick, kind } : view.luiPosition != null ? { pos: view.luiPosition, kind: view.luiKind } : null;
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
      {showFallScene && res && <SceneHost cardIds={ids} cue={{ fallPos: res.fallenPosition, seed }} sound={sound} onDone={() => setFallDone(turn)} apiRef={apiRef} />}
      {climbing && <Climb cardIds={ids} sound={sound} skip={skip} onDone={() => { setClimbDone(turn); if (!FAST) { const v = phaseRef.current === "VOTE"; setBanner({ k: `${turn}-after`, title: v ? "Votate!" : "Il Megafono scommette", sub: v ? "in segreto: chi cade?" : "cade o non cade?" }); } }} />}
      {!climbing && needTerrace && !revealing && (
        <Terrace cardIds={ids} votes={voteToks} lui={res ? resLui : luiShown} selected={phase === "RESULTS" ? null : pick} onPick={canPick ? (n) => setZoomPos(n) : undefined} />
      )}
      {revealing && res && (
        <Reveal cardIds={ids} voters={voters} votes={res.votes} voteReasons={res.voteReasons ?? {}} counts={res.counts} lui={resLui} tie={res.tie} fallPos={res.fallenPosition} herd={!!res.herd} megaName={people.get(view.megafonoId).name} sound={sound} skip={skip} interactive={!readOnly} onDone={() => setRevealDone(turn)} />
      )}
      <Chips left={<><Disc color={people.get(me).color} />{readOnly ? "Schermo condiviso" : people.get(me).name}</>} mid={<>📣 {people.get(view.megafonoId).name}</>} right={view.goldenGoal ? "⚡ Spareggio" : `Turno ${view.turn}/${view.totalTurns}`} />
      <div className="strip" data-testid="strip">★ {stripText} ★</div>
      {deadline && phase !== "RESULTS" && <div className="cd"><Countdown deadline={deadline} /></div>}
      {phase !== "PROCLAIM" && !(phase === "RESULTS" && showFallScene) && <PhraseHead phrase={view.phrase} megaName={people.get(view.megafonoId).name} />}
      {needTerrace && !animating && <button className="legend2" onClick={() => setLegend(true)} aria-label="Come si fanno punti" data-testid="legend-btn">?</button>}
      {tag && <div className="roundtag" style={{ top: 130 }}><b>{tag}</b></div>}
      {banner && <div className="banner" style={{ top: Math.round(H * 0.3) - dy / 2 }} key={banner.k} data-testid="banner"><b>{banner.title}</b><small>{banner.sub}</small></div>}

      {phase === "PROCLAIM" && (isMega && !readOnly ? <PhrasePicker view={view} send={act} /> : <Waiting text={`${people.get(view.megafonoId).name} è il Megafono e sta scegliendo cosa urlare…`} sub="Poi sceglierai, in segreto, dalla tua mano il personaggio che quella cosa la farebbe di sicuro." flags={[]} people={people} />)}
      {phase === "PLAY" && !readOnly && !mine?.hasPlayed && (view.megafonoSa || !isMega) && <HandPicker view={view} send={act} />}
      {phase === "PLAY" && (readOnly || mine?.hasPlayed || (!view.megafonoSa && isMega)) && <Waiting text={!readOnly && !view.megafonoSa && isMega ? "Hai pescato la tua carta dal mazzo. Aspetta la Folla…" : "Carta giocata! Aspettiamo gli altri…"} sub="Tra poco le carte salgono sulla torre." flags={flagsPlay} people={people} />}

      {phase === "SUSPECT" && !climbing && (isMega && !readOnly ? (
        <div className="bottom">
          <Tip>Tocca la carta su cui scommetti col gettone Lui!, poi scegli: cade o non cade.</Tip>
          <div className="lui-opts">
            <button className={`lk red ${kind === "CADE" ? "on" : ""}`} onClick={() => setKind("CADE")} data-testid="kind-cade">Cade lui!<small>+4 se cade · −1 se sbagli</small></button>
            <button className={`lk ${kind === "NON_CADE" ? "on" : ""}`} onClick={() => setKind("NON_CADE")} data-testid="kind-non">Non cade<small>+1 se resta su · −1 se cade</small></button>
          </div>
          <Btn disabled={!pick} onClick={() => pick && act({ t: "act", action: { type: "placeLui", kind, position: pick } })} testId="place-lui">{pick ? `Posa il Lui! sul n. ${pick}` : "Tocca una carta"}</Btn>
        </div>
      ) : <div className="bottom"><Tip>{people.get(view.megafonoId).name} scommette col gettone Lui!: “cade” o “non cade”?</Tip></div>)}

      {phase === "VOTE" && !readOnly && !climbing && (canVote
        ? <div className="bottom">
            <Tip>Vota chi farebbe di più questa cosa. Il più votato cade giù! Se hai votato quello che cade: +2.{view.rules.herd ? " (Gregge: se il Megafono indovina la carta, i +2 sono solo suoi.)" : ""}</Tip>
            {view.rules.justifyVotes && <div className="reason-box"><textarea className="phr-in" rows={2} maxLength={MAX_REASON_CHARS} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Perché proprio lui? Scrivilo in una frase (resta segreto fino allo spoglio)" data-testid="vote-reason" aria-label="Perché hai votato questo personaggio" /><small>{reason.length}/{MAX_REASON_CHARS}</small></div>}
            <Btn disabled={!pick || (view.rules.justifyVotes && !reason.trim())} onClick={() => pick && act({ t: "act", action: { type: "vote", position: pick, ...(view.rules.justifyVotes ? { reason: reason.trim() } : {}) } })} testId="confirm-vote">{!pick ? "Scegli chi cade" : view.rules.justifyVotes && !reason.trim() ? "Scrivi perché lo voti" : `Conferma il n. ${pick}`}</Btn></div>
        : <Waiting bottom sub="Il tuo gettone è sulla carta scelta. Lo spoglio parte quando hanno votato tutti." text="Voto inviato 🔒 Aspettiamo gli altri…" flags={flagsVote} people={people} />)}
      {phase === "VOTE" && readOnly && !climbing && <div className="bottom"><div className="pp mini">{view.players.filter((p) => p.hasVoted).length} su {view.players.length} hanno votato</div></div>}

      {animating && !readOnly && <button className="skip" onClick={() => { setSkip((s) => s + 1); apiRef.current?.skip(); }} data-testid="skip">Salta ›</button>}
      {showPanel && res && (
        <Scoreboard H={H} res={res} view={view} people={people} canAdvance={!readOnly && (isMega || isHost || megaBot)} deadline={deadline} final={view.turn >= view.totalTurns}
          onAdvance={() => act({ t: "act", action: { type: "advance" } })} />
      )}

      {zoomPos !== null && ids[zoomPos - 1] && (
        <Zoom cardId={ids[zoomPos - 1]!} pos={zoomPos} total={N} onClose={() => setZoomPos(null)} onNav={setZoomPos}
          actionLabel={phase === "SUSPECT" ? `Il Lui! va sul n. ${zoomPos}` : `Voto il n. ${zoomPos}`} onAction={() => { setPick(zoomPos); setZoomPos(null); }} />
      )}
      {legend && <Legend onClose={() => setLegend(false)} />}
      {intro && <HowTo onClose={() => { setIntro(false); try { localStorage.setItem("gdt.intro", "1"); } catch { /* */ } }} />}
    </>
  );
}
