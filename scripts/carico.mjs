// Prova di carico contro un Worker reale in locale (wrangler dev): molte stanze insieme, ognuna con un giocatore umano (questo script, che gioca con la sola vista ricevuta)
// e bot del server. Misura quante partite finiscono, i tempi di risposta alle azioni, i messaggi e i byte ricevuti, e controlla che la moviola arrivi a fine partita.
// Uso: BASE=http://127.0.0.1:8787 ROOMS=50 MODE=flash|normal|mix RAMP=5000 node scripts/carico.mjs
import WebSocket from "ws";
const BASE = process.env.BASE ?? "http://127.0.0.1:8787", WS = BASE.replace(/^http/, "ws");
const ROOMS = +(process.env.ROOMS ?? 50), MODE = process.env.MODE ?? "flash", RAMP = +(process.env.RAMP ?? 5000), LIMITE = +(process.env.LIMITE ?? 240_000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (a, p) => (a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((p / 100) * a.length))] : 0);

function passo(v, send, ctx) {
  const me = v.viewerId, mega = v.megafonoId, mine = v.players.find((p) => p.id === me);
  const act = (action) => { send({ t: "act", action }); ctx.invio = Date.now(); ctx.azioni++; return true; };
  if (v.phase === "PROCLAIM" && me === mega) return act({ type: "choosePhrase", mode: "card", index: 0 });
  if (v.phase === "PLAY" && mine && !mine.hasPlayed) return act({ type: "playCard", cardId: v.myHand[0] });
  if (v.phase === "SUSPECT" && me === mega) return act({ type: "placeMarks", marks: [{ slot: "cade", position: 1 }] });
  if (v.phase === "VOTE" && v.myVote === null) return act({ type: "vote", position: 1 + Math.floor(Math.random() * v.tower.length) });
  if (v.phase === "RESULTS" && me === mega) return act({ type: "advance" });
  return false;
}

async function stanza(i, stat) {
  const flash = MODE === "flash" || (MODE === "mix" && i % 2 === 0), bots = flash ? 3 : 5, t0 = Date.now();
  const ip = `10.${(i >> 8) & 255}.${i & 255}.7`;   // ogni stanza da un IP diverso, come giocatori veri: il limite di 10 creazioni al minuto è per IP
  const r = await fetch(BASE + "/api/rooms", { method: "POST", headers: { "cf-connecting-ip": ip }, body: JSON.stringify({ nickname: "Io" + i, bots: { count: bots, level: "hard" }, ...(flash ? { flash: true, flashMega: "host" } : {}) }) });
  if (!r.ok) { stat.errCreazione++; stat.err["creazione-" + r.status] = (stat.err["creazione-" + r.status] ?? 0) + 1; return; }
  const s = await r.json(), ctx = { azioni: 0, invio: 0 };
  await new Promise((fine) => {
    const ws = new WebSocket(`${WS}/ws/${s.code}`, { headers: { "cf-connecting-ip": ip } }); let view = null, avviata = false, chiusa = false, ultima = Date.now();
    const chiudi = (esito) => { if (chiusa) return; chiusa = true; stat.esiti[esito] = (stat.esiti[esito] ?? 0) + 1; try { ws.close(); } catch { /* */ } fine(); };
    const t = setInterval(() => { if (Date.now() - t0 > LIMITE) { clearInterval(t); chiudi("timeout"); } else if (view) passo(view, (m) => ws.send(JSON.stringify(m)), ctx); }, 40);
    ws.on("open", () => ws.send(JSON.stringify({ t: "hello", token: s.token })));
    ws.on("error", () => { clearInterval(t); chiudi("errore-ws"); });
    ws.on("close", (c) => { clearInterval(t); if (!chiusa) chiudi("chiusa-" + c); });
    ws.on("message", (d) => {
      const txt = d.toString(); stat.msg++; stat.byte += txt.length; stat.maxMsg = Math.max(stat.maxMsg, txt.length);
      const m = JSON.parse(txt);
      if (m.t === "error") { stat.err[m.code] = (stat.err[m.code] ?? 0) + 1; return; }
      if (m.t === "room" && !avviata) { avviata = true; ws.send(JSON.stringify({ t: "start" })); }
      if (m.t === "view") {
        view = m.view; if (ctx.invio) { stat.lat.push(Date.now() - ctx.invio); ctx.invio = 0; } ultima = Date.now();
        if (view.phase === "GAME_OVER") { stat.durate.push(Date.now() - t0); stat.scene.push(view.stereo?.scene?.length ?? 0); stat.stereoKB.push(JSON.stringify(view.stereo ?? {}).length / 1024); clearInterval(t); chiudi("finita"); }
      }
    });
  });
}

const stat = { msg: 0, byte: 0, maxMsg: 0, lat: [], durate: [], scene: [], stereoKB: [], esiti: {}, err: {}, errCreazione: 0 };
const t0 = Date.now();
await Promise.all(Array.from({ length: ROOMS }, async (_, i) => { await sleep((i / ROOMS) * RAMP); await stanza(i, stat); }));
const tot = (Date.now() - t0) / 1000;
console.log(JSON.stringify({
  modo: MODE, stanze: ROOMS, secondiTotali: +tot.toFixed(1), esiti: stat.esiti, errori: stat.err, erroriCreazione: stat.errCreazione,
  partiteFinite: stat.durate.length, durataPartitaS: { p50: +(pct(stat.durate, 50) / 1000).toFixed(1), p95: +(pct(stat.durate, 95) / 1000).toFixed(1), max: +(pct(stat.durate, 100) / 1000).toFixed(1) },
  rispostaAzioneMs: { p50: pct(stat.lat, 50), p95: pct(stat.lat, 95), p99: pct(stat.lat, 99), max: pct(stat.lat, 100), campioni: stat.lat.length },
  messaggiRicevuti: stat.msg, MBricevuti: +(stat.byte / 1048576).toFixed(2), messaggioMaxKB: +(stat.maxMsg / 1024).toFixed(1), messaggiAlSecondo: +(stat.msg / tot).toFixed(0),
  moviola: { sceneMedie: stat.scene.length ? +(stat.scene.reduce((a, b) => a + b, 0) / stat.scene.length).toFixed(1) : 0, statisticheKBmax: +Math.max(0, ...stat.stereoKB).toFixed(1) },
}));
process.exit(0);
