import { useMemo, useState } from "react";
import type { PlayerView } from "@gdt/game-engine";
import { FAST, navigate } from "../ui.tsx";
import { forgetSession } from "../lib/session.ts";
import { usePeople } from "./Game.tsx";
import FinalScene from "../components/FinalScene.tsx";
import AwardScene from "../components/AwardScene.tsx";
import type { RoomMsg } from "../hooks/useRoom.ts";
import type { UiCtl } from "../components/BUi.tsx";
import type { ClientMessage } from "@gdt/game-protocol";

export default function Final({ room, view, readOnly, sound = false, ui, send }: { room: RoomMsg; view: PlayerView; readOnly?: boolean; sound?: boolean; ui?: UiCtl; send?: (m: ClientMessage) => void }) {
  const people = usePeople(room);
  const rows = useMemo(() => [...view.players].sort((a, b) => b.score - a.score).map((p) => ({ id: p.id, name: p.name, color: people.get(p.id).color, score: p.score })), [view.players, people]);
  const winners = useMemo(() => new Set(view.winners ?? []), [view.winners]);
  // Premio della serata prima della scalata: una volta per partita (e per scheda), mai nei test veloci
  const awKey = `gdt.award.${room.code}`, award = view.award;
  const [seen, setSeen] = useState(() => { if (FAST || !award) return true; try { return sessionStorage.getItem(awKey) === "1"; } catch { return false; } });
  if (!seen && award) {
    const w = people.get(award.winnerId);
    return <AwardScene award={award} winner={{ name: w.name, color: w.color }} age={room.options.ageBand} sound={sound} readOnly={readOnly} onDone={() => { try { sessionStorage.setItem(awKey, "1"); } catch { /* niente memoria: vale per questa visita */ } setSeen(true); }} />;
  }
  return <FinalScene rows={rows} winners={winners} sound={sound} readOnly={readOnly} ui={ui} onLeave={() => { send?.({ t: "leave" }); forgetSession(room.code); navigate("/"); }} onNew={() => { send?.({ t: "leave" }); forgetSession(room.code); navigate("/crea"); }} />;
}
