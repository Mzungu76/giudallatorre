import { useEffect, useState } from "react";
import { useRoom } from "../hooks/useRoom.ts";
import { Disc, PLAYER_COLORS, useFit, navigate } from "../ui.tsx";
import Qr from "../components/Qr.tsx";
import Game from "./Game.tsx";
import MiniGame from "../components/MiniGame.tsx";
import Final from "./Final.tsx";

/** Schermo condiviso (tablet / PC / TV): sola visione, solo informazioni pubbliche. */
export default function DisplayScreen({ code }: { code: string }) {
  const { status, room, view } = useRoom(code, "watch");
  const k = useFit(2, 372, 826);
  const [, force] = useState(0);
  useEffect(() => { const f = () => force((n) => n + 1); addEventListener("resize", f); return () => removeEventListener("resize", f); }, []);
  const link = `${location.origin}/entra?c=${code}`;
  if (status === "closed" || status === "kicked") return <div className="display center-msg"><h2>Stanza non disponibile</h2><p>Controlla il codice o attiva lo schermo condiviso nella stanza.</p><a className="lnk" onClick={() => navigate("/")}>Torna alla home</a></div>;
  return (
    <div className="display" data-testid="display">
      <aside className="side">
        <div className="logo-s">GIÙ DALLA TORRE!</div>
        <div className="pp codepanel"><Qr text={link} size={96} /><div><div className="cap2">Codice</div><div className="code-big">{code}</div></div></div>
        <div className="cap2" style={{ color: "#fff" }}>{status === "open" ? (room?.stage === "LOBBY" ? "In attesa dell'avvio…" : room?.stage === "FINISHED" ? "Partita conclusa" : "Partita in corso") : "Mi collego…"}</div>
      </aside>
      <main className="center">
        {room && view && room.stage !== "LOBBY" ? (
          <div className="stage-outer" style={{ width: 372 * k, height: 826 * k }}>
            <div className="stage" style={{ transform: `scale(${k})` }}>
              <div className="sky" /><div className="skyg" /><div className="skyh" />
              {view.view.phase === "GAME_OVER" ? <Final room={room} view={view.view} readOnly /> : (view.view.phase.startsWith("MINI") ? <MiniGame room={room} view={view.view} deadline={view.deadline} send={() => undefined} readOnly sound={false} /> : <Game room={room} view={view.view} deadline={view.deadline} send={() => undefined} readOnly sound={false} />)}
              <div className="vig" /><div className="grain" />
            </div>
          </div>
        ) : <div className="big-wait"><h1>Aspettiamo i giocatori</h1><p>Entra da telefono con il codice <b>{code}</b></p></div>}
      </main>
      <aside className="side">
        <div className="cap2" style={{ color: "#fff" }}>Giocatori</div>
        {(room?.players ?? []).map((p, i) => {
          const v = view?.view.players.find((x) => x.id === p.id);
          return <div className="pl" key={p.id}><Disc color={PLAYER_COLORS[i % 8]!} size="l" />{p.nickname}{p.id === view?.view.megafonoId ? " 📣" : ""}<span className="tg">{v ? `${v.score < 0 ? "−" + -v.score : v.score} pt` : p.connected ? "online" : "offline"}</span></div>;
        })}
      </aside>
    </div>
  );
}
