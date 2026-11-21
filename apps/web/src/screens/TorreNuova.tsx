import { useEffect, useMemo, useState } from "react";
import { nomiNoti, verificaFrase } from "@gdt/game-protocol";
import frasiBase from "../../../../content/frasi-megafono.json";
import { Stage, Btn, Toast, navigate } from "../ui.tsx";
import { Terrace } from "../components/Terrace.tsx";
import { BSheet, PhrasePill, Row } from "../components/BUi.tsx";
import { cardFull, useCards } from "../lib/cards.ts";
import { useCatalogo, useCollezione } from "../lib/espansioni.ts";
import { caricaOg, creaTorre, erroreTorre, salvaMia } from "../lib/torriUtente.ts";
import type { Effetto } from "../lib/torriUtente.ts";
import { disegnaTorre } from "../lib/torriOg.ts";
import { t, ts } from "../lib/testi.ts";
import type { TestoKey } from "../lib/testi.ts";

const ETA = [6, 10, 14, 18] as const, DURATE = ["24h", "3g", "7g"] as const, EFFETTI: Effetto[] = ["cade", "noncade", "nulli"];
const specDi = (e: Effetto) => ({ slot: "s", k: 1, pts: e === "cade" ? 4 : e === "noncade" ? 2 : 0, effect: e });
const FRASI = (frasiBase.frasi as { testo: string; verbo: string; eta: string }[]).map((f) => ({ testo: f.testo, eta: parseInt(f.eta, 10) }));

