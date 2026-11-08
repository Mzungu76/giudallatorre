import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/** Dopo quanto tempo senza toccare nulla compare il suggerimento. Gancio per le prove: localStorage «gdt.hintms». */
const hintDelay = () => { try { const n = Number(localStorage.getItem("gdt.hintms")); return n > 0 ? n : 14000; } catch { return 14000; } };
const MAX_PER_STEP = 2;

/**
 * Suggerimento a fumetto che compare da solo SOLO se il giocatore deve agire e resta fermo troppo a lungo.
 * Qualsiasi tocco lo fa sparire e riparte il conto; non compare più di due volte nella stessa fase.
 */
export function useIdleHint(active: boolean, stepKey: string): [boolean, () => void] {
  const [shown, setShown] = useState(false), t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), count = useRef({ key: "", n: 0 });
  const arm = useCallback(() => {
    clearTimeout(t.current);
    if (!active) return;
    if (count.current.key !== stepKey) count.current = { key: stepKey, n: 0 };
    if (count.current.n >= MAX_PER_STEP) return;
    t.current = setTimeout(() => { count.current.n += 1; setShown(true); }, hintDelay());
  }, [active, stepKey]);
  useEffect(() => {
    setShown(false); arm();
    const onTouch = () => { setShown(false); arm(); };
    const ev = ["pointerdown", "keydown", "touchstart", "wheel"] as const;
    ev.forEach((e) => window.addEventListener(e, onTouch, { passive: true }));
    return () => { clearTimeout(t.current); ev.forEach((e) => window.removeEventListener(e, onTouch)); };
  }, [arm]);
  return [shown && active, () => { setShown(false); arm(); }];
}

/** Il fumetto: sopra il pannello in basso, con la freccia verso di esso. */
export function HintBubble({ children, onClose, onRules }: { children: ReactNode; onClose: () => void; onRules?: () => void }) {
  return (
    <div className="hintb" role="status" aria-live="polite" data-testid="idle-hint">
      <span className="hn">Ti serve una mano?</span>
      <p>{children}</p>
      <div className="hr2">{onRules ? <a role="button" tabIndex={0} onClick={onRules}>Regolamento</a> : <span />}<button className="bt mus sm" onClick={onClose} data-testid="idle-hint-ok">Ho capito</button></div>
    </div>
  );
}
