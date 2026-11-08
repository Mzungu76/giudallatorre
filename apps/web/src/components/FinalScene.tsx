import { useEffect, useMemo, useRef, useState } from "react";
import { PtIcon } from "./Pt.tsx";
import { cardUrl } from "../lib/characters.ts";
import { FAST, useStage } from "../ui.tsx";
import { sfx } from "../lib/sfx.ts";
import type { UiCtl } from "./BUi.tsx";

export interface FinalRow { id: string; name: string; color: string; score: number }
const OFFS = [0, 1, -1, 2, -2, 3, -3, 4];
const FALL_S = 1.15;
const pts = (n: number) => (n < 0 ? `−${-n}` : String(n));

/** Scena finale: le carte dei giocatori salgono sulla torre; chi arriva primo butta giù le altre sui materassi. */
export default function FinalScene({ rows, winners, sound, readOnly, ui, onLeave, onNew }: { rows: FinalRow[]; winners: Set<string>; sound: boolean; readOnly?: boolean; ui?: UiCtl | null; onLeave: () => void; onNew: () => void }) {
  const { H } = useStage(), N = rows.length;
  const [ph, setPh] = useState<0 | 1 | 2 | 3>(FAST ? 3 : 0), [inst, setInst] = useState(FAST), [arr, setArr] = useState<number[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const gy = H - 112 - (N > 3 ? Math.ceil(N / 2) : N) * 37, Y0 = 74;
  const k = Math.min(0.72, (gy - Y0) / 712), tl = 186 - 252 * k, bodyW = 222 * k, cx0 = tl + 249 * k, platY = Y0 + 122 * k, matTop = Y0 + 628 * k;
  const cw = Math.round(N <= 4 ? bodyW * 0.36 : N <= 6 ? bodyW * 0.3 : bodyW * 0.25), ch = Math.round(cw * 1.42);
  const W = Math.max(1, rows.filter((r) => winners.has(r.id)).length), F = N - W;
  const best = Math.max(1, ...rows.map((r) => r.score));

  const geo = useMemo(() => {
    const offs = rows.map((_, r) => OFFS[r % 8]!), span = Math.max(...offs) - Math.min(...offs), sp = Math.min(bodyW * 0.3, (bodyW - cw) / Math.max(1, span));
    const cnt = { L: 0, R: 0 };
    return rows.map((row, r) => {
      const win = winners.has(row.id), cx = cx0 + offs[r]! * sp, x0 = cx - cw / 2;
      const f = win ? 1 : 0.2 + 0.55 * Math.max(0, Math.min(1, row.score / best));
      const feet = win ? platY + 30 : gy - 4 - (gy - 4 - (platY + 30 + ch * 0.6)) * f, y0 = feet - ch, yG = gy - 4 - ch;
      const side: "L" | "R" = offs[r]! >= 0 ? "R" : "L";
      let j = 0, x1 = 0, y1 = 0, r2 = 0;
      if (!win) { j = cnt[side]++; const mc = side === "L" ? tl + 67 * k : tl + 433 * k, dx = ((j % 4) - 1.5) * Math.max(6, 24 * k) + (side === "L" ? -4 : 4); x1 = mc + dx - cw / 2; y1 = matTop - ch + 4 - Math.floor(j / 2) * 5 - (j % 2) * 4; r2 = ((j * 53) % 70) - 35 + (side === "L" ? -12 : 12); }
      return { row, r, win, x0, y0, yG, side, x1, y1, r2, climbS: 2 + 0.32 * r, delay: 0.2 + Math.max(0, r - W) * 0.7 };
    });
  }, [rows, winners, H, cw, ch, W, best, gy]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <img className="fin-tower" src="/giocatori/torre.webp" alt="" style={{ left: tl, top: Y0, width: 505 * k, height: 741 * k }} />
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
              <img src={cardUrl(g.row.color)} width={cw} height={ch} alt="" className="fin-card" draggable={false} />
            </div>
          </div>
        );
      })}
      {ph === 2 && geo.filter((g) => !g.win).map((g) => <span key={g.row.id} className="fin-bam" style={{ left: g.x0 + cw / 2 - 14, top: g.y0 + ch / 3, animationDelay: `${g.delay}s` }}>💥</span>)}
      {(inst || ph >= 2) && geo.filter((g) => !g.win).map((g) => <span key={g.row.id} className="fin-diz" style={{ left: g.x1 + cw / 2 - 12, top: g.y1 - 20, animationDelay: inst ? "0s" : `${g.delay + FALL_S + 0.3}s` }}>💫</span>)}
      {!done && <div className="fin-skip" style={{ top: gy + 22 }}>Tocca per saltare</div>}
      {done && (
        <div className="fin-rank" style={{ top: gy + 14 }} data-testid="final-rank">
          {rows.map((r, i) => (
            <div key={r.id} className={`fin-row ${winners.has(r.id) ? "win" : ""}`}><b className="num">{i + 1}</b><i className="dc" style={{ background: r.color }} /><span>{r.name}</span><u><PtIcon s={15} /> {pts(r.score)}</u></div>
          ))}
        </div>
      )}
      {done && !readOnly && (
        <div className="pp bsheet finsheet" onClick={(e) => e.stopPropagation()}>
          <div className="bcrow">
            {ui && <>
              <button className="bib big" onClick={ui.chat} aria-label={ui.unread ? `Chat, ${ui.unread} messaggi nuovi` : "Chat"} data-testid="chat-open">💬{ui.unread > 0 && <i data-testid="chat-unread">{ui.unread > 9 ? "9+" : ui.unread}</i>}</button>
              <button className="bib big" onClick={ui.rank} aria-label="Classifica" data-testid="standings-btn">🏆</button>
            </>}
            <button className="bt pap sm" onClick={onLeave} data-testid="leave-final">Esci</button>
            <button className="bt mus" style={{ fontSize: 18 }} onClick={onNew}>Nuova partita</button>
          </div>
        </div>
      )}
    </div>
  );
}
