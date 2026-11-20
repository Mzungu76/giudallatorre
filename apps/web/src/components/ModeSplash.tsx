import { useEffect, useState } from "react";
import { FAST } from "../ui.tsx";
import { sfx } from "../lib/sfx.ts";
import { t, ts } from "../lib/testi.ts";

/** Piccola intro animata di una modalità (Flash): titolo che si stampa su un cielo a raggi; passa da sola o con un tocco. */
export default function ModeSplash({ kind, sound, onDone, extra }: { kind: "flash"; sound: boolean; onDone: () => void; /** Una riga in più sotto il sottotitolo (Flash: chi è il Megafono). */ extra?: string }) {
  useEffect(() => {
    if (FAST) { onDone(); return undefined; }
    sfx.drum(sound, 0.8); const a = setTimeout(() => sfx.stamp(sound), 650), b = setTimeout(onDone, 2300);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`spl ${kind}`} onClick={onDone} data-testid="mode-splash" role="presentation">
      <div className="spl-rays" />
      {Array.from({ length: 14 }, (_, i) => <i key={i} className="spl-bit" style={{ left: `${(i * 29) % 100}%`, animationDelay: `${(i % 7) * 0.12}s`, background: ["#e8362b", "#ffc72c", "#14a3a1", "#fff"][i % 4] }} />)}
      <div className="spl-box">
        <div className="spl-ico" aria-hidden="true">⚡</div>
        <div className="spl-t">{t("splash.flash.t")}</div>
        <div className="spl-s">{t("splash.flash.s")}</div>
        {extra && <div className="spl-s spl-x" data-testid="splash-mega">{extra}</div>}
      </div>
    </div>
  );
}

/** Flash: l'intro compare una volta sola, all'inizio della partita (per scheda). */
export function FlashSplash({ code, sound, mega }: { code: string; sound: boolean; mega?: string }) {
  const key = `gdt.splash.${code}`, [on, setOn] = useState(() => { try { return sessionStorage.getItem(key) !== "1"; } catch { return true; } });
  if (!on) return null;
  return <ModeSplash kind="flash" sound={sound} extra={mega ? ts("splash.flash.mega", { nome: mega }) : undefined} onDone={() => { try { sessionStorage.setItem(key, "1"); } catch { /* vale per questa visita */ } setOn(false); }} />;
}
