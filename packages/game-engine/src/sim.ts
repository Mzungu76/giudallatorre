import { applyAction, createGame } from "./engine.ts";
import { suggestAction } from "./bot.ts";
import { nextRandom } from "./rng.ts";
import { checkInvariants } from "./invariants.ts";
import type { Action, GameConfig, GameEvent, GameState } from "./types.ts";

/** Gioca una partita completa con giocatori virtuali. `botSeed` governa le scelte dei bot (indipendente dal seed del motore). */
export function simulateGame(config: GameConfig, botSeed: number, opts: { checkEveryStep?: boolean } = {}) {
  const created = createGame(config); let state = created.state;
  let r = botSeed | 0; const rand = () => { const n = nextRandom(r); r = n.state; return n.value; };
  const log: { action: Action; events: GameEvent[] }[] = []; const problems: string[] = [];
  let guard = 0;
  while (state.phase !== "GAME_OVER") {
    if (++guard > 5000) throw new Error("simulazione non termina");
    let action: Action | null = null;
    if (state.phase === "RESULTS" || state.phase === "MINI_RESULTS") action = { type: "advance" };
    else {
      const order = state.playerIds.slice().sort(() => rand() - 0.5); // ordine casuale = azioni "simultanee"
      for (const p of order) { action = suggestAction(state, p, rand); if (action) break; }
    }
    if (!action) throw new Error(`nessuna azione possibile in fase ${state.phase}`);
    const res = applyAction(state, action); state = res.state; log.push({ action, events: res.events });
    if (opts.checkEveryStep) problems.push(...checkInvariants(state, config.deck));
  }
  problems.push(...checkInvariants(state, config.deck));
  return { state: state as GameState, log, problems, initialEvents: created.events };
}
