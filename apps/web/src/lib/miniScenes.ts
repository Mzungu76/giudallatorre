import type { MiniKind } from "@gdt/game-engine";

/**
 * Le scenette finali degli intervalli a tempo, descritte come percorsi (nessun DOM: si possono provare con i test).
 * I protagonisti sono le carte (con gambette). Coordinate nel «disegno» della terrazza (come Terrace.tsx): x 0–372; i piedi stanno in (x, y).
 * Tempi in millisecondi; `TS` rallenta tutto in blocco (le scenette devono essere leggibili, non frettolose).
 */
export interface WP { t: number; x: number; y: number; s?: number; r?: number; o?: number }
export interface FigSpec { key: string; /** posizione 1–6 sulla torre, oppure la carta di lato (accusatore / partner) */ who: number | "side"; wps: WP[] }
export interface Heart { t: number; x: number; y: number; dx: number; rise: number; fall: number; size: number; dur: number; hue: number }
export interface Burst { t: number; x: number; y: number; kind: "bam" | "via" }
/** Macchina da presa: spostamento e ingrandimento della scena (origine al centro della terrazza). */
export interface Cam { t: number; x: number; y: number; s: number }
export interface Sound { t: number; kind: "stamp" | "whoosh" | "ding" | "tada" | "drum" }
export interface Finale { duration: number; figs: FigSpec[]; hearts: Heart[]; bursts: Burst[]; cam: Cam[]; sounds: Sound[] }

export const TS = 1.7;
/** Dove stanno le sei carte a riposo: due file da tre, davanti al separé. */
export const SLOT: Record<number, { x: number; y: number }> = {
  1: { x: 104, y: 525 }, 2: { x: 186, y: 525 }, 3: { x: 268, y: 525 },
  4: { x: 104, y: 605 }, 5: { x: 186, y: 605 }, 6: { x: 268, y: 605 },
};
/** La carta di lato (accusatore o partner). */
export const SIDE = { x: 52, y: 575 };
export const FIG_SCALE = 0.74;
export const EDGE_Y = 628;   // bordo davanti della terrazza: oltre, si cade

/** Piccola oscillazione di riposo (le carte «respirano»): da t0 a t1, un passo ogni 360 ms. */
function idle(x: number, y: number, t0: number, t1: number, ph = 0): WP[] {
  const out: WP[] = []; let k = ph;
  for (let t = t0; t < t1; t += 360, k++) out.push({ t, x, y: y - (k % 2 ? 5 : 0), s: FIG_SCALE, r: k % 2 ? 2 : -2 });
  return out;
}
/** Salto di gioia (n rimbalzi) da t0. */
function hop(x: number, y: number, t0: number, n: number, h = 22, step = 260): WP[] {
  const out: WP[] = [{ t: t0, x, y, s: FIG_SCALE }];
  for (let i = 0; i < n; i++) { out.push({ t: t0 + i * step + step / 2, x, y: y - h, s: FIG_SCALE, r: i % 2 ? 6 : -6 }); out.push({ t: t0 + (i + 1) * step, x, y, s: FIG_SCALE }); }
  return out;
}
const sort = (w: WP[]) => w.slice().sort((a, b) => a.t - b.t);
/** Compressione dei tempi quando cadono / vincono più carte in parità: prima la scena intera, poi sempre più rapida. */
export const compress = (k: number) => (k <= 1 ? 1 : k === 2 ? 0.75 : 0.5);
const shake = (t: number, x: number, y: number, s: number): Cam[] => [{ t, x: x + 7, y: y - 5, s }, { t: t + 70, x: x - 8, y: y + 4, s }, { t: t + 140, x: x + 5, y: y - 3, s }, { t: t + 210, x: x - 4, y: y + 2, s }, { t: t + 280, x, y, s }];

export function buildFinale(kind: MiniKind, leaders: number[], fallen: number[], rand: () => number = Math.random): Finale {
  const f = build0(kind, leaders, fallen, rand), k = TS;
  return {
    duration: f.duration * k,
    figs: f.figs.map((g) => ({ ...g, wps: g.wps.map((w) => ({ ...w, t: w.t * k })) })),
    hearts: f.hearts.map((h) => ({ ...h, t: h.t * k, dur: h.dur * k })),
    bursts: f.bursts.map((b) => ({ ...b, t: b.t * k })),
    cam: f.cam.map((c) => ({ ...c, t: c.t * k })),
    sounds: f.sounds.map((s) => ({ ...s, t: s.t * k })),
  };
}

