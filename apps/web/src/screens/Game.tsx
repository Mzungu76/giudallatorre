import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PlayerView, TurnResult } from "@gdt/game-engine";
import type { ClientMessage } from "@gdt/game-protocol";
import { MAX_PHRASE_CHARS } from "@gdt/game-protocol";
import { Btn, Disc, FAST, PLAYER_COLORS, useStage } from "../ui.tsx";
import { cardFull } from "../lib/cards.ts";
import SceneHost from "../components/SceneHost.tsx";
import Standings from "../components/Standings.tsx";
import PointsPanel from "../components/PointsPanel.tsx";
import Zoom from "../components/Zoom.tsx";
import { Climb, Reveal, Terrace } from "../components/Terrace.tsx";
import type { Voter, VoteTok } from "../components/Terrace.tsx";
import { voteTok, luiTok } from "../scene/draw.ts";
import { luiLabel } from "../lib/lui.ts";
import type { LuiSpec, PlayerId } from "@gdt/game-engine";
import type { RoomMsg } from "../hooks/useRoom.ts";
import type { SceneApi } from "../scene/fallScene.ts";
import { IntroSlides, MegaIntro, megaIntroDue, megaIntroSeen } from "../components/Intro.tsx";
import { HintBubble, useIdleHint } from "../components/IdleHint.tsx";
import { BMeta, BSheet, LuiTray, PhrasePill, Row, WaitCard } from "../components/BUi.tsx";
import type { UiCtl } from "../components/BUi.tsx";
import CharIntro from "../components/CharIntro.tsx";
import HandRenewal from "../components/HandRenewal.tsx";
import type { Geo } from "../components/HandRenewal.tsx";

