import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }), p = await ctx.newPage();
await ctx.addInitScript(() => { try { localStorage.setItem("gdt.intro", "1"); localStorage.setItem("gdt.nochar", "1"); } catch {} });
await p.goto("http://127.0.0.1:8787/crea?flash=1"); await p.fill("#nick", "Io"); await p.click('[data-testid="wiz-next"]'); await p.waitForTimeout(900);
await p.screenshot({ path: process.env.OUT }); await b.close();
