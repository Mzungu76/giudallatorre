import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Regola dei hook di React: niente `useState/useMemo/useEffect/useRef` dopo un ritorno anticipato dello stesso componente (altrimenti, quando la condizione cambia, la schermata si svuota). */
describe("schermate con ritorno anticipato", () => {
  for (const rel of ["screens/Final.tsx"]) {
    it(`${rel}: nessun hook dopo il ritorno anticipato`, () => {
      const s = readFileSync(join(import.meta.dirname, "../src", rel), "utf8"), i = s.indexOf("  if (!seen && award) {"), j = s.indexOf("  }\n", i);
      expect(i).toBeGreaterThan(0);
      expect(/\buse(State|Memo|Effect|Ref|Callback)\(/.test(s.slice(j)), "un hook compare dopo il ritorno anticipato").toBe(false);
    });
  }
});
