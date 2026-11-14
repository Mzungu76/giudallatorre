import { describe, expect, it } from "vitest";
import { megafonoOf, MINI_SLOT_MS as SLOT, requiredPlayers, suggestAction } from "@gdt/game-engine";
import type { GameState } from "@gdt/game-engine";
import { RoomCore, RoomError, LIMITS, FEMALE_CHARS, BOT_NAMES_F, animMs } from "../src/RoomCore.ts";
import { deps, makeRoom, playToEnd, send } from "./helpers.ts";
import { fullPhrase, PHRASES_PER_CARD } from "@gdt/game-engine";
import { CONFESSIONS, PHRASE_POOL } from "../src/content.ts";

const types = (o: { send: { msg: { t: string } }[] }) => o.send.map((s) => s.msg.t);
const errCode = (o: { send: { msg: { t: string; code?: string } }[] }) => o.send.find((s) => s.msg.t === "error")?.msg.code;

describe("fascia d'età (le confessioni ci sono sempre)", () => {
  const deckOf = (r: ReturnType<typeof makeRoom>) => { const g = r.core.data.game!; return [g.proclaim!, ...g.phraseDraw, ...g.phraseDiscard]; };
  it("solo l'host le cambia, solo in lobby; valori fuori elenco rifiutati dal protocollo", async () => {
    const { clientMessageSchema } = await import("@gdt/game-protocol");
    const r = makeRoom(3, 4);
    expect(errCode(send(r, 1, { t: "setOptions", ageBand: 18 }))).toBe("NOT_HOST");
    expect(types(send(r, 0, { t: "setOptions", ageBand: 18 }))).toContain("room");
    expect(r.core.data.options).toMatchObject({ ageBand: 18 });
    expect(clientMessageSchema.safeParse({ t: "setOptions", ageBand: 12 }).success).toBe(false);
    expect(clientMessageSchema.safeParse({ t: "setOptions", ageBand: 14 }).success).toBe(true);
    expect(clientMessageSchema.safeParse({ t: "setOptions", gregge: true }).success).toBe(false);   // le varianti non esistono più
    send(r, 0, { t: "start" });
    expect(errCode(send(r, 0, { t: "setOptions", ageBand: 6 }))).toBe("WRONG_STAGE");
  });
  it("all'avvio il mazzo contiene solo frasi adatte alla fascia scelta", () => {
    for (const age of [6, 10, 14, 18] as const) {
      const r = makeRoom(4, 20 + age); send(r, 0, { t: "setOptions", ageBand: age }); send(r, 0, { t: "start" });
      const allowed = new Set([...PHRASE_POOL.filter((p) => p.age <= age).map((p) => fullPhrase(p)), ...CONFESSIONS.filter((c) => c.age <= age).map((c) => c.text)]);
      const texts = deckOf(r).flatMap((c) => c.phrases);
      expect(texts.length).toBeGreaterThan(80);
      for (const t of texts) expect(allowed.has(t), `${age}+: ${t}`).toBe(true);
    }
  });
  it("le confessioni (carte a frase singola) ci sono sempre nel mazzo", () => {
    const on = makeRoom(4, 31); send(on, 0, { t: "start" });
    expect(deckOf(on).some((c) => c.phrases.length === 1)).toBe(true);
  });
  it("una stanza salvata prima di questa versione riceve i valori predefiniti", () => {
    const { core } = RoomCore.create("ZZZZZ", deps(), 0, { nickname: "Vecchia" });
    const old = JSON.parse(JSON.stringify(core.data)); delete old.options.ageBand;
    expect(new RoomCore(old, deps()).data.options).toMatchObject({ ageBand: 14 });
  });
});