export interface GameProps { room: RoomMsg; view: PlayerView; deadline: number | null; send: (m: ClientMessage) => void; readOnly?: boolean; sound: boolean; ui?: UiCtl }
const TITLES: Record<string, string> = { PROCLAIM: "TOCCA AL MEGAFONO", PLAY: "SCEGLI LA CARTA", SUSPECT: "IL MEGAFONO SCOMMETTE", VOTE: "VOTA IN SEGRETO", RESULTS: "GIÙ DALLA TORRE!", GAME_OVER: "FINE PARTITA" };
const BANNERS: Record<string, [string, string]> = {
  PLAY: ["Scegliete la carta!", "quella che sta meglio sulla torre"],
  SUSPECT: ["Salgono le carte!", "il Megafono sta per scommettere sui voti"],
  VOTE: ["Votate!", "in segreto: chi cade?"],
};
export function usePeople(room: RoomMsg) {
  return useMemo(() => {
    const m = new Map(room.players.map((p, i) => [p.id, { name: p.nickname, color: PLAYER_COLORS[i % 8]!, index: i, bot: !!p.isBot }]));
    return { get: (id: string) => m.get(id) ?? { name: "?", color: "#999", index: 0, bot: false }, all: room.players.map((p, i) => ({ ...p, color: PLAYER_COLORS[i % 8]! })) };
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
      <div className="bhead"><small>{own ? "La tua frase" : "Sei il Megafono"}</small>{own ? "Inventala" : "Scegli cosa urlare"}</div>
      <div className="bscene" style={{ display: "flex", alignItems: "flex-start" }}>
        {!own && <div className="bopts">{card.phrases.map((t, k) => <PhraseOpt key={k} k={k} text={t} theme={card.themes?.[k]} on={sel === k} onPick={() => setSel(k)} />)}</div>}
        {own && (
          <div className="bopts" style={{ gap: 10 }}>
            <div className="phr-fixed" style={{ color: "#fff", textShadow: "2px 2px 0 #13224a" }}>Oggi sale sulla torre…</div>
            <textarea className="phr-in" maxLength={MAX_PHRASE_CHARS} value={text} disabled={voice} onChange={(e) => setText(e.target.value)} placeholder="…chi ha la scusa più creativa" data-testid="phrase-text" aria-label="La tua frase" />
            <div className="hint" style={{ textAlign: "right", margin: 0 }}>{text.length}/{MAX_PHRASE_CHARS}</div>
            <label className="hint" style={{ display: "flex", gap: 8, alignItems: "center", margin: 0 }}><input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} data-testid="phrase-voice" /> La dico a voce, non la scrivo</label>
          </div>
        )}
      </div>
      <BSheet gold title={own ? "LA TUA FRASE" : "SCEGLI LA FRASE"} sub={own ? "Se la dici a voce, gli altri non la leggono." : single ? "Questa carta ha una sola frase." : "Tocca la frase che vuoi urlare, poi Proclama."} ui={ui}>
        <Row>
          {(!single || own) && <Btn kind="pap" onClick={() => setOwn(!own)} style={{ fontSize: 15, padding: "0 12px", flex: "none" }} testId="phrase-free">{own ? "Indietro" : "Ne invento una"}</Btn>}
          <Btn kind="red" disabled={!own && sel === null} onClick={() => (own ? goOwn() : sel !== null && say(sel))} testId="phrase-go">Proclama</Btn>
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
export function HandPicker({ view, send, ui, sound = false, title = "SCEGLI LA CARTA", sub = "Chi lo farebbe di sicuro? La scelta è segreta." }: { view: PlayerView; send: GameProps["send"]; ui?: UiCtl | null; sound?: boolean; title?: string; sub?: React.ReactNode }) {
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
  // All'intervallo la mano è tutta nuova: quando si apre la scelta della carta nell'intervallo lo si mostra con un'animazione
  const renewKey = `gdt.hand.${location.pathname}`;
  const [renew, setRenew] = useState(() => { try { return !FAST && view.phase === "MINI_PLAY" && view.handRenewals > Number(sessionStorage.getItem(renewKey) ?? 0) && !window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } });
  useEffect(() => { if (view.phase === "MINI_PLAY") { try { if (view.handRenewals > Number(sessionStorage.getItem(renewKey) ?? 0) && !renew) sessionStorage.setItem(renewKey, String(view.handRenewals)); } catch { /* */ } } }, [renew, view.phase, view.handRenewals, renewKey]);
  const endRenew = () => { try { sessionStorage.setItem(renewKey, String(view.handRenewals)); } catch { /* */ } setRenew(false); };
  const geo = (i: number): Geo => { const d = i - cur, a = Math.min(3, Math.abs(d)), f = SC[a]!, w = cW * f, h = cH * f, cx = Math.max(w / 2 - cW * 0.15, Math.min(dim.w - w / 2 + cW * 0.15, dim.w / 2 + Math.sign(d) * OFF[a]! * cW)); return { left: cx - w / 2, top: dim.h / 2 - h / 2 + (d === 0 ? -6 : 8), w, h, rot: d * 7 }; };
  const move = (d: number) => { setCur((c) => Math.max(0, Math.min(n - 1, c + d))); setPicked(true); };
  return (
    <>
      <div className="bscene" data-testid="hand">
        <div className="bhand" ref={box} onTouchStart={(e) => { x0.current = e.touches[0]!.clientX; y0.current = e.touches[0]!.clientY; }}
          onTouchEnd={(e) => { const t = e.changedTouches[0]!; if (x0.current !== null && Math.abs(t.clientX - x0.current) > 35 && Math.abs(t.clientX - x0.current) > Math.abs(t.clientY - y0.current) * 1.2) move(t.clientX < x0.current ? 1 : -1); x0.current = null; }}>
          {!renew && hand.map((c, i) => {
            const d = i - cur, a = Math.min(3, Math.abs(d)), f = SC[a]!, w = cW * f, h = cH * f, cx = Math.max(w / 2 - cW * 0.15, Math.min(dim.w - w / 2 + cW * 0.15, dim.w / 2 + Math.sign(d) * OFF[a]! * cW));
            const lifted = picked && d === 0;
            return <button key={c} className={`card ${lifted ? "sel" : ""}${mega ? " gold" : ""}`} data-testid={`hand-card-${i}`} aria-label={`Carta ${i + 1}`}
              style={{ width: w, height: h, left: cx - w / 2, top: dim.h / 2 - h / 2 + (d === 0 ? -6 : 8), backgroundImage: `url(${cardFull(c)})`, transform: `rotate(${d * 7}deg)`, zIndex: 20 - a }}
              onClick={() => { if (d === 0 && picked) setZoom(true); else { setCur(i); setPicked(true); } }} />;
          })}
          <div className="bdots">{!renew && hand.map((_, i) => <i key={i} className={i === cur ? "on" : ""} />)}</div>
          {mega && !renew && n > 0 && <i className="hstamp" style={{ left: geo(cur).left - 6, top: geo(cur).top - 8 }} aria-hidden>📣</i>}
          {renew && <HandRenewal cards={hand} geo={hand.map((_, i) => geo(i))} dim={dim} cW={cW} cH={cH} sound={sound} onDone={endRenew} />}
        </div>
      </div>
      <BSheet gold={mega} title={title} sub={sub} ui={ui}>
        <Row>{ui && <LuiTray view={view} ui={ui} />}<Btn disabled={!picked || renew} onClick={() => picked && !renew && play(cur)} testId="play-card">{picked ? "Gioca questa carta" : "Scegli una carta"}</Btn></Row>
      </BSheet>
      {zoom && picked && (
        <div className="zoom on" role="dialog" data-testid="hand-zoom"><div className="zc"><img className="fullcard" src={cardFull(hand[cur]!)} alt="La tua carta" /></div>
          <div className="zb"><Btn onClick={() => { setZoom(false); play(cur); }}>Gioca questa carta</Btn><Btn kind="pap" onClick={() => setZoom(false)} style={{ fontSize: 18, padding: 10 }}>Indietro</Btn></div></div>
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
  const [zoomPos, setZoomPos] = useState<number | null>(null);
  const [intro, setIntro] = useState(() => { try { return !FAST && !readOnly && localStorage.getItem("gdt.intro") !== "1"; } catch { return false; } });
  const charKey = `gdt.char.${room.code}`;
  const [charIntro, setCharIntro] = useState(() => { try { return !FAST && !readOnly && sessionStorage.getItem(charKey) !== "1" && localStorage.getItem("gdt.nochar") !== "1"; } catch { return false; } });
  const [climbDone, setClimbDone] = useState(0), [revealDone, setRevealDone] = useState(0), [fallDone, setFallDone] = useState(0), [skip, setSkip] = useState(0);
  const [banner, setBanner] = useState<{ k: string; title: string; sub: string } | null>(null);
  const [megaIntro, setMegaIntro] = useState(false), megaShown = useRef(-1);
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
      const extra = phase === "PROCLAIM" && view.goldenGoal ? ["⚡ Spareggio!", "Chi ha più punti vince"] as [string, string] : null;
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
  const canPick = !readOnly && !climbing && (canVote || (phase === "SUSPECT" && isMega));
  const luiShown = phase === "SUSPECT" && isMega && pick ? { pos: pick, spec: null } : view.luiPosition != null ? { pos: view.luiPosition, spec: view.luiSlot ? view.luiTokens.find((x) => x.slot === view.luiSlot) ?? null : null } : null;
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
  const resLui = res?.lui ? { pos: res.lui.position, spec: { slot: res.lui.slot, k: res.lui.k, pts: res.lui.pts } } : null;
  const megaName = people.get(view.megafonoId).name;
  const tag = phase === "PROCLAIM" && view.turn > 1 && !view.goldenGoal && (view.turn - 1) % view.players.length === 0 ? ` · Giro ${view.round}/${view.rounds}` : "";
  const metaEl = <BMeta me={gold} turn={(view.goldenGoal ? "Spareggio" : `Turno ${view.turn}/${view.totalTurns}`) + tag} mega={megaName} deadline={phase !== "RESULTS" ? deadline : null} />;
  const uiv = readOnly ? null : ui ?? null;
  const tray = uiv ? <LuiTray view={view} ui={uiv} /> : null;
  const pill = <PhrasePill phrase={view.phrase} megaName={megaName} />;

  // La scheda «Sei il Megafono!» compare le prime due volte che tocca a te
  useEffect(() => {
    if (phase === "PROCLAIM" && isMega && !readOnly && !FAST && megaShown.current !== turn && !intro && !charIntro && megaIntroDue()) { megaShown.current = turn; setMegaIntro(true); }
  }, [phase, turn, isMega, readOnly, intro, charIntro]);
  // Suggerimento a fumetto: solo se devi agire e resti fermo a lungo
  const hintText: React.ReactNode = readOnly ? null
    : phase === "PROCLAIM" && isMega ? <>Tocca la frase che vuoi urlare, poi premi <b>Proclama</b>. Puoi anche inventarne una.</>
    : phase === "PLAY" && !mine?.hasPlayed && (view.megafonoSa || !isMega) ? <>Scegli il personaggio che somiglia di più alla frase e premi <b>Gioca questa carta</b>. Nessuno vede cosa giochi.</>
    : phase === "SUSPECT" && isMega && !climbing ? <>Tocca la carta su cui scommetti, poi scegli il gettone: più voti scommetti, più punti fai se li prende.</>
    : phase === "VOTE" && canVote && !climbing ? <>Vota la carta che somiglia di più alla frase, anche la tua. Se cade e l’hai votata: <b>+2</b>.</>
    : null;
  const [hintOn, hintClose] = useIdleHint(!!hintText && !animating && !banner && !intro && !charIntro && !megaIntro && zoomPos === null, `${turn}-${phase}`);
  const inPicker = phase === "PROCLAIM" && isMega && !readOnly;
  return (
    <>
      {showFallScene && res && <SceneHost cardIds={ids} cue={{ fallPositions: res.fallenPositions ?? [res.fallenPosition], seed }} sound={sound} onDone={() => setFallDone(turn)} apiRef={apiRef} />}
      {climbing && <Climb cardIds={ids} sound={sound} skip={skip} onDone={() => { setClimbDone(turn); if (!FAST) { const v = phaseRef.current === "VOTE"; setBanner({ k: `${turn}-after`, title: v ? "Votate!" : "Il Megafono scommette", sub: v ? "in segreto: chi cade?" : "quanti voti prenderà?" }); } }} />}
      {!climbing && needTerrace && !revealing && (
        <Terrace cardIds={ids} votes={voteToks} lui={res ? resLui : luiShown} selected={phase === "RESULTS" ? null : pick} onPick={canPick ? (n) => (phase === "SUSPECT" ? setPick(n) : setZoomPos(n)) : undefined} />
      )}
      {revealing && res && (
        <Reveal cardIds={ids} voters={voters} votes={res.votes} counts={res.counts} lui={res.lui} tie={res.tie} tieBreak={res.tieBreak} fallPositions={res.fallenPositions ?? [res.fallenPosition]} megaName={megaName} sound={sound} skip={skip} interactive={!readOnly} onDone={() => setRevealDone(turn)} />
      )}
      {banner && <div className="banner" style={{ top: Math.round(H * 0.3) - dy / 2 }} key={banner.k} data-testid="banner"><b>{banner.title}</b><small>{banner.sub}</small></div>}

      {inPicker && <PhrasePicker view={view} send={act} ui={uiv} meta={metaEl} />}
      {!inPicker && (
        <div className="bl">
          {metaEl}
          {animating ? null : (
            <>
              {phase !== "PROCLAIM" && !(phase === "RESULTS" && showFallScene) && pill}

              {phase === "PROCLAIM" && <>
                <WaitCard text={`${megaName} sta scegliendo la frase.`} sub="Poi scegli dalla tua mano il personaggio che la farebbe." />
                <BSheet gold={gold} title="ATTENDI" sub="Il Megafono sceglie la frase" ui={uiv}>{tray && <Row>{tray}</Row>}</BSheet>
              </>}

              {phase === "PLAY" && !readOnly && !mine?.hasPlayed && (view.megafonoSa || !isMega) && <HandPicker view={view} send={act} ui={uiv ?? undefined} />}
              {phase === "PLAY" && (readOnly || mine?.hasPlayed || (!view.megafonoSa && isMega)) && <>
                <WaitCard text={!readOnly && !view.megafonoSa && isMega ? "Questo turno non giochi carte." : "Carta giocata."} sub={!readOnly && !view.megafonoSa && isMega ? "La Torre ha una carta a caso dal mazzo. Aspettiamo gli altri, poi metti il Lui!." : "Aspettiamo gli altri, poi le carte salgono sulla torre."} />
                <BSheet gold={gold} title="ATTENDI" sub={`${flagsPlay.filter((f) => f.done).length} su ${flagsPlay.length} hanno giocato`} ui={uiv}><Flags flags={flagsPlay} people={people} /></BSheet>
              </>}

              {phase === "SUSPECT" && !climbing && <>
                <div className="bsp" />
                {isMega && !readOnly ? (
                  !pick
                    ? <BSheet gold={gold} title="METTI IL LUI!" sub="Tocca la carta su cui scommetti." ui={uiv}><div data-testid="lui-chooser"><Row>{tray}<Btn disabled>Scegli una carta</Btn></Row></div></BSheet>
                    : <BSheet gold={gold} title={`LUI! SUL N. ${pick}`} sub="Quanti voti prenderà dagli altri? Il tuo non conta." ui={uiv}>
                      <div data-testid="lui-chooser" style={{ display: "grid", gap: 8 }}>
                        <div className="lui-opts">
                          {view.luiTokens.map((sp) => { const left = view.myLuiLeft.includes(sp.slot);
                            return <button key={sp.slot} className={`lk lui-${sp.slot}`} disabled={!left} onClick={() => act({ t: "act", action: { type: "placeLui", slot: sp.slot, position: pick } })} data-testid={`lui-${sp.slot}`}>
                              <span dangerouslySetInnerHTML={{ __html: luiTok(sp, 50) }} /><b>{luiLabel(sp)}</b><small>{left ? `+${sp.pts} punti` : "già usato"}</small></button>; })}
                        </div>
                        <button className="linkbtn" onClick={() => setZoomPos(pick)} data-testid="look-card">Guarda la carta · tocca un’altra per cambiare</button>
                      </div>
                    </BSheet>
                ) : <BSheet gold={gold} title="ATTENDI" sub={`${megaName} sta mettendo il Lui!`} ui={uiv}>{tray && <Row>{tray}</Row>}</BSheet>}
              </>}

              {phase === "VOTE" && !climbing && <>
                <div className="bsp" />
                {readOnly
                  ? <BSheet gold={gold} title="VOTA IN SEGRETO" sub={`${view.players.filter((p) => p.hasVoted).length} su ${view.players.length} hanno votato`} />
                  : canVote
                    ? <BSheet gold={gold} title="VOTA IN SEGRETO" sub="Il più votato cade: chi lo ha votato prende 2 punti." ui={uiv}>
                      <Row>{tray}<Btn disabled={!pick} onClick={() => pick && act({ t: "act", action: { type: "vote", position: pick } })} testId="confirm-vote">{!pick ? "Scegli chi cade" : `Conferma il n. ${pick}`}</Btn></Row>
                    </BSheet>
                    : <BSheet gold={gold} title="VOTO INVIATO" sub="Aspettiamo gli altri." ui={uiv}><Flags flags={flagsVote} people={people} /></BSheet>}
              </>}

              {showPanel && res && afterStep === "points" && <>
                {phase === "RESULTS" && <div className="bsp" />}
                <PointsPanel meId={readOnly ? undefined : me} cardIds={ids} voters={voters} votes={res.votes} lines={res.lines} lui={res.lui} fallPositions={res.fallenPositions ?? [res.fallenPosition]} sound={sound} interactive={!readOnly} hideGo onContinue={() => setAfter({ turn, step: "board" })} />
                <BSheet gold={gold} title="PUNTI DEL TURNO" sub={`Turno ${view.turn} di ${view.totalTurns}`} ui={uiv}>
                  {readOnly ? <span className="pb-wait">Il Megafono prosegue…</span> : <Row>{tray}<Btn onClick={() => setAfter({ turn, step: "board" })} testId="points-continue">Continua ›</Btn></Row>}
                </BSheet>
              </>}
            </>
          )}
        </div>
      )}
      {animating && !readOnly && <button className="skip" onClick={() => { setSkip((s) => s + 1); apiRef.current?.skip(); }} data-testid="skip">Salta ›</button>}
      {showPanel && res && afterStep === "board" && (
        <Standings title={view.goldenGoal ? "Spareggio" : view.roundEnd ? `Fine del giro ${Math.min(view.round, view.rounds)}/${view.rounds}` : "Classifica"} turn={view.turn} total={view.totalTurns} onClose={() => undefined}
          rows={view.players.map((p) => ({ id: p.id, name: people.get(p.id).name, color: people.get(p.id).color, score: p.score, prev: p.score - (res.points[p.id] ?? 0) }))}
          action={!readOnly && (isMega || isHost || megaBot) ? { label: view.turn >= view.totalTurns ? "Vedi la classifica finale" : view.roundEnd ? "Nuovo giro" : "Prossimo turno", onClick: () => act({ t: "act", action: { type: "advance" } }) } : { wait: readOnly ? "Prosegue la partita…" : "Prosegue il Megafono…" }} />
      )}

      {zoomPos !== null && ids[zoomPos - 1] && (
        <Zoom cardId={ids[zoomPos - 1]!} pos={zoomPos} total={N} onClose={() => setZoomPos(null)} onNav={setZoomPos}
          actionLabel={phase === "SUSPECT" ? `Lui! sul n. ${zoomPos}` : `Vota il n. ${zoomPos}`} onAction={() => { setPick(zoomPos); setZoomPos(null); }} />
      )}
      {!intro && charIntro && <CharIntro color={people.get(me).color} onClose={() => { setCharIntro(false); try { sessionStorage.setItem(charKey, "1"); } catch { /* */ } }} />}
      {intro && <IntroSlides onClose={() => { setIntro(false); try { localStorage.setItem("gdt.intro", "1"); } catch { /* */ } }} />}
      {megaIntro && <MegaIntro megafonoSa={view.megafonoSa} onClose={(off) => { megaIntroSeen(off); setMegaIntro(false); }} />}
      {hintOn && hintText && <HintBubble onClose={hintClose} onRules={uiv?.rules}>{hintText}</HintBubble>}
    </>
  );
}
