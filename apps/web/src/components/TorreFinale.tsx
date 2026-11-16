import { useEffect, useState } from "react";
import { FAST } from "../ui.tsx";
import { sfx } from "../lib/sfx.ts";
import { t, ts } from "../lib/testi.ts";
import type { TorreDay } from "../lib/torre.ts";

const clock = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
/** Giudizio a parole in base ai punti del turno. */
const fascia = (pts: number): 0 | 1 | 2 | 3 => (pts <= 0 ? 0 : pts <= 2 ? 1 : pts <= 5 ? 2 : 3);
const addDays = (day: string, n: number): string => { const [y, m, d] = day.split("-").map(Number); return new Date(Date.UTC(y!, m! - 1, d! + n, 12)).toISOString().slice(0, 10); };
const lettera = (day: string): string => new Intl.DateTimeFormat("it-IT", { weekday: "narrow", timeZone: "UTC" }).format(new Date(day + "T12:00:00Z")).toUpperCase();

/** Pagina finale della Torre del giorno: punti che salgono, giudizio, emoji del turno, serie (la fiammella) e ultimi 7 giorni, tempo alla prossima Torre. */
export default function TorreFinale({ n, pts, cella, serie, totale, giorni, day, secondi, copied, sound, onShare, onHome }: { n: number; pts: number; cella: string; serie: number; totale: number; giorni: Record<string, TorreDay>; day: string; secondi: number; copied: boolean; sound: boolean; onShare: () => void; onHome: () => void }) {
  const [shown, setShown] = useState(FAST ? pts : 0), f = fascia(pts);
  useEffect(() => {
    if (FAST) return undefined;
    sfx.drum(sound, 0.8); const a = setTimeout(() => { sfx.stamp(sound); if (pts > 0) sfx.fanfare(sound); }, 1500); let raf = 0; const t0 = performance.now() + 500;
    const step = (now: number) => { const k = Math.max(0, Math.min(1, (now - t0) / 1000)); setShown(Math.round(pts * (1 - (1 - k) ** 3))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => { clearTimeout(a); cancelAnimationFrame(raf); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const week = Array.from({ length: 7 }, (_, i) => addDays(day, i - 6));
  return (
    <div className="tf" data-testid="torre-risultato">
      <div className="stbd-sky" /><div className="stbd-rays" />
      {pts > 0 && Array.from({ length: 20 }, (_, i) => <i key={i} className="aw-conf" style={{ left: `${(i * 37) % 100}%`, background: ["#e8362b", "#ffc72c", "#14a3a1", "#ff7aa8", "#fff"][i % 5], animationDelay: `${-((i * 0.43) % 5)}s`, animationDuration: `${4 + (i % 4)}s` }} />)}
      <div className="tf-box">
        <div className="aw-top"><div className="aw-t">{t("torre.oggi")}</div><div className="aw-s">{t("torre.titolo")} n.{n}</div></div>
        <div className="aw-stamp tf-v"><span className="aw-k">{t("torre.punteggio")}</span><div className="tf-vt" data-testid="torre-verdetto">{t(`torre.v${f}` as "torre.v0")}</div></div>
        <div className="tf-pt"><b data-testid="torre-punti">{t("torre.pt", { n: shown })}</b><span>{t("torre.punti")}</span></div>
        <div className="tf-emo" aria-label={cella}>{[...cella].map((c, i) => <span key={i} style={{ animationDelay: `${0.8 + i * 0.25}s` }}>{c}</span>)}</div>
        <div className="tf-card">
          <div className="tf-fire"><b>🔥 {serie}</b><span>{ts("torre.fila", { n: serie })}</span></div>
          <div className="tf-week">{week.map((d) => <i key={d} className={`${giorni[d] ? "on" : ""}${d === day ? " oggi" : ""}`}><u>{lettera(d)}</u></i>)}</div>
          <div className="tf-tot"><span>{t("torre.totale")}</span><b>{totale}</b></div>
        </div>
        <div className="tf-next">{t("torre.prossima", { t: clock(secondi) })}</div>
        <div className="tf-btns"><button className="bt mus" onClick={onShare} data-testid="torre-condividi">{copied ? t("torre.copiato") : t("torre.condividi")}</button><button className="tf-home" onClick={onHome} data-testid="torre-home">{t("torre.home")}</button></div>
      </div>
    </div>
  );
}
