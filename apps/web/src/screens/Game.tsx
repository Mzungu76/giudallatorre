import { useMemo, useRef, useState } from "react";
import type { PlayerView, TurnResult } from "@gdt/game-engine";
import type { ClientMessage } from "@gdt/game-protocol";
import { Btn, Chips, Countdown, Disc, PLAYER_COLORS } from "../ui.tsx";
import { cardFull } from "../lib/cards.ts";
import SceneHost from "../components/SceneHost.tsx";
import Zoom from "../components/Zoom.tsx";
import type { RoomMsg } from "../hooks/useRoom.ts";
import type { ResultCue, SceneApi } from "../scene/towerScene.ts";

export interface GameProps { room: RoomMsg; view: PlayerView; deadline: number | null; send: (m: ClientMessage) => void; readOnly?: boolean; sound: boolean }
const REASON: Record<string, string> = { voto: "voto giusto", carta: "carta giocata", "lui-cade": "Lui! cade", "lui-non-cade": "Lui! resta su", "lui-fallito": "Lui! sbagliato" };
const TITLES: Record<string, string> = { PROCLAIM: "SU SULLA TORRE", PLAY: "SCEGLI LA CARTA", SUSPECT: "SCEGLI IL SOSPETTO", VOTE: "VOTA IN SEGRETO", RESULTS: "GIÙ DALLA TORRE!", GAME_OVER: "FINE PARTITA" };

export function usePeople(room: RoomMsg) {
  return useMemo(() => {
    const m = new Map(room.players.map((p, i) => [p.id, { name: p.nickname, color: PLAYER_COLORS[i % 8]!, index: i }]));
    return { get: (id: string) => m.get(id) ?? { name: "?", color: "#999", index: 0 }, all: room.players.map((p, i) => ({ ...p, color: PLAYER_COLORS[i % 8]! })) };
  }, [room.players]);
}

function PhraseHead({ phrase }: { phrase: PlayerView["phrase"] }) {
  if (!phrase) return null;
  if (phrase.mode === "free") return <div className="h" style={{ top: 98, fontSize: 34 }}><small>Il Megafono ha urlato…</small>una frase tutta sua!</div>;
  const m = phrase.text.match(/^Oggi (sale|salgono) sulla torre /), pre = m ? m[0] : "Oggi sale sulla torre ";
  const t = phrase.text;
  return m
    ? <div className={`h ${t.length > 80 ? "long" : ""}`} style={{ top: 94 }} data-testid="phrase"><small>{`Oggi ${m![1]} sulla torre…`}</small>{t.slice(pre.length)}</div>
    : <div className={`h ${t.length > 90 ? "xlong" : "long"}`} style={{ top: 94 }} data-testid="phrase"><small>Il Megafono dice…</small>{t}</div>;
}

function Waiting({ text, flags, people }: { text: string; flags: { id: string; done: boolean }[]; people: ReturnType<typeof usePeople> }) {
  return (
    <div className="wait" data-testid="waiting">
      <div className="pp"><b>{text}</b></div>
      <div className="flags">{flags.map((f) => <span key={f.id} className="chip">{<Disc color={people.get(f.id).color} />}{people.get(f.id).name}{f.done ? " ✓" : " …"}</span>)}</div>
    </div>
  );
}

function PhrasePicker({ view, send }: { view: PlayerView; send: GameProps["send"] }) {
  const card = view.proclaimCard!, [i, setI] = useState(0), single = card.phrases.length === 1;
  return (
    <div className="picker" data-testid="phrase-picker">
      <div className="h" style={{ top: 98, fontSize: 34 }}><small>{single ? "Carta a frase singola" : "Scegli la frase"}</small>{single ? "Questa è obbligatoria" : "Cosa urli alla folla?"}</div>
      <div className="opts">
        {card.phrases.map((t, k) => (
          <button key={k} className={`opt ${k === i ? "on" : ""}`} onClick={() => setI(k)} data-testid={`phrase-${k}`}>{single ? <b>{t}</b> : t}</button>
        ))}
        {!single && <div className="or">…oppure inventane una tua e dilla a voce!</div>}
      </div>
      <div className="bottom two">
        {!single && <Btn kind="pap" onClick={() => send({ t: "act", action: { type: "choosePhrase", mode: "free" } })} style={{ fontSize: 17 }} testId="phrase-free">Ne invento una io</Btn>}
        <Btn kind="red" onClick={() => send({ t: "act", action: { type: "choosePhrase", mode: "card", index: i } })} testId="phrase-go">📣 Proclama!</Btn>
      </div>
    </div>
  );
}

