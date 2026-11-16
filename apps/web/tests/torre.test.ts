import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { TurnResult } from "@gdt/game-engine";
import { cella, dayId, daysBetween, emptyTorre, numeroDelGiorno, nuovaTorre, registra, risolvi, secondiAllaProssima, segnaVista, testoDaCondividere, torreUrl } from "../src/lib/torre.ts";
import type { Indice, Torre } from "../src/lib/torre.ts";

const idx: Indice = { inizio: "2026-11-16", date: ["2026-11-16", "2026-11-17", "2026-11-18"], riserva: 5 };
/** Risultato finto di un turno: segnalino, carte cadute, voti e punti del giocatore «me». */
const res = (eff: string, seg: number, cadute: number[], voto: number, pts: number, caught: string[] = []): TurnResult => ({ marks: [{ slot: eff, effect: eff, position: seg, hit: true, voters: [], caught }], fallenPositions: cadute, fallenPosition: cadute[0]!, votes: { me: voto }, points: { me: pts } } as unknown as TurnResult);

describe("Torre del giorno: giorno e Torre", () => {
  it("il giorno è la data di Roma un minuto fa: la nuova Torre compare a 00:01, uguale ovunque", () => {
    expect(dayId(Date.parse("2026-11-16T22:59:30Z"))).toBe("2026-11-16");   // 23:59:30 a Roma (inverno)
    expect(dayId(Date.parse("2026-11-16T23:00:30Z"))).toBe("2026-11-16");   // 00:00:30: ancora ieri
    expect(dayId(Date.parse("2026-11-16T23:01:00Z"))).toBe("2026-11-17");   // 00:01:00
    expect(dayId(Date.parse("2026-07-16T22:01:00Z"))).toBe("2026-07-17");   // estate: 00:01 con ora legale
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1); expect(numeroDelGiorno(idx, "2026-11-16")).toBe(1); expect(numeroDelGiorno(idx, "2026-11-20")).toBe(5);
  });
  it("la Torre del giorno è quella della data (o l'ultima pubblicata); senza nessuna, una di riserva", () => {
    expect(torreUrl(idx, "2026-11-17")).toBe("/oggi/2026-11-17.json"); expect(torreUrl(idx, "2026-11-25")).toBe("/oggi/2026-11-18.json");
    expect(torreUrl({ ...idx, date: [] }, "2026-11-17")).toMatch(/^\/oggi\/riserva\/\d\.json$/);
  });
  it("«Nuova!» finché non si apre la Torre di oggi", () => {
    const db = emptyTorre(); expect(nuovaTorre(db, "2026-11-16")).toBe(true); const v = segnaVista(db, "2026-11-16");
    expect(nuovaTorre(v, "2026-11-16")).toBe(false); expect(nuovaTorre(v, "2026-11-17")).toBe(true);
  });
  it("secondi alla prossima Torre (00:01 di Roma)", () => { expect(secondiAllaProssima(Date.parse("2026-11-16T22:59:00Z"))).toBe(120); expect(secondiAllaProssima(Date.parse("2026-11-16T23:01:00Z"))).toBe(86_400); });
});

describe("Torre del giorno: punti, serie e testo", () => {
  it("cella a emoji: voto giusto, annullato, carta rimasta su", () => {
    expect(cella(res("cade", 2, [2], 2, 6), "me")).toBe("🟩🔻"); expect(cella(res("cade", 2, [2], 3, 0), "me")).toBe("⬛🔻");
    expect(cella(res("nulli", 2, [3], 2, 0, ["me"]), "me")).toBe("🟥🛑"); expect(cella(res("nulli", 2, [3], 3, 2), "me")).toBe("🟩🛑"); expect(cella(res("noncade", 1, [3], 1, 0), "me")).toBe("⬛🧱");
  });
  it("i punti si sommano giorno per giorno; la serie conta i giorni di fila; la Torre di un giorno si registra una volta sola", () => {
    const a = res("cade", 2, [2], 2, 6), b = res("cade", 2, [2], 3, 2);
    let db = registra(emptyTorre(), "2026-11-16", 1, a, "me"); expect(db.totale).toBe(6); expect(db.serie).toBe(1); expect(db.giorni["2026-11-16"]!.cella).toBe("🟩🔻");
    expect(registra(db, "2026-11-16", 1, b, "me")).toBe(db);   // di nuovo lo stesso giorno: niente punti in più
    db = registra(db, "2026-11-17", 2, b, "me"); expect(db.totale).toBe(8); expect(db.serie).toBe(2); expect(db.record).toBe(2); expect(db.giocati).toBe(2);
    db = registra(db, "2026-11-20", 5, a, "me"); expect(db.serie).toBe(1); expect(db.record).toBe(2); expect(db.migliore).toBe(6);
  });
  it("testo da condividere: una riga, la serie solo se c'è, e il link", () => {
    const a = testoDaCondividere(5, "🟩🔻", 6, 1, "https://x.it/flash"), b = testoDaCondividere(5, "🟩🔻", 6, 3, "https://x.it/flash");
    expect(a.split("\n")).toEqual(["Torre n.5 🟩🔻 · 6 punti", "https://x.it/flash"]); expect(b.split("\n")[1]).toBe("Serie: 3 giorni 🔥");
  });
});

describe("Torre del giorno: le Torri generate (public/oggi)", () => {
  const dir = join(import.meta.dirname, "../../../public/oggi"), indice = JSON.parse(readFileSync(join(dir, "indice.json"), "utf8")) as Indice;
  const file = (u: string) => JSON.parse(readFileSync(join(dir, u), "utf8")) as Torre;
  const torri = (): [string, Torre][] => [...indice.date.map((d) => [d, file(`${d}.json`)] as [string, Torre]), ...Array.from({ length: indice.riserva }, (_, i) => [`riserva/${i}`, file(`riserva/${i}.json`)] as [string, Torre])];
  it("l'indice elenca i file che ci sono, in ordine, e ci sono almeno oggi e i prossimi giorni", () => {
    expect(readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map((f) => f.slice(0, 10)).sort()).toEqual(indice.date); expect([...indice.date].sort()).toEqual(indice.date);
    expect(indice.date.length).toBeGreaterThanOrEqual(4); expect(readdirSync(join(dir, "riserva")).length).toBe(indice.riserva);
  });
  it("ogni Torre è in fase di voto con 4 carte, un segnalino e manca solo il voto del giocatore", () => {
    for (const [nome, t] of torri()) {
      const s = t.stato; expect(s.phase, nome).toBe("VOTE"); expect(s.tower.map((c) => c.position).sort()).toEqual([1, 2, 3, 4]); expect(s.marks).toHaveLength(1); expect(s.phrase!.text.length).toBeGreaterThan(10);
      expect(Object.keys(s.votes).sort()).toEqual(s.playerIds.filter((p) => p !== t.umano).sort()); expect(s.megafonoIndex === s.playerIds.indexOf(t.umano)).toBe(false);
    }
  });
  it("ogni voto si risolve col motore, ed è un dilemma: i voti non rendono tutti uguale", () => {
    for (const [nome, t] of torri()) {
      const pts = [1, 2, 3, 4].map((v) => risolvi(t, v).risultato.points[t.umano]!);
      expect(new Set(pts).size, `${nome}: punti ${pts}`).toBeGreaterThan(1);
    }
  });
});
