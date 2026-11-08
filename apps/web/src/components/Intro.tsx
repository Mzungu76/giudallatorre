import { useState } from "react";
import { Btn } from "../ui.tsx";
import { PointsKey } from "./PointsExamples.tsx";

const Dots = ({ i, n }: { i: number; n: number }) => <span className="dts">{Array.from({ length: n }, (_, k) => <i key={k} className={k === i ? "on" : ""} />)}</span>;

/** Prima partita su questo telefono: tre schermate brevi al posto del regolamento. Si saltano e si rivedono da «i». */
export function IntroSlides({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0), last = i === 2;
  return (
    <div className="isl" role="dialog" aria-label="Come si gioca" data-testid="intro-slides">
      <div className="sky" /><div className="skyg" /><div className="skyh" />
      <div className="isl-top"><Dots i={i} n={3} /><a className="skp" role="button" tabIndex={0} onClick={onClose} onKeyDown={(e) => { if (e.key === "Enter") onClose(); }} data-testid="intro-skip">Salta</a></div>
      {i === 0 && <>
        <h2 className="isl-h">Chi butteresti<br />giù dalla torre?</h2>
        <img className="isl-tower" src="/giocatori/torre.webp" alt="" />
        <div className="pp isl-card"><b>Un gioco di accuse e di voti</b><p>A ogni turno c’è una <u>frase</u>. Voi scegliete i personaggi che la meritano, poi <u>votate</u>: il più votato cade giù dalla torre. Sotto ci sono i materassi.</p></div>
      </>}
      {i === 1 && <>
        <h2 className="isl-h sm">Ogni turno,<br />4 passi</h2>
        <div className="pp isl-steps">
          <div className="st"><i className="ic">📣</i><div><b>Il Megafono urla</b><p>Sceglie una frase: «Oggi sale sulla torre… <em>i più ipocriti</em>».</p></div></div>
          <div className="st"><i className="ic">🃏</i><div><b>Tu scegli il personaggio</b><p>Quello che somiglia di più alla frase. È segreto.</p></div></div>
          <div className="st"><i className="ic">🗳</i><div><b>Si vota</b><p>Ognuno vota la carta che pensa debba cadere.</p></div></div>
          <div className="st"><i className="ic">⭐</i><div><b>Cade il più votato</b><p>Chi aveva indovinato prende i punti.</p></div></div>
        </div>
      </>}
      {i === 2 && <>
        <h2 className="isl-h sm">Come si fanno<br />i punti</h2>
        <div className="pp isl-steps"><PointsKey /><div className="isl-note">Si sommano: nello stesso turno puoi fare più punti. Gli esempi con le carte li trovi in «i».</div></div>
      </>}
      <div className="isl-ba"><Btn onClick={() => (last ? onClose() : setI(i + 1))} testId="intro-next">{last ? "Ho capito, giochiamo" : "Avanti ›"}</Btn></div>
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
    <div className="isl mega" role="dialog" aria-label="Sei il Megafono" data-testid="mega-intro">
      <div className="sky" /><div className="skyg" /><div className="skyh" />
      <div className="mbig"><i>📣</i></div>
      <h2 className="isl-h gold">Sei il Megafono!</h2><p className="isl-cur">Questo turno comandi tu</p>
      <div className="pp isl-steps tight">
        <div className="st"><i className="ic">1</i><div><b>Scegli la frase</b><p>Una delle proposte, oppure inventane una.</p></div></div>
        <div className="st"><i className="ic">2</i><div><b>Metti il Lui!</b><p>Quando le carte salgono, scommetti su quanti voti prenderà una carta.</p></div></div>
        <div className="st"><i className="ic">3</i><div><b>Vota anche tu</b><p>Come tutti. Il tuo voto non conta per il Lui!.</p></div></div>
        <div className="isl-n"><b>{megafonoSa ? "Giochi una carta come gli altri." : "Non giochi carte"}</b>{megafonoSa ? "" : ": la Torre ne ha una a caso dal mazzo."}</div>
        <div className="isl-n g"><b>Come fai punti:</b> <em>+2</em> se voti la carta che cade · Lui! azzeccato <em>+5…16</em> (mancato: 0)</div>
      </div>
      <div className="isl-ba">
        <Btn onClick={() => onClose(off)} testId="mega-ok">Ho capito</Btn>
        <label className="isl-chk"><input type="checkbox" checked={off} onChange={(e) => setOff(e.target.checked)} data-testid="mega-off" /> Non mostrare più questa scheda</label>
      </div>
    </div>
  );
}
