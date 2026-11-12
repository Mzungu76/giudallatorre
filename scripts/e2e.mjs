// Prova end-to-end contro un Worker reale in locale (wrangler dev): HTTP + WebSocket + Durable Object SQLite.
// Uso: BASE=http://127.0.0.1:8787 node scripts/e2e.mjs
import WebSocket from "ws";
const BASE = process.env.BASE ?? "http://127.0.0.1:8787", WS = BASE.replace(/^http/, "ws");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, cond, extra = "") => { console.log((cond ? "  ok   " : "  FAIL ") + name + (cond ? "" : " " + extra)); if (!cond) failures++; };
const post = async (path, body) => { const r = await fetch(BASE + path, { method: "POST", body: JSON.stringify(body) }); return { status: r.status, json: await r.json() }; };

class Client {
  constructor(code, session, name) { this.code = code; this.s = session; this.name = name; this.view = null; this.room = null; this.errors = []; this.closed = null; this.msgs = 0; }
  connect(origin) {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(`${WS}/ws/${this.code}`, origin ? { headers: { origin } } : {});
      this.ws.on("open", () => { this.ws.send(JSON.stringify({ t: "hello", token: this.s.token })); res(); });
      this.ws.on("unexpected-response", (_q, resp) => { this.closed = { code: resp.statusCode }; res(); });
      this.ws.on("error", (e) => rej(e));
      this.ws.on("close", (code) => { this.closed = { code }; });
      this.ws.on("message", (d) => { this.msgs++; const m = JSON.parse(d.toString()); if (m.t === "view") this.view = m; else if (m.t === "room") this.room = m; else if (m.t === "error") this.errors.push(m); this.onmsg?.(m); });
    });
  }
  send(m) { this.ws.send(JSON.stringify(m)); }
  async until(pred, ms = 8000) { const t = Date.now(); while (Date.now() - t < ms) { if (pred()) return true; await sleep(20); } return false; }
}
/** Bot che usa SOLO la vista ricevuta (come farebbe un vero client). */
function botStep(c) {
  const v = c.view?.view; if (!v) return false; const me = v.viewerId, mega = v.megafonoId, mine = v.players.find((p) => p.id === me);
  if (v.phase === "PROCLAIM" && me === mega) { c.send({ t: "act", action: v.proclaimCard.phrases.length > 1 ? { type: "choosePhrase", mode: "card", index: 1 } : { type: "choosePhrase", mode: "card", index: 0 } }); return true; }
  if (v.phase === "PLAY" && !mine.hasPlayed && (v.megafonoSa || me !== mega)) { c.send({ t: "act", action: { type: "playCard", cardId: v.myHand[0] } }); return true; }
  if (v.phase === "SUSPECT" && me === mega) { c.send({ t: "act", action: v.cnc ? { type: "placeMarks", marks: [{ slot: "cade", position: 1 }] } : { type: "placeLui", slot: v.myLuiLeft[0] ?? v.luiTokens[0].slot, position: 1 } }); return true; }
  if (v.phase === "VOTE" && v.myVote === null) { c.send({ t: "act", action: { type: "vote", position: 1 + Math.floor(Math.random() * v.tower.length) } }); return true; }
  if (v.phase === "MINI_PLAY" && !mine.hasPlayed) { c.send({ t: "act", action: { type: "playCard", cardId: v.myHand[0] } }); return true; }
  if (v.phase === "MINI_VOTE" && v.myVote === null) { const opts = v.tower.map((t) => t.position).filter((x) => x !== v.myPosition); /* nel Peggiore la propria carta non si vota */ c.send({ t: "act", action: { type: "vote", position: opts[Math.floor(Math.random() * opts.length)] } }); return true; }
  if (v.phase === "MINI_RESULTS" && c.room?.hostId === me) { c.send({ t: "act", action: { type: "advance" } }); return true; }
  if (v.phase === "RESULTS" && me === mega) { c.send({ t: "act", action: { type: "advance" } }); return true; }
  return false;
}

console.log("API");
let r = await fetch(BASE + "/api/health"); check("health", r.status === 200);
r = await post("/api/rooms", { nickname: "<b>x</b>" }); check("nickname non valido rifiutato (400)", r.status === 400);
r = await post("/api/rooms", { nickname: "Marta", extra: 1 }); check("campi extra rifiutati (400)", r.status === 400);
const created = await post("/api/rooms", { nickname: "Marta", mode: "remote" });
check("creazione stanza", created.status === 200 && /^[A-HJ-NP-Z2-9]{5}$/.test(created.json.code) && created.json.token.length === 22, JSON.stringify(created));
const code = created.json.code;
let info = await (await fetch(`${BASE}/api/rooms/${code}/info`)).json(); check("info pubblica senza dati privati", info.exists && info.players === 1 && !("tokens" in info));
info = await (await fetch(`${BASE}/api/rooms/ZZZZZ/info`)).json(); check("stanza inesistente", info.exists === false);
const dup = await post(`/api/rooms/${code}/join`, { nickname: "marta" }); check("nickname duplicato rifiutato (409)", dup.status === 409 && dup.json.error === "NICKNAME_TAKEN");
const j2 = await post(`/api/rooms/${code}/join`, { nickname: "Luca" }), j3 = await post(`/api/rooms/${code}/join`, { nickname: "Giulia" });
check("ingresso altri giocatori", j2.status === 200 && j3.status === 200);
check("codice non valido (400)", (await post("/api/rooms/ABCD1/join", { nickname: "X" })).status === 400);

