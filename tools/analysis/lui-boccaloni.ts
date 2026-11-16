// Prevedibilità sul segnalino (Cade / Non cade / Voti nulli): come posa il Megafono e quanto la Folla lo segue. Uso: npx tsx tools/analysis/lui-boccaloni.ts [partite] [motore ...]
import { playGame } from "../../packages/ai-lab/src/match.ts";
import { TUNE } from "../../packages/game-engine/src/ai-v2/ai.ts";
import { realContent } from "../../packages/ai-lab/src/cli.ts";
const games = Number(process.argv[2] ?? 60), engines = process.argv.slice(3).length ? process.argv.slice(3) : ["v2m", "v2o"];
if (process.env.NULFEAR) TUNE.nulFear = Number(process.env.NULFEAR);
for (const eng of engines) {
  const T: Record<string, { n: number; megaOn: number; folla: number; follaOn: number; ok: number }> = {};
  for (let g = 0; g < games; g++) {
    playGame(Array.from({ length: 4 }, () => ({ engine: eng, level: "hard" as const })), g, 7000 + g, realContent, { miniGame: false, onResults: (s) => {
      const r = s.lastResult!, m = r.marks?.[0]; if (!m) return; const t = (T[m.effect] ??= { n: 0, megaOn: 0, folla: 0, follaOn: 0, ok: 0 });
      t.n++; if (r.votes[r.megafonoId] === m.position) t.megaOn++;
      for (const [pid, v] of Object.entries(r.votes)) if (pid !== r.megafonoId) { t.folla++; if (v === m.position) t.follaOn++; }
      if (r.marks![0]!.hit) t.ok++;
    } });
  }
  const tot = Object.values(T).reduce((a, t) => a + t.n, 0); console.log(`\n== ${eng}: ${tot} turni`);
  for (const [k, t] of Object.entries(T)) console.log(`${k.padEnd(8)} ${(100 * t.n / tot).toFixed(0).padStart(3)}% dei turni · Megafono vota la stessa carta ${(100 * t.megaOn / t.n).toFixed(0)}% · la Folla la vota ${(100 * t.follaOn / t.folla).toFixed(0)}%`);
}
