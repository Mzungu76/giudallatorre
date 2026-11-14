import type { LuiSpec } from "@gdt/game-engine";
import { t, ts } from "./testi.ts";
import type { TestoKey } from "./testi.ts";

/** Testi dei tre segnalini del Megafono (CADE, NON CADE, VOTI NULLI!). I testi stanno in public/testi.json. */
export const luiLabel = (s: LuiSpec) => ts(`lui.e.${s.effect ?? "nulli"}` as TestoKey);
/** Cosa fa il segnalino, in breve (scelta del Megafono, che parla in seconda persona). */
export const luiEffectShort = (s: LuiSpec) => ts(`g.lui.e.${s.effect ?? "nulli"}` as TestoKey);
/** Cosa fa il segnalino, spiegato (popup, regolamento). */
export const luiEffectHow = (s: LuiSpec) => t(`bui.info.e.${s.effect ?? "nulli"}` as TestoKey);
