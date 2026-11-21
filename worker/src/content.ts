import manifest from "../../public/cards/manifest.json";
import frasi from "../../content/frasi-megafono.json";
import confessioni from "../../content/confessioni.json";
import { buildPhraseDeck, parseAge, registerTags, registerTagsV2, registerStereotypes, registerRoles, registerLooks, fullPhrase } from "@gdt/game-engine";
import type { PhraseCard, PhraseFamily, PoolConfession, PoolPhrase } from "@gdt/game-engine";
import tagsCards from "../../content/tags-personaggi.json";
import tagsPhrases from "../../content/tags-frasi.json";
import etPersonaggi from "../../content/etichette/personaggi.v2.json";
import etFrasi from "../../content/etichette/frasi.v2.json";
import ruoliJson from "../../content/etichette/ruoli.json";
import aspettoJson from "../../content/etichette/aspetto.json";
import stereotipi from "../../content/etichette/stereotipi.json";
import accuse from "../../content/accuse.json";
import catalogo from "../../public/espansioni/catalogo.json";

/** Accuse del mini-gioco di metà partita (testo + etichette nascoste per i bot). */
export const ACCUSE_DECK: string[] = (accuse as { testo: string }[]).map((a) => a.testo);

/** 120 carte Personaggio (125 immagini nel PDF, ma 5 sono livelli sovrapposti a un'altra carta: vedi tools/fix_overlays.py). */
export const DECK: string[] = (manifest as { id: string; overlay_of?: string }[]).filter((m) => !m.overlay_of).map((m) => m.id);

/** Riserva di frasi del Megafono e confessioni «Ammetto…», con la fascia d'età di ciascuna. Il mazzo di una partita si costruisce da qui (buildPhraseDeck). */
export const PHRASE_POOL: PoolPhrase[] = (frasi.frasi as { id: string; testo: string; verbo: string; famiglia: string; eta: string }[])
  .map((f) => ({ id: f.id, text: f.testo, verb: f.verbo as "sale" | "salgono", family: f.famiglia as PhraseFamily, age: parseAge(f.eta) }));
export const CONFESSIONS: PoolConfession[] = (confessioni.confessioni as { id: string; testo: string; eta: string }[])
  .map((c) => ({ id: c.id, text: c.testo, age: parseAge(c.eta) }));
/** Mazzo di riferimento per strumenti e prove (tutte le età, seme fisso). Le stanze costruiscono il proprio mazzo all'avvio. */
export const PHRASE_DECK: PhraseCard[] = buildPhraseDeck(PHRASE_POOL, CONFESSIONS, { age: 18, seed: 1 });

/**
 * Espansioni (mazzi extra, vedi docs/ESPANSIONI.md): per ognuna le carte Personaggio (`<id>-cNN`), le frasi del Megafono e le etichette per i bot,
 * tutte descritte da `public/espansioni/catalogo.json` (lo scrive lo strumento `/crea-mazzo.html`). Per un mazzo nuovo basta aggiungerlo al catalogo.
 */
