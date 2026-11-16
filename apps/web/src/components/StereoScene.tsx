import { useEffect, useRef, useState } from "react";
import type { GameState } from "@gdt/game-engine";
import GameIcon from "./GameIcon.tsx";
import { sfx } from "../lib/sfx.ts";
import { t, ts } from "../lib/testi.ts";
import { stereoGame } from "../lib/stereo.ts";

const R = 54, C = 2 * Math.PI * R;

/** Dopo il premio della serata e prima della scalata: quanto hanno pesato i luoghi comuni in QUESTA partita (voti di tutti, nessun nome). Stima della stanza. */
export default function StereoScene({ stereo, sound, readOnly, onDone }: { stereo: GameState["stereo"] | null | undefined; sound: boolean; readOnly?: boolean; onDone: () => void }) {
  const g = stereoGame(stereo), [on, setOn] = useState(false), [shown, setShown] = useState(0), tm = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    sfx.drum(sound, 1);
    const a = setTimeout(() => { setOn(true); sfx.stamp(sound); }, 450);
    if (readOnly) tm.current = setTimeout(onDone, 12000);
    return () => { clearTimeout(a); if (tm.current) clearTimeout(tm.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {   // numero che sale fino alla quota
    if (!on || !g) return; let raf = 0; const t0 = performance.now();
    const step = (now: number) => { const k = Math.min(1, (now - t0) / 1300); setShown(Math.round(g.pct * (1 - (1 - k) ** 3))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [on]); // eslint-disable-line react-hooks/exhaustive-deps
  const ang = g ? (g.caso / 100) * 2 * Math.PI - Math.PI / 2 : 0, verdict = !g ? null : g.pct > g.caso + 8 ? "sc.v1" : g.pct < g.caso - 8 ? "sc.v3" : "sc.v2";
  return (
    <div className="aw sc" data-testid="stereo-scene">
      <div className="stbd-sky" /><div className="stbd-rays" />
      <div className="aw-box">
        <div className="aw-top"><div className="aw-t sc-t"><GameIcon name="maschere" size={34} /> {t("sp.titolo")}</div><div className="aw-s">{t("sp.sotto")}</div></div>
        {!g ? <p className="sc-empty" data-testid="stereo-empty">{t("sp.vuoto")}</p> : (
          <>
            <div className="sc-ring" data-testid="stereo-ring">
              <svg viewBox="0 0 140 140" aria-hidden="true">
                <circle cx="70" cy="70" r={R} className="sc-out" /><circle cx="70" cy="70" r={R} className="sc-trk" />
                <circle cx="70" cy="70" r={R} className="sc-val" strokeDasharray={C} strokeDashoffset={on ? C * (1 - g.pct / 100) : C} transform="rotate(-90 70 70)" />
                <line className="sc-tick" x1={70 + (R - 13) * Math.cos(ang)} y1={70 + (R - 13) * Math.sin(ang)} x2={70 + (R + 13) * Math.cos(ang)} y2={70 + (R + 13) * Math.sin(ang)} />
              </svg>
              <div className="sc-mid"><b data-testid="stereo-pct">{shown}%</b><span>{t("sp.partita")}</span></div>
            </div>
            <div className="sc-leg"><span><i className="sc-d1" />{t("sp.titolo")} <b>{g.pct}%</b></span><span><i className="sc-d2" />{t("sp.caso")} <b data-testid="stereo-caso">{g.caso}%</b></span></div>
            {verdict && on && <div className="aw-stamp sc-v" data-testid="stereo-verdict"><span className="aw-k">{t(verdict)}</span></div>}
            {g.top.length > 0 && (
              <div className="sc-top">
                <h4>{t("sp.piu")}</h4>
                {g.top.map((x, i) => <div className="sc-chip" key={x.k} style={{ animationDelay: `${0.9 + i * 0.18}s` }} data-testid="stereo-top"><span>{x.k}</span><b>{ts("sp.voti", { n: x.n })}</b></div>)}
              </div>
            )}
          </>
        )}
        <button className="bt mus aw-btn" onClick={onDone} data-testid="stereo-next">{t("aw.avanti")}</button>
      </div>
    </div>
  );
}
