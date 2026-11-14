import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Stage, Btn, Toast, navigate } from "../ui.tsx";
import { createRoom, joinRoom, roomInfo, errText } from "../lib/api.ts";
import type { BotLevel } from "../lib/api.ts";
import { CHAR_COLORS, cardUrl, charName, tokenUrl } from "../lib/characters.ts";
import { saveSession, loadSession, lastNickname, rememberNickname } from "../lib/session.ts";
import { t, ts } from "../lib/testi.ts";
import type { TestoKey } from "../lib/testi.ts";

const CODE_CHARS = /[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]/g;

const AGES = [6, 10, 14, 18] as const, TIMERS = [0, 30, 60, 90, 120] as const;
type Age = (typeof AGES)[number]; type Timer = (typeof TIMERS)[number];

/** Il personaggio: carte con il segnalino, da far scorrere col dito come la mano di carte. Quella al centro è la scelta. */
function CharCarousel({ value, onChange, taken = [] }: { value: number; onChange: (i: number) => void; /** Personaggi già presi da altri: non si possono scegliere. */ taken?: number[] }) {
  const box = useRef<HTMLDivElement>(null), cur = useRef(value);
  const goTo = (i: number, smooth = true) => { const el = box.current, c = el?.children[i] as HTMLElement | undefined; if (el && c) el.scrollTo({ left: c.offsetLeft - (el.clientWidth - c.offsetWidth) / 2, behavior: smooth ? "smooth" : "auto" }); };
  useEffect(() => { goTo(value, false); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const onScroll = () => {
    const el = box.current; if (!el) return;
    const mid = el.scrollLeft + el.clientWidth / 2; let best = 0, d = 1e9;
    Array.from(el.children).forEach((c, i) => { const x = (c as HTMLElement).offsetLeft + (c as HTMLElement).offsetWidth / 2, dx = Math.abs(x - mid); if (dx < d) { d = dx; best = i; } });
    if (best !== cur.current) { cur.current = best; onChange(best); }
  };
  return (
    <div className="chars" data-testid="char-picker">
      <div className="chars-row" ref={box} onScroll={onScroll}>
        {CHAR_COLORS.map((col, i) => (
          <button type="button" key={col} className={`chc${i === value ? " on" : ""}${taken.includes(i) ? " taken" : ""}`} onClick={() => goTo(i)} data-testid={`char-${i}`} aria-label={charName(i)} aria-pressed={i === value}>
            <img className="chc-card" src={cardUrl(col)} alt="" draggable={false} />
            <img className="chc-tok" src={tokenUrl(col)} alt="" draggable={false} />
          </button>
        ))}
      </div>
      <div className="chars-name"><b>{charName(value)}</b>{taken.includes(value) && <small data-testid="char-taken">{t("fm.w.preso")}</small>}</div>
    </div>
  );
}

export function CreateScreen() {
  const solo = /[?&]solo=1/.test(location.search);
  const [step, setStep] = useState(0), [nick, setNick] = useState(lastNickname()), [char, setChar] = useState(() => Math.floor(Math.random() * 8));
  const [bots, setBots] = useState(solo ? 3 : 0), [level, setLevel] = useState<BotLevel>("medium");
  const [age, setAge] = useState<Age>(14), [timer, setTimer] = useState<Timer>(0);
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const LAST = 1, titles = ["fm.w.chi", "fm.w.ultimi"] as const;
  async function submit(e: FormEvent) {
    e.preventDefault(); if (busy) return;
    if (step < LAST) { if (step === 0 && !nick.trim()) return; setStep(step + 1); return; }
    setBusy(true); setErr(null);
    try { const s = await createRoom(nick, { count: bots, level }, { char, ageBand: age, turnTimerSec: timer, ...(/[?&]debug=bot/.test(location.search) ? { debug: true } : {}) }); saveSession(s, nick.trim()); rememberNickname(nick.trim()); navigate(`/stanza/${s.code}`); }
    catch (x) { setErr(errText(x)); setBusy(false); }
  }
  const back = () => (step > 0 ? setStep(step - 1) : navigate("/"));
  const faces = CHAR_COLORS.map((_, i) => i).filter((i) => i !== char).slice(0, 5);
  return (
    <Stage testId="create">
      <form className="fpage" onSubmit={submit}>
        <div className="fhead">
          <button type="button" className="bib big" onClick={back} aria-label={ts("fm.indietro")} data-testid="wiz-back">‹</button>
          <div className="h r"><small>{t("fm.crea.sopra")}</small>{t(titles[step]!)}</div>
        </div>
        <div className="wdots" role="img" aria-label={ts("fm.w.passo", { n: step + 1, tot: LAST + 1 })}>{[0, 1].map((k) => <i key={k} className={k <= step ? "on" : ""} />)}</div>
        <div className="fbody">
          {step === 0 && <>
            <div className="fld">
              <label className="lb" htmlFor="nick">{t("fm.nick")}</label>
              <input id="nick" className="in" data-testid="nick" value={nick} maxLength={16} autoComplete="nickname" onChange={(e) => setNick(e.target.value)} placeholder={ts("fm.nick.ph.crea")} />
            </div>
            <div className="fld grow"><span className="lb">{t("fm.w.pers")}</span><CharCarousel value={char} onChange={setChar} /></div>
          </>}
          {step === 1 && <>
            <div className="fld sec sA" data-testid="bots-box">
              <span className="lb">{t("fm.w.bot")}</span>
              <div className="wstep">
                <button type="button" className="wpm" onClick={() => setBots(Math.max(0, bots - 1))} aria-label={ts("fm.bot.meno")} data-testid="bots-minus">−</button>
                <div className="wmid"><b data-testid="bots-count">{bots === 0 ? t("fm.bot.nessuno") : ts("fm.bot.n", { n: bots })}</b>
                  <div className="wfaces">{faces.map((f, k) => <img key={f} src={tokenUrl(CHAR_COLORS[f]!)} alt="" className={k < bots ? "" : "off"} />)}</div></div>
                <button type="button" className="wpm" onClick={() => setBots(Math.min(5, bots + 1))} aria-label={ts("fm.bot.piu")} data-testid="bots-plus">+</button>
              </div>
              {bots > 0 && <div className="wchips c g3">{(["easy", "medium", "hard"] as const).map((k) => <button key={k} type="button" className={`wchip${level === k ? " on" : ""}`} onClick={() => setLevel(k)} data-testid={`bot-${k}`}>{t(`fm.lv.${k}` as TestoKey)}</button>)}</div>}
            </div>
            <div className="fld sec sB"><span className="lb">{t("fm.w.pubblico")}</span>
              <div className="wchips g2">{AGES.map((a) => <button key={a} type="button" className={`wchip${age === a ? " on" : ""}`} onClick={() => setAge(a)} data-testid={`age-${a}`}>{t(`room.age.${a}` as TestoKey)}</button>)}</div></div>
            <div className="fld sec sC"><span className="lb">{t("fm.w.timer")}</span>
              <div className="wchips g5">{TIMERS.map((x) => <button key={x} type="button" className={`wchip${timer === x ? " on" : ""}`} onClick={() => setTimer(x)} data-testid={`timer-${x}`}>{x === 0 ? t("fm.w.libero") : ts("fm.w.sec", { n: x })}</button>)}</div></div>
          </>}
        </div>
        <div className="fbot">
          {step < LAST
            ? <Btn type="submit" disabled={step === 0 && !nick.trim()} testId="wiz-next">{t("fm.w.avanti")}</Btn>
            : <Btn type="submit" kind="red" disabled={busy || !nick.trim()} testId="create-submit">{busy ? t("fm.creo") : t("fm.crea")}</Btn>}
        </div>
      </form>
      <Toast text={err} />
    </Stage>
  );
}

export function JoinScreen({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode), [nick, setNick] = useState(lastNickname());
  const [step, setStep] = useState(0), [char, setChar] = useState(0), [taken, setTaken] = useState<number[]>([]);
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (initialCode.length === 5 && loadSession(initialCode)) navigate(`/stanza/${initialCode}`); }, [initialCode]);
  const clean = (v: string) => v.toUpperCase().replace(CODE_CHARS, "").slice(0, 5);
  async function submit(e: FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setErr(null);
    try {
      const ex = loadSession(code); if (ex) { navigate(`/stanza/${code}`); return; }
      if (step === 0) {
        // si guarda chi c'è già: i personaggi presi non si possono scegliere
        const info = await roomInfo(code), tk = info.taken ?? [], free = [0, 1, 2, 3, 4, 5, 6, 7].filter((c) => !tk.includes(c));
        if (info.exists === false) { setErr(ts("err.NOT_FOUND")); setBusy(false); return; }
        setTaken(tk); setChar(free.length ? free[Math.floor(Math.random() * free.length)]! : 0); setStep(1); setBusy(false); return;
      }
      const s = await joinRoom(code, nick, char); saveSession(s, nick.trim()); rememberNickname(nick.trim()); navigate(`/stanza/${s.code}`);
    } catch (x) { setErr(errText(x)); setBusy(false); }
  }
  const back = () => (step > 0 ? setStep(0) : navigate("/"));
  return (
    <Stage testId="join">
      <form className="fpage" onSubmit={submit}>
        <div className="fhead">
          <button type="button" className="bib big" onClick={back} aria-label={ts("fm.indietro")}>‹</button>
          <div className="h r"><small>{t("fm.entra.sopra")}</small>{step === 0 ? t("fm.entra.titolo") : t("fm.w.chi")}</div>
        </div>
        <div className="fbody">
          {step === 0 && <>
            <div className="fld">
              <label className="lb" htmlFor="code">{t("fm.codice")}</label>
              <input id="code" className="in code" data-testid="code" value={code} onChange={(e) => setCode(clean(e.target.value))} placeholder={ts("fm.codice.ph")} autoCapitalize="characters" autoComplete="off" inputMode="text" />
            </div>
            <div className="fld">
              <label className="lb" htmlFor="nick">{t("fm.nick")}</label>
              <input id="nick" className="in" data-testid="nick" value={nick} maxLength={16} onChange={(e) => setNick(e.target.value)} placeholder={ts("fm.nick.ph.entra")} />
            </div>
          </>}
          {step === 1 && <div className="fld grow"><span className="lb">{t("fm.w.pers")}</span><CharCarousel value={char} onChange={setChar} taken={taken} /></div>}
        </div>
        <div className="fbot">
                    {step === 0
            ? <Btn type="submit" disabled={busy || code.length !== 5 || !nick.trim()} testId="wiz-next">{busy ? t("fm.entro") : t("fm.w.avanti")}</Btn>
            : <Btn type="submit" disabled={busy || taken.includes(char)} testId="join-submit">{busy ? t("fm.entro") : t("fm.entra")}</Btn>}
        </div>
      </form>
      <Toast text={err} />
    </Stage>
  );
}
