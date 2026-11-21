import { describe, expect, it } from "vitest";
import { LIMITI, annulla, calcola, chiudiPrima, creaTorre, nickname, normalizzaFrase, segnala, statoDi, vista, vota } from "../src/torriCore.ts";
import type { Creazione, Contesto } from "../src/torriCore.ts";

const ctx: Contesto = { cartaValida: (id) => /^p\d\d-i\d\d$/.test(id) };
const base = (o: Partial<Creazione> = {}): Creazione => ({ carte: ["p01-i01", "p01-i02", "p01-i03", "p01-i04"], frase: "chi riderebbe alla propria battuta.", segnalino: { pos: 1, effetto: "cade" }, votoAutore: 3, durata: "24h", ...o });
const crea = (o: Partial<Creazione> = {}, now = 1_000_000) => creaTorre(base(o), ctx, "abc123", "h", now);
const err = (f: () => unknown) => { try { f(); } catch (e) { return (e as { codice?: string }).codice ?? String(e); } return null; };

describe("creazione di una torre", () => {
  it("accetta una torre valida; durate 24h / 3g / 7g; età dalla moderazione", () => {
    const d = crea(); expect(d.chiude - d.creata).toBe(24 * 3600_000); expect(d.eta).toBe(6); expect(d.verbo).toBe("sale");
    expect(crea({ durata: "7g" }).chiude - 1_000_000).toBe(7 * 24 * 3600_000);
    expect(crea({ frase: "i più generosi con i soldi." }).verbo).toBe("salgono");
    expect(crea({ frase: "chi si ubriacherebbe al matrimonio." }).eta).toBe(14);
    expect(crea({ frase: "chi direbbe che cazzo in pubblico.", eta: 18 }).eta).toBe(18);
  });
  it("l'età scelta può solo salire; la frase vietata o con nomi di persona è rifiutata (salvo personaggio pubblico)", () => {
    expect(crea({ frase: "chi riderebbe alla propria battuta.", eta: 14 }).eta).toBe(14);
    expect(err(() => crea({ frase: "chi si ubriacherebbe al matrimonio.", eta: 10 }))).toBe("FRASE_ETA");
    expect(err(() => crea({ frase: "chi scrive a mario@example.com e dice ti ammazzo." }))).toBe("FRASE_VIETATA");
    expect(err(() => crea({ frase: "chi litigherebbe con Marco al bar." }))).toBe("NOME_PERSONA");
    expect(crea({ frase: "chi litigherebbe con Marco al bar.", personaggioPubblico: true }).personaggioPubblico).toBe(true);
  });
  it("carte: da 3 a 6, senza doppioni e solo carte esistenti", () => {
    expect(err(() => crea({ carte: ["p01-i01", "p01-i02"] }))).toBe("CARTE");
    expect(err(() => crea({ carte: Array.from({ length: 7 }, (_, i) => `p01-i0${i + 1}`) }))).toBe("CARTE");
    expect(err(() => crea({ carte: ["p01-i01", "p01-i01", "p01-i02"] }))).toBe("CARTE");
    expect(err(() => crea({ carte: ["p01-i01", "p01-i02", "../x"] }))).toBe("CARTA_NON_VALIDA");
    expect(crea({ carte: ["p01-i01", "p01-i02", "p01-i03", "p01-i04", "p01-i05", "p01-i06"], segnalino: { pos: 6, effetto: "noncade" }, votoAutore: 2 }).carte).toHaveLength(6);
  });
  it("segnalino e voto dell'autore: posizioni valide; con VOTI NULLI l'autore non vota quella carta", () => {
    expect(err(() => crea({ segnalino: { pos: 9, effetto: "cade" } }))).toBe("SEGNALINO");
    expect(err(() => crea({ segnalino: { pos: 1, effetto: "boh" as never } }))).toBe("SEGNALINO");
    expect(err(() => crea({ votoAutore: 0 }))).toBe("VOTO");
    expect(err(() => crea({ segnalino: { pos: 2, effetto: "nulli" }, votoAutore: 2 }))).toBe("VOTO");
    expect(err(() => crea({ durata: "1h" }))).toBe("DURATA");
  });
  it("normalizza la frase", () => { expect(normalizzaFrase("  Oggi sale sulla torre   Chi RIDE  ")).toEqual({ testo: "chi RIDE.", verbo: "sale" }); expect(normalizzaFrase("I più veloci").verbo).toBe("salgono"); });
});

