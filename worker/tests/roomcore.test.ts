import { describe, expect, it } from "vitest";
import { megafonoOf } from "@gdt/game-engine";
import type { GameState } from "@gdt/game-engine";
import { RoomCore, RoomError, LIMITS } from "../src/RoomCore.ts";
import { deps, makeRoom, playToEnd, send } from "./helpers.ts";

const types = (o: { send: { msg: { t: string } }[] }) => o.send.map((s) => s.msg.t);
const errCode = (o: { send: { msg: { t: string; code?: string } }[] }) => o.send.find((s) => s.msg.t === "error")?.msg.code;

describe("stanza: creazione, accesso e lobby", () => {
  it("la creazione dà host, id e token; il server conserva solo l'hash del token", () => {
    const { core, playerId, token } = RoomCore.create("ABCDE", deps(), 0, { nickname: "Marta", mode: "remote", megafonoSa: true });
    expect(core.data.players[0]).toMatchObject({ id: playerId, isHost: true });
    expect(JSON.stringify(core.data)).not.toContain(token);
    expect(core.data.options).toEqual({ megafonoSa: true, mode: "remote", turnTimerSec: 0 });
    expect(core.authenticate(token)).toBe(playerId);
  });
  it("nickname non duplicati (anche con maiuscole e accenti diversi), max 8 giocatori", () => {
    const r = makeRoom(1);
    expect(() => r.core.join("giocatore1", 1)).toThrow(RoomError);
    expect(() => r.core.join("GIOCATORE1", 1)).toThrow(/NICKNAME|nickname/i);
    for (let i = 2; i <= 8; i++) r.core.join("Altro" + i, 1);
    expect(r.core.data.players).toHaveLength(8);
    try { r.core.join("Nono", 1); throw new Error("no"); } catch (e) { expect((e as RoomError).code).toBe("ROOM_FULL"); }
  });
  it("il codice stanza da solo non basta: token sbagliato, vuoto o di un'altra stanza → nessuna identità", () => {
    const a = makeRoom(3, 1), b = makeRoom(3, 2);
    expect(a.core.authenticate("A".repeat(22))).toBeNull();
    expect(a.core.authenticate(b.tokens[0]!)).toBeNull();
    expect(a.core.authenticate(a.tokens[1]!)).toBe(a.ids[1]);
  });
  it("messaggi di chi non è nella stanza sono respinti", () => {
    const r = makeRoom(3);
    expect(errCode(r.core.handle("0123456789abcdef", { t: "start" }, 1))).toBe("NOT_IN_ROOM");
  });
  it("solo l'host cambia le opzioni, avvia, espelle; solo in lobby", () => {
    const r = makeRoom(4);
    expect(errCode(send(r, 1, { t: "setOptions", megafonoSa: true }))).toBe("NOT_HOST");
    expect(errCode(send(r, 1, { t: "start" }))).toBe("NOT_HOST");
    expect(errCode(send(r, 1, { t: "kick", playerId: r.ids[2]! }))).toBe("NOT_HOST");
    expect(types(send(r, 0, { t: "setOptions", megafonoSa: true, turnTimerSec: 60 }))).toContain("room");
    expect(r.core.data.options).toMatchObject({ megafonoSa: true, turnTimerSec: 60 });
  });
  it("espulsione: il giocatore riceve 'kicked', viene chiuso e il suo token non vale più", () => {
    const r = makeRoom(4), out = send(r, 0, { t: "kick", playerId: r.ids[2]! });
    expect(out.send.some((s) => s.to === r.ids[2] && s.msg.t === "kicked")).toBe(true);
    expect(out.close).toEqual([{ playerId: r.ids[2], code: 4003, reason: "kicked" }]);
    expect(r.core.authenticate(r.tokens[2]!)).toBeNull();
    expect(r.core.data.players).toHaveLength(3);
    expect(errCode(send(r, 0, { t: "kick", playerId: r.ids[0]! }))).toBe("INVALID_TARGET");
  });
  it("servono almeno 3 giocatori per avviare", () => {
    const r = makeRoom(2);
    expect(errCode(send(r, 0, { t: "start" }))).toBe("NOT_ENOUGH_PLAYERS");
  });
  it("dopo l'avvio non si entra più e non si cambiano opzioni", () => {
    const r = makeRoom(4); send(r, 0, { t: "start" });
    expect(r.core.data.stage).toBe("PLAYING");
    expect(() => r.core.join("Tardivo", 5)).toThrow(/iniziata/);
    expect(errCode(send(r, 0, { t: "setOptions", megafonoSa: true }))).toBe("WRONG_STAGE");
    expect(errCode(send(r, 0, { t: "start" }))).toBe("WRONG_STAGE");
  });
  it("host disconnesso in lobby: ha 60 s di tolleranza (può rientrare), poi il ruolo passa al primo connesso; se esce volontariamente subito; stanza vuota = distrutta", () => {
    const r = makeRoom(3);
    r.core.onDisconnect(r.ids[0]!, 10);
    expect(r.core.data.players.find((p) => p.isHost)!.id).toBe(r.ids[0]);          // ancora host
    r.core.onConnect(r.ids[0]!, 20); r.core.tick(10 + 70_000);
    expect(r.core.data.players.find((p) => p.isHost)!.id).toBe(r.ids[0]);          // è rientrato in tempo
    r.core.onDisconnect(r.ids[0]!, 100_000); expect(r.core.nextAlarm()).toBeLessThanOrEqual(160_000);
    r.core.tick(100_000 + 60_000);
    expect(r.core.data.players.find((p) => p.isHost)!.id).toBe(r.ids[1]);          // tolleranza scaduta
    const r2 = makeRoom(2);
    send(r2, 0, { t: "leave" }); expect(r2.core.data.players).toHaveLength(1); expect(r2.core.data.players[0]!.isHost).toBe(true);
    expect(send(r2, 1, { t: "leave" }).destroy).toBe(true);
  });
});

