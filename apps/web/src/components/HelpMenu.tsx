import { Btn } from "../ui.tsx";

interface Props { canHint: boolean; sound?: boolean; setSound?: (v: boolean) => void; onHint: () => void; onTutorial: () => void; onRules: () => void; onClose: () => void }

/** Il «?» / «i»: prima di tutto cosa devo fare adesso, poi il tutorial e il regolamento completo. */
export default function HelpMenu({ canHint, sound, setSound, onHint, onTutorial, onRules, onClose }: Props) {
  return (
    <div className="brg help" role="dialog" aria-label="Aiuto" data-testid="help-menu">
      <div className="pap" /><div className="hr" /><div className="ht" />
      <div className="brg-h">
        <b>Aiuto</b>
        {setSound && <button className="bib" onClick={() => setSound(!sound)} aria-label={sound ? "Disattiva i suoni" : "Attiva i suoni"} data-testid="sound-toggle">{sound ? "🔊" : "🔇"}</button>}
        <button className="bib" onClick={onClose} aria-label="Chiudi" data-testid="help-x">×</button>
      </div>
      <div className="help-body">
        <button className={`help-it ${canHint ? "main" : "off"}`} onClick={canHint ? onHint : undefined} disabled={!canHint} data-testid="help-hint">
          <i>💡</i><span><b>Cosa devo fare adesso?</b><small>{canHint ? "Ti mostro la prossima mossa, con una freccia." : "Adesso tocca agli altri: aspetta il tuo turno."}</small></span>
        </button>
        <button className="help-it" onClick={onTutorial} data-testid="help-tutorial"><i>🎓</i><span><b>Rivedi il tutorial</b><small>Tre schermate veloci: scopo, passi del turno, punti.</small></span></button>
        <button className="help-it" onClick={onRules} data-testid="help-rules"><i>📖</i><span><b>Regolamento completo</b><small>Il turno, i punti con esempi, il Lui!, la fine. Qui puoi anche uscire dalla partita.</small></span></button>
      </div>
      <div className="brg-f"><Btn onClick={onClose} testId="help-close">Torna al gioco</Btn></div>
    </div>
  );
}
