// Partita "da solo": un umano + 3 giocatori virtuali, creata dall'interfaccia. Con SAMPLE=1 salva una sequenza di screenshot delle animazioni.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE ?? "http://127.0.0.1:8787", SHOTS = process.env.SHOTS ?? "", SAMPLE = process.env.SAMPLE === "1", W = +(process.env.W ?? 390), HH = +(process.env.H ?? 844);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0; const check = (n, c, x = "") => { console.log((c ? "  ok   " : "  FAIL ") + n + (c ? "" : " " + x)); if (!c) failures++; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: HH }, deviceScaleFactor: 1.5, locale: "it-IT" });
const p = await ctx.newPage(); p.errors = []; p.on("pageerror", (e) => p.errors.push(e.message)); p.on("console", (m) => { if (m.type() === "error") p.errors.push(m.text()); });
if (process.env.FAST === "1") await p.addInitScript(() => { try { sessionStorage.setItem("gdt.fast", "1"); } catch {} });
const vis = (id) => p.locator(`[data-testid="${id}"]`).first().isVisible().catch(() => false);
await p.goto(BASE + "/"); await p.waitForSelector('[data-testid="home"]');
await p.click('[data-testid="go-solo"]'); await p.fill("#nick", "Io"); await p.click('[data-testid="bot-hard"]'); for (let i = 3; i < +(process.env.BOTS ?? 3); i++) await p.click('[data-testid="bots-plus"]');
if (SHOTS) await p.screenshot({ path: `${SHOTS}/solo-crea.png` });
await p.click('[data-testid="create-submit"]'); await p.waitForURL(/\/stanza\//); await p.waitForSelector('[data-testid="lobby"]'); await sleep(500);
const NB = +(process.env.BOTS ?? 3); check(`lobby: io + ${NB} bot`, (await p.locator('[data-testid="player-row"]').count()) === NB + 1 && (await p.locator('[data-testid="bot-tag"]').count()) === NB);
if (SHOTS) await p.screenshot({ path: `${SHOTS}/solo-lobby.png` });
await p.click('[data-testid="remove-bot"]'); await sleep(400); check("posso togliere un bot", (await p.locator('[data-testid="player-row"]').count()) === NB);
await p.click('[data-testid="add-bot"]'); await sleep(400); check("posso aggiungere un bot", (await p.locator('[data-testid="player-row"]').count()) === NB + 1);
await p.click('[data-testid="start"]'); await p.waitForSelector('[data-testid="game"]');
let n = 0, sampling = SAMPLE; const t0 = Date.now(); let turns = 0;
(async () => { while (sampling && n < 400) { await p.screenshot({ path: `${SHOTS}/s${String(n++).padStart(3, "0")}.png` }).catch(() => {}); await sleep(450); } })();
async function step() {
  if (await vis("phrase-picker")) {
    if (!globalThis.__b) { globalThis.__b = 1; await p.evaluate(() => { window.__rm = 0; window.__ad = 0; new MutationObserver((ms) => { for (const m of ms) { m.removedNodes.forEach((n) => { if (n.querySelector?.('[data-testid="phrase-go"]') || n.dataset?.testid === "phrase-go") window.__rm++; }); m.addedNodes.forEach((n) => { if (n.querySelector?.('[data-testid="phrase-go"]') || n.dataset?.testid === "phrase-go") window.__ad++; }); } }).observe(document.body, { childList: true, subtree: true }); }); await sleep(2500); console.log("REMOUNTS", await p.evaluate(() => [window.__rm, window.__ad])); }
    await p.click('[data-testid="phrase-go"]', { timeout: 4000 }); return true; }
  if (await vis("hand")) { await p.click('[data-testid="hand-card-0"]'); await p.click('[data-testid="play-card"]'); return true; }
  if (await vis("place-lui")) { await p.locator('button.hit[data-pos="1"]').dispatchEvent("click"); await p.waitForSelector('[data-testid="zoom"]'); await p.click('[data-testid="zoom-action"]'); await p.click('[data-testid="place-lui"]'); return true; }
  if (await vis("confirm-vote")) { await p.locator('button.hit[data-pos="2"]').dispatchEvent("click"); await p.waitForSelector('[data-testid="zoom"]'); await p.click('[data-testid="zoom-action"]'); await p.click('[data-testid="confirm-vote"]'); return true; }
  if (await vis("skip") && !SAMPLE) { await p.click('[data-testid="skip"]', { timeout: 3000 }); return true; }
  if (await vis("advance")) { if (SAMPLE && turns === 0) await sleep(2500); await p.click('[data-testid="advance"]'); turns++; if (turns >= 1) sampling = false; return true; }
  return false;
}
while (Date.now() - t0 < +(process.env.LIMIT ?? 420_000)) { if (await vis("final")) break; let a = false; try { a = await step(); } catch (e) { if (!globalThis.__e) { globalThis.__e = 1; console.log("STEPERR", String(e.message).slice(0, 400)); } } if (!a) await sleep(150); }
sampling = false;
if (!(await vis("final"))) { if (SHOTS) await p.screenshot({ path: `${SHOTS}/solo-stall.png` }); console.log("STALL", (await p.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 300)); }
check("la partita da solo arriva alla classifica finale", await vis("final")); if (SHOTS) await p.screenshot({ path: `${SHOTS}/solo-finale.png` });
check("nessun errore JavaScript", p.errors.length === 0, JSON.stringify(p.errors));
await browser.close(); console.log(failures ? `\n${failures} falliti` : "\nTutti i controlli superati"); process.exit(failures ? 1 : 0);
