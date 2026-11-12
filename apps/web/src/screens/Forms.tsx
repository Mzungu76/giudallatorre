import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Stage, Btn, Toast, navigate } from "../ui.tsx";
import { createRoom, joinRoom, errText } from "../lib/api.ts";
import type { BotLevel } from "../lib/api.ts";
import { saveSession, loadSession, lastNickname, rememberNickname } from "../lib/session.ts";
import { t, ts } from "../lib/testi.ts";
import type { TestoKey } from "../lib/testi.ts";

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
          <button type="button" className="bib big" onClick={() => navigate("/")} aria-label={ts("fm.indietro")}>‹</button>
          <div className="h r"><small>{t("fm.crea.sopra")}</small>{t("fm.crea.titolo")}</div>
        </div>
        <div className="fbody">
          <div className="fld">
            <label className="lb" htmlFor="nick">{t("fm.nick")}</label>
            <input id="nick" className="in" data-testid="nick" value={nick} maxLength={16} autoComplete="nickname" onChange={(e) => setNick(e.target.value)} placeholder={ts("fm.nick.ph.crea")} />
          </div>
          <div className="fld">
            <span className="lb">{t("fm.dove")}</span>
            <div className="seg">
              <button type="button" className={`bt ${mode === "table" ? "mus on" : "pap"}`} onClick={() => setMode("table")} data-testid="mode-table">{t("fm.tavolo")}</button>
              <button type="button" className={`bt ${mode === "remote" ? "mus on" : "pap"}`} onClick={() => setMode("remote")} data-testid="mode-remote">{t("fm.distanza")}</button>
            </div>
            <div className="hint">{mode === "table" ? t("fm.tavolo.x") : t("fm.distanza.x")}</div>
          </div>
          <label className="pp opt-pp">
            <input type="checkbox" checked={sa} onChange={(e) => setSa(e.target.checked)} data-testid="mega-sa" />
            <span className={`sw ${sa ? "on" : ""}`} aria-hidden />
            <span><b>{t("fm.sa.t")}</b><small>{t("fm.sa.x")}</small></span>
          </label>
          <div className="fld" data-testid="bots-box">
            <span className="lb">{t("fm.bot")}</span>
            <div className="seg cnt">
              <button type="button" className="bt pap" onClick={() => setBots(Math.max(0, bots - 1))} aria-label={ts("fm.bot.meno")} data-testid="bots-minus">−</button>
              <div className="bt pap" style={{ pointerEvents: "none" }} data-testid="bots-count">{bots === 0 ? t("fm.bot.nessuno") : ts("fm.bot.n", { n: bots })}</div>
              <button type="button" className="bt pap" onClick={() => setBots(Math.min(5, bots + 1))} aria-label={ts("fm.bot.piu")} data-testid="bots-plus">+</button>
            </div>
            {bots > 0 && <div className="seg">
              {(["easy", "medium", "hard"] as const).map((k) => <button key={k} type="button" className={`bt ${level === k ? "mus on" : "pap"}`} onClick={() => setLevel(k)} data-testid={`bot-${k}`} style={{ fontSize: 15 }}>{t(`fm.lv.${k}` as TestoKey)}</button>)}
            </div>}
            <div className="hint">{t("fm.bot.x")}</div>
          </div>
        </div>
        <div className="fbot"><Btn type="submit" disabled={busy || !nick.trim()} testId="create-submit">{busy ? t("fm.creo") : t("fm.crea")}</Btn></div>
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
          <button type="button" className="bib big" onClick={() => navigate("/")} aria-label={ts("fm.indietro")}>‹</button>
          <div className="h r"><small>{t("fm.entra.sopra")}</small>{t("fm.entra.titolo")}</div>
        </div>
        <div className="fbody">
          <div className="fld">
            <label className="lb" htmlFor="code">{t("fm.codice")}</label>
            <input id="code" className="in code" data-testid="code" value={code} onChange={(e) => setCode(clean(e.target.value))} placeholder={ts("fm.codice.ph")} autoCapitalize="characters" autoComplete="off" inputMode="text" />
          </div>
          <div className="fld">
            <label className="lb" htmlFor="nick">{t("fm.nick")}</label>
            <input id="nick" className="in" data-testid="nick" value={nick} maxLength={16} onChange={(e) => setNick(e.target.value)} placeholder={ts("fm.nick.ph.entra")} />
          </div>
        </div>
        <div className="fbot">
          <a className="lnk" onClick={() => code.length === 5 && navigate(`/schermo/${code}`)} role="button" tabIndex={0} data-testid="open-display">{t("fm.schermo")}</a>
          <Btn type="submit" disabled={busy || code.length !== 5 || !nick.trim()} testId="join-submit">{busy ? t("fm.entro") : t("fm.entra")}</Btn>
        </div>
      </form>
      <Toast text={err} />
    </Stage>
  );
}
