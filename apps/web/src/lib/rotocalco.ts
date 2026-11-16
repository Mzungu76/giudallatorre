import { cardFull, loadCards } from "./cards.ts";
import { condividiImmagine, dataLunga, img } from "./cartolina.ts";
import { ts } from "./testi.ts";
import type { GameState } from "@gdt/game-engine";

/**
 * La copertina del rotocalco: l'immagine unica e satirica della serata, 1080×1350, disegnata sul telefono (nessun nome, nessun dato personale).
 * Il personaggio colpito dal luogo comune più forte, a figura intera (mai ritagliato), il titolo «È un {tratto}» e la riga con il luogo comune.
 */
export const ROTOCALCO_W = 1080, ROTOCALCO_H = 1350;
export interface RotocalcoDati { giorno: string; cardId: string; /** Il luogo comune, es. «politico → bugiardo»; assente: copertina senza luogo comune. */ causa?: string; indirizzo: string }

const NAVY = "#13224a", RED = "#e8362b", GOLD = "#ffd84a";
const SERIF = "Georgia, serif", DISPLAY = "Anton, Impact, sans-serif", PENNARELLO = ["Caveat", "Brush"].join(" ") + ", cursive";   // il pennarello: il carattere «Caveat Brush» del gioco
const MAI = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Dal luogo comune «ruolo → tratto» (come lo calcola la stanza) a ruolo e tratto. */
export function spezzaCausa(causa: string | undefined): { ruolo: string; tratto: string } | null {
  const [r, t] = (causa ?? "").split(" → "); return r && t ? { ruolo: r.trim(), tratto: t.trim() } : null;
}
/** I dati della copertina dalle statistiche della partita: serve il «miglior lancio» (carta e luogo comune insieme); senza, copertina senza luogo comune con la carta di ripiego. */
export function datiRotocalco(stereo: GameState["stereo"] | null | undefined, ripiego: string | undefined, giorno: string, indirizzo: string): RotocalcoDati | null {
  const L = stereo?.lancio; if (L && spezzaCausa(L.causa)) return { giorno, cardId: L.cardId, causa: L.causa, indirizzo };
  return ripiego ? { giorno, cardId: ripiego, indirizzo } : null;
}
const hash = (t: string): number => { let h = 2166136261; for (const c of t) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
/** La scritta a pennarello (cambia da una serata all'altra: stessa carta e stesso tratto, stessa scritta). */
export function notaPennarello(cardId: string, tratto: string | null, giorno: string): string {
  if (!tratto) return ts("rot.nota.vuota");
  return ts(`rot.nota.${hash(cardId + giorno) % 5}` as "rot.nota.0", { tratto });
}
/** Titolo e riga sotto, con lo schema fisso. */
export function testiRotocalco(causa: string | undefined): { titolo: string; sotto: string } {
  const c = spezzaCausa(causa);
  return c ? { titolo: ts("rot.titolo", { tratto: c.tratto }), sotto: ts("rot.sotto", { ruolo: MAI(c.ruolo), tratto: c.tratto }) } : { titolo: ts("rot.titolo.vuoto"), sotto: ts("rot.sotto.vuoto") };
}

/** Foto in bianco e nero con un po' di contrasto (a mano sui pixel: `ctx.filter` non c'è su tutti i telefoni). */
function bn(src: HTMLImageElement, w: number, h: number, contrasto = 1.25): HTMLCanvasElement {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const c = cv.getContext("2d")!; c.drawImage(src, 0, 0, w, h);
  const d = c.getImageData(0, 0, w, h), p = d.data;
  for (let i = 0; i < p.length; i += 4) { const g = Math.max(0, Math.min(255, (0.3 * p[i]! + 0.59 * p[i + 1]! + 0.11 * p[i + 2]! - 128) * contrasto + 136)); p[i] = p[i + 1] = p[i + 2] = g; }
  c.putImageData(d, 0, 0); return cv;
}
const rr = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
/** Scrive `t` centrato rimpicciolendo il carattere finché sta in `max` pixel. */
function fit(c: CanvasRenderingContext2D, t: string, font: (px: number) => string, px: number, max: number, min = 24): number { let s = px; c.font = font(s); while (c.measureText(t).width > max && s > min) { s -= 2; c.font = font(s); } return s; }

export async function disegnaRotocalco(d: RotocalcoDati): Promise<Blob> {
  try { await Promise.all([document.fonts.load("120px Anton"), document.fonts.load("80px " + PENNARELLO), loadCards()]); } catch { /* caratteri di ripiego */ }
  const W = ROTOCALCO_W, H = ROTOCALCO_H, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const c = cv.getContext("2d")!;
  const foto = await img(cardFull(d.cardId)), tx = testiRotocalco(d.causa), cs = spezzaCausa(d.causa);
  c.fillStyle = "#fff"; c.fillRect(0, 0, W, H);
  // la foto: sfondo = la stessa carta ingrandita, in bianco e nero e scurita; al centro la carta INTERA (mai ritagliata)
  const PY = 168, PH = 832;
  c.save(); c.beginPath(); c.rect(0, PY, W, PH); c.clip();
  if (foto) {
    const s = Math.max(W / foto.width, PH / foto.height), bw = foto.width * s, bh = foto.height * s, sfondo = bn(foto, Math.round(bw / 4), Math.round(bh / 4), 1.1);
    c.imageSmoothingEnabled = true; c.drawImage(sfondo, (W - bw) / 2, PY + (PH - bh) / 2, bw, bh); c.fillStyle = "#000000b0"; c.fillRect(0, PY, W, PH);
    const ph = 770, pw = Math.round((foto.width / foto.height) * ph), pc = bn(foto, pw, ph, 1.28), px = (W - pw) / 2, py = PY + (PH - ph) / 2;
    c.save(); c.translate(W / 2, PY + PH / 2); c.rotate((-1.4 * Math.PI) / 180); c.shadowColor = "#000a"; c.shadowOffsetX = 8; c.shadowOffsetY = 10; c.shadowBlur = 14;
    c.fillStyle = "#fff"; c.fillRect(-pw / 2 - 12, -ph / 2 - 12, pw + 24, ph + 24); c.shadowColor = "transparent"; c.drawImage(pc, -pw / 2, -ph / 2, pw, ph);
    c.restore();
    void px; void py;
  }
  const pat = document.createElement("canvas"); pat.width = pat.height = 5; const pc2 = pat.getContext("2d")!; pc2.fillStyle = "#0000004d"; pc2.beginPath(); pc2.arc(2.5, 2.5, 1.2, 0, Math.PI * 2); pc2.fill();
  c.fillStyle = c.createPattern(pat, "repeat")!; c.fillRect(0, PY, W, PH);   // il retino dei giornali
  c.restore();
  // testata
  c.fillStyle = "#000"; c.textAlign = "center"; c.textBaseline = "alphabetic";
  const tp = fit(c, ts("rot.testata"), (s) => `900 ${s}px ${SERIF}`, 78, W - 60); c.fillText(ts("rot.testata"), W / 2, 94);
  void tp;
  c.fillRect(30, 108, W - 60, 4); c.fillRect(30, 118, W - 60, 1.5);
  c.font = `800 25px Nunito, sans-serif`; c.textAlign = "left"; c.fillText(ts("rot.fondato"), 34, 152); c.textAlign = "center"; c.fillText(dataLunga(d.giorno), W / 2, 152); c.textAlign = "right"; c.fillText(ts("rot.prezzo"), W - 34, 152);
  c.fillRect(0, PY - 6, W, 5);
  // timbro «ESCLUSIVO»
  c.save(); c.translate(150, PY + 70); c.rotate((-9 * Math.PI) / 180); c.font = `400 52px ${DISPLAY}`; const ew = c.measureText(ts("rot.esclusivo").toUpperCase()).width + 36;
  c.fillStyle = "#ffffffe6"; c.fillRect(-ew / 2, -48, ew, 74); c.lineWidth = 7; c.strokeStyle = RED; c.strokeRect(-ew / 2, -48, ew, 74); c.fillStyle = RED; c.textAlign = "center"; c.fillText(ts("rot.esclusivo").toUpperCase(), 0, 8); c.restore();
  // la scritta a pennarello con la freccia verso il personaggio (non sappiamo dov'è il viso: la freccia indica la figura)
  const nota = notaPennarello(d.cardId, cs?.tratto ?? null, d.giorno), nx = 905, ny = PY + 250;
  c.save(); c.translate(nx, ny); c.rotate((7 * Math.PI) / 180);
  const righe = nota.split("\n"); let npx = 70; for (const r of righe) npx = Math.min(npx, fit(c, r, (s) => `400 ${s}px ${PENNARELLO}`, 70, 250, 34));
  c.font = `400 ${npx}px ${PENNARELLO}`; c.textAlign = "center"; c.lineJoin = "round"; c.lineWidth = 9; c.strokeStyle = "#000"; c.fillStyle = "#ff3b2e";
  righe.forEach((r, i) => { c.strokeText(r, 0, i * (npx + 6)); c.fillText(r, 0, i * (npx + 6)); }); c.restore();
  c.save(); c.strokeStyle = "#000"; c.lineWidth = 18; c.lineCap = "round"; c.lineJoin = "round";
  const ax = nx - 70, ay = ny + 48 + (righe.length - 1) * (npx + 6), bx = W / 2 + 100, by = PY + 270;   // dalla scritta verso la parte alta del personaggio
  for (const [lw, col] of [[18, "#000"], [10, "#ff3b2e"]] as const) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo((ax + bx) / 2, ay + 70, bx, by); c.stroke(); c.beginPath(); c.moveTo(bx + 4, by - 46); c.lineTo(bx, by); c.lineTo(bx + 46, by + 14); c.stroke(); }
  c.restore();
  // il titolo-sentenza e la riga del luogo comune
  c.fillStyle = RED; c.fillRect(0, PY + PH, W, 156); c.fillStyle = "#000"; c.fillRect(0, PY + PH, W, 6); c.fillRect(0, PY + PH + 150, W, 6);
  const ttl = tx.titolo.toUpperCase(); const sz = fit(c, `\u201C${ttl}\u201D`, (s) => `400 ${s}px ${DISPLAY}`, 132, W - 80, 56);
  c.font = `400 ${sz}px ${DISPLAY}`; c.textAlign = "center"; c.lineJoin = "round"; c.lineWidth = 9; c.strokeStyle = "#000"; c.strokeText(`\u201C${ttl}\u201D`, W / 2 + 5, PY + PH + 112 + 5); c.fillStyle = "#000"; c.fillText(`\u201C${ttl}\u201D`, W / 2 + 5, PY + PH + 112 + 5);
  c.strokeText(`\u201C${ttl}\u201D`, W / 2, PY + PH + 112); c.fillStyle = "#fff"; c.fillText(`\u201C${ttl}\u201D`, W / 2, PY + PH + 112);
  const by0 = PY + PH + 156; c.fillStyle = "#000"; c.fillRect(0, by0, W, H - by0);
  let sp = fit(c, tx.sotto, (s) => `900 ${s}px ${SERIF}`, 46, W - 70, 26); c.font = `900 ${sp}px ${SERIF}`;
  if (cs) { const a = `${MAI(cs.ruolo)} = ${cs.tratto}:`, b = ts("rot.sotto.coda"); sp = fit(c, `${a} ${b}`, (s) => `900 ${s}px ${SERIF}`, 46, W - 70, 26); c.font = `900 ${sp}px ${SERIF}`; const wa = c.measureText(a + " ").width, wb = c.measureText(b).width, x0 = (W - wa - wb) / 2; c.textAlign = "left"; c.fillStyle = GOLD; c.fillText(a, x0, by0 + 60); c.fillStyle = "#fff"; c.fillText(b, x0 + wa, by0 + 60); }
  else { c.textAlign = "center"; c.fillStyle = GOLD; c.fillText(tx.sotto, W / 2, by0 + 60); }
  c.textAlign = "center"; c.fillStyle = "#ffffffb0"; c.font = "800 26px Nunito, sans-serif"; c.fillText(ts("rot.url", { url: d.indirizzo }), W / 2, H - 24);
  c.strokeStyle = "#000"; c.lineWidth = 14; c.strokeRect(7, 7, W - 14, H - 14);
  return new Promise((ok, no) => cv.toBlob((b) => (b ? ok(b) : no(new Error("immagine non creata"))), "image/png"));
}

/** Disegna la copertina e la manda (o la salva). */
export async function condividiRotocalco(d: RotocalcoDati, nome: string): Promise<"condiviso" | "annullato" | "salvato"> {
  const tx = testiRotocalco(d.causa);
  return condividiImmagine(await disegnaRotocalco(d), `«${tx.titolo}» ${tx.sotto}\n${d.indirizzo}`, nome);
}
