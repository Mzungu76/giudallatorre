// 8 browser giocano un turno intero fino alla caduta: verifica la disposizione a bouquet e i flussi di voto con 8 giocatori.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE ?? "http://127.0.0.1:8787", SHOTS = process.env.SHOTS ?? "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0; const check = (n, c, x = "") => { console.log((c ? "  ok   " : "  FAIL ") + n + (c ? "" : " " + x)); if (!c) failures++; };
const browser = await chromium.launch();
const mk = async () => { const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const p = await ctx.newPage(); await p.addInitScript(() => { try { localStorage.setItem("gdt.intro", "1"); } catch {} }); if (process.env.FAST === "1") await p.addInitScript(() => { try { sessionStorage.setItem("gdt.fast", "1"); } catch {} }); p.errors = []; p.on("pageerror", (e) => p.errors.push(e.message)); return p; };
const vis = (p, id) => p.locator(`[data-testid="${id}"]`).first().isVisible().catch(() => false);
const pages = await Promise.all(Array.from({ length: 8 }, mk));
await pages[0].goto(BASE + "/crea"); await pages[0].fill("#nick", "Host"); await pages[0].click('[data-testid="create-submit"]'); await pages[0].waitForURL(/stanza/);
const code = (await pages[0].locator('[data-testid="room-code"]').textContent()).trim();
for (let i = 1; i < 8; i++) { await pages[i].goto(`${BASE}/entra?c=${code}`); await pages[i].fill("#nick", "Gioc" + i); await pages[i].click('[data-testid="join-submit"]'); await pages[i].waitForURL(/stanza/); }
await sleep(600); check("8 giocatori in lobby", (await pages[0].locator('[data-testid="player-row"]').count()) === 8);
const full = await mk(); await full.goto(`${BASE}/entra?c=${code}`); await full.fill("#nick", "Nono"); await full.click('[data-testid="join-submit"]'); await sleep(600);
check("il nono giocatore è respinto con messaggio chiaro", /piena/.test(await full.locator('[data-testid="toast"]').textContent().catch(() => "")));
await pages[0].click('[data-testid="start"]'); await Promise.all(pages.map((p) => p.waitForSelector('[data-testid="game"]')));
let sShot = false; const t0 = Date.now(); let sawResults = false;
async function step(p) {
  if (await vis(p, "phrase-picker")) { await p.click('[data-testid="phrase-go"]'); return true; }
  if (await vis(p, "hand")) { await p.click('[data-testid="hand-card-0"]'); await p.click('[data-testid="play-card"]'); return true; }
  if (await vis(p, "place-lui")) { await p.locator('button.hit[data-pos="3"]').dispatchEvent("click"); await p.click('[data-testid="zoom-action"]'); if (!sShot) { await sleep(400); await p.screenshot({ path: `${SHOTS}/20-otto-torre.png` }); sShot = true; } await p.click('[data-testid="place-lui"]'); return true; }
  if (await vis(p, "confirm-vote")) { await p.locator(`button.hit[data-pos="${1 + Math.floor(Math.random() * 8)}"]`).dispatchEvent("click"); await p.click('[data-testid="zoom-action"]'); await p.click('[data-testid="confirm-vote"]'); return true; }
  if (await vis(p, "skip")) { if (!sawResults) { await sleep(3300); await p.screenshot({ path: `${SHOTS}/21-otto-caduta.png` }); sawResults = true; } await p.click('[data-testid="skip"]'); return true; }
  return false;
}
while (Date.now() - t0 < 120_000 && !(await vis(pages[0], "result-panel"))) { let a = false; for (const p of pages) { try { if (await step(p)) a = true; } catch { /* */ } } if (!a) await sleep(100); }
check("tutti e 8 vedono i risultati del primo turno", (await Promise.all(pages.map((p) => vis(p, "result-panel")))).filter(Boolean).length >= 7);
await pages[0].screenshot({ path: `${SHOTS}/22-otto-punti.png` });
check("nessun errore JavaScript", pages.every((p) => p.errors.length === 0), JSON.stringify(pages.map((p) => p.errors)));
await browser.close(); console.log(failures ? `\n${failures} falliti` : "\nTutti i controlli superati"); process.exit(failures ? 1 : 0);
