/**
 * L'unica icona del Megafono dell'app: megafono giallo con bordo blu notte spesso, base rossa, bocca crema e onde sonore.
 * Qui come markup SVG (viewBox 0 0 32 32) per i disegni in stringa (gettoni, segnalini); in React si usa `MegaIcon`.
 */
const NV = "#13224a";
export const MEGA_INNER = `<g stroke="${NV}" stroke-linejoin="round" stroke-linecap="round"><path d="M7 12.5 20 5.5v21L7 19.5z" fill="#ffc72c" stroke-width="2.2"/><rect x="2.6" y="11.6" width="6.2" height="9.4" rx="2" fill="#e8362b" stroke-width="2.2"/><path d="M9.6 20.4 11.4 27h4.2l-1.4-6.8" fill="#ff9f2e" stroke-width="2"/><ellipse cx="20.5" cy="16" rx="3" ry="10.5" fill="#fff7e0" stroke-width="2.2"/></g><path d="M26.6 10.4c2 3.4 2 8 0 11.4M29.2 7.6c3.2 5.4 3.2 11.4 0 16.8" fill="none" stroke="${NV}" stroke-width="2.2" stroke-linecap="round"/><path d="M9 14.2l9-4.6" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".75"/>`;
/** Il megafono annidato in un altro SVG, in un quadrato di lato `s` con l'angolo in (x, y). */
export const megaNested = (x: number, y: number, s: number) => `<svg x="${x}" y="${y}" width="${s}" height="${s}" viewBox="0 0 32 32" overflow="visible">${MEGA_INNER}</svg>`;
