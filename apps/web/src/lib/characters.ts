import { ts } from "./testi.ts";
import type { TestoKey } from "./testi.ts";

/** I otto personaggi: a ogni giocatore, a inizio partita, tocca la carta (e il segnalino) del proprio colore. */
export const CHAR_COLORS = ["#e5382b", "#2f7be0", "#4aa63a", "#f4c20d", "#a94fd0", "#1fb2ae", "#f08a1c", "#ee6fa8"];
/** Nome e frase del personaggio: vivono in public/testi.json (char.N.nome / char.N.blurb). */
export const charName = (i: number) => ts(`char.${i}.nome` as TestoKey);
export const charBlurb = (i: number) => ts(`char.${i}.blurb` as TestoKey);
export const charIdx = (color: string) => Math.max(0, CHAR_COLORS.indexOf(color.toLowerCase()));
export const tokenUrl = (color: string) => `/giocatori/tok-${charIdx(color)}.webp`;
export const cardUrl = (color: string) => `/giocatori/card-${charIdx(color)}.webp`;
const rgb = (hex: string) => { const n = parseInt(hex.slice(1), 16); return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`; };
/** Sostituisce il dischetto colorato ".dc" col segnalino del personaggio (riconosciuto dal colore di sfondo). */
export function installCharDiscs() {
  if (typeof document === "undefined" || document.getElementById("char-css")) return;
  const css = CHAR_COLORS.map((c) => `.dc[style*="${rgb(c)}"],.dc[style*="${c}"]{background-image:url("${tokenUrl(c)}") !important;background-size:cover !important;background-position:center !important;background-repeat:no-repeat !important;border-width:1.5px !important;box-shadow:none !important}`).join("\n");
  const el = document.createElement("style"); el.id = "char-css"; el.textContent = css; document.head.appendChild(el);
}
