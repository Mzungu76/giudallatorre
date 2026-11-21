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

/**
 * Gabbiani che ogni tanto arrivano, si posano su un merlo della terrazza, restano un po' e riprendono il volo.
 * Stanno nello strato della torre (si muovono con lei); coordinate dello strato. `d` = 1 arriva da sinistra, -1 da destra.
 */
const GABBIANO_VOLO = `<svg width="38" height="22" viewBox="0 0 38 22" class="sk-gv"><g class="sk-gw"><path d="M2 8 Q9 -2 19 10 Q29 -2 36 8 Q29 6 19 14 Q9 6 2 8z" fill="#fff" stroke="#13224a" stroke-width="2.2" stroke-linejoin="round"/><path d="M2 8 Q6 5 9 5.5 M36 8 Q32 5 29 5.5" fill="none" stroke="#9aa8b8" stroke-width="2.4" stroke-linecap="round"/></g><ellipse cx="19" cy="12" rx="6.5" ry="3.8" fill="#fff" stroke="#13224a" stroke-width="2"/><circle cx="25.5" cy="10.6" r="2.7" fill="#fff" stroke="#13224a" stroke-width="2"/><path d="M27.6 10.8 l4 1.1 -4 .9z" fill="#ffc72c" stroke="#13224a" stroke-width="1.2"/></svg>`;
const GABBIANO_POSATO = `<svg width="26" height="26" viewBox="0 0 26 26" class="sk-gp"><path d="M5 24 L6.5 18 M11 24 l-1 -6" stroke="#e8362b" stroke-width="2" stroke-linecap="round"/><ellipse cx="11" cy="14" rx="8.2" ry="5.6" fill="#fff" stroke="#13224a" stroke-width="2.2"/><path d="M3.5 12.5 Q9 9.5 14 13 Q9 15.5 3.5 14z" fill="#b7c3d0" stroke="#13224a" stroke-width="1.6"/><g class="sk-gh"><circle cx="17.5" cy="7.4" r="3.8" fill="#fff" stroke="#13224a" stroke-width="2.2"/><circle cx="18.6" cy="6.6" r="0.9" fill="#13224a"/><path d="M20.8 7.6 l4.4 1.2 -4.4 1z" fill="#ffc72c" stroke="#13224a" stroke-width="1.3"/></g></svg>`;
export function gabbianiHtml(): string {
  const g = (x: number, y: number, d: number, dur: number, dl: number) => `<div class="sk-gull sk-anim" style="left:${x - 13}px;top:${y - 26}px;--d:${d};animation-duration:${dur}s;animation-delay:${dl}s"><div class="sk-gfly" style="animation-duration:${dur}s;animation-delay:${dl}s">${GABBIANO_VOLO}</div><div class="sk-gsit" style="animation-duration:${dur}s;animation-delay:${dl}s">${GABBIANO_POSATO}</div></div>`;
  return g(113, 580, 1, 52, -6) + g(250, 578, -1, 67, -30);
}
