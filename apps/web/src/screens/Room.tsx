import { useEffect, useRef, useState } from "react";
import { CHAR_COLORS, tokenUrl } from "../lib/characters.ts";
import BotProfile from "../components/BotProfile.tsx";
import type { ProfileData } from "../components/BotProfile.tsx";
import { Stage, Btn, Disc, Toast, navigate, PLAYER_COLORS, colorFor } from "../ui.tsx";
import { useRoom } from "../hooks/useRoom.ts";
import type { RoomMsg } from "../hooks/useRoom.ts";
import Qr from "../components/Qr.tsx";
import Game from "./Game.tsx";
import MiniGame from "../components/MiniGame.tsx";
import ChatPanel, { useChatState } from "../components/Chat.tsx";
import HowTo from "../components/HowTo.tsx";
import HelpMenu from "../components/HelpMenu.tsx";
import { IntroSlides } from "../components/Intro.tsx";
import { HintBubble, HintPointer } from "../components/IdleHint.tsx";
import { hintFor } from "../lib/hints.tsx";
import Standings from "../components/Standings.tsx";
import { LuiPopup, type UiCtl } from "../components/BUi.tsx";
import type { ChatDto } from "@gdt/game-protocol";
import Final from "./Final.tsx";
import { forgetSession } from "../lib/session.ts";
import type { ClientMessage } from "@gdt/game-protocol";
import type { ReactNode } from "react";
import type { PlayerView } from "@gdt/game-engine";
import { t as tx, ts as txs } from "../lib/testi.ts";
import type { TestoKey } from "../lib/testi.ts";
import { MegaIcon } from "../components/MegaIcon.tsx";

/** Su schermi larghi la partita sta al centro di una plancia con codice a sinistra e giocatori a destra. */
function Plancia({ room, view, children }: { room: RoomMsg; view: PlayerView | null; children: ReactNode }) {
  const list = view ? view.players.map((p) => ({ id: p.id, name: p.name, score: p.score })) : room.players.map((p) => ({ id: p.id, name: p.nickname, score: null as number | null }));
  return (
    <div className="plancia">
      <aside className="pside l" aria-hidden><div className="plogo">{tx("room.logo1")}<b>{tx("room.logo2")}</b></div><div className="pp pcode"><small>{tx("room.codice.lab")}</small><strong>{room.code}</strong></div></aside>
      {children}
      <aside className="pside r"><div className="pp pplayers"><h4>{tx("room.giocatori")}</h4>{list.map((p, i) => <div className="prow" key={p.id}><Disc color={colorFor(room.players, p.id)} />{p.name}{p.id === view?.megafonoId && <> <MegaIcon s={16} /></>}{p.score !== null && <b>{p.score < 0 ? `−${-p.score}` : p.score}</b>}</div>)}</div></aside>
    </div>
  );
}
function useSound() {
  const [on, setOn] = useState(() => { try { return localStorage.getItem("gdt.sound") !== "0"; } catch { return true; } });
  return [on, (v: boolean) => { setOn(v); try { localStorage.setItem("gdt.sound", v ? "1" : "0"); } catch { /* */ } }] as const;
}