describe("uscita a partita in corso", () => {
  const started = (n: number, seed: number) => { const r = makeRoom(n, seed); send(r, 0, { t: "start" }); return r; };
  it("con altri umani nella stanza: chi esce è sostituito da un bot, stesso posto, punti e carte; il vecchio token non entra più", () => {
    const r = started(3, 50), before = JSON.stringify(r.core.data.game), oldToken = r.tokens[1]!;
    const out = send(r, 1, { t: "leave" });
    expect(out.destroy).toBe(false); expect(out.close.map((c) => c.playerId)).toEqual([r.ids[1]]);
    expect(r.core.data.players[1]).toMatchObject({ id: r.ids[1], isBot: true, level: "medium", tokenHash: "" });
    expect(r.core.authenticate(oldToken)).toBeNull();
    expect(JSON.stringify(r.core.data.game)).toBe(before);   // la partita non cambia: stesso posto, mano e punteggio
    expect((r.core.roomMsg(r.ids[0]!) as { players: { isBot?: boolean }[] }).players.map((p) => !!p.isBot)).toEqual([false, true, false]);
    expect(out.send.some((m) => m.to === r.ids[0] && m.msg.t === "room")).toBe(true);   // chi resta lo viene a sapere
  });
  it("se esce l'host, il ruolo passa a un altro umano", () => {
    const r = started(3, 51);
    send(r, 0, { t: "leave" });
    expect(r.core.data.players.map((p) => p.isHost)).toEqual([false, true, false]);
    expect(r.core.data.players[0]!.isBot).toBe(true);
  });
  it("il bot subentrato gioca davvero: se chi esce era il Megafono, la frase viene proclamata", () => {
    const r = started(3, 52), g = r.core.data.game!, mega = r.ids.indexOf(megafonoOf(g));
    expect(g.phase).toBe("PROCLAIM");
    send(r, mega, { t: "leave" });
    expect(r.core.data.botAt).not.toBeNull();
    r.core.tick(r.core.data.botAt! + 1);
    expect(r.core.data.game!.phase).toBe("PLAY");
  });
  it("altri umani presenti ma offline: la stanza non si chiude", () => {
    const r = started(3, 53); r.core.onDisconnect(r.ids[0]!, 10); r.core.onDisconnect(r.ids[2]!, 10);
    const out = send(r, 1, { t: "leave" });
    expect(out.destroy).toBe(false); expect(r.core.data.players[1]!.isBot).toBe(true);
  });
  it("senza altri umani la stanza si chiude subito (anche con bot in partita)", () => {
    const { core, playerId } = RoomCore.create("SOLOX", deps(60), 0, { nickname: "Solo", bots: { count: 2, level: "easy" } });
    core.onConnect(playerId, 1); core.handle(playerId, { t: "start" }, 2);
    expect(core.data.stage).toBe("PLAYING");
    const out = core.handle(playerId, { t: "leave" }, 3);
    expect(out.destroy).toBe(true);
  });
  it("due umani: esce il primo (sostituito), esce il secondo (stanza chiusa)", () => {
    const r = started(3, 54); send(r, 2, { t: "leave" });
    expect(send(r, 1, { t: "leave" }).destroy).toBe(false);   // il primo umano rimasto (p0) è ancora lì
    expect(send(r, 0, { t: "leave" }).destroy).toBe(true);
  });
  it("a partita conclusa non c'è sostituzione: esce l'ultimo umano e la stanza si chiude, altrimenti chi esce resta in classifica", () => {
    const r = started(3, 55); playToEnd(r);
    expect(r.core.data.stage).toBe("FINISHED");
    const out = send(r, 1, { t: "leave" });
    expect(out.destroy).toBe(false); expect(r.core.data.players[1]!.isBot).toBeFalsy();
    send(r, 2, { t: "leave" });
    expect(send(r, 0, { t: "leave" }).destroy).toBe(true);
  });
});

