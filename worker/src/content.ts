import manifest from "../../public/cards/manifest.json";
import frasi from "../../content/frasi-megafono.json";
import confessioni from "../../content/confessioni.json";
import { buildPhraseDeck, parseAge, registerTags } from "@gdt/game-engine";
import type { PhraseCard, PhraseFamily, PoolConfession, PoolPhrase } from "@gdt/game-engine";
import tagsCards from "../../content/tags-personaggi.json";
import tagsPhrases from "../../content/tags-frasi.json";
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
