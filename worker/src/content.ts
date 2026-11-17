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

/** Etichette nascoste per i giocatori virtuali (mai inviate ai client). */
registerTags(tagsCards as Record<string, { tipo: string[]; temi: string[] }>, {
  ...(tagsPhrases as Record<string, { tipo: string[]; temi: string[] }>),
  ...Object.fromEntries((accuse as { testo: string; tipo: string[]; temi: string[] }[]).map((a) => [a.testo, { tipo: a.tipo, temi: a.temi }])),
});

/** Etichette v2 (solo per il bot v2, leva TUNE.labelsV2): per testo completo della frase, in entrambe le forme del verbo. Vedi docs/ETICHETTE_V2.md. */
type T2 = { tipi: Record<string, number>; temi: Record<string, number> };
const frasiV2 = (etFrasi as { frasi: Record<string, T2> }).frasi;
registerTagsV2((etPersonaggi as { personaggi: Record<string, T2> }).personaggi, Object.fromEntries(PHRASE_POOL.flatMap((f) => {
  const t = frasiV2[f.id]; return t ? [[fullPhrase(f), t]] : [];
})));

/** Luoghi comuni su ruoli e mestieri per i bot v2o (revisionati dal proprietario): content/etichette/stereotipi.json. */
registerRoles((ruoliJson as { ruoli: { id: string; temi: string[] }[] }).ruoli, (ruoliJson as { carte: Record<string, string[]> }).carte);
registerLooks((aspettoJson as { carte: Record<string, string[]> }).carte, Object.fromEntries((aspettoJson as { aspetti: { id: string; nome: string }[] }).aspetti.map((a) => [a.id, a.nome])));
registerStereotypes((stereotipi as { voci: { ruolo: string; tratto: string; forza: number; asse?: "ruolo" | "aspetto" | "tipo" }[] }).voci);
