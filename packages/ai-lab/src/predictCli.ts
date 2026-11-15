import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_PRIOR } from "@gdt/strategic-ai";
import type { AdaptMode, OpponentPrior } from "@gdt/strategic-ai";
import { parseSpec } from "./agents.ts";
import type { AgentSpec } from "./agents.ts";
import type { LabContent } from "./match.ts";
import type { TournamentConfig } from "./tournament.ts";
import { collectLogs, compareEval, convergenceCalibration, evaluate, logitPredictor, productionCrowdPredictor, summarizeEval, uniformPredictor } from "./predictionEval.ts";
import type { Evaluation, GameLog } from "./predictionEval.ts";
import { fitPrior } from "./fitPrior.ts";

export const PRIOR_PATH = new URL("../../strategic-ai/src/opponents/prior.fitted.json", import.meta.url).pathname;
/** Popolazione predefinita: bot attuali di tutti i livelli e caratteri a caso; a ogni partita se ne estraggono `players`. */
const DEFAULT_POOL = "production:hard:random,production:hard:random,production:hard:random,production:medium:random,production:medium:random,production:medium:random,production:easy:random,production:easy:random,production:easy:random";

function config(args: Record<string, string[]>, games: number, seed: number): TournamentConfig {
  const specs: AgentSpec[] = (args.participants?.join(",") ?? DEFAULT_POOL).split(",").filter(Boolean).map(parseSpec);
  return { name: "previsioni", games, players: Number(args.players?.[0] ?? 5), seed, participants: specs, lineup: "pool", miniGame: "random" };
}
const f = (x: { mean: number; half: number }, d = 3) => `${x.mean.toFixed(d)} ±${x.half.toFixed(d)}`;
const logs = (args: Record<string, string[]>, content: LabContent, games: number, seed: number, label: string): GameLog[] => {
  const t0 = performance.now(); const l = collectLogs(config(args, games, seed), content);
  console.error(`${label}: ${l.length} partite, ${l.reduce((a, g) => a + g.turns.length, 0)} turni (${((performance.now() - t0) / 1000).toFixed(1)} s)`); return l;
};

export function fitPriorCmd(args: Record<string, string[]>, content: LabContent) {
  const mode = (args.mode?.[0] ?? "types") as AdaptMode, games = Number(args.games?.[0] ?? 1500), seed = Number(args.seed?.[0] ?? 31337);
  const train = logs(args, content, games, seed, "addestramento"), valid = logs(args, content, Math.max(200, Math.round(games / 3)), seed + 777777, "validazione");
  const fit = fitPrior(train, valid, { source: `bot attuali (production), pool ${args.participants?.join(",") ?? "predefinito"}, ${args.players?.[0] ?? 5} giocatori`, seed, date: new Date().toISOString().slice(0, 10) }, mode);
  console.log(`Prior della popolazione (coefficienti: ${fit.prior.features.join(", ")}) — adattamento "${mode}"`);
  console.log("  Folla   :", fit.prior.crowd.join(", ")); console.log("  Megafono:", fit.prior.mega.join(", "));
  console.log(`  scelte usate: Folla ${fit.choices.crowd}, Megafono ${fit.choices.mega}; scelti sulla validazione: sigma ${fit.sigmaScale}, sigma della scala λ ${fit.lambdaSigma}`);
  console.log("  (sigma, sigmaλ) → log-verosimiglianza di validazione:", fit.grid.map((g) => `(${g.sigmaScale}, ${g.lambdaSigma}): ${g.logLik.toFixed(4)}`).join(" · "));
  const out = args.out?.[0] ?? PRIOR_PATH; mkdirSync(join(out, ".."), { recursive: true }); writeFileSync(out, JSON.stringify(fit.prior, null, 1) + "\n"); console.log("Salvato:", out);
}

