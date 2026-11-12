import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PlayerView, TurnResult } from "@gdt/game-engine";
import type { ClientMessage } from "@gdt/game-protocol";
import { MAX_PHRASE_CHARS } from "@gdt/game-protocol";
import { Btn, Disc, FAST, PLAYER_COLORS, useStage } from "../ui.tsx";
import { cardFull } from "../lib/cards.ts";
import SceneHost from "../components/SceneHost.tsx";
import Standings from "../components/Standings.tsx";
import { ResultMarks, ScoreStrip } from "../components/ResultsView.tsx";
import { objCond } from "../lib/lui.ts";
import Zoom from "../components/Zoom.tsx";
import { Climb, Reveal, Terrace, luiSpecOf, luiToks, markSpec } from "../components/Terrace.tsx";
import type { Voter, VoteTok } from "../components/Terrace.tsx";
import { voteTok, luiTok } from "../scene/draw.ts";
import { luiEffectShort, luiLabel } from "../lib/lui.ts";
import type { LuiSpec, PlayerId } from "@gdt/game-engine";
import type { RoomMsg } from "../hooks/useRoom.ts";
import type { SceneApi } from "../scene/fallScene.ts";
import { IntroSlides, MegaIntro, NoCardNotice, megaIntroDue, megaIntroSeen, noCardDue, noCardSeen } from "../components/Intro.tsx";
import { HintBubble, HintPointer, useIdleHint } from "../components/IdleHint.tsx";
import { hintFor } from "../lib/hints.tsx";
import { BMeta, BSheet, LuiInfo, LuiTray, ObjPill, PhrasePill, Row, WaitCard } from "../components/BUi.tsx";
import type { UiCtl } from "../components/BUi.tsx";
import LuiDraw from "../components/LuiDraw.tsx";
import CharIntro from "../components/CharIntro.tsx";
interface Geo { left: number; top: number; w: number; h: number; rot: number }
import { t as tx, ts as txs } from "../lib/testi.ts";

export interface GameProps { room: RoomMsg; view: PlayerView; deadline: number | null; /** Intervallo a tempo: istante locale del «via!». */ goAt?: number | null; send: (m: ClientMessage) => void; readOnly?: boolean; sound: boolean; ui?: UiCtl }
/** Cartelli di inizio fase (letti al momento, così seguono i testi aggiornati). */
const bannerFor = (phase: string): [string, string] | undefined => phase === "PLAY" ? [txs("g.ban.play.t"), txs("g.ban.play.s")] : phase === "SUSPECT" ? [txs("g.ban.susp.t"), txs("g.ban.susp.s")] : phase === "VOTE" ? [txs("g.ban.vote.t"), txs("g.ban.vote.s")] : undefined;
export function usePeople(room: RoomMsg) {
  return useMemo(() => {
    const m = new Map(room.players.map((p, i) => [p.id, { name: p.nickname, color: PLAYER_COLORS[(p.char ?? i) % 8]!, index: i, bot: !!p.isBot }]));
    return { get: (id: string) => m.get(id) ?? { name: "?", color: "#999", index: 0, bot: false }, all: room.players.map((p, i) => ({ ...p, color: PLAYER_COLORS[(p.char ?? i) % 8]! })) };
  }, [room.players]);
}

/** Cosa devo fare adesso: una riga chiara, sempre visibile. */
export function Tip({ children, style, className = "" }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) { return <div className={`tip ${className}`} style={style} data-testid="tip">{children}</div>; }