function HandPicker({ view, send }: { view: PlayerView; send: GameProps["send"] }) {
  const hand = view.myHand, [sel, setSel] = useState<number | null>(null), [zoom, setZoom] = useState(false);
  const step = Math.min(66, (372 - 104 - 16) / Math.max(1, hand.length - 1)), left0 = (372 - (104 + step * (hand.length - 1))) / 2;
  const play = (idx: number) => send({ t: "act", action: { type: "playCard", cardId: hand[idx]! } });
  return (
    <div className="picker" data-testid="hand">
      <div className="hint-top">tocca una carta, poi toccala ancora per vederla bene</div>
      {hand.map((c, i) => {
        const mid = (hand.length - 1) / 2, d = i - mid, lifted = sel === i;
        return <button key={c} className={`card ${lifted ? "sel" : ""}`} data-testid={`hand-card-${i}`} aria-label={`Carta ${i + 1}`}
          style={{ left: left0 + step * i, top: 440 + d * d * 7 - (lifted ? 34 : 0), backgroundImage: `url(${cardFull(c)})`, transform: `rotate(${d * 6}deg)`, zIndex: 10 + i + (lifted ? 20 : 0) }}
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

function ResultPanel({ res, people, canAdvance, deadline, onAdvance, final }: { res: TurnResult; people: ReturnType<typeof usePeople>; canAdvance: boolean; deadline: number | null; onAdvance: () => void; final: boolean }) {
  const ids = people.all.map((p) => p.id), compact = ids.length > 6;
  return (
    <div className={`panel on ${compact ? "c8" : ""}`} data-testid="result-panel">
      <h3>{res.tie ? "Pareggio: cade il voto del Megafono" : "Giù dalla torre!"}</h3>
      <div>{ids.map((id) => {
        const pts = res.points[id] ?? 0, why = (res.reasons[id] ?? []).map((r) => REASON[r] ?? r).join(" + ");
        return <div className="row on" key={id}><Disc color={people.get(id).color} />{people.get(id).name}<small>{why || "—"}</small><em>{pts > 0 ? `+${pts}` : pts < 0 ? `−${Math.abs(pts)}` : "0"}</em></div>;
      })}</div>
      {canAdvance
        ? <Btn onClick={onAdvance} testId="advance" style={{ marginTop: 8, padding: 11, fontSize: 21 }}>{final ? "Vedi la classifica" : "Prossimo turno"}</Btn>
        : <div className="hint" style={{ marginTop: 8 }}>Prosegue il Megafono… <Countdown deadline={deadline} /></div>}
    </div>
  );
}

export default function Game({ room, view, deadline, send, readOnly, sound }: GameProps) {
  const people = usePeople(room), me = view.viewerId, isMega = me === view.megafonoId, isHost = room.hostId === me;
  const [pick, setPick] = useState<number | null>(null), [kind, setKind] = useState<"CADE" | "NON_CADE">("CADE");
  const [zoomPos, setZoomPos] = useState<number | null>(null), [done, setDone] = useState<string>("");
  const apiRef = useRef<SceneApi | null>(null);
  const tower = [...view.tower].sort((a, b) => a.position - b.position), ids = tower.map((t) => t.cardId), N = ids.length;
  const mine = view.players.find((p) => p.id === me);
  const turnKey = `${view.turn}`;
  const phase = view.phase, showScene = N > 0 && (phase === "SUSPECT" || phase === "VOTE" || phase === "RESULTS");
  const res = phase === "RESULTS" ? view.lastResult : null;
  const cue: ResultCue | null = useMemo(() => {
    if (!res) return null;
    const tokens = Object.entries(res.votes).map(([id, pos]) => ({ pos, color: people.get(id).color, label: String(pos), name: people.get(id).name }));
    const nv = res.counts[res.fallenPosition] ?? 0;
    let h = 7; for (const c of room.code) h = (h * 31 + c.charCodeAt(0)) | 0;
    return { fallPos: res.fallenPosition, tokens, lui: res.lui ? { pos: res.lui.position, kind: res.lui.kind } : null, seed: Math.abs(h) + view.turn,
      stampTitle: res.tie ? "Pareggio!" : `Più votato: n. ${res.fallenPosition}`, stampSub: res.tie ? `cade il n. ${res.fallenPosition}: scelta del Megafono` : `${nv} voti su ${view.players.length}${res.lui && res.lui.kind === "CADE" && res.lui.position === res.fallenPosition ? " · cade lui!" : ""}` };
  }, [res, turnKey]); // eslint-disable-line
  const finishedAnim = done === turnKey;
  const luiForScene = phase === "SUSPECT" && isMega && pick ? { pos: pick, kind } : view.luiPosition != null && phase === "VOTE" ? { pos: view.luiPosition, kind: view.luiKind } : null;
  const canVote = phase === "VOTE" && !readOnly && view.myVote === null;
  const onPick = (pos: number) => { if (!readOnly && (canVote || (phase === "SUSPECT" && isMega))) setZoomPos(pos); };

  const flagsPlay = view.players.filter((p) => view.megafonoSa || p.id !== view.megafonoId).map((p) => ({ id: p.id, done: p.hasPlayed }));
  const flagsVote = view.players.map((p) => ({ id: p.id, done: p.hasVoted }));
  const act = (a: ClientMessage) => send(a);

  return (
    <>
      {showScene && <SceneHost cardIds={ids} selected={phase === "RESULTS" ? null : pick} tokens={[]} lui={luiForScene} cue={cue} cueKey={turnKey} sound={sound} onPick={onPick} onDone={() => setDone(turnKey)} apiRef={apiRef} />}
      <Chips left={<><Disc color={people.get(me).color} />{readOnly ? "Schermo condiviso" : people.get(me).name}</>} mid={<>📣 {people.get(view.megafonoId).name}</>} right={view.goldenGoal ? "⚡ Spareggio" : `Turno ${view.turn}/${view.totalTurns}`} />
      <div className="strip" data-testid="strip">★ {view.goldenGoal && phase === "PROCLAIM" ? "SPAREGGIO: GOLDEN GOAL" : isMega && phase === "PROCLAIM" ? "SEI IL MEGAFONO" : TITLES[phase]} ★</div>
      {deadline && phase !== "RESULTS" && <div className="cd"><Countdown deadline={deadline} /></div>}
      {phase !== "PROCLAIM" && phase !== "RESULTS" && <PhraseHead phrase={view.phrase} />}

      {phase === "PROCLAIM" && (isMega && !readOnly ? <PhrasePicker view={view} send={act} /> : <Waiting text={`${people.get(view.megafonoId).name} sta scegliendo cosa urlare dal Megafono…`} flags={[]} people={people} />)}
      {phase === "PLAY" && !readOnly && !mine?.hasPlayed && (view.megafonoSa || !isMega) && <HandPicker view={view} send={act} />}
      {phase === "PLAY" && (readOnly || mine?.hasPlayed || (!view.megafonoSa && isMega)) && <Waiting text={!readOnly && !view.megafonoSa && isMega ? "Hai pescato la tua carta dal mazzo. Aspetta la Folla…" : "Carta giocata, in attesa degli altri…"} flags={flagsPlay} people={people} />}

      {phase === "SUSPECT" && (isMega && !readOnly ? (
        <>
          <div className="luiui">
            <button className={`lk red ${kind === "CADE" ? "on" : ""}`} onClick={() => setKind("CADE")} data-testid="kind-cade">Cade lui!<small>+4 se cade</small></button>
            <button className={`lk ${kind === "NON_CADE" ? "on" : ""}`} onClick={() => setKind("NON_CADE")} data-testid="kind-non">Non cade<small>+1 se resta su</small></button>
          </div>
          <div className="bottom"><Btn disabled={!pick} onClick={() => pick && act({ t: "act", action: { type: "placeLui", kind, position: pick } })} testId="place-lui">{pick ? `Posa il Lui! sul n. ${pick}` : "Tocca un personaggio"}</Btn></div>
        </>
      ) : <div className="bottom"><div className="pp mini">{people.get(view.megafonoId).name} sta posando il “Lui!”…</div></div>)}

      {phase === "VOTE" && !readOnly && (canVote
        ? <div className="bottom"><div className="hint-bottom">tocca un personaggio per vederlo bene</div><Btn disabled={!pick} onClick={() => pick && act({ t: "act", action: { type: "vote", position: pick } })} testId="confirm-vote">{pick ? `Conferma il n. ${pick}` : "Scegli chi cade"}</Btn></div>
        : <Waiting text="Voto inviato 🔒 Aspettiamo gli altri…" flags={flagsVote} people={people} />)}
      {phase === "VOTE" && readOnly && <div className="bottom"><div className="pp mini">{view.players.filter((p) => p.hasVoted).length} su {view.players.length} hanno votato</div></div>}

      {phase === "RESULTS" && res && !finishedAnim && !readOnly && <button className="skip" onClick={() => apiRef.current?.skip()} data-testid="skip">Salta ›</button>}
      {phase === "RESULTS" && res && finishedAnim && (
        <ResultPanel res={res} people={people} canAdvance={!readOnly && (isMega || isHost)} deadline={deadline} final={view.turn >= view.totalTurns}
          onAdvance={() => act({ t: "act", action: { type: "advance" } })} />
      )}

      {zoomPos !== null && ids[zoomPos - 1] && (
        <Zoom cardId={ids[zoomPos - 1]!} pos={zoomPos} total={N} onClose={() => setZoomPos(null)} onNav={setZoomPos}
          actionLabel={phase === "SUSPECT" ? `Il Lui! va sul n. ${zoomPos}` : `Voto il n. ${zoomPos}`} onAction={() => { setPick(zoomPos); setZoomPos(null); }} />
      )}
    </>
  );
}
