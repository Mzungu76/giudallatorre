import { useEffect, useRef, useState } from "react";
import type { GameState } from "@gdt/game-engine";
import GameIcon from "./GameIcon.tsx";
import { sfx } from "../lib/sfx.ts";
import { t, ts } from "../lib/testi.ts";
import { stereoGame, stereoGruppi } from "../lib/stereo.ts";
import { cardFull, useCards } from "../lib/cards.ts";

const R = 54, C = 2 * Math.PI * R;

/** Dopo il premio della serata e prima della scalata: quanto hanno pesato i luoghi comuni in QUESTA partita (voti di tutti, nessun nome). Stima della stanza. */
export default function StereoScene({ stereo, isBot, sound, readOnly, onDone }: { stereo: GameState["stereo"] | null | undefined; isBot: (id: string) => boolean; sound: boolean; readOnly?: boolean; onDone: () => void }) {
  useCards(); const g = stereoGame(stereo), gr = stereoGruppi(stereo, isBot), [on, setOn] = useState(false), [shown, setShown] = useState(0), tm = useRef<ReturnType<typeof setTimeout> | null>(null);
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
              </svg>
              <div className="sc-mid"><b data-testid="stereo-pct">{shown}%</b><span>{t("sp.partita")}</span></div>
            </div>
            {g.top[0] && <div className="sc-blk sc-lc" data-testid="stereo-top"><h4>{t("sc.top")}</h4><div className="sc-lc-k">{g.top[0].k}</div><small>{g.top[0].n === 1 ? ts("sp.voto1") : ts("sp.voti", { n: g.top[0].n })}</small></div>}
            {g.lancio && (
              <div className="sc-blk sc-lan" data-testid="stereo-lancio">
                <h4>{t("sc.lancio")}</h4>
                <div className="sc-lan-r"><img src={cardFull(g.lancio.cardId)} alt="" draggable={false} /><div><b>{ts("sc.lancio.voti", { ruolo: g.lancio.ruolo, n: g.lancio.n })}</b><q>{g.lancio.text}</q></div></div>
              </div>
            )}
            {(gr.umani !== null || gr.bot !== null) && (
              <div className="sc-blk sc-uvb" data-testid="stereo-uvb">
                <h4>{t("sc.uvb")}</h4>
                {([["sc.umani", gr.umani, "sc-u"], ["sc.bot", gr.bot, "sc-b"]] as const).filter(([, v]) => v !== null).map(([k, v, c]) => <div className="sc-uv" key={k}><span>{t(k)}</span><div className="sc-bar"><u className={c} style={{ width: on ? `${v}%` : 0 }} /></div><b>{v}%</b></div>)}
              </div>
            )}
          </>
        )}
        <button className="bt mus aw-btn" onClick={onDone} data-testid="stereo-next">{t("aw.avanti")}</button>
      </div>
    </div>
  );
}
