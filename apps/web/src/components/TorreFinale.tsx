import { useEffect, useState } from "react";
import { FAST } from "../ui.tsx";
import { sfx } from "../lib/sfx.ts";
import { t, ts } from "../lib/testi.ts";
import { dataLunga, disegnaCartolina } from "../lib/cartolina.ts";
import type { TorreDay } from "../lib/torre.ts";

const clock = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
/** Giudizio a parole in base ai punti del turno. */
const fascia = (pts: number): 0 | 1 | 2 | 3 => (pts <= 0 ? 0 : pts <= 2 ? 1 : pts <= 5 ? 2 : 3);

/** Pagina finale della Torre del giorno: la cartolina da condividere (un'immagine pronta per storie e chat, con carte, frase, punti, giudizio e serie) e i pulsanti per mandarla. */
export default function TorreFinale({ day, rec, serie, totale, secondi, testo, sound, onHome }: { day: string; rec: TorreDay; serie: number; totale: number; secondi: number; testo: string; sound: boolean; onHome: () => void }) {
  const [blob, setBlob] = useState<Blob | null>(null), [url, setUrl] = useState<string | null>(null), [msg, setMsg] = useState("");
  useEffect(() => {
    let on = true, u: string | null = null;
    disegnaCartolina({ giorno: day, rec, sotto: ts("torre.c.sotto", { n: rec.n, data: dataLunga(day) }), verdetto: ts(`torre.v${fascia(rec.pts)}` as "torre.v0"), banda: ts(serie === 1 ? "torre.c.serie1" : "torre.c.serie", { fila: serie, totale }), indirizzo: location.host + "/torre" })
      .then((b) => { if (!on) return; u = URL.createObjectURL(b); setBlob(b); setUrl(u); if (!FAST) { sfx.stamp(sound); if (rec.pts > 0) sfx.fanfare(sound); } }).catch(() => { if (on) setMsg(ts("torre.errore")); });
    return () => { on = false; if (u) URL.revokeObjectURL(u); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const nome = `torre-del-giorno-${day}.png`;
  const salva = () => { if (!url) return; const a = document.createElement("a"); a.href = url; a.download = nome; a.click(); };
  const condividi = async () => {
    if (!blob) return; const file = new File([blob], nome, { type: "image/png" });
    try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text: testo }); return; } if (navigator.share) { await navigator.share({ text: testo }); return; } } catch { return; /* annullato */ }
    salva(); try { await navigator.clipboard.writeText(testo); setMsg(t("torre.copiato") as string); } catch { /* solo l'immagine */ }
  };
  return (
    <div className="tf" data-testid="torre-risultato">
      <div className="stbd-sky" /><div className="stbd-rays" />
      <div className="tf-box">
        {url ? <img className="tf-img" src={url} alt={ts("torre.cartolina.alt")} draggable={false} data-testid="torre-cartolina" /> : <div className="tf-wait">{msg || t("torre.cartolina")}</div>}
        <div className="tf-btns">
          <button className="bt mus" onClick={condividi} disabled={!blob} data-testid="torre-condividi">{msg && blob ? msg : t("torre.condividi")}</button>
          <button className="bt pap" onClick={salva} disabled={!blob} data-testid="torre-salva">{t("torre.salva")}</button>
        </div>
        <div className="tf-next">{t("torre.prossima", { t: clock(secondi) })}</div>
        <button className="tf-home" onClick={onHome} data-testid="torre-home">{t("torre.home")}</button>
      </div>
    </div>
  );
}
