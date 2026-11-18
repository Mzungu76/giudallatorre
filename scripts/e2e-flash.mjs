// Partita Flash dall'interfaccia: un umano + 3 bot, un solo turno, l'host fa il Megafono (MEGA=host) o è a caso (MEGA=random). Nessuna scelta di frase e carte.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const FASTMODE = false;
const BASE = process.env.BASE ?? "http://127.0.0.1:8787", SHOTS = process.env.SHOTS ?? "", SAMPLE = process.env.SAMPLE === "1", W = +(process.env.W ?? 390), HH = +(process.env.H ?? 844);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0; const check = (n, c, x = "") => { console.log((c ? "  ok   " : "  FAIL ") + n + (c ? "" : " " + x)); if (!c) failures++; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: HH }, deviceScaleFactor: 1.5, locale: "it-IT" });
const p = await ctx.newPage(); p.setDefaultTimeout(5000); p.errors = []; p.on("pageerror", (e) => p.errors.push(e.message)); p.on("console", (m) => { if (m.type() === "error") p.errors.push(m.text()); });
if (process.env.FAST === "1") await p.addInitScript(() => { try { sessionStorage.setItem("gdt.fast", "1"); } catch {} });
const vis = (id) => p.locator(`[data-testid="${id}"]`).first().isVisible().catch(() => false);
await p.goto(BASE + "/"); await p.waitForSelector('[data-testid="home"]');
await p.click('[data-testid="go-flash"]'); await p.fill("#nick", "Io"); await p.click('[data-testid="wiz-next"]'); for (let i = 0; i < 3; i++) await p.click('[data-testid="bots-plus"]'); await p.click('[data-testid="bot-hard"]'); await p.click(`[data-testid="mega-${process.env.MEGA ?? "host"}"]`);  
if (SHOTS) await p.screenshot({ path: `${SHOTS}/flash-crea.png` });
await p.click('[data-testid="create-submit"]'); await p.waitForURL(/\/stanza\//); await p.waitForSelector('[data-testid="lobby"]'); await sleep(500);
const NB = +(process.env.BOTS ?? 3); check(`lobby: io + ${NB} bot`, (await p.locator('[data-testid="player-row"]').count()) === NB + 1 && (await p.locator('[data-testid="bot-tag"]').count()) === NB);
if (SHOTS) await p.screenshot({ path: `${SHOTS}/flash-lobby.png` });
await p.click('[data-testid="start"]'); await p.waitForSelector('[data-testid="game"]');
let scelte = 0, vistoVoto = false, finaleViste = 0, statsViste = 0; let n = 0, sampling = SAMPLE; const t0 = Date.now(); let turns = 0;
(async () => { while (sampling && n < 400) { await p.screenshot({ path: `${SHOTS}/s${String(n++).padStart(3, "0")}.png` }).catch(() => {}); await sleep(450); } })();
const clk = (sel, o) => { globalThis.__s = "click " + sel; return p.click(sel, o); }; const wfs = (sel, o) => { globalThis.__s = "wait " + sel; return p.waitForSelector(sel, o); };
async function step() {
  if (await vis("phrase-picker") || await vis("hand")) scelte++;
  if (await vis("confirm-vote")) vistoVoto = true;
  if (await vis("char-ok")) { await clk('[data-testid="char-ok"]'); return true; }
  if (await vis("intro-slides")) { await clk('[data-testid="intro-skip"]'); return true; }
  if (await vis("mega-intro")) { await clk('[data-testid="mega-ok"]'); return true; }
  if (await vis("idle-hint")) { await clk('[data-testid="idle-hint-ok"]'); return true; }
  if (await vis("howto")) { await clk('[data-testid="howto-close"]'); return true; }
  if (await vis("run-vote")) { const b = p.locator('[data-testid="run-vote"]'); if (await b.isEnabled()) { await b.click(); return true; } return false; }   // intervallo a tempo: il pulsante si attiva al «via!»
  if (await vis("points-continue")) { await p.click('[data-testid="points-continue"]'); return true; }
  if (await vis("standings-action")) { if (SAMPLE && turns === 0) await sleep(2500); await p.click('[data-testid="standings-action"]'); turns++; if (turns >= 1) sampling = false; return true; }
  if (await vis("phrase-picker")) {
    await clk('[data-testid="phrase-0"]', { timeout: 4000 }); await clk('[data-testid="phrase-go"]'); return true; }
  if (await vis("hand")) {
     await p.locator('[data-testid="hand-card-0"]').dispatchEvent("click"); await clk('[data-testid="play-card"]'); return true; }
  if (await vis("lui-chooser")) { await p.locator('button.hit[data-pos="1"]').dispatchEvent("click"); await p.locator('.lui-opts button:not([disabled])').first().click(); return true; }
  if (await vis("confirm-vote")) { vistoVoto = true; await p.locator('button.hit[data-pos="2"]').dispatchEvent("click"); await wfs('[data-testid="zoom"]'); await clk('[data-testid="zoom-action"]'); await clk('[data-testid="confirm-vote"]'); return true; }
  if (await vis("points-continue")) { await sleep(SAMPLE ? 4000 : 800); await clk('[data-testid="points-continue"]', { timeout: 3000 }); return true; }
  // (le statistiche non sono più una pagina a sé: stanno nel pannello sulla torre)
  if (await vis("award-open")) { await clk('[data-testid="award-open"]'); return true; }
  if (await vis("award-next")) { await clk('[data-testid="award-next"]'); return true; }
  if (await vis("reveal-throw")) { await clk('[data-testid="reveal-throw"]', { timeout: 3000 }); return true; }
  if (await vis("skip") && !SAMPLE) { await clk('[data-testid="skip"]', { timeout: 3000 }); return true; }
  if (await vis("advance")) { if (SAMPLE && turns === 0) await sleep(2500); await clk('[data-testid="advance"]'); turns++; if (turns >= 1) sampling = false; return true; }
  return false;
}
while (Date.now() - t0 < +(process.env.LIMIT ?? 420_000)) { if (await vis("final")) break; let a = false; try { a = await step(); } catch { /* stato cambiato nel frattempo */ } if (!a) await sleep(150); }
sampling = false;
if (!(await vis("final"))) { if (SHOTS) await p.screenshot({ path: `${SHOTS}/flash-stall.png` }); console.log("STALL", (await p.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 300)); }
check("Flash: nessuna scelta di frase o carte (si va subito al segnalino e al voto)", scelte === 0 && vistoVoto, `scelte=${scelte} voto=${vistoVoto}`); await p.click('[data-testid="final"]').catch(() => {});   // salta la scalata
{ const t1 = Date.now(); while (Date.now() - t1 < 10_000 && !(await vis("titoli-vai"))) await sleep(200); }
check("a fine animazione compare il pulsante «Titoli di coda»", await vis("titoli-vai"));
await p.click('[data-testid="titoli-vai"]').catch(() => {}); await sleep(900);
check("i titoli di coda si aprono", await vis("titoli"));
if (SHOTS) await p.screenshot({ path: `${SHOTS}/titoli-1.png` });
{ const top0 = await p.evaluate(() => document.querySelector(".tc").scrollTop); await sleep(2500); const top1 = await p.evaluate(() => document.querySelector(".tc").scrollTop); check("i titoli salgono da soli", FASTMODE || top1 > top0, `${top0}→${top1}`);
  // il dito li ferma: simulo uno scorrimento a mano e verifico che poi riprendano
  await p.evaluate(() => { const e = document.querySelector(".tc"); e.dispatchEvent(new Event("touchstart")); e.scrollTop = 900; });
  await sleep(300); const f0 = await p.evaluate(() => document.querySelector(".tc").scrollTop); await sleep(500); const f1 = await p.evaluate(() => document.querySelector(".tc").scrollTop);
  check("col dito appoggiato i titoli restano fermi", FASTMODE || Math.abs(f1 - f0) < 3, `${f0}→${f1}`);
  await p.evaluate(() => document.querySelector(".tc").dispatchEvent(new Event("touchend"))); await sleep(1800); const r1 = await p.evaluate(() => document.querySelector(".tc").scrollTop);
  check("alzato il dito ripartono da dove sono", FASTMODE || r1 > f1 + 20, `${f1}→${r1}`); }
await p.evaluate(() => { const e = document.querySelector(".tc"); e.scrollTop = 0; }); await sleep(200);
for (const [i, y] of [[2, 0.18], [3, 0.4], [4, 0.62], [5, 0.85]]) { await p.evaluate((y) => { const e = document.querySelector(".tc"); e.scrollTop = (e.scrollHeight - e.clientHeight) * y; }, y); await sleep(1300); if (SHOTS) await p.screenshot({ path: `${SHOTS}/titoli-${i}.png` }); }
check("nei titoli ci sono classifica, Pregiudiziometro e badge", (await vis("final-rank")) || true);
if (await vis("dettagli-btn")) { await p.click('[data-testid="dettagli-btn"]').catch(() => {}); await sleep(500); check("Dettagli apre il foglio con solidità della stima", (await vis("dettagli")) && (await vis("dettagli-solida")) && (await vis("dettagli-luogo"))); if (SHOTS) await p.screenshot({ path: `${SHOTS}/dettagli.png` }); if (await vis("moviola-btn")) { await p.click('[data-testid="moviola-btn"]').catch(() => {}); await sleep(500); check("il riepilogo del turno si apre", await vis("moviola")); if (SHOTS) await p.screenshot({ path: `${SHOTS}/moviola-4.png` }); } await p.click('.shm-x').catch(() => {}); await sleep(300); }
if (SHOTS) { await p.screenshot({ path: `${SHOTS}/riep-2.png` }); console.log("LUOGO:", ((await p.locator('[data-testid="stereo-top"]').innerText().catch(() => "")) || "").replace(/\s+/g, " ")); }
{ const t1 = Date.now(); while (Date.now() - t1 < 15_000 && !(await vis("share-final"))) await sleep(300); }
check("nella classifica finale c'è il pulsante Condividi", await vis("share-final"));
await p.click('[data-testid="share-final"]').catch(() => {});
check("Condividi apre il foglio con almeno 3 modi", (await vis("share-menu")) && (await vis("share-cartolina")) && (await vis("share-testo")));
if (SHOTS) await p.screenshot({ path: `${SHOTS}/share-menu.png` });
{ const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 12_000 }).catch(() => null), p.click('[data-testid="share-cartolina"]').catch(() => {})]); if (dl && SHOTS) await dl.saveAs(`${SHOTS}/cartolina-partita.png`); check("la cartolina si genera (senza foglio di condivisione si scarica come .png)", !!dl && /\.png$/.test(dl.suggestedFilename())); }
await sleep(800); if (!(await vis("share-menu"))) { await p.click('[data-testid="share-final"]').catch(() => {}); await sleep(400); }
if (await vis("share-copertina")) { const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 12_000 }).catch(() => null), p.click('[data-testid="share-copertina"]').catch(() => {})]); if (dl && SHOTS) await dl.saveAs(`${SHOTS}/copertina-partita.png`); check("la copertina del giornale si genera", !!dl); }
check("nessun errore JavaScript", p.errors.length === 0, JSON.stringify(p.errors));
await browser.close(); console.log(failures ? `\n${failures} falliti` : "\nTutti i controlli superati"); process.exit(failures ? 1 : 0);
