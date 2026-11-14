import { useState } from "react";
import { Btn } from "../ui.tsx";
import { t, ts } from "../lib/testi.ts";
import VolumeSlider from "./VolumeSlider.tsx";

interface Props { canHint: boolean; sound?: boolean; setSound?: (v: boolean) => void; onHint: () => void; onTutorial: () => void; onRules: () => void; onClose: () => void; /** Solo in partita: esce dalla stanza (chiede conferma). */ onLeave?: () => void; leaveHint?: string }

/** Il «?» / «i»: prima di tutto cosa devo fare adesso, poi il tutorial e il regolamento completo. */
export default function HelpMenu({ canHint, sound, setSound, onHint, onTutorial, onRules, onClose, onLeave, leaveHint }: Props) {
  const [askLeave, setAskLeave] = useState(false);
  return (
    <div className="brg help" role="dialog" aria-label={ts("help.aria")} data-testid="help-menu">
      <div className="pap" /><div className="hr" /><div className="ht" />
      <div className="brg-h">
        <b>{t("help.titolo")}</b>
        {setSound && <button className="bib" onClick={() => setSound(!sound)} aria-label={sound ? ts("help.suoni.off") : ts("help.suoni.on")} data-testid="sound-toggle">{sound ? "🔊" : "🔇"}</button>}
        <button className="bib" onClick={onClose} aria-label={ts("help.chiudi")} data-testid="help-x">×</button>
      </div>
      <div className="help-body">
        {setSound && <VolumeSlider />}
        <button className={`help-it ${canHint ? "main" : "off"}`} onClick={canHint ? onHint : undefined} disabled={!canHint} data-testid="help-hint">
          <i>💡</i><span><b>{t("help.hint.t")}</b><small>{canHint ? t("help.hint.si") : t("help.hint.no")}</small></span>
        </button>
        <button className="help-it" onClick={onTutorial} data-testid="help-tutorial"><i>🎓</i><span><b>{t("help.tutorial.t")}</b><small>{t("help.tutorial.x")}</small></span></button>
        <button className="help-it" onClick={onRules} data-testid="help-rules"><i>📖</i><span><b>{t("help.regole.t")}</b><small>{t("help.regole.x")}</small></span></button>
        {onLeave && (askLeave
          ? <div className="leave-box" data-testid="help-leave-confirm"><p>{leaveHint}</p><div className="leave-row"><Btn kind="pap" onClick={() => setAskLeave(false)} testId="help-leave-no">{t("how.resto")}</Btn><Btn kind="red" onClick={onLeave} testId="help-leave-yes">{t("how.esco")}</Btn></div></div>
          : <button className="help-it" onClick={() => setAskLeave(true)} data-testid="help-leave"><i>🚪</i><span><b>{t("help.esci")}</b><small>{t("help.esci.x")}</small></span></button>)}
      </div>
      <div className="brg-f"><Btn onClick={onClose} testId="help-close">{t("help.torna")}</Btn></div>
    </div>
  );
}
