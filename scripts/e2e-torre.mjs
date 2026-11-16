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
check("sul pulsante compare «Nuova!» prima di aprirla", await vis("torre-nuova"));
await p.click('[data-testid="go-torre"]'); await p.waitForTimeout(1100); await shot("22-splash"); check("si vede l'intro animata della Torre del giorno", await vis("mode-splash", 500));
const step = async () => {
  const has = async (id) => p.locator(`[data-testid="${id}"]`).first().isVisible().catch(() => false), tap = (id) => p.click(`[data-testid="${id}"]`, { timeout: 4000 });
  if (await has("torre-fine")) return "fine";
  if (await has("confirm-vote")) { if (!globalThis.__ph) { globalThis.__ph = 1; globalThis.__phrase = await has("phrase"); await shot("21a-flash-frase"); } await p.locator('button.hit[data-pos="2"]').dispatchEvent("click"); await p.waitForSelector('[data-testid="zoom"]'); await tap("zoom-action"); await tap("confirm-vote"); return "voto"; }
  if (await has("stereo-next")) { if (!statsVista) { await p.waitForTimeout(2600); await shot("24-stats"); } statsVista = true; await tap("stereo-next"); return "stats"; }
  for (const id of ["reveal-throw", "skip", "points-continue", "advance", "standings-action"]) if (await has(id)) { await tap(id); return id; }
  return "";
};
let voted = false, fine = false, statsVista = false;
for (let t0 = Date.now(); Date.now() - t0 < 90_000 && !fine; ) {
  const r = await step().catch(() => ""); if (r === "voto") { voted = true; await shot("21-flash-voto"); } if (r === "fine") fine = true; if (!r) await p.waitForTimeout(250);
}
check("la frase del Megafono è sullo schermo mentre si vota", !!globalThis.__phrase); check("si vota con le schermate di gioco di sempre", voted); check("dopo il turno compaiono le statistiche dei luoghi comuni, come nell'app base", statsVista); check("poi la pagina finale della Torre", fine); check("la cartolina da condividere è un'immagine 1080×1350", await p.waitForSelector('[data-testid="torre-cartolina"]', { timeout: 8000 }).then(() => true).catch(() => false) && (await p.evaluate(() => { const i = document.querySelector('[data-testid="torre-cartolina"]'); return i && i.naturalWidth === 1080 && i.naturalHeight === 1350; })));
await p.waitForTimeout(800); await shot("23-torre-risultato");
if (process.env.SHOTS) { const src = await p.getAttribute('[data-testid="torre-cartolina"]', "src"); const b64 = await p.evaluate(async (u) => { const r = await fetch(u); const b = await r.blob(); return await new Promise((ok) => { const f = new FileReader(); f.onload = () => ok(String(f.result).split(",")[1]); f.readAsDataURL(b); }); }, src); (await import("node:fs")).writeFileSync(process.env.SHOTS + "/cartolina.png", Buffer.from(b64, "base64")); }

await p.goto(BASE + "/torre"); check("riaperta nello stesso giorno: si vede il risultato, non si rivota", await vis("torre-risultato") && !(await vis("confirm-vote", 800)));
await p.goto(BASE + "/"); check("aperta la Torre, «Nuova!» sparisce", !(await vis("torre-nuova", 1500)));
check("nessun errore JS", errs.length === 0, errs.join(" | "));
await b.close(); console.log(fails ? `${fails} controlli falliti` : "Tutti i controlli superati"); process.exit(fails ? 1 : 0);
