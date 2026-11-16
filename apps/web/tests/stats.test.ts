import { describe, expect, it } from "vitest";
import type { PlayerView, TurnResult, MiniResult } from "@gdt/game-engine";
import { emptyDb, observe, summary, MAX_GAMES } from "../src/lib/stats.ts";

const players = (scores: number[]) => scores.map((s, i) => ({ id: `p${i + 1}`, name: `P${i + 1}`, score: s, megafonoTurns: 0, handCount: 5, hasPlayed: true, hasVoted: true }));
const res = (o: Partial<TurnResult>): TurnResult => ({ turn: 1, megafonoId: "p1", votes: { p2: 3, p3: 1 }, counts: { 3: 1, 1: 1 }, tie: false, fallenPosition: 3, fallenCardId: "c", fallenPositions: [3], fallenCardIds: ["c"], fallenOwnerIds: ["p3"], fallenOwnerId: "p3", points: { p1: 0, p2: 2, p3: 0 }, lines: {}, collected: 0, megaVote: 3, tieBreak: false, marks: [], ...o } as TurnResult);
const view = (o: Partial<PlayerView> & { viewerId: string }): PlayerView => ({ phase: "RESULTS", turn: 1, totalTurns: 3, megafonoId: "p1", marks: [], myForbidden: null, players: players([0, 2, 0]), myHand: [], proclaimCard: null, phrase: null, tower: [], luiTokens: [], myVote: null, votes: null, lastResult: null, mini: null, miniResult: null, winners: null, award: null, goldenGoal: false, round: 1, rounds: 1, roundEnd: false, drawPileCount: 0, discardCount: 0, ...o } as PlayerView);

describe("statistiche personali (nel dispositivo)", () => {
  it("un turno si conta una volta sola, anche se la vista arriva più volte (ricarica, riconnessione)", () => {
    const db = emptyDb(1), v = view({ viewerId: "p2", lastResult: res({}) });
    expect(observe(db, "ABCDE", v, false, 10)).toBe(true); expect(observe(db, "ABCDE", v, false, 11)).toBe(false);
    expect(db.totals.turns).toBe(1); expect(db.totals.votes).toBe(1); expect(db.totals.voteHits).toBe(1);   // p2 ha votato la carta 3, che è caduta
  });
  it("Folla: voto azzeccato / sbagliato, carta tua caduta, voti annullati", () => {
    const db = emptyDb(1);
    observe(db, "ABCDE", view({ viewerId: "p3", lastResult: res({ marks: [{ slot: "a", effect: "nulli", position: 1, hit: true, voters: [], caught: ["p3"] }] }) }), false, 10);
    expect(db.totals.votes).toBe(1); expect(db.totals.voteHits).toBe(0); expect(db.totals.cardFell).toBe(1); expect(db.totals.caught).toBe(1);
  });
  it("Megafono: turni e segnalini usati con esito, il suo voto non conta come voto da Folla", () => {
    const db = emptyDb(1);
    observe(db, "ABCDE", view({ viewerId: "p1", lastResult: res({ marks: [{ slot: "a", effect: "cade", position: 3, hit: true, voters: ["p2"] }] }) }), false, 10);
    observe(db, "ABCDE", view({ viewerId: "p1", turn: 2, lastResult: res({ turn: 2, marks: [{ slot: "b", effect: "noncade", position: 1, hit: false, voters: [] }] }) }), false, 11);
    expect(db.totals).toMatchObject({ megaTurns: 2, cade: 1, cadeHit: 1, noncade: 1, noncadeHit: 0, votes: 0 });
  });
  it("intervallo: voto giusto e più veloce", () => {
    const db = emptyDb(1), mr = { kind: "accusa", votes: { p2: 2 }, lines: { p2: [{ kind: "mini-giusto", pts: 2, pos: 2 }, { kind: "mini-veloce", pts: 4, pos: 2 }] }, fastest: "p2" } as unknown as MiniResult;
    observe(db, "ABCDE", view({ viewerId: "p2", phase: "MINI_RESULTS", miniResult: mr }), false, 10); observe(db, "ABCDE", view({ viewerId: "p2", phase: "RESULTS", miniResult: mr }), false, 11);
    expect(db.totals).toMatchObject({ minis: 1, miniVotes: 1, miniHits: 1, miniFast: 1 });
  });
  it("fine partita: posizione, vittoria, punti; storico limitato; rivincita nella stessa stanza = partita nuova", () => {
    const db = emptyDb(1), end = (t: number, scores: number[], winners: string[]) => observe(db, "ABCDE", view({ viewerId: "p2", phase: "GAME_OVER", turn: t, players: players(scores), winners, lastResult: null }), true, 100 + t);
    expect(end(3, [4, 9, 1], ["p2"])).toBe(true); expect(end(3, [4, 9, 1], ["p2"])).toBe(false);
    expect(db.totals).toMatchObject({ games: 1, wins: 1, podiums: 1, points: 9, best: 9 }); expect(db.games[0]).toMatchObject({ rank: 1, won: true, players: 3, bots: true });
    observe(db, "ABCDE", view({ viewerId: "p2", phase: "PROCLAIM", turn: 1 }), false, 200);   // rivincita: turni da capo
    for (let i = 0; i < MAX_GAMES + 5; i++) { observe(db, "ABCDE", view({ viewerId: "p2", phase: "PROCLAIM", turn: 1 }), false, 300 + i); end(3, [1, 2, 3], ["p3"]); }
    expect(db.totals.games).toBeGreaterThan(MAX_GAMES); expect(db.games.length).toBe(MAX_GAMES);   // i totali restano, lo storico è limitato
    expect(db.totals.wins).toBe(1);
  });
  it("chi guarda soltanto (non è tra i giocatori) non registra nulla; riepilogo con percentuali", () => {
    const db = emptyDb(1); expect(observe(db, "ABCDE", view({ viewerId: "tv", lastResult: res({}) }), false, 10)).toBe(false);
    observe(db, "ABCDE", view({ viewerId: "p2", lastResult: res({}) }), false, 10); const s = summary(db);
    expect(s.voteRate).toBe(100); expect(s.winRate).toBeNull(); expect(s.avg).toBeNull();
  });
  it("luoghi comuni: voti dati, voti per luogo comune e quota per caso si accumulano turno per turno (anche il Megafono)", () => {
    const db = emptyDb(1), st = (turn: number, voti: Record<string, boolean>) => res({ turn, stereo: { voti, caso: 0.25, cause: {} } });
    observe(db, "ABCDE", view({ viewerId: "p2", lastResult: st(1, { p1: false, p2: true, p3: false }) }), false, 10);
    observe(db, "ABCDE", view({ viewerId: "p2", turn: 2, lastResult: st(2, { p1: true, p2: false }) }), false, 11);
    observe(db, "ABCDE", view({ viewerId: "p2", turn: 2, lastResult: st(2, { p1: true, p2: false }) }), false, 12);   // ricarica: non si conta due volte
    const s = summary(db); expect(db.totals).toMatchObject({ stereoN: 2, stereoS: 1, stereoC: 0.5 }); expect(s.stereoRate).toBe(50); expect(s.stereoCaso).toBe(25);
    const db2 = emptyDb(1); observe(db2, "ABCDE", view({ viewerId: "p2", lastResult: res({}) }), false, 10); expect(db2.totals.stereoN).toBe(0);   // frase senza dati: niente
  });
});
