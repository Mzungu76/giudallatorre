import { useState } from "react";
import type { ReactNode } from "react";
import type { LuiSpec } from "@gdt/game-engine";
import { Btn } from "../ui.tsx";
import { luiTok } from "../scene/draw.ts";
import { luiEffectHow, luiLabel } from "../lib/lui.ts";
import { ExampleLui, ExampleTurn, PointsKey } from "./PointsExamples.tsx";
import { t, ts } from "../lib/testi.ts";
import type { TestoKey } from "../lib/testi.ts";
import { MegaIcon } from "./MegaIcon.tsx";

const DEMO: LuiSpec[] = [{ slot: "cade", k: 0, pts: 4, effect: "cade" }, { slot: "noncade", k: 0, pts: 2, effect: "noncade" }, { slot: "nulli", k: 0, pts: 0, effect: "nulli" }];

const Step = ({ ic, t, x }: { ic: ReactNode; t: ReactNode; x: ReactNode }) => <div className="brg-step"><span className="how-ic">{ic}</span><div><b>{t}</b><p>{x}</p></div></div>;
const Note = ({ t, children }: { t: ReactNode; children: ReactNode }) => <div className="brg-note"><b>{t}</b>{children}</div>;

/** Regolamento a schede: il turno, i punti, i segnalini Lui!, la fine della partita. Si apre dalla Home e dal tasto «i» del pannello. */
export default function HowTo({ onClose, sound, setSound, onLeave, leaveHint }: { onClose: () => void; sound?: boolean; setSound?: (v: boolean) => void; /** Solo in partita: esce dalla stanza (chiede conferma). */ onLeave?: () => void; leaveHint?: string }) {
  const [tab, setTab] = useState(0), [askLeave, setAskLeave] = useState(false), tk = DEMO;
  return (
    <div className="brg" role="dialog" aria-label={ts("how.aria")} data-testid="howto">
      <div className="pap" /><div className="hr" /><div className="ht" />
      <div className="brg-h">
        <b>{t("how.titolo")}</b>
        {setSound && <button className="bib" onClick={() => setSound(!sound)} aria-label={sound ? ts("help.suoni.off") : ts("help.suoni.on")} data-testid="sound-toggle">{sound ? "🔊" : "🔇"}</button>}
        <button className="bib" onClick={onClose} aria-label={ts("help.chiudi")} data-testid="howto-x">×</button>
      </div>
      <div className="brg-tabs" role="tablist">{[0, 1, 2, 3].map((i) => <button key={i} role="tab" aria-selected={tab === i} className={tab === i ? "on" : ""} onClick={() => setTab(i)}>{t(`how.tab.${i}` as TestoKey)}</button>)}</div>
      <div className="brg-body" data-testid="howto-body">
        {tab === 0 && <>
          <div className="brg-q">{t("how.1.q")}<small>{t("how.1.qs")}</small></div>
          <Step ic={<MegaIcon s={24} />} t={t("how.1.p1.t")} x={t("how.1.p1.x")} />
          <Step ic="🃏" t={t("how.1.p2.t")} x={t("how.1.p2.x")} />
          <Step ic="🎯" t={t("how.1.p3.t")} x={t("how.1.p3.x")} />
          <Step ic="🗳" t={t("how.1.p4.t")} x={t("how.1.p4.x")} />
          <Step ic="⭐" t={t("how.1.p5.t")} x={t("how.1.p5.x")} />
          <Note t={t("how.1.pari.t")}>{t("how.1.pari.x")}</Note>
        </>}
        {tab === 1 && <>
          <PointsKey />
          <Note t={t("how.2.somm.t")}>{t("how.2.somm.x")}</Note>
          <ExampleTurn />
        </>}
        {tab === 2 && <>
          {tk.map((sp) => <div className="brg-lui" key={sp.slot}><span className="tk" dangerouslySetInnerHTML={{ __html: luiTok(sp, 76) }} /><div><b>{luiLabel(sp)}</b><p>{luiEffectHow(sp)}</p></div></div>)}
          <ExampleLui />
        </>}
        {tab === 3 && <>
          <Step ic="🏁" t={t("how.4.fine.t")} x={t("how.4.fine.x")} />
          <Step ic="🎭" t={t("how.4.int.t")} x={t("how.4.int.x")} />
          <Step ic="🗣" t={t("how.4.parla.t")} x={t("how.4.parla.x")} />
        </>}
      </div>
      <div className="brg-f">
        {onLeave && (askLeave
          ? <div className="leave-box" data-testid="leave-confirm"><p>{leaveHint}</p><div className="leave-row"><Btn kind="pap" onClick={() => setAskLeave(false)} testId="leave-no">{t("how.resto")}</Btn><Btn kind="red" onClick={onLeave} testId="leave-yes">{t("how.esco")}</Btn></div></div>
          : <a className="lnk leave-lnk" role="button" tabIndex={0} onClick={() => setAskLeave(true)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAskLeave(true); } }} data-testid="leave-game">{t("how.esci")}</a>)}
        <Btn onClick={onClose} testId="howto-close">{t("how.ok")}</Btn>
      </div>
    </div>
  );
}