const lv = (l: "easy" | "medium" | "hard") => txs(`room.lv.${l}` as TestoKey);
/** Fascia d'età del gruppo: il mazzo contiene solo frasi adatte a quell'età o meno. */
const AGES = [6, 10, 14, 18] as const;
const ageLabel = (v: number) => (AGES as readonly number[]).includes(v) ? txs(`room.age.${v}` as TestoKey) : `${v}+`;
function Lobby({ room, send, ui, overlays }: { room: RoomMsg; send: (m: ClientMessage) => void; ui: UiCtl; overlays: ReactNode }) {
  const me = room.you, host = room.hostId === me, link = `${location.origin}/entra?c=${room.code}`, o = room.options;
  const [copied, setCopied] = useState(false), [prof, setProf] = useState<ProfileData | null>(null);
  async function share() {
    try { if (navigator.share) { await navigator.share({ title: txs("room.share.titolo"), text: txs("room.share.testo", { codice: room.code }), url: link }); return; } } catch { /* annullato */ }
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* */ }
  }
  return (
    <Stage bg="sky" testId="lobby">
      <div className="bl">
        <div className="blt">
          <span className="chip nb">{txs("room.lobby", { n: room.players.length })}</span>
          <button className="bib big" onClick={ui.chat} aria-label={ui.unread ? txs("room.chat.n", { n: ui.unread }) : txs("room.chat")} data-testid="chat-open">💬{ui.unread > 0 && <i data-testid="chat-unread">{ui.unread > 9 ? "9+" : ui.unread}</i>}</button>
        </div>
        <div className="pp codepanel bc cp2">
          <div className="cap2">{tx("room.codice")}</div>
          <div className="code-big" data-testid="room-code">{room.code.split("").map((ch, i) => <span key={i}>{ch}</span>)}</div>
          <div className="cp-row"><a className="lnk" role="button" tabIndex={0} onClick={share} data-testid="share">{copied ? tx("room.copiato") : tx("room.condividi")}</a><Qr text={link} size={72} /></div>
        </div>
        <div className="ptiles">
          {room.players.map((p, i) => (
            <div className={`ptile${p.id === me ? " me" : ""}`} key={p.id} data-testid="player-row" role="button" tabIndex={0} onClick={() => setProf({ nickname: p.nickname, char: (p.char ?? i) % 8, ...(p.isBot ? { bot: true, level: p.level ?? "medium", style: p.style } : {}) })}>
              <img src={tokenUrl(CHAR_COLORS[(p.char ?? i) % 8]!)} alt="" />
              <span className="nmx">{p.id === me ? txs("room.tu", { nome: p.nickname }) : p.nickname}</span>
              {p.isHost && <span className="tg">{tx("room.host")}</span>}{p.isBot && <span className="bot-tag" data-testid="bot-tag">{txs("room.bot", { lv: lv(p.level ?? "medium") })}</span>}{p.isBot && p.style && <small className="dbg-st">{p.style}</small>}{!p.isBot && !p.connected && <span className="off">{tx("room.offline")}</span>}
              {host && p.id !== me && <button className="x" aria-label={p.isBot ? txs("room.togli", { nome: p.nickname }) : txs("room.espelli", { nome: p.nickname })} onClick={(e) => { e.stopPropagation(); send(p.isBot ? { t: "removeBot", playerId: p.id } : { t: "kick", playerId: p.id }); }} data-testid={p.isBot ? "remove-bot" : "kick"}>×</button>}
            </div>
          ))}
          {Array.from({ length: Math.max(0, Math.min(6, Math.max(3, room.players.length + 1)) - room.players.length) }).map((_, i) => <div className="ptile em" key={`e${i}`}><i /><span className="nmx">{i === 0 ? tx("room.attesa.altri") : ""}</span></div>)}
        </div>
        <div className="bsp" />
        <div className="pp bsheet lob">
          <span className="bgrip" />
          <div className="wsum lsum" data-testid="age-info">
            <span>{o.mode === "remote" ? tx("fm.distanza") : tx("fm.tavolo")}</span><span>{txs(`room.age.${o.ageBand}` as TestoKey)}</span><span>{o.turnTimerSec === 0 ? tx("fm.w.libero") : txs("fm.w.sec", { n: o.turnTimerSec })}</span>
          </div>
          {host
            ? <Btn disabled={room.players.length < 3} onClick={() => send({ t: "start" })} testId="start">{room.players.length < 3 ? tx("room.servono") : tx("room.avvia")}</Btn>
            : <div className="pp mini">{tx("room.aspetta.host")}</div>}
          <div className="blnks">
            <a className="lnk" onClick={() => window.open(`/schermo/${room.code}`, "_blank")} role="button" tabIndex={0}>{tx("room.schermo")}</a>
            <a className="lnk" onClick={() => { send({ t: "leave" }); forgetSession(room.code); navigate("/"); }} role="button" tabIndex={0}>{tx("room.esci")}</a>
          </div>
        </div>
      </div>
      {prof && <BotProfile p={prof} onClose={() => setProf(null)} />}
      {overlays}
    </Stage>
  );
}

