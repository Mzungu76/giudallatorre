import { legalActions } from "@gdt/game-engine";
import type { StrategicEngine } from "../api.ts";

/**
 * Agente di riferimento «a caso tra le azioni legali», costruito solo sull'osservazione. Serve a verificare tutta la catena
 * (osservazione → decisione → motore) e come avversario «casuale» della popolazione del laboratorio.
 * Non è un bot del gioco e non è collegato alle stanze.
 */
export const randomLegal: StrategicEngine<null> = {
  id: "random-legal-1", label: "Casuale (azioni legali)",
  newMemory: () => null,
  learn: () => {},
  decide: (_m, obs, ctx) => { const a = legalActions(obs); return a.length ? a[Math.floor(ctx.rand() * a.length)]! : null; },
};