describe("voto, risultati e privacy", () => {
  it("un dispositivo vota una volta; il segnalino e il voto dell'autore restano nascosti finché è aperta", () => {
    const d = crea(); vota(d, "a", 2, 1_100_000);
    expect(err(() => vota(d, "a", 3, 1_100_001))).toBe("GIA_VOTATO"); expect(err(() => vota(d, "b", 9, 1_100_002))).toBe("VOTO");
    const v = vista(d, 1_200_000, "a") as Record<string, unknown>;
    expect(v.stato).toBe("aperta"); expect(v.mioVoto).toBe(2); expect(v.posSegnalino).toBe(1); expect(v).not.toHaveProperty("risultati");
    expect(JSON.stringify(v)).not.toContain("votoAutore"); expect(JSON.stringify(v)).not.toContain("effetto"); expect(JSON.stringify(v)).not.toContain('"dev"');
  });
  it("dopo la scadenza non si vota più e compaiono i risultati", () => {
    const d = crea(); vota(d, "a", 3, 1_100_000);
    expect(err(() => vota(d, "b", 3, d.chiude + 1))).toBe("CHIUSA");
    const v = vista(d, d.chiude + 1, "a") as { stato: string; risultati: { conteggi: number[]; cadono: number[] } };
    expect(v.stato).toBe("chiusa"); expect(v.risultati.conteggi).toEqual([0, 0, 2, 0]); expect(v.risultati.cadono).toEqual([3]);
  });
  it("punti come nel gioco: +2 voto giusto, CADE +4, pari punti vince chi ha votato prima, Anonimo di default", () => {
    const d = crea({ segnalino: { pos: 3, effetto: "cade" }, votoAutore: 3 });   // l'autore vota la 3
    vota(d, "a", 1, 10); vota(d, "b", 3, 20); vota(d, "c", 3, 30); vota(d, "d", 2, 40); nickname(d, "b", "Giulia");
    const r = calcola(d, "c"); expect(r.conteggi).toEqual([1, 1, 3, 0]); expect(r.cadono).toEqual([3]); expect(r.segnalinoCaduta).toBe(true);
    expect(r.classifica.map((x) => [x.nick, x.punti])).toEqual([["Giulia", 6], ["Anonimo", 6], ["Anonimo", 0], ["Anonimo", 0]]);
    expect(r.classifica[1]!.tu).toBe(true); expect(r.percento).toEqual([20, 20, 60, 0]);
  });
  it("NON CADE: +2 a chi vota la carta se resta su; VOTI NULLI: i voti su quella carta non contano", () => {
    const d = crea({ segnalino: { pos: 1, effetto: "noncade" }, votoAutore: 2 }); vota(d, "a", 1, 10); vota(d, "b", 2, 20); vota(d, "c", 2, 30);
    expect(calcola(d).classifica.map((x) => [x.punti])).toEqual([[2], [2], [2]]);   // b e c +2 (la carta 2 cade), a +2 (NON CADE: la carta 1 resta su)
    const n = crea({ segnalino: { pos: 1, effetto: "nulli" }, votoAutore: 2 }); vota(n, "a", 1, 10); vota(n, "b", 1, 20); vota(n, "c", 3, 30);
    const r = calcola(n); expect(r.conteggi).toEqual([0, 1, 1, 0]); expect(r.annullati).toBe(2); expect(r.cadono).toEqual([2, 3]);
  });
});

describe("nickname, annullamento, chiusura anticipata, segnalazioni", () => {
  it("nickname moderato (Anonimo se vuoto), solo per chi ha votato", () => {
    const d = crea(); vota(d, "a", 1, 10);
    expect(nickname(d, "a", "  Marta  ")).toBe("Marta"); expect(nickname(d, "a", "")).toBe("Anonimo"); expect(err(() => nickname(d, "a", "stronzo"))).toBe("NICK"); expect(err(() => nickname(d, "x", "Ok"))).toBe("VOTO");
  });
  it("annullo libero per 10 minuti, solo l'autore; poi chiusura anticipata con motivo e «CHIUDI»", () => {
    const d = crea({}, 5_000_000);
    expect(err(() => annulla(d, false, 5_000_100))).toBe("NON_AUTORE"); expect(err(() => annulla(d, true, 5_000_000 + LIMITI.annullaMs + 1))).toBe("TARDI");
    const e = crea({}, 5_000_000); vota(e, "a", 2, 5_000_500);
    expect(err(() => chiudiPrima(e, true, "frase", "chiudi?", 5_000_000 + LIMITI.annullaMs + 5))).toBe("CONFERMA");
    expect(err(() => chiudiPrima(e, true, "boh", "CHIUDI", 5_000_000 + LIMITI.annullaMs + 5))).toBe("CONFERMA");
    chiudiPrima(e, true, "frase", " chiudi ", 5_000_000 + LIMITI.annullaMs + 5);
    expect(statoDi(e, 5_000_000 + LIMITI.annullaMs + 6)).toBe("chiusa"); expect((vista(e, 5_000_000 + LIMITI.annullaMs + 6) as { chiusaPrima: boolean }).chiusaPrima).toBe(true);
    annulla(d, true, 5_000_100); expect(statoDi(d, 5_000_200)).toBe("annullata"); expect((vista(d, 5_000_200) as { carte: string[] }).carte).toEqual([]);
  });
  it("con 3 segnalazioni di dispositivi diversi la torre si nasconde (una per dispositivo)", () => {
    const d = crea(); segnala(d, "a"); segnala(d, "a"); segnala(d, "b"); expect(statoDi(d, 1_000_100)).toBe("aperta"); segnala(d, "c");
    expect(statoDi(d, 1_000_100)).toBe("nascosta"); expect(JSON.stringify(vista(d, 1_000_100))).not.toContain("riderebbe");
  });
});
