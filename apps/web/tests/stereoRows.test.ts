import { describe, expect, it } from "vitest";
import { stereoRows } from "../src/lib/stereo.ts";

describe("pannello luoghi comuni: righe", () => {
  it("ordina per percentuale, salta chi non ha voti e dà la quota per caso", () => {
    const r = stereoRows({ n: { a: 4, b: 4, c: 0 }, s: { a: 1, b: 3 }, c: 1.2, turni: 4 }, ["a", "b", "c"]);
    expect(r.rows.map((x) => [x.id, x.pct])).toEqual([["b", 75], ["a", 25]]); expect(r.caso).toBe(30);
    expect(stereoRows(null, ["a"])).toEqual({ rows: [], caso: null }); expect(stereoRows({ n: {}, s: {}, c: 0, turni: 0 }, ["a"]).rows).toEqual([]);
  });
});
