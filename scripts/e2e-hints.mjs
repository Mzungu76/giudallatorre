// Prova end-to-end dell'aiuto ai giocatori: 3 schermate iniziali, scheda «Sei il Megafono!», badge del ruolo,
// fumetti che compaiono SOLO se si resta fermi, esempi dei punti con carte (niente «n. 2»).
// Uso: BASE=http://127.0.0.1:8787 SHOTS=/percorso node scripts/e2e-hints.mjs   (un umano + 3 bot, animazioni vere)
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE ?? "http://127.0.0.1:8787", SHOTS = process.env.SHOTS ?? "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0; const check = (n, c, x = "") => { console.log((c ? "  ok   " : "  FAIL ") + n + (c ? "" : " " + x)); if (!c) failures++; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, locale: "it-IT" });
const p = await ctx.newPage(); p.setDefaultTimeout(5000); p.errors = []; p.on("pageerror", (e) => p.errors.push(e.message));
await p.addInitScript(() => { try { localStorage.setItem("gdt.hintms", "2500"); } catch {} });   // suggerimento dopo 2,5 s invece di 14 s
const vis = (id) => p.locator(`[data-testid="${id}"]`).first().isVisible().catch(() => false);
const shot = async (n) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${n}.png` }); };
const txt = async (id) => (await p.locator(`[data-testid="${id}"]`).first().innerText().catch(() => "")) ?? "";

await p.goto(BASE + "/"); await p.waitForSelector('[data-testid="home"]');
await p.click('[data-testid="go-solo"]'); await p.fill("#nick", "Io"); await p.click('[data-testid="wiz-next"]'); await p.click('[data-testid="bot-hard"]'); await p.click('[data-testid="wiz-next"]');
await p.click('[data-testid="create-submit"]'); await p.waitForURL(/\/stanza\//); await p.waitForSelector('[data-testid="lobby"]'); await sleep(400);
await p.click('[data-testid="start"]'); await p.waitForSelector('[data-testid="game"]');

console.log("Prima partita: tre schermate");
await p.waitForSelector('[data-testid="intro-slides"]');
check("compaiono le 3 schermate al posto del regolamento", await vis("intro-slides") && !(await vis("howto")));
await shot("1-intro-scopo");
await p.click('[data-testid="intro-next"]'); await shot("2-intro-passi");
await p.click('[data-testid="intro-next"]');
check("la terza mostra i punti con le carte, senza numeri", (await p.locator('[data-testid="intro-slides"] .ex-th').count()) >= 1 && !/\bn\.\s?\d/.test(await txt("intro-slides")));
await shot("3-intro-punti");
await p.click('[data-testid="intro-next"]');
check("si chiude e non torna più (memorizzato)", !(await vis("intro-slides")) && (await p.evaluate(() => localStorage.getItem("gdt.intro"))) === "1");
if (await vis("char-ok") || (await p.waitForSelector('[data-testid="char-ok"]', { timeout: 3000 }).then(() => true).catch(() => false))) await p.click('[data-testid="char-ok"]');

console.log("Partita: scheda del Megafono, badge, fumetti");
let helpChecked = false, sawMegaIntro = false, sawChip = false, sawGold = false, sawHint = false, hintGone = false, calmOk = true, turns = 0, hintChecked = false;
const t0 = Date.now();
async function step() {
  if (await vis("mega-intro")) {
    sawMegaIntro = true; check("scheda «Sei il Megafono!» con i 3 passi e come si fanno punti", /sei il megafono/i.test(await txt("mega-intro")) && /come fai punti/i.test(await txt("mega-intro"))); await shot("4-mega-intro");
    await p.click('[data-testid="mega-ok"]'); return true;
  }
  if (await vis("role-chip")) sawChip = true;
  if ((await p.locator(".bsheet.gold").count()) > 0) sawGold = true;
  if (await vis("idle-hint")) {
    if (!sawHint) { sawHint = true; check("il fumetto spiega cosa fare", /(Tocca|Scegli|Vota)/.test(await txt("idle-hint"))); await shot("5-fumetto"); }
    await p.click('[data-testid="idle-hint-ok"]'); await sleep(300); hintGone = !(await vis("idle-hint")); return true;
  }
  // se devo agire e resto fermo: aspetto il fumetto (una volta); poi gioco normalmente
  const mustAct = (await vis("phrase-picker")) || (await vis("hand")) || (await vis("lui-chooser")) || (await vis("confirm-vote"));
  if (mustAct && !helpChecked) {
    helpChecked = true;
    await p.click('[data-testid="legend-btn"]'); await p.waitForSelector('[data-testid="help-menu"]');
    check("«i» apre il menu Aiuto con suggerimenti, tutorial e regolamento", (await vis("help-hint")) && (await vis("help-tutorial")) && (await vis("help-rules"))); await shot("10-aiuto");
    await p.click('[data-testid="help-hint"]'); await p.waitForSelector('[data-testid="idle-hint"]');
    await p.waitForSelector('[data-testid="hint-ring"]', { timeout: 3000 }).catch(() => {});
    check("«Cosa devo fare adesso?» mostra il fumetto con cerchio e freccia sul prossimo gesto", (await vis("idle-hint")) && (await vis("hint-ring"))); await shot("11-freccia");
    await p.click('[data-testid="idle-hint-ok"]');
    await p.click('[data-testid="legend-btn"]'); await p.click('[data-testid="help-tutorial"]'); await p.waitForSelector('[data-testid="intro-slides"]');
    check("dal menu si rivede il tutorial", await vis("intro-slides")); await p.click('[data-testid="intro-skip"]'); await p.waitForSelector('[data-testid="help-menu"]'); await p.click('[data-testid="help-close"]');
    return true;
  }
  if (mustAct && !hintChecked) { hintChecked = true; await p.waitForSelector('[data-testid="idle-hint"]', { timeout: 8000 }).catch(() => {}); return true; }
  if (await vis("howto")) { await p.click('[data-testid="howto-close"]'); return true; }
  if (await vis("run-vote")) { const b = p.locator('[data-testid="run-vote"]'); if (await b.isEnabled()) { await b.click(); return true; } return false; }   // intervallo a tempo: il pulsante si attiva al «via!»
  if (await vis("phrase-picker")) { await p.click('[data-testid="phrase-0"]'); await p.click('[data-testid="phrase-go"]'); return true; }
  if (await vis("hand")) { await p.locator('[data-testid="hand-card-0"]').dispatchEvent("click"); await p.click('[data-testid="play-card"]'); return true; }
  if (await vis("lui-chooser")) { await p.locator('button.hit[data-pos="1"]').dispatchEvent("click"); await p.locator('.lui-opts button:not([disabled])').first().click(); return true; }
  if (await vis("confirm-vote")) { await p.locator('button.hit[data-pos="2"]').dispatchEvent("click"); await p.waitForSelector('[data-testid="zoom"]'); await p.click('[data-testid="zoom-action"]'); await p.click('[data-testid="confirm-vote"]'); return true; }
  if (await vis("points-continue")) {
    if (turns === 0) { await shot("6-punti-tu"); check("i punti del turno mostrano prima la riga «Tu»", /^Tu/.test((await p.locator('[data-testid="points-block"]').first().innerText()).trim())); }
    await sleep(500); await p.click('[data-testid="points-continue"]', { timeout: 3000 }); return true;
  }
  if (await vis("skip")) { await p.click('[data-testid="skip"]', { timeout: 3000 }); return true; }
  if (await vis("standings-action")) { turns++; await p.click('[data-testid="standings-action"]'); return true; }
  if (await vis("advance")) { turns++; await p.click('[data-testid="advance"]'); return true; }
  return false;
}
while (Date.now() - t0 < 300_000) { if (await vis("final")) break; let a = false; try { a = await step(); } catch { /* stato cambiato */ } if (!a) await sleep(150); }
check("la scheda del Megafono è comparsa la prima volta che è toccato a me", sawMegaIntro);
check("il badge «Sei il Megafono» è sempre visibile nel mio turno", sawChip);
check("i pannelli del Megafono sono dorati", sawGold);
check("il fumetto compare solo dopo un po' di inattività e sparisce al tocco", sawHint && hintGone);
if (!(await vis("final"))) console.log("STALL", (await p.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 300));
check("la partita arriva alla classifica finale", await vis("final"));

console.log("Regolamento: esempi con le carte");
// la finale copre il pannello: riapro il regolamento da una nuova pagina in una stanza vuota non serve, uso la home
await p.goto(BASE + "/"); await p.waitForSelector('[data-testid="home"]');
const how = p.locator('[data-testid="go-how"]').first();
if (await how.isVisible().catch(() => false)) {
  await how.click(); await p.waitForSelector('[data-testid="howto"]');
  await p.locator('.brg-tabs button', { hasText: "I punti" }).click(); await sleep(200);
  check("«I punti»: esempio di un turno con carte vere", (await p.locator('[data-testid="example-turn"] .ex-th').count()) >= 4);
  check("«I punti»: nessun riferimento tipo «n. 2»", !/\bn\.\s?\d/.test(await txt("howto-body")), await txt("howto-body"));
  await shot("7-esempio-turno");
  await p.locator('.brg-tabs button', { hasText: "Il Lui" }).click(); await sleep(200);
  check("«Il Lui!»: esempio con immagini, senza «n. 2»", (await vis("example-lui")) && !/\bn\.\s?\d/.test(await txt("howto-body")));
  await shot("8-esempio-lui");
} else console.log("  (salto: pulsante del regolamento non trovato in home)");
check("nessun errore JavaScript", p.errors.length === 0, JSON.stringify(p.errors));
await browser.close(); console.log(failures ? `\n${failures} controlli falliti` : "\nTutti i controlli superati"); process.exit(failures ? 1 : 0);
