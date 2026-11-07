import { useEffect, useState } from "react";
import { Stage, Btn, Chips, Disc, Toast, navigate, PLAYER_COLORS } from "../ui.tsx";
import { useRoom } from "../hooks/useRoom.ts";
import type { RoomMsg } from "../hooks/useRoom.ts";
import Qr from "../components/Qr.tsx";
import Game from "./Game.tsx";
import Chat from "../components/Chat.tsx";
import type { ChatDto } from "@gdt/game-protocol";
import Final from "./Final.tsx";
import { forgetSession } from "../lib/session.ts";
import type { ClientMessage } from "@gdt/game-protocol";

function useSound() {
  const [on, setOn] = useState(() => { try { return localStorage.getItem("gdt.sound") !== "0"; } catch { return true; } });
  return [on, (v: boolean) => { setOn(v); try { localStorage.setItem("gdt.sound", v ? "1" : "0"); } catch { /* */ } }] as const;
}

const LV = { easy: "facile", medium: "medio", hard: "difficile" } as const;
function Lobby({ room, send, chat }: { room: RoomMsg; send: (m: ClientMessage) => void; chat: ChatDto[] }) {
  const me = room.you, host = room.hostId === me, link = `${location.origin}/entra?c=${room.code}`, o = room.options;
  const [copied, setCopied] = useState(false);
  async function share() {
    try { if (navigator.share) { await navigator.share({ title: "Giù dalla Torre", text: `Entra nella mia partita: codice ${room.code}`, url: link }); return; } } catch { /* annullato */ }
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* */ }
  }
  return (
    <Stage bg="sky" testId="lobby">
      <Chat chat={chat} me={me} players={room.players} send={send} />
      <Chips left="Lobby" right={`${room.players.length}/8 giocatori`} />
      <div className="pp codepanel">
        <Qr text={link} />
        <div><div className="cap2">Codice</div><div className="code-big" data-testid="room-code">{room.code}</div><a className="lnk" role="button" tabIndex={0} onClick={share} data-testid="share">{copied ? "Link copiato ✓" : "Condividi il link"}</a></div>
      </div>
      <div className="plist">
        {room.players.map((p, i) => (
          <div className="pl" key={p.id} data-testid="player-row"><Disc color={PLAYER_COLORS[i % 8]!} size="l" />{p.nickname}{p.id === me ? " (tu)" : ""}
            {p.isHost && <span className="tg">HOST</span>}{p.isBot && <span className="bot-tag" data-testid="bot-tag">BOT · {LV[p.level ?? "medium"]}</span>}{!p.isBot && !p.connected && <span className="off">offline</span>}
            {host && p.id !== me && <button className="x" aria-label={p.isBot ? `Togli ${p.nickname}` : `Espelli ${p.nickname}`} onClick={() => send(p.isBot ? { t: "removeBot", playerId: p.id } : { t: "kick", playerId: p.id })} data-testid={p.isBot ? "remove-bot" : "kick"}>×</button>}</div>
        ))}
        {Array.from({ length: Math.max(0, 8 - room.players.length) }, (_, i) => <div className="pl em" key={i}>{i === 0 ? "In attesa di altri giocatori…" : ""}</div>)}
      </div>
      <div className="lobby-bottom">
        {host && (
          <div className="opts-row">
            <label>Timer <select value={o.turnTimerSec} onChange={(e) => send({ t: "setOptions", turnTimerSec: Number(e.target.value) as 0 })} data-testid="opt-timer">
              <option value={0}>nessuno</option><option value={30}>30 s</option><option value={60}>60 s</option><option value={90}>90 s</option><option value={120}>120 s</option></select></label>
          </div>
        )}
        <a className="lnk" onClick={() => window.open(`/schermo/${room.code}`, "_blank")} role="button" tabIndex={0}>Apri lo schermo condiviso (tablet / PC)</a>
        {host
          ? <Btn disabled={room.players.length < 3} onClick={() => send({ t: "start" })} testId="start">{room.players.length < 3 ? "Servono 3 giocatori" : "Avvia partita"}</Btn>
          : <div className="pp mini">Aspetta che l'host avvii la partita…</div>}
        <a className="lnk" onClick={() => { send({ t: "leave" }); forgetSession(room.code); navigate("/"); }} role="button" tabIndex={0}>Esci dalla stanza</a>
      </div>
    </Stage>
  );
}

export default function RoomScreen({ code }: { code: string }) {
  const { status, room, view, error, send, chat } = useRoom(code, "player");
  const [sound, setSound] = useSound();
  useEffect(() => { if (status === "invalid") { forgetSession(code); navigate(`/entra?c=${code}`); } }, [status, code]);
  if (status === "kicked") return <Stage bg="sky" testId="kicked"><div className="center-msg"><h2>Sei stato espulso</h2><p>L'host ti ha tolto dalla stanza.</p><Btn onClick={() => { forgetSession(code); navigate("/"); }}>Torna alla home</Btn></div></Stage>;
  if (status === "closed" && !room) return <Stage bg="sky"><div className="center-msg"><h2>Stanza chiusa</h2><p>La stanza non esiste più o è aperta su un altro dispositivo.</p><Btn onClick={() => navigate("/")}>Torna alla home</Btn></div></Stage>;
  if (!room) return <Stage bg="sky" testId="loading"><div className="center-msg"><h2>Mi collego…</h2></div></Stage>;
  const reconnecting = status === "reconnecting";
  if (room.stage === "LOBBY") return <><Lobby room={room} send={send} chat={chat} />{reconnecting && <div className="banner-conn">Riconnessione…</div>}<Toast text={error} /></>;
  if (!view) return <Stage bg="sky"><div className="center-msg"><h2>Carico la partita…</h2></div></Stage>;
  return (
    <Stage bg="sky" testId="game">
      {view.view.phase === "GAME_OVER" ? <Final room={room} view={view.view} /> : <Game room={room} view={view.view} deadline={view.deadline} send={send} sound={sound} />}
      <Chat chat={chat} me={room.you} players={room.players} send={send} />
      <button className="snd" aria-label={sound ? "Disattiva i suoni" : "Attiva i suoni"} onClick={() => setSound(!sound)}>{sound ? "🔊" : "🔇"}</button>
      {reconnecting && <div className="banner-conn">Riconnessione…</div>}
      <Toast text={error} />
    </Stage>
  );
}