/** Creazione di una torre da condividere (docs/TORRI_UTENTE.md): carte, frase, segnalino e voto, durata. */
export default function TorreNuova() {
  const ok = useCards(), cat = useCatalogo(), col = useCollezione();
  const [step, setStep] = useState(0), [base, setBase] = useState<string[]>([]), [carte, setCarte] = useState<string[]>([]);
  const [frase, setFrase] = useState(""), [etaScelta, setEtaScelta] = useState<number>(6), [pubb, setPubb] = useState(false), [cerca, setCerca] = useState(""), [seme, setSeme] = useState(0);
  const [mark, setMark] = useState(0), [effetto, setEffetto] = useState<Effetto>("cade"), [voto, setVoto] = useState(0), [modo, setModo] = useState<"seg" | "voto">("seg");
  const [durata, setDurata] = useState<(typeof DURATE)[number]>("3g"), [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  useEffect(() => { fetch("/cards/manifest.json").then((r) => r.json() as Promise<{ id: string; overlay_of?: string }[]>).then((m) => setBase(m.filter((c) => !c.overlay_of).map((c) => c.id))).catch(() => undefined); }, []);
  const mazzi = (cat?.mazzi ?? []).filter((m) => col.haMazzo(m.id));
  const tutte = useMemo(() => [...mazzi.flatMap((m) => Array.from({ length: m.carte }, (_, i) => `${m.id}-c${String(i + 1).padStart(2, "0")}`)), ...base], [base, mazzi.map((m) => m.id).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const noti = useMemo(() => nomiNoti((cat?.mazzi ?? []).flatMap((m) => m.nomi ?? [])), [cat]);
  const v = useMemo(() => (frase.trim() ? verificaFrase(frase, 18, { nomiNoti: noti }) : null), [frase, noti]);
  const etaMin = v?.etaMin ?? 6, eta = Math.max(etaScelta, etaMin), len = frase.trim().length;
  const fraseOk = !!v && !v.vietata && len >= 8 && len <= 80 && (v.nomiSospetti.length === 0 || pubb);
  const idee = useMemo(() => { const q = cerca.trim().toLowerCase(), l = FRASI.filter((f) => !q || f.testo.includes(q)); const o = l.length ? seme % l.length : 0; return [...l.slice(o), ...l.slice(0, o)].slice(0, 5); }, [cerca, seme]);
  const toggle = (id: string) => setCarte((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length < 6 ? [...c, id] : c));
  const ready = step !== 2 || (mark > 0 && voto > 0), puoAvanti = step === 0 ? carte.length >= 3 : step === 1 ? fraseOk : step === 2 ? ready : true;
  useEffect(() => { if (mark > carte.length) setMark(0); if (voto > carte.length) setVoto(0); }, [carte.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (n: number) => { if (modo === "seg") { setMark(n); if (effetto === "nulli" && voto === n) setVoto(0); } else if (effetto === "nulli" && n === mark) setErr(ts("tu.err.nulli")); else setVoto(n); };
  const back = () => (step > 0 ? setStep(step - 1) : navigate("/"));
  async function pubblica() {
    if (busy) return; setBusy(true); setErr(null);
    try {
      const r = await creaTorre({ carte, frase, eta: eta > etaMin ? eta : undefined, personaggioPubblico: pubb, segnalino: { pos: mark, effetto }, votoAutore: voto, durata });
      salvaMia({ id: r.id, admin: r.admin, creata: Date.now(), frase });
      const verbo = /^(i più|quelli che)\s/i.test(frase.trim()) ? "salgono" : "sale";
      try { await caricaOg(r.id, r.admin, await disegnaTorre({ carte, frase: frase.trim(), verbo, eta: r.eta, chiude: r.chiude, formato: "og" })); } catch { /* l'anteprima del link userà l'icona */ }
      navigate(`/t/${r.id}`);
    } catch (e) { setErr(erroreTorre(e)); setBusy(false); }
  }
  if (step === 2) {
    const marks = mark ? [{ pos: mark, spec: specDi(effetto) as never }] : null;
    return (
      <Stage bg="sky" testId="tn-seg">
        {ok && <Terrace cardIds={carte} spread={carte.length > 4} selected={voto || null} marks={marks} onPick={pick} />}
        <div className="bl">
          <div style={{ display: "flex", gap: 8, padding: "10px 12px 0", pointerEvents: "auto" }}><button type="button" className="bib big" onClick={back} aria-label={ts("tu.indietro")} data-testid="tn-back">‹</button></div>
          <PhrasePill phrase={{ mode: "card", text: `Oggi ${/^(i più|quelli che)\s/i.test(frase.trim()) ? "salgono" : "sale"} sulla torre ${frase.trim()}` } as never} megaName="" />
          <div className="bsp" />
          <BSheet title={t("tu.seg.titolo")} sub={modo === "seg" ? t("tu.seg.sub.seg") : t("tu.seg.sub.voto")}>
            <Row>{(["seg", "voto"] as const).map((m) => <Btn key={m} kind={modo === m ? "mus" : "pap"} onClick={() => setModo(m)} style={{ fontSize: 15, padding: "8px 6px" }} testId={`tn-modo-${m}`}>{t(`tu.modo.${m}` as TestoKey)}{(m === "seg" ? mark : voto) ? ` · ${m === "seg" ? mark : voto}` : ""}</Btn>)}</Row>
            <Row>{EFFETTI.map((e) => <Btn key={e} kind={effetto === e ? "mus" : "pap"} onClick={() => { setEffetto(e); if (e === "nulli" && voto === mark) setVoto(0); }} style={{ fontSize: 15, padding: "8px 4px" }} testId={`tn-eff-${e}`}>{ts(`lui.e.${e}` as TestoKey)}</Btn>)}</Row>
            <Btn onClick={() => setStep(3)} disabled={!ready} testId="tn-avanti">{t("tu.avanti")}</Btn>
          </BSheet>
        </div>
        <Toast text={err} />
      </Stage>
    );
  }
  return (
    <Stage testId="tn">
      <div className="fpage">
        <div className="fhead">
          <button type="button" className="bib big" onClick={back} aria-label={ts("tu.indietro")} data-testid="tn-back">‹</button>
          <div className="h r"><small>{t("tu.sopra")}</small>{t(`tu.step.${step}` as TestoKey)}</div>
        </div>
        <div className="wdots" role="img" aria-label={ts("tu.passo", { n: step + 1, tot: 4 })}>{[0, 1, 2, 3].map((k) => <i key={k} className={k <= step ? "on" : ""} />)}</div>
        <div className="fbody">
          {step === 0 && <div className="fld sec sB">
            <span className="lb">{t("tu.carte.lb", { n: carte.length })}</span>
            <div className="tn-grid" data-testid="tn-carte">{tutte.map((id) => { const i = carte.indexOf(id); return <button key={id} type="button" className={`tn-c${i >= 0 ? " on" : ""}`} aria-pressed={i >= 0} aria-label={ts("tu.carta.aria", { id })} onClick={() => toggle(id)} style={ok ? { backgroundImage: `url(${cardFull(id)})` } : undefined} data-testid={`tn-c-${id}`}>{i >= 0 && <b>{i + 1}</b>}</button>; })}</div>
            <p className="tn-nota">{t("tu.carte.nota")}</p>
          </div>}
          {step === 1 && <>
            <div className="fld sec sC">
              <span className="lb">{t("tu.frase.lb")}</span>
              <div className="phr-fixed">{t("tu.frase.oggi")}</div>
              <textarea className="phr-in" maxLength={80} value={frase} onChange={(e) => setFrase(e.target.value)} placeholder={ts("tu.frase.ph")} aria-label={ts("tu.frase.aria")} data-testid="tn-frase" />
              <div className="hint" style={{ textAlign: "right", margin: 0 }}>{len}/80</div>
              {v && v.vietata && <div className="tn-mod no" role="alert" data-testid="tn-mod">{t("tu.mod.vietata")}</div>}
              {v && !v.vietata && v.etaMin > 6 && <div className="tn-mod" data-testid="tn-mod">{t("tu.mod.eta", { eta: v.etaMin })}</div>}
              {v && !v.vietata && v.nomiSospetti.length > 0 && <label className="tn-chk"><input type="checkbox" checked={pubb} onChange={(e) => setPubb(e.target.checked)} data-testid="tn-pubb" /> {t("tu.mod.pubblico", { nomi: v.nomiSospetti.join(", ") })}</label>}
              {v && !v.vietata && len > 0 && len < 8 && <div className="tn-mod">{t("tu.mod.corta")}</div>}
            </div>
            <div className="fld sec sD">
              <span className="lb">{t("tu.eta.lb")}</span>
              <div className="wchips g2">{ETA.map((e) => <button key={e} type="button" disabled={e < etaMin} className={`wchip${eta === e ? " on" : ""}`} onClick={() => setEtaScelta(e)} data-testid={`tn-eta-${e}`}>{t(`room.age.${e}` as TestoKey)}</button>)}</div>
            </div>
            <div className="fld sec sB">
              <span className="lb">{t("tu.idee.lb")}</span>
              <input className="tn-cerca" type="search" value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder={ts("tu.idee.ph")} aria-label={ts("tu.idee.ph")} />
              <div className="tn-idee">{idee.map((f) => <button key={f.testo} type="button" onClick={() => setFrase(f.testo)} data-testid="tn-idea">{f.testo}{f.eta > 6 && <i>{f.eta}+</i>}</button>)}</div>
              <Btn kind="pap" onClick={() => setSeme((s) => s + 5)} style={{ fontSize: 15, padding: "8px 6px" }}>{t("tu.idee.altre")}</Btn>
            </div>
          </>}
          {step === 3 && <>
            <div className="fld sec sC"><span className="lb">{t("tu.durata.lb")}</span>
              <div className="wchips g3">{DURATE.map((d) => <button key={d} type="button" className={`wchip${durata === d ? " on" : ""}`} onClick={() => setDurata(d)} data-testid={`tn-dur-${d}`}>{t(`tu.durata.${d}` as TestoKey)}</button>)}</div>
              <p className="tn-nota">{t("tu.durata.nota")}</p></div>
            <div className="fld sec sD"><span className="lb">{t("tu.riep.lb")}</span>
              <div className="tn-riep"><b>{t("tu.frase.oggi")} {frase.trim()}</b>
                <span>{t("tu.riep.carte", { n: carte.length })} · {t(`room.age.${eta}` as TestoKey)}</span>
                <span>{t("tu.riep.segnalino", { s: ts(`lui.e.${effetto}` as TestoKey), p: mark, v: voto })}</span></div>
              <p className="tn-nota">{t("tu.riep.nota")}</p></div>
          </>}
        </div>
        <div className="fbot">
          {step < 3 ? <Btn onClick={() => setStep(step + 1)} disabled={!puoAvanti} testId="tn-avanti">{t("tu.avanti")}</Btn>
            : <Btn kind="red" onClick={pubblica} disabled={busy} testId="tn-pubblica">{busy ? t("tu.pubblico") : t("tu.pubblica")}</Btn>}
        </div>
      </div>
      <Toast text={err} />
    </Stage>
  );
}
