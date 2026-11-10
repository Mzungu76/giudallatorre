import { useEffect, useMemo, useState } from "react";
import { luiPool, propagandaPool } from "@gdt/game-engine";
import type { LuiSpec } from "@gdt/game-engine";
import { luiTok } from "../scene/draw.ts";
import { luiEffectHow, luiLabel } from "../lib/lui.ts";
import { sfx } from "../lib/sfx.ts";
import { FAST, useStage } from "../ui.tsx";
import { t, ts } from "../lib/testi.ts";

/** Quanti scatti fa la «ruota» prima di fermarsi, e il primo intervallo (ms): ogni scatto rallenta un po', come nei quiz in TV. */
const STEPS = 16, FIRST_MS = 70, SLOW = 1.17;

/**
 * Estrazione dei segnalini Lui! a inizio partita (dopo il personaggio), come nei quiz in TV: una carrellata che rallenta e si ferma su quello della partita.
 * «Il gregge»: si estrae la soglia, poi arriva accanto l'Imbroglio! (sempre presente). PROPAGANDA: si estrae prima il positivo, poi il negativo.
 * Alla fine si vede il set della partita. I segnalini sono già estratti dal server: l'animazione li mostra soltanto.
 */
export default function LuiDraw({ tokens, players, propaganda, sound, onClose }: { tokens: LuiSpec[]; players: number; propaganda: boolean; sound: boolean; onClose: () => void }) {
  const { H } = useStage();
  const rounds = useMemo(() => {
    if (propaganda) {
      const pp = propagandaPool(players), pos = tokens.find((x) => x.positive) ?? pp.positive[0]!, neg = tokens.find((x) => x.effect && !x.positive) ?? pp.negative[0]!;
      return [{ pool: pp.positive, chosen: pos, sub: "pos" as const }, { pool: pp.negative, chosen: neg, sub: "neg" as const }];
    }
    const chosen = tokens.find((x) => !x.trap) ?? tokens[0]!;
    return [{ pool: luiPool(players).filter((x) => x.slot !== "zero").map((x) => (x.slot === chosen.slot ? chosen : { ...x, herd: true })), chosen, sub: "soglia" as const }];
  }, [players, propaganda, tokens]);
  const set = propaganda ? rounds.map((r) => r.chosen) : [rounds[0]!.chosen, ...tokens.filter((x) => x.trap)];
  const [ri, setRi] = useState(0), [step, setStep] = useState(FAST ? STEPS : 0), [stage, setStage] = useState<"spin" | "pick" | "set">(FAST ? "set" : "spin");
  const R = rounds[Math.min(ri, rounds.length - 1)]!, pool = R.pool, target = Math.max(0, pool.findIndex((x) => x.slot === R.chosen.slot));
  // la ruota parte da un punto tale che dopo STEPS scatti si fermi proprio sul segnalino estratto
  const start = (((target - STEPS) % pool.length) + pool.length) % pool.length;
  useEffect(() => {
    if (stage !== "spin") return undefined;
    if (step >= STEPS) { sfx.tada(sound); setStage("pick"); return undefined; }
    const tm = setTimeout(() => { sfx.tap(sound, 420 + (step % 4) * 60); setStep(step + 1); }, FIRST_MS * Math.pow(SLOW, step));
    return () => clearTimeout(tm);
  }, [step, stage]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (stage !== "pick") return undefined;
    const tm = setTimeout(() => { if (ri + 1 < rounds.length) { setRi(ri + 1); setStep(0); setStage("spin"); } else { sfx.whoosh(sound); setStage("set"); } }, 1400);
    return () => clearTimeout(tm);
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = (start + step) % pool.length, done = stage !== "spin";
  const how = (sp: LuiSpec) => (sp.effect ? luiEffectHow(sp) : sp.trap ? t("bui.info.trap", { pt: sp.pts }) : t("bui.info.herd", { k: sp.k, pt: sp.pts }));
  const sub = R.sub === "pos" ? t("ld.sotto.pos") : R.sub === "neg" ? t("ld.sotto.neg") : t("ld.sotto");
  return (
    <div className="chi ld" style={{ height: H }} data-testid="lui-draw" role="dialog" aria-label={ts("ld.aria")}>
      <div className="stbd-sky" /><div className="stbd-rays" />
      <div className="chi-t"><small>{stage === "set" ? (propaganda ? t("ld.set.s.prop") : t("ld.set.s")) : sub}</small><b>{stage === "set" ? t("ld.set") : t("ld.titolo")}</b></div>
      {stage !== "set" ? (
        <div className="ld-row" data-testid="lui-draw-wheel" key={ri}>
          {pool.map((sp, i) => (
            <div key={sp.slot} className={`ld-tk${i === cur ? " on" : " off"}${done && i === cur ? " win" : ""}`} data-testid={i === cur ? "lui-draw-cur" : undefined}>
              <span dangerouslySetInnerHTML={{ __html: luiTok(sp, 92) }} /><b>{luiLabel(sp)}</b>
            </div>
          ))}
        </div>
      ) : (
        <div className="ld-set" data-testid="lui-draw-set">
          {set.map((sp, i) => (
            <div key={sp.slot} className="ld-card" style={{ animationDelay: `${i * 0.35}s` }}>
              <span dangerouslySetInnerHTML={{ __html: luiTok(sp, 84) }} />
              <div><b>{luiLabel(sp)}</b><small>{how(sp)}</small></div>
            </div>
          ))}
        </div>
      )}
      {stage === "pick" && <div className="ld-msg" data-testid="lui-draw-picked">{t("ld.scelto", { label: luiLabel(R.chosen) })}</div>}
      <button className="stbd-ok" onClick={onClose} data-testid="lui-draw-ok">{stage === "set" ? t("ld.ok") : t("ld.salta")}</button>
    </div>
  );
}
