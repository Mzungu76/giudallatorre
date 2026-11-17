import { useEffect, useState } from "react";
import type { GameState } from "@gdt/game-engine";
import { Gauge, useContaSu } from "./StereoScene.tsx";
import { Who } from "./Persona.tsx";
import { PtIcon } from "./Pt.tsx";
import { useStage } from "../ui.tsx";
import { sfx } from "../lib/sfx.ts";
import { t, ts } from "../lib/testi.ts";
import { fasciaPregiudizio as fascia, fraseLuogo, stereoGame, stereoGruppi } from "../lib/stereo.ts";
import { cardFull } from "../lib/cards.ts";
import type { FinalRow } from "./FinalScene.tsx";

const PASSO = 330;   // ms tra un riquadro e il successivo (a scena rimpicciolita)
const ATTESA = 850;

/** Riepilogo di fine partita: sotto la torre rimpicciolita, in due colonne, classifica, Pregiudiziometro, luogo comune, miglior lancio, umani contro bot.
 *  I riquadri compaiono uno alla volta con un effetto «pop»; quelli senza dati non ci sono. */
export default function Riepilogo({ rows, winners, stereo, isBot, sound, onShare, sharing }: { rows: FinalRow[]; winners: Set<string>; stereo: GameState["stereo"] | null | undefined; isBot: (id: string) => boolean; sound: boolean; /** Condividi la copertina del rotocalco. */ onShare?: () => void; sharing?: boolean }) {
  const { H } = useStage(), top = Math.round(H * 0.25) + 42, g = stereoGame(stereo), gr = stereoGruppi(stereo, isBot), [n, setN] = useState(0), [on, setOn] = useState(false);
  const uvb = gr.umani !== null && gr.bot !== null;
  const blocchi = ["rank", ...(g ? ["gauge"] : []), ...(g?.top[0] ? ["luogo"] : []), ...(g?.lancio ? ["lancio"] : []), ...(uvb ? ["uvb"] : [])];
  const tot = blocchi.length;
  useEffect(() => {
    const tm: ReturnType<typeof setTimeout>[] = [];
    for (let k = 1; k <= tot; k++) tm.push(setTimeout(() => { setN(k); sfx.stamp(sound); if (blocchi[k - 1] === "gauge") setTimeout(() => setOn(true), 250); }, ATTESA + (k - 1) * PASSO));
    return () => tm.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useContaSu(g?.pct, on);
  const vis = (k: string) => blocchi.indexOf(k) < n && blocchi.includes(k);
  const diff = uvb ? gr.umani! - gr.bot! : 0, verd = diff > 5 ? "sc.uvb.u" : diff < -5 ? "sc.uvb.b" : "sc.uvb.p";
  return (
    <div className="rp" style={{ top }} data-testid="riepilogo">
      {vis("rank") && <div className="rp-b rp-rank" data-testid="final-rank"><h4>{t("rp.classifica")}</h4>
        {rows.map((r, i) => <div key={r.id} className={`rp-row ${winners.has(r.id) ? "win" : ""}`}><b>{i + 1}</b><Who id={r.id}><i style={{ background: r.color }} /><span>{r.name}</span></Who><u><PtIcon s={13} /> {r.score}</u></div>)}</div>}
      {g && vis("gauge") && <div className="rp-b rp-g"><Gauge pct={g.pct} on={on} shown={shown} />{on && <div className="rp-verd">{t(`sc.f${fascia(g.pct)}`)}</div>}</div>}
      {g?.top[0] && vis("luogo") && (
        <div className="rp-b sc-lc rp-lc" data-testid="stereo-top"><h4>{t("sc.top")}</h4><div className="rp-k">{fraseLuogo(g.top[0].k)} <span className="rp-pct">{g.top[0].pct}%</span></div>{g.top.slice(1).map((x) => <div key={x.k} className="rp-alt">{fraseLuogo(x.k)} · {x.pct}%</div>)}{g.comune && <div className="rp-alt rp-com">{t("lc.tra")} {fraseLuogo(g.comune.k)} · {g.comune.pct}%</div>}
          {onShare && <button className="rp-cop" disabled={sharing} onClick={onShare} data-testid="share-rotocalco">{sharing ? t("rot.cond.carico") : t("rot.condividi")}</button>}</div>)}
      {g?.lancio && vis("lancio") && <div className="rp-b rp-lan" data-testid="stereo-lancio"><h4>{t("sc.lancio")}</h4><div className="rp-lr"><img src={cardFull(g.lancio.cardId)} alt="" draggable={false} /><div><b>{ts("sc.lancio.voti", { ruolo: g.lancio.ruolo, n: g.lancio.n })}</b><q>{g.lancio.text}</q></div></div></div>}
      {uvb && vis("uvb") && <div className={`rp-b rp-uvb ${g?.lancio ? "" : "full"}`} data-testid="stereo-uvb"><h4>{t("sc.uvb")}</h4>
        {([["sc.umani", gr.umani, "sc-u"], ["sc.bot", gr.bot, "sc-b"]] as const).map(([k, v, c]) => <div className="rp-uv" key={k}><span>{t(k)}</span><b>{v}%</b><div className="sc-bar"><u className={c} style={{ width: `${v}%` }} /></div></div>)}
        <p className="rp-uvv">{t(verd)}</p></div>}
    </div>
  );
}
