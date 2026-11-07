/** Un animale in silhouette per ciascun colore giocatore: aiuta a distinguere i segnalini. Disegni semplici in un quadrato 100×100. */
export const ANIMAL_COLORS = ["#e5384b", "#2f7be0", "#f4c20d", "#3aa655", "#8a5a3b", "#8e44c8", "#ee7bb0", "#222222"];
export const ANIMAL_NAMES = ["gatto", "pesce", "gufo", "tartaruga", "elefante", "coniglio", "uccellino", "cane"];

const A: ((f: string, bg: string) => string)[] = [
  // gatto
  (f, bg) => `<polygon points="26,50 28,20 44,36" fill="${f}"/><polygon points="74,50 72,20 56,36" fill="${f}"/><ellipse cx="50" cy="58" rx="26" ry="22" fill="${f}"/><ellipse cx="41" cy="55" rx="4" ry="5.5" fill="${bg}"/><ellipse cx="59" cy="55" rx="4" ry="5.5" fill="${bg}"/>`,
  // pesce
  (f, bg) => `<ellipse cx="44" cy="50" rx="28" ry="19" fill="${f}"/><polygon points="64,50 90,30 90,70" fill="${f}"/><circle cx="32" cy="45" r="4" fill="${bg}"/><polygon points="40,32 52,18 56,34" fill="${f}"/>`,
  // gufo
  (f, bg) => `<polygon points="28,34 30,14 44,28" fill="${f}"/><polygon points="72,34 70,14 56,28" fill="${f}"/><ellipse cx="50" cy="58" rx="26" ry="32" fill="${f}"/><circle cx="39" cy="46" r="9" fill="${bg}"/><circle cx="61" cy="46" r="9" fill="${bg}"/><circle cx="39" cy="46" r="4" fill="${f}"/><circle cx="61" cy="46" r="4" fill="${f}"/><polygon points="46,54 54,54 50,64" fill="${bg}"/>`,
  // tartaruga
  (f, bg) => `<path d="M16 66 A34 34 0 0 1 84 66 Z" fill="${f}"/><circle cx="88" cy="58" r="9" fill="${f}"/><rect x="26" y="66" width="12" height="12" rx="3" fill="${f}"/><rect x="62" y="66" width="12" height="12" rx="3" fill="${f}"/><path d="M50 36 V66 M30 52 H70" stroke="${bg}" stroke-width="3"/>`,
  // elefante
  (f, bg) => `<circle cx="52" cy="46" r="26" fill="${f}"/><ellipse cx="30" cy="52" rx="14" ry="20" fill="${f}"/><path d="M62 58 C76 62 78 78 70 88" stroke="${f}" stroke-width="12" fill="none" stroke-linecap="round"/><circle cx="58" cy="42" r="3.5" fill="${bg}"/>`,
  // coniglio
  (f, bg) => `<ellipse cx="40" cy="26" rx="8" ry="22" fill="${f}"/><ellipse cx="60" cy="26" rx="8" ry="22" fill="${f}"/><circle cx="50" cy="64" r="26" fill="${f}"/><circle cx="41" cy="60" r="3.5" fill="${bg}"/><circle cx="59" cy="60" r="3.5" fill="${bg}"/>`,
  // uccellino
  (f, bg) => `<ellipse cx="46" cy="58" rx="28" ry="20" fill="${f}"/><circle cx="68" cy="40" r="14" fill="${f}"/><polygon points="80,38 94,43 80,48" fill="${f}"/><polygon points="22,56 6,42 8,66" fill="${f}"/><circle cx="71" cy="37" r="3" fill="${bg}"/>`,
  // cane
  (f, bg) => `<ellipse cx="50" cy="52" rx="22" ry="24" fill="${f}"/><ellipse cx="26" cy="46" rx="9" ry="22" fill="${f}" transform="rotate(10 26 46)"/><ellipse cx="74" cy="46" rx="9" ry="22" fill="${f}" transform="rotate(-10 74 46)"/><ellipse cx="50" cy="64" rx="11" ry="8" fill="${bg}"/><circle cx="50" cy="60" r="4" fill="${f}"/><circle cx="41" cy="46" r="3.5" fill="${bg}"/><circle cx="59" cy="46" r="3.5" fill="${bg}"/>`,
];
export const animalIdx = (color: string) => Math.max(0, ANIMAL_COLORS.indexOf(color.toLowerCase()));
/** Elementi SVG (viewBox 100) dell'animale per quel colore; sul disco nero la silhouette è bianca. */
export function animalMarkup(color: string, onWhite = false): string {
  const i = animalIdx(color), dark = i === 7 && !onWhite;
  return A[i]!(dark ? "#fff" : "#13224a", dark ? "#222" : "#fff");
}
const rgb = (hex: string) => { const n = parseInt(hex.slice(1), 16); return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`; };
/** Applica l'animale a tutti i dischetti ".dc" (riconosciuti dal colore di sfondo). */
export function installAnimalDiscs() {
  if (typeof document === "undefined" || document.getElementById("animal-css")) return;
  const css = ANIMAL_COLORS.map((c, i) => {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>${animalMarkup(c)}</svg>`;
    return `.dc[style*="${rgb(c)}"],.dc[style*="${c}"]{background-image:url("data:image/svg+xml,${encodeURIComponent(svg)}");background-size:74%;background-repeat:no-repeat;background-position:center}`;
  }).join("\n");
  const el = document.createElement("style"); el.id = "animal-css"; el.textContent = css; document.head.appendChild(el);
}
