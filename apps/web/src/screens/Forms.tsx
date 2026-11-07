import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Page, Btn, Toast, navigate } from "../ui.tsx";
import { createRoom, joinRoom, errText } from "../lib/api.ts";
import type { BotLevel } from "../lib/api.ts";
import { saveSession, loadSession, lastNickname, rememberNickname } from "../lib/session.ts";

const CODE_CHARS = /[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]/g;

const STEPS = ["Giocatori", "Regole", "Riepilogo"] as const;
const LEVELS = { easy: "Facile", medium: "Medio", hard: "Difficile" } as const;

/** Barra dei passaggi: sempre in alto, mostra a che punto sei. */
function Stepper({ step, onGo }: { step: number; onGo: (i: number) => void }) {
  return (
    <ol className="stepper" aria-label="Passaggi" data-testid="stepper">
      {STEPS.map((l, i) => (
        <li key={l} className={i === step ? "cur" : i < step ? "done" : ""} aria-current={i === step ? "step" : undefined}>
          <button type="button" onClick={() => i < step && onGo(i)} disabled={i >= step} aria-label={`${i + 1}. ${l}`}><i>{i < step ? "✓" : i + 1}</i><span>{l}</span></button>
        </li>
      ))}
    </ol>
  );
}

export function CreateScreen() {
  const solo = /[?&]solo=1/.test(location.search);
  const [nick, setNick] = useState(lastNickname()), [mode, setMode] = useState<"table" | "remote">("table"), [sa, setSa] = useState(false);
  const [bots, setBots] = useState(solo ? 3 : 0), [level, setLevel] = useState<BotLevel>("medium");
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const last = step === STEPS.length - 1, canNext = step > 0 || !!nick.trim();
  async function submit(e: FormEvent) {
    e.preventDefault(); if (busy) return;
    if (!last) { if (canNext) setStep(step + 1); return; }
    setBusy(true); setErr(null);
    try { const s = await createRoom(nick, mode, sa, { count: bots, level }); saveSession(s, nick.trim()); rememberNickname(nick.trim()); navigate(`/stanza/${s.code}`); }
    catch (x) { setErr(errText(x)); setBusy(false); }
  }
  const summary = (
    <aside className="pp pg-sum" data-testid="summary" aria-label="Riepilogo">
      <h4>Riepilogo</h4>
      <dl>
        <dt>Tu</dt><dd>{nick.trim() || "—"}</dd>
        <dt>Bot</dt><dd>{bots === 0 ? "Nessuno" : `${bots} · ${LEVELS[level]}`}</dd>
        <dt>Modalità</dt><dd>{mode === "table" ? "Stesso tavolo" : "A distanza"}</dd>
        <dt>Il Megafono sa</dt><dd>{sa ? "Sì" : "No"}</dd>
      </dl>
    </aside>
  );
  return (
    <Page testId="create">
      <form className="pg-form" onSubmit={submit}>
        <header className="pg-head">
          <a className="pg-back" onClick={() => (step > 0 ? setStep(step - 1) : navigate("/"))} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && (step > 0 ? setStep(step - 1) : navigate("/"))}>‹ Indietro</a>
          <div className="h r"><small>Prima di salire…</small>Crea la partita</div>
          <Stepper step={step} onGo={setStep} />
        </header>
        <div className="pg-body">
          <div className="pg-main">
            {step === 0 && (<>
              <div className="fld">
                <label className="lb" htmlFor="nick">Il tuo nickname</label>
                <input id="nick" className="in" data-testid="nick" value={nick} maxLength={16} autoComplete="nickname" onChange={(e) => setNick(e.target.value)} placeholder="Es. Marta" />
              </div>
              <div className="fld" data-testid="bots-box">
                <span className="lb">Giocatori virtuali (bot)</span>
                <div className="seg">
                  <button type="button" className="bt pap" onClick={() => setBots(Math.max(0, bots - 1))} aria-label="Meno bot" data-testid="bots-minus" style={{ fontSize: 30 }}>−</button>
                  <div className="bt pap" style={{ flex: 2, pointerEvents: "none" }} data-testid="bots-count">{bots === 0 ? "Nessuno" : `${bots} bot`}</div>
                  <button type="button" className="bt pap" onClick={() => setBots(Math.min(7, bots + 1))} aria-label="Più bot" data-testid="bots-plus" style={{ fontSize: 30 }}>+</button>
                </div>
                {bots > 0 && <div className="seg" style={{ marginTop: 8 }}>
                  {([["easy", "Facile"], ["medium", "Medio"], ["hard", "Difficile"]] as const).map(([k, l]) => <button key={k} type="button" className={`bt ${level === k ? "mus on" : "pap"}`} onClick={() => setLevel(k)} data-testid={`bot-${k}`} style={{ fontSize: 14 }}>{l}</button>)}
                </div>}
                <div className="hint">{bots === 0 ? "Se siete in pochi, aggiungi bot per arrivare ad almeno 3 giocatori. Potrai cambiarli anche nella lobby." : "I bot giocano a carte coperte e votano come un avversario vero. Con 2 bot e te la partita parte subito."}</div>
              </div>
            </>)}
            {step === 1 && (<>
              <div className="fld">
                <span className="lb">Come si gioca?</span>
                <div className="seg">
                  <button type="button" className={`bt ${mode === "table" ? "mus on" : "pap"}`} onClick={() => setMode("table")} data-testid="mode-table">Stesso tavolo</button>
                  <button type="button" className={`bt ${mode === "remote" ? "mus on" : "pap"}`} onClick={() => setMode("remote")} data-testid="mode-remote">A distanza</button>
                </div>
                <div className="hint">{mode === "table" ? "Tutti insieme, ognuno col proprio telefono. Un tablet o un PC può fare da schermo condiviso." : "Ognuno da casa sua: serve una chiamata o una chat per scherzare a voce."}</div>
              </div>
              <label className="pp opt-pp">
                <input type="checkbox" checked={sa} onChange={(e) => setSa(e.target.checked)} data-testid="mega-sa" />
                <span className={`sw ${sa ? "on" : ""}`} aria-hidden />
                <span><b>Il Megafono sa</b><small>Il Megafono gioca una carta dalla sua mano invece di pescarla. Più strategia, meno caos.</small></span>
              </label>
            </>)}
            {step === 2 && <div className="pg-sum-inline">{summary}</div>}
          </div>
          <div className="pg-side">{summary}</div>
        </div>
        <footer className="pg-nav">
          <Btn kind="pap" onClick={() => (step > 0 ? setStep(step - 1) : navigate("/"))} testId="step-back" style={{ fontSize: 19, flex: "0 0 34%" }}>‹ Indietro</Btn>
          {last
            ? <Btn type="submit" disabled={busy || !nick.trim()} testId="create-submit" style={{ flex: 1 }}>{busy ? "Creo…" : "Crea e invita gli amici"}</Btn>
            : <Btn type="submit" disabled={!canNext} testId="step-next" style={{ flex: 1 }}>Avanti ›</Btn>}
        </footer>
      </form>
      <Toast text={err} />
    </Page>
  );
}

