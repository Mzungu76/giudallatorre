import { useEffect, useState } from "react";
import { cardFull } from "../lib/cards.ts";
import { sfx } from "../lib/sfx.ts";

/** Posizione finale di ogni carta nella mano (la stessa del carosello), così le carte scoperte coincidono con quelle vere. */
export interface Geo { left: number; top: number; w: number; h: number; rot: number }

/** Passi: 0 vuoto → 1 mazzetto coperto → 2 si apre a ventaglio → 3 le carte si scoprono una a una → 4 pausa → 5 la scritta svanisce. */
const WAIT = [350, 850, 850, 1500, 800, 500];

/**
 * Dopo un intervallo la mano è tutta nuova: parte dal vuoto, compare un mazzetto coperto, si apre a ventaglio e le carte si scoprono.
 * «Rinnoviamo la tua mano!» resta finché dura l'animazione e poi scompare. Un tocco la salta.
 */
export default function HandRenewal({ cards, geo, dim, cW, cH, sound, onDone }: { cards: string[]; geo: Geo[]; dim: { w: number; h: number }; cW: number; cH: number; sound: boolean; onDone: () => void }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    let alive = true; const timers: ReturnType<typeof setTimeout>[] = [];
    let t = 0;
    WAIT.forEach((d, i) => {
      t += d;
      timers.push(setTimeout(() => {
        if (!alive) return;
        if (i === WAIT.length - 1) { onDone(); return; }
        setStep(i + 1);
        if (i + 1 === 1) sfx.whoosh(sound);
        if (i + 1 === 2) sfx.tap(sound, 420);
        if (i + 1 === 3) cards.forEach((_, k) => timers.push(setTimeout(() => { if (alive) sfx.tap(sound, 520 + k * 60); }, 80 + k * 170)));
        if (i + 1 === 4) sfx.tada(sound);
      }, t));
    });
    return () => { alive = false; timers.forEach(clearTimeout); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const stack = (i: number): Geo => ({ left: dim.w / 2 - cW / 2 + (i - 2) * 1.5, top: dim.h / 2 - cH / 2 - i * 2.5, w: cW, h: cH, rot: (i - 2) * 1.6 });
  return (
    <div className="rn" onClick={onDone} role="status" aria-live="polite" data-testid="hand-renewal">
      <div className={`rn-msg ${step >= 5 ? "off" : ""}`} data-testid="renewal-text"><b>Rinnoviamo la tua mano!</b><small>{cards.length} carte nuove, tutte per te</small></div>
      {cards.map((c, i) => {
        const g = step >= 2 ? geo[i]! : stack(i);
        return (
          <div key={c} className="rn-card" style={{ left: g.left, top: g.top, width: g.w, height: g.h, transform: `rotate(${g.rot}deg) scale(${step === 0 ? 0.6 : 1})`, opacity: step === 0 ? 0 : 1, zIndex: 10 + i, transitionDelay: step === 2 ? `${i * 0.05}s` : "0s" }}>
            <div className={`rn-in ${step >= 3 ? "flip" : ""}`} style={{ transitionDelay: step >= 3 ? `${i * 0.17}s` : "0s" }}>
              <div className="rn-back" /><div className="rn-face" style={{ backgroundImage: `url(${cardFull(c)})` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
