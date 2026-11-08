import { useState } from "react";
import type { LuiSpec } from "@gdt/game-engine";
import { Btn } from "../ui.tsx";
import { luiTok } from "../scene/draw.ts";

const TABS = ["Il turno", "I punti", "Il Lui!", "Fine"];
const DEMO: LuiSpec[] = [{ slot: "zero", k: 0, pts: 5 }, { slot: "k3", k: 3, pts: 14 }] as LuiSpec[];

const Step = ({ ic, t, x }: { ic: string; t: string; x: string }) => <div className="brg-step"><span className="how-ic">{ic}</span><div><b>{t}</b><p>{x}</p></div></div>;
const Pts = ({ v, t, x, z }: { v: string; t: string; x: string; z?: boolean }) => <div className="brg-row"><span className={`v ${z ? "z" : ""}`}>{v}</span><div><b>{t}</b><p>{x}</p></div></div>;
const Note = ({ t, children }: { t: string; children: string }) => <div className="brg-note"><b>{t}</b>{children}</div>;

/** Regolamento a schede: il turno, i punti, i segnalini Lui!, la fine della partita. Si apre dalla Home e dal tasto «i» del pannello. */
export default function HowTo({ onClose, tokens, sound, setSound, onLeave, leaveHint }: { onClose: () => void; tokens?: LuiSpec[]; sound?: boolean; setSound?: (v: boolean) => void; /** Solo in partita: esce dalla stanza (chiede conferma). */ onLeave?: () => void; leaveHint?: string }) {
  const [tab, setTab] = useState(0), [askLeave, setAskLeave] = useState(false), tk = tokens && tokens.length >= 2 ? tokens : DEMO;
  return (
    <div className="brg" role="dialog" aria-label="Regolamento" data-testid="howto">
      <div className="pap" /><div className="hr" /><div className="ht" />
      <div className="brg-h">
        <b>Regolamento</b>
        {setSound && <button className="bib" onClick={() => setSound(!sound)} aria-label={sound ? "Disattiva i suoni" : "Attiva i suoni"} data-testid="sound-toggle">{sound ? "🔊" : "🔇"}</button>}
        <button className="bib" onClick={onClose} aria-label="Chiudi" data-testid="howto-x">×</button>
      </div>
      <div className="brg-tabs" role="tablist">{TABS.map((t, i) => <button key={t} role="tab" aria-selected={tab === i} className={tab === i ? "on" : ""} onClick={() => setTab(i)}>{t}</button>)}</div>
      <div className="brg-body" data-testid="howto-body">
        {tab === 0 && <>
          <div className="brg-q">Chi butteresti giù dalla torre oggi?<small>Si accusa, si vota in segreto e si ride. Sotto la torre ci sono i materassi.</small></div>
          <Step ic="📣" t="Il Megafono urla" x="Sceglie una frase che comincia con «Oggi sale sulla torre…». A ogni turno tocca a uno di voi." />
          <Step ic="🃏" t="La Folla gioca" x="Tutti gli altri scelgono in segreto, dalla propria mano, il personaggio che farebbe di sicuro quella cosa." />
          <Step ic="🎯" t="Il Lui!" x="Le carte salgono sulla torre, mescolate e numerate. Il Megafono mette un gettone Lui! su una carta e scommette su quanti voti prenderà." />
          <Step ic="🗳" t="Il voto" x="Tutti votano in segreto la carta che somiglia di più alla frase, anche la propria. La più votata cade." />
          <Step ic="⭐" t="I punti" x="Si contano i punti e il Megafono passa al giocatore dopo." />
          <Note t="Pareggio">Se più carte hanno gli stessi voti decide il Megafono. Se ha votato una di quelle, cade solo la sua. Altrimenti cadono tutte.</Note>
        </>}
        {tab === 1 && <>
          <Pts v="+2" t="Voto giusto" x="Hai votato la carta che cade." />
          <Pts v="+2" t="Carta caduta" x="Hai giocato la carta che cade. La carta pescata dal mazzo non è di nessuno." />
          <Pts v="+5/14" t="Lui! azzeccato" x="Solo per il Megafono: la carta del gettone prende i voti indicati sul gettone." />
          <Pts v="0" t="Lui! mancato" x="Il Megafono non perde punti, ma il gettone è usato." z />
          <Note t="Si sommano">Nello stesso turno puoi prendere punti per più motivi.</Note>
        </>}
        {tab === 2 && <>
          {tk.slice(0, 2).map((sp) => <div className="brg-lui" key={sp.slot}><span className="tk" dangerouslySetInnerHTML={{ __html: luiTok(sp, 76) }} /><div><b>{sp.slot === "zero" ? "Nessun voto" : `Almeno ${sp.k} voti`} · +{sp.pts}</b><p>{sp.slot === "zero" ? "Scommetti che nessuno degli altri vota la carta del gettone." : `Scommetti che almeno ${sp.k} giocatori votano la carta del gettone. La soglia cambia a ogni partita.`}</p></div></div>)}
          <Note t="Come funziona">Ogni partita ha 2 gettoni, uguali per tutti, e ognuno si usa una sola volta. Contano solo i voti degli altri, non il tuo. I tuoi li vedi in basso a sinistra: toccali per ingrandirli. Quelli degli altri vanno ricordati.</Note>
          <Note t="Esempio">Metti «Almeno 3 voti» sul n. 2. Tre giocatori votano il n. 2: prendi 14 punti.</Note>
        </>}
        {tab === 3 && <>
          <Note t="Quando finisce">Si gioca finché tutti hanno fatto il Megafono: due volte in 3 giocatori (6 turni), una volta con 4–8 (un turno a testa). Vince chi ha più punti. In caso di parità si fanno turni di spareggio.</Note>
          <Note t="Intervallo">Fino a 5 giocatori c'è un mini-gioco a metà partita, da 6 a 8 ce ne sono due (uno diverso dall'altro): L'Accusa, La storia d'amore o Il peggiore. Non c'è il Megafono e la tua mano viene sostituita da 5 carte nuove. Le regole vengono spiegate prima di cominciare.</Note>
          <Note t="Parlare è permesso">Si può chiacchierare e bluffare quanto si vuole. L'unica regola è non rivelare la propria carta prima del voto.</Note>
        </>}
      </div>
      <div className="brg-f">
        {onLeave && (askLeave
          ? <div className="leave-box" data-testid="leave-confirm"><p>{leaveHint}</p><div className="leave-row"><Btn kind="pap" onClick={() => setAskLeave(false)} testId="leave-no">Resto</Btn><Btn kind="red" onClick={onLeave} testId="leave-yes">Sì, esco</Btn></div></div>
          : <a className="lnk leave-lnk" role="button" tabIndex={0} onClick={() => setAskLeave(true)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAskLeave(true); } }} data-testid="leave-game">Esci dalla partita</a>)}
        <Btn onClick={onClose} testId="howto-close">Ho capito</Btn>
      </div>
    </div>
  );
}
