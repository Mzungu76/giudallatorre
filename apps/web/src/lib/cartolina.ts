import { cardFull, loadCards } from "./cards.ts";
import { ts } from "./testi.ts";
import { fasciaPregiudizio, SEG_PREGIUDIZIO } from "./stereo.ts";
import { fraseSocial } from "./torre.ts";
import type { TorreDay } from "./torre.ts";

/** La cartolina da condividere: un'immagine verticale (1080×1350) disegnata sul telefono, senza nomi né dati personali. */
export const CARTOLINA_W = 1080, CARTOLINA_H = 1350;
/** `sotto`: la striscia sotto il titolo; `verdetto`: il nastro rosso; `banda`: la riga in fondo (serie, punteggio…). I testi li prepara chi chiama. */
export interface CartolinaDati { giorno: string; rec: TorreDay; sotto: string; verdetto: string; banda: string; indirizzo: string }

const NAVY = "#13224a", RED = "#e8362b", GOLD = "#ffc72c", TEAL = "#14a3a1", VIOLA = "#8e6bd8";
export const img = (src: string): Promise<HTMLImageElement | null> => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
type Ctx = CanvasRenderingContext2D;
/** Rettangolo con angoli tondi (senza `roundRect`, che i telefoni più vecchi non hanno). */
const rr = (c: Ctx, x: number, y: number, w: number, h: number, r: number) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
export const dataLunga = (g: string): string => new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(g + "T12:00:00Z")).toUpperCase();
/** Testo spezzato in righe che stanno in `max` pixel (al massimo `righe`; l'ultima si chiude con «…»). */
export function spezza(c: Ctx, testo: string, max: number, righe: number): string[] {
  const out: string[] = []; let cur = "";
  for (const w of testo.split(/\s+/)) { const t = cur ? cur + " " + w : w; if (c.measureText(t).width <= max || !cur) cur = t; else { out.push(cur); cur = w; } }
  if (cur) out.push(cur);
  if (out.length > righe) { const l = out.slice(0, righe); l[righe - 1] = l[righe - 1]!.replace(/[\s.,;:!?]*$/, "") + "…"; return l; }
  return out;
}
/** Titolo a lettere grandi con ombra come nel gioco: bianco, contorno blu, ombra rossa e blu. */
function titolo(c: Ctx, t: string, x: number, y: number, px: number, fill = "#fff") {
  c.font = `400 ${px}px Anton, Impact, sans-serif`; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.lineJoin = "round";
  for (const [dx, col] of [[px * 0.09, NAVY], [px * 0.05, RED]] as const) { c.fillStyle = col; c.fillText(t, x + dx, y + dx); }
  c.lineWidth = px * 0.1; c.strokeStyle = NAVY; c.strokeText(t, x, y); c.fillStyle = fill; c.fillText(t, x, y);
}

