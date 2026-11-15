// AI Laboratory — riga di comando. Uso:
//   npm run lab -- --games 1000 --players 4 --participants baseline-1:hard,production:hard,baseline-1:hard,production:hard --seed 1 --out lab-out/prova
//   npm run lab -- --config lab-out/prova/config.json --out lab-out/ripetizione      (stessa configurazione = stessi risultati)
// Opzioni: --name, --lineup fixed|pool, --mini random|off, --compare "baseline-1" "production" (due gruppi: tutti i posti con quel motore o etichetta),
//          --tune baseline-1.tempHard=1.5 (ripetibile), --list (versioni disponibili).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BOT_ENGINES, buildPhraseDeck, DEFAULT_AGE_BAND } from "@gdt/game-engine";
import { ACCUSE_DECK, CONFESSIONS, DECK, PHRASE_POOL } from "../../../worker/src/content.ts";   // mazzi ed etichette reali (registra anche le etichette dei bot)
import { parseSpec } from "./agents.ts";
import { compareGroups, runTournament } from "./tournament.ts";
import type { TournamentConfig } from "./tournament.ts";
import { formatReport, gamesCsv, resultsJson, summaryCsv, summaryTables } from "./export.ts";
import type { LabContent } from "./match.ts";

export const realContent: LabContent = {
  deck: DECK, accuseDeck: ACCUSE_DECK,
  phraseDeck: (seed) => buildPhraseDeck(PHRASE_POOL!, CONFESSIONS, { age: DEFAULT_AGE_BAND, seed: seed ^ 0x5bd1e995, confessions: true }),
};

function parseArgs(argv: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!; if (!a.startsWith("--")) continue;
    const k = a.slice(2), vals: string[] = [];
    while (i + 1 < argv.length && !argv[i + 1]!.startsWith("--")) vals.push(argv[++i]!);
    (out[k] ??= []).push(...vals);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.list) {
    console.log("Versioni dei bot (stato di gioco):"); for (const e of Object.values(BOT_ENGINES)) console.log(`  ${e.id.padEnd(12)} ${e.label} — ${e.description}`);
    return;
  }
  const cmd = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "tournament";
  if (cmd !== "tournament") throw new Error(`comando sconosciuto: ${cmd} (tournament)`);
  let cfg: TournamentConfig;
  if (args.config) cfg = JSON.parse(readFileSync(args.config[0]!, "utf8")) as TournamentConfig;
  else {
    const specs = (args.participants?.join(",") ?? "").split(",").filter(Boolean).map(parseSpec);
    const tune: Record<string, Record<string, number>> = {};
    for (const t of args.tune ?? []) { const m = /^([^.]+)\.([^=]+)=(.+)$/.exec(t); if (!m) throw new Error(`--tune non valido: ${t}`); (tune[m[1]!] ??= {})[m[2]!] = Number(m[3]); }
    cfg = {
      ...(args.name ? { name: args.name.join(" ") } : {}), games: Number(args.games?.[0] ?? 200), players: Number(args.players?.[0] ?? specs.length), seed: Number(args.seed?.[0] ?? 1),
      participants: specs, lineup: (args.lineup?.[0] as "fixed" | "pool" | undefined) ?? "fixed", miniGame: args.mini?.[0] === "off" ? false : "random", ...(Object.keys(tune).length ? { tune } : {}),
    };
  }
  const t0 = performance.now(); let lastPct = -1;
  const result = runTournament(cfg, realContent, { onGame: (_r, done, total) => { const p = Math.floor((100 * done) / total / 10) * 10; if (p !== lastPct && process.stderr.isTTY) { lastPct = p; process.stderr.write(`\r${done}/${total} partite`); } } });
  if (process.stderr.isTTY) process.stderr.write("\r");
  console.log(formatReport(result));
  if (args.compare && args.compare.length >= 2) {
    const [a, b] = args.compare as [string, string], is = (k: string) => (s: { participant: string; engine: string }) => s.participant === k || s.engine === k;
    const c = compareGroups(result.games, is(a), is(b)), f = (x: { mean: number; half: number }, d = 2) => `${x.mean.toFixed(d)} ± ${x.half.toFixed(d)}`;
    console.log(`\nConfronto appaiato ${a} − ${b} (${c.games} partite): punti ${f(c.score)} · vittorie ${(100 * c.winRate.mean).toFixed(1)} ± ${(100 * c.winRate.half).toFixed(1)} pp · posizione ${f(c.place)} (negativa = ${a} meglio)` +
      `\n→ ${c.score.significant ? "differenza nei punti statisticamente rilevabile" : "nessuna differenza rilevabile nei punti con questo campione"}; vittorie: ${c.winRate.significant ? "rilevabile" : "non rilevabile"}`);
  }
  if (args.out) {
    const dir = args.out[0]!; mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "config.json"), JSON.stringify(cfg, null, 1)); writeFileSync(join(dir, "results.json"), resultsJson(result));
    writeFileSync(join(dir, "games.csv"), gamesCsv(result.games)); writeFileSync(join(dir, "summary.csv"), summaryCsv(summaryTables(result.games)));
    console.log(`\nSalvati in ${dir}: config.json, results.json, games.csv, summary.csv (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
  }
}
if (process.argv[1] && /cli\.ts$/.test(process.argv[1])) main();   // solo da riga di comando (i test importano `realContent` senza avviare nulla)
