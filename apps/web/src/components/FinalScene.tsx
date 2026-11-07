import { useEffect, useMemo, useRef, useState } from "react";
import { animalMarkup } from "../lib/animals.ts";
import { FAST, useStage } from "../ui.tsx";
import { sfx } from "../lib/sfx.ts";

export interface FinalRow { id: string; name: string; color: string; score: number }
const NV = "#13224a";
const SKIN = ["#f2c79a", "#e0a878", "#c68863", "#f6d3b0", "#a8714d", "#f2c79a", "#e0a878", "#f6d3b0"];
const HAIR = ["#3b2a1e", "#d9a521", "#1d1d1d", "#8a3b1c", "#5a3a22", "#c0392b", "#2b2b6b", "#6b4a2a"];
const OFFS = [0, 1, -1, 2, -2, 3, -3, 4];
const FALL_S = 1.15;
const pts = (n: number) => (n < 0 ? `−${-n}` : String(n));

/** Personaggio: maglietta crema con il dischetto del giocatore (colore + animale). */
function Figure({ color, i, s }: { color: string; i: number; s: number }) {
  const skin = SKIN[i % 8]!, hair = HAIR[i % 8]!;
  const limb = (cls: string, ox: number, x: number) => (
    <g className={cls} style={{ transformOrigin: `${ox}px 19px` }}>
      <line x1={x} y1="19" x2={x} y2="30" stroke={NV} strokeWidth="5" strokeLinecap="round" /><line x1={x} y1="19" x2={x} y2="30" stroke={skin} strokeWidth="3" strokeLinecap="round" />
    </g>
  );
  return (
    <svg width={30 * s} height={46 * s} viewBox="0 0 30 46" style={{ overflow: "visible", display: "block" }}>
      <g className="lg l" style={{ transformOrigin: "11.5px 30px" }}><rect x="8.6" y="30" width="5.8" height="13" rx="2.4" fill="#2b3a67" stroke={NV} strokeWidth="1.3" /><ellipse cx="10.6" cy="43.6" rx="4.6" ry="2.1" fill={NV} /></g>
      <g className="lg r" style={{ transformOrigin: "18.5px 30px" }}><rect x="15.6" y="30" width="5.8" height="13" rx="2.4" fill="#2b3a67" stroke={NV} strokeWidth="1.3" /><ellipse cx="19.4" cy="43.6" rx="4.6" ry="2.1" fill={NV} /></g>
      <rect x="6" y="15" width="18" height="17" rx="5" fill="#fff7e0" stroke={NV} strokeWidth="1.6" />
      <circle cx="15" cy="24" r="6.8" fill={color} stroke={NV} strokeWidth="1.2" /><circle cx="15" cy="24" r="4.9" fill="#fff" />
      <g transform="translate(11.1 20.1) scale(.078)" dangerouslySetInnerHTML={{ __html: animalMarkup(color, true) }} />
      {limb("ar l", 7, 6)}{limb("ar r", 23, 24)}
      <circle cx="15" cy="8.5" r="7.2" fill={skin} stroke={NV} strokeWidth="1.4" />
      <path d="M7.9 8.2 A7.2 7.2 0 0 1 22.1 8.2 Q15 4.4 7.9 8.2Z" fill={hair} stroke={NV} strokeWidth="1" />
      <circle cx="12.3" cy="9.6" r=".95" fill={NV} /><circle cx="17.7" cy="9.6" r=".95" fill={NV} />
      <path d="M12.9 12.5 Q15 14.2 17.1 12.5" stroke={NV} strokeWidth="1" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Scena finale: i personaggi salgono sulla torre, chi arriva primo butta giù gli altri sui materassi. */
export default function FinalScene({ rows, winners, sound, readOnly, onLeave, onNew }: { rows: FinalRow[]; winners: Set<string>; sound: boolean; readOnly?: boolean; onLeave: () => void; onNew: () => void }) {
  const { H } = useStage(), N = rows.length;
  const [ph, setPh] = useState<0 | 1 | 2 | 3>(FAST ? 3 : 0), [inst, setInst] = useState(FAST), [arr, setArr] = useState<number[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const gy = H - 112 - (N > 3 ? Math.ceil(N / 2) : N) * 37, T = 150, feetTop = 180;
  const s = N <= 4 ? 1.2 : N <= 6 ? 1 : 0.85, w = 30 * s, h = 46 * s;
  const W = Math.max(1, rows.filter((r) => winners.has(r.id)).length), F = N - W;
  const best = Math.max(1, ...rows.map((r) => r.score));

  const geo = useMemo(() => {
    const offs = rows.map((_, r) => OFFS[r % 8]!), span = Math.max(...offs) - Math.min(...offs), sp = Math.min(30, 120 / Math.max(1, span));
    const cnt = { L: 0, R: 0 };
    return rows.map((row, r) => {
      const win = winners.has(row.id), cx = 186 + offs[r]! * sp, x0 = cx - w / 2;
      const f = win ? 1 : 0.2 + 0.55 * Math.max(0, Math.min(1, row.score / best));
      const feet = win ? feetTop : gy - 2 - (gy - 2 - (feetTop + 16)) * f, y0 = feet - h, yG = gy - 2 - h;
      let side: "L" | "R" = offs[r]! >= 0 ? "R" : "L", j = 0, x1 = 0, y1 = 0, r2 = 0, k = 0;
      if (!win) { side = offs[r]! >= 0 ? "R" : "L"; j = cnt[side]++; k = r - W; const lx = side === "L" ? 24 + j * 21 : 348 - j * 21; x1 = lx - w / 2; y1 = gy - 39 - w / 2 + 6 - h / 2 - (j % 2 ? 7 : 0); r2 = (side === "L" ? -90 : 90) + ((k % 3) - 1) * 16; }
      return { row, r, win, x0, y0, yG, side, x1, y1, r2, climbS: 2 + 0.32 * r, delay: 0.2 + Math.max(0, r - W) * 0.7 };
    });
  }, [rows, winners, H, w, h, W, best, gy]);

  const climbEnd = 1200 + (2 + 0.32 * (N - 1)) * 1000 + 300, endAt = climbEnd + (F > 0 ? (0.2 + (F - 1) * 0.7 + FALL_S + 0.6) * 1000 : 500);
  const finish = () => { timers.current.forEach(clearTimeout); timers.current = []; setInst(true); setPh(3); };
  useEffect(() => {
    if (FAST) return undefined;
    const at = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms)); };
    at(1200, () => { setPh(1); sfx.whoosh(sound); });
    geo.forEach((g) => at(1200 + g.climbS * 1000, () => setArr((a) => [...a, g.r])));
    at(climbEnd, () => setPh(2));
    geo.filter((g) => !g.win).forEach((g) => { at(climbEnd + g.delay * 1000, () => sfx.whoosh(sound)); at(climbEnd + (g.delay + FALL_S) * 1000, () => sfx.stamp(sound)); });
    at(endAt, () => { setPh(3); sfx.fanfare(sound); setTimeout(() => sfx.tada(sound), 700); });
    return () => { timers.current.forEach(clearTimeout); timers.current = []; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const shared = W > 1, done = ph === 3;
  return (
    <div className="fin" data-testid="final" onClick={() => { if (!done) finish(); }}>
      <div className="stbd-sky" /><div className="stbd-rays" />
      {done && Array.from({ length: 30 }, (_, i) => <i key={i} className="confetti fin-conf" style={{ left: (i * 53) % 360, top: -20, width: 8 + (i % 3) * 3, height: 5 + (i % 4) * 2, background: ["#e8362b", "#ffc72c", "#14a3a1", "#fff7e0", "#ff7aa8"][i % 5], animationDelay: `${(i % 10) * 0.18}s`, animationDuration: `${3 + (i % 5) * 0.5}s` }} />)}
      <div className="h fin-head" key={done ? "w" : "t"}><small>{done ? (shared ? "Vittoria condivisa!" : "Ha vinto…") : "Chi arriva per primo…"}</small>{done ? <>Gran Megafono!</> : <>La scalata!</>}</div>
      <div className="fin-ground" style={{ top: gy }} />
      <div className="stbd-tower" style={{ top: T, height: gy - T }}><div className="stbd-merl">{Array.from({ length: 5 }, (_, i) => <i key={i} />)}</div><div className="stbd-body" /><div className="stbd-door" /></div>
      <div className="stbd-flag" style={{ top: T - 40, left: 254, height: 56 }}><i /></div>
      {(["L", "R"] as const).map((sd) => (
        <div key={sd} className={`fin-mats ${sd}`} style={{ top: gy - 39 }}><i /><i /><i /></div>
      ))}
      {geo.map((g) => {
        const fallen = !g.win && ph >= 2, hold = arr.includes(g.r) || ph >= 2 || inst, climbing = ph === 1 && !hold;
        let style: Record<string, string | number> = {}, cls = "fin-fig";
        if (inst || ph === 0) style = { transform: `translate(${inst && !g.win ? g.x1 : g.x0}px, ${inst ? (g.win ? g.y0 : g.y1) : g.yG}px)${inst && !g.win ? ` rotate(${g.r2}deg)` : ""}` };
        else if (ph === 1) style = { transform: `translate(${g.x0}px, ${g.y0}px)`, transition: `transform ${g.climbS}s cubic-bezier(.4,.1,.5,1)` };
        else if (fallen) style = { ["--x0" as string]: `${g.x0}px`, ["--y0" as string]: `${g.y0}px`, ["--x1" as string]: `${g.x1}px`, ["--y1" as string]: `${g.y1}px`, ["--r1" as string]: `${g.side === "L" ? -200 : 200}deg`, ["--r2" as string]: `${g.r2}deg`, ["--d" as string]: `${g.delay}s`, animation: `finFall ${FALL_S}s var(--d) both` };
        else style = { transform: `translate(${g.x0}px, ${g.y0}px)` };
        if (climbing) cls += " climbing"; else if (g.win && ph === 2) cls += " push"; else if (g.win && done) cls += " cheer"; else if (hold && !fallen && !done) cls += " hold";
        if (fallen && !inst) cls += " fall";
        if (g.win && ph >= 1) style.zIndex = 8;
        return (
          <div key={g.row.id} className={cls} style={style} data-testid="final-fig">
            <div className={`fin-in ${fallen && !inst ? "land" : ""}`} style={fallen && !inst ? { ["--d" as string]: `${g.delay + FALL_S}s` } : undefined}>
              {g.win && done && <em className="fin-crown">👑</em>}
              <Figure color={g.row.color} i={g.r} s={s} />
            </div>
          </div>
        );
      })}
      {ph === 2 && geo.filter((g) => !g.win).map((g) => <span key={g.row.id} className="fin-bam" style={{ left: g.x0 + w / 2 - 14, top: g.y0 - 4, animationDelay: `${g.delay}s` }}>💥</span>)}
      {(inst || ph >= 2) && geo.filter((g) => !g.win).map((g) => <span key={g.row.id} className="fin-diz" style={{ left: g.x1 + w / 2 - 12, top: g.y1 + h / 2 - w / 2 - 26, animationDelay: inst ? "0s" : `${g.delay + FALL_S + 0.3}s` }}>💫</span>)}
      {!done && <div className="fin-skip" style={{ top: gy + 22 }}>Tocca per saltare</div>}
      {done && (
        <div className="fin-rank" style={{ top: gy + 14 }} data-testid="final-rank">
          {rows.map((r, i) => (
            <div key={r.id} className={`fin-row ${winners.has(r.id) ? "win" : ""}`}><b className="num">{i + 1}</b><i className="dc" style={{ background: r.color }} /><span>{r.name}</span><u>{pts(r.score)}</u></div>
          ))}
        </div>
      )}
      {done && !readOnly && (
        <div className="bottom two" onClick={(e) => e.stopPropagation()}>
          <button className="bt pap" style={{ fontSize: 18 }} onClick={onLeave} data-testid="leave-final">Esci</button>
          <button className="bt mus" style={{ fontSize: 19 }} onClick={onNew}>Nuova partita</button>
        </div>
      )}
    </div>
  );
}
