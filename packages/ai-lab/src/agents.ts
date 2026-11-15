import { BOT_ENGINES, BOT_STYLES, NEUTRAL_STYLE, observe, styleById } from "@gdt/game-engine";
import type { Action, BotEngine, BotLevel, BotMemory, BotStyle, GameState, PlayerId } from "@gdt/game-engine";
import { STRATEGIC_ENGINES } from "@gdt/strategic-ai";
import type { StrategicEngine } from "@gdt/strategic-ai";

/**
 * Un partecipante dell'esperimento: motore (versione), livello e carattere. Forma abbreviata: "engine:level[:style]" (es. "baseline-1:hard", "production:medium:prudente").
 * `style`: id di un carattere (BOT_STYLES), "random" (uno a caso, diverso tra i posti come nelle stanze) oppure assente (carattere neutro).
 */
export interface AgentSpec { engine: string; level?: BotLevel; style?: string; /** Etichetta nei risultati (default: la forma abbreviata). */ label?: string }

export const LEVELS: readonly BotLevel[] = ["easy", "medium", "hard"];
export const specKey = (s: AgentSpec): string => s.label ?? `${s.engine}:${s.level ?? "medium"}${s.style ? ":" + s.style : ""}`;

export function parseSpec(text: string): AgentSpec {
  const [engine, level, style] = text.split(":");
  if (!engine) throw new Error(`partecipante non valido: "${text}"`);
  if (level && !LEVELS.includes(level as BotLevel)) throw new Error(`livello non valido "${level}" in "${text}" (easy, medium, hard)`);
  if (!BOT_ENGINES[engine] && !STRATEGIC_ENGINES[engine]) throw new Error(`motore sconosciuto "${engine}" (disponibili: ${[...Object.keys(BOT_ENGINES), ...Object.keys(STRATEGIC_ENGINES)].join(", ")})`);
  if (style && style !== "random" && !BOT_STYLES.some((x) => x.id === style)) throw new Error(`carattere sconosciuto "${style}" in "${text}"`);
  return { engine, ...(level ? { level: level as BotLevel } : {}), ...(style ? { style } : {}) };
}

/** Un giocatore al tavolo: decide dallo stato (motori legacy, che per convenzione non leggono dati nascosti) o dall'`Observation` (motori strategici, per costruzione). */
export interface Agent {
  spec: AgentSpec; key: string; level: BotLevel; styleId: string;
  decide(state: GameState, me: PlayerId, rand: () => number): Action | null;
  /** Fine turno (fase RESULTS): aggiorna la memoria. Sicuro da chiamare una volta per agente. */
  learn(state: GameState, me: PlayerId): void;
}

/** Memoria condivisa dei bot legacy (come in una stanza: una per stanza e per motore). */
export interface LegacyShared { engine: BotEngine; mem: BotMemory; lastTurn: number }
export const newLegacyShared = (engine: BotEngine): LegacyShared => ({ engine, mem: engine.newMemory(), lastTurn: 0 });

export function makeAgent(spec: AgentSpec, style: BotStyle, shared: Map<string, LegacyShared>): Agent {
  const level = spec.level ?? "medium", key = specKey(spec), legacy = BOT_ENGINES[spec.engine];
  if (legacy) {
    let sh = shared.get(spec.engine); if (!sh) { sh = newLegacyShared(legacy); shared.set(spec.engine, sh); }
    const S = sh;
    return {
      spec, key, level, styleId: style.id,
      decide: (state, me, rand) => legacy.chooseAction(state, me, level, S.mem, rand, style),
      learn: (state) => { const r = state.lastResult; if (r && r.turn > S.lastTurn) { legacy.learn(S.mem, state.tower, r); S.lastTurn = r.turn; } },
    };
  }
  const strategic = STRATEGIC_ENGINES[spec.engine] as StrategicEngine<unknown> | undefined;
  if (!strategic) throw new Error(`motore sconosciuto: ${spec.engine}`);
  const mem = strategic.newMemory();
  return {
    spec, key, level, styleId: style.id,
    decide: (state, me, rand) => strategic.decide(mem, observe(state, me), { rand, level, style }),
    learn: (state, me) => { if (state.lastResult) strategic.learn(mem, observe(state, me)); },
  };
}

/** Assegna i caratteri ai posti: quello scelto, "random" (distinti finché possibile, come in `RoomCore.freeStyle`) o neutro. */
export function resolveStyles(specs: readonly AgentSpec[], rand: () => number): BotStyle[] {
  const used = new Set<string>();
  return specs.map((s) => {
    if (!s.style) return NEUTRAL_STYLE;
    if (s.style !== "random") { used.add(s.style); return styleById(s.style); }
    const free = BOT_STYLES.filter((x) => !used.has(x.id)), pool = free.length ? free : BOT_STYLES, pick = pool[Math.floor(rand() * pool.length)]!;
    used.add(pick.id); return pick;
  });
}
