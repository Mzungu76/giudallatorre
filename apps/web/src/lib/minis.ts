import type { MiniKind } from "@gdt/game-engine";

/** Testi dei tre mini-giochi (intervalli): titolo, passi, come si fanno punti, istruzioni di gioco e di voto. */
export interface KindInfo { title: string; icon: string; tag: string; steps: [string, string][]; /** Come si fanno punti: [valore, a chi / quando]. */ pts: [string, string][]; headCard: string | null; play: string; vote: string }
export const MINI: Record<MiniKind, KindInfo> = {
  accusa: {
    title: "L'Accusa", icon: "🔍", tag: "Qualcuno ha fatto una marachella", headCard: "L'accusatore",
    steps: [["Un personaggio accusa", "Una carta accusa un altro personaggio di una marachella."], ["Giocate il colpevole", "Ognuno gioca in segreto il personaggio che l'avrebbe fatta."], ["Si vota", "La carta più votata è il colpevole e cade dalla torre: fa punti a chi l'ha votata e a chi l'ha giocata."]],
    pts: [["voti", "Se voti il colpevole (la carta più votata, che cade): tanti punti quanti sono i suoi voti."], ["+2", "Se la carta del colpevole è la tua."]],
    play: "Chi ha fatto questa cosa? La scelta è segreta.", vote: "Puoi votare anche la tua. La più votata cade dalla torre.",
  },
  amore: {
    title: "La storia d'amore", icon: "💘", tag: "È nata una nuova coppia", headCard: "Il protagonista",
    steps: [["Un personaggio si innamora", "Una carta ha una nuova storia d'amore."], ["Giocate il partner", "Ognuno gioca in segreto la carta che gli starebbe meglio accanto."], ["Si vota", "Le carte più votate restano e fanno punti. Le altre cadono dalla torre."]],
    pts: [["voti", "Se voti una carta in testa (resta sulla torre): tanti punti quanti sono i suoi voti."], ["+2", "Se una carta in testa è la tua."]],
    play: "Chi è il partner perfetto? La scelta è segreta.", vote: "Puoi votare anche la tua. Le più votate restano, le altre cadono.",
  },
  peggiore: {
    title: "Il peggiore", icon: "👎", tag: "Chi butteresti giù oggi?", headCard: null,
    steps: [["Niente frase", "Questa volta nessuno accusa nessuno."], ["Giocate il peggiore", "Ognuno gioca in segreto il personaggio che per lui è il peggiore in assoluto."], ["Si vota chi cade", "Ognuno vota la carta da buttare giù, ma non la propria. Per ogni voto che prende la tua carta fai un punto."]],
    pts: [["+2", "Se voti una carta che cade (la più votata)."], ["+1", "Per ogni voto che prende la carta che hai giocato, cada o no."]],
    play: "Gioca il personaggio che per te è il peggiore in assoluto: più voti prende, più punti fai.", vote: "Vota la carta che butteresti giù. La tua non si può votare.",
  },
};
