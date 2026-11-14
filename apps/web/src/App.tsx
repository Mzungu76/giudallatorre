import { useEffect, useState } from "react";
import Home from "./screens/Home.tsx";
import { CreateScreen, JoinScreen } from "./screens/Forms.tsx";
import RoomScreen from "./screens/Room.tsx";
import DisplayScreen from "./screens/Display.tsx";
import Simulator from "./screens/Simulator.tsx";
import StandingsDemo, { TieDemo, FinalDemo, CharDemo, TerraceDemo, MiniDemo } from "./screens/StandingsDemo.tsx";

type Route = { name: "sim" } | { name: "home" } | { name: "create" } | { name: "join"; code: string } | { name: "room"; code: string } | { name: "display"; code: string };
function parse(): Route {
  const p = location.pathname, q = new URLSearchParams(location.search);
  let m: RegExpMatchArray | null;
  if ((m = p.match(/^\/stanza\/([A-Za-z0-9]{5})$/))) return { name: "room", code: m[1]!.toUpperCase() };
  if ((m = p.match(/^\/schermo\/([A-Za-z0-9]{5})$/))) return { name: "display", code: m[1]!.toUpperCase() };
  if (p === "/crea") return { name: "create" };
  if (p === "/intervalli" || p === "/fuoriprogramma") return { name: "sim" };
  if (p === "/entra") return { name: "join", code: (q.get("c") ?? "").toUpperCase().slice(0, 5) };
  return { name: "home" };
}
export default function App() {
  const [route, setRoute] = useState<Route>(parse);
  useEffect(() => { const f = () => setRoute(parse()); window.addEventListener("popstate", f); return () => window.removeEventListener("popstate", f); }, []);
  if (import.meta.env.DEV && location.pathname === "/__classifica") return <StandingsDemo />;
  if (import.meta.env.DEV && location.pathname === "/__personaggio") return <CharDemo />;
  if (import.meta.env.DEV && location.pathname === "/__terrazza") return <TerraceDemo />;
  if (import.meta.env.DEV && location.pathname === "/__intervallo") return <MiniDemo />;
  if (import.meta.env.DEV && location.pathname === "/__finale") return <FinalDemo />;
  if (import.meta.env.DEV && location.pathname === "/__pareggio") return <TieDemo />;
  switch (route.name) {
    case "sim": return <Simulator />;
    case "create": return <CreateScreen />;
    case "join": return <JoinScreen initialCode={route.code} />;
    case "room": return <RoomScreen key={route.code} code={route.code} />;
    case "display": return <DisplayScreen key={route.code} code={route.code} />;
    default: return <Home />;
  }
}
