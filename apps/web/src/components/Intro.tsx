import { useState } from "react";
import { Btn } from "../ui.tsx";
import { Pt } from "./Pt.tsx";
import { t, ts } from "../lib/testi.ts";
import type { TestoKey } from "../lib/testi.ts";
import { MegaIcon } from "./MegaIcon.tsx";

const Dots = ({ i, n }: { i: number; n: number }) => <span className="dts">{Array.from({ length: n }, (_, k) => <i key={k} className={k === i ? "on" : ""} />)}</span>;

/** Le schermate del tutorial: videate vere dell'app (public/tutorial, scripts/capture-tutorial.mjs). */
const SLIDES = [
  { k: "s0", img: "/giocatori/torre.webp", tower: true },
  { k: "s1", img: "/tutorial/frase.webp" },
  { k: "s2", img: "/tutorial/mano.webp" },
  { k: "s3", img: "/tutorial/segnalino.webp" },
  { k: "s4", img: "/tutorial/voto.webp" },
  { k: "s5", img: "/tutorial/punti.webp" },
] as const;

/** Tutorial: poche schermate con videate vere dell'app. Si apre da «Come si gioca», alla prima partita e dal menu «i». */
export function IntroSlides({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0), last = i === SLIDES.length - 1, sl = SLIDES[i]!;
  return (
    <div className="isl" role="dialog" aria-label={ts("intro.aria")} data-testid="intro-slides">
      <div className="sky" /><div className="skyg" /><div className="skyh" />
      <div className="isl-top"><Dots i={i} n={SLIDES.length} /><a className="skp" role="button" tabIndex={0} onClick={onClose} onKeyDown={(e) => { if (e.key === "Enter") onClose(); }} data-testid="intro-skip">{t("intro.salta")}</a></div>
      <h2 className="isl-h sm">{t(`intro.${sl.k}.t` as TestoKey)}</h2>
      <div className={`isl-shot${"tower" in sl ? " tower" : ""}`}><img src={sl.img} alt="" /></div>
      <div className="pp isl-card"><p>{t(`intro.${sl.k}.x` as TestoKey)}</p></div>
      <div className="isl-ba"><Btn onClick={() => (last ? onClose() : setI(i + 1))} testId="intro-next">{last ? t("intro.fine") : t("intro.avanti")}</Btn></div>
    </div>
  );
}

const KEY = "gdt.mega";
/** Quante volte si è già vista la scheda del Megafono su questo telefono («off» = non mostrarla più). */
export function megaIntroDue(): boolean { try { const v = localStorage.getItem(KEY); return v !== "off" && Number(v ?? 0) < 2; } catch { return false; } }
export function megaIntroSeen(off: boolean) { try { localStorage.setItem(KEY, off ? "off" : String(Number(localStorage.getItem(KEY) ?? 0) + 1)); } catch { /* */ } }

/** «Sei il Megafono!»: le prime due volte che tocca a te, cosa fai e come fai punti. */
export function MegaIntro({ onClose }: { onClose: (off: boolean) => void }) {
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
        <div className="isl-n">{t("mega.gioca")}</div>
        <div className="isl-n g">{t("mega.punti", { p2: <Pt n={2} />, pl: <Pt n="+1 / +4" />, p0: <Pt n={0} plus={false} /> })}</div>
      </div>
      <div className="isl-ba">
        <Btn onClick={() => onClose(off)} testId="mega-ok">{t("mega.ok")}</Btn>
        <label className="isl-chk"><input type="checkbox" checked={off} onChange={(e) => setOff(e.target.checked)} data-testid="mega-off" /> {t("mega.nomore")}</label>
      </div>
    </div>
  );
}
