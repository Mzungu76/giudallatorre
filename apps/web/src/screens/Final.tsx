import type { PlayerView } from "@gdt/game-engine";
import { Btn, Disc, navigate } from "../ui.tsx";
import { forgetSession } from "../lib/session.ts";
import { usePeople } from "./Game.tsx";
import type { RoomMsg } from "../hooks/useRoom.ts";

export default function Final({ room, view, readOnly }: { room: RoomMsg; view: PlayerView; readOnly?: boolean }) {
  const people = usePeople(room);
  const rank = [...view.players].sort((a, b) => b.score - a.score);
  const win = new Set(view.winners ?? []), pts = (n: number) => (n < 0 ? `−${-n}` : String(n));
  const top = rank.slice(0, 3);
  return (
    <div className="final" data-testid="final">
      {Array.from({ length: 34 }, (_, i) => <i key={i} className="confetti" style={{ left: (i * 53) % 360, top: 60 + ((i * 97) % 420), width: 8 + (i % 3) * 3, height: 5 + (i % 4) * 2, background: ["#e8362b", "#ffc72c", "#14a3a1", "#fff7e0", "#ff7aa8"][i % 5], transform: `rotate(${i * 37}deg)` }} />)}
      <div className="h" style={{ top: 46, textAlign: "center", left: 0, right: 0, fontSize: 52 }}><small>{win.size > 1 ? "Vittoria condivisa!" : "Ha vinto…"}</small>Gran<br />Megafono!</div>
      <div className="pod">
        {top.map((p, i) => (
          <div key={p.id} className={`pod-${i}`} style={{ height: [150, 118, 90][i] }}>
            {win.has(p.id) && <span style={{ fontSize: 30 }}>👑</span>}<Disc color={people.get(p.id).color} size="xl" />{p.name}<span style={{ fontSize: [30, 24, 22][i] }}>{pts(p.score)}</span>
          </div>
        ))}
      </div>
      <div className="rank">{rank.slice(3).map((p, i) => <div key={p.id} className="pl"><b className="num">{i + 4}</b><Disc color={people.get(p.id).color} />{p.name}<span className="tg">{pts(p.score)}</span></div>)}</div>
      {!readOnly && <div className="bottom two"><Btn kind="pap" style={{ fontSize: 18 }} onClick={() => { forgetSession(room.code); navigate("/"); }} testId="leave-final">Home</Btn><Btn onClick={() => { forgetSession(room.code); navigate("/crea"); }} style={{ fontSize: 19 }}>Nuova partita</Btn></div>}
    </div>
  );
}
