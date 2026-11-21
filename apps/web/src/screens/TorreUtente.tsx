import { useCallback, useEffect, useMemo, useState } from "react";
import { Stage, Btn, Toast, navigate, useNow, useStage } from "../ui.tsx";
import { Terrace } from "../components/Terrace.tsx";
import { BSheet, PhrasePill, Row } from "../components/BUi.tsx";
import { terracePos } from "../scene/draw.ts";
import { useCards } from "../lib/cards.ts";
import { adminDi, annullaTorre, chiudiTorre, confermaEta, erroreTorre, etaConfermata, linkTorre, nickTorre, resta, segnalaTorre, vediTorre, votaTorre } from "../lib/torriUtente.ts";
import type { VistaTorre } from "../lib/torriUtente.ts";
import { disegnaTorre } from "../lib/torriOg.ts";
import { t, ts } from "../lib/testi.ts";
import type { TestoKey } from "../lib/testi.ts";

const specDi = (e: string) => ({ slot: "s", k: 1, pts: e === "cade" ? 4 : e === "noncade" ? 2 : 0, effect: e });
/** Percentuali di voto sulle carte (a torre chiusa), nella stessa posizione delle carte della terrazza. */
function Percentuali({ n, pct, cadono }: { n: number; pct: number[]; cadono: number[] }) {
  const { ts: sc, ty } = useStage(), pos = useMemo(() => terracePos(n, n > 4), [n]);
  return <>{Object.entries(pos).map(([i, c]) => { const x = (c.x + c.w - 30 - 186) * sc + 186, y = (c.f - c.h + 26 - 300) * sc + 300 + ty, num = Number(i) + 1;
    return <div key={i} className={`tu-pct${cadono.includes(num) ? " fall" : ""}`} style={{ left: x - 26, top: y - 14 }} data-testid={`tu-pct-${num}`}>{pct[Number(i)] ?? 0}%</div>; })}</>;
}
const tempo = (ms: number) => { const r = resta(ms); return r.g ? ts("tu.t.gh", { g: r.g, h: r.h }) : r.h ? ts("tu.t.hm", { h: r.h, m: r.m }) : ts("tu.t.m", { m: Math.max(1, r.m) }); };
const frasePill = (v: VistaTorre) => ({ mode: "card", text: `Oggi ${v.verbo ?? "sale"} sulla torre ${v.frase ?? ""}` }) as never;