console.log("WebSocket: sicurezza");
const evil = new Client(code, created.json, "evil"); await evil.connect("https://evil.example"); await sleep(300);
check("Origin diverso rifiutato (403)", evil.closed?.code === 403, JSON.stringify(evil.closed));
const bad = new Client(code, { token: "A".repeat(22) }, "bad"); await bad.connect(); await bad.until(() => bad.closed);
check("token sbagliato: errore e chiusura 4001", bad.closed?.code === 4001 && bad.errors[0]?.code === "BAD_TOKEN", JSON.stringify([bad.closed, bad.errors]));
const wsRaw = new WebSocket(`${WS}/ws/${code}`); await new Promise((r) => wsRaw.on("open", r)); wsRaw.send(JSON.stringify({ t: "start" }));
const rawClosed = await new Promise((r) => { wsRaw.on("close", (c) => r(c)); setTimeout(() => r("timeout"), 3000); });
check("primo messaggio diverso da hello: chiusura 4401", rawClosed === 4401, String(rawClosed));

console.log("WebSocket: lobby");
const A = new Client(code, created.json, "A"), B = new Client(code, j2.json, "B"), C = new Client(code, j3.json, "C");
await A.connect(); await B.connect(); await C.connect();
check("snapshot di stanza all'ingresso", await A.until(() => A.room?.players?.length === 3 && A.room.players.every((p) => p.connected)));
B.send({ t: "start" }); await sleep(300); check("solo l'host avvia (NOT_HOST)", B.errors.some((e) => e.code === "NOT_HOST"));
B.send({ t: "act", action: { type: "vote", position: 1, playerId: "x" } }); await sleep(300); check("azione con campi extra: INVALID_MESSAGE", B.errors.some((e) => e.code === "INVALID_MESSAGE"));
A.ws.send("non json"); await A.until(() => A.closed); check("JSON non valido: chiusura 4400", A.closed?.code === 4400, JSON.stringify(A.closed));
const A2 = new Client(code, created.json, "A2"); await A2.connect(); await A2.until(() => A2.room);
check("riconnessione con lo stesso token dopo la caduta", A2.room?.you === created.json.playerId && A2.room.players.length === 3);
await A2.until(() => B.room?.players?.find((p) => p.id === created.json.playerId)?.connected);

console.log("Partita completa via WebSocket (3 giocatori)");
A2.send({ t: "setOptions", turnTimerSec: 0, megafonoSa: false }); A2.send({ t: "start" });
const clients = [A2, B, C];
check("avvio partita", await A2.until(() => A2.view?.view?.phase === "PROCLAIM"));
// verifica privacy: nessuno vede le mani altrui
const hands = new Map(clients.map((c) => [c.view.view.viewerId, c.view.view.myHand]));
let leak = false; for (const c of clients) { const s = JSON.stringify(c.view); for (const [pid, h] of hands) if (pid !== c.view.view.viewerId) for (const card of h) if (s.includes(`"${card}"`)) leak = true; }
check("nessuna mano altrui nei messaggi ricevuti", !leak);
let dropped = false;
for (let i = 0; i < 4000; i++) {
  if (clients[0].view?.view?.phase === "GAME_OVER" || clients[1].room?.stage === "FINISHED") break;
  let acted = false; for (const c of clients) if (botStep(c)) { acted = true; c.view = { ...c.view, view: { ...c.view.view, phase: "__wait__" } }; await sleep(8); break; }
  if (!acted) await sleep(15);
  if (!dropped && clients[1].view?.view?.turn >= 2) { dropped = true; clients[1].ws.terminate(); await sleep(100); const B2 = new Client(code, j2.json, "B2"); await B2.connect(); await B2.until(() => B2.view); clients[1] = B2; check("riconnessione a metà partita: vista aggiornata", B2.view?.view?.phase !== undefined && B2.view.view.myHand.length >= 4); }
}
const fin = await clients[0].until(() => (clients[0].view?.view?.winners?.length ?? 0) >= 1, 5000);
check("partita conclusa con vincitori", fin && clients[0].view?.view?.winners?.length >= 1, JSON.stringify(clients[0].view?.view?.winners));
const e = clients.flatMap((c) => c.errors).filter((x) => !["WRONG_PHASE", "ALREADY_DONE"].includes(x.code)); check("nessun errore imprevisto", e.length === 0, JSON.stringify(e));

console.log(failures ? `\n${failures} controlli falliti` : "\nTutti i controlli superati");
process.exit(failures ? 1 : 0);