describe("partita via messaggi", () => {
  it("ogni giocatore riceve la propria vista; nessun dato privato altrui nei messaggi", () => {
    const r = makeRoom(5), out = send(r, 0, { t: "start" });
    const g = r.core.data.game as GameState;
    for (let i = 0; i < 5; i++) {
      const mine = out.send.filter((s) => s.to === r.ids[i] && s.msg.t === "view");
      expect(mine).toHaveLength(1);
      const json = JSON.stringify(out.send.filter((s) => s.to === r.ids[i]));
      for (let j = 0; j < 5; j++) if (j !== i) for (const c of g.hands[r.ids[j]!]!) expect(json).not.toContain(`"${c}"`);
      expect(json).not.toContain("tokenHash"); expect(json).not.toContain('"drawPile"');
    }
  });
  it("l'identità arriva dal server: l'azione non può impersonare un altro giocatore", () => {
    const r = makeRoom(4); send(r, 0, { t: "start" });
    const g = r.core.data.game as GameState, mega = megafonoOf(g), other = r.ids.find((i) => i !== mega)!;
    const idx = r.ids.indexOf(other);
    // un non-Megafono prova a scegliere la frase: rifiutato (il campo playerId nemmeno esiste nello schema)
    expect(errCode(send(r, idx, { t: "act", reqId: "r1", action: { type: "choosePhrase", mode: "free" } }))).toBe("NOT_ALLOWED");
  });
  it("doppio voto, azione fuori fase e carte altrui sono errori non fatali con reqId", () => {
    const r = makeRoom(4); send(r, 0, { t: "start" });
    let g = r.core.data.game as GameState; const mega = r.ids.indexOf(megafonoOf(g));
    let out = send(r, mega, { t: "act", reqId: "a", action: { type: "vote", position: 1 } });
    expect(out.send[0]!.msg).toMatchObject({ t: "error", code: "WRONG_PHASE", reqId: "a" });
    send(r, mega, { t: "act", action: { type: "choosePhrase", mode: "free" } });
    g = r.core.data.game as GameState;
    const p = r.ids.findIndex((i) => i !== megafonoOf(g)), q = r.ids.findIndex((i, k) => i !== megafonoOf(g) && k !== p);
    out = send(r, p, { t: "act", action: { type: "playCard", cardId: g.hands[r.ids[q]!]![0]! } });
    expect(errCode(out)).toBe("CARD_NOT_IN_HAND");
    send(r, p, { t: "act", action: { type: "playCard", cardId: g.hands[r.ids[p]!]![0]! } });
    out = send(r, p, { t: "act", action: { type: "playCard", cardId: g.hands[r.ids[p]!]![1]! } });
    expect(errCode(out)).toBe("ALREADY_DONE");
  });
  it("'advance' solo da Megafono o host", () => {
    const r = makeRoom(4); send(r, 0, { t: "start" });
    // porto la partita a RESULTS con giocatori virtuali per un turno
    const g0 = r.core.data.game as GameState;
    playOneTurn(r);
    const g = r.core.data.game as GameState; expect(g.phase).toBe("RESULTS");
    const outsider = r.ids.findIndex((i) => i !== megafonoOf(g) && i !== r.ids[0]);
    expect(errCode(send(r, outsider, { t: "act", action: { type: "advance" } }))).toBe("NOT_ALLOWED");
    expect(errCode(send(r, r.ids.indexOf(megafonoOf(g)), { t: "act", action: { type: "advance" } }))).toBeUndefined();
    expect(g0.turnNumber).toBe(1);
  });
  it.each([3, 4, 5, 6, 7, 8])("partita completa a %i giocatori via messaggi, entrambe le varianti, fino a FINISHED", (n) => {
    for (const sa of [false, true]) {
      const r = makeRoom(n, n * 10 + (sa ? 1 : 0)); send(r, 0, { t: "setOptions", megafonoSa: sa }); send(r, 0, { t: "start" });
      playToEnd(r);
      expect(r.core.data.stage).toBe("FINISHED"); expect((r.core.data.game as GameState).winners!.length).toBeGreaterThan(0);
    }
  });
  it("riconnessione: lo snapshot restituisce stanza e vista aggiornata, senza perdere lo stato", () => {
    const r = makeRoom(4); send(r, 0, { t: "start" });
    const mega = r.ids.indexOf(megafonoOf(r.core.data.game as GameState));
    send(r, mega, { t: "act", action: { type: "choosePhrase", mode: "free" } });
    r.core.onDisconnect(r.ids[2]!, 50);
    expect(r.core.roomMsg(r.ids[0]!)).toMatchObject({ players: expect.arrayContaining([expect.objectContaining({ id: r.ids[2], connected: false })]) });
    const out = r.core.onConnect(r.ids[2]!, 60);
    const view = out.send.find((s) => s.to === r.ids[2] && s.msg.t === "view")!.msg as { t: "view"; view: { phase: string; myHand: string[] } };
    expect(view.view.phase).toBe("PLAY"); expect(view.view.myHand).toHaveLength(5);
  });
  it("la partita prosegue anche se l'host si disconnette", () => {
    const r = makeRoom(4); send(r, 0, { t: "start" });
    r.core.onDisconnect(r.ids[0]!, 10);
    const g = r.core.data.game as GameState, mega = r.ids.indexOf(megafonoOf(g));
    const m = mega === 0 ? 1 : mega;
    // se l'host era il Megafono, la fase si sblocca con il timer (vedi test dedicato); altrimenti si procede normalmente
    if (mega !== 0) expect(errCode(send(r, m, { t: "act", action: { type: "choosePhrase", mode: "free" } }))).toBeUndefined();
    expect(r.core.data.stage).toBe("PLAYING");
  });
});

