/**
 * Icone disegnate nello stile del gioco: contorno blu notte spesso e arrotondato, colori pieni e vivaci (giallo, rosso, verde acqua, blu, arancio, crema).
 * Sono SVG 48×48 scritti qui (nessun file esterno): la mappa `ART` ha il disegno di ogni icona. Usate nei livelli e nelle statistiche.
 */
const N = "#13224a", Y = "#ffc72c", R = "#e8505b", T = "#14a3a1", B = "#5b7cfa", O = "#ff9f45", C = "#fff7e0", G = "#aab3c5", P = "#8e6bd8", K = "#b9824f", E = "#5bbf6a", D = "#2a3f86", S = "#9fd8ff", W = "#ffffff";
const medal = (f: string, rib: string) => `<path d="M14 4l10 18 10-18" fill="${rib}"/><circle cx="24" cy="30" r="13" fill="${f}"/><path d="M24 23l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7z" fill="${C}" stroke-width="1.8"/>`;
const thick = (d: string, c: string, w = 4) => `<path d="${d}" fill="none" stroke="${N}" stroke-width="${w + 5}"/><path d="${d}" fill="none" stroke="${c}" stroke-width="${w}"/>`;

export const ART: Record<string, string> = {
  // ---- livelli ----
  passante: `<circle cx="24" cy="10" r="5.5" fill="${C}"/><path d="M18 19h12l2 14H16z" fill="${B}"/><path d="M20 33l-3 11M28 33l3 11M18 21l-5 10M30 21l5 10"/>`,
  curioso: `<ellipse cx="15" cy="24" rx="9.5" ry="12" fill="${W}"/><ellipse cx="33" cy="24" rx="9.5" ry="12" fill="${W}"/><circle cx="17" cy="27" r="4.5" fill="${N}"/><circle cx="35" cy="27" r="4.5" fill="${N}"/>`,
  spettatore: `<circle cx="15" cy="17" r="6" fill="${C}"/><circle cx="24" cy="12" r="7" fill="${C}"/><circle cx="33" cy="17" r="6" fill="${C}"/><path d="M12 21h24l-3 23H15z" fill="${R}"/><path d="M20 21l1 23M28 21l-1 23" />`,
  sassolino: `<path d="M6 36l5-15 11-9 13 3 7 13-5 10z" fill="${G}"/><path d="M15 24l6-5" stroke="${W}" stroke-width="3"/>`,
  mattone: `<rect x="5" y="12" width="38" height="26" rx="2" fill="${R}"/><path d="M5 21h38M5 29.5h38M20 12v9M32 21v8.5M14 29.5V38M30 29.5V38"/>`,
  muratore: `${thick("M12 42L28 24", K, 4.5)}<rect x="21" y="6" width="23" height="13" rx="3" transform="rotate(42 32 12)" fill="${G}"/>`,
  secchio: `<path d="M10 17h28l-3 26H13z" fill="${T}"/><path d="M12 17c0-13 24-13 24 0" fill="none"/><rect x="9" y="15" width="30" height="5" rx="2.5" fill="${Y}"/><path d="M12 30h24"/>`,
  impalcatura: `<path d="M10 4v40M38 4v40"/><rect x="5" y="13" width="38" height="6" fill="${O}"/><rect x="5" y="27" width="38" height="6" fill="${O}"/><path d="M10 19l28 8M38 19l-28 8" fill="none"/>`,
  scala: `${thick("M13 44L18 4", K, 3.5)}${thick("M31 44L36 4", K, 3.5)}<path d="M15 33h18M16.2 23h18M17.4 13h18" stroke="${N}" stroke-width="3.2"/>`,
  porta: `<path d="M11 44V17a13 13 0 0 1 26 0v27z" fill="${B}"/><path d="M18 22h12v11H18z" fill="${D}"/><circle cx="31" cy="30" r="2.6" fill="${Y}"/><path d="M6 44h36"/>`,
  chiave: `${thick("M22 22L40 40M32 32l5-5M37 37l4-4", Y, 3.5)}<circle cx="15" cy="15" r="10" fill="${Y}"/><circle cx="15" cy="15" r="4" fill="${C}"/>`,
  campanello: `<path d="M7 36a17 17 0 0 1 34 0z" fill="${Y}"/><rect x="4" y="36" width="40" height="7" rx="3.5" fill="${O}"/><rect x="21" y="11" width="6" height="6" rx="1.5" fill="${G}"/><path d="M14 30a10 10 0 0 1 6-8" stroke="${W}" stroke-width="2.6"/>`,
  ascensore: `<rect x="9" y="9" width="30" height="35" rx="2" fill="${G}"/><rect x="13" y="13" width="10.5" height="27" fill="${C}"/><rect x="24.5" y="13" width="10.5" height="27" fill="${C}"/><path d="M24 2l5 6h-10z" fill="${R}" stroke-width="2"/>`,
  finestra: `<rect x="8" y="5" width="32" height="38" rx="3" fill="${K}"/><rect x="12" y="9" width="11" height="14" fill="${S}"/><rect x="25" y="9" width="11" height="14" fill="${S}"/><rect x="12" y="25" width="11" height="14" fill="${S}"/><rect x="25" y="25" width="11" height="14" fill="${S}"/>`,
  balcone: `<path d="M24 28v16" stroke="${E}" stroke-width="4"/><path d="M24 36c-6-1-9-4-9-8 5 0 8 3 9 8zM24 38c6-1 9-4 9-8-5 0-8 3-9 8z" fill="${E}"/><circle cx="24" cy="8" r="7" fill="${R}"/><circle cx="34" cy="15" r="7" fill="${R}"/><circle cx="30" cy="26" r="7" fill="${R}"/><circle cx="18" cy="26" r="7" fill="${R}"/><circle cx="14" cy="15" r="7" fill="${R}"/><circle cx="24" cy="18" r="6.5" fill="${Y}"/>`,
  pettegolo: `<path d="M8 8h32a3 3 0 0 1 3 3v19a3 3 0 0 1-3 3H23l-9 9v-9H8a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3z" fill="${C}"/><circle cx="15" cy="20" r="2.8" fill="${N}"/><circle cx="24" cy="20" r="2.8" fill="${N}"/><circle cx="33" cy="20" r="2.8" fill="${N}"/>`,
  carte: `<g transform="rotate(-14 20 26)"><rect x="8" y="7" width="23" height="33" rx="3.5" fill="${C}"/><path d="M19.5 31c-7-5-7-12-3-13 2 0 3 1 3 2 0-1 1-2 3-2 4 1 4 8-3 13z" fill="${N}" stroke-width="1.5"/></g><g transform="rotate(12 30 26)"><rect x="19" y="8" width="23" height="33" rx="3.5" fill="${C}"/><path d="M30.5 16l5 8-5 8-5-8z" fill="${R}" stroke-width="2"/></g>`,
  urna: `<rect x="7" y="20" width="34" height="23" rx="3" fill="${B}"/><rect x="14" y="19" width="20" height="5" rx="2.5" fill="${N}"/><rect x="17" y="4" width="14" height="19" rx="1.5" fill="${C}"/><path d="M16 34l5 5 10-11" stroke="${W}" stroke-width="4"/>`,
  spillo: `<path d="M24 45C14 31 11 25 11 18a13 13 0 0 1 26 0c0 7-3 13-13 27z" fill="${R}"/><circle cx="24" cy="18" r="5.5" fill="${C}"/>`,
  palazzo: `<rect x="9" y="6" width="30" height="38" rx="2" fill="${O}"/><rect x="14" y="12" width="7" height="7" fill="${Y}"/><rect x="27" y="12" width="7" height="7" fill="${Y}"/><rect x="14" y="24" width="7" height="7" fill="${Y}"/><rect x="27" y="24" width="7" height="7" fill="${Y}"/><rect x="20" y="35" width="8" height="9" fill="${D}"/>`,
  vertigini: `<circle cx="24" cy="24" r="19" fill="${Y}"/><path d="M24 24a2.5 2.5 0 1 1 5 0 5.5 5.5 0 1 1-11 0 8.5 8.5 0 1 1 17 0 11.5 11.5 0 1 1-23 0" fill="none"/>`,
  bersaglio: `<circle cx="22" cy="26" r="18" fill="${R}"/><circle cx="22" cy="26" r="12" fill="${C}"/><circle cx="22" cy="26" r="6" fill="${R}"/>${thick("M42 6L24 24", K, 2.8)}<path d="M42 6l-1 6 5-1M38 10l-1 5 5-1" fill="${B}"/>`,
  fiuto: `<path d="M7 15c0-7 34-7 34 0 0 11-10 21-17 21S7 26 7 15z" fill="${D}"/><path d="M16 19c3 0 4 3 2 6M32 19c-3 0-4 3-2 6" stroke="${W}" stroke-width="2.4"/><ellipse cx="24" cy="12" rx="9" ry="2.6" fill="${W}" stroke="none"/><path d="M24 36v5M24 41c-3 3-7 2-8 0M24 41c3 3 7 2 8 0" fill="none"/>`,
  maschere: `<path d="M5 8c6 4 14 4 20 0 1 14 0 24-10 28C6 32 4 20 5 8z" fill="${Y}"/><path d="M23 14c6 4 14 4 20 0 1 14 0 24-10 28-10-4-11-14-10-28z" fill="${B}"/><circle cx="11" cy="17" r="2" fill="${N}"/><circle cx="19" cy="17" r="2" fill="${N}"/><path d="M10 26c3 3 7 3 10 0" fill="none"/><circle cx="29" cy="25" r="2" fill="${N}"/><circle cx="37" cy="25" r="2" fill="${N}"/><path d="M29 35c3-3 7-3 10 0" fill="none"/>`,
  castello: `<path d="M6 44V15h6v4h4v-4h8v-4h-0h0V15h8v4h4v-4h6v29z" fill="${G}" stroke="none"/><path d="M6 44V14h7v5h5v-5h12v5h5v-5h7v30z" fill="${G}"/><path d="M19 44V34a5 5 0 0 1 10 0v10z" fill="${K}"/><rect x="11" y="24" width="4" height="6" fill="${D}" stroke-width="2"/><rect x="33" y="24" width="4" height="6" fill="${D}" stroke-width="2"/>`,
  megafono: `<path d="M5 19h9l19-11v32L14 29H5z" fill="${Y}"/><rect x="8" y="28" width="7" height="14" rx="2.5" fill="${R}"/><path d="M37 17c3.5 3 3.5 11 0 14M41 12c7 6 7 18 0 24" fill="none"/>`,
  pedina: `<circle cx="24" cy="11" r="7" fill="${P}"/><path d="M17 40h14l-2-9c5-3 6-9 2-13H17c-4 4-3 10 2 13z" fill="${P}"/><rect x="11" y="39" width="26" height="6" rx="3" fill="${P}"/>`,
  caduta: `${thick("M6 10l13 13 8-8 12 12", R, 4.5)}<path d="M41 21v13H28z" fill="${R}"/><path d="M5 43h38" />`,
  scudo: `<path d="M24 4l17 6v13c0 11-8 18-17 21C15 41 7 34 7 23V10z" fill="${T}"/><path d="M15 24l7 7 12-14" fill="none" stroke="${W}" stroke-width="4.5"/>`,
  divieto: `<circle cx="24" cy="24" r="19" fill="${R}"/>${thick("M11 37L37 11", C, 5)}`,
  arco: `${thick("M14 5c16 7 16 31 0 38", K, 3.5)}<path d="M14 5v38" stroke-width="1.8"/><path d="M4 24h34" stroke-width="3"/><path d="M42 24l-8-5v10z" fill="${R}"/><path d="M4 24l-2-5M8 24l-2-5M4 24l-2 5M8 24l-2 5" stroke-width="2"/>`,
  sfera: `<path d="M10 43c0-6 6-8 14-8s14 2 14 8z" fill="${Y}"/><circle cx="24" cy="21" r="16" fill="${P}"/><path d="M14 17a11 11 0 0 1 8-6" fill="none" stroke="${W}" stroke-width="2.8"/><path d="M26 22l1.5 3 3 .5-2.2 2.2.5 3L26 29l-2.8 1.7.5-3-2.2-2.2 3-.5z" fill="${Y}" stroke-width="1.4"/>`,
  cervello: `<path d="M24 7c-4-4-12-2-13 4-5 1-7 7-4 11-3 4-1 10 4 11 1 5 8 7 13 3 5 4 12 2 13-3 5-1 7-7 4-11 3-4 1-10-4-11-1-6-9-8-13-4z" fill="#ff9fb0"/><path d="M24 7v33M15 17c3 0 4 3 7 3M33 17c-3 0-4 3-7 3M14 28c3-1 5 1 8 0M34 28c-3-1-5 1-8 0" fill="none" stroke-width="2.2"/>`,
  fulmine: `<path d="M28 3L9 27h11l-4 18 23-26H27z" fill="${Y}"/>`,
  torre: `<path d="M13 44l3-26h16l3 26z" fill="#f2d9a0"/><path d="M12 18V8h6v5h4V8h4v5h4V8h6v10z" fill="#f2d9a0"/><path d="M21 44v-8a3 3 0 0 1 6 0v8z" fill="${K}"/><rect x="22" y="22" width="4" height="7" rx="2" fill="${D}" stroke-width="1.8"/>`,
  ciak: `<rect x="5" y="18" width="38" height="25" rx="2.5" fill="${D}"/><path d="M5 17l-1-9 35-5 3 9z" fill="${C}"/><path d="M13 14l-4 5M22 12l-4 5M31 10l-4 5" stroke-width="3.2"/>`,
  paracadute: `<path d="M5 22a19 17 0 0 1 38 0z" fill="${R}"/><path d="M16 22c0-8 4-15 8-17M32 22c0-8-4-15-8-17" fill="none" stroke-width="2"/><path d="M5 22l15 15M43 22L28 37M24 22v15" fill="none" stroke-width="2"/><circle cx="24" cy="40" r="3.6" fill="${C}"/><path d="M21 45h6"/>`,
  equilibrista: `<path d="M2 40h44" stroke-width="3.2"/><circle cx="24" cy="10" r="4.5" fill="${C}"/><path d="M19 16h10l1 14H18z" fill="${T}"/><path d="M21 30l-2 10M27 30l2 10" fill="none"/><path d="M4 21h40" stroke-width="3"/><circle cx="4" cy="21" r="3.5" fill="${R}"/><circle cx="44" cy="21" r="3.5" fill="${R}"/>`,
  nuvola: `<path d="M13 38a9 9 0 0 1-1-18 12 12 0 0 1 23-2 10 10 0 0 1 1 20z" fill="${S}"/><path d="M14 27a6 6 0 0 1 5-4" fill="none" stroke="${W}" stroke-width="2.5"/>`,
  terrazza: `<circle cx="24" cy="30" r="14" fill="${O}"/><rect x="3" y="30" width="42" height="14" fill="${D}"/><rect x="6" y="22" width="8" height="22" fill="${D}"/><rect x="17" y="26" width="7" height="18" fill="${D}"/><rect x="28" y="19" width="8" height="25" fill="${D}"/><rect x="38" y="27" width="6" height="17" fill="${D}"/><circle cx="31" cy="26" r="1.2" fill="${Y}" stroke="none"/><circle cx="9" cy="28" r="1.2" fill="${Y}" stroke="none"/>`,
  aquila: `<path d="M3 13c8 0 14 3 19 10l-3 11C12 30 6 23 3 13zM45 13c-8 0-14 3-19 10l3 11c7-4 13-11 16-21z" fill="${K}"/><path d="M17 21h14l-3 17-4 6-4-6z" fill="${K}"/><circle cx="24" cy="13" r="7.5" fill="${W}"/><path d="M20.5 17h7l-3.5 8z" fill="${Y}" stroke-width="2.2"/><circle cx="20.5" cy="12" r="1.500" fill="${N}" stroke="none"/><circle cx="27.5" cy="12" r="1.500" fill="${N}" stroke="none"/>`,
  maestro: `<path d="M9 8l15 6 15-6 7 12-9 4v20H11V24l-9-4z" fill="${C}"/><path d="M17 12l7 20 7-20" fill="none"/><rect x="11" y="31" width="26" height="6" fill="${N}"/>`,
  cilindro: `<rect x="13" y="6" width="22" height="28" rx="3" fill="${D}"/><ellipse cx="24" cy="36" rx="21" ry="7" fill="${D}"/><rect x="13" y="24" width="22" height="7" fill="${R}"/>`,
  occhio: `<circle cx="24" cy="24" r="19" fill="${B}"/><path d="M7 24c8-10 26-10 34 0-8 10-26 10-34 0z" fill="${C}"/><circle cx="24" cy="24" r="7" fill="${T}"/><circle cx="24" cy="24" r="3" fill="${N}"/>`,
  coppa: `<path d="M13 6h22v14a11 11 0 0 1-22 0z" fill="${Y}"/><path d="M13 10H6c0 9 4 12 8 12M35 10h7c0 9-4 12-8 12" fill="none"/><path d="M24 31v8"/><rect x="13" y="38" width="22" height="7" rx="2" fill="${O}"/><path d="M18 11v8" stroke="${W}" stroke-width="2.4"/>`,
  stella: `<path d="M24 3l6.4 13 14.3 2-10.3 10 2.4 14.2L24 35.5 11.2 42.2l2.4-14.2-10.3-10 14.3-2z" fill="${Y}"/>`,
  tempesta: `<path d="M12 29a9 9 0 0 1-1-17 12 12 0 0 1 23-1 9 9 0 0 1 3 18z" fill="#7c8aa8"/><path d="M26 22l-8 12h7l-3 11 11-14h-7l4-9z" fill="${Y}"/><path d="M12 36l-2 5M36 36l-2 5" stroke="${B}" stroke-width="3"/>`,
  corona: `<path d="M5 34L3 12l12 9 9-14 9 14 12-9-2 22z" fill="${Y}"/><rect x="5" y="34" width="38" height="8" rx="2" fill="${O}"/><circle cx="3.5" cy="12" r="2.6" fill="${R}"/><circle cx="24" cy="6" r="2.6" fill="${R}"/><circle cx="44.5" cy="12" r="2.6" fill="${R}"/><circle cx="24" cy="38" r="2.4" fill="${R}" stroke-width="1.8"/>`,
  drago: `<path d="M11 18c0-8 5-13 13-13s13 5 13 13v12c0 8-6 14-13 14S11 38 11 30z" fill="${E}"/><path d="M12 14L6 3l11 6M36 14l6-11-11 6" fill="${Y}"/><ellipse cx="18" cy="21" rx="3.6" ry="4.6" fill="${Y}"/><ellipse cx="30" cy="21" rx="3.6" ry="4.6" fill="${Y}"/><path d="M18 18.5v5M30 18.5v5" stroke-width="2"/><circle cx="20" cy="34" r="2" fill="${N}"/><circle cx="28" cy="34" r="2" fill="${N}"/><path d="M17 40l3-3 4 3 4-3 3 3" fill="none" stroke-width="2"/>`,
  leggenda: `<path d="M9 40C3 30 3 18 11 9" fill="none" stroke="${E}" stroke-width="5"/><path d="M39 40c6-10 6-22-2-31" fill="none" stroke="${E}" stroke-width="5"/><path d="M9 40C3 30 3 18 11 9M39 40c6-10 6-22-2-31" fill="none" stroke-width="1.6"/><path d="M24 6l5.3 10.8 11.9 1.7-8.6 8.4 2 11.9L24 33.2l-10.6 5.6 2-11.9-8.6-8.4 11.9-1.7z" fill="${Y}"/>`,
  // ---- statistiche ----
  gioco: `<rect x="3" y="14" width="42" height="24" rx="12" fill="${B}"/><path d="M14 20v12M8 26h12" stroke="${W}" stroke-width="4.5"/><circle cx="33" cy="22" r="3.2" fill="${Y}"/><circle cx="38" cy="28" r="3.2" fill="${R}"/>`,
  medaglia: medal(Y, R), argento: medal("#c9d3e3", B), bronzo: medal("#c98f5a", T),
  crescita: `<rect x="5" y="30" width="9" height="13" fill="${T}"/><rect x="19" y="21" width="9" height="22" fill="${O}"/><rect x="33" y="10" width="9" height="33" fill="${Y}"/><path d="M6 20l12-8 8 4 14-11" fill="none" stroke="${R}" stroke-width="3.6"/>`,
  razzo: `<path d="M24 3c8 6 10 17 8 27H16c-2-10 0-21 8-27z" fill="${C}"/><circle cx="24" cy="17" r="4.5" fill="${S}"/><path d="M16 24l-7 8 2 6 5-3zM32 24l7 8-2 6-5-3z" fill="${R}"/><path d="M19 32c0 6 2 11 5 13 3-2 5-7 5-13z" fill="${O}"/>`,
  freccia: `<path d="M17 4h14v19h9L24 44 8 23h9z" fill="${B}"/>`,
  mano: `<rect x="10" y="22" width="26" height="22" rx="9" fill="${O}"/><rect x="10" y="7" width="6" height="22" rx="3" fill="${O}"/><rect x="17.5" y="4" width="6" height="25" rx="3" fill="${O}"/><rect x="25" y="6" width="6" height="23" rx="3" fill="${O}"/><rect x="32" y="12" width="6" height="19" rx="3" fill="${O}"/><path d="M12 32l-6-6c-1-3 2-5 4-3l4 4" fill="${O}"/>`,
};

export type IconName = keyof typeof ART;
/** Un'icona del gioco. `size` in pixel. */
export default function GameIcon({ name, size = 32, title }: { name: string; size?: number; title?: string }) {
  const art = ART[name] ?? "";
  return <svg viewBox="0 0 48 48" width={size} height={size} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} focusable="false"
    dangerouslySetInnerHTML={{ __html: `<g stroke="${N}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" fill="none">${art}</g>` }} />;
}
