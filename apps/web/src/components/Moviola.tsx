import { useState } from "react";
import type { StereoScena } from "@gdt/game-engine";
import { cardFull } from "../lib/cards.ts";
import { tokenUrl } from "../lib/characters.ts";
import { t, ts } from "../lib/testi.ts";

/** Il turno che ha generato un luogo comune, a fine partita: lo stato finale in una sola immagine, con la grafica dei turni: le carte sulla torre con il numero, le pedine di chi ha votato sotto ogni carta,
 *  il segnalino del Megafono e la freccia rossa sulle carte cadute. Le carte dell'accusa hanno l'anello giallo. `k` è il luogo comune, `scene` i turni che lo hanno generato. */
export default function Moviola({ k, scene, persona, onChiudi }: { k: string; scene: StereoScena[]; persona: (id: string) => { name: string; color: string }; onChiudi: () => void }) {
  const [si, setSi] = useState(0), sc = scene[si] ?? scene[0];
  if (!sc) return null;
  const caldi = new Set(sc.c.filter((c) => c.k === k).map((c) => c.p)), cade = new Set(sc.f), tot = scene.length;
  return (
    <div className="mv" data-testid="moviola">
      <div className="mv-h"><b>{t("mv.titolo")}</b>{tot > 1 && <button className="mv-sc" onClick={() => setSi((si + 1) % tot)}>{ts("mv.scena", { n: si + 1, tot })}</button>}</div>
      <p className="mv-fr" data-testid="moviola-frase">{sc.t.replace(/\.$/, "")}</p>
      <div className="mv-cards">
        {sc.c.map((c) => {
          const voti = Object.entries(sc.v).filter(([, p]) => p === c.p), seg = sc.m.find((m) => m.p === c.p);
          return (
            <div key={c.p} className="mv-c">
              <span className={`ex-th ${caldi.has(c.p) ? "ring" : ""}`} style={{ backgroundImage: `url(${cardFull(c.id)})` }}>
                <i>{c.p}</i>
                {cade.has(c.p) && <><b className="rs-tint" /><svg className="mv-arrow" viewBox="0 0 60 70" aria-hidden><path d="M18 2h24v34h14L30 66 4 36h14z" fill="#e8362b" stroke="#fff" strokeWidth="5" strokeLinejoin="round" /><path d="M18 2h24v34h14L30 66 4 36h14z" fill="none" stroke="#13224a" strokeWidth="2.4" strokeLinejoin="round" /></svg></>}
                {seg && <u className={`mv-seg ${seg.e}`}>{seg.e === "cade" ? "CADE" : seg.e === "noncade" ? "NON CADE" : "NULLI"}</u>}
              </span>
              <div className="ex-votes">{voti.map(([pid]) => { const pe = persona(pid); return <i key={pid} className="ex-tk" title={pe.name} style={{ width: 22, height: 22, backgroundImage: `url(${tokenUrl(pe.color)})` }} />; })}</div>
            </div>
          );
        })}
      </div>
      <p className="mv-leg">{t("mv.legenda")}</p>
      <button className="mv-x" onClick={onChiudi}>{t("mv.chiudi")}</button>
    </div>
  );
}
