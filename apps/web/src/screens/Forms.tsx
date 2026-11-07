import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Stage, Btn, Toast, navigate } from "../ui.tsx";
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
      <form className="fpage" onSubmit={submit}>
        <div className="fhead">
          <button type="button" className="bib big" onClick={() => navigate("/")} aria-label="Indietro">‹</button>
          <div className="h r"><small>Prima di salire…</small>Crea la partita</div>
        </div>
        <div className="fbody">
          <div className="fld">
            <label className="lb" htmlFor="nick">Il tuo nickname</label>
            <input id="nick" className="in" data-testid="nick" value={nick} maxLength={16} autoComplete="nickname" onChange={(e) => setNick(e.target.value)} placeholder="Es. Marta" />
          </div>
          <div className="fld">
            <span className="lb">Dove giocate?</span>
            <div className="seg">
              <button type="button" className={`bt ${mode === "table" ? "mus on" : "pap"}`} onClick={() => setMode("table")} data-testid="mode-table">Stesso tavolo</button>
              <button type="button" className={`bt ${mode === "remote" ? "mus on" : "pap"}`} onClick={() => setMode("remote")} data-testid="mode-remote">A distanza</button>
            </div>
            <div className="hint">{mode === "table" ? "Ognuno ha il proprio telefono. Un tablet o un PC può fare da schermo condiviso." : "Ognuno da casa: serve una chiamata o una chat per parlare."}</div>
          </div>
          <label className="pp opt-pp">
            <input type="checkbox" checked={sa} onChange={(e) => setSa(e.target.checked)} data-testid="mega-sa" />
            <span className={`sw ${sa ? "on" : ""}`} aria-hidden />
            <span><b>Il Megafono sa</b><small>Il Megafono gioca una carta della sua mano invece di pescarla.</small></span>
          </label>
          <div className="fld" data-testid="bots-box">
            <span className="lb">Bot</span>
            <div className="seg cnt">
              <button type="button" className="bt pap" onClick={() => setBots(Math.max(0, bots - 1))} aria-label="Meno bot" data-testid="bots-minus">−</button>
              <div className="bt pap" style={{ pointerEvents: "none" }} data-testid="bots-count">{bots === 0 ? "Nessuno" : `${bots} bot`}</div>
              <button type="button" className="bt pap" onClick={() => setBots(Math.min(7, bots + 1))} aria-label="Più bot" data-testid="bots-plus">+</button>
            </div>
            {bots > 0 && <div className="seg">
              {([["easy", "Facile"], ["medium", "Medio"], ["hard", "Difficile"]] as const).map(([k, l]) => <button key={k} type="button" className={`bt ${level === k ? "mus on" : "pap"}`} onClick={() => setLevel(k)} data-testid={`bot-${k}`} style={{ fontSize: 15 }}>{l}</button>)}
            </div>}
            <div className="hint">I bot giocano come avversari veri. In tutto servono almeno 3 giocatori.</div>
          </div>
        </div>
        <div className="fbot"><Btn type="submit" disabled={busy || !nick.trim()} testId="create-submit">{busy ? "Creo…" : "Crea partita"}</Btn></div>
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
      <form className="fpage" onSubmit={submit}>
        <div className="fhead">
          <button type="button" className="bib big" onClick={() => navigate("/")} aria-label="Indietro">‹</button>
          <div className="h r"><small>Hai un codice?</small>Entra in partita</div>
        </div>
        <div className="fbody">
          <div className="fld">
            <label className="lb" htmlFor="code">Codice partita</label>
            <input id="code" className="in code" data-testid="code" value={code} onChange={(e) => setCode(clean(e.target.value))} placeholder="TORRE" autoCapitalize="characters" autoComplete="off" inputMode="text" />
          </div>
          <div className="fld">
            <label className="lb" htmlFor="nick">Il tuo nickname</label>
            <input id="nick" className="in" data-testid="nick" value={nick} maxLength={16} onChange={(e) => setNick(e.target.value)} placeholder="Es. Giulia" />
          </div>
        </div>
        <div className="fbot">
          <a className="lnk" onClick={() => code.length === 5 && navigate(`/schermo/${code}`)} role="button" tabIndex={0} data-testid="open-display">Apri lo schermo condiviso (tablet o PC)</a>
          <Btn type="submit" disabled={busy || code.length !== 5 || !nick.trim()} testId="join-submit">{busy ? "Entro…" : "Entra"}</Btn>
        </div>
      </form>
      <Toast text={err} />
    </Stage>
  );
}
