/**
 * Il carattere di un bot: estratto a caso a ogni partita (non dipende dalla faccia né dal livello). Cambia COME gioca, non QUANTO è bravo:
 * la bravura la decide il livello (facile / medio / difficile) in ai.ts. Tutti i valori vanno da 0 a 1.
 */
export interface BotStyle {
  id: string;
  /** Fiducia nel proprio giudizio: 0 ondeggia, 1 netto. */ conf: number;
  /** Si accoda al gruppo: 0 va controcorrente, 1 gregario. */ herd: number;
  /** Voglia di bluffare quando è il Megafono: 0 mai, 1 spesso. */ bluff: number;
  /** Sospetto verso i segnalini degli altri: 0 ingenuo, 1 vede bluff ovunque. */ susp: number;
  /** Gusto del rischio: 0 prudente (punti sicuri), 1 temerario (CADE +4). */ risk: number;
  /** Rapidità: 0 lento a decidere, 1 impulsivo. */ speed: number;
}
const S = (id: string, conf: number, herd: number, bluff: number, susp: number, risk: number, speed: number): BotStyle => ({ id, conf, herd, bluff, susp, risk, speed });

/** Dodici caratteri (più dei bot in una stanza, così ogni partita ha una compagnia diversa). I testi per i giocatori sono `bot.stile.<id>.*` in public/testi.json. */
export const BOT_STYLES: BotStyle[] = [
  S("bluffatore", 0.7, 0.3, 0.95, 0.4, 0.8, 0.6),
  S("sospettoso", 0.6, 0.4, 0.3, 0.95, 0.4, 0.4),
  S("ingenuo", 0.3, 0.7, 0.05, 0.05, 0.5, 0.6),
  S("prudente", 0.7, 0.6, 0.2, 0.5, 0.05, 0.3),
  S("temerario", 0.6, 0.3, 0.6, 0.3, 1, 0.8),
  S("gregario", 0.4, 1, 0.15, 0.3, 0.3, 0.5),
  S("bastiancontrario", 0.7, 0, 0.6, 0.6, 0.7, 0.5),
  S("pignolo", 0.95, 0.5, 0.25, 0.7, 0.3, 0.1),
  S("impulsivo", 0.4, 0.4, 0.4, 0.2, 0.8, 1),
  S("calcolatore", 1, 0.5, 0.55, 0.65, 0.5, 0.3),
  S("distratto", 0.2, 0.6, 0.1, 0.2, 0.5, 0.4),
  S("stratega", 0.85, 0.2, 0.75, 0.75, 0.6, 0.35),
];
export const NEUTRAL_STYLE: BotStyle = S("neutro", 0.6, 0.5, 0.3, 0.4, 0.5, 0.5);
export const styleById = (id: string | undefined): BotStyle => BOT_STYLES.find((x) => x.id === id) ?? NEUTRAL_STYLE;
