import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { AGE_BANDS, PHRASE_FAMILIES, fullPhrase, parseAge } from "../src/index.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const json = (p: string) => JSON.parse(readFileSync(resolve(root, p), "utf8"));
const cat = json("public/espansioni/catalogo.json") as { versione: number; mazzi: { id: string; cartella: string; carte: number; nomi?: string[]; personaggi: number; frasi: number; anteprima: number; scatola: number[] }[] };

describe("espansioni", () => {
  it("il catalogo ha id univoci e le carte di ogni mazzo esistono", () => {
    expect(Number.isInteger(cat.versione)).toBe(true);
    expect(new Set(cat.mazzi.map((m) => m.id)).size).toBe(cat.mazzi.length);
    for (const m of cat.mazzi) {
      expect(m.carte).toBe(m.personaggi);
      expect(m.anteprima).toBeLessThan(m.carte);
      if (m.nomi) expect(m.nomi).toHaveLength(m.carte);
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

describe("etichette dei bot per le carte delle espansioni", () => {
  const ruoli = json("content/etichette/ruoli.json") as { carte: Record<string, string[]> }, asp = json("content/etichette/aspetto.json") as { carte: Record<string, string[]> };
  const v2 = json("content/etichette/personaggi.v2.json").personaggi as Record<string, unknown>, v1 = json("content/tags-personaggi.json") as Record<string, unknown>;
  it("ogni carta Summit ha ruolo, etichette v1 e v2; l'aspetto solo dove si vede un capo di vestiario", () => {
    for (const m of cat.mazzi) for (let n = 1; n <= m.carte; n++) {
      const id = `${m.id}-c${String(n).padStart(2, "0")}`;
      expect(ruoli.carte[id], id).toEqual(["politico"]); expect(v1[id], id).toBeTruthy(); expect(v2[id], id).toBeTruthy();
      for (const a of asp.carte[id] ?? []) expect(["completo", "cravatta", "occhiali", "divisa", "abito_elegante"], `${id}: ${a}`).toContain(a);
    }
  });
});
