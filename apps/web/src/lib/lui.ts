import type { LuiSpec } from "@gdt/game-engine";
import { ts } from "./testi.ts";

/** Testi dei segnalini Lui!: la scommessa è sul numero di voti che la carta riceve dagli ALTRI giocatori. I testi stanno in public/testi.json. */
export const luiLabel = (s: LuiSpec) => (s.trap ? ts("lui.gregge") : s.slot === "zero" ? ts("lui.zero") : s.k === 1 ? ts("lui.k1") : ts("lui.k", { k: s.k }));
export const luiAsk = (s: LuiSpec) => (s.trap ? ts("lui.ask.gregge") : s.slot === "zero" ? ts("lui.ask.zero") : s.k === 1 ? ts("lui.ask.k1") : ts("lui.ask.k", { k: s.k }));
