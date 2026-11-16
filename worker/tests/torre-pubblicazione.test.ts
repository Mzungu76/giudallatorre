import { afterEach, describe, expect, it, vi } from "vitest";
import { torreDelGiorno } from "../src/torre.ts";

const files: Record<string, unknown> = { "/oggi/indice.json": { inizio: "2026-11-16", date: ["2026-11-16", "2026-11-17", "2026-11-18"], riserva: 2 }, "/oggi/2026-11-16.json": { a: 1 }, "/oggi/2026-11-17.json": { a: 2 }, "/oggi/2026-11-18.json": { a: 3 }, "/oggi/riserva/0.json": { a: 0 } };
const env = { ASSETS: { fetch: async (r: Request) => { const f = files[new URL(r.url).pathname]; return f ? new Response(JSON.stringify(f), { headers: { "content-type": "application/json" } }) : new Response("no", { status: 404 }); } } } as { ASSETS: { fetch: (r: Request) => Promise<Response> } };
const get = (p: string) => torreDelGiorno(new Request("https://x.it" + p), env, p, Date.now());
afterEach(() => vi.useRealTimers());

describe("la Torre del giorno si pubblica alle 00:01 di Roma", () => {
  it("prima delle 00:01 il giorno nuovo non si vede, né nell'elenco né come file; dopo sì", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-16T23:00:30Z"));   // 00:00:30 del 17 a Roma
    expect((await get("/oggi/2026-11-17.json")).status).toBe(404); expect((await get("/oggi/2026-11-16.json")).status).toBe(200);
    expect(((await (await get("/oggi/indice.json")).json()) as { date: string[] }).date).toEqual(["2026-11-16"]);
    vi.setSystemTime(new Date("2026-11-16T23:01:05Z"));                          // 00:01:05
    expect((await get("/oggi/2026-11-17.json")).status).toBe(200); expect((await get("/oggi/2026-11-18.json")).status).toBe(404);
    expect(((await (await get("/oggi/indice.json")).json()) as { date: string[] }).date).toEqual(["2026-11-16", "2026-11-17"]);
  });
  it("la riserva è sempre disponibile", async () => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-10T12:00:00Z")); expect((await get("/oggi/riserva/0.json")).status).toBe(200); });
});
