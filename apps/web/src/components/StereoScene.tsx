import { useEffect, useRef, useState } from "react";
import type { GameState } from "@gdt/game-engine";
import GameIcon from "./GameIcon.tsx";
import { sfx } from "../lib/sfx.ts";
import { t, ts } from "../lib/testi.ts";
import { stereoGame, stereoGruppi } from "../lib/stereo.ts";
import { cardFull, useCards } from "../lib/cards.ts";

/** Quadrante: da 0% (sinistra) a 100% (destra), quattro fasce colorate. */
const SEG = [{ a: 0, b: 0.15, c: "#4aa63a" }, { a: 0.15, b: 0.35, c: "#f4c20d" }, { a: 0.35, b: 0.6, c: "#f08a1c" }, { a: 0.6, b: 1, c: "#e5382b" }];
const pt = (f: number, r: number) => `${(100 - r * Math.cos(Math.PI * f)).toFixed(1)} ${(100 - r * Math.sin(Math.PI * f)).toFixed(1)}`;
const arc = (a: number, b: number, r: number) => `M ${pt(a, r)} A ${r} ${r} 0 0 1 ${pt(b, r)}`;
const fascia = (pct: number) => (pct < 15 ? 0 : pct < 35 ? 1 : pct < 60 ? 2 : 3);

/** Dopo il premio della serata e prima della scalata: i luoghi comuni di QUESTA partita, giocati come un quiz da bar (voti di tutti, nessun nome). Stima della stanza. */
export default function StereoScene({ stereo, isBot, sound, readOnly, onDone }: { stereo: GameState["stereo"] | null | undefined; isBot: (id: string) => boolean; sound: boolean; readOnly?: boolean; onDone: () => void }) {
  useCards(); const g = stereoGame(stereo), gr = stereoGruppi(stereo, isBot), [on, setOn] = useState(false), [shown, setShown] = useState(0), tm = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    sfx.drum(sound, 1);
    const a = setTimeout(() => setOn(true), 450), b = setTimeout(() => sfx.stamp(sound), 1900), c = setTimeout(() => sfx.stamp(sound), 2500);
    if (readOnly) tm.current = setTimeout(onDone, 14000);
    return () => { clearTimeout(a); clearTimeout(b); clearTimeout(c); if (tm.current) clearTimeout(tm.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {   // numero che sale insieme alla lancetta
    if (!on || !g) return; let raf = 0; const t0 = performance.now();
    const step = (now: number) => { const k = Math.min(1, (now - t0) / 1500); setShown(Math.round(g.pct * (1 - (1 - k) ** 3))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [on]); // eslint-disable-line react-hooks/exhaustive-deps
  const diff = gr.umani !== null && gr.bot !== null ? gr.umani - gr.bot : null, uvb = diff === null ? null : diff > 5 ? "sc.uvb.u" : diff < -5 ? "sc.uvb.b" : "sc.uvb.p";
  return (
    <div className="aw sc" data-testid="stereo-scene">
      <div className="stbd-sky" /><div className="stbd-rays" />
      <div className="aw-box">
        <div className="aw-top"><div className="aw-t sc-t"><GameIcon name="maschere" size={34} /> {t("sp.titolo")}</div><div className="aw-s">{t("sp.sotto")}</div></div>
        {!g ? <p className="sc-empty" data-testid="stereo-empty">{t("sp.vuoto")}</p> : (
          <>
            <div className="sc-gauge" data-testid="stereo-ring">
              <svg viewBox="0 0 200 118" aria-hidden="true">
                <path d={arc(0, 1, 80)} className="sc-g-out" />
                {SEG.map((s) => <path key={s.c} d={arc(s.a, s.b, 80)} className="sc-g-seg" stroke={s.c} />)}
                <g className="sc-needle" style={{ transform: `rotate(${on ? -90 + (g.pct / 100) * 180 : -90}deg)` }}><line x1="100" y1="100" x2="100" y2="34" /><circle cx="100" cy="100" r="9" /></g>
              </svg>
              <div className="sc-num"><b data-testid="stereo-pct">{shown}%</b><span>{t("sp.partita")}</span></div>
            </div>
            {on && <div className="aw-stamp sc-v" data-testid="stereo-verdict"><span className="aw-k">{t(`sc.f${fascia(g.pct)}`)}</span></div>}
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
                {uvb && <p className="sc-uvb-v" data-testid="stereo-uvb-verdetto">{t(uvb)}</p>}
              </div>
            )}
          </>
        )}
        <button className="bt mus aw-btn" onClick={onDone} data-testid="stereo-next">{t("aw.avanti")}</button>
      </div>
    </div>
  );
}
