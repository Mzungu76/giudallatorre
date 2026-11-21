import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { isStereoVote, luoghiTurno, pregiudizioTurno, PREGIUDIZIO_EVITATO, stereoExplain, stereoVoteFlags, affinityV2, affinityV2m, inferV2, registerRoles, registerStereotypes, registerTagsV2, stereoTags, STEREO_CAP, tagSimilarity } from "../src/index.ts";
import { drawLens, mulberry } from "../src/ai-v2/lens.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const json = (p: string) => JSON.parse(readFileSync(resolve(root, p), "utf8"));
type T2 = { tipi: Record<string, number>; temi: Record<string, number> };
const cat = json("content/etichette/catalogo.json") as { pesi: number[]; max_tipi: number; max_temi: number; tipi: { id: string; def: string }[]; temi: { id: string; def: string }[] };
const frasi = json("content/etichette/frasi.v2.json").frasi as Record<string, T2>;
const carte = json("content/etichette/personaggi.v2.json").personaggi as Record<string, T2>;
const T = new Set(cat.tipi.map((t) => t.id)), M = new Set(cat.temi.map((t) => t.id));
const poolIds = (json("content/frasi-megafono.json").frasi as { id: string }[]).map((f) => f.id);
const deck = (json("public/cards/manifest.json") as { id: string; overlay_of?: string }[]).filter((m) => !m.overlay_of).map((m) => m.id);

/** Anche le carte delle espansioni (<mazzo>-cNN) hanno le etichette dei bot. */
const espCarte = (json("public/espansioni/catalogo.json").mazzi as { id: string; carte: number }[]).flatMap((m) => Array.from({ length: m.carte }, (_, i) => `${m.id}-c${String(i + 1).padStart(2, "0")}`));
const deckTutte = [...deck, ...espCarte];

