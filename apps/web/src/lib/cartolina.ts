import { cardFull, loadCards } from "./cards.ts";
import { ts } from "./testi.ts";
import type { TorreDay } from "./torre.ts";

/** La cartolina da condividere: un'immagine verticale (1080×1350) disegnata sul telefono, senza nomi né dati personali. */
export const CARTOLINA_W = 1080, CARTOLINA_H = 1350;
export interface CartolinaDati { giorno: string; rec: TorreDay; verdetto: string; serie: number; totale: number; indirizzo: string }

const NAVY = "#13224a", RED = "#e8362b", GOLD = "#ffc72c", TEAL = "#14a3a1";
const img = (src: string): Promise<HTMLImageElement | null> => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
type Ctx = CanvasRenderingContext2D;
/** Rettangolo con angoli tondi (senza `roundRect`, che i telefoni più vecchi non hanno). */
const rr = (c: Ctx, x: number, y: number, w: number, h: number, r: number) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
const dataLunga = (g: string): string => new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(g + "T12:00:00Z")).toUpperCase();
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
  c.fillStyle = "#fff"; c.font = "400 38px Anton, Impact, sans-serif"; c.textAlign = "center"; c.fillText(ts("torre.c.sotto", { n: r.n, data: dataLunga(d.giorno) }), W / 2, 211);
  // la frase del Megafono
  c.font = "800 44px Nunito, system-ui, sans-serif"; const righe = spezza(c, ts("torre.c.frase", { f: r.frase ?? "" }), W - 260, 3), hb = 44 + righe.length * 56;
  rr(c, 80, 262, W - 160, hb, 28); c.fillStyle = "#fff"; c.fill(); c.lineWidth = 8; c.strokeStyle = NAVY; c.stroke();
  c.fillStyle = NAVY; c.textAlign = "center"; righe.forEach((l, i) => c.fillText(l, W / 2, 262 + 38 + 56 * (i + 1) - 14));
  // le quattro carte
  const carte = r.carte ?? [], cw = 232, ch = 326, gap = 14, x0 = (W - (4 * cw + 3 * gap)) / 2, y0 = 262 + hb + 44;
  const imgs = await Promise.all(carte.map((k) => img(cardFull(k.id))));
  carte.forEach((k, i) => {
    const caduta = r.cadute?.includes(k.pos), mia = r.voto === k.pos, cx = x0 + i * (cw + gap) + cw / 2, cy = y0 + ch / 2 + (caduta ? 34 : 0);
    c.save(); c.translate(cx, cy); c.rotate(((caduta ? 9 : (i % 2 ? 2 : -2)) * Math.PI) / 180); c.globalAlpha = caduta ? 0.62 : 1;
    c.shadowColor = "#13224a99"; c.shadowOffsetX = 6; c.shadowOffsetY = 8; rr(c, -cw / 2, -ch / 2, cw, ch, 18); c.fillStyle = "#fff"; c.fill(); c.shadowColor = "transparent";
    const im = imgs[i]; if (im) { c.save(); rr(c, -cw / 2 + 8, -ch / 2 + 8, cw - 16, ch - 16, 12); c.clip(); const s = Math.max((cw - 16) / im.width, (ch - 16) / im.height); c.drawImage(im, -im.width * s / 2, -im.height * s / 2, im.width * s, im.height * s); c.restore(); }
    if (mia) { rr(c, -cw / 2 - 6, -ch / 2 - 6, cw + 12, ch + 12, 22); c.lineWidth = 12; c.strokeStyle = GOLD; c.stroke(); }
    c.beginPath(); c.arc(-cw / 2 + 30, -ch / 2 + 30, 26, 0, Math.PI * 2); c.fillStyle = GOLD; c.fill(); c.lineWidth = 5; c.strokeStyle = NAVY; c.stroke(); c.fillStyle = NAVY; c.font = "400 32px Anton, Impact, sans-serif"; c.fillText(String(k.pos), -cw / 2 + 30, -ch / 2 + 42);
    if (r.seg?.pos === k.pos) { c.save(); c.rotate((-9 * Math.PI) / 180); const t = ts(`torre.k.${r.seg.effetto}` as "torre.k.cade"); c.font = "400 46px Anton, Impact, sans-serif"; const w = c.measureText(t).width + 36; rr(c, -w / 2, -4, w, 66, 6); c.fillStyle = r.seg.effetto === "nulli" ? RED : r.seg.effetto === "noncade" ? TEAL : GOLD; c.fill(); c.lineWidth = 6; c.strokeStyle = NAVY; c.stroke(); c.fillStyle = r.seg.effetto === "cade" ? NAVY : "#fff"; c.fillText(t, 0, 46); c.restore(); }
    c.restore();
    if (mia) { c.fillStyle = TEAL; rr(c, cx - 44, y0 + ch + 38, 88, 44, 22); c.fill(); c.lineWidth = 5; c.strokeStyle = NAVY; c.stroke(); c.fillStyle = "#fff"; c.font = "400 30px Anton, Impact, sans-serif"; c.textAlign = "center"; c.fillText(ts("torre.c.tu"), cx, y0 + ch + 71); }
  });
  // punti, giudizio, emoji
  const py = y0 + ch + 100;
  rr(c, 70, py, 380, 240, 26); c.fillStyle = "#fff"; c.fill(); c.lineWidth = 8; c.strokeStyle = NAVY; c.stroke();
  c.fillStyle = NAVY; c.textAlign = "center"; c.font = "400 170px Anton, Impact, sans-serif"; c.fillText(`+${r.pts}`, 260, py + 166); c.font = "800 36px Nunito, system-ui, sans-serif"; c.fillText(ts("torre.punti").toUpperCase(), 260, py + 214);
  c.save(); c.translate(760, py + 82); c.rotate((-4 * Math.PI) / 180); let px = 96; c.font = `400 ${px}px Anton, Impact, sans-serif`; const vt = d.verdetto.toUpperCase(); while (c.measureText(vt).width > 560 && px > 40) { px -= 4; c.font = `400 ${px}px Anton, Impact, sans-serif`; } titolo(c, vt, 0, 0, px, RED); c.restore();
  c.font = "84px sans-serif"; c.textAlign = "center"; c.fillText([...r.cella].join("  "), 760, py + 190);
  // serie e totale
  const by = py + 266; rr(c, 70, by, W - 140, 86, 43); c.fillStyle = NAVY; c.fill();
  c.fillStyle = "#fff"; c.font = "400 44px Anton, Impact, sans-serif"; c.fillText(ts(d.serie === 1 ? "torre.c.serie1" : "torre.c.serie", { fila: d.serie, totale: d.totale }), W / 2, by + 59);
  // invito
  c.fillStyle = "#fff"; c.font = "800 34px Nunito, system-ui, sans-serif"; c.shadowColor = NAVY; c.shadowOffsetY = 2; c.fillText(ts("torre.c.invito", { url: d.indirizzo }), W / 2, H - 30); c.shadowColor = "transparent";
  return new Promise((ok, no) => cv.toBlob((b) => (b ? ok(b) : no(new Error("immagine non creata"))), "image/png"));
}
