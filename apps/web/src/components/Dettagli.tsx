import { fraseLuogo, type StereoGame } from "../lib/stereo.ts";
import { cardFull } from "../lib/cards.ts";
import { t, ts } from "../lib/testi.ts";

/** Numero con la virgola e al massimo un decimale: 2,5. */
const n1 = (x: number): string => String(Math.round(x * 10) / 10).replace(".", ",");

/** Foglio «Dettagli»: per ogni luogo comune da dove viene il suo peso, i personaggi coinvolti, la caratteristica comune e quanto è solida la stima. Mai nomi di giocatori. */
export default function Dettagli({ g, onClose }: { g: StereoGame; onClose: () => void }) {
  const solida = g.votiLuoghi < 4 ? "dt.s0" : g.votiLuoghi < 8 ? "dt.s1" : "dt.s2";
  return (
    <div className="shm" data-testid="dettagli" onClick={onClose}>
      <div className="shm-box dt-box" onClick={(e) => e.stopPropagation()}>
        <div className="shm-t">{t("dt.titolo")}</div>
        <div className="dt-scroll">
          {g.top.map((x) => {
            const d = x.det, carte = d ? Object.entries(d.c).sort((a, b) => b[1] - a[1]).slice(0, 4) : [];
            return (
              <div className="dt-b" key={x.k} data-testid="dettagli-luogo">
                <h4>{fraseLuogo(x.k)} <span className="rp-pct">{x.pct}%</span></h4>
                {d && <p className="dt-o"><b>{t("dt.origine")}:</b> {[d.v > 0 ? ts("dt.voti", { n: n1(d.v) }) : "", d.m > 0 ? ts("dt.segnalino", { n: n1(d.m) }) : "", d.e > 0 ? ts("dt.evitato", { n: n1(d.e) }) : ""].filter(Boolean).join(" · ") || t("dt.nessun")}</p>}
                {carte.length > 0 && <div className="dt-c"><b>{t("dt.personaggi")}:</b><div>{carte.map(([id, n]) => <span key={id}><img src={cardFull(id)} alt="" draggable={false} />{n > 1 && <em>×{n}</em>}</span>)}</div></div>}
              </div>
            );
          })}
          {g.comune && <div className="dt-b" data-testid="dettagli-comune"><h4>{t("dt.comune")}</h4><p className="dt-o">{ts("dt.comune.riga", { chi: fraseLuogo(g.comune.k), n: g.comune.n, tot: g.comune.tot, pct: g.comune.pct })}</p></div>}
          <div className="dt-b" data-testid="dettagli-solida"><h4>{t("dt.solida")}</h4><p className="dt-o">{ts(solida, { n: n1(g.votiLuoghi) })}</p><small>{t("dt.nota")}</small></div>
        </div>
        <button className="shm-x" onClick={onClose}>{t("sm.chiudi")}</button>
      </div>
    </div>
  );
}
