// Mockup della classifica "da gioco da tavolo": A = percorso a serpentina con pedine, B = salita lungo la torre. Uso: npx tsx tools/mockup_classifica.ts
import { writeFileSync } from "node:fs";
import { CHAR_COLORS, tokenUrl } from "../apps/web/src/lib/characters.ts"; void CHAR_COLORS; void tokenUrl;
const animalMarkup = (_c: string, _w?: boolean) => "";

const NV = "#13224a";
const P = [
  { n: "Dariaccio", c: "#e5384b", s: 14 }, { n: "Bot Gino", c: "#2f7be0", s: 11 }, { n: "Bot Mara", c: "#f4c20d", s: 9 },
  { n: "Bot Pino", c: "#3aa655", s: 9 }, { n: "Bot Lella", c: "#8a5a3b", s: 5 }, { n: "Bot Rosa", c: "#ee7bb0", s: 2 },
];
const MAX = 30;
const pawn = (c: string, x: number, y: number, r = 17) => `<g transform="translate(${x} ${y})"><ellipse cx="0" cy="${r * 0.95}" rx="${r * 0.8}" ry="${r * 0.28}" fill="#0004"/><circle r="${r}" fill="${c}" stroke="${NV}" stroke-width="3.5"/><circle r="${r * 0.72}" fill="#fff" stroke="${NV}" stroke-width="2.5"/><g transform="translate(${-r * 0.5} ${-r * 0.5}) scale(${r / 100})">${animalMarkup(c, true)}</g></g>`;
const head = (t: string, sub: string) => `<div class="top"><div class="t">${t}</div><div class="s">${sub}</div></div>`;
const css = `
*{box-sizing:border-box}body{margin:0;background:#2b2b3a;font-family:Nunito,Arial,sans-serif;display:flex;gap:24px;padding:24px;justify-content:center}
.ph{position:relative;width:372px;height:760px;overflow:hidden;border:0;background:radial-gradient(circle at 50% 30%,#8fd1f4,#4f9fd6 60%,#2f77b8);}
.ph:before{content:"";position:absolute;inset:0;background:repeating-conic-gradient(from 0deg at 50% 30%,#ffffff22 0 6deg,transparent 6deg 12deg)}
.top{position:absolute;left:0;right:0;top:18px;text-align:center}.t{font:400 34px Anton,Impact;color:#fff;text-shadow:3px 3px 0 #e8362b,5px 5px 0 ${NV};letter-spacing:.04em;text-transform:uppercase}.s{font:800 13px Nunito;color:#fff;text-shadow:0 2px 0 ${NV};margin-top:2px}
.lab{position:absolute;left:0;right:0;bottom:12px;text-align:center;font:700 12px Nunito;color:#fff;opacity:.9;text-shadow:0 1px 0 ${NV}}
.list{position:absolute;left:12px;right:12px;bottom:34px;background:#fff7e0;border:4px solid ${NV};border-radius:14px;box-shadow:0 5px 0 ${NV};padding:6px 10px;display:grid;grid-template-columns:1fr 1fr;gap:2px 12px}
.row{display:flex;align-items:center;gap:6px;font:800 12.5px Nunito;color:${NV}}.row b{margin-left:auto;font:400 17px Anton}.row i{width:14px;height:14px;border-radius:50%;border:2px solid ${NV};display:inline-block}
button{display:none}
`;
// ---------- A: percorso a serpentina ----------
function A() {
  const cols = 5, size = 58, x0 = (372 - cols * size) / 2, y0 = 130;
  const sq: { x: number; y: number }[] = [];
  for (let i = 0; i <= MAX; i++) { const r = Math.floor(i / cols), k = i % cols, cc = r % 2 === 0 ? k : cols - 1 - k; sq.push({ x: x0 + cc * size + size / 2, y: y0 + (6 - r) * size * 0.98 + size / 2 - 20 }); }
  let o = "";
  // tracciato
  o += `<path d="M${sq.map((q) => `${q.x} ${q.y}`).join(" L")}" fill="none" stroke="${NV}" stroke-width="40" stroke-linecap="round" stroke-linejoin="round" opacity=".92"/>`;
  o += `<path d="M${sq.map((q) => `${q.x} ${q.y}`).join(" L")}" fill="none" stroke="#f4e3bd" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>`;
  sq.forEach((q, i) => {
    const big = i % 5 === 0, col = i === 0 ? "#3aa655" : i === MAX ? "#ffc72c" : big ? "#ffe27a" : i % 2 ? "#fff7e0" : "#efd9a6";
    o += `<circle cx="${q.x}" cy="${q.y}" r="${big ? 19 : 15}" fill="${col}" stroke="${NV}" stroke-width="${big ? 3.5 : 2.5}"/>`;
    o += `<text x="${q.x}" y="${q.y + 5}" text-anchor="middle" font-family="Anton" font-size="${big ? 15 : 11}" fill="${NV}">${i === 0 ? "VIA" : i}</text>`;
  });
  const end = sq[MAX]!; o += `<g transform="translate(${end.x - 4} ${end.y - 52})"><rect x="0" y="0" width="4" height="46" fill="${NV}"/><path d="M4 2 L34 12 L4 24Z" fill="#e8362b" stroke="${NV}" stroke-width="3"/></g>`;
  // pedine
  const byS: Record<number, number> = {};
  P.forEach((p) => { const k = byS[p.s] = (byS[p.s] ?? 0) + 1, q = sq[Math.min(MAX, p.s)]!; o += pawn(p.c, q.x + (k - 1) * 13 - ((byS[p.s]! > 1) ? 6 : 0), q.y - 12 - (k - 1) * 6, 15); });
  return `<div class="ph">${head("Classifica", "Turno 5 di 12 · chi arriva prima in cima?")}<svg width="372" height="760" style="position:absolute;inset:0">${o}</svg>
  <div class="list">${[...P].sort((a, b) => b.s - a.s).map((p, i) => `<div class="row">${i === 0 ? "👑" : i + 1}<i style="background:${p.c}"></i>${p.n}<b>${p.s}</b></div>`).join("")}</div><div class="lab">A · Percorso a caselle con pedine animale</div></div>`;
}
// ---------- B: salita lungo la torre ----------
function B() {
  const top = 170, bot = 640, h = bot - top, y = (s: number) => bot - (Math.min(MAX, s) / MAX) * h;
  let o = `<rect x="106" y="${top - 20}" width="160" height="${h + 50}" fill="#e9cf94" stroke="${NV}" stroke-width="5"/>`;
  for (let i = 0; i < 18; i++) o += `<path d="M106 ${top + i * 30}H266" stroke="#c9a85f" stroke-width="2"/>`;
  for (let i = 0; i < 6; i++) o += `<rect x="${106 + i * 30}" y="${top - 38}" width="20" height="20" fill="#e9cf94" stroke="${NV}" stroke-width="4"/>`;
  o += `<rect x="150" y="${bot - 38}" width="72" height="68" rx="34" fill="#1d2740" stroke="${NV}" stroke-width="5"/>`;
  for (let s = 0; s <= MAX; s += 5) { const yy = y(s); o += `<path d="M96 ${yy}H276" stroke="${NV}" stroke-width="4"/><rect x="40" y="${yy - 13}" width="44" height="26" rx="8" fill="#ffe27a" stroke="${NV}" stroke-width="3"/><text x="62" y="${yy + 6}" text-anchor="middle" font-family="Anton" font-size="16" fill="${NV}">${s === 0 ? "VIA" : s}</text>`; }
  o += `<g transform="translate(180 ${top - 92})"><rect x="0" y="0" width="4" height="56" fill="${NV}"/><path d="M4 2 L40 14 L4 28Z" fill="#e8362b" stroke="${NV}" stroke-width="3"/></g>`;
  const used: Record<number, number> = {};
  [...P].sort((a, b) => a.s - b.s).forEach((p, i) => { const k = used[p.s] = (used[p.s] ?? 0) + 1; const side = i % 2 === 0 ? 1 : -1; const px = 186 + side * (62 + (k - 1) * 4), yy = y(p.s) - 20; o += `<path d="M${186 + side * 40} ${y(p.s)}H${px - side * 18}" stroke="${NV}" stroke-width="3" stroke-dasharray="3 3"/>`; o += pawn(p.c, px, yy, 19); o += `<text x="${px}" y="${yy + 36}" text-anchor="middle" font-family="Nunito" font-weight="800" font-size="11" fill="#fff" stroke="${NV}" stroke-width="3" paint-order="stroke">${p.n} · ${p.s}</text>`; });
  return `<div class="ph">${head("Classifica", "Chi sale più in alto sulla torre?")}<svg width="372" height="760" style="position:absolute;inset:0">${o}</svg><div class="lab">B · Salita lungo la torre</div></div>`;
}
writeFileSync("mockups/classifica/index.html", `<!doctype html><meta charset=utf-8><link href="https://fonts.googleapis.com/css2?family=Anton&family=Nunito:wght@700;800&display=swap" rel="stylesheet"><style>${css}</style>${A()}${B()}`);
console.log("ok");
