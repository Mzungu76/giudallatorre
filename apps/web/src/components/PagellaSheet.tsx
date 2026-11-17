import { useEffect, useRef, useState } from "react";
import type { GameState } from "@gdt/game-engine";
import { Gauge, useContaSu } from "./StereoScene.tsx";
import { sfx } from "../lib/sfx.ts";
import { t, ts } from "../lib/testi.ts";
import { fasciaPregiudizio as fascia, stereoGame, stereoGruppi } from "../lib/stereo.ts";
import { cardFull } from "../lib/cards.ts";
import type { FinalRow } from "./FinalScene.tsx";

const DURATA = 3800;   // quanto resta ogni scheda prima di passare alla successiva

/** Pannello che sale sulla torre a fine partita: classifica compatta fissa in alto e, sotto, le schede della pagella
 *  (Pregiudiziometro, luogo comune e miglior lancio, umani contro bot) che scorrono da sole. Le schede senza dati si saltano.
 *  Si chiude da solo dopo l'ultima; un tocco sulla scheda passa alla successiva. */
export default function PagellaSheet({ rows, stereo, isBot, sound, onDone, onShare, sharing }: { /** Condividi la copertina del rotocalco (sulla scheda del luogo comune). */ onShare?: () => void; sharing?: boolean; rows: FinalRow[]; stereo: GameState["stereo"] | null | undefined; isBot: (id: string) => boolean; sound: boolean; onDone: () => void }) {
  const g = stereoGame(stereo), gr = stereoGruppi(stereo, isBot);
  const schede: ("pregiudizio" | "luogo" | "umaniBot")[] = [];
  if (g) { schede.push("pregiudizio"); if (g.top[0] || g.lancio) schede.push("luogo"); if (gr.umani !== null && gr.bot !== null) schede.push("umaniBot"); }
  const [i, setI] = useState(0), [su, setSu] = useState(false), tm = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shown = useContaSu(g?.pct, su && schede[i] === "pregiudizio");
  useEffect(() => { const a = setTimeout(() => { setSu(true); sfx.whoosh(sound); }, 120); return () => clearTimeout(a); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const avanti = () => { if (i + 1 >= schede.length) onDone(); else setI(i + 1); };
  useEffect(() => {
    if (!su || !schede.length) return undefined;
    tm.current = setTimeout(avanti, DURATA);
    return () => { if (tm.current) clearTimeout(tm.current); };
  }, [i, su]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!schede.length) onDone(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!schede.length || !g) return null;
  const sc = schede[i]!, diff = gr.umani !== null && gr.bot !== null ? gr.umani - gr.bot : 0, uvb = diff > 5 ? "sc.uvb.u" : diff < -5 ? "sc.uvb.b" : "sc.uvb.p";
  return (
    <div className={`pg ${su ? "su" : ""}`} data-testid="pagella" onClick={(e) => e.stopPropagation()}>
      <div className="pg-grip" />
      <div className="pg-rank" data-testid="pagella-rank">
        {rows.map((r, k) => <span key={r.id} className="pg-r"><b>{ts("pg.pos", { n: k + 1 })}</b><i style={{ background: r.color }} />{r.name}<u>{r.score}</u></span>)}
      </div>
      <div className="pg-card" key={sc} onClick={avanti} data-testid={`pagella-${sc}`}>
        {sc === "pregiudizio" && <><Gauge pct={g.pct} on={su} shown={shown} /><div className="pg-verd">{t(`sc.f${fascia(g.pct)}`)}</div></>}
        {sc === "luogo" && <>
          {g.top[0] && <div className="sc-blk sc-lc pg-b"><h4>{t("sc.top")}</h4><div className="sc-lc-k">{g.top[0].k}</div><small>{g.top[0].n === 1 ? ts("sp.voto1") : ts("sp.voti", { n: g.top[0].n })}</small></div>}
          {g.lancio && <div className="sc-blk sc-lan pg-b"><h4>{t("sc.lancio")}</h4><div className="sc-lan-r"><img src={cardFull(g.lancio.cardId)} alt="" draggable={false} /><div><b>{ts("sc.lancio.voti", { ruolo: g.lancio.ruolo, n: g.lancio.n })}</b><q>{g.lancio.text}</q></div></div></div>}
          {onShare && <button className="bt pap pg-cop" disabled={sharing} onClick={(e) => { e.stopPropagation(); onShare(); }} data-testid="share-rotocalco">{sharing ? t("rot.cond.carico") : t("rot.condividi")}</button>}
        </>}
        {sc === "umaniBot" && <div className="sc-blk sc-uvb pg-b"><h4>{t("sc.uvb")}</h4>
          {([["sc.umani", gr.umani, "sc-u"], ["sc.bot", gr.bot, "sc-b"]] as const).map(([k, v, c]) => <div className="sc-uv" key={k}><span>{t(k)}</span><div className="sc-bar"><u className={c} style={{ width: `${v}%` }} /></div><b>{v}%</b></div>)}
          <p className="sc-uvb-v">{t(uvb)}</p></div>}
      </div>
      <div className="pg-foot">
        <div className="pg-dots">{schede.map((_, k) => <i key={k} className={k === i ? "on" : ""} />)}</div>
        <small>{t("pg.avanza")}</small>
        <button className="pg-skip" onClick={onDone} data-testid="pagella-skip">{t("pg.salta")}</button>
      </div>
    </div>
  );
}
