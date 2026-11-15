import type { StrategicEngine } from "./api.ts";
import { randomLegal } from "./engines/randomLegal.ts";
import { strategicMax, strategicPts, strategicWin } from "./engines/strategic.ts";
import { affinityVoter } from "./engines/affinityVoter.ts";

/** Motori strategici disponibili. Nessuno è collegato alle stanze: il Worker usa ancora solo i bot di `ai.ts` (DEFAULT_BOT_ENGINE). */
export const STRATEGIC_ENGINES: Record<string, StrategicEngine<never>> = {
  [randomLegal.id]: randomLegal as StrategicEngine<never>,
  [strategicPts.id]: strategicPts as StrategicEngine<never>,
  [strategicMax.id]: strategicMax as StrategicEngine<never>,
  [strategicWin.id]: strategicWin as StrategicEngine<never>,
  [affinityVoter.id]: affinityVoter as StrategicEngine<never>,
};
export const getStrategicEngine = (id: string): StrategicEngine<never> | undefined => STRATEGIC_ENGINES[id];
