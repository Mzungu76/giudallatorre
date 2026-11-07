import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Stage, Btn, Chips, Toast, navigate } from "../ui.tsx";
import { createRoom, joinRoom, errText } from "../lib/api.ts";
import type { BotLevel } from "../lib/api.ts";
import { saveSession, loadSession, lastNickname, rememberNickname } from "../lib/session.ts";

const CODE_CHARS = /[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]/g;

export function CreateScreen() {
  const solo = /[?&]solo=1/.test(location.search);
  const [nick, setNick] = useState(lastNickname()), [mode, setMode] = useState<"table" | "remote">("table"), [sa, setSa] = useState(false);
  const [bots, setBots] = useState(solo ? 3 : 0), [level, setLevel] = useState<BotLevel>("medium");
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setErr(null);
    try { const s = await createRoom(nick, mode, sa, { count: bots, level }); saveSession(s, nick.trim()); rememberNickname(nick.trim()); navigate(`/stanza/${s.code}`); }
    catch (x) { setErr(errText(x)); setBusy(false); }
  }
  return (
    <Stage testId="create">
      <Chips left={<a onClick={() => navigate("/")} role="button" tabIndex={0}>‹ Indietro</a>} />
      <form onSubmit={submit}>
        <div className="fscroll">
        <div className="h r" style={{ top: 70 }}><small>Prima di salire…</small>Crea la partita</div>
        <div className="fld" style={{ top: 196 }}>
          <label className="lb" htmlFor="nick">Il tuo nickname</label>
          <input id="nick" className="in" data-testid="nick" value={nick} maxLength={16} autoComplete="nickname" onChange={(e) => setNick(e.target.value)} placeholder="Es. Marta" />
        </div>
        <div className="fld" style={{ top: 292 }}>
          <span className="lb">Come si gioca?</span>
          <div className="seg">
            <button type="button" className={`bt ${mode === "table" ? "mus on" : "pap"}`} onClick={() => setMode("table")} data-testid="mode-table">Stesso tavolo</button>
            <button type="button" className={`bt ${mode === "remote" ? "mus on" : "pap"}`} onClick={() => setMode("remote")} data-testid="mode-remote">A distanza</button>
          </div>
          <div className="hint">{mode === "table" ? "Tutti insieme, ognuno col proprio telefono. Un tablet o un PC può fare da schermo condiviso." : "Ognuno da casa sua: serve una chiamata o una chat per scherzare a voce."}</div>
        </div>
        <label className="pp opt-pp" style={{ top: 470 }}>
          <input type="checkbox" checked={sa} onChange={(e) => setSa(e.target.checked)} data-testid="mega-sa" />
          <span className={`sw ${sa ? "on" : ""}`} aria-hidden />
          <span><b>Il Megafono sa</b><small>Il Megafono gioca una carta dalla sua mano invece di pescarla. Più strategia, meno caos.</small></span>
        </label>
        <div className="fld" data-testid="bots-box">
          <span className="lb">Giocatori virtuali (bot)</span>
          <div className="seg">
            <button type="button" className="bt pap" onClick={() => setBots(Math.max(0, bots - 1))} aria-label="Meno bot" data-testid="bots-minus">−</button>
            <div className="bt pap" style={{ flex: 2, pointerEvents: "none" }} data-testid="bots-count">{bots === 0 ? "Nessuno" : `${bots} bot`}</div>
            <button type="button" className="bt pap" onClick={() => setBots(Math.min(7, bots + 1))} aria-label="Più bot" data-testid="bots-plus">+</button>
          </div>
          {bots > 0 && <div className="seg" style={{ marginTop: 6 }}>
            {([["easy", "Facile"], ["medium", "Medio"], ["hard", "Difficile"]] as const).map(([k, l]) => <button key={k} type="button" className={`bt ${level === k ? "mus on" : "pap"}`} onClick={() => setLevel(k)} data-testid={`bot-${k}`} style={{ fontSize: 14 }}>{l}</button>)}
          </div>}
          <div className="hint">{bots === 0 ? "Se siete in pochi, aggiungi bot per arrivare ad almeno 3 giocatori. Potrai cambiarli anche nella lobby." : "I bot giocano a carte coperte e votano come un avversario vero. Con 2 bot e te la partita parte subito."}</div>
        </div>
        </div>
        <Btn type="submit" disabled={busy || !nick.trim()} style={{ position: "absolute", left: 16, right: 16, bottom: 24, zIndex: 30 }} testId="create-submit">{busy ? "Creo…" : "Crea e invita gli amici"}</Btn>
      </form>
      <Toast text={err} />
    </Stage>
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
    <Stage testId="join">
      <Chips left={<a onClick={() => navigate("/")} role="button" tabIndex={0}>‹ Indietro</a>} />
      <form onSubmit={submit}>
        <div className="fscroll">
        <div className="h r" style={{ top: 70 }}><small>Hai il codice?</small>Entra in partita</div>
        <div className="fld" style={{ top: 196 }}>
          <label className="lb" htmlFor="code">Codice partita</label>
          <input id="code" className="in code" data-testid="code" value={code} onChange={(e) => setCode(clean(e.target.value))} placeholder="TORRE" autoCapitalize="characters" autoComplete="off" inputMode="text" />
        </div>
        <div className="fld" style={{ top: 310 }}>
          <label className="lb" htmlFor="nick">Il tuo nickname</label>
          <input id="nick" className="in" data-testid="nick" value={nick} maxLength={16} onChange={(e) => setNick(e.target.value)} placeholder="Es. Giulia" />
        </div>
        <div className="fld" style={{ top: 420 }}>
          <a className="lnk" onClick={() => code.length === 5 && navigate(`/schermo/${code}`)} role="button" tabIndex={0} data-testid="open-display">Sono un tablet o un PC: apri lo schermo condiviso</a>
        </div>
        </div>
        <Btn type="submit" disabled={busy || code.length !== 5 || !nick.trim()} style={{ position: "absolute", left: 16, right: 16, bottom: 24, zIndex: 30 }} testId="join-submit">{busy ? "Entro…" : "Entra"}</Btn>
      </form>
      <Toast text={err} />
    </Stage>
  );
}
