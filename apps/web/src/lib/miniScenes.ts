import type { MiniKind } from "@gdt/game-engine";

/**
 * Le scenette finali degli intervalli a tempo, descritte come percorsi (nessun DOM: si possono provare con i test).
 * Coordinate nel «disegno» della terrazza (come Terrace.tsx): x 0–372; i piedi del personaggio stanno in (x, y). Tempi in millisecondi.
 */
export interface WP { t: number; x: number; y: number; s?: number; r?: number; o?: number; z?: number }
export interface FigSpec { key: string; /** posizione 1–6 sulla torre, oppure il personaggio di lato (accusatore / partner) */ who: number | "side"; wps: WP[] }
export interface Heart { t: number; x: number; y: number; dx: number; rise: number; fall: number; size: number; dur: number; hue: number }
export interface Burst { t: number; x: number; y: number; kind: "bam" | "via" }
export interface Finale { duration: number; figs: FigSpec[]; hearts: Heart[]; bursts: Burst[] }

/** Dove stanno i sei personaggi a riposo: due file da tre, davanti al separé. */
export const SLOT: Record<number, { x: number; y: number }> = {
  1: { x: 104, y: 525 }, 2: { x: 186, y: 525 }, 3: { x: 268, y: 525 },
  4: { x: 104, y: 605 }, 5: { x: 186, y: 605 }, 6: { x: 268, y: 605 },
};
/** Il personaggio di lato (accusatore o partner). */
export const SIDE = { x: 52, y: 575 };
export const FIG_SCALE = 0.86;
export const EDGE_Y = 628;   // bordo davanti della terrazza: oltre, si cade

/** Piccola oscillazione di riposo (i personaggi «respirano»): da t0 a t1, un passo ogni 360 ms. */
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

