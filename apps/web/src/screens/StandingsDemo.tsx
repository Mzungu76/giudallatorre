import { useEffect, useState } from "react";
import { Stage } from "../ui.tsx";
import { Terrace } from "../components/Terrace.tsx";
import { loadCards } from "../lib/cards.ts";
import Standings from "../components/Standings.tsx";
import { PLAYER_COLORS } from "../ui.tsx";

/** Solo sviluppo: /__classifica?s=14,11,9,9,5,2 mostra la classifica con quei punteggi. */
export default function StandingsDemo() {
  const s = (new URLSearchParams(location.search).get("s") ?? "14,11,9,9,5,2").split(",").map(Number);
  const names = ["Dariaccio", "Bot Gino", "Bot Mara", "Bot Pino", "Bot Lella", "Bot Rosa", "Bot Tito", "Bot Nino"];
  return <Stage bg="sky"><Standings turn={5} total={12} onClose={() => undefined} rows={s.map((x, i) => ({ id: "p" + i, name: names[i]!, color: PLAYER_COLORS[i]!, score: x }))} /></Stage>;
}

/** Solo sviluppo: /__pareggio mostra la torre con il gettone del Megafono che lampeggia (pareggio deciso da lui). */
export function TieDemo() {
  const [ok, setOk] = useState(false);
  useEffect(() => { loadCards().then(() => setOk(true)); }, []);
  if (!ok) return null;
  const ids = ["p01-i01", "p01-i02", "p01-i03", "p02-i01", "p02-i02", "p02-i03"];
  const votes = [{ p: 2, c: PLAYER_COLORS[1]! }, { p: 2, c: PLAYER_COLORS[2]! }, { p: 5, c: PLAYER_COLORS[3]! }, { p: 5, c: PLAYER_COLORS[4]! }, { p: 5, c: PLAYER_COLORS[0]!, mega: true, glow: true }];
  return <Stage bg="sky"><div className="darkv" /><Terrace cardIds={ids} votes={votes} /></Stage>;
}
