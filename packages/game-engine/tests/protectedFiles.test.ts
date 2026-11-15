import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const sha = (rel: string) => createHash("sha256").update(readFileSync(new URL(rel, import.meta.url))).digest("hex");

/**
 * I bot in produzione NON si toccano finché il motore nuovo non ha dimostrato di essere migliore e il proprietario non decide il cambio.
 * Le impronte sono quelle dei file al commit 6e2f4b1 (tag baseline-ai-v1). Se questo test fallisce hai modificato i bot attuali:
 * se è voluto, aggiorna l'impronta nello stesso commit e registra il motivo in docs/AI_CHANGELOG.md.
 */
describe("bot in produzione intoccati", () => {
  it.each([
    ["ai.ts", "../src/ai.ts", "990d79ffad69212a060d0e651320e3f029f34bb8603074c00dc5716f6a5e6510"],
    ["bot.ts", "../src/bot.ts", "df506130b276348ffc866e14b31145e92e1ca77a1b48bd6d41b7e2d8db357af2"],
    ["botstyle.ts", "../src/botstyle.ts", "16ce811896a35d0622c96abd659a05d3a2a0e936396cd4fcf08e9acd503ffba1"],
  ])("%s è identico all'originale", (_n, rel, hash) => { expect(sha(rel)).toBe(hash); });

  it("la Baseline AI v1 (copia congelata) non è stata modificata", () => {
    expect(sha("../src/ai-baseline/ai.ts")).toBe("93d721f5a075cee48a48d54ed44586ef5568419003e4dbc8f313fd7bf56beff0");
  });
  it("il corpo della baseline coincide con ai.ts (stesso codice, solo gli import differiscono)", () => {
    const strip = (s: string) => s.split("\n").filter((l) => !/^import /.test(l) && !/^\s*\*|^\/\*\*/.test(l)).join("\n").trim();
    const live = readFileSync(new URL("../src/ai.ts", import.meta.url), "utf8"), base = readFileSync(new URL("../src/ai-baseline/ai.ts", import.meta.url), "utf8");
    expect(strip(base).slice(-4000)).toBe(strip(live).slice(-4000));
  });
});
