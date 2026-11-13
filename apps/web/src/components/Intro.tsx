import { useState } from "react";
import { Btn } from "../ui.tsx";
import { PointsKey } from "./PointsExamples.tsx";
import { Pt } from "./Pt.tsx";
import { t, ts } from "../lib/testi.ts";
import { MegaIcon } from "./MegaIcon.tsx";

const Dots = ({ i, n }: { i: number; n: number }) => <span className="dts">{Array.from({ length: n }, (_, k) => <i key={k} className={k === i ? "on" : ""} />)}</span>;

/** Prima partita su questo telefono: tre schermate brevi al posto del regolamento. Si saltano e si rivedono da «i». */
export function IntroSlides({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0), last = i === 2;
  return (
    <div className="isl" role="dialog" aria-label={ts("intro.aria")} data-testid="intro-slides">
      <div className="sky" /><div className="skyg" /><div className="skyh" />
      <div className="isl-top"><Dots i={i} n={3} /><a className="skp" role="button" tabIndex={0} onClick={onClose} onKeyDown={(e) => { if (e.key === "Enter") onClose(); }} data-testid="intro-skip">{t("intro.salta")}</a></div>
      {i === 0 && <>
        <h2 className="isl-h">{t("intro.1.titolo")}</h2>
        <img className="isl-tower" src="/giocatori/torre.webp" alt="" />
        <div className="pp isl-card"><b>{t("intro.1.card.titolo")}</b><p>{t("intro.1.card.testo")}</p></div>
      </>}
      {i === 1 && <>
        <h2 className="isl-h sm">{t("intro.2.titolo")}</h2>
        <div className="pp isl-steps">
          <div className="st"><i className="ic"><MegaIcon s={24} /></i><div><b>{t("intro.2.p1.t")}</b><p>{t("intro.2.p1.x")}</p></div></div>
          <div className="st"><i className="ic">🃏</i><div><b>{t("intro.2.p2.t")}</b><p>{t("intro.2.p2.x")}</p></div></div>
          <div className="st"><i className="ic">🗳</i><div><b>{t("intro.2.p3.t")}</b><p>{t("intro.2.p3.x")}</p></div></div>
          <div className="st"><i className="ic">⭐</i><div><b>{t("intro.2.p4.t")}</b><p>{t("intro.2.p4.x")}</p></div></div>
        </div>
      </>}
      {i === 2 && <>
        <h2 className="isl-h sm">{t("intro.3.titolo")}</h2>
        <div className="pp isl-steps"><PointsKey /><div className="isl-note">{t("intro.3.nota")}</div></div>
      </>}
      <div className="isl-ba"><Btn onClick={() => (last ? onClose() : setI(i + 1))} testId="intro-next">{last ? t("intro.fine") : t("intro.avanti")}</Btn></div>
    </div>
  );
}

const KEY = "gdt.mega";
/** Quante volte si è già vista la scheda del Megafono su questo telefono («off» = non mostrarla più). */
export function megaIntroDue(): boolean { try { const v = localStorage.getItem(KEY); return v !== "off" && Number(v ?? 0) < 2; } catch { return false; } }
export function megaIntroSeen(off: boolean) { try { localStorage.setItem(KEY, off ? "off" : String(Number(localStorage.getItem(KEY) ?? 0) + 1)); } catch { /* */ } }

/** «Sei il Megafono!»: le prime due volte che tocca a te, cosa fai e come fai punti. */
export function MegaIntro({ megafonoSa, onClose }: { megafonoSa: boolean; onClose: (off: boolean) => void }) {
  const [off, setOff] = useState(false);
  return (
    <div className="isl mega" role="dialog" aria-label={ts("mega.aria")} data-testid="mega-intro">
      <div className="sky" /><div className="skyg" /><div className="skyh" />
      <div className="mbig"><i><MegaIcon s={76} /></i></div>
      <h2 className="isl-h gold">{t("mega.titolo")}</h2><p className="isl-cur">{t("mega.sotto")}</p>
      <div className="pp isl-steps tight">
        <div className="st"><i className="ic">1</i><div><b>{t("mega.p1.t")}</b><p>{t("mega.p1.x")}</p></div></div>
        <div className="st"><i className="ic">2</i><div><b>{t("mega.p2.t")}</b><p>{t("mega.p2.x")}</p></div></div>
        <div className="st"><i className="ic">3</i><div><b>{t("mega.p3.t")}</b><p>{t("mega.p3.x")}</p></div></div>
        <div className="isl-n">{megafonoSa ? t("mega.gioca") : t("mega.nongioca")}</div>
        <div className="isl-n g">{t("mega.punti", { p2: <Pt n={2} />, pl: <Pt n="+1 / +4" />, p0: <Pt n={0} plus={false} /> })}</div>
      </div>
      <div className="isl-ba">
        <Btn onClick={() => onClose(off)} testId="mega-ok">{t("mega.ok")}</Btn>
        <label className="isl-chk"><input type="checkbox" checked={off} onChange={(e) => setOff(e.target.checked)} data-testid="mega-off" /> {t("mega.nomore")}</label>
      </div>
    </div>
  );
}

const NOCARD = "gdt.nocard";
/** Il Megafono non gioca carte: la spiegazione resta finché non la tocchi, le prime 3 volte (poi basta il messaggio nella schermata di attesa). */
export function noCardDue(): boolean { try { return Number(localStorage.getItem(NOCARD) ?? 0) < 3; } catch { return false; } }
export function noCardSeen() { try { localStorage.setItem(NOCARD, String(Number(localStorage.getItem(NOCARD) ?? 0) + 1)); } catch { /* */ } }

export function NoCardNotice({ onClose }: { onClose: () => void }) {
  return (
    <div className="isl nocard" role="dialog" aria-label={ts("nocard.aria")} data-testid="nocard-notice">
      <div className="sky" /><div className="skyg" /><div className="skyh" />
      <h2 className="isl-h sm">{t("nocard.titolo")}</h2>
      <div className="nc-art" aria-hidden>
        <span className="nc-deck"><i /><i /><i /><b>{t("nocard.mazzo")}</b></span>
        <span className="nc-ar">➜</span>
        <span className="nc-tower"><img src="/giocatori/torre.webp" alt="" /><i className="nc-card" /></span>
      </div>
      <div className="pp isl-card"><b>{t("nocard.perche.t")}</b><p>{t("nocard.perche.x")}</p></div>
      <div className="pp isl-card"><b>{t("nocard.adesso.t")}</b><p>{t("nocard.adesso.x")}</p></div>
      <div className="isl-ba"><Btn onClick={onClose} testId="nocard-ok">{t("nocard.ok")}</Btn></div>
    </div>
  );
}
