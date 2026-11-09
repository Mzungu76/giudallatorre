import { useEffect, useMemo, useState } from "react";
import { luiPool } from "@gdt/game-engine";
import type { LuiSpec } from "@gdt/game-engine";
import { luiTok } from "../scene/draw.ts";
import { luiLabel } from "../lib/lui.ts";
import { sfx } from "../lib/sfx.ts";
import { FAST, useStage } from "../ui.tsx";
import { t, ts } from "../lib/testi.ts";

/** Quanti scatti fa la «ruota» prima di fermarsi, e il primo intervallo (ms): ogni scatto rallenta un po', come nei quiz in TV. */
const STEPS = 16, FIRST_MS = 70, SLOW = 1.17;

/**
 * Variante «Il gregge», all'inizio della partita (dopo il personaggio): estrazione della soglia del Lui!.
 * Carrellata dei segnalini soglia possibili per questo numero di giocatori, che rallenta e si ferma su quello della partita;
 * poi arriva accanto l'Imbroglio! (lo 0, sempre presente) e si vede il set della partita.
 */
export default function LuiDraw({ tokens, players, sound, onClose }: { tokens: LuiSpec[]; players: number; sound: boolean; onClose: () => void }) {
  const { H } = useStage();
  const chosen = tokens.find((x) => !x.trap) ?? tokens[0]!, zero = tokens.find((x) => x.trap) ?? null;
  // i segnalini soglia possibili, come li vede la partita (con il simbolo del gregge)
  const pool = useMemo(() => luiPool(players).filter((x) => x.slot !== "zero").map((x) => (x.slot === chosen.slot ? chosen : { ...x, herd: true })), [players, chosen]);
  const target = Math.max(0, pool.findIndex((x) => x.slot === chosen.slot));
  // la ruota parte da un punto tale che dopo STEPS scatti si fermi proprio sulla soglia estratta
  const start = (((target - STEPS) % pool.length) + pool.length) % pool.length;
  const [step, setStep] = useState(FAST ? STEPS : 0), [stage, setStage] = useState<"spin" | "pick" | "set">(FAST ? "set" : "spin");
  useEffect(() => {
    if (stage !== "spin") return undefined;
    if (step >= STEPS) { sfx.tada(sound); setStage("pick"); return undefined; }
    const tm = setTimeout(() => { sfx.tap(sound, 420 + (step % 4) * 60); setStep(step + 1); }, FIRST_MS * Math.pow(SLOW, step));
    return () => clearTimeout(tm);
  }, [step, stage]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (stage !== "pick") return undefined; const tm = setTimeout(() => { sfx.whoosh(sound); setStage("set"); }, 1400); return () => clearTimeout(tm); }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = (start + step) % pool.length, done = stage !== "spin";
  const how = (sp: LuiSpec) => (sp.trap ? t("bui.info.trap", { pt: sp.pts }) : t("bui.info.herd", { k: sp.k, pt: sp.pts }));
  return (
    <div className="chi ld" style={{ height: H }} data-testid="lui-draw" role="dialog" aria-label={ts("ld.aria")}>
      <div className="stbd-sky" /><div className="stbd-rays" />
      <div className="chi-t"><small>{stage === "set" ? t("ld.set.s") : t("ld.sotto")}</small><b>{stage === "set" ? t("ld.set") : t("ld.titolo")}</b></div>
      {stage !== "set" ? (
        <div className="ld-row" data-testid="lui-draw-wheel">
          {pool.map((sp, i) => (
            <div key={sp.slot} className={`ld-tk${i === cur ? " on" : " off"}${done && i === cur ? " win" : ""}`} data-testid={i === cur ? "lui-draw-cur" : undefined}>
              <span dangerouslySetInnerHTML={{ __html: luiTok(sp, 92) }} /><b>{luiLabel(sp)}</b>
            </div>
          ))}
        </div>
      ) : (
        <div className="ld-set" data-testid="lui-draw-set">
          {[chosen, zero].filter((x): x is LuiSpec => !!x).map((sp, i) => (
            <div key={sp.slot} className="ld-card" style={{ animationDelay: `${i * 0.35}s` }}>
              <span dangerouslySetInnerHTML={{ __html: luiTok(sp, 84) }} />
              <div><b>{luiLabel(sp)}</b><small>{how(sp)}</small></div>
            </div>
          ))}
        </div>
      )}
      {stage === "pick" && <div className="ld-msg" data-testid="lui-draw-picked">{t("ld.scelto", { label: luiLabel(chosen) })}</div>}
      <button className="stbd-ok" onClick={onClose} data-testid="lui-draw-ok">{stage === "set" ? t("ld.ok") : t("ld.salta")}</button>
    </div>
  );
}
