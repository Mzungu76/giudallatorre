import { useEffect, useState } from "react";
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

/** Palco 372×826: tutto il disegno dei mockup è in queste coordinate e viene scalato. */
export function Stage({ children, bg = "paper", frame = true, testId }: { children: ReactNode; bg?: "paper" | "sky" | "none"; frame?: boolean; testId?: string }) {
  const k = useFit();
  return (
    <div className="stage-outer" style={{ width: 372 * k, height: 826 * k }} data-testid={testId}>
      <div className="stage" style={{ transform: `scale(${k})` }}>
        {bg === "paper" && (<><div className="pap" /><div className="hr" /><div className="ht" /></>)}
        {bg === "sky" && (<><div className="sky" /><div className="skyg" /><div className="skyh" /></>)}
        {children}
        {frame && <div className="fr" />}
        <div className="grain" />
      </div>
    </div>
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