export function JoinScreen({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode), [nick, setNick] = useState(lastNickname());
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (initialCode.length === 5 && loadSession(initialCode)) navigate(`/stanza/${initialCode}`); }, [initialCode]);
  const clean = (v: string) => v.toUpperCase().replace(CODE_CHARS, "").slice(0, 5);
  async function submit(e: FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setErr(null);
    try {
      const ex = loadSession(code); if (ex) { navigate(`/stanza/${code}`); return; }
      const s = await joinRoom(code, nick); saveSession(s, nick.trim()); rememberNickname(nick.trim()); navigate(`/stanza/${s.code}`);
    } catch (x) { setErr(errText(x)); setBusy(false); }
  }
  return (
    <Page testId="join">
      <form className="pg-form" onSubmit={submit}>
        <header className="pg-head">
          <a className="pg-back" onClick={() => navigate("/")} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && navigate("/")}>‹ Indietro</a>
          <div className="h r"><small>Hai il codice?</small>Entra in partita</div>
        </header>
        <div className="pg-body one">
          <div className="pg-main">
            <div className="fld">
              <label className="lb" htmlFor="code">Codice partita</label>
              <input id="code" className="in code" data-testid="code" value={code} onChange={(e) => setCode(clean(e.target.value))} placeholder="TORRE" autoCapitalize="characters" autoComplete="off" inputMode="text" />
            </div>
            <div className="fld">
              <label className="lb" htmlFor="nick">Il tuo nickname</label>
              <input id="nick" className="in" data-testid="nick" value={nick} maxLength={16} onChange={(e) => setNick(e.target.value)} placeholder="Es. Giulia" />
            </div>
            <a className="lnk" onClick={() => code.length === 5 && navigate(`/schermo/${code}`)} role="button" tabIndex={0} data-testid="open-display">Sono un tablet o un PC: apri lo schermo condiviso</a>
          </div>
        </div>
        <footer className="pg-nav">
          <Btn type="submit" disabled={busy || code.length !== 5 || !nick.trim()} testId="join-submit" style={{ flex: 1 }}>{busy ? "Entro…" : "Entra"}</Btn>
        </footer>
      </form>
      <Toast text={err} />
    </Page>
  );
}
