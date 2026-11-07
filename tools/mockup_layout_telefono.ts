// Genera mockups/layout-telefono.html: analisi + 3 varianti di layout per smartphone, con il CSS e il disegno reali dell'app.
// Uso: npx tsx tools/mockup_layout_telefono.ts <cartella-screenshot-webp> <file-di-uscita>
import { readFileSync, writeFileSync } from "node:fs";
import { terraceBaseHtml, terraceCardsHtml, terracePos, luiTok } from "../apps/web/src/scene/draw.ts";

const [shotsDir, out] = process.argv.slice(2);
const PUB = "public";
const ids = ["p01-i01", "p02-i03", "p03-i05", "p04-i02", "p05-i04", "p06-i03", "p07-i02", "p08-i05"];
const man = JSON.parse(readFileSync(`${PUB}/cards/manifest.json`, "utf8"));
const file = (id: string) => { const c = man.find((x: any) => x.id === id) ?? man[0]; return c.file ?? man.find((x: any) => x.id === c.duplicate_of)?.file ?? id + ".webp"; };
const uris = ids.map((id) => "data:image/webp;base64," + readFileSync(`${PUB}/cards/${file(id)}`).toString("base64"));
const luiPng = "data:image/png;base64," + readFileSync(`${PUB}/lui-coperto.png`).toString("base64");
// Le immagini delle carte compaiono una volta sola (variabili CSS --cN): il resto le richiama.
const dedupe = (html: string) => { let s = html.replaceAll("/lui-coperto.png", "LUIPNG"); uris.forEach((u, i) => { s = s.replaceAll(`url(${u})`, `var(--c${i})`); }); return s; };
const data: any = { base: terraceBaseHtml() };
for (const n of [6, 8]) {
  const u = uris.slice(0, n);
  data[`pos${n}`] = terracePos(n);
  data[`cards${n}`] = dedupe(terraceCardsHtml(u, n, {}));
  data[`cardsLui${n}`] = dedupe(terraceCardsHtml(u, n, { lui: 3, luiBack: true, votes: [{ p: 2, c: "#e5384b" }] }));
}
const SP = [{ slot: "zero", k: 0, pts: 5 }, { slot: "k3", k: 3, pts: 14 }];
data.luiToks = SP.map((s) => luiTok(s as any, 46).replaceAll("/lui-coperto.png", luiPng));
data.luiMini = SP.map((s) => luiTok(s as any, 20));
const json = JSON.stringify(data).replaceAll("LUIPNG", luiPng).replaceAll("</", "<\\/");
const w = (n: string) => "data:image/webp;base64," + readFileSync(`${shotsDir}/${n}.webp`).toString("base64");
const shots = [
  { src: w("b-mano"), alt: "Scegli la carta oggi", title: "Scegli la carta", cap: "Frase alta 126 px, mano di carte piccole, suggerimento a 10,5 px.", zones: [[251, "FINE BANNER"], [692, "INIZIO BLOCCO BASSO"]] },
  { src: w("a-voto-0"), alt: "Voto oggi", title: "Voto, 6 giocatori", cap: "La torre si rimpicciolisce per stare tra frase e suggerimento (4 righe).", zones: [[251, "FINE BANNER"], [640, "INIZIO BLOCCO BASSO"]] },
  { src: w("a-lui"), alt: "Lui oggi", title: "Lui! del Megafono", cap: "Due blocchi di testo e due bottoni sotto la torre.", zones: [[251, "FINE BANNER"], [640, "INIZIO BLOCCO BASSO"]] },
  { src: w("b-voto-0"), alt: "Voto con 8 giocatori oggi", title: "Voto, 8 giocatori", cap: "Frase lunga a tre righe: la scena scende a circa 380 px.", zones: [[258, "FINE BANNER"], [640, "INIZIO BLOCCO BASSO"]] },
  { src: w("a-punti"), alt: "Punti oggi", title: "Chi prende punti", cap: "Il pannello occupa da y=128 a fondo: con una riga resta mezzo vuoto e la scena sparisce." },
];
const cardVars = ":root{" + uris.map((u, i) => `--c${i}:url(${u})`).join(";") + "}";
let html = readFileSync("tools/mockup_layout_telefono.page.html", "utf8");
html = html.replace("/*__APPCSS__*/", () => readFileSync("apps/web/src/styles/app.css", "utf8")).replace("/*__CARDVARS__*/", () => cardVars).replace("/*__DATA__*/", () => json).replace("/*__SHOTS__*/", () => JSON.stringify(shots));
writeFileSync(out, html);
console.log("ok", (html.length / 1e6).toFixed(2) + " MB");
