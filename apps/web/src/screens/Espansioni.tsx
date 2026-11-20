import { useState } from "react";
import type { CSSProperties } from "react";
import { Stage, Btn, navigate } from "../ui.tsx";
import Scatola from "../components/Scatola.tsx";
import { t, ts } from "../lib/testi.ts";
import { ESP_LIVELLI, PAGAMENTI_ATTIVI, urlCarta, urlCarte, useCatalogo, useCollezione } from "../lib/espansioni.ts";
import type { EspLivello } from "../lib/espansioni.ts";
import type { TestoKey } from "../lib/testi.ts";
import type { Mazzo } from "../lib/espansioni.ts";

/** Pagina «Espansioni»: i mazzi tematici su un ripiano; un tocco apre il foglio con anteprima e acquisto. */
export default function Espansioni() {
  const cat = useCatalogo(), col = useCollezione(), [aperto, setAperto] = useState<string | null>(null);
  const mazzi = cat?.mazzi ?? [], m = mazzi.find((x) => x.id === aperto) ?? null, n = col.tuoi.length;
  return (
    <Stage bg="sky" testId="espansioni">
      <div className="esp">
        <div className="esp-top">
          <button className="chip esp-chip" onClick={() => navigate("/")} data-testid="esp-indietro">{t("esp.indietro")}</button>
          <span className="chip" data-testid="esp-conteggio">{n === 0 ? ts("esp.chip.zero") : n === 1 ? ts("esp.chip.uno") : ts("esp.chip.molti", { n })}</span>
        </div>
        <h2 className="esp-h"><small>{t("esp.sotto")}</small>{t("esp.titolo")}</h2>
        {!cat && <p className="esp-msg" role="status">{t("esp.carico")}</p>}
        <div className="esp-shelf">
          {mazzi.map((x) => <Cella key={x.id} m={x} mio={col.haMazzo(x.id)} usa={col.usa(x.id)} onOpen={() => setAperto(x.id)} onUsa={() => col.commuta(x.id)} />)}
          {cat && <div className="esp-next" data-testid="esp-prossimo"><b>{t("esp.prossimo")}</b><span>{t("esp.prossimo.sub")}</span></div>}
        </div>
      </div>
      {m && <Foglio m={m} mio={col.haMazzo(m.id)} usa={col.usa(m.id)} liv={col.livello(m.id)} onLiv={(l) => col.setLivello(m.id, l)} onClose={() => setAperto(null)} onCompra={() => col.sblocca(m.id)} onBlocca={() => col.blocca(m.id)} onUsa={() => col.commuta(m.id)} />}
    </Stage>
  );
}

function Interruttore({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`esp-sw${on ? " on" : ""}`} onClick={(e) => { e.stopPropagation(); onClick(); }} data-testid="esp-usa" />;
}

function Cella({ m, mio, usa, onOpen, onUsa }: { m: Mazzo; mio: boolean; usa: boolean; onOpen: () => void; onUsa: () => void }) {
  return (
    <div className="esp-cell" data-testid={`esp-mazzo-${m.id}`}>
      <button type="button" className="esp-box" onClick={onOpen} aria-label={ts("esp.apri", { nome: m.nome })}>
        <Scatola nome={m.nome} colore={m.colore} carte={urlCarte(m, m.scatola)} scala={0.74} />
        {mio ? <span className="esp-badge ok">{ts("esp.tuo")}</span> : m.novita ? <span className="esp-badge new">{ts("esp.novita")}</span> : null}
      </button>
      <div className="esp-nm">{m.nome}</div>
      <div className="esp-row">
        {mio ? <><span>{ts("esp.usa")}</span><Interruttore on={usa} onClick={onUsa} label={ts("esp.usa")} /></>
          : <><span>{ts("esp.carte", { n: m.personaggi + m.frasi })}</span><span className="esp-price">{m.prezzo}</span></>}
      </div>
    </div>
  );
}

function Foglio({ m, mio, usa, liv, onLiv, onClose, onCompra, onBlocca, onUsa }: { m: Mazzo; mio: boolean; usa: boolean; liv: EspLivello; onLiv: (l: EspLivello) => void; onClose: () => void; onCompra: () => void; onBlocca: () => void; onUsa: () => void }) {
  const tutte = Array.from({ length: m.carte }, (_, i) => i + 1);
  return (
    <div className="esp-over" data-testid="esp-foglio">
      <div className="esp-veil" onClick={onClose} />
      <div className="esp-sheet" role="dialog" aria-label={m.nome} style={{ "--a": m.colore } as CSSProperties}>
        <button type="button" className="esp-grab" onClick={onClose} aria-label={ts("esp.chiudi")} />
        <div className="esp-head">
          <div><span className="esp-lb">{t("esp.espansione")}</span><b className="esp-tit">{m.nome}</b>
            <span className="esp-meta">{ts("esp.meta", { p: m.personaggi, f: m.frasi })}</span></div>
          {mio ? <span className="esp-badge ok">{ts("esp.tuo")}</span> : <span className="esp-price big">{m.prezzo}</span>}
        </div>
        <p className="esp-desc">{m.descrizione}</p>
        <div className="esp-mini" data-testid="esp-carte">
          {tutte.map((n) => { const chiusa = !mio && n > m.anteprima; return <i key={n} className={chiusa ? "lk" : ""} style={{ backgroundImage: `url(${urlCarta(m, n)})` }} aria-label={m.nomi?.[n - 1] ?? ts("esp.aria.carta", { n })} />; })}
        </div>
        {!mio && <p className="esp-nota">{ts("esp.anteprima", { n: m.anteprima, tot: m.carte })}</p>}
        <div className="esp-phr"><small>{t("esp.frase")}</small>{m.esempio}</div>
        {mio ? (
          <div className="esp-own">
            <label className="esp-usarow"><span>{t("esp.usa")}</span><Interruttore on={usa} onClick={onUsa} label={ts("esp.usa")} /></label>
            <div className="esp-liv in" role="radiogroup" aria-label={ts("esp.liv.aria", { nome: m.nome })} data-testid="esp-liv">
              <span>{t("esp.liv")}</span>
              {ESP_LIVELLI.map((l) => <button key={l} type="button" role="radio" aria-checked={liv === l} className={liv === l ? "on" : ""} onClick={() => onLiv(l)} data-testid={`esp-liv-${l}`}>{t(`esp.liv.${l}` as TestoKey)}</button>)}
            </div>
            <p className="esp-nota">{ts(`esp.liv.nota.${liv}` as TestoKey, { c: m.personaggi })}</p>
            {!PAGAMENTI_ATTIVI && <button type="button" className="esp-link" onClick={onBlocca} data-testid="esp-blocca">{t("esp.blocca")}</button>}
          </div>
        ) : (
          <>
            <Btn kind="red" onClick={onCompra} testId="esp-compra" style={{ fontSize: 22 }}>{t("esp.compra", { prezzo: m.prezzo })}<small>{t("esp.compra.nota")}</small></Btn>
            {!PAGAMENTI_ATTIVI && <p className="esp-prova" data-testid="esp-prova">{t("esp.prova")}</p>}
          </>
        )}
        <Btn kind="pap" onClick={onClose} style={{ fontSize: 17, padding: "9px 6px", marginTop: 10, width: "100%" }} testId="esp-chiudi">{t("esp.chiudi")}</Btn>
      </div>
    </div>
  );
}
