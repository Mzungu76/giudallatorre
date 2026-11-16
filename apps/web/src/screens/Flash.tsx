import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Btn, FAST, navigate, useNow } from "../ui.tsx";
import { useAudio } from "../lib/audio.ts";
import { cardFull, useCards } from "../lib/cards.ts";
import { sfx } from "../lib/sfx.ts";
import { t, ts } from "../lib/testi.ts";
import { cella, dayId, loadFlash, numeroDelGiorno, playedToday, registra, saveFlash, secondiAMezzanotte, testoDaCondividere, torreIndex } from "../lib/flash.ts";
import type { FlashDb, Indice, Torre } from "../lib/flash.ts";

const clock = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/** «Flash»: un turno secco già pronto. Si vota, il segnalino si scopre, cadono le carte, si vedono i punti. */
export default function Flash() {
  const { sound } = useAudio(), ready = useCards(), day = useMemo(() => dayId(), []), now = useNow(1000);
  const [db, setDb] = useState<FlashDb>(loadFlash), [k, setK] = useState(() => playedToday(loadFlash(), day));
  const [idx, setIdx] = useState<Indice | null>(null), [torre, setTorre] = useState<Torre | null>(null), [err, setErr] = useState(0);
  const [pick, setPick] = useState<number | null>(null), [voto, setVoto] = useState<number | null>(null), [rev, setRev] = useState(0), [copied, setCopied] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);
  useEffect(() => { let on = true; fetch("/oggi/indice.json").then((r) => (r.ok ? r.json() : Promise.reject())).then((x: Indice) => { if (on) setIdx(x); }).catch(() => { if (on) setErr((e) => e + 1); }); return () => { on = false; }; }, [err > 0 ? err : 0]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!idx) return; let on = true; setTorre(null); setPick(null); setVoto(null); setRev(0); setCopied(false);
    fetch(`/oggi/${torreIndex(idx, day, k)}.json`).then((r) => (r.ok ? r.json() : Promise.reject())).then((x: Torre) => { if (on) setTorre(x); }).catch(() => { if (on) setErr((e) => e + 1); });
    return () => { on = false; };
  }, [idx, k, day]);

  const numero = idx ? numeroDelGiorno(idx, day) : 1, esito = torre && voto !== null ? torre.esiti[voto] : null;
  const vota = () => {
    if (!torre || pick === null || voto !== null) return;
    setVoto(pick); const nd = registra(db, day, numero, k, torre, pick); setDb(nd); saveFlash(nd);
    const e = torre.esiti[pick]!; sfx.drum(sound, 1);
    const at = FAST ? [0, 0, 0] : [900, 1900, 3000];
    timers.current.push(setTimeout(() => { setRev(1); sfx.stamp(sound); }, at[0]), setTimeout(() => setRev(2), at[1]), setTimeout(() => { setRev(3); if (e.pts > 0) sfx.fanfare(sound); }, at[2]));
  };
  const share = async () => {
    if (!torre || voto === null) return;
    const text = testoDaCondividere(numero, cella(torre, voto), esito!.pts, db.serie, `${location.origin}/flash`);
    try { if (navigator.share) { await navigator.share({ text }); return; } } catch { /* annullato: si copia */ }
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { /* niente appunti */ }
  };
  const annullato = !!torre && voto !== null && torre.esiti[voto]!.segnalino.effetto === "nulli" && voto === torre.segnalino;
  const counts: Record<number, number> = {}; if (esito) for (const p of Object.values(esito.voti)) counts[p] = (counts[p] ?? 0) + 1;

  return (
    <Stage bg="sky" testId="flash">
      <div className="fl">
        <div className="fl-top"><button className="fl-back" onClick={() => navigate("/")} aria-label={ts("flash.home")} data-testid="flash-back">‹</button><div className="fl-t">{k === 0 ? t("flash.oggi") : t("flash.altra")}<small>{t("flash.titolo")} n.{numero}</small></div></div>
        {!torre || !ready ? (
          <div className="fl-wait" data-testid="flash-wait">{err > 0 ? <><p>{t("flash.errore")}</p><Btn kind="pap" onClick={() => { setErr(0); setIdx(null); setTimeout(() => setK((x) => x), 0); }}>{t("flash.riprova")}</Btn></> : <p>{t("flash.carico")}</p>}</div>
        ) : (
          <>
            <div className="fl-bub" data-testid="flash-frase"><small>{t("flash.dice", { nome: torre.megafono })}</small>«{torre.frase}»</div>
            <div className="fl-grid">
              {torre.carte.map((c) => {
                const fell = rev >= 2 && !!esito && esito.cadute.includes(c.pos), marked = c.pos === torre.segnalino, mine = voto === c.pos;
                return (
                  <button key={c.pos} className={`fl-c ${pick === c.pos && voto === null ? "sel" : ""} ${fell ? "fell" : ""} ${mine ? "mine" : ""}`} disabled={voto !== null} onClick={() => { setPick(c.pos); sfx.tap(sound); }} aria-label={ts("flash.carta", { n: c.pos })} data-testid={`flash-card-${c.pos}`}>
                    <img src={cardFull(c.id)} alt="" draggable={false} /><b className="fl-n">{c.pos}</b>
                    {marked && rev < 1 && <img className="fl-lui" src="/lui-coperto.png" alt={ts("flash.coperto")} />}
                    {marked && rev >= 1 && esito && <span className={`fl-stamp ${esito.segnalino.effetto}`} data-testid="flash-segnalino">{t(`flash.k.${esito.segnalino.effetto}` as "flash.k.cade")}</span>}
                    {rev >= 1 && <span className="fl-dots" aria-hidden="true">{Array.from({ length: counts[c.pos] ?? 0 }, (_, i) => <i key={i} className={mine && i === 0 ? "me" : ""} />)}</span>}
                  </button>
                );
              })}
            </div>
            {voto === null ? (
              <div className="fl-act"><p>{t("flash.scegli")}</p><Btn disabled={pick === null} onClick={vota} testId="flash-vota">{pick === null ? t("flash.titolo") : t("flash.vota", { n: pick })}</Btn></div>
            ) : rev >= 3 && esito ? (
              <div className="fl-res" data-testid="flash-risultato">
                <div className="fl-pt"><b data-testid="flash-punti">{t("flash.pt", { n: esito.pts })}</b><span>{t("flash.punti")}</span></div>
                <div className="fl-why">{annullato ? t("flash.r.annullato") : esito.cadute.includes(voto!) ? t("flash.r.giusto") : t("flash.r.salva")}</div>
                <div className="fl-st"><span><b>{db.totale}</b>{t("flash.totale")}</span><span><b>{db.serie}</b>{t("flash.serie")}</span></div>
                <div className="fl-next">{t("flash.prossima", { t: clock(secondiAMezzanotte(new Date(now))) })}</div>
                <div className="fl-row"><Btn onClick={share} testId="flash-condividi">{copied ? t("flash.copiato") : t("flash.condividi")}</Btn><Btn kind="pap" onClick={() => setK(k + 1)} testId="flash-ancora">{t("flash.ancora")}</Btn></div>
                <button className="fl-home" onClick={() => navigate("/")} data-testid="flash-home">{t("flash.home")}</button>
              </div>
            ) : <div className="fl-act" />}
          </>
        )}
      </div>
    </Stage>
  );
}
