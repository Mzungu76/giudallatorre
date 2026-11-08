import type { ReactNode } from "react";
import type { PlayerView } from "@gdt/game-engine";
import { MINI } from "./minis.ts";

/** Cosa fare adesso e dove toccare: i selettori sono in ordine di priorità (il primo che si vede riceve la freccia). */
export interface Hint { text: ReactNode; targets: string[] }

/**
 * Il suggerimento per il giocatore in questo momento, o null se non deve fare nulla (tocca agli altri).
 * Serve sia ai fumetti che compaiono se si resta fermi sia al pulsante «Cosa devo fare adesso?» del menu Aiuto.
 */
export function hintFor(v: PlayerView): Hint | null {
  const mine = v.players.find((p) => p.id === v.viewerId), isMega = v.viewerId === v.megafonoId;
  const act = (sel: string) => `${sel}:not([disabled])`;
  switch (v.phase) {
    case "PROCLAIM":
      return isMega && v.proclaimCard ? { text: <>Tocca la frase che vuoi urlare, poi premi <b>Proclama</b>. Puoi anche inventarne una.</>, targets: [act('[data-testid="phrase-go"]'), '[data-testid="phrase-0"]'] } : null;
    case "PLAY":
      return !mine?.hasPlayed && (v.megafonoSa || !isMega) ? { text: <>Scegli il personaggio che somiglia di più alla frase e premi <b>Gioca questa carta</b>. Nessuno vede cosa giochi.</>, targets: [act('[data-testid="play-card"]'), '[data-testid="hand"] .card.cur'] } : null;
    case "SUSPECT":
      return isMega ? { text: <>Tocca la carta su cui scommetti, poi scegli il gettone: più voti scommetti, più punti fai se li prende.</>, targets: ['.lui-opts button:not([disabled])', 'button.hit'] } : null;
    case "VOTE":
      return v.myVote === null ? { text: <>Vota la carta che somiglia di più alla frase, anche la tua. Se cade e l’hai votata: <b>+2 punti</b>.</>, targets: [act('[data-testid="confirm-vote"]'), 'button.hit'] } : null;
    case "MINI_PLAY":
      return !mine?.hasPlayed && v.mini ? { text: <>{MINI[v.mini.kind].play}</>, targets: [act('[data-testid="play-card"]'), '[data-testid="hand"] .card.cur'] } : null;
    case "MINI_VOTE":
      return v.myVote === null && v.mini ? { text: <>{MINI[v.mini.kind].vote}</>, targets: [act('[data-testid="confirm-vote"]'), 'button.hit'] } : null;
    default:
      return null;
  }
}
