import { useEffect, useState } from "react";
import { useRoom } from "../hooks/useRoom.ts";
import { Disc, PLAYER_COLORS, useFit, navigate } from "../ui.tsx";
import Qr from "../components/Qr.tsx";
import Game from "./Game.tsx";
import MiniGame from "../components/MiniGame.tsx";
import Final from "./Final.tsx";
import { t as tx, ts as txs } from "../lib/testi.ts";
import { MegaIcon } from "../components/MegaIcon.tsx";

/** Schermo condiviso (tablet / PC / TV): sola visione, solo informazioni pubbliche. */
export default function DisplayScreen({ code }: { code: string }) {
  const { status, room, view } = useRoom(code, "watch");
  const k = useFit(2, 372, 826);
  const [, force] = useState(0);
  useEffect(() => { const f = () => force((n) => n + 1); addEventListener("resize", f); return () => removeEventListener("resize", f); }, []);
  const link = `${location.origin}/entra?c=${code}`;
  if (status === "closed" || status === "kicked") return <div className="display center-msg"><h2>{tx("tv.nd")}</h2><p>{tx("tv.nd.x")}</p><a className="lnk" onClick={() => navigate("/")}>{tx("tv.home")}</a></div>;
  return (
    <div className="display" data-testid="display">
      <aside className="side">
        <div className="logo-s">{tx("tv.logo")}</div>
        <div className="pp codepanel"><Qr text={link} size={96} /><div><div className="cap2">{tx("tv.codice")}</div><div className="code-big">{code}</div></div></div>
        <div className="cap2" style={{ color: "#fff" }}>{status === "open" ? (room?.stage === "LOBBY" ? txs("tv.attesa") : room?.stage === "FINISHED" ? txs("tv.conclusa") : txs("tv.corso")) : txs("tv.collego")}</div>
      </aside>
      <main className="center">
        {room && view && room.stage !== "LOBBY" ? (
          <div className="stage-outer" style={{ width: 372 * k, height: 826 * k }}>
            <div className="stage" style={{ transform: `scale(${k})` }}>
              <div className="sky" /><div className="skyg" /><div className="skyh" />
              {view.view.phase === "GAME_OVER" ? <Final room={room} view={view.view} readOnly /> : (view.view.phase.startsWith("MINI") ? <MiniGame room={room} view={view.view} deadline={view.deadline} goAt={view.goAtLocal} send={() => undefined} readOnly sound={false} /> : <Game room={room} view={view.view} deadline={view.deadline} send={() => undefined} readOnly sound={false} />)}
              <div className="vig" /><div className="grain" />
            </div>
          </div>
        ) : <div className="big-wait"><h1>{tx("tv.aspettiamo")}</h1><p>{tx("tv.entra", { codice: code })}</p></div>}
      </main>
      <aside className="side">
        <div className="cap2" style={{ color: "#fff" }}>{tx("tv.giocatori")}</div>
        {(room?.players ?? []).map((p, i) => {
          const v = view?.view.players.find((x) => x.id === p.id);
          return <div className="pl" key={p.id}><Disc color={PLAYER_COLORS[(p.char ?? i) % 8]!} size="l" />{p.nickname}{p.id === view?.view.megafonoId && <> <MegaIcon s={20} /></>}<span className="tg">{v ? txs("tv.pt", { n: v.score < 0 ? "−" + -v.score : v.score }) : p.connected ? txs("tv.online") : txs("tv.offline")}</span></div>;
        })}
      </aside>
    </div>
  );
}
