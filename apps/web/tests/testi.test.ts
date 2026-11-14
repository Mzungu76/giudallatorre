import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Guardia dei testi dell'app (public/testi.json). Se questo test fallisce, hai cambiato i testi nel codice senza
 * aggiornare il file dei testi (o viceversa): vedi docs/TESTI.md.
 */
const ROOT = join(import.meta.dirname, "../../..");
const json = JSON.parse(readFileSync(join(ROOT, "public/testi.json"), "utf8")) as { versione: number; aggiornato: string; testi: Record<string, { t: string; s: string; n?: string }> };
const keys = Object.keys(json.testi);

function walk(d: string): string[] {
  return readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.(tsx?)$/.test(f) ? [p] : []; });
}
const files = walk(join(ROOT, "apps/web/src")).filter((f) => !f.endsWith("lib/testi.ts"));
const src = files.map((f) => ({ f, s: readFileSync(f, "utf8") }));

/** Chiavi usate nel codice: letterali t("x") / ts("x") e prefissi di chiavi composte `x.${...}`. */
const used = new Set<string>(), prefixes = new Set<string>();
for (const { s } of src) {
  for (const m of s.matchAll(/\b(?:ts?|tx|txs|rawTesto)\(\s*"([a-z0-9_.]+)"/g)) used.add(m[1]!);
  for (const m of s.matchAll(/\b(?:ts?|tx|txs|rawTesto)\(\s*`([a-z0-9_.]+)\$\{/g)) prefixes.add(m[1]!);
  for (const m of s.matchAll(/"([a-z0-9_]+\.[a-z0-9_.]+)"/g)) if (m[1]! in json.testi) used.add(m[1]!); // chiave scelta con un'espressione: ts(a ? "x.si" : "x.no")
  for (const m of s.matchAll(/`([a-z0-9_]+\.[a-z0-9_.]*)\$\{/g)) prefixes.add(m[1]!);
}

describe("testi.json", () => {
  it("ha un codice di versione intero e una data", () => {
    expect(Number.isInteger(json.versione) && json.versione >= 1).toBe(true);
    expect(json.aggiornato).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("ogni chiave usata nel codice esiste nel file dei testi", () => {
    const mancanti = [...used].filter((k) => !(k in json.testi));
    expect(mancanti, "Aggiungi queste chiavi a public/testi.json").toEqual([]);
  });
  it("nessun testo è rimasto orfano (nel file ma non nel codice)", () => {
    const orfane = keys.filter((k) => !used.has(k) && ![...prefixes].some((p) => k.startsWith(p)));
    expect(orfane, "Rimuovi queste chiavi da public/testi.json (o usale nel codice)").toEqual([]);
  });
  it("ogni testo ha sezione e contenuto, e i marcatori sono bilanciati", () => {
    for (const k of keys) {
      const v = json.testi[k]!;
      expect(typeof v.t === "string" && v.t.length > 0, k).toBe(true);
      expect(typeof v.s === "string" && v.s.length > 0, k).toBe(true);
      expect((v.t.match(/\*\*/g) ?? []).length % 2, `** sbilanciati in ${k}`).toBe(0);
      expect((v.t.match(/__/g) ?? []).length % 2, `__ sbilanciati in ${k}`).toBe(0);
      expect((v.t.match(/~/g) ?? []).length % 2, `~ sbilanciate in ${k}`).toBe(0);
      expect((v.t.match(/\{/g) ?? []).length, `{ } sbilanciate in ${k}`).toBe((v.t.match(/\}/g) ?? []).length);
    }
  });
  it("le variabili {x} usate nel testo sono passate dal codice (stesso nome)", () => {
    // I segnaposto presenti nel JSON devono comparire nel file che usa la chiave, altrimenti resterebbero scritti a vuoto.
    for (const k of keys) {
      const vars = [...json.testi[k]!.t.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1]!);
      if (!vars.length) continue;
      const user = src.find(({ s }) => s.includes(`"${k}"`));
      if (!user) continue;
      for (const v of vars) expect(new RegExp(`\\b${v}\\b`).test(user.s), `${k}: il codice non passa {${v}}`).toBe(true);
    }
  });
});

describe("niente testi scritti a mano nei file già migrati", () => {
  // File completamente migrati: qui un testo italiano scritto nel codice è un errore. Aggiungi un file alla lista quando lo migri.
  const PULITI = ["components/BotProfile.tsx", "components/Intro.tsx", "components/HowTo.tsx", "components/MiniGame.tsx", "components/BUi.tsx", "lib/lui.ts", "components/Terrace.tsx", "screens/Game.tsx", "components/Standings.tsx", "components/CharIntro.tsx", "components/LuiDraw.tsx", "components/Chat.tsx", "components/Zoom.tsx", "screens/Home.tsx", "screens/Room.tsx", "screens/Display.tsx", "components/HomeTools.tsx", "lib/install.ts", "lib/characters.ts", "screens/Forms.tsx", "lib/api.ts", "hooks/useRoom.ts", "scene/fallScene.ts", "components/FinalScene.tsx", "components/HelpMenu.tsx", "components/PointsExamples.tsx", "lib/minis.ts", "lib/hints.tsx"];
  const ITA = /[A-Za-zÀ-ÿ’']{3,}(?:\s+[A-Za-zÀ-ÿ’',.!?]+){2,}/;
  for (const rel of PULITI) {
    it(rel, () => {
      const s = readFileSync(join(ROOT, "apps/web/src", rel), "utf8");
      const righe = s.split("\n").map((r, i) => ({ r, n: i + 1 })).filter(({ r }) => {
        const x = r.trim();
        if (x.startsWith("//") || x.startsWith("/*") || x.startsWith("*") || x.startsWith("import ")) return false;
        const sansCmt = x.replace(/\/\*.*?\*\//g, "").replace(/\s\/\/.*$/, "");
        const lit = [...sansCmt.matchAll(/"([^"]*)"|>([^<>{}]+)</g)].map((m) => m[1] ?? m[2] ?? "");
        return lit.some((t) => ITA.test(t) && !/^[a-z0-9_.\-:\[\]="' ]+$/i.test(t) && !/^(ex|pk|exl|mini|hint|help|intro|mega|nocard)\./.test(t));
      });
      expect(righe.map(({ r, n }) => `${n}: ${r.trim().slice(0, 100)}`), "Testo scritto a mano: spostalo in public/testi.json").toEqual([]);
    });
  }
});
