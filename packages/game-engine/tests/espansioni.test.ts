import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { AGE_BANDS, PHRASE_FAMILIES, fullPhrase, parseAge } from "../src/index.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const json = (p: string) => JSON.parse(readFileSync(resolve(root, p), "utf8"));
const cat = json("public/espansioni/catalogo.json") as { versione: number; mazzi: { id: string; cartella: string; carte: number; personaggi: number; frasi: number; anteprima: number; scatola: number[] }[] };

describe("espansioni", () => {
  it("il catalogo ha id univoci e le carte di ogni mazzo esistono", () => {
    expect(Number.isInteger(cat.versione)).toBe(true);
    expect(new Set(cat.mazzi.map((m) => m.id)).size).toBe(cat.mazzi.length);
    for (const m of cat.mazzi) {
      expect(m.carte).toBe(m.personaggi);
      expect(m.anteprima).toBeLessThan(m.carte);
      for (const n of [...Array(m.carte).keys()].map((i) => i + 1)) expect(existsSync(resolve(root, "public" + m.cartella + "c" + String(n).padStart(2, "0") + ".webp")), `${m.id} c${n}`).toBe(true);
      for (const n of m.scatola) expect(n >= 1 && n <= m.carte).toBe(true);
    }
  });
  it("le frasi di ogni mazzo rispettano le regole del Megafono e il conto del catalogo", () => {
    for (const m of cat.mazzi) {
      const fr = json(`content/espansioni/${m.id}/frasi.json`).frasi as { id: string; testo: string; verbo: string; famiglia: string; eta: string }[];
      expect(fr).toHaveLength(m.frasi);
      expect(new Set(fr.map((f) => f.id)).size).toBe(fr.length);
      expect(new Set(fr.map((f) => f.testo.toLowerCase())).size).toBe(fr.length);
      for (const f of fr) {
        expect(PHRASE_FAMILIES).toContain(f.famiglia);
        expect(AGE_BANDS).toContain(parseAge(f.eta));
        expect(f.testo.endsWith(".") && f.testo.length <= 80).toBe(true);
        expect(f.verbo).toBe(/^(i più|quelli che)(?=\s)/.test(f.testo) ? "salgono" : "sale");
        expect(/^(i più|quelli che|chi|il più)(?=[\s,])/.test(f.testo)).toBe(true);
        expect(fullPhrase({ verb: f.verbo as "sale", text: f.testo })).toMatch(/^Oggi (sale|salgono) sulla torre /);
      }
    }
  });
});