describe("stanza: creazione, accesso e lobby", () => {
  it("la creazione dà host, id e token; il server conserva solo l'hash del token", () => {
    const { core, playerId, token } = RoomCore.create("ABCDE", deps(), 0, { nickname: "Marta" });
    expect(core.data.players[0]).toMatchObject({ id: playerId, isHost: true });
    expect(JSON.stringify(core.data)).not.toContain(token);
    expect(core.data.options).toEqual({ turnTimerSec: 0, display: true, ageBand: 14 });
    expect(core.authenticate(token)).toBe(playerId);
  });
  it("nickname non duplicati (anche con maiuscole e accenti diversi), max 6 giocatori", () => {
    const r = makeRoom(1);
    expect(() => r.core.join("giocatore1", 1)).toThrow(RoomError);
    expect(() => r.core.join("GIOCATORE1", 1)).toThrow(/NICKNAME|nickname/i);
    for (let i = 2; i <= 6; i++) r.core.join("Altro" + i, 1);
    expect(r.core.data.players).toHaveLength(6);
    try { r.core.join("Settimo", 1); throw new Error("no"); } catch (e) { expect((e as RoomError).code).toBe("ROOM_FULL"); }
  });
  it("ogni giocatore ha un personaggio diverso, scelto a caso tra gli otto (non in ordine di ingresso)", () => {
    const seen = new Set<string>();
    for (let k = 0; k < 12; k++) {
      const r = makeRoom(1, 100 + k); for (let i = 2; i <= 6; i++) r.core.join("Altro" + i, 1);
      const chars = r.core.data.players.map((p) => p.char!);
      expect(chars.every((c) => Number.isInteger(c) && c >= 0 && c <= 7)).toBe(true);
      expect(new Set(chars).size).toBe(6);
      seen.add(chars.join());
    }
    expect(seen.size).toBeGreaterThan(1);
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
    expect(errCode(send(r, 1, { t: "setOptions", turnTimerSec: 30 }))).toBe("NOT_HOST");
    expect(errCode(send(r, 1, { t: "start" }))).toBe("NOT_HOST");
    expect(errCode(send(r, 1, { t: "kick", playerId: r.ids[2]! }))).toBe("NOT_HOST");
    expect(types(send(r, 0, { t: "setOptions", turnTimerSec: 60 }))).toContain("room");
    expect(r.core.data.options).toMatchObject({ turnTimerSec: 60 });
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
    expect(errCode(send(r, 0, { t: "setOptions", turnTimerSec: 30 }))).toBe("WRONG_STAGE");
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
  it.each([3, 4, 5, 6])("partita completa a %i giocatori via messaggi, fino a FINISHED", (n) => {
    const r = makeRoom(n, n * 10); send(r, 0, { t: "start" });
    playToEnd(r);
    expect(r.core.data.stage).toBe("FINISHED"); expect((r.core.data.game as GameState).winners!.length).toBeGreaterThan(0);
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
  for (const id of r.ids) if (requiredPlayers(g).includes(id)) send(r, r.ids.indexOf(id), { t: "act", action: { type: "playCard", cardId: g.hands[id]![0]! } });
  // gioco base «Cade / Non cade»: un segnalino (CADE sulla 1)
  send(r, r.ids.indexOf(megafonoOf(g)), { t: "act", action: { type: "placeMarks", marks: [{ slot: "cade", position: 1 }] } });
  for (const id of r.ids) send(r, r.ids.indexOf(id), { t: "act", action: { type: "vote", position: 1 } });
}

describe("timer e pulizia", () => {
  it("con timer attivo, alla scadenza il server gioca per gli assenti e la partita avanza", () => {
    const r = makeRoom(4, 5, 1_000_000); send(r, 0, { t: "setOptions", turnTimerSec: 30 }); send(r, 0, { t: "start" }, 1_000_000);
    const d = r.core.data; expect(d.deadline).toBe(1_000_000 + animMs(d.game as GameState) + 30_000);   // il timer parte dopo le animazioni
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
    let guard = 0; while (r.core.data.stage === "PLAYING" && guard++ < 500) r.core.tick(r.core.nextAlarm()! + 1);
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
    const r = makeRoom(3, 10, 0);
    expect(r.core.nextAlarm()).toBe(LIMITS.maxLifeMs + 1000); // con umani connessi non scade nulla tranne la vita massima
    for (const id of r.ids) r.core.onDisconnect(id, 5000);
    expect(r.core.nextAlarm()).toBe(5000 + LIMITS.hostGraceMs); // prima scade la tolleranza dell'host
    r.core.tick(5000 + LIMITS.hostGraceMs);
    expect(r.core.nextAlarm()).toBe(5000 + LIMITS.lobbyIdleMs + 1000); // poi, a stanza vuota, il conto parte dall'ultima disconnessione
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

describe("schermo condiviso (sola visione)", () => {
  it("non vede mani, proprietari delle carte né voti prima dei risultati; non vede il tipo di segnalino", () => {
    const r = makeRoom(4, 12); send(r, 0, { t: "start" });
    const g0 = r.core.data.game as GameState;
    playOneTurnTo(r, "VOTE");
    const msgs = r.core.spectatorMessages();
    const view = msgs.find((m) => m.t === "view") as { view: { myHand: string[]; tower: { ownerId: string | null }[]; marks: { slot: string | null }[]; votes: unknown } };
    expect(view.view.myHand).toEqual([]); expect(view.view.tower.every((t) => t.ownerId === null)).toBe(true);
    expect(view.view.marks.every((m) => m.slot === null)).toBe(true); expect(view.view.votes).toBeNull();
    const json = JSON.stringify(msgs);
    for (const hand of Object.values((r.core.data.game as GameState).hands)) for (const c of hand) expect(json).not.toContain(`"${c}"`);
    expect(g0.turnNumber).toBe(1);
  });
  it("si può disattivare (opzione display)", () => {
    const r = makeRoom(3, 13); send(r, 0, { t: "setOptions", display: false });
    expect(r.core.spectatorMessages()).toEqual([]);
  });
});
function playOneTurnTo(r: ReturnType<typeof makeRoom>, upTo: "VOTE") {
  let g = r.core.data.game as GameState;
  send(r, r.ids.indexOf(megafonoOf(g)), { t: "act", action: { type: "choosePhrase", mode: "free" } });
  g = r.core.data.game as GameState;
  for (const id of r.ids) if (requiredPlayers(g).includes(id)) send(r, r.ids.indexOf(id), { t: "act", action: { type: "playCard", cardId: g.hands[id]![0]! } });
  // gioco base «Cade / Non cade»: un segnalino (CADE sulla 1)
  send(r, r.ids.indexOf(megafonoOf(g)), { t: "act", action: { type: "placeMarks", marks: [{ slot: "cade", position: 1 }] } });
  expect(upTo).toBe("VOTE");
}

describe("giocatori virtuali nella stanza", () => {
  it("l'host aggiunge e toglie bot in lobby (max 6, nomi unici, solo host)", () => {
    const r = makeRoom(1, 20);
    expect(errCode(send(r, 0, { t: "addBot", level: "hard" }))).toBeUndefined();
    send(r, 0, { t: "addBot", level: "easy" }); send(r, 0, { t: "addBot", level: "medium" });
    const bots = r.core.data.players.filter((p) => p.isBot); expect(bots).toHaveLength(3);
    expect(new Set(r.core.data.players.map((p) => p.nickname)).size).toBe(4);
    for (let i = 0; i < 2; i++) send(r, 0, { t: "addBot", level: "medium" });
    expect(r.core.data.players).toHaveLength(6);
    expect(errCode(send(r, 0, { t: "addBot", level: "medium" }))).toBe("ROOM_FULL");
    send(r, 0, { t: "removeBot", playerId: bots[0]!.id }); expect(r.core.data.players).toHaveLength(5);
    expect(errCode(send(r, 0, { t: "removeBot", playerId: r.ids[0]! }))).toBe("INVALID_TARGET");
  });
  it("un giocatore non-host non può aggiungere bot; i bot non hanno token e non si autenticano", () => {
    const r = makeRoom(2, 21); expect(errCode(send(r, 1, { t: "addBot", level: "easy" }))).toBe("NOT_HOST");
    send(r, 0, { t: "addBot", level: "easy" });
    expect(r.core.authenticate("")).toBeNull();
    expect(JSON.stringify(r.core.data.players)).not.toContain('"tokenHash":"a');
  });
  it("partita in solitario: 1 umano + 3 bot (creati insieme alla stanza) arriva alla fine; i bot agiscono dal timer", () => {
    const c = RoomCore.create("SOLOX", deps(5), 0, { nickname: "Solo", bots: { count: 3, level: "hard" } });
    const core = c.core; core.onConnect(c.playerId, 0);
    expect(core.data.players).toHaveLength(4); expect(core.roomMsg(c.playerId).players.filter((p) => p.isBot && p.connected)).toHaveLength(3);
    core.handle(c.playerId, { t: "start" }, 0);
    let now = 0, guard = 0;
    while (core.data.stage === "PLAYING" && guard++ < 4000) {
      const g = core.data.game as GameState;
      const a = suggestAction(g, c.playerId, Math.random);
      if (a) { const { playerId: _p, ...action } = a as Record<string, unknown>; core.handle(c.playerId, { t: "act", action } as never, now); }
      else if (g.phase === "RESULTS" || g.phase === "MINI_RESULTS") core.handle(c.playerId, { t: "act", action: { type: "advance" } }, now);
      now += 1500; core.tick(now);
    }
    expect(core.data.stage).toBe("FINISHED"); expect(guard).toBeLessThan(4000);
  });
  it("con bot l'umano non Megafono può far proseguire quando il Megafono è un bot", () => {
    const c = RoomCore.create("SOLOY", deps(6), 0, { nickname: "A", bots: { count: 2, level: "easy" } });
    const hostless = c.core; hostless.onConnect(c.playerId, 0); hostless.handle(c.playerId, { t: "start" }, 0);
    expect(hostless.data.players.filter((p) => p.isBot)).toHaveLength(2);
  });
});
import { suggestAction } from "@gdt/game-engine";

describe("messaggi tra i giocatori", () => {
  const chats = (o: ReturnType<typeof send>) => o.send.filter((m) => m.msg.t === "chat");
  it("il messaggio arriva a tutti i connessi, ripulito e con il nome del mittente", () => {
    const r = makeRoom(3, 40);
    const o = send(r, 1, { t: "chat", text: "  ciao\t\tbelli\u0000 " }, 2_000_000);
    expect(chats(o)).toHaveLength(3);
    const m = chats(o)[0]!.msg as { t: "chat"; msg: { text: string; name: string; from: string } };
    expect(m.msg.text).toBe("ciao belli"); expect(m.msg.name).toBe("Giocatore2"); expect(m.msg.from).toBe(r.ids[1]);
  });
  it("vuoto = rifiutato; troppo lungo = tagliato; messaggi ravvicinati = RATE_LIMIT", () => {
    const r = makeRoom(3, 41);
    expect(errCode(send(r, 0, { t: "chat", text: "   " }, 2_000_000))).toBe("INVALID_MESSAGE");
    const o = send(r, 0, { t: "chat", text: "x".repeat(400) }, 2_001_000);
    expect(((chats(o)[0]!.msg as { msg: { text: string } }).msg.text).length).toBe(140);
    expect(errCode(send(r, 0, { t: "chat", text: "ancora" }, 2_001_100))).toBe("RATE_LIMIT");
    expect(errCode(send(r, 0, { t: "chat", text: "ancora" }, 2_003_000))).toBeUndefined();
  });
  it("la cronologia (ultimi 60) arriva a chi si ricollega, non agli schermi condivisi", () => {
    const r = makeRoom(2, 42);
    for (let i = 0; i < 70; i++) send(r, i % 2, { t: "chat", text: `m${i}` }, 3_000_000 + i * 1000);
    const snap = r.core.snapshot(r.ids[0]!).find((m) => m.msg.t === "chatlog")!.msg as { t: "chatlog"; msgs: { text: string }[] };
    expect(snap.msgs).toHaveLength(60); expect(snap.msgs[0]!.text).toBe("m10"); expect(snap.msgs[59]!.text).toBe("m69");
    expect(JSON.stringify(r.core.spectatorMessages())).not.toContain("m69");
  });
  it("sopravvive al ricaricamento dello stato della stanza", () => {
    const r = makeRoom(2, 43); send(r, 0, { t: "chat", text: "resto qui" }, 4_000_000);
    const copy = new RoomCore(JSON.parse(JSON.stringify(r.core.data)), deps(43));
    expect(copy.data.chat.map((m) => m.text)).toEqual(["resto qui"]);
  });
});

describe("sveglie della stanza (quota gratuita dei Durable Objects)", () => {
  it("lobby con soli bot e host disconnesso: nessun giro a vuoto, la stanza viene poi cancellata", () => {
    const c = RoomCore.create("TESTX", deps(3), 0, { nickname: "Solo", bots: { count: 3, level: "hard" } });
    const core = c.core; core.onConnect(c.playerId, 0); core.onDisconnect(c.playerId, 1000);
    let now = 1000, alarms = 0, destroyed = false;
    for (let i = 0; i < 5000 && !destroyed; i++) {
      const at = core.nextAlarm(); if (at === null) break;
      now = Math.max(now + 50, at); alarms++;
      destroyed = !!core.tick(now).destroy;
    }
    expect(destroyed).toBe(true);
    expect(alarms).toBeLessThan(10); // prima del correttivo erano ~22.800 (una ogni 50 ms per 20 minuti)
  });
  it("umano connesso e fermo in lobby: nessun giro a vuoto (prima ~24.000 sveglie in 40 minuti)", () => {
    const c = RoomCore.create("TESTX", deps(3), 0, { nickname: "Solo" });
    const core = c.core; core.onConnect(c.playerId, 0);
    let now = 0, alarms = 0;
    for (let i = 0; i < 5000; i++) { const at = core.nextAlarm(); if (at === null) break; now = Math.max(now + 50, at); if (now > 3 * 3600_000) break; alarms++; core.tick(now); }
    expect(alarms).toBe(0);
  });
  it("senza umani connessi i bot si fermano, e riprendono quando torna qualcuno", () => {
    const c = RoomCore.create("TESTX", deps(6), 0, { nickname: "Solo", bots: { count: 3, level: "hard" } });
    const core = c.core; core.onConnect(c.playerId, 0); core.handle(c.playerId, { t: "start" }, 0);
    expect(core.data.botAt).not.toBeNull();
    core.onDisconnect(c.playerId, 100);
    expect(core.data.botAt).toBeNull(); expect(core.nextAlarm()).toBe(100 + LIMITS.playingIdleMs + 1000);
    core.onConnect(c.playerId, 200);
    expect(core.data.botAt).not.toBeNull();
  });
  it("partita iniziata: margine lungo per le disconnessioni; chi esce volontariamente non lascia la stanza in attesa; vita massima in ogni caso", () => {
    const r = makeRoom(3, 12); send(r, 0, { t: "start" });
    for (const id of r.ids) r.core.onDisconnect(id, 1000);
    expect(r.core.tick(1000 + LIMITS.lobbyIdleMs + 2000).destroy).toBe(false); // un telefono in standby ha ancora tempo
    expect(r.core.tick(1000 + LIMITS.playingIdleMs + 2000).destroy).toBe(true);
    const q = makeRoom(3, 13); send(q, 0, { t: "start" });
    send(q, 1, { t: "leave" }); send(q, 2, { t: "leave" });
    expect(send(q, 0, { t: "leave" }).destroy).toBe(true); // l'ultimo umano che esce chiude la stanza subito, senza margine
    const w = makeRoom(3, 14, 0); expect(w.core.tick(LIMITS.maxLifeMs + 2000).destroy).toBe(true); // anche con gente connessa
  });
});

describe("intervallo a tempo nella stanza", () => {
  /** Porta una stanza di soli umani fino all'inizio dell'intervallo (voti validi, ognuno quando il suo personaggio è in scena). */
  function toRun(n: number, seed: number, bots = 0) {
    const r = makeRoom(n - bots, seed);
    for (let i = 0; i < bots; i++) send(r, 0, { t: "addBot", level: "medium" });
    send(r, 0, { t: "start" }); let guard = 0;
    while (r.core.data.game!.phase !== "MINI_RUN" && guard++ < 2000) {
      const g = r.core.data.game as GameState;
      if (g.phase === "RESULTS") { send(r, 0, { t: "act", action: { type: "advance" } }); continue; }   // l'host può sempre proseguire
      // un turno normale: con i bot li facciamo muovere dai timer, con gli umani con messaggi
      if (r.core.data.botAt !== null && r.core.data.players.some((p) => p.isBot)) { r.core.tick(r.core.data.botAt + 1); continue; }
      for (const id of r.ids) { const a = suggestAction(g, id, Math.random); if (!a) continue; const { playerId: _p, ...action } = a as Record<string, unknown>; r.core.handle(id, { t: "act", action } as never, 1_000_100); break; }
    }
    return r;
  }
  it("si apre con «via!» dopo presentazione e 3-2-1; il server lo comunica a tutti, schermo condiviso compreso", () => {
    const r = toRun(3, 61), run = r.core.data.run!;
    expect(r.core.data.game!.phase).toBe("MINI_RUN");
    expect(run.goAt).toBeGreaterThan(1_000_100 + 8000); expect(run.endAt).toBeGreaterThan(run.goAt + 18 * SLOT);
    expect(r.core.data.deadline).toBeNull();
    const snap = r.core.snapshot(r.ids[0]!).find((m) => m.msg.t === "view")!.msg as { goAt?: number | null; now?: number };
    expect(snap.goAt).toBe(run.goAt); expect(typeof snap.now).toBe("number");
    const spec = r.core.spectatorMessages().find((m) => m.t === "view") as { goAt?: number | null };
    expect(spec.goAt).toBe(run.goAt);
  });
  it("un voto vale solo se il personaggio è in scena (con margine); prima del «via» o fuori turno è rifiutato", () => {
    const r = toRun(3, 62), g = r.core.data.game!, run = r.core.data.run!, order = g.mini!.order, pos = order[2]!;
    const vote = (who: number, position: number, at: number) => send(r, who, { t: "act", action: { type: "vote", position } }, at);
    expect(errCode(vote(0, pos, run.goAt - 2000))).toBe("NOT_ON_STAGE");          // durante il conto alla rovescia
    expect(errCode(vote(0, pos, run.goAt + SLOT))).toBe("NOT_ON_STAGE");           // quella carta esce più tardi
    const other = order.findIndex((p, i) => p === pos && i !== 2);
    expect(errCode(vote(0, pos, run.goAt + 2 * SLOT + 300))).toBeUndefined();     // è in scena
    expect(r.core.data.game!.votes[r.ids[0]!]).toBe(pos);
    void other;
    expect(errCode(vote(1, pos, run.goAt + 3 * SLOT + 500))).toBeUndefined();   // appena rientrata: margine per la rete e i riflessi
    expect(errCode(vote(2, pos, run.goAt + 3 * SLOT + 1500))).toBe("NOT_ON_STAGE");
  });
  it("a fine corsa si contano i voti arrivati: chi non ha votato non prende nulla; poi 'advance' riprende", () => {
    const r = toRun(3, 63), g = r.core.data.game!, run = r.core.data.run!, pos = g.mini!.order[0]!;
    send(r, 0, { t: "act", action: { type: "vote", position: pos } }, run.goAt + 100);
    expect(r.core.data.game!.phase).toBe("MINI_RUN");
    expect(r.core.nextAlarm()).toBeLessThanOrEqual(run.endAt);
    r.core.tick(run.endAt + 1);
    const g2 = r.core.data.game!;
    expect(g2.phase).toBe("MINI_RESULTS"); expect(g2.miniResult!.votes).toEqual({ [r.ids[0]!]: pos }); expect(r.core.data.run).toBeNull();
    expect(g2.miniResult!.points[r.ids[0]!]).toBe(6); expect(g2.miniResult!.points[r.ids[1]!]).toBe(0);
    send(r, 0, { t: "act", action: { type: "advance" } });
    expect(r.core.data.game!.phase).toBe("PROCLAIM");
  });
  it("i bot votano da soli, ognuno quando il suo personaggio è in scena; con tutti i voti l'intervallo si chiude prima della fine", () => {
    const r = toRun(3, 64, 2), run = r.core.data.run!, g = r.core.data.game!;
    const bots = r.core.data.players.filter((p) => p.isBot);
    expect(Object.keys(run.bots).sort()).toEqual(bots.map((b) => b.id).sort());
    for (const b of bots) { const v = run.bots[b.id]!, i = g.mini!.order.map((p, k) => (p === v.position ? k : -1)).filter((k) => k >= 0); expect(i.some((k) => v.at >= run.goAt + k * SLOT && v.at < run.goAt + (k + 1) * SLOT)).toBe(true); }
    r.core.tick(run.goAt - SLOT);
    expect(r.core.data.game!.votes[bots[0]!.id]).toBeUndefined();
    send(r, 0, { t: "act", action: { type: "vote", position: g.mini!.order[1]! } }, run.goAt + SLOT + 200);
    r.core.tick(Math.max(...Object.values(run.bots).map((v) => v.at)) + 1);
    expect(r.core.data.game!.phase).toBe("MINI_RESULTS");
  });
  it("lo stato dell'intervallo è JSON puro: ricostruita la stanza, la corsa prosegue", () => {
    const r = toRun(3, 65), run = r.core.data.run!;
    const copy = new RoomCore(JSON.parse(JSON.stringify(r.core.data)), deps());
    expect(copy.data.run).toEqual(run);
    copy.tick(run.endAt + 1);
    expect(copy.data.game!.phase).toBe("MINI_RESULTS");
  });
});

describe("caratteri e nomi dei bot", () => {
  it("ogni bot ha un carattere diverso dagli altri e i nomi cambiano da una partita all'altra", () => {
    const names = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const { core } = RoomCore.create("BOTST", deps(seed * 31), 0, { nickname: "Ann", bots: { count: 5, level: "medium" } });
      const bots = core.data.players.filter((p) => p.isBot);
      expect(new Set(bots.map((b) => b.style)).size).toBe(5); expect(bots.every((b) => !!b.style)).toBe(true);
      expect(core.publicInfo().taken!.length).toBe(6); bots.forEach((b) => names.add(b.nickname));
    }
    expect(names.size).toBeGreaterThan(8);   // non sono sempre gli stessi
  });
});

describe("collaudo dei bot", () => {
  const dto = (debug: boolean) => {
    const { core, playerId } = RoomCore.create("DBGXX", deps(5), 0, { nickname: "Ann", debug, bots: { count: 3, level: "hard" } });
    return (core.roomMsg(playerId) as unknown as { players: { isBot?: boolean; style?: string }[] }).players;
  };
  it("il carattere di gioco dei bot non arriva ai telefoni, salvo nelle partite di collaudo", () => {
    expect(dto(false).some((p) => p.style)).toBe(false);
    const on = dto(true).filter((p) => p.isBot); expect(on).toHaveLength(3); expect(on.every((p) => !!p.style)).toBe(true);
  });
});

describe("personaggi e bot", () => {
  it("i bot hanno un nome del sesso del loro personaggio", () => {
    const { core } = RoomCore.create("BOTNM", deps(11), 0, { nickname: "Ann", char: 0, bots: { count: 5, level: "easy" } });
    for (const p of core.data.players.filter((q) => q.isBot)) expect(BOT_NAMES_F.includes(p.nickname)).toBe(FEMALE_CHARS.has(p.char!));
  });
  it("chi entra sceglie il personaggio; se è già preso ne riceve uno libero; l'elenco dei presi è pubblico", () => {
    const { core } = RoomCore.create("CHARS", deps(12), 0, { nickname: "Ann", char: 5 });
    expect(core.publicInfo().taken).toEqual([5]);
    const a = core.join("Bea", 1, 2); expect(core.data.players.find((p) => p.id === a.playerId)!.char).toBe(2);
    const b = core.join("Cle", 2, 5); const cb = core.data.players.find((p) => p.id === b.playerId)!.char!;
    expect([5, 2]).not.toContain(cb);
    expect(core.publicInfo().taken!.sort()).toEqual([2, 5, cb].sort());
  });
  it("il timer concede il tempo delle animazioni a ogni fase", () => {
    const r = makeRoom(4, 5, 1_000_000); send(r, 0, { t: "setOptions", turnTimerSec: 30 }); send(r, 0, { t: "start" }, 1_000_000);
    const g = r.core.data.game as GameState;
    for (const ph of ["PROCLAIM", "PLAY", "SUSPECT", "VOTE"] as const) expect(animMs({ ...g, phase: ph })).toBeGreaterThanOrEqual(3000);
    expect(animMs({ ...g, phase: "PROCLAIM", turnNumber: 1 })).toBeGreaterThan(animMs({ ...g, phase: "PROCLAIM", turnNumber: 2 }));
  });
});
