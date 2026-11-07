// Genera mockups/layout-telefono-b.html: layout B applicato a tutte le schermate, con il CSS e il disegno reali dell'app.
// Uso: npx tsx tools/mockup_layout_b.ts <cartella-asset> <file-di-uscita>
// La cartella asset contiene: fall-a.webp, fall-b.webp, tower-home.webp, qr.txt (data URL del QR).
import { readFileSync, writeFileSync } from "node:fs";
import { terraceBaseHtml, terraceCardsHtml, terracePos, luiTok, voteTok } from "../apps/web/src/scene/draw.ts";
import { animalMarkup } from "../apps/web/src/lib/animals.ts";

const [assets, out] = process.argv.slice(2);
const PUB = "public";
const ids = ["p01-i01", "p02-i03", "p03-i05", "p04-i02", "p05-i04", "p06-i03", "p07-i02", "p08-i05"];
const man = JSON.parse(readFileSync(`${PUB}/cards/manifest.json`, "utf8"));
const file = (id: string) => { const c = man.find((x: any) => x.id === id) ?? man[0]; return c.file ?? man.find((x: any) => x.id === c.duplicate_of)?.file ?? id + ".webp"; };
const b64 = (p: string, mime: string) => `data:${mime};base64,` + readFileSync(p).toString("base64");
const uris = ids.map((id) => b64(`${PUB}/cards/${file(id)}`, "image/webp"));
const luiPng = b64(`${PUB}/lui-coperto.png`, "image/png");
const dedupe = (html: string) => { let s = html.replaceAll("/lui-coperto.png", "LUIPNG"); uris.forEach((u, i) => { s = s.replaceAll(`url(${u})`, `var(--c${i})`); }); return s; };
const E = "#e5384b", BL = "#2f7be0", YE = "#f4c20d", GR = "#3aa655";
const data: any = { base: terraceBaseHtml() };
for (const n of [6, 8]) {
  const u = uris.slice(0, n);
  data[`pos${n}`] = terracePos(n);
  data[`cards${n}`] = dedupe(terraceCardsHtml(u, n, {}));
  data[`cardsLui${n}`] = dedupe(terraceCardsHtml(u, n, { lui: 3, luiBack: true, votes: [{ p: 2, c: E }] }));
  data[`cardsRev${n}`] = dedupe(terraceCardsHtml(u, n, { lui: 3, luiBack: true, votes: [{ p: 2, c: E }, { p: 2, c: BL }, { p: 1, c: YE }, { p: 4, c: GR }] }));
}
const SP = [{ slot: "zero", k: 0, pts: 5 }, { slot: "k3", k: 3, pts: 14 }] as any[];
const fixLui = (s: string) => s.replaceAll("/lui-coperto.png", luiPng);
data.luiToks = SP.map((s) => fixLui(luiTok(s, 46)));
data.luiMini = SP.map((s) => fixLui(luiTok(s, 22)));
data.luiMid = SP.map((s) => fixLui(luiTok(s, 34)));
data.luiBig = SP.map((s) => fixLui(luiTok(s, 76)));
data.vote30 = voteTok(BL, 30);
const NV = "#13224a";
const pawn = (color: string, size = 40) => `<span class="pawn"><svg width="${size}" height="${size + 8}" viewBox="-20 -20 40 48" style="overflow:visible"><ellipse cx="0" cy="19" rx="15" ry="5" fill="#0005"/><circle r="19" fill="${color}" stroke="${NV}" stroke-width="3.4"/><circle r="13.6" fill="#fff" stroke="${NV}" stroke-width="2.4"/><g transform="translate(-9.4 -9.4) scale(.188)">${animalMarkup(color, true)}</g></svg></span>`;
data.pawns = Object.fromEntries(["#e5384b", "#2f7be0", "#f4c20d", "#3aa655", "#8a5a3b", "#8e44c8", "#ee7bb0", "#222222"].map((c) => [c, pawn(c)]));
data.cut = ["p05-i01", "p05-i02", "p05-i03"].map((id) => b64(`${PUB}/cutouts/${id}.webp`, "image/webp"));
data.tower = b64(`${assets}/tower-home.webp`, "image/webp");
data.qr = readFileSync(`${assets}/qr.txt`, "utf8").trim();
data.fall = [b64(`${assets}/fall-a.webp`, "image/webp"), b64(`${assets}/fall-b.webp`, "image/webp")];
data.conf = Array.from({ length: 34 }, (_, i) => [(i * 53) % 360, 60 + ((i * 97) % 420), 8 + (i % 3) * 3, 5 + (i % 4) * 2, ["#e8362b", "#ffc72c", "#14a3a1", "#fff7e0", "#ff7aa8"][i % 5], i * 37]);
// Testi di "Come si gioca" (da components/HowTo.tsx)
const how = readFileSync("apps/web/src/components/HowTo.tsx", "utf8");
const grab = (name: string) => { const m = how.match(new RegExp(`export const ${name}[^=]*= (\\[[\\s\\S]*?\\n\\]);`)); return m ? (0, eval)(m[1]) : []; };
data.howIntro = grab("HOWTO_INTRO"); data.howSteps = grab("HOWTO_STEPS"); data.howPts = grab("HOWTO_POINTS");
data.mini = ["Un personaggio accusa uno di voi di aver fatto una marachella.", "Giocate la carta del colpevole, poi votate (anche la vostra!).", "Le carte più votate restano e fanno punti. Le altre cadono dalla torre!"];
const json = JSON.stringify(data).replaceAll("LUIPNG", luiPng).replaceAll("</", "<\\/");
const cardVars = ":root{" + uris.map((u, i) => `--c${i}:url(${u})`).join(";") + "}";
let html = readFileSync("tools/mockup_layout_b.page.html", "utf8");
html = html.replace("/*__APPCSS__*/", () => readFileSync("apps/web/src/styles/app.css", "utf8")).replace("/*__CARDVARS__*/", () => cardVars).replace("/*__DATA__*/", () => json);
writeFileSync(out, html);
console.log("ok", (html.length / 1e6).toFixed(2) + " MB", data.howSteps.length, data.howPts.length, data.howIntro.length);