export async function disegnaCartolina(d: CartolinaDati): Promise<Blob> {
  try { await Promise.all([document.fonts.load("120px Anton"), document.fonts.load("800 40px Nunito"), loadCards()]); } catch { /* si disegna con i caratteri di ripiego */ }
  const cv = document.createElement("canvas"); cv.width = CARTOLINA_W; cv.height = CARTOLINA_H; const c = cv.getContext("2d")!, W = CARTOLINA_W, H = CARTOLINA_H, r = d.rec;
  // cielo a raggi
  c.fillStyle = "#4a9ad8"; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 36; i += 2) { c.fillStyle = "#7cc0ee"; c.beginPath(); c.moveTo(W / 2, 560); c.arc(W / 2, 560, 1900, (i * Math.PI) / 18, ((i + 1) * Math.PI) / 18); c.closePath(); c.fill(); }
  const g = c.createLinearGradient(0, H * 0.55, 0, H); g.addColorStop(0, "#0000"); g.addColorStop(1, "#13224a88"); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.strokeStyle = NAVY; c.lineWidth = 16; c.strokeRect(8, 8, W - 16, H - 16);
  // titolo e striscia
  titolo(c, ts("torre.c.titolo").toUpperCase(), W / 2, 130, 112);
  rr(c, 150, 160, W - 300, 70, 8); c.fillStyle = NAVY; c.fill();
  c.fillStyle = "#fff"; c.font = "400 38px Anton, Impact, sans-serif"; c.textAlign = "center"; c.fillText(d.sotto, W / 2, 211);
  // la frase del Megafono, riscritta per i social («Oggi buttiamo dalla torre…»); si rimpicciolisce per stare in 2 righe (3 al minimo)
  const frase = ts("torre.c.frase", { f: fraseSocial(r.frase ?? "") }); let righe: string[] = [], lh = 52;
  for (const px of [42, 38, 34]) { c.font = `800 ${px}px Nunito, system-ui, sans-serif`; lh = Math.round(px * 1.24); righe = spezza(c, frase, W - 200, px === 34 ? 3 : 2); if (!righe[righe.length - 1]!.endsWith("…")) break; }
  const hb = 32 + righe.length * lh;
  rr(c, 80, 250, W - 160, hb, 28); c.fillStyle = "#fff"; c.fill(); c.lineWidth = 8; c.strokeStyle = NAVY; c.stroke();
  c.fillStyle = NAVY; c.textAlign = "center"; righe.forEach((l, i) => c.fillText(l, W / 2, 250 + 24 + lh * (i + 1) - 10));
  // la torre, le carte rimaste in cima e quelle che cadono
  const carte = r.carte ?? [], rimaste = carte.filter((k) => !r.cadute?.includes(k.pos)), cadute = carte.filter((k) => r.cadute?.includes(k.pos));
  const ty = 610, tw = 430, torre = await img("/scene/tower_pop.webp"), imgs = new Map(await Promise.all(carte.map(async (k) => [k.pos, await img(cardFull(k.id))] as const)));
  const carta = (k: { pos: number; id: string }, cx: number, cy: number, w: number, h: number, rot: number, cadendo: boolean) => {
    const mia = r.voto === k.pos; c.save(); c.translate(cx, cy); c.rotate((rot * Math.PI) / 180); c.globalAlpha = cadendo ? 0.92 : 1;
    c.shadowColor = "#13224a99"; c.shadowOffsetX = 5; c.shadowOffsetY = 7; rr(c, -w / 2, -h / 2, w, h, 16); c.fillStyle = "#fff"; c.fill(); c.shadowColor = "transparent";
    const im = imgs.get(k.pos); if (im) { c.save(); rr(c, -w / 2 + 7, -h / 2 + 7, w - 14, h - 14, 10); c.clip(); const sc = Math.max((w - 14) / im.width, (h - 14) / im.height); c.drawImage(im, -im.width * sc / 2, -im.height * sc / 2, im.width * sc, im.height * sc); c.restore(); }
    if (mia) { rr(c, -w / 2 - 6, -h / 2 - 6, w + 12, h + 12, 20); c.lineWidth = 11; c.strokeStyle = GOLD; c.stroke(); }
    c.beginPath(); c.arc(-w / 2 + 26, -h / 2 + 26, 23, 0, Math.PI * 2); c.fillStyle = GOLD; c.fill(); c.lineWidth = 5; c.strokeStyle = NAVY; c.stroke(); c.fillStyle = NAVY; c.font = "400 29px Anton, Impact, sans-serif"; c.textAlign = "center"; c.fillText(String(k.pos), -w / 2 + 26, -h / 2 + 37);
    if (r.seg?.pos === k.pos) { c.save(); c.rotate((-9 * Math.PI) / 180); const t = ts(`torre.k.${r.seg.effetto}` as "torre.k.cade"); let f = 42; c.font = `400 ${f}px Anton, Impact, sans-serif`; while (c.measureText(t).width > w + 24 && f > 24) { f -= 2; c.font = `400 ${f}px Anton, Impact, sans-serif`; } const tw2 = c.measureText(t).width + 28; rr(c, -tw2 / 2, -4, tw2, f + 22, 6); c.fillStyle = r.seg.effetto === "nulli" ? RED : r.seg.effetto === "noncade" ? TEAL : GOLD; c.fill(); c.lineWidth = 6; c.strokeStyle = NAVY; c.stroke(); c.fillStyle = r.seg.effetto === "cade" ? NAVY : "#fff"; c.fillText(t, 0, f + 12); c.restore(); }
    if (mia) { const yy = cadendo ? h / 2 + 34 : -h / 2 - 30; c.fillStyle = TEAL; rr(c, -42, yy - 22, 84, 44, 22); c.fill(); c.lineWidth = 5; c.strokeStyle = NAVY; c.stroke(); c.fillStyle = "#fff"; c.font = "400 28px Anton, Impact, sans-serif"; c.textAlign = "center"; c.fillText(ts("torre.c.tu"), 0, yy + 10); }
    c.restore();
  };
  // quelle rimaste: in piedi sulla cima della torre, una accanto all'altra (i merli le coprono in basso)
  const n = rimaste.length, w0 = n > 3 ? 158 : 178, h0 = Math.round(w0 * 1.4), span = n > 3 ? 330 : n === 3 ? 270 : 190;
  rimaste.forEach((k, i) => carta(k, W / 2 + (n === 1 ? 0 : -span / 2 + (span * i) / (n - 1)), 548 + (i % 2 ? 8 : 0), w0, h0, n === 1 ? -2 : -6 + (12 * i) / (n - 1), false));
  if (torre) {   // la torre davanti: le carte spuntano da dietro i merli; la base sfuma, così non resta un taglio netto
    const sc = tw / torre.width, oc = document.createElement("canvas"); oc.width = tw; oc.height = 290; const o = oc.getContext("2d")!;
    o.drawImage(torre, 0, 0, torre.width, 290 / sc, 0, 0, tw, 290); o.globalCompositeOperation = "destination-out";
    const m = o.createLinearGradient(0, 205, 0, 290); m.addColorStop(0, "rgba(0,0,0,0)"); m.addColorStop(1, "rgba(0,0,0,1)"); o.fillStyle = m; o.fillRect(0, 205, tw, 85);
    c.drawImage(oc, (W - tw) / 2, ty);
  }
  // quella che cade: di fianco alla torre, in picchiata, con le righe della velocità e il grido
  const cw2 = cadute.length > 1 ? 150 : 176, ch2 = Math.round(cw2 * 1.4);
  cadute.forEach((k, i) => {
    const cx = 840 + i * 96, cy = 735 + i * 80, rot = 17 + i * 10, dx = Math.sin((rot * Math.PI) / 180), dy = Math.cos((rot * Math.PI) / 180);
    c.save(); c.strokeStyle = "#ffffffe6"; c.lineWidth = 9; c.lineCap = "round";
    for (let m = -1; m <= 1; m++) { const bx = cx + m * 52 - dx * (ch2 / 2 + 40), by0 = cy - dy * (ch2 / 2 + 40); c.beginPath(); c.moveTo(bx, by0); c.lineTo(bx - dx * 90, by0 - dy * 90); c.stroke(); }
    c.restore();
    carta(k, cx, cy, cw2, ch2, rot, true);
    if (i === 0) {   // «AAAAHHH!» in uno scoppio giallo
      const gx = cx + 24, gy = cy - ch2 / 2 - 96; c.save(); c.translate(gx, gy); c.rotate((8 * Math.PI) / 180);
      c.beginPath(); for (let a = 0; a < 20; a++) { const rad = a % 2 ? 62 : 92, an = (a * Math.PI) / 10; c.lineTo(Math.cos(an) * rad * 1.35, Math.sin(an) * rad * 0.8); } c.closePath(); c.fillStyle = "#fff"; c.fill(); c.lineWidth = 7; c.strokeStyle = NAVY; c.stroke();
      c.fillStyle = RED; c.font = "400 46px Anton, Impact, sans-serif"; c.textAlign = "center"; c.lineJoin = "round"; c.lineWidth = 8; c.strokeStyle = NAVY; const g = ts("torre.c.aaah"); c.strokeText(g, 0, 16); c.fillText(g, 0, 16); c.restore();
    }
  });
  // punti: medaglia con stella
  const mx = 205, my = 1058;
  c.save(); c.translate(mx, my); c.shadowColor = "#13224a88"; c.shadowOffsetX = 6; c.shadowOffsetY = 8;
  c.beginPath(); for (let a = 0; a < 40; a++) { const rad = a % 2 ? 112 : 128, an = (a * Math.PI) / 20 - Math.PI / 2; c.lineTo(Math.cos(an) * rad, Math.sin(an) * rad); } c.closePath();
  const gr = c.createLinearGradient(0, -128, 0, 128); gr.addColorStop(0, "#fff0a0"); gr.addColorStop(0.5, GOLD); gr.addColorStop(1, "#e89a00"); c.fillStyle = gr; c.fill(); c.shadowColor = "transparent"; c.lineWidth = 8; c.strokeStyle = NAVY; c.lineJoin = "round"; c.stroke();
  c.beginPath(); c.arc(0, 0, 94, 0, Math.PI * 2); c.fillStyle = "#fff"; c.fill(); c.lineWidth = 6; c.stroke();
  c.beginPath(); c.arc(0, 0, 80, 0, Math.PI * 2); c.lineWidth = 3; c.strokeStyle = "#13224a40"; c.stroke();
  c.fillStyle = NAVY; c.textAlign = "center"; c.font = "400 118px Anton, Impact, sans-serif"; c.fillText(`+${r.pts}`, 0, 26);
  rr(c, -78, 52, 156, 44, 10); c.fillStyle = NAVY; c.fill(); c.fillStyle = "#fff"; c.font = "400 30px Anton, Impact, sans-serif"; c.fillText(ts("torre.punti").toUpperCase(), 0, 85);
  c.restore();
  // il giudizio sui punti, su un nastro
  c.save(); c.translate(690, 962); c.rotate((-3 * Math.PI) / 180);
  let px = 84; c.font = `400 ${px}px Anton, Impact, sans-serif`; const vt = d.verdetto.toUpperCase(); while (c.measureText(vt).width > 480 && px > 40) { px -= 4; c.font = `400 ${px}px Anton, Impact, sans-serif`; }
  const bw = Math.min(560, c.measureText(vt).width + 80), bh = px + 40;
  c.beginPath(); c.moveTo(-bw / 2 - 24, -bh / 2); c.lineTo(-bw / 2, -bh / 2 + 8); c.lineTo(bw / 2, -bh / 2 + 8); c.lineTo(bw / 2 + 24, -bh / 2); c.lineTo(bw / 2 + 11, 0); c.lineTo(bw / 2 + 24, bh / 2); c.lineTo(bw / 2, bh / 2 - 8); c.lineTo(-bw / 2, bh / 2 - 8); c.lineTo(-bw / 2 - 24, bh / 2); c.lineTo(-bw / 2 - 11, 0); c.closePath();
  c.shadowColor = "#13224a88"; c.shadowOffsetX = 5; c.shadowOffsetY = 7; c.fillStyle = RED; c.fill(); c.shadowColor = "transparent"; c.lineWidth = 7; c.lineJoin = "round"; c.strokeStyle = NAVY; c.stroke();
  c.fillStyle = "#fff"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(vt, 0, 4); c.textBaseline = "alphabetic"; c.restore();
  // il pregiudiziometro del turno (lo stesso tachimetro della pagina delle statistiche)
  if (r.pct !== undefined) {
    const pc = r.pct, f = fasciaPregiudizio(pc), gx = 512, gy = 1170, R = 100, SEG = SEG_PREGIUDIZIO.map((x) => [x.a, x.b, x.c] as const);
    rr(c, 366, 1034, 644, 168, 22); c.fillStyle = "#fff"; c.fill(); c.lineWidth = 7; c.strokeStyle = NAVY; c.stroke();
    c.lineCap = "round"; c.strokeStyle = NAVY; c.lineWidth = 40; c.beginPath(); c.arc(gx, gy, R, Math.PI, 2 * Math.PI); c.stroke(); c.lineCap = "butt";
    for (const [a, b, col] of SEG) { c.strokeStyle = col; c.lineWidth = 26; c.beginPath(); c.arc(gx, gy, R, Math.PI + a * Math.PI, Math.PI + b * Math.PI); c.stroke(); }
    const an = Math.PI + (pc / 100) * Math.PI; c.strokeStyle = NAVY; c.lineWidth = 9; c.lineCap = "round"; c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + Math.cos(an) * (R - 8), gy + Math.sin(an) * (R - 8)); c.stroke();
    c.beginPath(); c.arc(gx, gy, 13, 0, Math.PI * 2); c.fillStyle = "#fff"; c.fill(); c.lineWidth = 5; c.stroke();
    c.textAlign = "left"; c.fillStyle = VIOLA; c.font = "400 32px Anton, Impact, sans-serif"; c.fillText(ts("torre.c.pregiudizio").toUpperCase(), 650, 1084);
    c.fillStyle = NAVY; c.font = "400 76px Anton, Impact, sans-serif"; c.fillText(`${pc}%`, 650, 1160);
    let tp = 30; const lab = ts(`sc.f${f}` as "sc.f0").toUpperCase(); c.font = `400 ${tp}px Anton, Impact, sans-serif`; const lr = spezza(c, lab, 180, 2); while (lr.some((l) => c.measureText(l).width > 180) && tp > 20) { tp -= 2; c.font = `400 ${tp}px Anton, Impact, sans-serif`; }
    c.fillStyle = RED; lr.forEach((l, i) => c.fillText(l, 822, 1124 + i * (tp + 6) + (lr.length === 1 ? 20 : 0)));
  }
  c.textAlign = "center"; c.lineCap = "butt";
  // serie e totale
  const by = 1216; rr(c, 70, by, W - 140, 74, 37); c.fillStyle = NAVY; c.fill();
  c.fillStyle = "#fff"; c.font = "400 38px Anton, Impact, sans-serif"; c.fillText(d.banda, W / 2, by + 52);
  // invito
  c.fillStyle = "#fff"; c.font = "800 31px Nunito, system-ui, sans-serif"; c.shadowColor = NAVY; c.shadowOffsetY = 2; c.fillText(ts("torre.c.invito", { url: d.indirizzo }), W / 2, H - 28); c.shadowColor = "transparent";
  return new Promise((ok, no) => cv.toBlob((b) => (b ? ok(b) : no(new Error("immagine non creata"))), "image/png"));
}

/** Disegna la cartolina e la manda: foglio di condivisione con l'immagine (se il telefono lo permette), altrimenti solo il testo; senza foglio la salva e copia il testo. */
export async function condividiCartolina(d: CartolinaDati, testo: string, nome: string): Promise<"condiviso" | "annullato" | "salvato"> { return condividiImmagine(await disegnaCartolina(d), testo, nome); }
/** Manda un'immagine già disegnata: foglio di condivisione con il file (se il telefono lo permette), altrimenti solo il testo; senza foglio la salva e copia il testo. */
export async function condividiImmagine(blob: Blob, testo: string, nome: string): Promise<"condiviso" | "annullato" | "salvato"> {
  const file = new File([blob], nome, { type: "image/png" });
  try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text: testo }); return "condiviso"; } if (navigator.share) { await navigator.share({ text: testo }); return "condiviso"; } } catch { return "annullato"; }
  const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(u), 4000);
  try { await navigator.clipboard.writeText(testo); } catch { /* solo l'immagine */ }
  return "salvato";
}
