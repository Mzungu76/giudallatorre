import GameIcon from "./GameIcon.tsx";
import { t, ts } from "../lib/testi.ts";
import { stereoGame } from "../lib/stereo.ts";
import type { GameState } from "@gdt/game-engine";

/** Fine partita: quanto hanno pesato i luoghi comuni in QUESTA partita (voti di tutti, nessun nome), con il riferimento «a caso» e i più presenti. Stima della stanza. */
export default function StereoPanel({ stereo, onClose }: { stereo: GameState["stereo"] | null | undefined; onClose: () => void }) {
  const g = stereoGame(stereo);
  return (
    <div className="zoom on" role="dialog" aria-label={ts("sp.titolo")} data-testid="stereo-panel" onClick={onClose}>
      <div className="sheet sp" style={{ position: "absolute" }} onClick={(e) => e.stopPropagation()}>
        <h3><GameIcon name="maschere" size={28} /> {t("sp.titolo")}</h3>
        <p className="sp-sub">{t("sp.sotto")}</p>
        {!g && <p className="sp-sub">{t("sp.vuoto")}</p>}
        {g && (
          <>
            <div className="sp-big" data-testid="stereo-pct"><b>{g.pct}%</b><span>{t("sp.partita")}</span></div>
            <div className="sp-bar"><u style={{ width: `${g.pct}%` }} /></div>
            <div className="sp-row2"><span>{t("sp.caso")}</span><b data-testid="stereo-caso">{g.caso}%</b></div>
            <div className="sp-bar sp-bar2"><u style={{ width: `${g.caso}%` }} /></div>
            {g.top.length > 0 && <h4>{t("sp.piu")}</h4>}
            {g.top.map((x) => <div className="sp-top" key={x.k} data-testid="stereo-top"><span>{x.k}</span><b>{ts("sp.voti", { n: x.n })}</b></div>)}
            {g.top.length > 0 && <p className="sp-q">{t("sp.domanda")}</p>}
          </>
        )}
        <button className="bt pap sm" onClick={onClose} data-testid="stereo-close">{t("sp.chiudi")}</button>
      </div>
    </div>
  );
}
