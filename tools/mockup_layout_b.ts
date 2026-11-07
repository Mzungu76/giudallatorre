// Genera mockups/layout-telefono-b.html: layout B applicato a tutte le schermate, con il CSS e il disegno reali dell'app.
// Uso: npx tsx tools/mockup_layout_b.ts <cartella-asset> <file-di-uscita>
// La cartella asset contiene: fall-a/b.webp, tower-home.webp, qr.txt (QR), tok-0..7.webp (segnalini ridotti), card-2.webp (carta personaggio), fin-full/safari/small.webp (scena finale della PR #9).
import { readFileSync, writeFileSync } from "node:fs";
import { terraceBaseHtml, terraceCardsHtml, terracePos, luiTok, voteTok } from "../apps/web/src/scene/draw.ts";
import { CHAR_COLORS, CHAR_NAMES, CHAR_BLURB } from "../apps/web/src/lib/characters.ts";

const [assets, out] = process.argv.slice(2);
const PUB = "public";
const ids = ["p01-i01", "p02-i03", "p03-i05", "p04-i02", "p05-i04", "p06-i03", "p07-i02", "p08-i05"];
const man = JSON.parse(readFileSync(`${PUB}/cards/manifest.json`, "utf8"));
const file = (id: string) => { const c = man.find((x: any) => x.id === id) ?? man[0]; return c.file ?? man.find((x: any) => x.id === c.duplicate_of)?.file ?? id + ".webp"; };
const b64 = (p: string, mime: string) => `data:${mime};base64,` + readFileSync(p).toString("base64");
const uris = ids.map((id) => b64(`${PUB}/cards/${file(id)}`, "image/webp"));
const luiPng = b64(`${PUB}/lui-coperto.png`, "image/png");
const dedupe = (html: string) => { let s = fixTok(html).replaceAll("/lui-coperto.png", "LUIPNG"); uris.forEach((u, i) => { s = s.replaceAll(`url(${u})`, `var(--c${i})`); }); return s; };
const [E, BL, GR, YE] = CHAR_COLORS;
const tokUri = CHAR_COLORS.map((_, i) => b64(`${assets}/tok-${i}.webp`, "image/webp"));
const fixTok = (x: string) => x.replace(/\/giocatori\/tok-(\d)\.webp/g, (_m, i) => tokUri[+i]!);
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
data.vote30 = fixTok(voteTok(BL, 30));
const NV = "#13224a";
const pawn = (color: string, size = 40) => `<span class="pawn"><img src="${tokUri[CHAR_COLORS.indexOf(color)]}" width="${size}" height="${size}" alt="" style="display:block;filter:drop-shadow(0 3px 0 #13224a88)"></span>`;
data.pawns = Object.fromEntries(CHAR_COLORS.map((c) => [c, pawn(c)]));
data.colors = CHAR_COLORS; data.charNames = CHAR_NAMES; data.charBlurb = CHAR_BLURB;
data.tok = tokUri;
data.charCard = b64(`${assets}/card-2.webp`, "image/webp");
data.fin = { full: b64(`${assets}/fin-full.webp`, "image/webp"), safari: b64(`${assets}/fin-safari.webp`, "image/webp"), small: b64(`${assets}/fin-small.webp`, "image/webp") };
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
const rgb = (hex: string) => { const n = parseInt(hex.slice(1), 16); return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`; };
// Come installCharDiscs() dell'app: il dischetto colorato diventa il segnalino del personaggio.
const discCss = CHAR_COLORS.map((c, i) => `.dc[style*="${rgb(c)}"],.dc[style*="${c}"]{background-image:var(--t${i}) !important;background-size:cover !important;background-position:center !important;background-repeat:no-repeat !important;border-width:1.5px !important;box-shadow:none !important}`).join("\n");
const cardVars = ":root{" + uris.map((u, i) => `--c${i}:url(${u})`).join(";") + ";" + tokUri.map((u, i) => `--t${i}:url(${u})`).join(";") + "}\n" + discCss;
let html = readFileSync("tools/mockup_layout_b.page.html", "utf8");
html = html.replace("/*__APPCSS__*/", () => readFileSync("apps/web/src/styles/app.css", "utf8")).replace("/*__CARDVARS__*/", () => cardVars).replace("/*__DATA__*/", () => json);
writeFileSync(out, html);
console.log("ok", (html.length / 1e6).toFixed(2) + " MB", data.howSteps.length, data.howPts.length, data.howIntro.length);
