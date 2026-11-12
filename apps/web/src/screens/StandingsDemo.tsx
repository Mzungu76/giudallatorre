import { useEffect, useMemo, useState } from "react";
import type { MiniKind } from "@gdt/game-engine";
import MiniGame from "../components/MiniGame.tsx";
import { FinaleScene, useCast } from "../components/MiniStage.tsx";
import { buildFinale } from "../lib/miniScenes.ts";
import CharIntro from "../components/CharIntro.tsx";
import FinalScene from "../components/FinalScene.tsx";
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

/** Solo sviluppo: /__finale?s=21,16,16,8 mostra la scalata finale con quei punteggi. */
export function FinalDemo() {
  const s = (new URLSearchParams(location.search).get("s") ?? "21,16,16,8").split(",").map(Number);
  const names = ["Bot Gino", "Bot Mara", "Bot Pino", "Dariaccio", "Bot Lella", "Bot Rosa", "Bot Tito", "Bot Nino"];
  const rows = s.map((x, i) => ({ id: "p" + i, name: names[i]!, color: PLAYER_COLORS[i]!, score: x })).sort((a, b) => b.score - a.score);
  const top = rows[0]!.score;
  return <Stage bg="sky"><FinalScene rows={rows} winners={new Set(rows.filter((r) => r.score === top).map((r) => r.id))} sound={false} onLeave={() => undefined} onNew={() => undefined} /></Stage>;
}

/** Solo sviluppo: /__personaggio?c=2 mostra la schermata «Il tuo personaggio». */
export function CharDemo() {
  const c = +(new URLSearchParams(location.search).get("c") ?? "0");
  return <Stage bg="sky"><CharIntro color={PLAYER_COLORS[c % 8]!} onClose={() => undefined} /></Stage>;
}

/** Solo sviluppo: /__terrazza mostra la terrazza vuota (per disegnare le scene dell'intervallo). */
export function TerraceDemo() {
  const [ok, setOk] = useState(false); useEffect(() => { loadCards().then(() => setOk(true)); }, []);
  return <Stage bg="sky">{ok && <Terrace cardIds={[]} />}</Stage>;
}

/** Solo sviluppo: /__intervallo?k=accusa|amore|peggiore&t=1500 (ms dal «via»; negativo = conto alla rovescia) oppure &fin=1&seek=2200&cadono=2,4 per la scenetta finale. */
export function MiniDemo() {
  const q = new URLSearchParams(location.search), kind = (q.get("k") ?? "accusa") as MiniKind, ids = ["p01-i01", "p01-i02", "p01-i03", "p01-i04", "p01-i05", "p01-i06"];
  const [ok, setOk] = useState(false); useEffect(() => { loadCards().then(() => setOk(true)); }, []);
  const [results, setResults] = useState(false); useEffect(() => { const w = Number(q.get("switch")); if (!w) return undefined; const x = setTimeout(() => setResults(true), w); return () => clearTimeout(x); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const list = (s: string | null) => (s ? s.split(",").map(Number).filter(Boolean) : []);
  const view = useMemo(() => ({
    viewerId: "p1", phase: "MINI_RUN", turn: 2, totalTurns: 4, myVote: q.get("voted") ? 3 : null, players: ["p1", "p2", "p3"].map((id, i) => ({ id, name: ["Dariaccio", "Bot Gino", "Bot Mara"][i]!, score: 5, hasVoted: i > 0 })),
    tower: ids.map((c, i) => ({ position: i + 1, cardId: c, ownerId: null })), megafonoId: "p2", luiTokens: [], myLuiLeft: [],
    mini: { kind, cardId: kind === "peggiore" ? null : "p02-i03", text: kind === "accusa" ? "Mi ha rubato il panino al prosciutto!" : null, order: [3, 1, 5, 2, 6, 4, 2, 5, 1, 4, 6, 3, 6, 2, 4, 1, 3, 5] },
  }), [kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const room = { players: [{ id: "p1", nickname: "Dariaccio", isHost: true, connected: true }, { id: "p2", nickname: "Bot Gino", isHost: false, connected: true }, { id: "p3", nickname: "Bot Mara", isHost: false, connected: true }], hostId: "p1" };
  const goAt = useMemo(() => Date.now() - Number(q.get("t") ?? -5000), []); // eslint-disable-line react-hooks/exhaustive-deps
  const cast = useCast(ids), side = useCast([kind === "peggiore" ? null : "p02-i03"])[0] ?? null;
  const finale = useMemo(() => buildFinale(kind, list(q.get("vincono")), list(q.get("cadono")), () => 0.37), [kind]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ok) return <Stage bg="sky"><div /></Stage>;
  if (q.get("res") || (q.get("switch") && results)) {
    const leaders = list(q.get("vincono") ?? q.get("cadono") ?? "2"), fallen = kind === "amore" ? [] : leaders, votes = { p1: leaders[0] ?? 1, p2: leaders[0] ?? 1, p3: 4 };
    const rv = { ...view, phase: "MINI_RESULTS", miniResult: { kind, cardId: view.mini.cardId, text: view.mini.text, votes, counts: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 0, 6: 0, [leaders[0] ?? 1]: 2 }, leaders, fallenPositions: fallen, fallenCardIds: [], fastest: "p2",
      points: { p1: 2, p2: 6, p3: 0 }, lines: { p1: [{ kind: "mini-giusto", pts: 2, pos: leaders[0] ?? 1 }], p2: [{ kind: "mini-giusto", pts: 2, pos: leaders[0] ?? 1 }, { kind: "mini-veloce", pts: 4, pos: leaders[0] ?? 1 }], p3: [] } } };
    return <Stage bg="sky"><MiniGame room={room as never} view={rv as never} deadline={null} send={() => undefined} sound={false} /></Stage>;
  }
  if (q.get("fin")) return <Stage bg="sky"><div className="mr"><FinaleScene finale={finale} cast={cast} side={side} onDone={() => undefined} seek={Number(q.get("seek") ?? 0)} /><div className="mr-cap head"><b>{kind}</b></div></div></Stage>;
  return <Stage bg="sky"><MiniGame room={room as never} view={view as never} deadline={null} goAt={goAt} send={() => undefined} sound={false} /></Stage>;
}
