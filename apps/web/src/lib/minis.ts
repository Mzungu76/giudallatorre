import type { MiniKind } from "@gdt/game-engine";
import { ts } from "./testi.ts";
import type { TestoKey } from "./testi.ts";

/** Testi dei tre intervalli a tempo (Accusa, Storia d'amore, Il peggiore). Vivono in public/testi.json. */
export interface KindInfo { title: string; icon: string; tag: string; /** Cosa si sceglie, in una riga (presentazione). */ rule: string; /** Il personaggio che sta di lato sulla torre (Accusa e Storia d'amore), se c'è. */ side: string | null; /** Cosa dicono le didascalie durante la corsa. */ body: string | null }
const ICON: Record<MiniKind, string> = { accusa: "🔍", amore: "💘", peggiore: "👎" };
const HAS_SIDE: Record<MiniKind, boolean> = { accusa: true, amore: true, peggiore: false };
export function miniInfo(k: MiniKind): KindInfo {
  const g = (s: string) => ts(`mini.${k}.${s}` as TestoKey);
  return { title: g("titolo"), icon: ICON[k], tag: g("tag"), rule: g("regola"), side: HAS_SIDE[k] ? g("capo") : null, body: k === "amore" ? ts("mg.body.amore") : k === "peggiore" ? ts("mg.body.peggiore") : null };
}