function playOneTurn(r: ReturnType<typeof makeRoom>) {
  // un turno completo con scelte fisse
  let g = r.core.data.game as GameState;
  send(r, r.ids.indexOf(megafonoOf(g)), { t: "act", action: { type: "choosePhrase", mode: "free" } });
  g = r.core.data.game as GameState;
  for (const id of r.ids) if (id !== megafonoOf(g)) send(r, r.ids.indexOf(id), { t: "act", action: { type: "playCard", cardId: g.hands[id]![0]! } });
  send(r, r.ids.indexOf(megafonoOf(g)), { t: "act", action: { type: "placeLui", kind: "CADE", position: 1 } });
  for (const id of r.ids) send(r, r.ids.indexOf(id), { t: "act", action: { type: "vote", position: 1 } });
}

describe("timer e pulizia", () => {
  it("con timer attivo, alla scadenza il server gioca per gli assenti e la partita avanza", () => {
    const r = makeRoom(4, 5, 1_000_000); send(r, 0, { t: "setOptions", turnTimerSec: 30 }); send(r, 0, { t: "start" }, 1_000_000);
    const d = r.core.data; expect(d.deadline).toBe(1_030_000 + 0 || d.deadline);
    const before = (d.game as GameState).phase;
    const out = r.core.tick(d.deadline! + 1);
    expect((d.game as GameState).phase).not.toBe(before);
    expect(out.send.some((s) => s.msg.t === "view")).toBe(true);
  });
  it("senza timer le fasi non scadono, ma i risultati avanzano da soli dopo 15 s", () => {
    const r = makeRoom(4, 6); send(r, 0, { t: "start" }); expect(r.core.data.deadline).toBeNull();
    playOneTurn(r);
    const d = r.core.data; expect((d.game as GameState).phase).toBe("RESULTS"); expect(d.deadline).not.toBeNull();
    r.core.tick(d.deadline! + 1);
    expect((d.game as GameState).turnNumber).toBe(2);
  });
  it("una partita lasciata sola dai timer arriva comunque a FINISHED", () => {
    const r = makeRoom(3, 7); send(r, 0, { t: "setOptions", turnTimerSec: 30 }); send(r, 0, { t: "start" });
    let guard = 0; while (r.core.data.stage === "PLAYING" && guard++ < 500) r.core.tick(r.core.data.deadline! + 1);
    expect(r.core.data.stage).toBe("FINISHED");
  });
  it("stanze abbandonate o concluse vengono distrutte (nessun dato personale oltre il necessario)", () => {
    const r = makeRoom(3, 8, 0);
    for (const id of r.ids) r.core.onDisconnect(id, 10);
    expect(r.core.tick(LIMITS.lobbyIdleMs - 1000).destroy).toBe(false);
    expect(r.core.tick(LIMITS.lobbyIdleMs + 20).destroy).toBe(true);
    const f = makeRoom(3, 9, 0); send(f, 0, { t: "start" }, 0); playToEnd(f, 0);
    expect(f.core.data.finishedAt).not.toBeNull();
    expect(f.core.tick(f.core.data.finishedAt! + LIMITS.finishedMs + 10).destroy).toBe(true);
  });
  it("la scadenza successiva è sempre pianificata (allarme)", () => {
    const r = makeRoom(3, 10, 0); expect(r.core.nextAlarm()).toBe(LIMITS.lobbyIdleMs + 1000);
  });
});

describe("persistenza", () => {
  it("lo stato della stanza è JSON puro: serializza, ricostruisce e continua la partita", () => {
    const r = makeRoom(4, 11); send(r, 0, { t: "start" });
    const clone = new RoomCore(JSON.parse(JSON.stringify(r.core.data)), deps(11));
    for (const id of r.ids) clone.onConnect(id, 5);
    const r2 = { ...r, core: clone };
    playToEnd(r2);
    expect(clone.data.stage).toBe("FINISHED");
  });
});