type T2 = { tipi: Record<string, number>; temi: Record<string, number> };
type EtCat = { tipi?: Record<string, number>; temi?: Record<string, number>; ruoli?: string[]; aspetto?: string[] } | null;
type MazzoCat = { id: string; carte: number; stato: string; frasiMegafono?: { id: string; testo: string; verbo: string; famiglia: string; eta: string }[]; etichette?: { carte?: EtCat[]; frasi?: (EtCat)[] } };
const MAZZI = (catalogo.mazzi as MazzoCat[]).filter((m) => m.stato === "vendita");
export const EXPANSIONS: Record<string, { cards: string[]; phrases: PoolPhrase[] }> = Object.fromEntries(MAZZI.map((m) => [m.id, {
  cards: Array.from({ length: m.carte }, (_, i) => `${m.id}-c${String(i + 1).padStart(2, "0")}`),
  phrases: (m.frasiMegafono ?? []).map((f) => ({ id: f.id, text: f.testo, verb: f.verbo as "sale" | "salgono", family: f.famiglia as PhraseFamily, age: parseAge(f.eta) })),
}]));
/** Etichette dei bot delle espansioni: v2 come scritte nel catalogo; v1 (bot «attuali») ricavate dalle v2 con il vocabolario delle carte base. */
const V1_TIPO = new Set(Object.values(tagsCards as Record<string, { tipo: string[]; temi: string[] }>).flatMap((t) => t.tipo)), V1_TEMI = new Set(Object.values(tagsCards as Record<string, { tipo: string[]; temi: string[] }>).flatMap((t) => t.temi));
const top = (w: Record<string, number>, ok: Set<string>, n: number) => Object.entries(w).sort((a, b) => b[1] - a[1]).map(([k]) => k).filter((k) => ok.has(k)).slice(0, n);
const v1Di = (t: T2) => ({ tipo: top(t.tipi, V1_TIPO, 2), temi: top(t.temi, V1_TEMI, 4) });
const ET_V2_CARTE: Record<string, T2> = {}, ET_V1_CARTE: Record<string, { tipo: string[]; temi: string[] }> = {}, ET_RUOLI: Record<string, string[]> = {}, ET_ASPETTO: Record<string, string[]> = {};
const ET_V2_FRASI: Record<string, T2> = {}, ET_V1_FRASI: Record<string, { tipo: string[]; temi: string[] }> = {};
for (const m of MAZZI) {
  (m.etichette?.carte ?? []).forEach((e, i) => {
    if (!e) return; const id = `${m.id}-c${String(i + 1).padStart(2, "0")}`;
    if (e.tipi || e.temi) { const t = { tipi: e.tipi ?? {}, temi: e.temi ?? {} }; ET_V2_CARTE[id] = t; const v1 = v1Di(t); if (v1.tipo.length || v1.temi.length) ET_V1_CARTE[id] = v1; }
    if (e.ruoli?.length) ET_RUOLI[id] = e.ruoli; if (e.aspetto?.length) ET_ASPETTO[id] = e.aspetto;
  });
  (m.etichette?.frasi ?? []).forEach((e, i) => {
    const f = m.frasiMegafono?.[i]; if (!e || !f || !(e.tipi || e.temi)) return;
    const t = { tipi: e.tipi ?? {}, temi: e.temi ?? {} }, testo = fullPhrase({ verb: f.verbo as "sale" | "salgono", text: f.testo }); ET_V2_FRASI[testo] = t; ET_V1_FRASI[testo] = v1Di(t);
  });
}

/** Etichette nascoste per i giocatori virtuali (mai inviate ai client). */
registerTags({ ...(tagsCards as Record<string, { tipo: string[]; temi: string[] }>), ...ET_V1_CARTE }, {
  ...ET_V1_FRASI,
  ...(tagsPhrases as Record<string, { tipo: string[]; temi: string[] }>),
  ...Object.fromEntries((accuse as { testo: string; tipo: string[]; temi: string[] }[]).map((a) => [a.testo, { tipo: a.tipo, temi: a.temi }])),
});

/** Etichette v2 (solo per il bot v2, leva TUNE.labelsV2): per testo completo della frase, in entrambe le forme del verbo. Vedi docs/ETICHETTE_V2.md. */
const frasiV2 = (etFrasi as { frasi: Record<string, T2> }).frasi;
registerTagsV2({ ...(etPersonaggi as { personaggi: Record<string, T2> }).personaggi, ...ET_V2_CARTE }, { ...ET_V2_FRASI, ...Object.fromEntries(PHRASE_POOL.flatMap((f) => {
  const t = frasiV2[f.id]; return t ? [[fullPhrase(f), t]] : [];
})) });

/** Luoghi comuni su ruoli e mestieri per i bot v2o (revisionati dal proprietario): content/etichette/stereotipi.json. */
registerRoles((ruoliJson as { ruoli: { id: string; temi: string[] }[] }).ruoli, { ...(ruoliJson as { carte: Record<string, string[]> }).carte, ...ET_RUOLI });
registerLooks({ ...(aspettoJson as { carte: Record<string, string[]> }).carte, ...ET_ASPETTO }, Object.fromEntries((aspettoJson as { aspetti: { id: string; nome: string }[] }).aspetti.map((a) => [a.id, a.nome])));
registerStereotypes((stereotipi as { voci: { ruolo: string; tratto: string; forza: number; asse?: "ruolo" | "aspetto" | "tipo" }[] }).voci);
