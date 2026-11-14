import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { affinity, inferTags, registerTags } from "../src/index.ts";

const json = (p: string) => JSON.parse(readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8"));
const cards = json("content/tags-personaggi.json"), phrases = json("content/tags-frasi.json") as Record<string, { tipo: string[]; temi: string[] }>;

describe("frasi nuove: etichette dedotte dalle parole", () => {
  it("su frasi mai viste (verifica a esclusione) indovina almeno un'etichetta vera molto più del caso", () => {
    const all = Object.entries(phrases).filter(([, v]) => v.tipo.length + v.temi.length > 0); let ok = 0, tested = 0, rnd = 0;
    const vocab = [...new Set(all.flatMap(([, v]) => [...v.tipo, ...v.temi]))];
    for (const [text, tags] of all) {
      const rest = Object.fromEntries(all.filter(([t]) => t !== text)); registerTags(cards, rest);
      const g = inferTags(text); if (!g) continue; tested++;
      const truth = new Set([...tags.tipo, ...tags.temi]); if ([...g.tipo, ...g.temi].some((t) => truth.has(t))) ok++;
      rnd += Math.min(1, truth.size * 2 / vocab.length);   // probabilità che due etichette a caso ne azzecchino una
    }
    registerTags(cards, phrases);
    console.log("LESSICO", tested, "su", all.length, "frasi con etichette dedotte;", ((100 * ok) / tested).toFixed(0), "% con almeno una giusta (caso ≈", ((100 * rnd) / tested).toFixed(0), "%)");
    expect(tested / all.length).toBeGreaterThan(0.6); expect(ok / tested).toBeGreaterThan(rnd / tested + 0.2);
  });
  it("una frase inventata sui soldi avvicina il personaggio avaro/ricco più di uno senza legami", () => {
    registerTags(cards, phrases);
    const t = inferTags("Oggi sale sulla torre chi spende tutti i soldi dei genitori in vestiti."); expect(t).not.toBeNull();
    const rich = Object.entries(cards).find(([, v]) => (v as { tipo: string[] }).tipo.includes("avaro") || (v as { temi: string[] }).temi.includes("soldi"))![0], none = Object.entries(cards).find(([, v]) => !(v as { temi: string[] }).temi.includes("soldi") && !(v as { tipo: string[] }).tipo.includes("vanitoso"))![0];
    expect(affinity(rich, "Oggi sale sulla torre chi spende tutti i soldi dei genitori in vestiti.")!).toBeGreaterThan(affinity(none, "Oggi sale sulla torre chi spende tutti i soldi dei genitori in vestiti.") ?? 0);
  });
  it("parole sconosciute → nessuna etichetta, l'affinità resta null", () => {
    expect(inferTags("xyzzy qwerty")).toBeNull(); expect(affinity("p01-i01", "xyzzy qwerty")).toBeNull();
  });
});
