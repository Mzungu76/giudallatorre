import { cardFull, loadCards } from "./cards.ts";
import { ts } from "./testi.ts";

/**
 * Immagini da condividere di una torre (disegnate sul telefono dell'autore): 1200×630 per l'anteprima del link, 1080×1920 per storie e stato.
 * Mai il segnalino né il voto dell'autore. Per le torri 18+ non compare la frase (solo il badge).
 */
const NV = "#13224a", MUS = "#ffc72c", RED = "#e8362b";
const img = (src: string) => new Promise<HTMLImageElement>((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error(src)); i.src = src; });
function righe(c: CanvasRenderingContext2D, testo: string, larghezza: number): string[] { const out: string[] = []; let riga = ""; for (const p of testo.split(" ")) { const t = riga ? `${riga} ${p}` : p; if (c.measureText(t).width > larghezza && riga) { out.push(riga); riga = p; } else riga = t; } if (riga) out.push(riga); return out; }
function raggi(c: CanvasRenderingContext2D, w: number, h: number, cx: number, cy: number) {
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#79d3ee"); g.addColorStop(1, "#4fbce6"); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = "#ffffff30"; const R = Math.hypot(w, h), n = 30; for (let i = 0; i < n; i += 2) { const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, R, a0, a1); c.closePath(); c.fill(); }
}
function carta(c: CanvasRenderingContext2D, i: HTMLImageElement, x: number, y: number, w: number, rot: number, n: number) {
  const h = w * 1.5; c.save(); c.translate(x + w / 2, y + h / 2); c.rotate(rot); c.shadowColor = NV; c.shadowOffsetX = w * 0.04; c.shadowOffsetY = w * 0.05; c.fillStyle = "#fff"; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, w * 0.07); c.fill();
  c.shadowColor = "transparent"; const b = w * 0.045; c.save(); c.beginPath(); c.roundRect(-w / 2 + b, -h / 2 + b, w - 2 * b, h - 2 * b, w * 0.05); c.clip(); c.drawImage(i, -w / 2 + b, -h / 2 + b, w - 2 * b, h - 2 * b); c.restore();
  c.fillStyle = MUS; c.strokeStyle = NV; c.lineWidth = w * 0.03; c.beginPath(); c.arc(-w / 2 + w * 0.05, -h / 2 + w * 0.05, w * 0.1, 0, 7); c.fill(); c.stroke(); c.fillStyle = NV; c.font = `${w * 0.13}px Anton, Impact, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(String(n), -w / 2 + w * 0.05, -h / 2 + w * 0.06); c.restore();
}
function etichetta(c: CanvasRenderingContext2D, testo: string, x: number, y: number, size: number, bg: string, fg: string) {
  c.font = `${size}px Anton, Impact, sans-serif`; const w = c.measureText(testo).width + size * 0.9, h = size * 1.5; c.fillStyle = bg; c.strokeStyle = NV; c.lineWidth = size * 0.14; c.beginPath(); c.rect(x, y, w, h); c.fill(); c.stroke(); c.fillStyle = fg; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText(testo, x + size * 0.45, y + h / 2 + size * 0.04); return w;
}
export async function disegnaTorre(o: { carte: string[]; frase: string; verbo: string; eta: number; chiude: number; formato: "og" | "storia" }): Promise<Blob> {
  await loadCards(); try { await Promise.all([document.fonts.load("40px Anton"), document.fonts.load("28px Nunito")]); } catch { /* i caratteri di riserva vanno bene */ }
  const W = o.formato === "og" ? 1200 : 1080, H = o.formato === "og" ? 630 : 1920, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const c = cv.getContext("2d")!;
  const imgs = await Promise.all(o.carte.map((id) => img(cardFull(id)))), n = imgs.length, og = o.formato === "og";
  raggi(c, W, H, og ? W * 0.62 : W / 2, og ? H * 0.5 : H * 0.42);
  // titolo
  c.fillStyle = "#fff"; c.strokeStyle = NV; c.lineWidth = og ? 10 : 14; c.lineJoin = "round"; c.textAlign = "left"; c.textBaseline = "alphabetic"; const tit = ts("tu.og.titolo"), ts1 = og ? 74 : 110; c.font = `${ts1}px Anton, Impact, sans-serif`;
  const tl = righe(c, tit.toUpperCase(), og ? 560 : W - 100); tl.forEach((r, i) => { const y = (og ? 100 : 150) + i * ts1 * 1.02; c.strokeText(r, og ? 40 : 50, y); c.fillStyle = "#fff"; c.fillText(r, og ? 40 : 50, y); });
  const yb = (og ? 100 : 150) + tl.length * ts1 * 1.02 + (og ? 14 : 20); let fine = yb;
  if (o.eta >= 18) { c.font = `${og ? 34 : 54}px Nunito, sans-serif`; c.fillStyle = RED; c.strokeStyle = NV; c.lineWidth = 6; const x = og ? 40 : 50, w = og ? 520 : W - 100, h = og ? 120 : 190; c.fillRect(x, yb, w, h); c.strokeRect(x, yb, w, h); fine = yb + h; c.fillStyle = "#fff"; c.textBaseline = "middle"; c.font = `800 ${og ? 34 : 54}px Nunito, sans-serif`; righe(c, ts("tu.og.diciotto"), w - 40).forEach((r, i) => c.fillText(r, x + 20, yb + (og ? 38 : 60) + i * (og ? 42 : 64))); }
  else {
    const fs = og ? 30 : 50, x = og ? 40 : 50, w = og ? 540 : W - 100; c.font = `800 ${fs}px Nunito, sans-serif`; const testo = ts("tu.og.frase", { verbo: o.verbo, frase: o.frase }), rl = righe(c, testo, w - 36).slice(0, 4), h = rl.length * fs * 1.3 + fs;
    c.fillStyle = RED; c.strokeStyle = NV; c.lineWidth = 6; c.shadowColor = NV; c.shadowOffsetX = 8; c.shadowOffsetY = 8; c.fillRect(x, yb, w, h); c.shadowColor = "transparent"; c.strokeRect(x, yb, w, h); fine = yb + h; c.fillStyle = "#fff"; c.textBaseline = "top"; rl.forEach((r, i) => c.fillText(r, x + 18, yb + fs * 0.5 + i * fs * 1.3));
  }
  // terrazza di pietra con le carte: a destra nel formato largo, sotto il testo nella storia
  {
    const bottomTesto = o.formato === "og" ? 0 : fine;
    const tx = og ? 640 : 60, ty = og ? 40 : bottomTesto + 50, tw = og ? 520 : W - 120, th = og ? 550 : H - 240 - ty; c.fillStyle = "#e9d29a"; c.strokeStyle = NV; c.lineWidth = 8; c.beginPath(); c.roundRect(tx, ty, tw, th, 36); c.fill(); c.stroke();
    const cols = n <= 4 ? 2 : 3, rows = Math.ceil(n / cols), pad = og ? 24 : 34, cwMax = (tw - (cols + 1) * pad) / cols, cwAlt = (th - (rows + 1) * pad) / rows / 1.5, cw = Math.min(cwMax, cwAlt), ch = cw * 1.5, gx = (tw - cols * cw) / (cols + 1), gy = (th - rows * ch) / (rows + 1);
    imgs.forEach((im, i) => carta(c, im, tx + gx + (i % cols) * (cw + gx), ty + gy + Math.floor(i / cols) * (ch + gy), cw, ((i % 3) - 1) * 0.05, i + 1));
  }
  // età e scadenza
  const quando = new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(o.chiude)), by = og ? H - 70 : H - 150;
  const bw = o.eta >= 10 ? etichetta(c, `${o.eta}+`, og ? 40 : 50, by, og ? 34 : 56, o.eta >= 18 ? RED : o.eta >= 14 ? MUS : "#9fd8ff", o.eta >= 18 ? "#fff" : NV) : 0;
  c.fillStyle = NV; c.font = `800 ${og ? 28 : 44}px Nunito, sans-serif`; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText(ts("tu.og.scade", { quando }), (og ? 40 : 50) + (bw ? bw + 16 : 0), by + (og ? 26 : 42));
  return await new Promise<Blob>((ok, ko) => cv.toBlob((b) => (b ? ok(b) : ko(new Error("jpeg"))), "image/jpeg", og ? 0.82 : 0.88));
}
