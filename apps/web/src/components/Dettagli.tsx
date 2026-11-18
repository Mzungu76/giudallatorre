import { aspettoDi, fraseLuogo, type StereoGame } from "../lib/stereo.ts";
import { chiusaAggravante, ruoloDelLuogo, testimone } from "../lib/riepilogo.ts";
import { cardFull } from "../lib/cards.ts";
import Moviola from "./Moviola.tsx";
import { useState } from "react";
import { t, ts } from "../lib/testi.ts";

/** Numero con la virgola e al massimo un decimale: 2,5. */
const n1 = (x: number): string => String(Math.round(x * 10) / 10).replace(".", ",");

/** Foglio «Come l'abbiamo finalmente capito»: il processo ai luoghi comuni. Per ognuno le prove (voti, segnalino, chi ha votato altrove), il testimone (il personaggio che si difende),
 *  l'aggravante (la caratteristica comune) e quanto è attendibile la stima. Mai nomi di giocatori. */
export default function Dettagli({ g, persona, onClose }: { g: StereoGame; /** Nome e colore di un giocatore (per le pedine della moviola). */ persona: (id: string) => { name: string; color: string }; onClose: () => void }) {
  const [aperta, setAperta] = useState<string | null>(null);
  const solida = g.votiLuoghi < 4 ? "dt.s0" : g.votiLuoghi < 8 ? "dt.s1" : "dt.s2";
  return (
    <div className="shm" data-testid="dettagli" onClick={onClose}>
      <div className="shm-box dt-box" onClick={(e) => e.stopPropagation()}>
        <div className="dt-h">{t("dt.titolo")}<small>{t("dt.sub")}</small></div>
        <div className="dt-scroll">
          {g.top.map((x) => {
            const d = x.det, ruolo = ruoloDelLuogo(x.k), carta = d ? Object.entries(d.c).sort((a, b) => b[1] - a[1])[0]?.[0] : undefined;
            const prove = d ? [d.v === 1 ? ts("dt.p.v1") : d.v > 0 ? ts("dt.p.v", { n: n1(d.v) }) : "", d.m > 0 ? ts("dt.p.m", { n: n1(d.m) }) : "", d.e > 0 ? ts("dt.p.e", { n: n1(d.e) }) : ""].filter(Boolean) : [];
            return (
              <div className="dt-b" key={x.k} data-testid="dettagli-luogo">
                <h4>{ts("dt.imputati", { frase: `${fraseLuogo(x.k)} · ${x.pct}%` })}</h4>
                <p className="dt-o"><b>{t("dt.prove")}</b> {prove.length ? prove.join(" · ") : t("dt.p.nessuna")}</p>
                {carta && ruolo && <div className="dt-w"><img src={cardFull(carta)} alt="" draggable={false} /><div className="dt-fum">{testimone(ruolo)}</div></div>}
                {(() => { const sce = g.scene.filter((sc) => sc.c.some((c) => c.k === x.k)); return sce.length > 0 && (aperta === x.k
                  ? <Moviola k={x.k} peso={x.n} scene={sce} persona={persona} onChiudi={() => setAperta(null)} />
                  : <button className="dt-mv" onClick={() => setAperta(x.k)} data-testid="moviola-btn">{t("mv.btn")}</button>); })()}
              </div>
            );
          })}
          {g.comune && <div className="dt-b" data-testid="dettagli-comune"><h4>{t("dt.aggravante")}</h4><p className="dt-o">{ts("dt.agg.riga", { chi: aspettoDi(g.comune.k).replace(/^./, (c) => c.toUpperCase()), n: g.comune.n, tot: g.comune.tot, chiusa: chiusaAggravante(g.comune.k) })}</p></div>}
          <div className="dt-b" data-testid="dettagli-solida"><h4>{t("dt.attendibilita")}</h4><p className="dt-o">{ts(solida, { n: n1(g.votiLuoghi) })}</p><small>{t("dt.nota")}</small></div>
        </div>
        <button className="shm-x dt-x" onClick={onClose}>{t("dt.chiudi")}</button>
      </div>
    </div>
  );
}
