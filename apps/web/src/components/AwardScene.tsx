import { useEffect, useRef, useState } from "react";
import type { Award } from "@gdt/game-engine";
import { cardUrl } from "../lib/characters.ts";
import { sfx } from "../lib/sfx.ts";
import { useStage } from "../ui.tsx";
import { t as tx, ts as txs } from "../lib/testi.ts";

/** Battuta in base alla fascia d'età del gruppo: 6+ e 10+ morbida, 14+ pungente, 18+ cattiva. */
export const toneOf = (age: number | undefined): "b6" | "b14" | "b18" => (age !== undefined && age >= 18 ? "b18" : age !== undefined && age >= 14 ? "b14" : "b6");

/** Scena del premio della serata: busta che dondola → timbro, vincitore, numero che lo motiva e battuta. Un tocco passa alla classifica. */
export default function AwardScene({ award, winner, age, sound, readOnly, onDone }: { award: Award; winner: { name: string; color: string }; age?: number; sound: boolean; readOnly?: boolean; onDone: () => void }) {
  const { H } = useStage(), [open, setOpen] = useState(false), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reveal = () => { if (open) return; setOpen(true); sfx.stamp(sound); setTimeout(() => sfx.fanfare(sound), 500); };
  useEffect(() => {
    sfx.drum(sound, 1.2);
    if (readOnly) timer.current = setTimeout(reveal, 4000); // schermo condiviso: nessuno tocca, si apre da sola
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const vars = { n: award.n, of: award.of }, tone = toneOf(age), id = award.id;
  const cw = Math.round(Math.max(118, Math.min(176, H * 0.2)));
  return (
    <div className="aw" data-testid="award">
      <div className="stbd-sky" /><div className="stbd-rays" />
      {!open ? (
        <div className="aw-box" data-testid="award-wait">
          <div className="aw-top"><div className="aw-t">{tx("aw.titolo")}</div><div className="aw-s">{tx("aw.sotto")}</div></div>
          <div className="aw-drum"><span>{tx("aw.drum")}</span></div>
          <div className="aw-env"><b>?</b></div>
          <div className="aw-dots"><i /><i /><i /></div>
          {!readOnly && <button className="bt mus aw-btn" onClick={reveal} data-testid="award-open">{tx("aw.apri")}</button>}
        </div>
      ) : (
        <div className="aw-box" data-testid="award-shown">
          {Array.from({ length: 24 }, (_, i) => <i key={i} className="aw-conf" style={{ left: `${(i * 37) % 100}%`, background: ["#e8362b", "#ffc72c", "#14a3a1", "#ff7aa8", "#fff"][i % 5], animationDelay: `${-((i * 0.43) % 5)}s`, animationDuration: `${4 + (i % 4)}s` }} />)}
          <div className="aw-stamp"><span className="aw-k">{tx("aw.kicker")}</span><div className={`aw-n ${txs(`premio.${id}.nome`).length > 14 ? "long" : ""}`}>{tx(`premio.${id}.nome`)}</div></div>
          <div className="aw-hero" style={{ width: cw }}>
            <img src={cardUrl(winner.color)} alt="" draggable={false} />
            <div className="aw-num"><div><b>{tx(`premio.${id}.big`, vars)}</b><small>{tx(`premio.${id}.lab`)}</small></div></div>
          </div>
          <div className="aw-who"><span>{winner.name}</span></div>
          <div className="aw-quip pp" data-testid="award-text">
            <p className="aw-note">{tone === "b18" ? tx(`premio.${id}.b18`) : tone === "b14" ? tx(`premio.${id}.b14`) : tx(`premio.${id}.b6`)}</p>
            <p className="aw-why">{tx(`premio.${id}.why`, vars)}</p>
          </div>
          <button className="bt mus aw-btn" onClick={onDone} data-testid="award-next">{tx("aw.avanti")}</button>
        </div>
      )}
    </div>
  );
}
