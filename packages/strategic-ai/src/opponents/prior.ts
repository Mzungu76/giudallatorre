/**
 * Prior della popolazione per l'Opponent Model: coefficienti medi (per ruolo: Folla / Megafono) e quanto un singolo può discostarsene (`sigma`).
 * Ordine dei coefficienti: vedi FEATURES in model.ts (aff, mark, own, first, last).
 * `DEFAULT_PRIOR` è prudente e fatto a mano; `prior.fitted.json` è stimato dal laboratorio sulle partite dei bot attuali
 * (`npm run lab -- fit-prior`, file prior.fitted.json) e può essere ristimato quando ci saranno dati di giocatori umani. Non è mai la verità sui giocatori: è il punto di partenza.
 */
import type { TypeGrid } from "./types.ts";

export interface OpponentPrior {
  version: 1;
  features: string[];
  /** Coefficienti medi di un votante della Folla. */ crowd: number[];
  /** Coefficienti medi del Megafono quando vota. */ mega: number[];
  /** Deviazione standard del prior individuale per coefficiente (modalità `coef` e `scale+coef`): più piccola = si fida di più della popolazione. */ sigma: number[];
  /** Deviazione standard del prior sulla scala individuale λ (media 1): quanto un giocatore può essere più o meno netto della popolazione. */ lambdaSigma: number;
  /** Distribuzione a priori sui tipi (λ, ε) della popolazione (modalità `types`); se assente, uniforme. */ types?: TypeGrid;
  fittedOn?: { source: string; games: number; seed: number; choices: number; date: string; note?: string };
}

export const DEFAULT_PRIOR: OpponentPrior = {
  version: 1, features: ["aff", "top", "mark", "own", "first", "last"],
  crowd: [0.3, 0, 0.8, 0.4, 0, 0], mega: [0.3, 0, 0.5, 0.8, 0, 0], sigma: [0.2, 0.2, 0.3, 0.3, 0.2, 0.2], lambdaSigma: 0.5,
};
