// Prova della Torre del giorno nel browser: Home → Torre → voto → segnalino e punti → «un'altra Torre». Uso: BASE=http://127.0.0.1:8787 SHOTS=cartella node scripts/e2e-flash.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE ?? "http://127.0.0.1:8787", SHOTS = process.env.SHOTS ?? "";
let fails = 0; const check = (n, ok, d = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${n} ${ok ? "" : d}`); if (!ok) fails++; };
const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }), p = await ctx.newPage(), errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
await ctx.addInitScript(() => { try { localStorage.setItem("gdt.intro", "1"); localStorage.setItem("gdt.nochar", "1"); } catch {} });
const shot = async (n) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${n}.png` }); };
const vis = async (id, ms = 8000) => p.waitForSelector(`[data-testid="${id}"]`, { state: "visible", timeout: ms }).then(() => true).catch(() => false);
await p.goto(BASE + "/"); check("la Home ha il pulsante Torre del giorno", await vis("go-torre")); await shot("20-home");
await p.click('[data-testid="go-torre"]');
const step = async () => {
  const has = async (id) => p.locator(`[data-testid="${id}"]`).first().isVisible().catch(() => false), tap = (id) => p.click(`[data-testid="${id}"]`, { timeout: 4000 });
  if (await has("torre-fine")) return "fine";
  if (await has("confirm-vote")) { if (!globalThis.__ph) { globalThis.__ph = 1; globalThis.__phrase = await has("phrase"); await shot("21a-flash-frase"); } await p.locator('button.hit[data-pos="2"]').dispatchEvent("click"); await p.waitForSelector('[data-testid="zoom"]'); await tap("zoom-action"); await tap("confirm-vote"); return "voto"; }
  for (const id of ["reveal-throw", "skip", "points-continue", "advance", "standings-action"]) if (await has(id)) { await tap(id); return id; }
  return "";
};
let voted = false, fine = false;
for (let t0 = Date.now(); Date.now() - t0 < 90_000 && !fine; ) {
  const r = await step().catch(() => ""); if (r === "voto") { voted = true; await shot("21-flash-voto"); } if (r === "fine") fine = true; if (!r) await p.waitForTimeout(250);
}
check("la frase del Megafono è sullo schermo mentre si vota", !!globalThis.__phrase); check("si vota con le schermate di gioco di sempre", voted); check("a fine turno compare il riepilogo della Torre", fine); await shot("23-torre-risultato");
const pt = await p.textContent('[data-testid="torre-punti"]').catch(() => null); check("i punti sono scritti", /^\+\d+$/.test(pt ?? ""), pt ?? "");
await p.click('[data-testid="torre-ancora"]'); check("«un'altra Torre» porta un'altra Torre", await vis("confirm-vote", 15_000) || await vis("hand", 100) || await p.locator(".stage").first().isVisible());
await p.reload(); await p.click('[data-testid="torre-back"]').catch(() => {});
check("nessun errore JS", errs.length === 0, errs.join(" | "));
await b.close(); console.log(fails ? `${fails} controlli falliti` : "Tutti i controlli superati"); process.exit(fails ? 1 : 0);
