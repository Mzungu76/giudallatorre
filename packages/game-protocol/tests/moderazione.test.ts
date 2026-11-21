import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { nicknameAmmesso, nomiNoti, valuta, verificaFrase } from "../src/moderazione.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const json = (p: string) => JSON.parse(readFileSync(resolve(root, p), "utf8"));

describe("moderazione: età minima e frasi vietate", () => {
  it("una frase pulita va bene a tutte le età", () => {
    const e = valuta("chi riderebbe alla propria battuta prima degli altri.");
    expect(e).toMatchObject({ vietata: false, etaMin: 6 }); expect(e.motivi).toEqual([]);
  });
  it.each([
    ["chi sarebbe il primo a dire che è tutta colpa degli altri, scemo.", 10],
    ["chi si ubriacherebbe al matrimonio del cugino.", 14],
    ["quelli che parlano di morte a cena.", 14],
    ["chi sarebbe il primo a finire a letto con l’ex.", 18],
    ["chi direbbe «che cazzo» in pubblico.", 18],
    ["i più lussuriosi.", 18],
    ["chi proverebbe la cocaina una volta.", 18],
  ])("%s → %i+", (testo, eta) => { const e = valuta(testo); expect(e.vietata).toBe(false); expect(e.etaMin).toBe(eta); });
  it.each([
    "sporco negro", "chi dice porco dio quando perde", "ti ammazzo", "muori subito", "chi è un pedofilo", "scrivimi a mario@example.com", "chiamami al 333 1234567", "guarda www.sito.it", "seguimi @mario_rossi",
  ])("vietata: %s", (t) => { const e = valuta(t); expect(e.vietata, t).toBe(true); expect(verificaFrase(t, 18).ok).toBe(false); });
  it("riconosce i camuffamenti (cifre, segni, lettere staccate o ripetute)", () => {
    for (const t of ["c4zzo", "c.a.z.z.o", "c a z z o", "ca*zo", "caaazzzo", "CAZZO", "m3rd4"]) expect(valuta(`chi dice ${t}`).etaMin, t).toBeGreaterThanOrEqual(14);
    expect(valuta("chi dice f4nculo").etaMin).toBe(18);
  });
  it("non scambia parole innocue per parolacce (nessun falso positivo sulle parole con una radice dentro)", () => {
    for (const t of ["chi usa la cazzuola", "chi ama la pasta alla puttanesca", "chi indossa una culotte", "chi gioca a scopa", "chi legge un articolo", "chi studia la cultura", "chi ha un tetto", "chi cerca lo stronzio", "chi prende un 10 e un 20 a scuola"]) {
      const e = valuta(t); expect(e.vietata, t).toBe(false); expect(e.etaMin, t).toBe(6);
    }
  });
  it("verificaFrase: ammessa solo se l'età scelta basta", () => {
    expect(verificaFrase("chi si ubriacherebbe al matrimonio.", 10)).toMatchObject({ ok: false, motivoBlocco: "eta", etaMin: 14 });
    expect(verificaFrase("chi si ubriacherebbe al matrimonio.", 14)).toMatchObject({ ok: true, motivoBlocco: null });
    expect(verificaFrase("ti ammazzo", 18)).toMatchObject({ ok: false, motivoBlocco: "vietata" });
  });
  it("la frase più restrittiva decide: più categorie si prende la più alta", () => {
    expect(valuta("chi è morto ubriaco dopo il sesso").etaMin).toBe(18);
  });
});

describe("moderazione: nomi di persona e nickname", () => {
  it("segnala i nomi di persona a metà frase che non sono noti; ignora inizio frase, sigle, luoghi, marchi e nomi noti", () => {
    expect(valuta("chi litigherebbe con Marco al bar.").nomiSospetti).toEqual(["Marco"]);
    expect(valuta("Marco chi sarebbe il primo a scappare.").nomiSospetti).toEqual([]);
    expect(valuta("chi andrebbe a Roma con WhatsApp aperto e la TV accesa.").nomiSospetti).toEqual([]);
    const noti = nomiNoti(["Donald Trump – Stati Uniti", "Giorgia Meloni – Italia"]);
    expect(valuta("chi imiterebbe Donald Trump e Giorgia Meloni a cena.", { nomiNoti: noti }).nomiSospetti).toEqual([]);
    expect(valuta("chi imiterebbe Donald Trump a cena.").nomiSospetti).toEqual(["Donald", "Trump"]);
  });
  it("un nickname va bene a tutte le età: niente volgarità, parole vietate o dati personali", () => {
    for (const ok of ["Marta", "Il Re del Divano", "Gino_88", "Anonimo"]) expect(nicknameAmmesso(ok), ok).toBe(true);
    for (const no of ["Merdaccia", "stronzo", "negro", "ti ammazzo", "mario@x.it", "3331234567", "porco dio"]) expect(nicknameAmmesso(no), no).toBe(false);
  });
});

describe("moderazione sul mazzo del gioco (calibratura degli elenchi)", () => {
  const frasi = json("content/frasi-megafono.json").frasi as { id: string; testo: string; eta: string }[];
  const conf = json("content/confessioni.json").confessioni as { id: string; testo: string; eta: string }[];
  const cat = json("public/espansioni/catalogo.json").mazzi as { id: string; frasiMegafono?: { testo: string; eta: string }[] }[];
  /** Eccezioni note: il contesto cambia il senso, le regole non lo vedono (si resta prudenti). */
  const ECCEZIONI = new Set(["chi sarebbe il primo a tradire sotto interrogatorio.", "Ammetto di aver tradito la fiducia di uno dei personaggi sopra la Torre, almeno una volta."]);
  it("nessuna frase del mazzo base e dei mazzi di espansione richiede un'età maggiore di quella che ha già (a parte eccezioni note)", () => {
    const tutte = [...frasi, ...conf, ...cat.flatMap((m) => (m.frasiMegafono ?? []).map((f, i) => ({ id: `${m.id}-${i}`, ...f })))];
    const troppo = tutte.filter((x) => !ECCEZIONI.has(x.testo)).filter((x) => { const e = valuta(x.testo); return e.vietata || e.etaMin > parseInt(x.eta); }).map((x) => `${x.eta}: ${x.testo}`);
    expect(troppo, "elenchi troppo severi per queste frasi: correggi content/moderazione.json (o aggiungi un'eccezione se è davvero ambigua)").toEqual([]);
  });
  it("copre almeno una parte delle frasi 14+ e 18+ (soglia minima: gli elenchi non devono peggiorare)", () => {
    const rec = (a: number) => { const g = frasi.filter((x) => parseInt(x.eta) === a); return g.filter((x) => valuta(x.testo).etaMin >= a).length / g.length; };
    expect(rec(14)).toBeGreaterThan(0.18); expect(rec(18)).toBeGreaterThan(0.28);
  });
});
