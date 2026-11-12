// Chat tra giocatori + partita con bot (voti raccolti dal Megafono): 2 umani + 2 bot.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE ?? "http://127.0.0.1:8787", SHOTS = process.env.SHOTS ?? "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0; const check = (n, c, x = "") => { console.log((c ? "  ok   " : "  FAIL ") + n + (c ? "" : " " + x)); if (!c) failures++; };
const browser = await chromium.launch();
const mk = async () => { const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5 }); const p = await ctx.newPage(); p.setDefaultTimeout(5000); await p.addInitScript((fast) => { try { localStorage.setItem("gdt.intro", "1"); localStorage.setItem("gdt.nochar", "1"); sessionStorage.setItem("gdt.fast", fast); } catch {} }, process.env.FAST === "0" ? "0" : "1"); p.errors = []; p.on("pageerror", (e) => p.errors.push(e.message)); return p; };
const vis = (p, id) => p.locator(`[data-testid="${id}"]`).first().isVisible().catch(() => false);
const A = await mk(), B = await mk();
await A.goto(BASE + "/crea"); await A.fill("#nick", "Ann"); await A.click('[data-testid="bots-plus"]'); await A.click('[data-testid="bots-plus"]'); await A.click('[data-testid="create-submit"]'); await A.waitForSelector('[data-testid="lobby"]');
const code = (await A.locator('[data-testid="room-code"]').textContent()).trim();
await B.goto(`${BASE}/entra?c=${code}`); await B.fill("#nick", "Bea"); await B.click('[data-testid="join-submit"]'); await B.waitForSelector('[data-testid="lobby"]');
await sleep(300);
// chat
await A.click('[data-testid="chat-open"]'); await A.fill('[data-testid="chat-input"]', "Ciao Bea, preparati a perdere"); await A.click('[data-testid="chat-send"]'); await sleep(500);
check("la chat arriva all'altro giocatore con il contatore dei non letti", (await B.locator('[data-testid="chat-unread"]').textContent().catch(() => "")) === "1");
await B.click('[data-testid="chat-open"]', { force: true }); check("il messaggio è nel pannello", /preparati a perdere/.test(await B.locator('[data-testid="chat"]').innerText()));
await B.fill('[data-testid="chat-input"]', "Vedremo 🐑"); await B.click('[data-testid="chat-send"]'); await sleep(400); await B.click('[data-testid="chat-close"]'); await A.click('[data-testid="chat-close"]');
await A.click('[data-testid="start"]'); await Promise.all([A, B].map((p) => p.waitForSelector('[data-testid="game"]')));
let seenReason = false, sawVoteBox = false, sawMega = false, turns = 0; const t0 = Date.now();
async function step(p, name) {
  if (await vis(p, "nocard-notice")) { await p.click('[data-testid="nocard-ok"]'); return true; }
  if (await vis(p, "mega-intro")) { await p.click('[data-testid="mega-ok"]'); return true; }
  if (await vis(p, "run-vote")) { const b = p.locator('[data-testid="run-vote"]'); if (await b.isEnabled()) { await b.click(); return true; } return false; }   // intervallo a tempo: il pulsante si attiva al «via!»
  if (await vis(p, "standings-action")) { await p.click('[data-testid="standings-action"]'); if (typeof turns !== "undefined") turns++; return true; }
  if (await vis(p, "phrase-picker")) { await p.click('[data-testid="phrase-0"]'); await p.click('[data-testid="phrase-go"]'); return true; }
  if (await vis(p, "hand")) { await p.locator('[data-testid="hand-card-0"]').dispatchEvent("click"); await p.click('[data-testid="play-card"]'); return true; }
  if (await vis(p, "lui-chooser")) { await p.locator('button.hit[data-pos="1"]').dispatchEvent("click"); await p.locator('.lui-opts button:not([disabled])').first().click(); return true; }
  if (await vis(p, "confirm-vote")) {
    await p.locator('button.hit[data-pos="1"]').dispatchEvent("click"); await p.waitForSelector('[data-testid="zoom"]'); await p.click('[data-testid="zoom-action"]');
    await p.click('[data-testid="confirm-vote"]'); return true; }
  if (await vis(p, "points-panel")) { sawMega = true; await sleep(2500); await p.click('[data-testid="points-continue"]', { timeout: 1500 }).catch(() => {}); return true; }
  if (await vis(p, "reveal-panel")) { const t = await p.locator('[data-testid="reveal-panel"]').innerText(); seenReason = true; if (SHOTS && p === A && (globalThis.__n ?? 0) < 24 && t !== globalThis.__last) { globalThis.__last = t; await p.screenshot({ path: `${SHOTS}/rv${String(globalThis.__n = (globalThis.__n ?? 0) + 1).padStart(2, "0")}.png` }); } await p.click('[data-testid="reveal-next"]', { timeout: 1500 }).catch(() => {}); return true; }
  if (await vis(p, "skip")) { await p.click('[data-testid="skip"]', { timeout: 1500 }).catch(() => {}); return true; }
  if (await vis(p, "advance")) { await p.click('[data-testid="advance"]'); turns++; return true; }
  return false;
}
while (Date.now() - t0 < 240_000 && !(await vis(A, "final"))) { let a = false; for (const [p, n] of [[A, "Ann"], [B, "Bea"]]) { try { if (await step(p, n)) a = true; } catch { /* */ } } if (!a) await sleep(100); }
check("la partita con bot arriva alla fine", await vis(A, "final"));
check("lo spoglio mostra i voti uno alla volta", seenReason);
check("lo spoglio mostra chi prende punti e perché", sawMega);
check("nessun errore JavaScript", [A, B].every((p) => p.errors.length === 0), JSON.stringify([A.errors, B.errors]));
await browser.close(); console.log(failures ? `\n${failures} falliti` : "\nTutti i controlli superati"); process.exit(failures ? 1 : 0);