export function buildFinale(kind: MiniKind, leaders: number[], fallen: number[], rand: () => number = Math.random): Finale {
  const figs: FigSpec[] = [], hearts: Heart[] = [], bursts: Burst[] = [];
  const positions = [1, 2, 3, 4, 5, 6];
  const stand = (p: number) => SLOT[p]!;
  const idleFig = (p: number, end: number): FigSpec => ({ key: `c${p}`, who: p, wps: idle(stand(p).x, stand(p).y, 0, end, p) });

  if (kind === "accusa" && fallen.length) {
    const K = fallen.length, sc = compress(K), D = 5000 * sc, start = 600, end = start + K * D + 700;
    // l'accusatore insegue gli accusati uno dopo l'altro per tutta la terrazza, finché non li butta giù
    let acc: WP[] = [{ t: 0, x: SIDE.x, y: SIDE.y, s: FIG_SCALE }], accAt = { x: SIDE.x, y: SIDE.y };
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
    });
    acc = sort(acc); const lastT = acc[acc.length - 1]!.t;
    acc.push(...idle(accAt.x, accAt.y, lastT + 300, end, 1));
    figs.push({ key: "side", who: "side", wps: sort(acc) });
    for (const p of positions) if (!fallen.includes(p)) figs.push(idleFig(p, end));
    return { duration: end, figs, hearts, bursts };
  }

  if (kind === "peggiore" && fallen.length) {
    const K = fallen.length, sc = compress(K), D = 3900 * sc, start = 500, end = start + K * D + 600;
    // tutte le altre carte sollevano il peggiore e lo lanciano giù dalla torre, uno dopo l'altro
    const cur: Record<number, { x: number; y: number }> = {}; for (const p of positions) cur[p] = { ...stand(p) };
    const tracks: Record<number, WP[]> = {}; for (const p of positions) tracks[p] = [{ t: 0, x: cur[p]!.x, y: cur[p]!.y, s: FIG_SCALE }];
    const ring = [{ x: -92, y: 26 }, { x: -46, y: 62 }, { x: 46, y: 62 }, { x: 92, y: 26 }, { x: 0, y: -42 }];
    const gone = new Set<number>();
    fallen.forEach((p, k) => {
      const b = start + k * D, F = stand(p), others = positions.filter((q) => q !== p && !gone.has(q));
      const T = (v: number) => b + v * sc;
      // le altre si raccolgono intorno al peggiore
      others.forEach((q, i) => {
        const sp = ring[i % ring.length]!, tx = F.x + sp.x, ty = F.y + sp.y;
        tracks[q]!.push({ t: T(0), x: cur[q]!.x, y: cur[q]!.y, s: FIG_SCALE }, { t: T(700), x: tx, y: ty, s: FIG_SCALE, r: 0 });
        // lo sollevano (saltelli con le braccia in alto) e festeggiano dopo il lancio
        tracks[q]!.push({ t: T(950), x: tx, y: ty - 14, s: FIG_SCALE, r: -5 }, { t: T(1250), x: tx, y: ty, s: FIG_SCALE, r: 5 }, { t: T(1550), x: tx, y: ty - 20, s: FIG_SCALE, r: -5 }, { t: T(1850), x: tx, y: ty, s: FIG_SCALE });
        tracks[q]!.push(...hop(tx, ty, T(2700), 2, 20, 280 * sc).slice(1).map((w) => ({ ...w })));
        cur[q] = { x: tx, y: ty };
      });
      tracks[p]!.push({ t: T(700), x: F.x, y: F.y, s: FIG_SCALE },
        { t: T(1000), x: F.x, y: F.y - 105, s: 1.0, r: -6 }, { t: T(1300), x: F.x, y: F.y - 112, s: 1.0, r: 6 }, { t: T(1600), x: F.x, y: F.y - 108, s: 1.02, r: -6 },
        { t: T(1900), x: F.x + 24, y: F.y - 170, s: 1.1, r: 30 }, { t: T(2300), x: F.x + 70, y: Math.min(F.y, EDGE_Y) + 20, s: 1.2, r: 220 },
        { t: T(3000), x: F.x + 120, y: EDGE_Y + 760, s: 1.5, r: 600, o: 1 }, { t: T(3060), x: F.x + 120, y: EDGE_Y + 780, s: 1.5, r: 600, o: 0 });
      bursts.push({ t: T(1800), x: F.x + 8, y: F.y - 260, kind: "via" });
      gone.add(p);
    });
    for (const p of positions) {
      const t = sort(tracks[p]!), last = t[t.length - 1]!;
      if (!fallen.includes(p)) t.push(...idle(last.x, last.y, last.t + 200, end, p));
      figs.push({ key: `c${p}`, who: p, wps: t });
    }
    return { duration: end, figs, hearts, bursts };
  }

  if (kind === "amore" && leaders.length) {
    // il partner e i vincitori si avvicinano e dal loro abbraccio sgorgano cuori, che cadono giù dalla torre come fontane
    const W = leaders.slice(0, 6), end = 6800, meet = 1800;
    const P = { x: 150, y: 548 };
    const spots = [{ x: 82, y: 0 }, { x: 62, y: 62 }, { x: -62, y: 62 }, { x: 0, y: 70 }, { x: 88, y: -62 }, { x: -70, y: -50 }];
    figs.push({ key: "side", who: "side", wps: sort([{ t: 0, x: SIDE.x, y: SIDE.y, s: FIG_SCALE }, { t: meet, x: P.x, y: P.y, s: FIG_SCALE }, ...hop(P.x, P.y, meet + 100, 9, 20, 300).slice(1)]) });
    W.forEach((p, j) => {
      const s = stand(p), sp = spots[j]!, tx = P.x + sp.x, ty = P.y + sp.y;
      figs.push({ key: `c${p}`, who: p, wps: sort([...idle(s.x, s.y, 0, 300, p), { t: 300, x: s.x, y: s.y, s: FIG_SCALE }, { t: meet, x: tx, y: ty, s: FIG_SCALE }, ...hop(tx, ty, meet + 100 + j * 70, 9, 18, 300).slice(1)]) });
    });
    for (const p of positions) if (!W.includes(p)) figs.push(idleFig(p, end));
    const n = 52;
    for (let i = 0; i < n; i++) {
      const dx = (rand() - 0.5) * 300;
      hearts.push({ t: meet + 250 + i * 70, x: P.x + 40, y: P.y - 90, dx, rise: 110 + rand() * 120, fall: 520 + rand() * 260, size: 16 + rand() * 20, dur: 2300 + rand() * 600, hue: [350, 335, 5, 320][i % 4]! });
    }
    return { duration: end, figs, hearts, bursts };
  }

  // nessuno ha votato in tempo: tutti restano a guardarsi
  const end = 1800;
  for (const p of positions) figs.push(idleFig(p, end));
  if (kind !== "peggiore") figs.push({ key: "side", who: "side", wps: idle(SIDE.x, SIDE.y, 0, end) });
  return { duration: end, figs, hearts, bursts };
}
