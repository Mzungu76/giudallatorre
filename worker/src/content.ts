import manifest from "../../public/cards/manifest.json";
import multi from "../../content/su-sulla-torre.json";
import single from "../../content/su-sulla-torre-singola.json";
import type { PhraseCard } from "@gdt/game-engine";

/** 125 carte Personaggio (decisione utente) e 65 carte frasi: 50 da 5 frasi + 15 singole. */
export const DECK: string[] = (manifest as { id: string }[]).map((m) => m.id);
export const PHRASE_DECK: PhraseCard[] = [
  ...(multi.carte as { id: string; frasi: string[] }[]).map((c) => ({ id: c.id, phrases: c.frasi })),
  ...(single.carte as { id: string; frase: string }[]).map((c) => ({ id: c.id, phrases: [c.frase] })),
];