/** Frasi tra cui sceglie il Megafono: ognuna su due righe, si apre con ▾ (e si richiude da sola); un tocco la sceglie, «Proclama» conferma. */
function PhrasePicker({ view, send, ui, meta }: { view: PlayerView; send: GameProps["send"]; ui?: UiCtl | null; meta: React.ReactNode }) {
  const card = view.proclaimCard!, single = card.phrases.length === 1;
  const [own, setOwn] = useState(false), [text, setText] = useState(""), [voice, setVoice] = useState(false), [sel, setSel] = useState<number | null>(single ? 0 : null);
  const say = (i: number) => send({ t: "act", action: { type: "choosePhrase", mode: "card", index: i } });
  const goOwn = () => send({ t: "act", action: { type: "choosePhrase", mode: "free", ...(voice || !text.trim() ? {} : { text: text.trim() }) } });
  return (
    <div className="bl" data-testid="phrase-picker">
      {meta}
      <div className="bhead"><small>{own ? tx("g.fr.tua") : tx("g.fr.mega")}</small>{own ? tx("g.fr.inventala") : tx("g.fr.scegli")}</div>
      <div className="bscene" style={{ display: "flex", alignItems: "flex-start" }}>
        {!own && <div className="bopts">{card.phrases.map((t, k) => <PhraseOpt key={k} k={k} text={t} theme={card.themes?.[k]} on={sel === k} onPick={() => setSel(k)} />)}</div>}
        {own && (
          <div className="bopts" style={{ gap: 10 }}>
            <div className="phr-fixed" style={{ color: "#fff", textShadow: "2px 2px 0 #13224a" }}>{tx("g.fr.oggi")}</div>
            <textarea className="phr-in" maxLength={MAX_PHRASE_CHARS} value={text} disabled={voice} onChange={(e) => setText(e.target.value)} placeholder={txs("g.fr.ph")} data-testid="phrase-text" aria-label={txs("g.fr.aria")} />
            <div className="hint" style={{ textAlign: "right", margin: 0 }}>{text.length}/{MAX_PHRASE_CHARS}</div>
            <label className="hint" style={{ display: "flex", gap: 8, alignItems: "center", margin: 0 }}><input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} data-testid="phrase-voice" />{tx("g.fr.voce")}</label>
          </div>
        )}
      </div>
      <BSheet gold title={own ? tx("g.fr.t.own") : tx("g.fr.t")} sub={own ? tx("g.fr.s.own") : single ? tx("g.fr.s.single") : tx("g.fr.s")} ui={ui}>
        <Row>
          {(!single || own) && <Btn kind="pap" onClick={() => setOwn(!own)} style={{ fontSize: 15, padding: "0 12px", flex: "none" }} testId="phrase-free">{own ? tx("g.fr.indietro") : tx("g.fr.inventa")}</Btn>}
          <Btn kind="red" disabled={!own && sel === null} onClick={() => (own ? goOwn() : sel !== null && say(sel))} testId="phrase-go">{tx("g.fr.proclama")}</Btn>
        </Row>
      </BSheet>
    </div>
  );
}

function PhraseOpt({ k, text, theme, on, onPick }: { k: number; text: string; theme?: string; on: boolean; onPick: () => void }) {
  return (
    <div className={`bopt${on ? " on" : ""}`} role="button" tabIndex={0} aria-pressed={on} onClick={onPick} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(); } }} data-testid={`phrase-${k}`}>
      {theme && <span className="opt-ctx">{theme}</span>}<span className="tx">{text}</span>
    </div>
  );
}

