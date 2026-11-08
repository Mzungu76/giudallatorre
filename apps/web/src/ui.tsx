import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode, CSSProperties } from "react";

import { CHAR_COLORS } from "./lib/characters.ts";
export const PLAYER_COLORS = CHAR_COLORS;

export function navigate(path: string) { history.pushState(null, "", path); window.dispatchEvent(new PopStateEvent("popstate")); }

/** Con la tastiera aperta la finestra visibile si accorcia: la scena non deve rimpicciolirsi, quindi finché un campo di testo è attivo si ignorano i ridimensionamenti. */
const typing = () => { const t = document.activeElement?.tagName; return t === "INPUT" || t === "TEXTAREA" || t === "SELECT"; };
function onViewport(f: () => void) {
  const g = () => { if (!typing()) f(); };
  window.addEventListener("resize", g); window.visualViewport?.addEventListener("resize", g); window.addEventListener("focusout", () => setTimeout(g, 250));
  return () => { window.removeEventListener("resize", g); window.visualViewport?.removeEventListener("resize", g); };
}

/** Fattore di scala per far stare il palco logico 372×826 nella finestra. */
export function useFit(maxScale = 1.5, boxW = 372, boxH = 826) {
  const calc = () => Math.max(0.3, Math.min(maxScale, window.innerWidth / boxW, (window.visualViewport?.height ?? window.innerHeight) / boxH));
  const [k, setK] = useState(calc);
  useEffect(() => onViewport(() => setK(calc())), []);
  return k;
}

/** Modalità veloce (test e accessibilità): nessuna animazione lunga. Attiva con ?fast=1 oppure con "riduci animazioni" del sistema. */
export const FAST: boolean = (() => { try { return /[?&]fast=1/.test(location.search) || sessionStorage.getItem("gdt.fast") === "1" || matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } })();
try { if (/[?&]fast=1/.test(location.search)) sessionStorage.setItem("gdt.fast", "1"); } catch { /* */ }

/** Dimensione logica del palco: larghezza fissa 372, altezza che si adatta al telefono (640–940). */
export interface StageDims { k: number; H: number; dy: number; ts: number; ty: number }
export const StageCtx = createContext<StageDims>({ k: 1, H: 826, dy: 0, ts: 1, ty: -27 });
export const useStage = () => useContext(StageCtx);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
function calcDims(maxScale: number): StageDims {
  const vh = window.visualViewport?.height ?? window.innerHeight;
  let k = Math.max(0.3, Math.min(maxScale, window.innerWidth / 372)), H = vh / k;
  if (H < 640) { H = 640; k = vh / 640; }
  H = Math.min(H, 940);
  // Layout B: la terrazza (alta ~392 nel disegno, dal punto 278) sta tra la frase in alto (~102) e il pannello in basso (~196), la torre prosegue sotto.
  const T0 = 102, avail = H - 196 - T0, ts = clamp(avail / 392, 0.72, 1), y0 = T0 + 22 * ts;
  return { k, H, dy: clamp((H - 826) * 0.6, -80, 70), ts, ty: y0 - 300 };
}
export function useAdaptive(maxScale = 1.5): StageDims {
  const [d, setD] = useState(() => calcDims(maxScale));
  useEffect(() => onViewport(() => setD(calcDims(maxScale))), [maxScale]);
  return d;
}

/** Palco 372×H: tutto il disegno è in queste coordinate e viene scalato. L'altezza H si adatta allo schermo. */
export function Stage({ children, bg = "paper", frame = true, testId, fixed }: { children: ReactNode; bg?: "paper" | "sky" | "none"; frame?: boolean; testId?: string; fixed?: boolean }) {
  const ad = useAdaptive(), fk = useFit(), d: StageDims = fixed ? { k: fk, H: 826, dy: 0, ts: 1, ty: -27 } : ad;
  return (
    <StageCtx.Provider value={d}>
      <div className="stage-outer" style={{ width: 372 * d.k, height: d.H * d.k }} data-testid={testId}>
        <div className="stage" style={{ transform: `scale(${d.k})`, height: d.H }}>
          {bg === "paper" && (<><div className="pap" /><div className="hr" /><div className="ht" /></>)}
          {bg === "sky" && (<><div className="sky" /><div className="skyg" /><div className="skyh" /></>)}
          {children}
          <div className="vig" />
          <div className="grain" />
        </div>
      </div>
    </StageCtx.Provider>
  );
}

export function Btn({ children, onClick, kind = "mus", disabled, style, testId, type = "button" }: { children: ReactNode; onClick?: () => void; kind?: "mus" | "red" | "pap" | "dis"; disabled?: boolean; style?: CSSProperties; testId?: string; type?: "button" | "submit" }) {
  return <button type={type} className={`bt ${disabled ? "dis" : kind}`} disabled={disabled} onClick={onClick} style={style} data-testid={testId}>{children}</button>;
}
export const Disc = ({ color, size = "" }: { color: string; size?: "" | "l" | "xl" }) => <i className={`dc ${size}`} style={{ background: color }} />;
export function Toast({ text }: { text: string | null }) { return text ? <div className="toast" role="alert" data-testid="toast">{text}</div> : null; }
export function Chips({ left, mid, right }: { left?: ReactNode; mid?: ReactNode; right?: ReactNode }) {
  return <div className="chips"><span className="chip">{left}</span>{mid ? <span className="chip">{mid}</span> : <span />}{right ? <span className="chip">{right}</span> : <span />}</div>;
}
export function useNow(intervalMs = 500) { const [n, setN] = useState(Date.now()); useEffect(() => { const t = setInterval(() => setN(Date.now()), intervalMs); return () => clearInterval(t); }, [intervalMs]); return n; }
export function Countdown({ deadline }: { deadline: number | null }) { const now = useNow(); if (!deadline) return null; const s = Math.max(0, Math.ceil((deadline - now) / 1000)); return <span className="chip" data-testid="countdown">⏱ {s}s</span>; }
