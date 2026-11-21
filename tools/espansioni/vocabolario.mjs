// Rigenera public/espansioni/vocabolario.json e la copia dentro public/crea-mazzo.html (elenco di tipi, temi, ruoli e aspetti che lo strumento /crea-mazzo.html propone).
// Uso: node tools/espansioni/vocabolario.mjs   (da rifare se cambiano content/etichette/*.json; un test controlla che coincidano)
import { readFileSync, writeFileSync } from "node:fs";
const J = (p) => JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), "utf8"));
const c = J("content/etichette/catalogo.json"), r = J("content/etichette/ruoli.json"), a = J("content/etichette/aspetto.json");
const out = {
  nota: "Generato da tools/espansioni/vocabolario.mjs: non modificare a mano.",
  limiti: { pesi: c.pesi, max_tipi: c.max_tipi, max_temi: c.max_temi },
  tipi: c.tipi.map((t) => ({ id: t.id, def: t.def })), temi: c.temi.map((t) => ({ id: t.id, def: t.def })),
  ruoli: r.ruoli.map((x) => ({ id: x.id, def: x.def })), aspetti: a.aspetti.map((x) => ({ id: x.id, def: x.def })),
};
writeFileSync(new URL("../../public/espansioni/vocabolario.json", import.meta.url), JSON.stringify(out));
// copia incorporata nella pagina, così funziona anche aperta da file (senza sito)
const h = new URL("../../public/crea-mazzo.html", import.meta.url), html = readFileSync(h, "utf8");
writeFileSync(h, html.replace(/\/\*VOC\*\/[\s\S]*?\/\*FINE\*\//, () => `/*VOC*/${JSON.stringify(out)}/*FINE*/`));
console.log(`vocabolario.json: ${out.tipi.length} tipi, ${out.temi.length} temi, ${out.ruoli.length} ruoli, ${out.aspetti.length} aspetti`);
