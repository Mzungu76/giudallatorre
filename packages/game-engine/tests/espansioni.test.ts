import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { AGE_BANDS, PHRASE_FAMILIES, fullPhrase, parseAge } from "../src/index.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const json = (p: string) => JSON.parse(readFileSync(resolve(root, p), "utf8"));
const cat = json("public/espansioni/catalogo.json") as { versione: number; mazzi: { id: string; cartella: string; carte: number; nomi?: string[]; frasiMegafono: { id: string; testo: string; verbo: string; famiglia: string; eta: string }[]; personaggi: number; frasi: number; anteprima: number; scatola: number[] }[] };

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
      const fr = m.frasiMegafono;
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

describe("etichette dei bot nel catalogo (facoltative: senza, i bot giocano le carte come neutre)", () => {
  const voc = json("public/espansioni/vocabolario.json") as { tipi: { id: string }[]; temi: { id: string }[]; ruoli: { id: string }[]; aspetti: { id: string }[]; limiti: { max_tipi: number; max_temi: number; pesi: number[] } };
  type Et = { tipi?: Record<string, number>; temi?: Record<string, number>; ruoli?: string[]; aspetto?: string[] } | null;
  const mazzi = cat.mazzi as unknown as { id: string; carte: number; frasiMegafono: unknown[]; etichette?: { carte?: Et[]; frasi?: Et[] } }[];
  it("le etichette sono allineate a carte e frasi e usano pesi, massimi, ruoli e aspetti ammessi", () => {
    const R = new Set(voc.ruoli.map((r) => r.id)), A = new Set(voc.aspetti.map((a) => a.id));
    for (const m of mazzi) {
      const et = m.etichette; if (!et) continue;
      expect((et.carte ?? []).length, `${m.id}: etichette carte`).toBeLessThanOrEqual(m.carte); expect((et.frasi ?? []).length, `${m.id}: etichette frasi`).toBeLessThanOrEqual(m.frasiMegafono.length);
      for (const e of [...(et.carte ?? []), ...(et.frasi ?? [])]) {
        if (!e) continue;
        for (const w of Object.values({ ...(e.tipi ?? {}), ...(e.temi ?? {}) })) expect(voc.limiti.pesi).toContain(w);
        expect(Object.keys(e.tipi ?? {}).length).toBeLessThanOrEqual(voc.limiti.max_tipi); expect(Object.keys(e.temi ?? {}).length).toBeLessThanOrEqual(voc.limiti.max_temi);
        for (const k of [...Object.keys(e.tipi ?? {}), ...Object.keys(e.temi ?? {})]) expect(k, `tag «${k}»`).toMatch(/^[a-z][a-z_]{1,24}$/);
        for (const r of (e as { ruoli?: string[] }).ruoli ?? []) expect(R.has(r), `ruolo ${r}`).toBe(true);
        for (const a of (e as { aspetto?: string[] }).aspetto ?? []) expect(A.has(a), `aspetto ${a}`).toBe(true);
      }
    }
  });
  it("Summit (personaggi reali): ruolo politico per tutti; l'aspetto solo da capi di vestiario visibili", () => {
    const s = mazzi.find((m) => m.id === "summit")!;
    expect(s.etichette!.carte).toHaveLength(36);
    s.etichette!.carte!.forEach((e, i) => { expect(e!.ruoli, `carta ${i + 1}`).toEqual(["politico"]); for (const a of e!.aspetto ?? []) expect(["completo", "cravatta", "occhiali", "divisa", "abito_elegante"], `carta ${i + 1}: ${a}`).toContain(a); });
  });
  it("il vocabolario pubblico (strumento /crea-mazzo.html) coincide con i file delle etichette; se cambia, rigeneralo con `node tools/espansioni/vocabolario.mjs`", () => {
    const cat2 = json("content/etichette/catalogo.json") as { tipi: { id: string }[]; temi: { id: string }[]; pesi: number[]; max_tipi: number; max_temi: number };
    expect(voc.tipi.map((t) => t.id)).toEqual(cat2.tipi.map((t) => t.id)); expect(voc.temi.map((t) => t.id)).toEqual(cat2.temi.map((t) => t.id));
    expect(voc.limiti).toEqual({ pesi: cat2.pesi, max_tipi: cat2.max_tipi, max_temi: cat2.max_temi });
    expect(voc.ruoli.map((r) => r.id)).toEqual((json("content/etichette/ruoli.json") as { ruoli: { id: string }[] }).ruoli.map((r) => r.id));
    expect(voc.aspetti.map((a) => a.id)).toEqual((json("content/etichette/aspetto.json") as { aspetti: { id: string }[] }).aspetti.map((a) => a.id));
  });
});