export default function RoomScreen({ code }: { code: string }) {
  const { status, room, view, error, send, chat } = useRoom(code, "player");
  const [sound, setSound] = useSound();
  const [notice, setNotice] = useState<string | null>(null), botsSeen = useRef<Set<string> | null>(null);
  // un giocatore esce a partita in corso e un bot prende il suo posto: lo dico a chi resta
  useEffect(() => {
    if (!room) return;
    const now = new Set(room.players.filter((p) => p.isBot).map((p) => p.id)), prev = botsSeen.current;
    botsSeen.current = now;
    if (!prev || room.stage !== "PLAYING") return;
    const left = room.players.filter((p) => p.isBot && !prev.has(p.id));
    if (left.length === 0) return;
    setNotice(txs(left.length > 1 ? "room.left.piu" : "room.left.uno", { nomi: left.map((p) => p.nickname).join(", ") }));
    const t = setTimeout(() => setNotice(null), 4500); return () => clearTimeout(t);
  }, [room]);
  const cs = useChatState(chat, room?.you ?? "", sound), [ov, setOv] = useState<null | "chat" | "rank" | "rules" | "lui" | "help" | "tutorial">(null);
  // «Cosa devo fare adesso?»: il suggerimento con la freccia, su richiesta; sparisce quando cambia la situazione
  const [manual, setManual] = useState(false), vv = view?.view;
  useEffect(() => { setManual(false); }, [vv?.phase, vv?.turn, vv?.myVote, vv?.players.find((p) => p.id === vv.viewerId)?.hasPlayed]);
  useEffect(() => { if (status === "invalid") { forgetSession(code); navigate(`/entra?c=${code}`); } }, [status, code]);
  if (status === "kicked") return <Stage bg="sky" testId="kicked"><div className="center-msg"><h2>{tx("room.kicked.t")}</h2><p>{tx("room.kicked.x")}</p><Btn onClick={() => { forgetSession(code); navigate("/"); }}>{tx("room.home")}</Btn></div></Stage>;
  if (status === "closed" && !room) return <Stage bg="sky"><div className="center-msg"><h2>{tx("room.closed.t")}</h2><p>{tx("room.closed.x")}</p><Btn onClick={() => navigate("/")}>{tx("room.home")}</Btn></div></Stage>;
  if (!room) return <Stage bg="sky" testId="loading"><div className="center-msg"><h2>{tx("room.collego")}</h2></div></Stage>;
  const reconnecting = status === "reconnecting";
  const close = () => { setOv(null); cs.setOpen(false); };
  const ui: UiCtl = { unread: cs.unread, chat: () => { setOv("chat"); cs.setOpen(true); }, rank: () => setOv("rank"), rules: () => setOv("help"), lui: () => setOv("lui") };
  const pv = view?.view ?? null, colorOf = (id: string) => colorFor(room.players, id);
  const leave = () => { send({ t: "leave" }); forgetSession(code); navigate("/"); };
  const leaveHint = room.players.some((p) => !p.isBot && p.id !== room.you) ? txs("room.leave.bot") : txs("room.leave.ultimo");
  const overlays = ov === "chat" ? <ChatPanel chat={chat} me={room.you} players={room.players} send={send} onClose={close} />
    : ov === "help" ? <HelpMenu canHint={!!(pv && hintFor(pv))} sound={sound} setSound={setSound} onHint={() => { setOv(null); setManual(true); }} onTutorial={() => setOv("tutorial")} onRules={() => setOv("rules")} onClose={close}
        {...(room.stage === "PLAYING" ? { onLeave: leave, leaveHint } : {})} />
    : ov === "tutorial" ? <IntroSlides onClose={() => setOv("help")} />
    : ov === "rules" ? <HowTo onClose={() => setOv("help")} tokens={pv?.luiTokens} gregge={pv?.gregge} sound={sound} setSound={setSound}
        {...(room.stage === "PLAYING" ? { onLeave: leave, leaveHint } : {})} />
    : ov === "lui" && pv ? <LuiPopup view={pv} onClose={close} />
    : ov === "rank" && pv ? <Standings turn={pv.turn} total={pv.totalTurns} onClose={close} rows={pv.players.map((p) => ({ id: p.id, name: p.name, color: colorOf(p.id), score: p.score }))} />
    : null;
  if (room.stage === "LOBBY") return <><Plancia room={room} view={null}><Lobby room={room} send={send} ui={ui} overlays={overlays} /></Plancia>{reconnecting && <div className="banner-conn">{tx("room.riconnessione")}</div>}<Toast text={error ?? notice} /></>;
  if (!view) return <Stage bg="sky"><div className="center-msg"><h2>{tx("room.carico")}</h2></div></Stage>;
  return (
    <Plancia room={room} view={view.view}>
    <Stage bg="sky" testId="game">
      {view.view.phase === "GAME_OVER" ? <Final room={room} view={view.view} sound={sound} ui={ui} send={send} /> : (view.view.phase.startsWith("MINI") ? <MiniGame room={room} view={view.view} deadline={view.deadline} goAt={view.goAtLocal} send={send} sound={sound} ui={ui} /> : <Game room={room} view={view.view} deadline={view.deadline} send={send} sound={sound} ui={ui} />)}
      {overlays}
      {manual && pv && ((h) => h ? <><HintBubble onClose={() => setManual(false)}>{h.text}</HintBubble><HintPointer targets={h.targets} /></> : null)(hintFor(pv))}
      {reconnecting && <div className="banner-conn">{tx("room.riconnessione")}</div>}
      <Toast text={error ?? notice} />
    </Stage>
    </Plancia>
  );
}
