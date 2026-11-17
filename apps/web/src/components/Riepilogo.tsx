import { useEffect, useState } from "react";
import type { GameState } from "@gdt/game-engine";
import { Gauge, useContaSu } from "./StereoScene.tsx";
import { Who } from "./Persona.tsx";
import { PtIcon } from "./Pt.tsx";
import { sfx } from "../lib/sfx.ts";
import { t, ts } from "../lib/testi.ts";
import { fasciaPregiudizio as fascia, aspettoDi, fraseLuogo, stereoGame, stereoGruppi } from "../lib/stereo.ts";
import { battutaRiga, carteLuoghi, commentoLancio, premi, rigaGauge, titoloVincitori } from "../lib/riepilogo.ts";
import { cardFull } from "../lib/cards.ts";
import type { FinalRow } from "./FinalScene.tsx";

const PASSO = 330;   // ms tra un riquadro e il successivo
const ATTESA = 700;

/** Riepilogo di fine partita a tutto schermo: classifica (con la torre come icona e una battuta per ognuno), quadrante e miglior lancio, il luogo comune con le carte,
 *  i badge, umani contro bot. I riquadri compaiono uno alla volta con un effetto «pop»; quelli senza dati non ci sono. */
export default function Riepilogo({ rows, winners, stereo, isBot, sound, seme, onDettagli }: { /** Apre il foglio «Come l'abbiamo finalmente capito». */ onDettagli?: (g: NonNullable<ReturnType<typeof stereoGame>>) => void; /** Per far variare i titoli da una partita all'altra. */ seme: string; rows: FinalRow[]; winners: Set<string>; stereo: GameState["stereo"] | null | undefined; isBot: (id: string) => boolean; sound: boolean }) {
  const g = stereoGame(stereo), gr = stereoGruppi(stereo, isBot), [n, setN] = useState(0), [on, setOn] = useState(false);
  const uvb = gr.umani !== null && gr.bot !== null, badge = g ? premi(g) : [];
  const blocchi = ["rank", ...(g ? ["gauge"] : []), ...(g?.top[0] ? ["luogo"] : []), ...(badge.length ? ["badge"] : []), ...(uvb ? ["uvb"] : [])];
  const tot = blocchi.length;
  useEffect(() => {
    const tm: ReturnType<typeof setTimeout>[] = [];
    for (let k = 1; k <= tot; k++) tm.push(setTimeout(() => { setN(k); sfx.stamp(sound); if (blocchi[k - 1] === "gauge") setTimeout(() => setOn(true), 250); }, ATTESA + (k - 1) * PASSO));
    return () => tm.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useContaSu(g?.pct, on);
  const vis = (k: string) => blocchi.indexOf(k) < n && blocchi.includes(k);
  const diff = uvb ? gr.umani! - gr.bot! : 0, verd = diff > 5 ? "sc.uvb.u" : diff < -5 ? "sc.uvb.b" : "sc.uvb.p", fa = g ? fascia(g.pct) : 0;
  const nomiVincitori = rows.filter((r) => winners.has(r.id)).map((r) => r.name), carte = g ? carteLuoghi(g) : [];
  return (
    <div className="rp" data-testid="riepilogo">
      {vis("rank") && <div className="rp-b rp-cl" data-testid="final-rank"><img className="rp-tw" src="/giocatori/torre.webp" alt="" draggable={false} />
        <div className="rp-win">{titoloVincitori(nomiVincitori, seme)}</div>
        {rows.map((r, i) => <div key={r.id} className={`rp-row ${winners.has(r.id) ? "win" : ""}`}><b>{i + 1}</b><Who id={r.id}><i style={{ background: r.color }} /><span>{r.name}<em>{battutaRiga(rows, i, winners)}</em></span></Who><u><PtIcon s={14} /> {r.score}</u></div>)}</div>}
      {g && (vis("gauge")) && (
        <div className="rp-two">
          <div className="rp-b rp-g"><Gauge pct={g.pct} on={on} shown={shown} />{on && <><div className="rp-verd">{t(`sc.f${fa}`)}</div><div className="rp-sub">{rigaGauge(fa)}</div></>}</div>
          {g.lancio ? <div className="rp-b rp-lan" data-testid="stereo-lancio"><h4>{t("sc.lancio")}</h4><div className="rp-lr"><img src={cardFull(g.lancio.cardId)} alt="" draggable={false} /><b>{ts("sc.lancio.voti", { ruolo: g.lancio.ruolo, n: g.lancio.n })}</b></div><q>{g.lancio.text}</q><div className="rp-sub">{commentoLancio(g.lancio.cardId)}</div></div> : <div />}
        </div>
      )}
      {g?.top[0] && vis("luogo") && (
        <div className="rp-b rp-lc" data-testid="stereo-top"><h4>{t("sc.top")}</h4><div className="rp-k">{fraseLuogo(g.top[0].k)} <span className="rp-pct">{g.top[0].pct}%</span></div>
          {carte.length > 0 && <div className="rp-ct">{carte.map((id) => <img key={id} src={cardFull(id)} alt="" draggable={false} />)}</div>}
          {g.top.slice(1).map((x, i) => <div key={x.k} className="rp-alt">{ts(`rp.alt.${i + 1}` as "rp.alt.1", { frase: fraseLuogo(x.k), pct: x.pct })}</div>)}
          {g.comune && <div className="rp-alt rp-com">{ts("lc.tra.riga", { n: g.comune.n, tot: g.comune.tot, chi: aspettoDi(g.comune.k) })}</div>}
          {onDettagli && <button className="rp-det" onClick={() => onDettagli(g)} data-testid="dettagli-btn">{t("dt.btn")}</button>}
        </div>
      )}
      {badge.length > 0 && vis("badge") && <div className="rp-bd" data-testid="badge">{badge.map((b) => <div key={b.ruolo}><span className="rib">{b.titolo}</span>{b.carta && <img src={cardFull(b.carta)} alt="" draggable={false} />}<small>{b.riga}</small></div>)}</div>}
      {uvb && vis("uvb") && <div className="rp-b" data-testid="stereo-uvb">
        <div className="rp-uvr">{([["sc.umani", gr.umani, "sc-u"], ["sc.bot", gr.bot, "sc-b"]] as const).map(([k, v, c]) => <div className="rp-uv" key={k}><span>{t(k)}</span><b>{v}%</b><div className="sc-bar"><u className={c} style={{ width: `${v}%` }} /></div></div>)}</div>
        <p className="rp-uvv" data-testid="stereo-uvb-verdetto">{t(verd)}</p></div>}
    </div>
  );
}
