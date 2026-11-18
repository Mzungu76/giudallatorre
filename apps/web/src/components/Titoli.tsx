import { useEffect, useRef, useState } from "react";
import type { GameState } from "@gdt/game-engine";
import { Gauge, useContaSu } from "./StereoScene.tsx";
import { t, ts } from "../lib/testi.ts";
import type { TestoKey } from "../lib/testi.ts";
import { fasciaPregiudizio as fascia, aspettoDi, fraseLuogo, stereoGame, stereoGruppi } from "../lib/stereo.ts";
import { battutaRiga, carteLuoghi, commentoLancio, premi, rigaGauge, titoloVincitori, variante } from "../lib/riepilogo.ts";
import { cardFull } from "../lib/cards.ts";
import { FAST } from "../ui.tsx";
import type { FinalRow } from "./FinalScene.tsx";

const VELOCITA = 78;   // pixel al secondo
const PAUSA = 700;     // ms di attesa dopo che il dito si alza (o finisce l'inerzia) prima di ripartire
const mov = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Il quadrante compare (e la lancetta sale) solo quando scorre nella parte visibile dei titoli. */
function Effetti({ pct, radice }: { pct: number; radice: React.RefObject<HTMLDivElement | null> }) {
  const r = useRef<HTMLDivElement>(null), [on, setOn] = useState(false), shown = useContaSu(pct, on), fa = fascia(pct);
  useEffect(() => {
    const el = r.current; if (!el || typeof IntersectionObserver === "undefined") { setOn(true); return undefined; }
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { setOn(true); io.disconnect(); } }, { root: radice.current, threshold: 0.6 });
    io.observe(el); return () => io.disconnect();
  }, [radice]);
  return (
    <div className="rp-b rp-g tc-g" ref={r}><Gauge pct={pct} on={on} shown={shown} />{on && <><div className="rp-verd">{t(`sc.f${fa}`)}</div><div className="rp-sub">{rigaGauge(fa)}</div></>}</div>
  );
}

/** Titoli di coda di fine partita («La prima al cinema»): i partecipanti, la trama (il luogo comune), le carte ospiti, i premi, gli effetti speciali, la scena più riuscita, umani contro bot,
 *  critica e pubblico, ringraziamenti e avvertenze. Salgono da soli; col dito li si ferma e li si porta dove si vuole, e quando il dito si alza ripartono da lì fino alla fine. */
