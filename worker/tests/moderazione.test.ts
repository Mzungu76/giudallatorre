import { describe, expect, it } from "vitest";
import { megafonoOf } from "@gdt/game-engine";
import { makeRoom, send } from "./helpers.ts";

const errCode = (o: { send: { msg: { t: string; code?: string } }[] }) => o.send.find((s) => s.msg.t === "error")?.msg.code;

describe("moderazione delle frasi libere del Megafono (per fascia d'età della stanza)", () => {
  const prova = (age: 6 | 10 | 14 | 18, text: string) => {
    const r = makeRoom(3, 300 + age); send(r, 0, { t: "setOptions", ageBand: age }); send(r, 0, { t: "start" });
    const mega = r.ids.indexOf(megafonoOf(r.core.data.game!));
    return send(r, mega, { t: "act", action: { type: "choosePhrase", mode: "free", text } });
  };
  it("una frase pulita passa a ogni età", () => { for (const a of [6, 18] as const) expect(errCode(prova(a, "chi riderebbe alla propria battuta."))).toBeUndefined(); });
  it("una frase per un pubblico più grande è rifiutata con PHRASE_AGE, ammessa quando l'età basta", () => {
    expect(errCode(prova(10, "chi si ubriacherebbe al matrimonio."))).toBe("PHRASE_AGE");
    expect(errCode(prova(14, "chi si ubriacherebbe al matrimonio."))).toBeUndefined();
    expect(errCode(prova(14, "chi direbbe che cazzo in pubblico."))).toBe("PHRASE_AGE");
    expect(errCode(prova(18, "chi direbbe che cazzo in pubblico."))).toBeUndefined();
  });
  it("una frase vietata è rifiutata a ogni età con PHRASE_BLOCKED", () => {
    for (const a of [6, 18] as const) expect(errCode(prova(a, "chi scrive a mario@example.com e dice ti ammazzo"))).toBe("PHRASE_BLOCKED");
  });
});
