import { Stage } from "../ui.tsx";
import Standings from "../components/Standings.tsx";
import { PLAYER_COLORS } from "../ui.tsx";

/** Solo sviluppo: /__classifica?s=14,11,9,9,5,2 mostra la classifica con quei punteggi. */
export default function StandingsDemo() {
  const s = (new URLSearchParams(location.search).get("s") ?? "14,11,9,9,5,2").split(",").map(Number);
  const names = ["Dariaccio", "Bot Gino", "Bot Mara", "Bot Pino", "Bot Lella", "Bot Rosa", "Bot Tito", "Bot Nino"];
  return <Stage bg="sky"><Standings turn={5} total={12} onClose={() => undefined} rows={s.map((x, i) => ({ id: "p" + i, name: names[i]!, color: PLAYER_COLORS[i]!, score: x }))} /></Stage>;
}
