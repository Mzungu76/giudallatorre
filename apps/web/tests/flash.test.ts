import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cella, daysBetween, emptyFlash, numeroDelGiorno, registra, secondiAMezzanotte, testoDaCondividere, torreIndex } from "../src/lib/flash.ts";
import type { Indice, Torre } from "../src/lib/flash.ts";

const idx: Indice = { inizio: "2026-11-16", giorni: 120 };
const torre = (eff: string, seg: number, cadute: number[], pts: Record<number, number>): Torre => ({ v: 1, n: 0, carte: [1, 2, 3, 4].map((p) => ({ pos: p, id: "c" + p })), frase: "f", megafono: "Ada", segnalino: seg,
  esiti: Object.fromEntries([1, 2, 3, 4].map((v) => [v, { pts: pts[v] ?? 0, cadute, voti: { a: 1, b: 2, c: 3, d: v }, segnalino: { effetto: eff, riuscito: true }, annullati: eff === "nulli" ? 1 : 0 }])) });

describe("Flash: giorno e Torre", () => {
  it("la Torre del giorno cambia ogni giorno, si ripete dopo l'ultima e le altre del giorno sono diverse", () => {
    expect(daysBetween("2026-11-16", "2026-11-17")).toBe(1); expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(torreIndex(idx, "2026-11-16")).toBe(0); expect(torreIndex(idx, "2026-11-17")).toBe(1); expect(torreIndex(idx, "2027-03-16")).toBe(0); expect(torreIndex(idx, "2026-11-10")).toBe(114);
    const k = new Set([0, 1, 2, 3, 4, 5].map((i) => torreIndex(idx, "2026-11-20", i))); expect(k.size).toBe(6);
    expect(numeroDelGiorno(idx, "2026-11-16")).toBe(1); expect(numeroDelGiorno(idx, "2026-11-20")).toBe(5);
  });
  it("mezzanotte: secondi che restano nel giorno", () => { expect(secondiAMezzanotte(new Date(2026, 10, 16, 23, 59, 0))).toBe(60); expect(secondiAMezzanotte(new Date(2026, 10, 16, 0, 0, 0))).toBe(86400); });
});

describe("Flash: punti, serie e testo", () => {
  it("cella a emoji: voto giusto, annullato, carta rimasta su", () => {
    expect(cella(torre("cade", 2, [2], {}), 2)).toBe("🟩🔻"); expect(cella(torre("cade", 2, [2], {}), 3)).toBe("⬛🔻");
    expect(cella(torre("nulli", 2, [3], {}), 2)).toBe("🟥🛑"); expect(cella(torre("nulli", 2, [3], {}), 3)).toBe("🟩🛑"); expect(cella(torre("noncade", 1, [3], {}), 1)).toBe("⬛🧱");
  });
  it("i punti si sommano; la serie conta solo la Torre del giorno nei giorni di fila", () => {
    const t = torre("cade", 2, [2], { 2: 6, 3: 2 });
    let db = registra(emptyFlash(), "2026-11-16", 1, 0, t, 2); expect(db.totale).toBe(6); expect(db.serie).toBe(1); expect(db.giorni["2026-11-16"]!.cella).toBe("🟩🔻");
    db = registra(db, "2026-11-16", 1, 1, t, 3); expect(db.totale).toBe(8); expect(db.serie).toBe(1); expect(db.giocati).toBe(2); expect(db.oggi).toEqual({ day: "2026-11-16", k: 2 });
    db = registra(db, "2026-11-17", 2, 0, t, 2); expect(db.serie).toBe(2); expect(db.record).toBe(2);
    db = registra(db, "2026-11-20", 5, 0, t, 2); expect(db.serie).toBe(1); expect(db.record).toBe(2); expect(db.migliore).toBe(6);
  });
  it("testo da condividere: una riga, la serie solo se c'è, e il link", () => {
    const a = testoDaCondividere(5, "🟩🔻", 6, 1, "https://x.it/flash"), b = testoDaCondividere(5, "🟩🔻", 6, 3, "https://x.it/flash");
    expect(a.split("\n")).toEqual(["Flash n.5 🟩🔻 · 6 punti", "https://x.it/flash"]); expect(b.split("\n")[1]).toBe("Serie: 3 giorni 🔥");
  });
});

describe("Flash: le Torri generate (public/oggi)", () => {
  const dir = join(import.meta.dirname, "../../../public/oggi"), indice = JSON.parse(readFileSync(join(dir, "indice.json"), "utf8")) as Indice;
  it("ci sono tutte, ognuna con 4 carte, un segnalino su una carta e l'esito per ogni voto", () => {
    expect(readdirSync(dir).filter((f) => /^\d+\.json$/.test(f)).length).toBe(indice.giorni);
    for (let i = 0; i < indice.giorni; i++) {
      const t = JSON.parse(readFileSync(join(dir, `${i}.json`), "utf8")) as Torre, pos = t.carte.map((c) => c.pos);
      expect(pos).toEqual([1, 2, 3, 4]); expect(pos).toContain(t.segnalino); expect(t.frase.length).toBeGreaterThan(10);
      for (const v of pos) { const e = t.esiti[v]!; expect(e, `Torre ${i}, voto ${v}`).toBeTruthy(); expect(e.voti).toBeTruthy(); expect(Object.values(e.voti)).toContain(v); expect(e.cadute.length).toBeGreaterThan(0); }
    }
  });
  it("sono davvero un dilemma: in ogni Torre i voti non rendono tutti uguale", () => {
    let piatte = 0;
    for (let i = 0; i < indice.giorni; i++) { const t = JSON.parse(readFileSync(join(dir, `${i}.json`), "utf8")) as Torre; if (new Set(Object.values(t.esiti).map((e) => e.pts)).size < 2) piatte++; }
    expect(piatte).toBe(0);
  });
});