describe("etichette v2 (occhi dei bot)", () => {
  it("catalogo: id unici e definizione per ogni voce", () => {
    expect(new Set(cat.tipi.map((t) => t.id)).size).toBe(cat.tipi.length);
    expect(new Set(cat.temi.map((t) => t.id)).size).toBe(cat.temi.length);
    for (const v of [...cat.tipi, ...cat.temi]) expect(v.def.length, v.id).toBeGreaterThan(8);
  });
  it("ogni frase del Megafono e ogni carta ha etichette; nessuna in più", () => {
    expect(Object.keys(frasi).sort()).toEqual([...poolIds].sort());
    expect(Object.keys(carte).filter((k) => deck.includes(k)).sort()).toEqual([...deck].sort());   // le etichette delle espansioni stanno nel catalogo (public/espansioni/catalogo.json), non qui
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
  it("affinità morbida: conta le etichette imparentate (più indizi), non supera la coincidenza esatta, e per le frasi libere tace se l'indizio è debole", () => {
    const P = (t: string, tipi: Record<string, number>, temi: Record<string, number>) => [t, { tipi, temi }] as const;
    const phrases = Object.fromEntries([
      P("i più tirchi sono avari con i soldi", { avaro: 3 }, { soldi: 3 }), P("chi nasconde i soldi per non pagare", { avaro: 3, furbo: 1 }, { soldi: 3 }),
      P("chi spende troppo in vestiti e soldi", { spendaccione: 3 }, { soldi: 3 }), P("i più bravi a fare il pettegolezzo", { pettegolo: 3 }, { pettegolezzo: 3 }),
      P("chi racconta i segreti degli amici", { pettegolo: 3 }, { pettegolezzo: 2, segreti: 3 }), P("i più vanitosi con lo specchio", { vanitoso: 3 }, { vanita: 3 }),
    ]);
    registerTagsV2({ a: { tipi: { avaro: 3 }, temi: {} }, b: { tipi: { pettegolo: 3 }, temi: {} }, c: { tipi: { vanitoso: 3 }, temi: { vanita: 3 } } }, phrases);
    expect(tagSimilarity("t:avaro", "m:soldi")).toBeGreaterThan(0.5); expect(tagSimilarity("t:avaro", "t:vanitoso")).toBe(0);
    const ph = "i più tirchi sono avari con i soldi";   // tipo avaro + tema soldi
    expect(affinityV2("a", ph)).toBeGreaterThan(0);
    const esattaNoTema = { tipi: { avaro: 3 }, temi: {} };   // carta con solo il tipo: la esatta non vede il tema, la morbida sì
    registerTagsV2({ x: esattaNoTema, y: { tipi: { vanitoso: 3 }, temi: {} } }, phrases);
    expect(affinityV2("x", "chi nasconde i soldi per non pagare")!).toBeGreaterThan(0);
    expect(affinityV2m("x", "i più bravi a fare il pettegolezzo")!).toBe(0);                     // niente parentela: zero
    expect(affinityV2m("x", "chi nasconde i soldi per non pagare")!).toBeGreaterThanOrEqual(affinityV2("x", "chi nasconde i soldi per non pagare")!);
    expect(affinityV2m("x", "chi nasconde i soldi per non pagare")!).toBeGreaterThan(affinityV2m("y", "chi nasconde i soldi per non pagare")!);
    expect(inferV2("parole mai viste zorbo quibli")).toBeNull();                                  // nessun indizio: nessuna etichetta inventata
    expect(affinityV2m("x", "parole mai viste zorbo quibli")).toBeNull();                          // → il bot si affida alla storia
    registerTagsV2({}, {});
  });
  it("tabella dei luoghi comuni: solo ruoli, mestieri e sottoculture (mai corpo, età, sesso, origine), tutte etichette del catalogo, forza 1–3", () => {
    const voci = json("content/etichette/stereotipi.json").voci as { asse: "ruolo" | "aspetto" | "tipo"; ruolo: string; tratto: string; forza: number; nota: string }[];
    const ruoli = json("content/etichette/ruoli.json") as { ruoli: { id: string; def: string; temi: string[] }[]; carte: Record<string, string[]> };
    const asp = json("content/etichette/aspetto.json") as { aspetti: { id: string; def: string }[]; carte: Record<string, string[]> }, A = new Set(asp.aspetti.map((a) => a.id));
    const R = new Set(ruoli.ruoli.map((r) => r.id)), TIPI_RUOLO = new Set(["ambizioso", "festaiolo", "ribelle", "complottista"]);
    const VIETATI = /(anzian|vecchi|pension|nonn|obes|grass|sovrappeso|magr|donn|uomo|maschi|femmin|stranier|immigrat|africa|asiat|cines|orient|ebre|musulman|gay|disabil)/i;
    expect(voci.length).toBeGreaterThan(30);
    for (const v of voci) {
      expect(v.asse === "ruolo" ? R.has(v.ruolo) : v.asse === "aspetto" ? A.has(v.ruolo) : TIPI_RUOLO.has(v.ruolo), `ruolo non ammesso: ${v.asse}:${v.ruolo}`).toBe(true);
      expect(VIETATI.test(v.ruolo) || VIETATI.test(v.tratto), `categoria vietata: ${v.ruolo}→${v.tratto}`).toBe(false);
      expect(T.has(v.tratto), `tratto fuori catalogo: ${v.tratto}`).toBe(true); expect([1, 2, 3]).toContain(v.forza); expect(v.nota.length).toBeGreaterThan(3);
    }
    for (const r of ruoli.ruoli) { expect(VIETATI.test(r.id), `ruolo vietato: ${r.id}`).toBe(false); expect(r.def.length).toBeGreaterThan(5); for (const t of r.temi) expect(M.has(t), `tema ${t} di ${r.id}`).toBe(true); }
    for (const [c, rs] of Object.entries(ruoli.carte)) { expect(deckTutte.includes(c) || c === "p14-i01", c).toBe(true); for (const r of rs) expect(R.has(r), `${c}: ${r}`).toBe(true); }
    for (const a of asp.aspetti) { expect(VIETATI.test(a.id), `aspetto vietato: ${a.id}`).toBe(false); expect(a.def.length).toBeGreaterThan(5); }
    for (const [c, as] of Object.entries(asp.carte)) { expect(deckTutte.includes(c) || c === "p14-i01", c).toBe(true); for (const a of as) expect(A.has(a), `${c}: ${a}`).toBe(true); }
    expect(Object.keys(asp.carte).length).toBeGreaterThan(60);
    expect(Object.keys(ruoli.carte).length).toBeGreaterThan(70);   // copertura: oltre il 60% delle carte ha un ruolo
  });
  it("canale dei luoghi comuni: agisce solo se il bot li ha, con tetto per carta, e spegnibile", () => {
    registerTagsV2({ pol: { tipi: { politico: 3 }, temi: {} }, ord: { tipi: { avaro: 3 }, temi: {} } }, { "frase": { tipi: { ipocrita: 3 }, temi: {} }, "altra": { tipi: { vanitoso: 3 }, temi: {} } });
    registerStereotypes([{ ruolo: "politico", tratto: "ipocrita", forza: 3 }, { ruolo: "politico", tratto: "bugiardo", forza: 3 }, { ruolo: "politico", tratto: "furbo", forza: 3 }]);
    const base = drawLens(mulberry(3)), con = { ...base, stereo: 0.8, angle: 0, halo: 0 }, senza = { ...base, stereo: 0, angle: 0, halo: 0 };
    expect(stereoTags("pol", senza)).toEqual([]); expect(stereoTags("ord", con)).toEqual([]);                         // senza pregiudizio, o carta senza quel ruolo: nulla
    const tot = (l: typeof con) => stereoTags("pol", l).reduce((a, [, w]) => a + w, 0); expect(tot(con)).toBeLessThanOrEqual(STEREO_CAP + 1e-9);   // tetto
    registerStereotypes([]); registerTagsV2({}, {});
  });
  it("voto per luogo comune: conta solo se il ruolo/aspetto spiega la carta e le sue etichette no; il caso è la quota di carte così", () => {
    registerTagsV2({ pol: { tipi: { avaro: 3 }, temi: {} }, vero: { tipi: { bugiardo: 3 }, temi: {} }, neutra: { tipi: { goffo: 3 }, temi: {} } },
      { "i più bugiardi": { tipi: { bugiardo: 3 }, temi: { bugie: 3 } } });
    registerRoles([{ id: "politico", temi: ["politica"] }], { pol: ["politico"] });
    registerStereotypes([{ ruolo: "politico", tratto: "bugiardo", forza: 3, asse: "ruolo" }]);
    expect(isStereoVote(stereoExplain("pol", "i più bugiardi"))).toBe(true);        // il politico: solo il ruolo fa pensare «bugiardo»
    expect(isStereoVote(stereoExplain("vero", "i più bugiardi"))).toBe(false);      // la carta ha davvero quel tratto
    expect(isStereoVote(stereoExplain("neutra", "i più bugiardi"))).toBe(false);    // niente luogo comune
    const f = stereoVoteFlags([{ cardId: "pol", position: 1 }, { cardId: "vero", position: 2 }, { cardId: "neutra", position: 3 }], "i più bugiardi", { a: 1, b: 2, c: 1 })!;
    expect(f.voti).toEqual({ a: true, b: false, c: true }); expect(f.caso).toBeCloseTo(1 / 3, 5); expect(f.cause).toEqual({ "politico → bugiardo": 2 });
    expect(stereoVoteFlags([{ cardId: "pol", position: 1 }], "frase mai vista zorbo", { a: 1 })).toBeNull();   // frase senza etichette: nessun dato
    // luoghi comuni con i pesi: voti (1 ciascuno) + segnalino del Megafono (CADE/VOTI NULLI +1, ×1,5 se la carta ha anche voti; NON CADE senza voti: +1 alla carta caduta)
    const tl = [{ cardId: "pol", position: 1 }, { cardId: "vero", position: 2 }, { cardId: "neutra", position: 3 }], K = "politico → bugiardo";
    expect(luoghiTurno(tl, "i più bugiardi", { a: 1, b: 1, c: 2 }, [], [1])!.pesi).toEqual({ [K]: 2.5 });                                 // 2 voti + 0,5 per chi ha votato altrove (ha evitato il luogo comune)
    expect(luoghiTurno(tl, "i più bugiardi", { a: 1, b: 1, c: 2 }, [{ position: 1, effect: "cade" }], [1])!.pesi).toEqual({ [K]: 5 });     // CADE confermato dai voti: (2+1)×1,5 + 0,5 di chi l'ha evitato
    expect(luoghiTurno(tl, "i più bugiardi", { a: 1, b: 2 }, [{ position: 1, effect: "cade" }], [2])!.pesi).toEqual({ [K]: 3.5 });        // un solo voto: (1+1)×1,5 + 0,5
    expect(luoghiTurno(tl, "i più bugiardi", { a: 2, b: 2 }, [{ position: 1, effect: "nulli" }], [2])!.pesi).toEqual({ [K]: 2 });         // VOTI NULLI senza voti: +1, più 2×0,5 di chi ha votato altrove
    expect(luoghiTurno(tl, "i più bugiardi", { a: 3, b: 2 }, [{ position: 3, effect: "cade" }], [3])!.pesi).toEqual({ [K]: 1 });             // segnalino su carta senza ruolo né aspetto: non aggiunge nulla (resta il 2×0,5 di chi ha evitato)
    expect(luoghiTurno(tl, "i più bugiardi", { a: 1, b: 1 }, [{ position: 2, effect: "noncade" }], [1])!.pesi).toEqual({ [K]: 3 });       // NON CADE senza voti: +1 alla carta caduta
    expect(luoghiTurno(tl, "i più bugiardi", { a: 1, b: 1, c: 2 }, [], [1])!.lancio).toEqual({ pos: 1, n: 2, causa: K });
    // dettagli: voti diretti, segnalino (con il ×1,5), chi ha votato altrove, carte votate
    const dd = luoghiTurno(tl, "i più bugiardi", { a: 1, b: 1, c: 2 }, [{ position: 1, effect: "cade" }], [1])!.dettagli[K]!;
    expect(dd.v).toBe(2); expect(dd.m).toBe(2.5); expect(dd.e).toBe(0.5); expect(dd.c).toEqual({ pol: 2 }); expect(dd.v + dd.m + dd.e).toBe(5);   // (2+1)×1,5 = 4,5 = 2 voti + 2,5 dal segnalino; + 0,5
    expect(luoghiTurno(tl, "frase mai vista zorbo", { a: 1 }, [], [1])).toBeNull();
    // il pregiudiziometro: nessun minimo; sale con l'associazione; chi vota altrove evita il luogo comune (conta metà della carta più forte); anche il segnalino conta
    const tw = [{ cardId: "pol", position: 1 }, { cardId: "vero", position: 2 }, { cardId: "neutra", position: 3 }], g = pregiudizioTurno(tw, "i più bugiardi", { a: 1, b: 2, c: 3 }, 3)!;
    const forte = Math.max(g.voti.a!, g.voti.b!);
    expect(g.voti.c).toBeCloseTo(PREGIUDIZIO_EVITATO * forte, 5); expect(g.voti.c).toBeGreaterThan(0);   // «neutra» non ha legami con la frase: vale quanto aver evitato la carta più forte
    expect(g.voti.a).toBeGreaterThan(g.voti.c!); expect(forte).toBeLessThan(1); expect(g.lui).toBeCloseTo(g.voti.c!, 5);
    expect(pregiudizioTurno(tw, "i più bugiardi", { a: 1 })!.lui).toBeNull(); expect(pregiudizioTurno(tw, "frase mai vista zorbo", { a: 1 })).toBeNull();
    // un turno senza alcuna associazione non è misurabile: non vale zero, non c'è
    expect(pregiudizioTurno([{ cardId: "neutra", position: 1 }], "i più bugiardi", { a: 1 }, 1)!.voti).toEqual({});
    // il luogo comune porta sempre il DIFETTO PRINCIPALE della frase (non un tratto secondario che la tabella premia di più), anche se la tabella non ha la riga
    registerRoles([{ id: "politico", temi: ["politica"] }], { pol: ["politico"] });
    registerTagsV2({ pol: { tipi: { avaro: 3 }, temi: {} } }, { "i più testardi e un po' arroganti": { tipi: { testardo: 3, arrogante: 1 }, temi: {} }, "i più bravi": { tipi: { influencer: 3, vanitoso: 2 }, temi: {} } });
    registerStereotypes([{ ruolo: "politico", tratto: "arrogante", forza: 3, asse: "ruolo" }]);
    expect(stereoExplain("pol", "i più testardi e un po' arroganti")!.causa).toBe("politico → testardo");   // non «arrogante», che la tabella premia di più
    expect(stereoExplain("pol", "i più bravi")!.causa).toBe("politico → vanitoso");                           // «influencer» è un ruolo, non un difetto
    registerRoles([], {}); registerStereotypes([]); registerTagsV2({}, {});
  });
});