/** La pagina di una torre condivisa (`/t/<id>`): conferma dell'età, voto, nickname, risultati; per l'autore anche condivisione e gestione. */
export default function TorreUtente({ id }: { id: string }) {
  const ready = useCards(), now = useNow(1000), admin = useMemo(() => adminDi(id), [id]);
  const [v, setV] = useState<VistaTorre | null>(null), [errore, setErrore] = useState<string | null>(null), [nf, setNf] = useState(false), [sel, setSel] = useState(0), [busy, setBusy] = useState(false);
  const [nick, setNick] = useState(""), [msg, setMsg] = useState<string | null>(null), [eta, setEta] = useState(() => etaConfermata()), [segn, setSegn] = useState(false), [chiudi, setChiudi] = useState<null | "motivo" | "conferma">(null), [motivo, setMotivo] = useState("errore"), [conf, setConf] = useState("");
  const carica = useCallback(() => vediTorre(id, admin).then((x) => { setV(x); setNf(false); }).catch((e: { code?: string }) => { if (e?.code === "NON_TROVATA") setNf(true); else setErrore(erroreTorre(e)); }), [id, admin]);
  useEffect(() => { void carica(); }, [carica]);
  useEffect(() => { if (v?.stato === "aperta" && now >= v.chiude) void carica(); }, [now > 0 && v ? now >= v.chiude : false]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!msg) return undefined; const x = setTimeout(() => setMsg(null), 3200); return () => clearTimeout(x); }, [msg]);
  const toast = (s: string) => setMsg(s);
  const fallita = (e: unknown) => toast(erroreTorre(e));
  const ok = async (f: () => Promise<unknown>) => { if (busy) return; setBusy(true); try { await f(); await carica(); } catch (e) { fallita(e); } setBusy(false); };

  const testo = (vv: VistaTorre) => ts("tu.share.testo", { eta: vv.eta >= 10 ? `${vv.eta}+ ` : "" });
  const condividi = async (come: "wa" | "tg" | "sys" | "copia") => {
    if (!v) return; const link = linkTorre(id), txt = testo(v);
    if (come === "wa") window.open(`https://wa.me/?text=${encodeURIComponent(`${txt} ${link}`)}`, "_blank", "noopener");
    else if (come === "tg") window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(txt)}`, "_blank", "noopener");
    else if (come === "sys" && navigator.share) { try { await navigator.share({ title: ts("tu.og.titolo"), text: txt, url: link }); } catch { /* annullato */ } }
    else { try { await navigator.clipboard.writeText(link); toast(ts("tu.copiato")); } catch { toast(link); } }
  };
  const storia = async () => {
    if (!v?.frase) return; setBusy(true);
    try { const blob = await disegnaTorre({ carte: v.carte, frase: v.frase, verbo: v.verbo ?? "sale", eta: v.eta, chiude: v.chiude, formato: "storia" }), file = new File([blob], `torre-${id}.jpg`, { type: "image/jpeg" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], url: linkTorre(id) }); else { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); } } catch { /* annullato */ }
    setBusy(false);
  };
  const ics = () => { if (!v) return; const f = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d+/, ""), s = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//GDT//IT", "BEGIN:VEVENT", `UID:${id}@giudallatorre`, `DTSTAMP:${f(Date.now())}`, `DTSTART:${f(v.chiude)}`, `DTEND:${f(v.chiude + 900_000)}`, `SUMMARY:${ts("tu.ics.titolo")}`, `DESCRIPTION:${linkTorre(id)}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([s], { type: "text/calendar" })); a.download = `torre-${id}.ics`; a.click(); };

  if (nf || v?.stato === "annullata" || v?.stato === "nascosta") return (
    <Stage bg="sky" testId="tu-vuota"><div className="tu-msg"><h2>{t(nf ? "tu.nf.t" : v!.stato === "annullata" ? "tu.ann.t" : "tu.nas.t")}</h2><p>{t(nf ? "tu.nf.x" : v!.stato === "annullata" ? "tu.ann.x" : "tu.nas.x")}</p>
      <Btn onClick={() => navigate("/torri/nuova")} testId="tu-crea">{t("tu.crea")}</Btn><Btn kind="pap" onClick={() => navigate("/")}>{t("tu.home")}</Btn></div></Stage>
  );
  if (!v) return <Stage bg="sky" testId="tu-carico"><div className="tu-msg"><p>{errore ?? t("tu.carico")}</p>{errore && <Btn onClick={() => { setErrore(null); void carica(); }}>{t("tu.riprova")}</Btn>}</div></Stage>;
  if (v.eta >= 14 && eta < v.eta && !v.autore) return (
    <Stage bg="sky" testId="tu-eta"><div className="tu-msg"><span className="tu-age" data-testid="tu-age">{v.eta}+</span><h2>{t("tu.eta.t")}</h2><p>{t("tu.eta.x", { eta: v.eta })}</p>
      <Btn onClick={() => { confermaEta(v.eta); setEta(v.eta); }} testId="tu-eta-si">{t("tu.eta.si", { eta: v.eta })}</Btn><Btn kind="pap" onClick={() => navigate("/")} testId="tu-eta-no">{t("tu.eta.no")}</Btn><small>{t("tu.eta.nota")}</small></div></Stage>
  );

  const chiusa = v.stato === "chiusa" && !!v.risultati, n = v.carte.length, r = v.risultati, mioVoto = v.mioVoto ?? null, restoMs = v.chiude - now;
  const marks = chiusa && r ? [{ pos: r.posSegnalino, spec: specDi(r.effetto) as never }] : v.posSegnalino ? [{ pos: v.posSegnalino, spec: null }] : null;
  const vota = !chiusa && !v.autore && mioVoto === null, titolo = chiusa ? t("tu.ris.t") : v.autore ? t("tu.aut.t") : vota ? t("tu.vota.t") : t("tu.dopo.t");
  const chiusuraAnticipo = async () => { if (!admin) return; setBusy(true); try { await chiudiTorre(id, admin, motivo, conf); setChiudi(null); setConf(""); await carica(); } catch (e) { fallita(e); } setBusy(false); };
  return (
    <Stage bg="sky" testId="tu">
      {ready && <Terrace cardIds={v.carte} spread={n > 4} selected={chiusa ? null : vota ? sel || null : mioVoto} marks={marks} sink={chiusa && r ? r.cadono : undefined} onPick={vota ? (p) => setSel(p) : undefined} />}
      {chiusa && r && <Percentuali n={n} pct={r.percento} cadono={r.cadono} />}
      <div className="bl">
        <div className="tu-top" style={{ pointerEvents: "auto" }}><span className="chip" data-testid="tu-stato">{chiusa ? t("tu.chiusa") : t("tu.chiude", { t: tempo(restoMs) })}</span>{v.eta >= 10 && <span className="tu-age sm">{v.eta}+</span>}</div>
        <PhrasePill phrase={frasePill(v)} megaName="" />
        <div className="bsp" />
        <BSheet title={titolo} sub={chiusa && v.scadeDati ? t("tu.ris.scade", { t: tempo(v.scadeDati - now) }) : vota ? t("tu.vota.x") : v.autore ? t("tu.aut.x", { n: v.numVoti }) : t("tu.dopo.x", { t: tempo(restoMs) })}>
          {vota && <Btn kind="red" disabled={!sel || busy} onClick={() => void ok(() => votaTorre(id, sel))} testId="tu-conferma">{t("tu.vota.ok")}<small>{t("tu.vota.nota")}</small></Btn>}
          {!vota && !chiusa && !v.autore && <>
            <div className="tu-nick"><input value={nick || v.mioNick || ""} maxLength={20} onChange={(e) => setNick(e.target.value)} placeholder={ts("tu.nick.ph")} aria-label={ts("tu.nick.ph")} data-testid="tu-nick" />
              <Btn kind="pap" disabled={busy} onClick={() => void ok(async () => { await nickTorre(id, nick || v.mioNick || ""); toast(ts("tu.nick.ok")); })} style={{ fontSize: 15, padding: "8px 10px" }} testId="tu-nick-ok">{t("tu.nick.salva")}</Btn></div>
            <Row><Btn kind="pap" onClick={ics} style={{ fontSize: 14, padding: "8px 4px" }} testId="tu-ics">{t("tu.ricorda")}</Btn><Btn kind="pap" onClick={() => navigate("/torri/nuova")} style={{ fontSize: 14, padding: "8px 4px" }}>{t("tu.crea")}</Btn></Row>
          </>}
          {chiusa && r && <>
            <div className="tu-ris" data-testid="tu-ris"><b>{r.cadono.length ? t("tu.ris.cade", { c: r.cadono.join(", "), p: Math.max(...r.percento) }) : t("tu.ris.nessuna")}</b><span>{t("tu.ris.seg", { s: ts(`lui.e.${r.effetto}` as TestoKey), p: r.posSegnalino, ok: ts(r.segnalinoCaduta === (r.effetto === "cade") ? "tu.ris.si" : "tu.ris.no") })}</span></div>
            <ol className="tu-class" data-testid="tu-class">{r.classifica.slice(0, 8).map((x) => <li key={x.ordine} className={x.tu ? "tu" : ""}><i>{x.ordine}</i><span>{x.nick}{x.tu ? ` ${ts("tu.tu")}` : ""}</span><b>{x.punti}</b></li>)}{!r.classifica.length && <li className="vuota">{t("tu.ris.nessuno")}</li>}</ol>
            <Row><Btn kind="pap" onClick={() => void condividi(typeof navigator.share === "function" ? "sys" : "copia")} style={{ fontSize: 14, padding: "8px 4px" }}>{t("tu.condividi")}</Btn><Btn onClick={() => navigate("/torri/nuova")} style={{ fontSize: 14, padding: "8px 4px" }}>{t("tu.crea")}</Btn></Row>
          </>}
          {v.autore && !chiusa && !chiudi && <>
            <Row><Btn onClick={() => void condividi("wa")} style={{ fontSize: 15, padding: "8px 4px" }} testId="tu-wa">{t("tu.wa")}</Btn><Btn kind="pap" onClick={() => void condividi("tg")} style={{ fontSize: 15, padding: "8px 4px" }}>{t("tu.tg")}</Btn></Row>
            <Row><Btn kind="pap" onClick={() => void condividi("copia")} style={{ fontSize: 14, padding: "8px 4px" }} testId="tu-copia">{t("tu.copia")}</Btn><Btn kind="pap" disabled={busy} onClick={() => void storia()} style={{ fontSize: 14, padding: "8px 4px" }} testId="tu-storia">{t("tu.storia")}</Btn>{typeof navigator.share === "function" && <Btn kind="pap" onClick={() => void condividi("sys")} style={{ fontSize: 14, padding: "8px 4px" }}>{t("tu.altro")}</Btn>}</Row>
            {v.annullabile ? <Btn kind="red" disabled={busy} onClick={() => void ok(() => annullaTorre(id, admin!))} style={{ fontSize: 15, padding: "8px 6px" }} testId="tu-annulla">{t("tu.annulla", { t: tempo(v.creata + 600_000 - now) })}</Btn>
              : <Btn kind="pap" onClick={() => setChiudi("motivo")} style={{ fontSize: 15, padding: "8px 6px" }} testId="tu-chiudi">{t("tu.chiudi")}</Btn>}
          </>}
          {v.autore && chiudi === "motivo" && <><span className="hint">{t("tu.chiudi.m")}</span><div className="wchips g3">{["errore", "frase", "altro"].map((m) => <button key={m} type="button" className={`wchip${motivo === m ? " on" : ""}`} onClick={() => setMotivo(m)}>{t(`tu.motivo.${m}` as TestoKey)}</button>)}</div><Row><Btn kind="pap" onClick={() => setChiudi(null)} style={{ fontSize: 15, padding: "8px 6px" }}>{t("tu.indietro")}</Btn><Btn onClick={() => setChiudi("conferma")} style={{ fontSize: 15, padding: "8px 6px" }}>{t("tu.avanti")}</Btn></Row></>}
          {v.autore && chiudi === "conferma" && <><span className="hint">{t("tu.chiudi.c")}</span><input className="tn-cerca" value={conf} onChange={(e) => setConf(e.target.value)} placeholder="CHIUDI" aria-label="CHIUDI" data-testid="tu-conf" /><Row><Btn kind="pap" onClick={() => setChiudi("motivo")} style={{ fontSize: 15, padding: "8px 6px" }}>{t("tu.indietro")}</Btn><Btn kind="red" disabled={busy || conf.trim().toUpperCase() !== "CHIUDI"} onClick={() => void chiusuraAnticipo()} style={{ fontSize: 15, padding: "8px 6px" }} testId="tu-chiudi-ok">{t("tu.chiudi.ok")}</Btn></Row></>}
          {!v.autore && <button type="button" className="linkbtn" onClick={() => { if (segn) { void segnalaTorre(id).then(() => toast(ts("tu.segnalata"))).catch(fallita); setSegn(false); } else setSegn(true); }} data-testid="tu-segnala">{segn ? t("tu.segnala.conf") : t("tu.segnala")}</button>}
        </BSheet>
      </div>
      <Toast text={msg} />
    </Stage>
  );
}
