import { describe, expect, it } from "vitest";
import { buildFinale, compress, EDGE_Y, SLOT, TS } from "../src/lib/miniScenes.ts";
import type { Finale, WP } from "../src/lib/miniScenes.ts";

const rand = () => 0.5;
const track = (f: Finale, who: number | "side") => f.figs.find((x) => x.who === who)!.wps;
const last = (w: WP[]) => w.slice().sort((a, b) => a.t - b.t)[w.length - 1]!;

describe("scenette finali degli intervalli", () => {
  it("tutti i tempi sono rallentati di TS e le scenette singole durano almeno 8 secondi", () => {
    expect(TS).toBeGreaterThanOrEqual(1.5);
    for (const [kind, l, c] of [["accusa", [3], [3]], ["peggiore", [2], [2]], ["amore", [1, 5], []]] as const) expect(buildFinale(kind, [...l], [...c], rand).duration, kind).toBeGreaterThanOrEqual(8000);
  });
  it("la macchina da presa parte e torna a inquadratura piena; ci sono effetti sonori", () => {
    for (const [kind, l, c] of [["accusa", [3], [3]], ["peggiore", [2], [2]], ["amore", [1, 5], []]] as const) { const f = buildFinale(kind, [...l], [...c], rand); expect(f.cam[0]!.s).toBe(1); expect(f.cam[f.cam.length - 1]!.s).toBe(1); expect(Math.max(...f.cam.map((x) => x.s))).toBeGreaterThan(1.05); expect(f.sounds.length, kind).toBeGreaterThan(0); expect(Math.max(...f.cam.map((x) => x.t)), kind).toBeLessThanOrEqual(f.duration + 1); }
  });
  it("tutte le scenette hanno una durata ragionevole (né troppo veloci né lente) e tempi mai oltre la durata", () => {
    for (const [kind, leaders, fallen] of [["accusa", [3], [3]], ["peggiore", [2], [2]], ["amore", [1, 5], []], ["accusa", [1, 4], [1, 4]], ["peggiore", [1, 2, 3], [1, 2, 3]]] as const) {
      const f = buildFinale(kind, [...leaders], [...fallen], rand);
      expect(f.duration, kind).toBeGreaterThanOrEqual(8000); expect(f.duration, kind).toBeLessThanOrEqual(20_000);   // abbastanza lunghe da capirsi, non eterne
      for (const fig of f.figs) for (const w of fig.wps) { expect(w.t, `${kind} ${fig.key}`).toBeGreaterThanOrEqual(0); expect(w.t, `${kind} ${fig.key}`).toBeLessThanOrEqual(f.duration + 1); expect(Number.isFinite(w.x + w.y)).toBe(true); }
    }
  });
  it("Accusa: l'accusato fugge per la terrazza, viene buttato giù e sparisce; l'accusatore c'è, gli altri restano", () => {
    const f = buildFinale("accusa", [3], [3], rand), a = track(f, 3), end = last(a);
    expect(end.o).toBe(0); expect(end.y).toBeGreaterThan(EDGE_Y + 300);   // cade oltre il bordo davanti
    const xs = a.map((w) => w.x); expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(150);   // ha attraversato la terrazza
    expect(f.figs.some((x) => x.who === "side")).toBe(true);
    for (const p of [1, 2, 4, 5, 6]) expect(last(track(f, p)).o ?? 1).toBe(1);
    expect(f.bursts.some((b) => b.kind === "bam")).toBe(true);
    // l'accusatore insegue: parte dopo l'accusato ma lo raggiunge prima della caduta
    const side = track(f, "side").filter((w) => w.t > 0);
    expect(side.some((w) => w.y > EDGE_Y - 40 && w.x > 90 && w.x < 200)).toBe(true);
  });
  it("Il peggiore (crowd surfing): le altre carte fanno la fila, il peggiore viene portato in orizzontale sopra di loro da sinistra a destra e poi lanciato", () => {
    const f = buildFinale("peggiore", [2], [2], rand), a = track(f, 2);
    const lying = a.filter((w) => Math.abs((w.r ?? 0) + 90) <= 12);
    expect(lying.length).toBeGreaterThanOrEqual(6);   // disteso in orizzontale
    const xs = lying.map((w) => w.x); expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(200);   // attraversa tutta la fila
    expect(lying[lying.length - 1]!.x).toBeGreaterThan(lying[0]!.x);   // da sinistra a destra
    for (const p of [1, 3, 4, 5, 6]) { const w = last(track(f, p)); expect(Math.abs(w.y - 596)).toBeLessThan(25); expect(w.o ?? 1).toBe(1); }   // la folla è in fila davanti
    const ys = [1, 3, 4, 5, 6].map((p) => last(track(f, p)).x); expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(150);   // la fila è larga
    const top = Math.min(...lying.map((w) => w.y)); expect(top).toBeLessThan(596 - 100);   // sopra le teste
    expect(last(a).o).toBe(0); expect(last(a).y).toBeGreaterThan(EDGE_Y + 300);   // poi è fuori
    expect(f.figs.some((x) => x.who === "side")).toBe(false);   // nel Peggiore non c'è un personaggio di lato
    expect(f.bursts).toHaveLength(1);
  });
  it("Il peggiore con più carte cadute: una alla volta, sempre dalla stessa parte", () => {
    const f = buildFinale("peggiore", [2, 5], [2, 5], rand), start = (p: number) => track(f, p).find((w) => Math.abs((w.r ?? 0) + 90) <= 12)!.t;
    expect(start(5)).toBeGreaterThan(start(2) + 3000);
    for (const p of [2, 5]) expect(last(track(f, p)).o).toBe(0);
  });
  it("Storia d'amore: partner e vincitori si avvicinano, nessuno cade, e sgorgano cuori che poi cadono giù dalla torre", () => {
    const f = buildFinale("amore", [1, 5], [], rand);
    for (const fig of f.figs) expect(last(fig.wps).o ?? 1, fig.key).toBe(1);
    const p = last(track(f, "side")), w = last(track(f, 1)), w5 = last(track(f, 5));
    for (const q of [w, w5]) expect(Math.hypot(q.x - p.x, q.y - p.y)).toBeLessThan(130);   // vicini al partner
    expect(f.hearts.length).toBeGreaterThanOrEqual(40);
    for (const h of f.hearts) { expect(h.rise).toBeGreaterThan(0); expect(h.fall).toBeGreaterThan(h.rise); expect(h.t + h.dur).toBeLessThanOrEqual(f.duration + 3500); }
    expect(Math.max(...f.hearts.map((h) => h.t))).toBeGreaterThan(2500);   // una vera fontana: i cuori continuano a sgorgare
  });
  it("più carte in parità: si fanno una dopo l'altra, sempre più rapide, tutte fuori alla fine", () => {
    expect(compress(1)).toBe(1); expect(compress(2)).toBeLessThan(1); expect(compress(3)).toBeLessThan(compress(2));
    const f = buildFinale("accusa", [1, 4], [1, 4], rand), a = last(track(f, 1)), b = last(track(f, 4));
    expect(a.o).toBe(0); expect(b.o).toBe(0);
    const tFall = (w: WP[]) => w.find((x) => x.y > EDGE_Y + 300)!.t;
    expect(tFall(track(f, 4))).toBeGreaterThan(tFall(track(f, 1)));
  });
  it("nessun voto arrivato: una breve pausa, nessuno cade", () => {
    for (const kind of ["accusa", "amore", "peggiore"] as const) { const f = buildFinale(kind, [], [], rand); expect(f.duration).toBeLessThan(4000); expect(f.hearts).toHaveLength(0); for (const fig of f.figs) expect(last(fig.wps).o ?? 1).toBe(1); }
  });
});
