// Verifica il ripristino dopo interruzione: crea e avvia una partita, poi (fuori da questo script) il Worker viene riavviato.
// Uso: node scripts/persist-check.mjs setup  ->  riavviare wrangler  ->  node scripts/persist-check.mjs verify
import WebSocket from "ws"; import fs from "node:fs";
const BASE = process.env.BASE ?? "http://127.0.0.1:8787", WS = BASE.replace(/^http/, "ws"), F = "/tmp/claude-0/persist.json";
const post = async (p, b) => (await fetch(BASE + p, { method: "POST", body: JSON.stringify(b) })).json();
const open = (code, token) => new Promise((res) => { const ws = new WebSocket(`${WS}/ws/${code}`); const st = { ws, msgs: [] }; ws.on("open", () => ws.send(JSON.stringify({ t: "hello", token }))); ws.on("message", (d) => st.msgs.push(JSON.parse(d.toString()))); setTimeout(() => res(st), 600); });
if (process.argv[2] === "setup") {
  const a = await post("/api/rooms", { nickname: "Ann" }), b = await post(`/api/rooms/${a.code}/join`, { nickname: "Bea" }), c = await post(`/api/rooms/${a.code}/join`, { nickname: "Cle" });
  const A = await open(a.code, a.token); await open(a.code, b.token); await open(a.code, c.token);
  A.ws.send(JSON.stringify({ t: "start" })); await new Promise((r) => setTimeout(r, 500));
  fs.writeFileSync(F, JSON.stringify({ a, b, c })); console.log("setup ok", a.code);
} else {
  const { a } = JSON.parse(fs.readFileSync(F, "utf8")); const A = await open(a.code, a.token);
  const room = A.msgs.find((m) => m.t === "room"), view = A.msgs.find((m) => m.t === "view");
  console.log(room?.stage === "PLAYING" && view?.view?.myHand?.length === 5 ? "ripristino OK: stage=" + room.stage + " fase=" + view.view.phase + " mano=" + view.view.myHand.length : "ripristino FALLITO " + JSON.stringify(A.msgs).slice(0, 300));
  process.exit(room?.stage === "PLAYING" ? 0 : 1);
}
process.exit(0);
