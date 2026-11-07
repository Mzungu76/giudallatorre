import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode, CSSProperties } from "react";

export const PLAYER_COLORS = ["#e5384b", "#2f7be0", "#f4c20d", "#3aa655", "#8a5a3b", "#8e44c8", "#ee7bb0", "#222222"];

export function navigate(path: string) { history.pushState(null, "", path); window.dispatchEvent(new PopStateEvent("popstate")); }

/** Fattore di scala per far stare il palco logico 372×826 nella finestra. */
export function useFit(maxScale = 1.5, boxW = 372, boxH = 826) {
  const calc = () => Math.max(0.3, Math.min(maxScale, window.innerWidth / boxW, (window.visualViewport?.height ?? window.innerHeight) / boxH));
  const [k, setK] = useState(calc);
  useEffect(() => { const f = () => setK(calc()); window.addEventListener("resize", f); window.visualViewport?.addEventListener("resize", f); return () => { window.removeEventListener("resize", f); window.visualViewport?.removeEventListener("resize", f); }; }, []);
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
  // La torre (alta ~310 nel disegno, dal punto 300) deve stare tra la frase in alto e il suggerimento in basso: si rimpicciolisce se serve.
  const T0 = 236, avail = H - 206 - T0, ts = clamp(avail / 310, 0.7, 1), y0 = T0 + Math.max(0, (avail - 310 * ts) / 2);
  return { k, H, dy: clamp((H - 826) * 0.6, -80, 70), ts, ty: y0 - 300 };
}
export function useAdaptive(maxScale = 1.5): StageDims {
  const [d, setD] = useState(() => calcDims(maxScale));
  useEffect(() => { const f = () => setD(calcDims(maxScale)); window.addEventListener("resize", f); window.visualViewport?.addEventListener("resize", f); return () => { window.removeEventListener("resize", f); window.visualViewport?.removeEventListener("resize", f); }; }, [maxScale]);
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