function build0(kind: MiniKind, leaders: number[], fallen: number[], rand: () => number): Finale {
  const figs: FigSpec[] = [], hearts: Heart[] = [], bursts: Burst[] = [], sounds: Sound[] = [];
  const positions = [1, 2, 3, 4, 5, 6];
  const stand = (p: number) => SLOT[p]!;
  const idleFig = (p: number, end: number): FigSpec => ({ key: `c${p}`, who: p, wps: idle(stand(p).x, stand(p).y, 0, end, p) });
  // chi non c'entra con la scena sparisce subito, così si capisce chi sono i protagonisti
  const leave = (p: number, end: number): FigSpec => { const q = stand(p); return { key: `c${p}`, who: p, wps: [{ t: 0, x: q.x, y: q.y, s: FIG_SCALE, o: 1 }, { t: 500, x: q.x, y: q.y - 10, s: FIG_SCALE * 0.85, o: 0 }, { t: end, x: q.x, y: q.y - 10, s: FIG_SCALE * 0.85, o: 0 }] }; };
  const cam = (end: number, mid: Cam[]): Cam[] => [{ t: 0, x: 0, y: 0, s: 1 }, ...mid, { t: end, x: 0, y: 0, s: 1 }];

  if (kind === "accusa" && fallen.length) {
    const K = fallen.length, sc = compress(K), D = 5000 * sc, start = 600, end = start + K * D + 900;
    // l'accusatore insegue gli accusati uno dopo l'altro per tutta la terrazza, finché non li butta giù
    const acc: WP[] = [{ t: 0, x: SIDE.x, y: SIDE.y, s: FIG_SCALE }];
    let accAt = { x: SIDE.x, y: SIDE.y }; const camMid: Cam[] = [];
    acc.push(...hop(SIDE.x, SIDE.y, 100, 2, 18, 220));
    const route = (x0: number, y0: number) => [{ x: x0, y: y0 }, { x: 305, y: 575 }, { x: 292, y: 430 }, { x: 92, y: 440 }, { x: 78, y: 596 }, { x: 186, y: EDGE_Y - 14 }];
    fallen.forEach((p, k) => {
      const b = start + k * D, from = stand(p), r = route(from.x, from.y);
      const chase = 3200 * sc, delay = 450 * sc;
      const path: WP[] = r.map((q, i) => ({ t: b + (chase * i) / (r.length - 1), x: q.x, y: q.y, s: FIG_SCALE, r: i % 2 ? -4 : 4 }));
      const fall = b + chase + 250 * sc;
      const lost: WP[] = [...path, { t: fall, x: 186, y: EDGE_Y - 14, s: FIG_SCALE }, { t: fall + 280 * sc, x: 196, y: EDGE_Y + 60, s: 1.15, r: 40 }, { t: fall + 900 * sc, x: 250, y: EDGE_Y + 760, s: 1.5, r: 540, o: 1 }, { t: fall + 960 * sc, x: 250, y: EDGE_Y + 780, s: 1.5, r: 540, o: 0 }];
      figs.push({ key: `c${p}`, who: p, wps: sort([...idle(from.x, from.y, 0, b, p), { t: b, x: from.x, y: from.y, s: FIG_SCALE }, ...lost.slice(1)]) });
      // l'accusatore parte con un po' di ritardo, stesso percorso, e alla fine spinge
      const ar = route(accAt.x, accAt.y).map((q, i, a) => (i === a.length - 1 ? { x: 130, y: EDGE_Y - 14 } : q));
      acc.push({ t: b, x: accAt.x, y: accAt.y, s: FIG_SCALE });
      ar.forEach((q, i) => acc.push({ t: b + delay + (chase * i) / (ar.length - 1), x: q.x, y: q.y, s: FIG_SCALE, r: i % 2 ? 4 : -4 }));
      acc.push({ t: fall, x: 130, y: EDGE_Y - 14, s: FIG_SCALE }, { t: fall + 160 * sc, x: 168, y: EDGE_Y - 20, s: 1.08, r: -10 }, { t: fall + 520 * sc, x: 130, y: EDGE_Y - 14, s: FIG_SCALE });
      accAt = { x: 130, y: EDGE_Y - 14 };
      bursts.push({ t: fall + 120 * sc, x: 186, y: EDGE_Y - 120, kind: "bam" });
      sounds.push({ t: b + 200, kind: "whoosh" }, { t: fall + 120 * sc, kind: "stamp" });
      // la macchina da presa segue l'inseguimento, si avvicina al bordo e trema all'urto
      camMid.push({ t: b, x: 0, y: 0, s: 1.03 }, { t: b + chase * 0.5, x: 0, y: -10, s: 1.1 }, { t: fall - 100, x: 0, y: -28, s: 1.16 }, ...shake(fall + 120 * sc, 0, -30, 1.18), { t: fall + 900 * sc, x: 0, y: -22, s: 1.1 });
    });
    const as = sort(acc), lastT = as[as.length - 1]!.t;
    as.push(...idle(accAt.x, accAt.y, lastT + 300, end, 1));
    figs.push({ key: "side", who: "side", wps: sort(as) });
    for (const p of positions) if (!fallen.includes(p)) figs.push(leave(p, end));   // restano solo gli accusati e l'accusatore
    return { duration: end, figs, hearts, bursts, cam: cam(end, camMid), sounds };
  }

  if (kind === "peggiore" && fallen.length) {
    // «crowd surfing»: le carte non cadute si mettono in fila, sollevano sopra di sé una carta caduta per volta, distesa in orizzontale,
    // la portano di mano in mano da un lato all'altro e infine la lanciano giù dalla torre
    const K = fallen.length, sc = compress(K), D = 4700 * sc, start = 600, end = start + K * D + 800;
    const crowd = positions.filter((q) => !fallen.includes(q)), N = crowd.length, YC = 596, XL = 52, XR = 322;
    const cx = (i: number) => (N === 1 ? 186 : 78 + (i * (296 - 78)) / (N - 1));   // posto di ognuno nella fila
    const camMid: Cam[] = [];
    const tracks: Record<number, WP[]> = {}; for (const p of positions) tracks[p] = [{ t: 0, x: stand(p).x, y: stand(p).y, s: FIG_SCALE }];
    // una carta distesa: il suo centro sta in (c, y); ruotata di -90° attorno ai piedi, il centro cade a sinistra dell'ancora
    const lie = (t: number, c: number, y: number, r = 0, s = 1.0): WP => ({ t, x: c + 70 * s, y, s, r: -90 + r });
    // 1) la folla si dispone in fila, davanti, e alza le braccia
    crowd.forEach((q, i) => {
      tracks[q]!.push({ t: start, x: stand(q).x, y: stand(q).y, s: FIG_SCALE }, { t: start + 700 * sc, x: cx(i), y: YC, s: FIG_SCALE, r: 0 });
    });
    fallen.forEach((p, k) => {
      const b = start + k * D, T = (v: number) => b + v * sc, F = stand(p);
      // 2) il peggiore si avvicina al lato sinistro della folla e viene preso in alto
      const wait = { x: 40 + (k % 2) * 30, y: 470 };
      if (k > 0) tracks[p]!.push({ t: start, x: F.x, y: F.y, s: FIG_SCALE }, { t: start + 700 * sc, x: wait.x, y: wait.y, s: FIG_SCALE });   // chi aspetta il suo turno si ritira sul fondo
      else tracks[p]!.push({ t: T(0), x: F.x, y: F.y, s: FIG_SCALE });
      tracks[p]!.push({ t: T(900), x: XL - 4, y: YC - 4, s: FIG_SCALE, r: 0 },
        lie(T(1300), XL + 8, YC - 128, 0, 1.0));
      // 3) viene portato da sinistra a destra, sopra le mani, ondeggiando
      const carry = 1800, bobs = 5;
      for (let j = 1; j <= bobs; j++) { const u = j / bobs, c = XL + 8 + (XR - XL - 8) * u; tracks[p]!.push(lie(T(1300 + carry * u), c, YC - 128 - (j % 2 ? 12 : -4), j % 2 ? 7 : -7, 1.0)); }
      // 4) lanciato in aria e giù dalla torre
      tracks[p]!.push(lie(T(3250), XR + 20, YC - 190, 20, 1.05),
        { t: T(3600), x: XR + 70, y: EDGE_Y - 40, s: 1.15, r: 200 }, { t: T(4000), x: XR + 120, y: EDGE_Y + 760, s: 1.5, r: 560, o: 1 }, { t: T(4060), x: XR + 120, y: EDGE_Y + 780, s: 1.5, r: 560, o: 0 });
      // le carte della folla alzano le mani quando il peggiore passa sopra di loro e festeggiano al lancio
      crowd.forEach((q, i) => {
        const tp = T(1300 + (carry * (cx(i) - XL)) / (XR - XL));
        tracks[q]!.push({ t: tp - 260 * sc, x: cx(i), y: YC, s: FIG_SCALE }, { t: tp, x: cx(i), y: YC - 16, s: FIG_SCALE, r: i % 2 ? 4 : -4 }, { t: tp + 260 * sc, x: cx(i), y: YC, s: FIG_SCALE },
          ...hop(cx(i), YC, T(3300), 2, 20, 260 * sc).slice(1));
      });
      bursts.push({ t: T(3250), x: XR - 30, y: YC - 300, kind: "via" });
      sounds.push({ t: T(900), kind: "drum" }, { t: T(1300), kind: "whoosh" }, { t: T(3250), kind: "whoosh" }, { t: T(3950), kind: "stamp" });
      // la macchina da presa segue la carta da sinistra a destra, poi trema al lancio
      camMid.push({ t: T(900), x: 22, y: 14, s: 1.08 }, { t: T(1300 + carry * 0.5), x: 0, y: 18, s: 1.1 }, { t: T(3250), x: -22, y: 14, s: 1.1 }, ...shake(T(3950), -10, 10, 1.08), { t: T(4500), x: 0, y: 0, s: 1.02 });
    });
    for (const p of positions) {
      const t = sort(tracks[p]!), last = t[t.length - 1]!;
      if (crowd.includes(p)) t.push(...idle(cx(crowd.indexOf(p)), YC, last.t + 200, end, p));
      else if (!fallen.includes(p)) t.push(...idle(last.x, last.y, last.t + 200, end, p));
      figs.push({ key: `c${p}`, who: p, wps: t });
    }
    return { duration: end, figs, hearts, bursts, cam: cam(end, camMid), sounds };
  }

  if (kind === "amore" && leaders.length) {
    // il partner e i vincitori si avvicinano e dal loro abbraccio sgorgano cuori, che cadono giù dalla torre come fontane
    const W = leaders.slice(0, 6), end = 8200, meet = 1800;
    const P = { x: 150, y: 548 };
    const spots = [{ x: 82, y: 0 }, { x: 62, y: 62 }, { x: -62, y: 62 }, { x: 0, y: 70 }, { x: 88, y: -62 }, { x: -70, y: -50 }];
    figs.push({ key: "side", who: "side", wps: sort([{ t: 0, x: SIDE.x, y: SIDE.y, s: FIG_SCALE }, { t: meet, x: P.x, y: P.y, s: FIG_SCALE }, ...hop(P.x, P.y, meet + 100, 9, 20, 300).slice(1)]) });
    W.forEach((p, j) => {
      const s = stand(p), sp = spots[j]!, tx = P.x + sp.x, ty = P.y + sp.y;
      figs.push({ key: `c${p}`, who: p, wps: sort([...idle(s.x, s.y, 0, 300, p), { t: 300, x: s.x, y: s.y, s: FIG_SCALE }, { t: meet, x: tx, y: ty, s: FIG_SCALE }, ...hop(tx, ty, meet + 100 + j * 70, 9, 18, 300).slice(1)]) });
    });
    for (const p of positions) if (!W.includes(p)) figs.push(leave(p, end));   // restano solo gli innamorati
    const n = 56;
    for (let i = 0; i < n; i++) {
      const dx = (rand() - 0.5) * 300;
      hearts.push({ t: meet + 250 + i * 70, x: P.x + 40, y: P.y - 90, dx, rise: 110 + rand() * 120, fall: 520 + rand() * 260, size: 16 + rand() * 20, dur: 2300 + rand() * 600, hue: [350, 335, 5, 320][i % 4]! });
    }
    for (let i = 0; i < 6; i++) sounds.push({ t: meet + 300 + i * 620, kind: "ding" });
    return { duration: end, figs, hearts, bursts, cam: cam(end, [{ t: 300, x: 0, y: 0, s: 1.02 }, { t: meet, x: 12, y: 8, s: 1.08 }, { t: meet + 2600, x: 18, y: 14, s: 1.15 }, { t: end - 900, x: 12, y: 8, s: 1.1 }]), sounds };
  }

  // nessuno ha votato in tempo: tutte le carte restano a guardarsi
  const end = 1800;
  for (const p of positions) figs.push(idleFig(p, end));
  if (kind !== "peggiore") figs.push({ key: "side", who: "side", wps: idle(SIDE.x, SIDE.y, 0, end) });
  return { duration: end, figs, hearts, bursts, cam: cam(end, []), sounds };
}
