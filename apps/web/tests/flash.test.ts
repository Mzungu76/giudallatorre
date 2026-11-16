import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { TurnResult } from "@gdt/game-engine";
import { cella, daysBetween, emptyFlash, numeroDelGiorno, registra, risolvi, secondiAMezzanotte, testoDaCondividere, torreIndex } from "../src/lib/flash.ts";
import type { Indice, Torre } from "../src/lib/flash.ts";

const idx: Indice = { inizio: "2026-11-16", giorni: 120 };
/** Risultato finto di un turno: segnalino, carte cadute, voti e punti del giocatore «me». */
const res = (eff: string, seg: number, cadute: number[], voto: number, pts: number, caught: string[] = []): TurnResult => ({ marks: [{ slot: eff, effect: eff, position: seg, hit: true, voters: [], caught }], fallenPositions: cadute, fallenPosition: cadute[0]!, votes: { me: voto }, points: { me: pts } } as unknown as TurnResult);

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
    expect(cella(res("cade", 2, [2], 2, 6), "me")).toBe("🟩🔻"); expect(cella(res("cade", 2, [2], 3, 0), "me")).toBe("⬛🔻");
    expect(cella(res("nulli", 2, [3], 2, 0, ["me"]), "me")).toBe("🟥🛑"); expect(cella(res("nulli", 2, [3], 3, 2), "me")).toBe("🟩🛑"); expect(cella(res("noncade", 1, [3], 1, 0), "me")).toBe("⬛🧱");
  });
  it("i punti si sommano; la serie conta solo la Torre del giorno nei giorni di fila", () => {
    const a = res("cade", 2, [2], 2, 6), b = res("cade", 2, [2], 3, 2);
    let db = registra(emptyFlash(), "2026-11-16", 1, 0, a, "me"); expect(db.totale).toBe(6); expect(db.serie).toBe(1); expect(db.giorni["2026-11-16"]!.cella).toBe("🟩🔻");
    db = registra(db, "2026-11-16", 1, 1, b, "me"); expect(db.totale).toBe(8); expect(db.serie).toBe(1); expect(db.giocati).toBe(2); expect(db.oggi).toEqual({ day: "2026-11-16", k: 2 });
    db = registra(db, "2026-11-17", 2, 0, a, "me"); expect(db.serie).toBe(2); expect(db.record).toBe(2);
    db = registra(db, "2026-11-20", 5, 0, a, "me"); expect(db.serie).toBe(1); expect(db.record).toBe(2); expect(db.migliore).toBe(6);
  });
  it("testo da condividere: una riga, la serie solo se c'è, e il link", () => {
    const a = testoDaCondividere(5, "🟩🔻", 6, 1, "https://x.it/flash"), b = testoDaCondividere(5, "🟩🔻", 6, 3, "https://x.it/flash");
    expect(a.split("\n")).toEqual(["Flash n.5 🟩🔻 · 6 punti", "https://x.it/flash"]); expect(b.split("\n")[1]).toBe("Serie: 3 giorni 🔥");
  });
});

describe("Flash: le Torri generate (public/oggi)", () => {
  const dir = join(import.meta.dirname, "../../../public/oggi"), indice = JSON.parse(readFileSync(join(dir, "indice.json"), "utf8")) as Indice;
  const torri = (): Torre[] => Array.from({ length: indice.giorni }, (_, i) => JSON.parse(readFileSync(join(dir, `${i}.json`), "utf8")) as Torre);
  it("ci sono tutte, ognuna in fase di voto con 4 carte, un segnalino e manca solo il voto del giocatore", () => {
    expect(readdirSync(dir).filter((f) => /^\d+\.json$/.test(f)).length).toBe(indice.giorni);
    for (const [i, t] of torri().entries()) {
      const s = t.stato; expect(s.phase, `Torre ${i}`).toBe("VOTE"); expect(s.tower.map((c) => c.position).sort()).toEqual([1, 2, 3, 4]); expect(s.marks).toHaveLength(1); expect(s.phrase!.text.length).toBeGreaterThan(10);
      expect(Object.keys(s.votes).sort()).toEqual(s.playerIds.filter((p) => p !== t.umano).sort()); expect(s.megafonoIndex === s.playerIds.indexOf(t.umano)).toBe(false);
    }
  });
  it("ogni voto si risolve col motore, ed è un dilemma: i voti non rendono tutti uguale", () => {
    for (const [i, t] of torri().entries()) {
      const pts = [1, 2, 3, 4].map((v) => risolvi(t, v).risultato.points[t.umano]!);
      expect(new Set(pts).size, `Torre ${i}: punti ${pts}`).toBeGreaterThan(1);
    }
  });
});