export function predictEvalCmd(args: Record<string, string[]>, content: LabContent) {
  const games = Number(args.games?.[0] ?? 800), seed = Number(args.seed?.[0] ?? 424242), priorFile = args.prior?.[0] ?? PRIOR_PATH;
  const prior: OpponentPrior = existsSync(priorFile) ? JSON.parse(readFileSync(priorFile, "utf8")) : DEFAULT_PRIOR;
  console.log(`Prior: ${existsSync(priorFile) ? priorFile : "predefinito (a mano)"}`);
  const test = logs(args, content, games, seed, "prova");
  const preds = [uniformPredictor, productionCrowdPredictor("medium"), productionCrowdPredictor("hard"), logitPredictor(prior, false), logitPredictor(prior, true, "adatt-coef", 1, "coef"), logitPredictor(prior, true, "adatt-scala", 1, "scale"), logitPredictor(prior, true, "adatt-scala+coef", 1, "scale+coef"), logitPredictor(prior, true, "tipi", 1, "types"), logitPredictor(prior, true, "tipi+tavolo-2", 1, "types", 2), logitPredictor(prior, true, "tipi+tavolo-8", 1, "types", 8), logitPredictor(prior, true, "modello-adattivo", 1, "types", 4)];
  const ev = Object.fromEntries(preds.map((p) => [p.id, evaluate(p, test)])) as Record<string, Evaluation>;
  console.log(`\nPrevisione del voto di un altro giocatore — ${games} partite, ${test[0]?.players.length} giocatori (log-verosimiglianza media per voto: più alta = meglio; il caso = ln(1/n) ≈ −1.6)`);
  console.log("predittore".padEnd(26), "osservazioni  log-verosim. (IC95%)   accuratezza  massa sul più votato");
  for (const p of preds) { const s = summarizeEval(ev[p.id]!); console.log(p.id.padEnd(26), String(s.n).padStart(12), "  ", f(s.logLik).padEnd(20), (100 * s.accuracy.mean).toFixed(1).padStart(6) + "%", "   ", f(s.leadMass)); }
  const A = ev["modello-adattivo"]!, P = ev["modello-popolazione"]!, H = ev["folla-bot-hard"]!, M = ev["folla-bot-medium"]!;
  const d = (a: Evaluation, b: Evaluation, flt?: (o: Evaluation["obs"][number]) => boolean) => { const c = compareEval(a, b, flt); return `${c.mean >= 0 ? "+" : ""}${f(c, 4)} ${c.significant ? "★" : "(non rilevabile)"}`; };
  console.log("\nDifferenze appaiate di log-verosimiglianza (positivo = il primo prevede meglio; ★ = IC95% non contiene lo zero)");
  console.log("  per variante, rispetto alla popolazione:  coef", d(ev["adatt-coef"]!, P), "| scala", d(ev["adatt-scala"]!, P), "| scala+coef", d(ev["adatt-scala+coef"]!, P), "| tipi", d(ev["tipi"]!, P), "| tipi+tavolo κ=2", d(ev["tipi+tavolo-2"]!, P), "| κ=8", d(ev["tipi+tavolo-8"]!, P), "| κ=4 (modello-adattivo)", d(A, P));
  console.log("  adattivo − popolazione      :", d(A, P)); console.log("  adattivo − folla bot (hard) :", d(A, H)); console.log("  adattivo − folla bot (medium):", d(A, M)); console.log("  popolazione − folla bot (hard):", d(P, H));
  console.log("\nAdattamento nel corso della partita (adattivo − popolazione, per turno già giocato):");
  const maxT = A.obs.reduce((m, o) => Math.max(m, o.turn), 0); for (let t = 0; t <= Math.min(maxT, 7); t++) console.log(`  turno ${t + 1}: ${d(A, P, (o) => o.turn === t)}`);
  console.log("\nPer livello del votante (adattivo − popolazione):"); for (const lv of ["easy", "medium", "hard"]) console.log(`  ${lv.padEnd(7)}: ${d(A, P, (o) => o.level === lv)}  | log-verosim. adattivo ${f(summarizeEval(A, (o) => o.level === lv).logLik)} (caso ${Math.log(1 / (test[0]?.players.length ?? 5)).toFixed(2)})`);
  console.log("\nPer ruolo (adattivo − popolazione):"); for (const r of ["crowd", "mega"] as const) console.log(`  ${r.padEnd(6)}: ${d(A, P, (o) => o.role === r)}`);
  console.log("\nConvergenza: P(almeno m degli altri votano la stessa carta) — previsto dal modello adattivo vs osservato");
  for (const c of convergenceCalibration(A)) console.log(`  m=${c.m}: previsto ${(100 * c.predicted).toFixed(1)}%  osservato ${(100 * c.actual).toFixed(1)}%  (${c.n} turni-osservatore)`);
  if (args.out) { const dir = args.out[0]!; mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, "predict-eval.json"), JSON.stringify({ games, seed, prior, summary: preds.map((p) => summarizeEval(ev[p.id]!)) }, null, 1)); console.log("\nSalvato:", join(dir, "predict-eval.json")); }
}