export default function Titoli({ rows, winners, stereo, isBot, sound, seme, onDettagli }: { /** Apre il foglio «Come l'abbiamo finalmente capito». */ onDettagli?: (g: NonNullable<ReturnType<typeof stereoGame>>) => void; /** Per far variare i testi da una partita all'altra. */ seme: string; rows: FinalRow[]; winners: Set<string>; stereo: GameState["stereo"] | null | undefined; isBot: (id: string) => boolean; sound: boolean }) {
  const g = stereoGame(stereo), gr = stereoGruppi(stereo, isBot), box = useRef<HTMLDivElement>(null);
  const uvb = gr.umani !== null && gr.bot !== null, badge = g ? premi(g) : [], carte = g ? carteLuoghi(g) : [];
  const nomi = rows.filter((r) => winners.has(r.id)).map((r) => r.name);
  useEffect(() => {
    const el = box.current; if (!el) return undefined;
        if (FAST || mov()) { el.scrollTop = el.scrollHeight; el.parentElement?.style.setProperty("--bgo", "1"); return undefined; }
    let raf = 0, last = performance.now(), pos = 0, giu = false, tocco = performance.now() + 600, scritto = -1;
    const dito = () => { giu = true; }, su = () => { giu = false; tocco = performance.now(); };
    const fin = el.closest(".fin") as HTMLElement | null, wrap = el.parentElement as HTMLElement;
    const muovi = () => { const y = el.scrollTop; fin?.style.setProperty("--ty", `${-y}px`); wrap.style.setProperty("--bgo", String(Math.min(1, y / (el.clientHeight * 0.7)))); };
    const scroll = () => { muovi(); if (Math.abs(el.scrollTop - scritto) > 1.5) { tocco = performance.now(); pos = el.scrollTop; } };   // lo scorrimento non è il nostro: è del dito (o dell'inerzia)
    const ruota = () => { tocco = performance.now(); };
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const max = el.scrollHeight - el.clientHeight;
      if (giu || now - tocco < PAUSA) pos = el.scrollTop;
      else if (pos < max) { pos = Math.min(max, pos + VELOCITA * dt); el.scrollTop = pos; scritto = el.scrollTop; }
      raf = requestAnimationFrame(loop);
    };
    el.addEventListener("touchstart", dito, { passive: true }); el.addEventListener("touchend", su); el.addEventListener("touchcancel", su);
    el.addEventListener("mousedown", dito); window.addEventListener("mouseup", su); el.addEventListener("wheel", ruota, { passive: true }); el.addEventListener("scroll", scroll, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); el.removeEventListener("touchstart", dito); el.removeEventListener("touchend", su); el.removeEventListener("touchcancel", su); el.removeEventListener("mousedown", dito); window.removeEventListener("mouseup", su); el.removeEventListener("wheel", ruota); el.removeEventListener("scroll", scroll); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const diff = uvb ? gr.umani! - gr.bot! : 0, verd = diff > 5 ? "sc.uvb.u" : diff < -5 ? "sc.uvb.b" : "sc.uvb.p";
  const cr = (slot: "a" | "b" | "c") => ({ titolo: ts(`tc.cr.${slot}.t` as TestoKey, { nome: nomi[0] ?? "" }), frase: ts(`tc.cr.${slot}.${variante(3, seme + slot)}` as TestoKey) });
  return (
    <div className="tc-wrap" data-testid="titoli">
      <div className="tc-bg" />
      <div className="tc" ref={box}>
        <div className="tc-gap" />
        <div className="tc-mq">{t("tc.premiere")}</div>
        <div className="tc-ti">{t("tc.titolo")}</div>
        <div className="tc-win">{titoloVincitori(nomi, seme)}</div>

        <h5>{t("tc.int")}</h5>
        <div data-testid="titoli-cast">
          {rows.map((r, i) => {
            const n = Math.abs(r.score), ca = r.score === 0 ? ts("tc.cachet.0") : n === 1 && r.score > 0 ? ts("tc.cachet.1") : ts("tc.cachet", { n: r.score < 0 ? `−${n}` : n });
            return <div key={r.id} className={`tc-cast ${winners.has(r.id) ? "win" : ""}`}><div><i style={{ background: r.color }} />{r.name}{winners.has(r.id) && <u>★ {t("tc.prot")}</u>}<small>{battutaRiga(rows, i, winners)}</small></div><em>{ca}</em></div>;
          })}
        </div>

        {g?.top[0] && <>
          <h5>{t("tc.trama")}</h5>
          <div className="tc-trama" data-testid="stereo-top">
            <div className="rp-k">{fraseLuogo(g.top[0].k)} <span className="rp-pct">{g.top[0].pct}%</span></div>
            {g.top.slice(1).map((x, i) => <div key={x.k} className="rp-alt">{ts(`rp.alt.${i + 1}` as "rp.alt.1", { frase: fraseLuogo(x.k), pct: x.pct })}</div>)}
            {g.comune && <div className="rp-alt rp-com">{ts("lc.tra.riga", { n: g.comune.n, tot: g.comune.tot, chi: aspettoDi(g.comune.k) })}</div>}
          </div>
          <small className="tc-s">{ts(`tc.trama.s.${variante(4, seme)}` as TestoKey)}</small>
          {onDettagli && <button className="tc-det" onClick={() => onDettagli(g)} data-testid="dettagli-btn">{t("dt.btn")}</button>}
        </>}

        {carte.length > 0 && <>
          <h5>{t("tc.ospiti")}</h5>
          <div className="tc-ct">{carte.map((id) => <img key={id} src={cardFull(id)} alt="" draggable={false} />)}</div>
          <small className="tc-s">{ts(`tc.ospiti.s.${variante(3, seme)}` as TestoKey)}</small>
        </>}

        {badge.length > 0 && <>
          <h5>{t("tc.premi")}</h5>
          <div className="rp-bd" data-testid="badge">{badge.map((b) => <div key={b.ruolo}><span className="rib">{b.titolo}</span>{b.carta && <img src={cardFull(b.carta)} alt="" draggable={false} />}<small>{b.riga}</small></div>)}</div>
        </>}

        {g && <>
          <h5>{t("tc.fx")}</h5>
          <Effetti pct={g.pct} radice={box} />
          <small className="tc-s">{t("tc.fx.s")}</small>
        </>}

        {g?.lancio && <>
          <h5>{t("tc.scena")}</h5>
          <div className="rp-b rp-lan" data-testid="stereo-lancio"><div className="rp-lr"><img src={cardFull(g.lancio.cardId)} alt="" draggable={false} /><b>{ts("sc.lancio.voti", { ruolo: g.lancio.ruolo, n: g.lancio.n })}</b></div><q>{g.lancio.text}</q><div className="rp-sub">{commentoLancio(g.lancio.cardId)}</div></div>
        </>}

        {uvb && <>
          <h5>{t("tc.cast")}</h5>
          <div className="rp-b" data-testid="stereo-uvb">
            <div className="rp-uvr">{([["sc.umani", gr.umani, "sc-u"], ["sc.bot", gr.bot, "sc-b"]] as const).map(([k, v, c]) => <div className="rp-uv" key={k}><span>{t(k)}</span><b>{v}%</b><div className="sc-bar"><u className={c} style={{ width: `${v}%` }} /></div></div>)}</div>
            <p className="rp-uvv" data-testid="stereo-uvb-verdetto">{t(verd)}</p></div>
          <small className="tc-s">{t("tc.cast.s")}</small>
        </>}

        <h5>{t("tc.critica")}</h5>
        {(["a", "b", "c"] as const).map((s) => { const x = cr(s); return <div className="tc-cr" key={s}><b>{x.titolo}</b>{x.frase}</div>; })}
        <small className="tc-s">{t("tc.cr.fine")}</small>

        <h5>{t("tc.rin")}</h5>
        <p>{t("tc.rin.0")}</p><p>{t("tc.rin.1")}</p><p>{t("tc.rin.2")}</p>

        <h5>{t("tc.av")}</h5>
        <p>{t("tc.av.0")}</p><p>{t("tc.av.1")}</p><p>{t("tc.av.2")}</p>

        <div className="tc-logo"><img src="/giocatori/torre.webp" alt="" draggable={false} /><span>{t("tc.fine")}</span></div>
        <small className="tc-s">{t("tc.sub")}</small>
        <div className="tc-end" />
      </div>
    </div>
  );
}
