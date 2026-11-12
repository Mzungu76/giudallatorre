import type { ReactNode } from "react";
import type { PlayerView } from "@gdt/game-engine";
import { t } from "./testi.ts";

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
      return isMega && v.proclaimCard ? { text: t("hint.proclama"), targets: [act('[data-testid="phrase-go"]'), '[data-testid="phrase-0"]'] } : null;
    case "PLAY":
      return !mine?.hasPlayed && (v.megafonoSa || !isMega) ? { text: t("hint.gioca"), targets: [act('[data-testid="play-card"]'), '[data-testid="hand"] .card.cur'] } : null;
    case "SUSPECT":
      return isMega ? { text: t("hint.lui"), targets: ['.lui-opts button:not([disabled])', 'button.hit'] } : null;
    case "VOTE":
      return v.myVote === null ? { text: t("hint.vota"), targets: [act('[data-testid="confirm-vote"]'), 'button.hit'] } : null;
    case "MINI_RUN":
      return v.myVote === null && v.mini ? { text: t("mr.hint"), targets: ['[data-testid="run-vote"]'] } : null;
    default:
      return null;
  }
}
