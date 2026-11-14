// Cattura le videate vere dell'app usate nel tutorial e nel regolamento (public/tutorial/*.png).
// Uso: BASE=http://127.0.0.1:8787 OUT=public/tutorial node scripts/capture-tutorial.mjs   (poi convertire in webp)
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE ?? "http://127.0.0.1:8787", OUT = process.env.OUT ?? "public/tutorial";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "it-IT" });
const p = await ctx.newPage(); p.setDefaultTimeout(5000);
await p.addInitScript(() => { try { localStorage.setItem("gdt.intro", "1"); localStorage.setItem("gdt.nochar", "1"); localStorage.setItem("gdt.mega", "off"); localStorage.setItem("gdt.hintms", "999999"); } catch {} });
const vis = (id) => p.locator(`[data-testid="${id}"]`).first().isVisible().catch(() => false);
const got = new Set();
const shot = async (name, wait = 600) => { if (got.has(name)) return; got.add(name); await sleep(wait); await p.locator(".stage-outer").first().screenshot({ path: `${OUT}/${name}.png` }); console.log("ok", name); };
await p.goto(BASE + "/"); await p.click('[data-testid="go-solo"]'); await p.fill("#nick", "Anna"); await p.click('[data-testid="wiz-next"]'); await p.click('[data-testid="bot-hard"]');
await p.click('[data-testid="create-submit"]'); await p.waitForURL(/\/stanza\//); await p.waitForSelector('[data-testid="lobby"]'); await sleep(500); await p.click('[data-testid="start"]'); await p.waitForSelector('[data-testid="game"]');
const t0 = Date.now(); const NEED = ["frase", "mano", "segnalino", "voto", "spoglio", "punti"];
async function step() {
  if (await vis("char-ok")) { await p.click('[data-testid="char-ok"]'); return true; }
  if (await vis("mega-intro")) { await p.click('[data-testid="mega-ok"]'); return true; }
  if (await vis("idle-hint")) { await p.click('[data-testid="idle-hint-ok"]'); return true; }
  if (await vis("run-vote")) { const b = p.locator('[data-testid="run-vote"]'); if (await b.isEnabled()) { await b.click(); return true; } return false; }
  if (await vis("points-continue")) { await shot("punti", 900); await p.click('[data-testid="points-continue"]'); return true; }
  if (await vis("standings-action")) { await shot("classifica", 800); await p.click('[data-testid="standings-action"]'); return true; }
  if (await vis("phrase-picker")) { await shot("frase"); await p.click('[data-testid="phrase-0"]'); await p.click('[data-testid="phrase-go"]'); return true; }
  if (await vis("hand")) { await shot("mano"); await p.locator('[data-testid="hand-card-0"]').dispatchEvent("click"); await p.click('[data-testid="play-card"]'); return true; }
  if (await vis("lui-chooser")) { await shot("segnalino"); await p.locator('button.hit[data-pos="1"]').dispatchEvent("click"); await p.locator('.lui-opts button:not([disabled])').first().click(); return true; }
  if (await vis("confirm-vote")) { await shot("voto"); await p.locator('button.hit[data-pos="2"]').dispatchEvent("click"); await p.waitForSelector('[data-testid="zoom"]'); await p.click('[data-testid="zoom-action"]'); await p.click('[data-testid="confirm-vote"]'); return true; }
  if (await vis("reveal-throw")) { await shot("spoglio", 3500); await p.click('[data-testid="reveal-throw"]', { timeout: 3000 }); return true; }
  if (await vis("skip")) { await p.click('[data-testid="skip"]', { timeout: 3000 }); return true; }
  if (await vis("advance")) { await p.click('[data-testid="advance"]'); return true; }
  return false;
}
while (Date.now() - t0 < 300_000 && !NEED.every((n) => got.has(n))) { let a = false; try { a = await step(); } catch { /* */ } if (!a) await sleep(150); }
console.log(NEED.filter((n) => !got.has(n)).length ? "mancano: " + NEED.filter((n) => !got.has(n)) : "tutte le videate catturate");
await browser.close();
