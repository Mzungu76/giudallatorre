// Prova end-to-end dell'uscita a partita in corso: tre umani; chi esce è sostituito da un bot (e gli altri lo vedono);
// l'ultimo umano che esce chiude subito la stanza. Uso: BASE=http://127.0.0.1:8787 SHOTS=/percorso node scripts/e2e-leave.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE ?? "http://127.0.0.1:8787", SHOTS = process.env.SHOTS ?? "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0; const check = (n, c, x = "") => { console.log((c ? "  ok   " : "  FAIL ") + n + (c ? "" : " " + x)); if (!c) failures++; };
const browser = await chromium.launch();
const mk = async () => { const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: "it-IT" }); const p = await ctx.newPage(); await p.addInitScript(() => { try { localStorage.setItem("gdt.intro", "1"); localStorage.setItem("gdt.nochar", "1"); sessionStorage.setItem("gdt.fast", "1"); } catch {} }); p.errors = []; p.on("pageerror", (e) => p.errors.push(e.message)); return p; };
const vis = (p, id) => p.locator(`[data-testid="${id}"]`).first().isVisible().catch(() => false);
const shot = async (p, n) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${n}.png` }); };
const exists = async (code) => (await (await fetch(`${BASE}/api/rooms/${code}/info`)).json()).exists === true;

console.log("Partita con tre umani");
const A = await mk(), B = await mk(), C = await mk();
await A.goto(BASE + "/"); await A.click('[data-testid="go-create"]'); await A.fill("#nick", "Ann"); await A.click('[data-testid="create-submit"]'); await A.waitForURL(/\/stanza\//);
const code = (await A.locator('[data-testid="room-code"]').textContent()).trim();
for (const [p, n] of [[B, "Bea"], [C, "Cle"]]) { await p.goto(`${BASE}/entra?c=${code}`); await p.fill("#nick", n); await p.click('[data-testid="join-submit"]'); await p.waitForURL(/\/stanza\//); }
await sleep(500); await A.click('[data-testid="start"]');
await Promise.all([A, B, C].map((p) => p.waitForSelector('[data-testid="game"]')));
for (const p of [A, B, C]) { const ok = p.locator("text=HO CAPITO").first(); if (await ok.isVisible().catch(() => false)) await ok.click(); }
await sleep(400);

console.log("Bea esce: viene sostituita da un bot");
await B.click('[data-testid="legend-btn"]'); await B.waitForSelector('[data-testid="howto"]');
await B.click('[data-testid="leave-game"]');
check("chiede conferma e spiega che subentra un bot", /giocatore virtuale/i.test(await B.locator('[data-testid="leave-confirm"]').textContent())); await shot(B, "leave-conferma");
await B.click('[data-testid="leave-no"]'); check("«Resto» annulla", await vis(B, "leave-game"));
await B.click('[data-testid="leave-game"]'); await B.click('[data-testid="leave-yes"]');
await B.waitForURL((u) => new URL(u).pathname === "/", { timeout: 5000 }).catch(() => {});
check("chi esce torna alla home", new URL(B.url()).pathname === "/");
await A.waitForSelector('[data-testid="toast"]', { timeout: 5000 }).catch(() => {});
const toast = (await A.locator('[data-testid="toast"]').first().textContent().catch(() => "")) ?? ""; await shot(A, "leave-avviso");
check("gli altri vedono un avviso", /Bea.*lasciato.*bot/i.test(toast), toast);
check("la stanza esiste ancora", await exists(code));

console.log("Cle esce, poi Ann (ultima umana): la stanza si chiude subito");
await C.click('[data-testid="legend-btn"]'); await C.click('[data-testid="leave-game"]'); await C.click('[data-testid="leave-yes"]');
await sleep(600);
check("dopo l'uscita di Cle la stanza esiste ancora (c'è Ann)", await exists(code));
check("Ann vede l'avviso anche per Cle", /Cle.*lasciato.*bot/i.test((await A.locator('[data-testid="toast"]').first().textContent().catch(() => "")) ?? ""));
await A.click('[data-testid="legend-btn"]').catch(() => {}); await A.click('[data-testid="leave-game"]');
check("all'ultima umana avvisa che la stanza si chiude", /ultimo giocatore umano/i.test(await A.locator('[data-testid="leave-confirm"]').textContent())); await shot(A, "leave-ultima");
await A.click('[data-testid="leave-yes"]'); await sleep(800);
check("stanza chiusa subito", !(await exists(code)));
check("nessun errore JavaScript", [A, B, C].every((p) => p.errors.length === 0), [A, B, C].flatMap((p) => p.errors).join(" | "));
await browser.close();
console.log(failures ? `\n${failures} controlli falliti` : "\nTutti i controlli superati"); process.exit(failures ? 1 : 0);
