import GameIcon from "./GameIcon.tsx";
import { Disc } from "../ui.tsx";
import { t, ts } from "../lib/testi.ts";
import { stereoRows } from "../lib/stereo.ts";
import type { GameState } from "@gdt/game-engine";

/** Fine partita: quanta parte dei voti di ognuno (bot compresi) si spiega col luogo comune su ruolo o aspetto. Stima della stanza, non una prova delle intenzioni. */
export default function StereoPanel({ stereo, players, onClose }: { stereo: GameState["stereo"] | null | undefined; players: { id: string; name: string; color: string }[]; onClose: () => void }) {
  const { rows, caso } = stereoRows(stereo, players.map((p) => p.id)), by = new Map(players.map((p) => [p.id, p]));
  return (
    <div className="zoom on" role="dialog" aria-label={ts("sp.titolo")} data-testid="stereo-panel" onClick={onClose}>
      <div className="sheet sp" style={{ position: "absolute" }} onClick={(e) => e.stopPropagation()}>
        <h3><GameIcon name="maschere" size={28} /> {t("sp.titolo")}</h3>
        <p className="sp-sub">{t("sp.sotto")}</p>
        {rows.length === 0 && <p className="sp-sub">{t("sp.vuoto")}</p>}
        {rows.map((r) => (
          <div className="sp-row" key={r.id} data-testid="stereo-row">
            <span className="sp-name"><Disc color={by.get(r.id)?.color ?? "#999"} />{by.get(r.id)?.name ?? "?"}</span>
            <div className="sp-bar"><u style={{ width: `${r.pct}%` }} /></div>
            <b>{r.pct}%</b><small>{ts("sp.riga", { s: r.s, n: r.n })}</small>
          </div>
        ))}
        {caso !== null && rows.length > 0 && <p className="sp-caso" data-testid="stereo-caso">{ts("sp.caso", { pct: caso })}</p>}
        <button className="bt pap sm" onClick={onClose} data-testid="stereo-close">{t("sp.chiudi")}</button>
      </div>
    </div>
  );
}
