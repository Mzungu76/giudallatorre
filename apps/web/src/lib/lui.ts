import type { LuiSpec, ObjectiveSpec } from "@gdt/game-engine";
import { t, ts } from "./testi.ts";
import type { TestoKey } from "./testi.ts";

/** Testi dei segnalini Lui!: la scommessa è sul numero di voti che la carta riceve dagli ALTRI giocatori. I testi stanno in public/testi.json. */
export const luiLabel = (s: LuiSpec) => (s.effect ? ts(`lui.e.${s.effect}` as TestoKey) : s.trap ? ts("lui.gregge") : s.slot === "zero" ? ts("lui.zero") : s.k === 1 ? ts("lui.k1") : ts("lui.k", { k: s.k }));
export const luiAsk = (s: LuiSpec) => (s.trap ? ts("lui.ask.gregge") : s.slot === "zero" ? ts("lui.ask.zero") : s.k === 1 ? ts("lui.ask.k1") : ts("lui.ask.k", { k: s.k }));
/** PROPAGANDA: cosa fa il segnalino, in breve (scelta del Megafono, che parla in seconda persona). */
export const luiEffectShort = (s: LuiSpec) => ts(`g.lui.e.${s.effect}` as TestoKey, { k: s.k });
/** PROPAGANDA: cosa fa il segnalino, spiegato (popup, regolamento, estrazione). */
export const luiEffectHow = (s: LuiSpec) => t(`bui.info.e.${s.effect}` as TestoKey, { k: s.k });
/** Obiettivi contrapposti: la condizione del Megafono e quella opposta, pubblica. */
export const objCond = (o: ObjectiveSpec) => ts(`obj.c.${o.kind}` as TestoKey, { k: o.k });
export const objCondPublic = (o: ObjectiveSpec) => ts(`obj.p.${o.kind}` as TestoKey, { k: o.k });