/** La mano come carosello: la carta al centro è grande, le vicine si intravedono. Tocca una carta per sceglierla, di nuovo per ingrandirla. */
export function HandPicker({ view, send, ui, title = txs("g.mano.t"), sub = txs("g.mano.s") }: { view: PlayerView; send: GameProps["send"]; ui?: UiCtl | null; title?: string; sub?: React.ReactNode }) {
  const hand = view.myHand, n = hand.length, [cur, setCur] = useState(Math.floor((n - 1) / 2)), [picked, setPicked] = useState(false), [zoom, setZoom] = useState(false);
  const box = useRef<HTMLDivElement>(null), [dim, setDim] = useState({ w: 372, h: 380 }), x0 = useRef<number | null>(null), y0 = useRef(0);
  useLayoutEffect(() => {
    const el = box.current; if (!el) return undefined;
    const f = () => setDim({ w: el.clientWidth, h: el.clientHeight }); f();
    const ro = new ResizeObserver(f); ro.observe(el); return () => ro.disconnect();
  }, []);
  const mega = view.phase === "PLAY" && view.viewerId === view.megafonoId;   // variante «Il Megafono sa»: la carta del Megafono è riconoscibile
  const play = (idx: number) => send({ t: "act", action: { type: "playCard", cardId: hand[idx]! } });
  const cH = Math.min(dim.h * 0.84, 320), cW = cH / 1.5, SC = [1, 0.78, 0.62, 0.5], OFF = [0, 0.72, 1.05, 1.28];
  const geo = (i: number): Geo => { const d = i - cur, a = Math.min(3, Math.abs(d)), f = SC[a]!, w = cW * f, h = cH * f, cx = Math.max(w / 2 - cW * 0.15, Math.min(dim.w - w / 2 + cW * 0.15, dim.w / 2 + Math.sign(d) * OFF[a]! * cW)); return { left: cx - w / 2, top: dim.h / 2 - h / 2 + (d === 0 ? -6 : 8), w, h, rot: d * 7 }; };
  const move = (d: number) => { setCur((c) => Math.max(0, Math.min(n - 1, c + d))); setPicked(true); };
  return (
    <>
      <div className="bscene" data-testid="hand">
        <div className="bhand" ref={box} onTouchStart={(e) => { x0.current = e.touches[0]!.clientX; y0.current = e.touches[0]!.clientY; }}
          onTouchEnd={(e) => { const t = e.changedTouches[0]!; if (x0.current !== null && Math.abs(t.clientX - x0.current) > 35 && Math.abs(t.clientX - x0.current) > Math.abs(t.clientY - y0.current) * 1.2) move(t.clientX < x0.current ? 1 : -1); x0.current = null; }}>
          {hand.map((c, i) => {
            const d = i - cur, a = Math.min(3, Math.abs(d)), f = SC[a]!, w = cW * f, h = cH * f, cx = Math.max(w / 2 - cW * 0.15, Math.min(dim.w - w / 2 + cW * 0.15, dim.w / 2 + Math.sign(d) * OFF[a]! * cW));
            const lifted = picked && d === 0;
            return <button key={c} className={`card ${lifted ? "sel" : ""}${d === 0 ? " cur" : ""}${mega ? " gold" : ""}`} data-testid={`hand-card-${i}`} aria-label={txs("g.mano.aria", { n: i + 1 })}
              style={{ width: w, height: h, left: cx - w / 2, top: dim.h / 2 - h / 2 + (d === 0 ? -6 : 8), backgroundImage: `url(${cardFull(c)})`, transform: `rotate(${d * 7}deg)`, zIndex: 20 - a }}
              onClick={() => { if (d === 0 && picked) setZoom(true); else { setCur(i); setPicked(true); } }} />;
          })}
          <div className="bdots">{hand.map((_, i) => <i key={i} className={i === cur ? "on" : ""} />)}</div>
          {mega && n > 0 && <i className="hstamp" style={{ left: geo(cur).left - 6, top: geo(cur).top - 8 }} aria-hidden>📣</i>}
        </div>
      </div>
      <BSheet gold={mega} title={title} sub={sub} ui={ui}>
        <Row>{ui && <LuiTray view={view} ui={ui} />}<Btn disabled={!picked} onClick={() => picked && play(cur)} testId="play-card">{picked ? tx("g.gioca") : tx("g.scegli")}</Btn></Row>
      </BSheet>
      {zoom && picked && (
        <div className="zoom on" role="dialog" data-testid="hand-zoom"><div className="zc"><img className="fullcard" src={cardFull(hand[cur]!)} alt={txs("g.tua.alt")} /></div>
          <div className="zb"><Btn onClick={() => { setZoom(false); play(cur); }}>{tx("g.gioca")}</Btn><Btn kind="pap" onClick={() => setZoom(false)} style={{ fontSize: 18, padding: 10 }}>{tx("g.indietro")}</Btn></div></div>
      )}
    </>
  );
}

const Flags = ({ flags, people }: { flags: { id: string; done: boolean }[]; people: ReturnType<typeof usePeople> }) => (
  <div className="bflags">{flags.map((f) => <span key={f.id} className="chip">{<Disc color={people.get(f.id).color} />}{people.get(f.id).name}{f.done ? " ✓" : " …"}</span>)}</div>
);


