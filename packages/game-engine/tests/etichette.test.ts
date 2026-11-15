import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { affinityV2, registerTagsV2 } from "../src/index.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const json = (p: string) => JSON.parse(readFileSync(resolve(root, p), "utf8"));
type T2 = { tipi: Record<string, number>; temi: Record<string, number> };
const cat = json("content/etichette/catalogo.json") as { pesi: number[]; max_tipi: number; max_temi: number; tipi: { id: string; def: string }[]; temi: { id: string; def: string }[] };
const frasi = json("content/etichette/frasi.v2.json").frasi as Record<string, T2>;
const carte = json("content/etichette/personaggi.v2.json").personaggi as Record<string, T2>;
const T = new Set(cat.tipi.map((t) => t.id)), M = new Set(cat.temi.map((t) => t.id));
const poolIds = (json("content/frasi-megafono.json").frasi as { id: string }[]).map((f) => f.id);
const deck = (json("public/cards/manifest.json") as { id: string; overlay_of?: string }[]).filter((m) => !m.overlay_of).map((m) => m.id);

describe("etichette v2 (occhi dei bot)", () => {
  it("catalogo: id unici e definizione per ogni voce", () => {
    expect(new Set(cat.tipi.map((t) => t.id)).size).toBe(cat.tipi.length);
    expect(new Set(cat.temi.map((t) => t.id)).size).toBe(cat.temi.length);
    for (const v of [...cat.tipi, ...cat.temi]) expect(v.def.length, v.id).toBeGreaterThan(8);
  });
  it("ogni frase del Megafono e ogni carta ha etichette; nessuna in più", () => {
    expect(Object.keys(frasi).sort()).toEqual([...poolIds].sort());
    expect(Object.keys(carte).sort()).toEqual([...deck].sort());
  });
  it("etichette valide: stanno nel catalogo, pesi 1–3, numero entro i massimi", () => {
    for (const [name, set] of [["frasi", frasi], ["carte", carte]] as const) for (const [id, t] of Object.entries(set)) {
      for (const [k, w] of Object.entries(t.tipi)) { expect(T.has(k), `${name} ${id} tipo ${k}`).toBe(true); expect(cat.pesi).toContain(w); }
      for (const [k, w] of Object.entries(t.temi)) { expect(M.has(k), `${name} ${id} tema ${k}`).toBe(true); expect(cat.pesi).toContain(w); }
      expect(Object.keys(t.tipi).length, `${name} ${id}`).toBeLessThanOrEqual(cat.max_tipi);
      expect(Object.keys(t.temi).length, `${name} ${id}`).toBeLessThanOrEqual(cat.max_temi);
      expect(Object.keys(t.tipi).length, `${name} ${id}: serve almeno un tipo`).toBeGreaterThan(0);
    }
  });
  it("vocabolario condiviso: quasi ogni tipo/tema usato da un lato compare anche dall'altro", () => {
    const used = (set: Record<string, T2>, k: "tipi" | "temi") => new Set(Object.values(set).flatMap((t) => Object.keys(t[k])));
    for (const k of ["tipi", "temi"] as const) {
      const f = used(frasi, k), c = used(carte, k), diff = [...f].filter((x) => !c.has(x)).length + [...c].filter((x) => !f.has(x)).length;
      expect(diff, `${k} su un solo lato`).toBeLessThanOrEqual(8);   // oggi 6 tipi e 5 temi; le etichette vecchie ne lasciavano 31 su 42
    }
  });
  it("affinità v2: più etichette e pesi alti in comune → punteggio più alto; senza frase etichettata si torna al vecchio sistema", () => {
    registerTagsV2({ c1: { tipi: { avaro: 3 }, temi: { soldi: 3 } }, c2: { tipi: { avaro: 1 }, temi: {} } }, { "x": { tipi: { avaro: 3 }, temi: { soldi: 3 } } });
    const a1 = affinityV2("c1", "x")!, a2 = affinityV2("c2", "x")!;
    expect(a1).toBeCloseTo(5, 5); expect(a2).toBeLessThan(a1); expect(a2).toBeGreaterThan(0);
    expect(affinityV2("c1", "sconosciuta")).toBeNull();
    registerTagsV2({}, {});
  });
});
