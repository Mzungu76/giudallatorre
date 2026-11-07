import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { simulateGame } from "../src/index.ts";
import type { PhraseCard } from "../src/index.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const json = (p: string) => JSON.parse(readFileSync(resolve(root, p), "utf8"));

describe("contenuti originali del gioco", () => {
  const manifest = json("public/cards/manifest.json") as { id: string; file?: string; duplicate_of?: string; overlay_of?: string }[];
  const multi = json("content/su-sulla-torre.json").carte as { id: string; tema: string; frasi: string[] }[];
  const single = json("content/su-sulla-torre-singola.json").carte as { id: string; frase: string }[];
  const deck = manifest.filter((m) => !m.overlay_of).map((m) => m.id);
  const phraseDeck: PhraseCard[] = [...multi.map((c) => ({ id: c.id, phrases: c.frasi })), ...single.map((c) => ({ id: c.id, phrases: [c.frase] }))];

  it("120 carte Personaggio (125 immagini, 5 sono livelli sovrapposti) con identificativi univoci", () => {
    expect(deck).toHaveLength(120); expect(new Set(deck).size).toBe(120);
  });
  it("carte frasi: 50 da 5 frasi + 15 singole, nessuna duplicata, incipit corretto (sale/salgono concordato col soggetto)", () => {
    expect(multi).toHaveLength(50); expect(multi.every((c) => c.frasi.length === 5)).toBe(true);
    expect(single).toHaveLength(15);
    const all = phraseDeck.flatMap((c) => c.phrases);
    expect(new Set(all).size).toBe(all.length);
    expect(multi.flatMap((c) => c.frasi).every((f) => /^Oggi (sale|salgono) sulla torre /.test(f))).toBe(true);
    expect(single.every((c) => c.frase.startsWith("Ammetto") && c.frase.endsWith("."))).toBe(true);
    for (const f of multi.flatMap((c) => c.frasi)) { const plural = /^Oggi salgono sulla torre (le persone|quelli|i |gli |le )/.test(f); const singular = /^Oggi sale sulla torre chi /.test(f) || /^Oggi sale sulla torre (le persone|quelli|i |gli |le )/.test(f); expect(plural || /^Oggi sale sulla torre (chi|la|il|lo|l’|un|una|quello|quella) /.test(f)).toBe(true); expect(singular && !plural && /torre (le persone|quelli)/.test(f)).toBe(false); }
  });
  it("una partita completa con i contenuti reali (8 giocatori, variante Megafono sa)", () => {
    const players = Array.from({ length: 8 }, (_, i) => ({ id: `p${i + 1}`, name: `G${i + 1}` }));
    const { state, problems } = simulateGame({ players, seed: 2026, deck, phraseDeck, megafonoSa: true }, 77, { checkEveryStep: true });
    expect(problems).toEqual([]); expect(state.phase).toBe("GAME_OVER");
  });
});
