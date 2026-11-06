import { describe, expect, it } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import { KeyedLimiter, TokenBucket, constantTimeEqual, hashToken, newPlayerId, newToken, sha256Hex } from "../src/security.ts";
import { clientMessageSchema, createRoomBody, nicknameSchema, roomCodeSchema } from "@gdt/game-protocol";
import { seqRng } from "./helpers.ts";

describe("sicurezza di base", () => {
  it("sha256 sincrono coincide con node:crypto (incluse stringhe lunghe e unicode)", () => {
    const samples = ["", "abc", "Giù dalla Torre!", "x".repeat(55), "x".repeat(56), "x".repeat(64), "x".repeat(1000), "à€😀".repeat(40), randomBytes(200).toString("latin1")];
    for (const s of samples) expect(sha256Hex(s)).toBe(createHash("sha256").update(s, "utf8").digest("hex"));
  });
  it("token a 128 bit, id a 64 bit, hash non reversibile e stabile", () => {
    const t = newToken(seqRng(3)), id = newPlayerId(seqRng(3));
    expect(t).toMatch(/^[A-Za-z0-9_-]{22}$/); expect(id).toMatch(/^[0-9a-f]{16}$/);
    expect(hashToken(t)).toBe(hashToken(t)); expect(hashToken(t)).not.toContain(t); expect(hashToken(t)).toHaveLength(64);
    expect(new Set(Array.from({ length: 500 }, () => newToken((n) => randomBytes(n)))).size).toBe(500);
  });
  it("confronto a tempo costante", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true); expect(constantTimeEqual("abc", "abd")).toBe(false); expect(constantTimeEqual("abc", "abcd")).toBe(false);
  });
  it("secchio di token: raffica consentita, poi blocco, poi ricarica", () => {
    const b = new TokenBucket(5, 1, 0); let ok = 0;
    for (let i = 0; i < 10; i++) if (b.take(0)) ok++;
    expect(ok).toBe(5); expect(b.take(500)).toBe(false); expect(b.take(2000)).toBe(true);
  });
  it("limitatore per chiave (IP): max N richieste nella finestra", () => {
    const l = new KeyedLimiter(3, 1000);
    expect([0, 1, 2, 3].map((t) => l.allow("1.2.3.4", t))).toEqual([true, true, true, false]);
    expect(l.allow("5.6.7.8", 4)).toBe(true); expect(l.allow("1.2.3.4", 1500)).toBe(true);
  });
});

describe("validazione dei messaggi (zod)", () => {
  it("nickname: normalizzato, 1–16 caratteri, solo lettere/numeri/spazi/_.'-", () => {
    expect(nicknameSchema.parse("  Marta   Rossi ")).toBe("Marta Rossi");
    for (const bad of ["", "   ", "x".repeat(17), "<script>", "a\nb", "-iniziale", "ok😀", "a".repeat(100)]) expect(nicknameSchema.safeParse(bad).success, bad).toBe(false);
    expect(nicknameSchema.safeParse("Zoë_9").success).toBe(true);
  });
  it("codice stanza: maiuscolo, 5 caratteri, alfabeto senza ambigui", () => {
    expect(roomCodeSchema.parse("abcde")).toBe("ABCDE");
    for (const bad of ["ABCD", "ABCDEF", "ABCD0", "ABCDI", "ABCDO", "ABCD1", "ABC-E"]) expect(roomCodeSchema.safeParse(bad).success, bad).toBe(false);
  });
  it("creazione stanza: campi sconosciuti rifiutati", () => {
    expect(createRoomBody.safeParse({ nickname: "Ann" }).success).toBe(true);
    expect(createRoomBody.safeParse({ nickname: "Ann", admin: true }).success).toBe(false);
    expect(createRoomBody.safeParse({ nickname: "Ann", mode: "boh" }).success).toBe(false);
  });
  it("messaggi WebSocket: forma stretta, limiti numerici, niente campi extra", () => {
    const ok = (m: unknown) => clientMessageSchema.safeParse(m).success;
    expect(ok({ t: "ping" })).toBe(true);
    expect(ok({ t: "hello", token: "A".repeat(22) })).toBe(true);
    expect(ok({ t: "hello", token: "corto" })).toBe(false);
    expect(ok({ t: "act", action: { type: "vote", position: 3 } })).toBe(true);
    expect(ok({ t: "act", action: { type: "vote", position: 0 } })).toBe(false);
    expect(ok({ t: "act", action: { type: "vote", position: 9 } })).toBe(false);
    expect(ok({ t: "act", action: { type: "vote", position: 1.5 } })).toBe(false);
    expect(ok({ t: "act", action: { type: "vote", position: 1, playerId: "p1" } })).toBe(false); // l'identità la decide il server
    expect(ok({ t: "act", action: { type: "playCard", cardId: "p05-i02" } })).toBe(true);
    expect(ok({ t: "act", action: { type: "playCard", cardId: "../../etc" } })).toBe(false);
    expect(ok({ t: "setOptions", turnTimerSec: 45 })).toBe(false);
    expect(ok({ t: "kick", playerId: "zz" })).toBe(false);
    expect(ok({ t: "boh" })).toBe(false); expect(ok(null)).toBe(false); expect(ok("ping")).toBe(false); expect(ok([])).toBe(false);
  });
});