export default function Game({ room, view, deadline, send, readOnly, sound, ui }: GameProps) {
  const people = usePeople(room), { H, dy } = useStage(), me = view.viewerId, isMega = me === view.megafonoId, isHost = room.hostId === me, gold = isMega && !readOnly;
  const [after, setAfter] = useState<{ turn: number; step: "points" | "board" }>({ turn: -1, step: "points" });
  const megaBot = people.get(view.megafonoId).bot;
  const [pick, setPick] = useState<number | null>(null);
  const [zoomPos, setZoomPos] = useState<number | null>(null), [luiInfo, setLuiInfo] = useState(false), [luiNo, setLuiNo] = useState<number | null>(null);
  // PROPAGANDA, Dirottamento!: il Megafono ha scelto la carta da cui togliere il voto e ora sceglie quella che lo riceve
  const [dir, setDir] = useState<{ turn: number; slot: string; from: number; to: number | null } | null>(null);
  const [intro, setIntro] = useState(() => { try { return !FAST && !readOnly && localStorage.getItem("gdt.intro") !== "1"; } catch { return false; } });
  const charKey = `gdt.char.${room.code}`;
  const [charIntro, setCharIntro] = useState(() => { try { return !FAST && !readOnly && sessionStorage.getItem(charKey) !== "1" && localStorage.getItem("gdt.nochar") !== "1"; } catch { return false; } });
  // «Il gregge»: a inizio partita, dopo il personaggio, l'estrazione della soglia del Lui! (una volta per stanza)
  const drawKey = `gdt.luidraw.${room.code}`;
  const [luiDraw, setLuiDraw] = useState(() => { try { return !FAST && !readOnly && (view.gregge || view.propaganda) && view.turn === 1 && sessionStorage.getItem(drawKey) !== "1"; } catch { return false; } });
  const [climbDone, setClimbDone] = useState(0), [revealDone, setRevealDone] = useState(0), [fallDone, setFallDone] = useState(0), [skip, setSkip] = useState(0);
  const [banner, setBanner] = useState<{ k: string; title: string; sub: string } | null>(null);
  const [megaIntro, setMegaIntro] = useState(false), megaShown = useRef(-1);
  const [noCard, setNoCard] = useState(false), noCardShown = useRef(-1);
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
      const b = bannerFor(phase);
      const extra = phase === "PROCLAIM" && view.goldenGoal ? [txs("g.ban.golden.t"), txs("g.ban.golden.s")] as [string, string] : null;
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
  const afterStep = after.turn === turn ? after.step : "points";

  const voters: Voter[] = useMemo(() => {
    // Gli altri in ordine di tavolo, il Megafono per ultimo (rullo di tamburi).
    const order = people.all, i0 = Math.max(0, order.findIndex((p) => p.id === view.megafonoId));
    return [...order.slice(i0 + 1), ...order.slice(0, i0), order[i0]!].filter((p) => res?.votes[p.id] !== undefined).map((p) => ({ id: p.id, name: p.nickname, color: p.color, mega: p.id === view.megafonoId }));
  }, [people, res, view.megafonoId]);
  const seed = useMemo(() => { let h = 7; for (const c of room.code) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) + turn; }, [room.code, turn]);

  const canVote = phase === "VOTE" && !readOnly && view.myVote === null;
  // «Il gregge»: il Megafono non può votare la carta su cui ha posato il Lui! (se ci prova, glielo diciamo)
  const dirOn = !!dir && dir.turn === turn && phase === "SUSPECT";
  const banned = (n: number) => phase === "VOTE" && isMega && (view.cnc ? view.myForbidden === n : view.gregge && view.luiPosition === n);
  const specOf = (slot: string | null) => (slot ? view.luiTokens.find((x) => x.slot === slot) ?? null : null);
  // il segnalino del gioco base sulla Torre: in scelta (Megafono), posato (coperto per gli altri), scoperto nei risultati
  const marksShown = !view.cnc ? null : phase === "SUSPECT" && isMega ? (pick ? [{ pos: pick, spec: null }] : []) : view.marks.map((m) => ({ pos: m.position, spec: specOf(m.slot) }));
  const canPick = !readOnly && !climbing && (canVote || (phase === "SUSPECT" && isMega));
  const luiShown = phase === "SUSPECT" && isMega && pick ? { pos: pick, spec: null } : view.luiPosition != null ? { pos: view.luiPosition, spec: view.luiSlot ? view.luiTokens.find((x) => x.slot === view.luiSlot) ?? null : null } : null;
  const voteToks: VoteTok[] = useMemo(() => {
    if (res) return luiToks(voters.map((v) => ({ v, tok: { p: res.votes[v.id]!, c: v.color, mega: v.mega, id: v.id } })), res.lui ?? null, res.marks ?? null);   // conteggio ufficiale (Imbroglio!, Propaganda!, …)
    if (phase === "VOTE" && view.myVote) return [{ p: view.myVote, c: people.get(me).color, mega: isMega }];
    return [];
  }, [res, voters, phase, view.myVote, me, isMega, people]);
  const flagsPlay = view.players.filter((p) => view.megafonoSa || p.id !== view.megafonoId).map((p) => ({ id: p.id, done: p.hasPlayed }));
  const flagsVote = view.players.map((p) => ({ id: p.id, done: p.hasVoted }));
  const act = (a: ClientMessage) => send(a);
  const needTerrace = N > 0 && (phase === "SUSPECT" || phase === "VOTE" || (phase === "RESULTS" && !showFallScene));
  const animating = climbing || revealing || falling;
  const resLui = res?.lui ? { pos: res.lui.position, spec: luiSpecOf(res.lui) } : null, resMarks = res?.marks?.length ? res.marks.map((m) => ({ pos: m.position, spec: markSpec(m) })) : null;
  const megaName = people.get(view.megafonoId).name;
  const tag = phase === "PROCLAIM" && view.turn > 1 && !view.goldenGoal && (view.turn - 1) % view.players.length === 0 ? txs("g.meta.giro", { n: view.round, tot: view.rounds }) : "";
  const metaEl = <BMeta me={gold} turn={(view.goldenGoal ? txs("g.meta.sparegg") : txs("mg.turno", { n: view.turn, tot: view.totalTurns })) + tag} mega={megaName} deadline={phase !== "RESULTS" ? deadline : null} />;
  const uiv = readOnly ? null : ui ?? null;
  const tray = uiv ? <LuiTray view={view} ui={uiv} /> : null;
  const pill = <PhrasePill phrase={view.phrase} megaName={megaName} />;

  // La scheda «Sei il Megafono!» compare le prime due volte che tocca a te
  useEffect(() => {
    if (phase === "PROCLAIM" && isMega && !readOnly && !FAST && megaShown.current !== turn && !intro && !charIntro && !luiDraw && megaIntroDue()) { megaShown.current = turn; setMegaIntro(true); }
  }, [phase, turn, isMega, readOnly, intro, charIntro, luiDraw]);
  // «Questo turno non giochi carte»: resta finché non lo tocchi (le prime 3 volte)
  useEffect(() => {
    if (phase === "PLAY" && isMega && !view.megafonoSa && !readOnly && !FAST && noCardShown.current !== turn && !intro && !charIntro && !luiDraw && !megaIntro && noCardDue()) { noCardShown.current = turn; setNoCard(true); }
  }, [phase, turn, isMega, view.megafonoSa, readOnly, intro, charIntro, luiDraw, megaIntro]);
  // Suggerimento a fumetto con freccia: solo se devi agire e resti fermo a lungo
  const hint = readOnly ? null : hintFor(view), hintText = hint?.text ?? null;
  const [hintOn, hintClose] = useIdleHint(!!hintText && !animating && !climbing && !banner && !intro && !charIntro && !luiDraw && !megaIntro && !noCard && zoomPos === null, `${turn}-${phase}`);
  const inPicker = phase === "PROCLAIM" && isMega && !readOnly;
  return (
    <>
      {showFallScene && res && <SceneHost cardIds={ids} cue={{ fallPositions: res.fallenPositions ?? [res.fallenPosition], seed }} sound={sound} onDone={() => setFallDone(turn)} apiRef={apiRef} />}
      {climbing && <Climb cardIds={ids} sound={sound} skip={skip} onDone={() => { setClimbDone(turn); if (!FAST) { const v = phaseRef.current === "VOTE"; setBanner({ k: `${turn}-after`, title: v ? txs("g.ban.vote.t") : txs("g.ban.dopo.mega"), sub: v ? txs("g.ban.vote.s") : txs("g.ban.dopo.mega.s") }); } }} />}
      {!climbing && needTerrace && !revealing && (
        <Terrace cardIds={ids} votes={res && showPanel && afterStep === "points" ? [] : voteToks} lui={view.cnc ? null : res ? resLui : luiShown} marks={view.cnc ? (res ? resMarks : marksShown) : null} selected={phase === "RESULTS" ? null : dirOn ? dir!.to : pick} onPick={canPick ? (n) => (phase === "SUSPECT" ? (dirOn ? (n !== dir!.from && setDir({ ...dir!, to: n })) : setPick(n)) : banned(n) ? (setLuiNo(turn), setPick(null)) : (setLuiNo(null), setZoomPos(n))) : undefined} onLui={phase === "VOTE" && !readOnly && (view.luiPosition != null || view.marks.length > 0) ? () => setLuiInfo(true) : undefined} />
      )}
      {showPanel && res && afterStep === "points" && needTerrace && <ResultMarks n={ids.length} votes={voteToks} lines={res.lines} fallen={res.fallenPositions ?? [res.fallenPosition]} colorOf={(id) => people.get(id).color} meId={readOnly ? undefined : me} />}
      {revealing && res && (
        <Reveal cardIds={ids} voters={voters} votes={res.votes} counts={res.counts} lui={res.lui} marks={res.marks ?? null} tie={res.tie} tieBreak={res.tieBreak} fallPositions={res.fallenPositions ?? [res.fallenPosition]} sound={sound} skip={skip} interactive={!readOnly} onDone={() => setRevealDone(turn)} />
      )}
      {banner && <div className="banner" style={{ top: Math.round(H * 0.3) - dy / 2 }} key={banner.k} data-testid="banner"><b>{banner.title}</b><small>{banner.sub}</small></div>}

      {inPicker && <PhrasePicker view={view} send={act} ui={uiv} meta={metaEl} />}
      {!inPicker && (
        <div className="bl">
          {metaEl}
          {animating ? null : (
            <>
              {phase !== "PROCLAIM" && !(phase === "RESULTS" && showFallScene) && pill}
              {(phase === "SUSPECT" || phase === "VOTE") && !climbing && <ObjPill view={view} />}

              {phase === "PROCLAIM" && <>
                <WaitCard text={txs("g.attesa.frase", { nome: megaName })} sub={txs("g.attesa.frase.x")} />
                <BSheet gold={gold} title={tx("g.attendi")} sub={tx("g.attendi.megafono")} ui={uiv}>{tray && <Row>{tray}</Row>}</BSheet>
              </>}

              {phase === "PLAY" && !readOnly && !mine?.hasPlayed && (view.megafonoSa || !isMega) && <HandPicker view={view} send={act} ui={uiv ?? undefined} />}
              {phase === "PLAY" && (readOnly || mine?.hasPlayed || (!view.megafonoSa && isMega)) && <>
                <WaitCard text={!readOnly && !view.megafonoSa && isMega ? txs("g.nocard.t") : txs("g.giocata")} sub={!readOnly && !view.megafonoSa && isMega ? txs("g.nocard.x") : txs("g.giocata.x")} />
                <BSheet gold={gold} title={tx("g.attendi")} sub={txs("g.hanno.giocato", { n: flagsPlay.filter((f) => f.done).length, tot: flagsPlay.length })} ui={uiv}><Flags flags={flagsPlay} people={people} /></BSheet>
              </>}

              {phase === "SUSPECT" && !climbing && <>
                <div className="bsp" />
                {isMega && !readOnly && view.cnc ? (
                  !pick
                    ? <BSheet gold={gold} title={tx("g.cnc.t1")} sub={tx("g.cnc.s1")} ui={uiv}><div data-testid="lui-chooser"><Row>{tray}<Btn disabled>{tx("g.scegli")}</Btn></Row></div></BSheet>
                    : <BSheet gold={gold} title={txs("g.cnc.su", { n: pick })} sub={tx("g.cnc.su.s")} ui={uiv}>
                      <div data-testid="lui-chooser" style={{ display: "grid", gap: 8 }}>
                        <div className="lui-opts">
                          {view.luiTokens.map((sp) => (
                            <button key={sp.slot} className={`lk lui-${sp.slot}`} onClick={() => act({ t: "act", action: { type: "placeMarks", marks: [{ slot: sp.slot as "cade", position: pick }] } })} data-testid={`lui-${sp.slot}`}>
                              <span dangerouslySetInnerHTML={{ __html: luiTok(sp, 50) }} /><b>{luiLabel(sp)}</b><small>{luiEffectShort(sp)}</small></button>))}
                        </div>
                        <button className="linkbtn" onClick={() => setZoomPos(pick)} data-testid="look-card">{tx("g.lui.guarda")}</button>
                      </div>
                    </BSheet>
                ) : isMega && !readOnly ? (
                  dirOn
                    ? <BSheet gold={gold} title={tx("g.dir.t")} sub={dir!.to ? txs("g.dir.s.ok", { da: dir!.from, a: dir!.to }) : txs("g.dir.s", { n: dir!.from })} ui={uiv}>
                      <div data-testid="dir-chooser"><Row>
                        <Btn kind="pap" onClick={() => setDir(null)} testId="dir-cancel">{tx("g.dir.annulla")}</Btn>
                        <Btn disabled={!dir!.to} onClick={() => dir!.to && act({ t: "act", action: { type: "placeLui", slot: dir!.slot, position: dir!.from, to: dir!.to } })} testId="dir-confirm">{dir!.to ? txs("g.dir.ok", { n: dir!.to }) : txs("g.dir.scegli")}</Btn>
                      </Row></div>
                    </BSheet>
                  : !pick
                    ? <BSheet gold={gold} title={tx("g.lui.t")} sub={view.propaganda ? tx("g.lui.s.prop") : tx("g.lui.s")} ui={uiv}><div data-testid="lui-chooser"><Row>{tray}<Btn disabled>{tx("g.scegli")}</Btn></Row></div></BSheet>
                    : <BSheet gold={gold} title={txs("g.lui.t.n", { n: pick })} sub={view.propaganda ? tx("g.lui.s.n.prop") : tx("g.lui.s.n")} ui={uiv}>
                      <div data-testid="lui-chooser" style={{ display: "grid", gap: 8 }}>
                        <div className="lui-opts">
                          {view.luiTokens.map((sp) => { const left = view.myLuiLeft.includes(sp.slot);
                            return <button key={sp.slot} className={`lk lui-${sp.slot}`} disabled={!left} onClick={() => (sp.effect === "dirottamento" ? setDir({ turn, slot: sp.slot, from: pick, to: null }) : act({ t: "act", action: { type: "placeLui", slot: sp.slot, position: pick } }))} data-testid={`lui-${sp.slot}`}>
                              <span dangerouslySetInnerHTML={{ __html: luiTok(sp, 50) }} /><b>{luiLabel(sp)}</b><small>{left ? (sp.effect ? luiEffectShort(sp) : sp.trap ? txs("g.lui.gregge", { pt: sp.pts }) : sp.herd ? txs("g.lui.gregge.k", { pt: sp.pts }) : txs("g.lui.pt", { pt: sp.pts })) : txs("g.lui.usato")}</small></button>; })}
                        </div>
                        <button className="linkbtn" onClick={() => setZoomPos(pick)} data-testid="look-card">{tx("g.lui.guarda")}</button>
                      </div>
                    </BSheet>
                ) : <BSheet gold={gold} title={tx("g.attendi")} sub={txs("g.lui.attesa", { nome: megaName })} ui={uiv}>{tray && <Row>{tray}</Row>}</BSheet>}
              </>}

              {phase === "VOTE" && !climbing && <>
                <div className="bsp" />
                {readOnly
                  ? <BSheet gold={gold} title={tx("g.vota.t")} sub={txs("g.hanno.votato", { n: view.players.filter((p) => p.hasVoted).length, tot: view.players.length })} />
                  : canVote
                    ? <BSheet gold={gold} title={tx("g.vota.t")} sub={luiNo === turn ? <span className="lui-no" data-testid="lui-no-vote">{view.cnc ? tx("g.cnc.novoto") : tx("g.lui.novoto")}</span> : tx("g.vota.s")} ui={uiv}>
                      <Row>{tray}<Btn disabled={!pick} onClick={() => pick && act({ t: "act", action: { type: "vote", position: pick } })} testId="confirm-vote">{!pick ? txs("g.vota.cade") : txs("g.conferma", { n: pick })}</Btn></Row>
                    </BSheet>
                    : <BSheet gold={gold} title={tx("g.inviato")} sub={tx("g.aspettiamo")} ui={uiv}><Flags flags={flagsVote} people={people} /></BSheet>}
              </>}

              {showPanel && res && afterStep === "points" && <>
                {phase === "RESULTS" && <div className="bsp" />}
                <ScoreStrip ids={view.players.map((p) => p.id)} lines={res.lines} colorOf={(id) => people.get(id).color} meId={readOnly ? undefined : me} annullati={[...(res.marks?.find((x) => x.effect === "nulli")?.caught ?? []), ...(((res.lui?.trap || res.lui?.effect === "imbroglio") && res.lui.caught) ? res.lui.caught : [])]} sound={sound} interactive={!readOnly} onContinue={() => setAfter({ turn, step: "board" })} />
                {res.objective && <span className="pp-obj" data-testid="objective-result">{res.objective.megaHit ? tx("obj.esito.mega", { n: res.objective.position, cond: objCond(res.objective), v: res.objective.votes, pt: res.objective.pts }) : res.objective.winners.length ? tx("obj.esito.folla", { n: res.objective.position, v: res.objective.votes, pt: res.objective.pts, k: res.objective.winners.length }) : tx("obj.esito.nessuno", { n: res.objective.position, v: res.objective.votes })}</span>}
                <BSheet gold={gold} title={tx("g.punti.t")} sub={txs("g.punti.s", { n: view.turn, tot: view.totalTurns })} ui={uiv}>
                  {readOnly ? <span className="pb-wait">{tx("g.prosegue")}</span> : <Row>{tray}<Btn onClick={() => setAfter({ turn, step: "board" })} testId="points-continue">{tx("g.continua")}</Btn></Row>}
                </BSheet>
              </>}
            </>
          )}
        </div>
      )}
      {animating && !readOnly && <button className="skip" onClick={() => { setSkip((s) => s + 1); apiRef.current?.skip(); }} data-testid="skip">{tx("g.salta")}</button>}
      {showPanel && res && afterStep === "board" && (
        <Standings title={view.goldenGoal ? txs("g.cl.spareggio") : view.roundEnd ? txs("g.cl.giro", { n: Math.min(view.round, view.rounds), tot: view.rounds }) : txs("g.cl")} turn={view.turn} total={view.totalTurns} onClose={() => undefined}
          rows={view.players.map((p) => ({ id: p.id, name: people.get(p.id).name, color: people.get(p.id).color, score: p.score, prev: p.score - (res.points[p.id] ?? 0) }))}
          action={!readOnly && (isMega || isHost || megaBot) ? { label: view.turn >= view.totalTurns ? txs("g.az.finale") : view.roundEnd ? txs("g.az.giro") : txs("g.az.turno"), onClick: () => act({ t: "act", action: { type: "advance" } }) } : { wait: readOnly ? txs("g.az.wait.ro") : txs("g.az.wait") }} />
      )}

      {luiInfo && phase === "VOTE" && <LuiInfo view={view} onClose={() => setLuiInfo(false)} />}
      {zoomPos !== null && ids[zoomPos - 1] && (
        <Zoom cardId={ids[zoomPos - 1]!} pos={zoomPos} total={N} onClose={() => setZoomPos(null)} onNav={setZoomPos}
          actionLabel={phase === "SUSPECT" ? txs("g.zoom.lui", { n: zoomPos }) : txs("g.zoom.vota", { n: zoomPos })} onAction={() => { if (banned(zoomPos)) { setLuiNo(turn); setPick(null); } else setPick(zoomPos); setZoomPos(null); }} />
      )}
      {!intro && !charIntro && luiDraw && <LuiDraw tokens={view.luiTokens} players={view.players.length} propaganda={view.propaganda} sound={sound} onClose={() => { setLuiDraw(false); try { sessionStorage.setItem(drawKey, "1"); } catch { /* */ } }} />}
      {!intro && charIntro && <CharIntro color={people.get(me).color} onClose={() => { setCharIntro(false); try { sessionStorage.setItem(charKey, "1"); } catch { /* */ } }} />}
      {intro && <IntroSlides onClose={() => { setIntro(false); try { localStorage.setItem("gdt.intro", "1"); } catch { /* */ } }} />}
      {megaIntro && <MegaIntro megafonoSa={view.megafonoSa} onClose={(off) => { megaIntroSeen(off); setMegaIntro(false); }} />}
      {noCard && <NoCardNotice onClose={() => { noCardSeen(); setNoCard(false); }} />}
      {hintOn && hint && <><HintBubble onClose={hintClose} onRules={uiv?.rules}>{hint.text}</HintBubble><HintPointer targets={hint.targets} /></>}
    </>
  );
}
