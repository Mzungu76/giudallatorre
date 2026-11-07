// Stampa (JSON) la terrazza e le carte come HTML, per i mockup. Uso: npx tsx tools/mockup_terrace.ts < urls.json
import { readFileSync } from "node:fs";
import { terraceBaseHtml, terraceCardsHtml } from "../apps/web/src/scene/draw.ts";
const urls: string[] = JSON.parse(readFileSync(0, "utf8"));
const V = [{ p: 1, c: "#e5384b" }, { p: 3, c: "#2f7be0" }, { p: 3, c: "#f4c20d", mega: true }, { p: 4, c: "#3aa655" }];
console.log(JSON.stringify({
  base: terraceBaseHtml(),
  vote: terraceCardsHtml(urls, 5, { lui: 2, luiKind: "CADE", luiBack: true }),
  reveal: terraceCardsHtml(urls, 5, { votes: V, lui: 3, luiKind: "CADE", lastVote: 3 }),
}));
