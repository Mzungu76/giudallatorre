/**
 * Nuvole e uccellini della scena della torre (stile pop: contorno inchiostro, bianco, ombra azzurra).
 * - `cloudBankHtml`: il banco di nuvole in basso, da cui la torre «spunta»; sta dentro lo strato della torre (sopra il fusto, sotto la terrazza).
 * - `skyLifeHtml`: nuvole che scorrono lente e uccellini che passano, dietro la torre.
 * Le animazioni sono CSS (app.css, classi `sk-*`); con «riduci animazioni» restano ferme e senza uccellini.
 */
const NV = "#13224a";
type C = [number, number, number];

/** Una nuvola: cerchi sovrapposti, contorno inchiostro (cerchi più grandi sotto), riempimento bianco e ombra azzurra in basso. */
function nuvola(id: string, w: number, circles: C[], baseY: number): string {
  const grow = circles.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + 4}"/>`).join(""), fill = circles.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join("");
  const h = Math.max(...circles.map(([, y, r]) => y + r)) + 6;
  return `<svg width="${w}" height="${w * h / 210}" viewBox="0 0 210 ${h}" style="display:block;overflow:visible"><defs><clipPath id="${id}">${fill}</clipPath></defs>
  <g fill="${NV}">${grow}<rect x="${Math.min(...circles.map(([x, , r]) => x - r)) - 4}" y="${baseY - 4}" width="${Math.max(...circles.map(([x, , r]) => x + r)) - Math.min(...circles.map(([x, , r]) => x - r)) + 8}" height="14" rx="7"/></g>
  <g fill="#fff">${fill}</g><g clip-path="url(#${id})"><ellipse cx="105" cy="${baseY + 8}" rx="120" ry="26" fill="#cfe8f5"/><ellipse cx="62" cy="${baseY + 14}" rx="60" ry="12" fill="#b7dcee" opacity=".7"/></g></svg>`;
}
const FORME: { c: C[]; baseY: number }[] = [
  { c: [[44, 62, 26], [82, 46, 34], [122, 54, 30], [158, 64, 24], [102, 68, 26]], baseY: 80 },
  { c: [[40, 56, 22], [70, 40, 28], [104, 36, 32], [140, 50, 28], [172, 62, 20], [96, 60, 24]], baseY: 74 },
  { c: [[52, 58, 28], [96, 44, 34], [140, 58, 28]], baseY: 80 },
];

/** Il banco di nuvole in basso: due file che ondeggiano piano in senso opposto, bianche e azzurre. `top` è la y (nelle coordinate dello strato) della cima delle nuvole. */
export function cloudBankHtml(top: number): string {
  const row = (ys: number, rs: number[], fill: string, cls: string, x0: number, step: number) => `<g class="${cls}" fill="${fill}">${rs.map((r, i) => `<circle cx="${x0 + i * step}" cy="${ys + (i % 2 ? 14 : 0)}" r="${r}"/>`).join("")}</g>`;
  const outline = (ys: number, rs: number[], cls: string, x0: number, step: number) => `<g class="${cls}" fill="${NV}">${rs.map((r, i) => `<circle cx="${x0 + i * step}" cy="${ys + (i % 2 ? 14 : 0)}" r="${r + 5}"/>`).join("")}</g>`;
  const A = [64, 78, 70, 84, 66, 80, 72, 76], B = [58, 70, 82, 64, 76, 68, 80, 60];
  return `<svg style="position:absolute;left:0;top:${top}px;z-index:1;overflow:visible;pointer-events:none" width="372" height="700" viewBox="0 0 372 700">
  ${outline(40, A, "sk-b1", -52, 66)}${row(40, A, "#d3ebf7", "sk-b1", -52, 66)}
  ${outline(82, B, "sk-b2", -38, 64)}${row(82, B, "#ffffff", "sk-b2", -38, 64)}
  <rect x="-80" y="130" width="540" height="600" fill="#fff"/><ellipse cx="186" cy="140" rx="300" ry="30" fill="#e6f3fb"/></svg>`;
}

/** Nuvole che scorrono e uccellini: sono in coordinate dello schermo (372 × H), dietro la torre. `anim` falso = tutto fermo e senza uccellini. */
export function skyLifeHtml(anim: boolean): string {
  const nuvole = [
    { f: 0, y: 24, w: 128, d: 95, dl: -10, o: 0.95 }, { f: 1, y: 118, w: 96, d: 70, dl: -42, o: 0.9 }, { f: 2, y: 196, w: 112, d: 120, dl: -66, o: 0.85 }, { f: 1, y: 296, w: 84, d: 85, dl: -20, o: 0.8 },
  ];
  const cl = nuvole.map((n, i) => {
    const forma = FORME[n.f]!, x0 = anim ? "" : `left:${[200, 18, 230, 8][i]}px;`;
    return `<div class="${anim ? "sk-cloud sk-anim" : ""}" style="position:absolute;top:${n.y}px;${x0}opacity:${n.o};${anim ? `animation-duration:${n.d}s;animation-delay:${n.dl}s;` : ""}">${nuvola(`skc${i}`, n.w, forma.c, forma.baseY)}</div>`;
  }).join("");
  const uccello = (i: number, y: number, dur: number, dl: number, s: number) => `<div class="sk-bird sk-anim" style="top:${y}px;animation-duration:${dur}s;animation-delay:${dl}s;--s:${s}"><svg width="${26 * s}" height="${14 * s}" viewBox="0 0 26 14" class="sk-wing"><path d="M1 9 Q7 -1 13 8 Q19 -1 25 9" fill="none" stroke="${NV}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
  const birds = anim ? uccello(0, 70, 26, 2, 1) + uccello(1, 150, 34, 11, 0.8) + uccello(2, 104, 30, 17, 0.65) + uccello(3, 232, 40, 24, 0.9) : "";
  return `<div style="position:absolute;inset:0;overflow:hidden;pointer-events:none" aria-hidden="true">${cl}${birds}</div>`;
}
