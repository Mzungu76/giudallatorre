// Prevedibilità sul segnalino (Cade / Non cade / Voti nulli): come posa il Megafono e quanto la Folla lo segue. Uso: npx tsx tools/analysis/lui-boccaloni.ts [partite] [motore ...]
import { playGame } from "../../packages/ai-lab/src/match.ts";
import { TUNE } from "../../packages/game-engine/src/ai-v2/ai.ts";
import { realContent } from "../../packages/ai-lab/src/cli.ts";
const games = Number(process.argv[2] ?? 60), engines = process.argv.slice(3).length ? process.argv.slice(3) : ["v2m", "v2o"];
if (process.env.NULFEAR) TUNE.nulFear = Number(process.env.NULFEAR);
if (process.env.MIX) TUNE.beliefMix = Number(process.env.MIX);
if (process.env.HARM) TUNE.harm = Number(process.env.HARM);
for (const eng of engines) {
  const T: Record<string, { n: number; megaOn: number; folla: number; follaOn: number; ok: number; mp: number; fp: number }> = {};
  for (let g = 0; g < games; g++) {
    playGame(Array.from({ length: 4 }, () => ({ engine: eng, level: "hard" as const })), g, 7000 + g, realContent, { miniGame: false, onResults: (s) => {
      const r = s.lastResult!, m = r.marks?.[0]; if (!m) return; const t = (T[m.effect] ??= { n: 0, megaOn: 0, folla: 0, follaOn: 0, ok: 0, mp: 0, fp: 0 });
      t.n++; if (r.votes[r.megafonoId] === m.position) t.megaOn++;
      for (const [pid, v] of Object.entries(r.votes)) if (pid !== r.megafonoId) { t.folla++; if (v === m.position) t.follaOn++; }
      if (r.marks![0]!.hit) t.ok++; const f = Object.entries(r.points).filter(([id]) => id !== r.megafonoId); t.mp += r.points[r.megafonoId] ?? 0; t.fp += f.reduce((a, [, v]) => a + v, 0) / Math.max(1, f.length);
    } });
  }
  const tot = Object.values(T).reduce((a, t) => a + t.n, 0); console.log(`\n== ${eng}: ${tot} turni`);
  for (const [k, t] of Object.entries(T)) console.log(`${k.padEnd(8)} ${(100 * t.n / tot).toFixed(0).padStart(3)}% dei turni · Megafono vota la stessa carta ${(100 * t.megaOn / t.n).toFixed(0)}% · la Folla la vota ${(100 * t.follaOn / t.folla).toFixed(0)}% · riuscito ${(100 * t.ok / t.n).toFixed(0)}% · Megafono ${(t.mp / t.n).toFixed(2)} pt, Folla ${(t.fp / t.n).toFixed(2)} pt, vantaggio ${((t.mp - t.fp) / t.n).toFixed(2)}`);
}
