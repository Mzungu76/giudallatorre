import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

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
      <div className="hr2">{onRules ? <a role="button" tabIndex={0} onClick={onRules}>Aiuto</a> : <span />}<button className="bt mus sm" onClick={onClose} data-testid="idle-hint-ok">Ho capito</button></div>
    </div>
  );
}

/**
 * Freccia e cerchio pulsante sull'elemento da toccare (pulsante o carte): il primo della lista che si vede.
 * Sta fuori dalla scena scalata (portale sul body), quindi usa le coordinate reali dello schermo.
 */
export function HintPointer({ targets }: { targets: string[] }) {
  const [r, setR] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const key = targets.join("|");
  useEffect(() => {
    const find = () => {
      for (const sel of targets) { const el = document.querySelector(sel) as HTMLElement | null; if (!el) continue; const b = el.getBoundingClientRect(); if (b.width > 8 && b.height > 8) return b; }
      return null;
    };
    const tick = () => { const b = find(); setR(b ? { x: b.left, y: b.top, w: b.width, h: b.height } : null); };
    tick(); const id = setInterval(tick, 250); window.addEventListener("resize", tick);
    return () => { clearInterval(id); window.removeEventListener("resize", tick); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!r) return null;
  const above = r.y > 150;
  return createPortal(
    <>
      <div className="hint-ring" data-testid="hint-ring" style={{ left: r.x - 6, top: r.y - 6, width: r.w + 12, height: r.h + 12 }} />
      <div className={`hint-arrow ${above ? "dn" : "up"}`} aria-hidden style={{ left: r.x + r.w / 2 - 18, top: above ? r.y - 50 : r.y + r.h + 10 }}>{above ? "▼" : "▲"}</div>
    </>,
    document.body,
  );
}
