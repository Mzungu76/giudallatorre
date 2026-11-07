import type { LuiSpec } from "@gdt/game-engine";

/** Testi dei segnalini Lui!: la scommessa è sul numero di voti che la carta riceve dagli ALTRI giocatori. */
export const luiLabel = (s: LuiSpec) => (s.slot === "zero" ? "Nessun voto" : `Almeno ${s.k} ${s.k === 1 ? "voto" : "voti"}`);
export const luiAsk = (s: LuiSpec) => (s.slot === "zero" ? "nessuno la vota" : `${s.k === 1 ? "1 voto" : s.k + " voti"} o più`);
