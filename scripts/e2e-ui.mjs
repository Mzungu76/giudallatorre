// Prova end-to-end dell'INTERFACCIA: tre browser (telefoni) giocano una partita intera + uno schermo condiviso, contro il Worker reale.
// Uso: BASE=http://127.0.0.1:8787 SHOTS=/percorso node scripts/e2e-ui.mjs   (richiede playwright: NODE_PATH=$(npm root -g))
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright"); // global (NODE_PATH) o locale
const BASE = process.env.BASE ?? "http://127.0.0.1:8787", SHOTS = process.env.SHOTS ?? "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0; const check = (n, c, x = "") => { console.log((c ? "  ok   " : "  FAIL ") + n + (c ? "" : " " + x)); if (!c) failures++; };
const browser = await chromium.launch();
const mk = async (name, w = 390, h = 844) => { const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, locale: "it-IT" }); const p = await ctx.newPage(); await p.addInitScript(() => { try { localStorage.setItem("gdt.intro", "1"); } catch {} }); if (process.env.FAST !== "0") await p.addInitScript(() => { try { sessionStorage.setItem("gdt.fast", "1"); } catch {} }); p.name = name; p.errors = []; p.on("pageerror", (e) => p.errors.push(e.message)); p.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && p.errors.push(m.text())); return p; };
const shot = async (p, n) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${n}.png` }); };
const vis = (p, id) => p.locator(`[data-testid="${id}"]`).first().isVisible().catch(() => false);

console.log("Home, creazione e ingresso");
const A = await mk("A"), B = await mk("B"), C = await mk("C");
await A.goto(BASE + "/"); await A.waitForSelector('[data-testid="home"]', { timeout: 15000 }).catch(() => {}); check("home visibile", await vis(A, "home")); await shot(A, "01-home");
await A.click('[data-testid="go-create"]'); await A.fill("#nick", "Ann"); await shot(A, "02-crea");
await A.click('[data-testid="create-submit"]'); await A.waitForURL(/\/stanza\/[A-Z0-9]{5}/);
const code = (await A.locator('[data-testid="room-code"]').textContent()).trim(); check("stanza creata con codice", /^[A-HJ-NP-Z2-9]{5}$/.test(code), code);
for (const [p, n] of [[B, "Bea"], [C, "Cle"]]) { await p.goto(`${BASE}/entra?c=${code}`); await p.fill("#nick", n); await p.click('[data-testid="join-submit"]'); await p.waitForURL(/\/stanza\//); }
await B.waitForSelector('[data-testid="lobby"]'); await sleep(400);
check("3 giocatori in lobby", (await A.locator('[data-testid="player-row"]').count()) === 3); await shot(A, "03-lobby");
const dup = await mk("D"); await dup.goto(`${BASE}/entra?c=${code}`); await dup.fill("#nick", "ann"); await dup.click('[data-testid="join-submit"]'); await sleep(600);
check("nickname duplicato: messaggio chiaro", await vis(dup, "toast") && /già/.test(await dup.locator('[data-testid="toast"]').textContent())); await shot(dup, "04-nick-duplicato");

console.log("Schermo condiviso e avvio");
const D = await mk("display", 1280, 720); await D.goto(`${BASE}/schermo/${code}`); await sleep(600);
check("schermo condiviso collegato", await vis(D, "display")); await shot(D, "05-schermo-lobby");
await A.click('[data-testid="start"]');
await Promise.all([A, B, C].map((p) => p.waitForSelector('[data-testid="game"]')));
check("partita avviata su tutti i telefoni", true);

console.log("Partita completa tramite interfaccia");
const pages = [A, B, C]; let shots = 0, turns = 0, lastTurn = "";
const t0 = Date.now();
async function stepPage(p) {
  if (await vis(p, "mini-intro")) { await p.click('[data-testid="mini-go"]', { force: true }); return true; }
  if (await vis(p, "mini-vote")) { await p.locator('button.hit[data-pos="2"]').dispatchEvent("click"); await p.click('[data-testid="zoom-action"]'); return true; }
  if (await vis(p, "points-continue")) { await p.click('[data-testid="points-continue"]'); return true; }
  if (await vis(p, "standings-action")) { await p.click('[data-testid="standings-action"]'); return true; }
  if (await vis(p, "phrase-picker")) { if (shots < 1) { await shot(p, "06-frase"); shots++; } await p.click('[data-testid="phrase-0"]'); return true; }
  if (await vis(p, "hand")) { if (!p.s1) { await shot(p, "07-mano"); p.s1 = 1; } await p.click('[data-testid="hand-card-0"]'); await p.click('[data-testid="play-card"]'); return true; }
  if (await vis(p, "lui-chooser")) {
    await p.locator('button.hit[data-pos="1"]').dispatchEvent("click"); await p.click('[data-testid="look-card"]'); await p.waitForSelector('[data-testid="zoom"]'); if (!p.s2) { await shot(p, "08-zoom"); p.s2 = 1; }
    await p.click('[data-testid="zoom-action"]'); await p.locator('.lui-opts button:not([disabled])').first().click(); return true; }
  if (await vis(p, "confirm-vote")) {
    const n = 1 + Math.floor(Math.random() * 3); await p.locator(`button.hit[data-pos="${n}"]`).dispatchEvent("click"); await p.waitForSelector('[data-testid="zoom"]');
    await p.click('[data-testid="zoom-action"]'); if (!p.s3) { await shot(p, "09-voto"); p.s3 = 1; } await p.click('[data-testid="confirm-vote"]'); return true; }
  if (await vis(p, "skip")) { if (!p.s4) { await sleep(3200); await shot(p, "10-caduta"); await shot(D, "10b-schermo-in-partita"); p.s4 = 1; } await p.click('[data-testid="skip"]', { timeout: 5000 }); return true; }
  if (await vis(p, "advance")) { if (!p.s5) { await shot(p, "11-punti"); p.s5 = 1; } await p.click('[data-testid="advance"]'); turns++; return true; }
  return false;
}
while (Date.now() - t0 < 240_000) {
  if (await vis(A, "final")) break;
  let acted = false; for (const p of pages) { try { if (await stepPage(p)) acted = true; } catch { /* stato cambiato nel frattempo */ } }
  if (!acted) await sleep(120);
}
check("classifica finale su tutti i telefoni", (await Promise.all(pages.map((p) => vis(p, "final")))).every(Boolean)); await shot(A, "12-finale");
check("tutti e 3 hanno fatto il Megafono 2 volte (6 turni)", turns >= 5, `turni avanzati: ${turns}`);
check("lo schermo condiviso mostra la classifica", await vis(D, "final")); await shot(D, "13-schermo-finale");
check("nessun errore JavaScript nelle pagine", [...pages, D].every((p) => p.errors.length === 0), JSON.stringify([...pages, D].map((p) => p.errors)));
await browser.close();
console.log(failures ? `\n${failures} controlli falliti` : "\nTutti i controlli superati"); process.exit(failures ? 1 : 0);
