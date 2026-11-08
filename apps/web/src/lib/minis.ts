import type { MiniKind } from "@gdt/game-engine";
import { ts } from "./testi.ts";

/** Testi dei tre mini-giochi (intervalli): titolo, passi, come si fanno punti, istruzioni di gioco e di voto. Vivono in public/testi.json. */
export interface KindInfo { title: string; icon: string; tag: string; steps: [string, string][]; /** Come si fanno punti: [valore, a chi / quando]. */ pts: [string, string][]; headCard: string | null; play: string; vote: string }
const ICON: Record<MiniKind, string> = { accusa: "🔍", amore: "💘", peggiore: "👎" };
const HEAD: Record<MiniKind, boolean> = { accusa: true, amore: true, peggiore: false };
export function miniInfo(k: MiniKind): KindInfo {
  const g = (s: string) => ts(`mini.${k}.${s}` as never);
  return {
    title: g("titolo"), icon: ICON[k], tag: g("tag"), headCard: HEAD[k] ? g("capo") : null,
    steps: [1, 2, 3].map((i) => [g(`passo${i}.t`), g(`passo${i}.x`)] as [string, string]),
    pts: [1, 2].map((i) => [g(`pts${i}.v`), g(`pts${i}.x`)] as [string, string]),
    play: g("gioca"), vote: g("vota"),
  };
}
