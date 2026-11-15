import { describe, expect, it } from "vitest";
import { applyAction, chooseBotAction, createGame, isLegal, learnFromResult, legalActions, megafonoOf, newBotMemory, observe } from "../src/index.ts";
import type { Action, BotLevel, GameState } from "../src/index.ts";
import { nextRandom } from "../src/rng.ts";
import { cfg } from "./helpers.ts";
import { hideFrom } from "./hideFrom.ts";

const LEVELS: BotLevel[] = ["easy", "medium", "hard"];
/** Percorre partite intere con i bot in produzione e chiama `visit` a ogni passo, per ogni giocatore. */
function walk(visit: (s: GameState, p: string, next: Action | null) => void, opts: { sizes?: number[]; seeds?: number } = {}) {
  let steps = 0;
  for (const n of opts.sizes ?? [3, 4, 6, 8]) for (let seed = 1; seed <= (opts.seeds ?? 5); seed++) {
    let s = createGame(cfg(n, { seed, miniGame: "random", accuseDeck: ["Mi ha rubato il panino!"] })).state; const mem = newBotMemory(); let r = seed * 131 + n, g = 0;
    const rand = () => { const x = nextRandom(r); r = x.state; return x.value; };
    while (s.phase !== "GAME_OVER" && g++ < 6000) {
      let moved: Action | null = null;
      for (const p of s.playerIds) {
        const a = chooseBotAction(s, p, LEVELS[(Number(p.slice(1)) + seed) % 3]!, mem, rand);
        visit(s, p, a); steps++;
        if (a && !moved) moved = a;
      }
      if (moved) { s = applyAction(s, moved).state; continue; }
      const before = s.phase, tower = s.tower; s = applyAction(s, s.phase === "MINI_RUN" ? { type: "endRun" } : { type: "advance" }).state;
      if (before === "RESULTS" && s.lastResult) learnFromResult(mem, tower, s.lastResult);
    }
    expect(s.phase).toBe("GAME_OVER");
  }
  return steps;
}

describe("Observation: nessuna informazione nascosta", () => {
  it("l'osservazione non cambia se si alterano mani altrui, carte coperte, voti segreti, proprietari prima dello spoglio, segnalino altrui, mazzi e seme", () => {
    const phases: Record<string, number> = {};
    const steps = walk((s, p) => {
      expect(observe(hideFrom(s, p), p), `${s.phase} turno ${s.turnNumber} ${p}`).toEqual(observe(s, p));
      phases[s.phase] = (phases[s.phase] ?? 0) + 1;
    });
    expect(steps).toBeGreaterThan(1500);
    for (const ph of ["PROCLAIM", "PLAY", "SUSPECT", "VOTE", "MINI_RUN", "RESULTS"]) expect(phases[ph] ?? 0, ph).toBeGreaterThan(50);
  });

  it("controllo di efficacia: ciò che il giocatore PUÒ sapere cambia l'osservazione", () => {
    const s = createGame(cfg(4, { seed: 9 })).state, p = s.playerIds[1]!;
    const t = structuredClone(s); t.hands[p] = t.hands[p]!.slice().reverse().map((c) => c + "x");
    expect(observe(t, p).myHand).not.toEqual(observe(s, p).myHand);               // la propria mano è visibile
    const u = structuredClone(s); u.scores[p] = 99;
    expect(observe(u, p).players.find((x) => x.id === p)!.score).toBe(99);       // i punteggi sono pubblici
  });

  it("il Megafono vede il proprio segnalino, gli altri no; dopo lo spoglio lo vedono tutti", () => {
    let seenMega = 0, seenOther = 0, seenReveal = 0;
    walk((s, p) => {
      if (!s.marks?.length) return;
      const o = observe(s, p), isMega = p === megafonoOf(s), revealed = s.phase === "RESULTS";
      if (s.phase === "VOTE") { expect(o.marks[0]!.slot === null, `${p}`).toBe(!isMega); isMega ? seenMega++ : seenOther++; }
      if (revealed) { expect(o.marks[0]!.slot).not.toBeNull(); seenReveal++; }
    }, { sizes: [4], seeds: 3 });
    expect(seenMega).toBeGreaterThan(0); expect(seenOther).toBeGreaterThan(0); expect(seenReveal).toBeGreaterThan(0);
  });

  it("myCard: prima dello spoglio so cosa ho giocato, poi anche dove sta; gli altri proprietari restano nascosti", () => {
    let withPos = 0, noPos = 0;
    walk((s, p) => {
      const o = observe(s, p);
      if (s.phase === "PLAY" && s.played[p] !== undefined) { expect(o.myCard).toEqual({ cardId: s.played[p], position: null }); noPos++; }
      if ((s.phase === "SUSPECT" || s.phase === "VOTE") && s.tower.length) {
        const mine = s.tower.find((t) => t.ownerId === p)!; expect(o.myCard).toEqual({ cardId: mine.cardId, position: mine.position });
        for (const t of o.tower) expect(t.ownerId).toBeNull();
        withPos++;
      }
    }, { sizes: [4, 5], seeds: 3 });
    expect(withPos).toBeGreaterThan(50); expect(noPos).toBeGreaterThan(5);
  });

  it("la storia contiene solo turni conclusi e già pubblici", () => {
    walk((s, p) => {
      const o = observe(s, p);
      expect(o.history.length).toBe((s.history ?? []).length);
      if (s.phase === "VOTE") for (const h of o.history) expect(h.turn).toBeLessThan(s.turnNumber);
    }, { sizes: [4], seeds: 2 });
  });
});

describe("legalActions: calcolate solo dall'osservazione", () => {
  it("ogni azione scelta dai bot in produzione è tra quelle legali, e tutte le legali sono accettate dal motore", () => {
    let bots = 0, applied = 0;
    walk((s, p, a) => {
      const o = observe(s, p), legal = legalActions(o);
      if (a) { bots++; expect(isLegal(o, a), `${s.phase} ${p} ${JSON.stringify(a)}`).toBe(true); }
      else if (s.phase !== "MINI_RUN") expect(legal.length === 0 || ["PLAY"].includes(s.phase) === false, `${s.phase} ${p}`).toBe(true);
      for (const x of legal.slice(0, 6)) { expect(() => applyAction(s, x), `${s.phase} ${p} ${JSON.stringify(x)}`).not.toThrow(); applied++; }
    }, { sizes: [3, 5], seeds: 3 });
    expect(bots).toBeGreaterThan(200); expect(applied).toBeGreaterThan(500);
  });

  it("il Megafono non può votare la carta con VOTI NULLI! e chi non deve agire non ha azioni", () => {
    let checked = 0;
    walk((s, p) => {
      const o = observe(s, p);
      if (s.phase === "VOTE" && o.myForbidden !== null) { checked++; expect(legalActions(o).some((x) => x.type === "vote" && x.position === o.myForbidden)).toBe(false); }
      if (s.phase === "SUSPECT" && p !== megafonoOf(s)) expect(legalActions(o)).toEqual([]);
      if (s.phase === "PROCLAIM" && p !== megafonoOf(s)) expect(legalActions(o)).toEqual([]);
      if (s.phase === "VOTE" && s.votes[p] !== undefined) expect(legalActions(o)).toEqual([]);
    }, { sizes: [4, 6], seeds: 6 });
    expect(checked).toBeGreaterThan(0);
  });
});
