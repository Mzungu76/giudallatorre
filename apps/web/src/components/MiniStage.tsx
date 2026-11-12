import { useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { MINI_SLOT_MS } from "@gdt/game-engine";
import { terraceBaseHtml } from "../scene/draw.ts";
import { cardImage, useCards } from "../lib/cards.ts";
import { useStage } from "../ui.tsx";
import { FIG_SCALE, SIDE, SLOT } from "../lib/miniScenes.ts";
import type { Finale, WP } from "../lib/miniScenes.ts";
import { t as tx } from "../lib/testi.ts";

/** Immagine di un personaggio: il ritaglio (figura sola) oppure, se non è affidabile, la carta intera. */
export interface CastItem { src: string; cut: boolean }
export function useCast(ids: (string | null | undefined)[]): (CastItem | null)[] {
  const ready = useCards();
  return useMemo(() => ids.map((id) => (id && ready ? cardImage(id) : null)), [ready, ids.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** La terrazza (come nel resto del gioco) con i personaggi sopra: tutto nelle stesse coordinate del disegno. */
export function Scene({ children }: { children: ReactNode }) {
  const { ts, ty } = useStage(), base = useMemo(() => terraceBaseHtml(), []);
  return (
    <div className="layer mr-scene" style={{ transformOrigin: "186px 300px", transform: `translateY(${ty}px) scale(${ts})` }} data-testid="mr-scene">
      <div style={{ left: 0, top: 0, width: 372, height: 826 }} dangerouslySetInnerHTML={{ __html: base }} />
      {children}
    </div>
  );
}

/** Il separé: tre pannelli a zig-zag, da dove escono i personaggi. */
export function Separe({ front }: { front?: boolean }) {
  return (
    <svg className={`mr-sep${front ? " front" : ""}`} viewBox="0 0 190 176" aria-hidden>
      <g strokeLinejoin="round" strokeWidth="4" stroke="#13224a">
        <path d="M4 26 Q4 12 20 9 L62 4 L62 158 L4 168 Z" fill="#e8362b" />
        <path d="M62 4 L128 4 L128 158 L62 158 Z" fill="#ffc72c" />
        <path d="M128 4 L170 9 Q186 12 186 26 L186 168 L128 158 Z" fill="#14a3a1" />
      </g>
      <g fill="#13224a" opacity=".22"><circle cx="18" cy="52" r="3" /><circle cx="36" cy="82" r="3" /><circle cx="18" cy="112" r="3" /><circle cx="44" cy="136" r="3" /><circle cx="172" cy="52" r="3" /><circle cx="154" cy="82" r="3" /><circle cx="172" cy="112" r="3" /><circle cx="146" cy="136" r="3" /></g>
      <text x="95" y="102" textAnchor="middle" fontFamily="Anton, Impact, sans-serif" fontSize="74" fill="#13224a" opacity=".85">?</text>
      <g fill="#13224a"><rect x="2" y="162" width="14" height="10" rx="2" /><rect x="88" y="152" width="14" height="10" rx="2" /><rect x="174" y="162" width="14" height="10" rx="2" /></g>
    </svg>
  );
}

const FIG_W = 76, FIG_H = 152;
export function Figure({ item, style, className = "", testId }: { item: CastItem | null; style?: React.CSSProperties; className?: string; testId?: string }) {
  if (!item) return null;
  return <div className={`mr-f${item.cut ? "" : " card"} ${className}`} style={{ width: FIG_W, height: FIG_H, ...style }} data-testid={testId}><img src={item.src} alt="" draggable={false} /></div>;
}

/** Il personaggio `pos` esce dal separé, si mostra davanti e rientra: 1 secondo. `sx` = da che lato esce; `delay` = quanto è già avanti l'animazione (ms). */
export function Actor({ item, sx, delay, label }: { item: CastItem | null; sx: 1 | -1; delay: number; label?: string }) {
  return <Figure item={item} className="mr-act" testId={label} style={{ left: 186 - FIG_W / 2, top: 478 - FIG_H, ["--sx" as string]: sx, animationDelay: `${delay}ms`, animationDuration: `${MINI_SLOT_MS}ms` }} />;
}

/** Il palco durante la corsa: separé, personaggio di lato (accusatore / partner) e quello che sta uscendo. `t` = ms dal «via». */
export function RunScene({ order, cast, side, sideLabel, t }: { order: number[]; cast: (CastItem | null)[]; side: CastItem | null; sideLabel: string | null; t: number }) {
  const slot = Math.floor(t / MINI_SLOT_MS), active = t >= 0 && slot < order.length ? order[slot]! : null;
  const delays = useRef<Record<number, number>>({});
  if (active !== null && delays.current[slot] === undefined) delays.current[slot] = -(t - slot * MINI_SLOT_MS);
  return (
    <Scene>
      {side && <Figure item={side} className="mr-side" style={{ left: SIDE.x - FIG_W / 2, top: SIDE.y - FIG_H, transform: `scale(${FIG_SCALE})` }} testId="mr-side" />}
      {side && sideLabel && <span className="mr-tag" style={{ left: 4, top: SIDE.y + 6 }}>{sideLabel}</span>}
      {active !== null && <Actor key={slot} item={cast[active - 1] ?? null} sx={slot % 2 ? -1 : 1} delay={delays.current[slot]!} label={`mr-actor-${active}`} />}
      <Separe />
    </Scene>
  );
}

const keyframes = (wps: WP[], D: number): Keyframe[] => {
  const w = wps.slice().sort((a, b) => a.t - b.t);
  const kf: Keyframe[] = w.map((p) => ({ offset: Math.min(1, Math.max(0, p.t / D)), transform: `translate(${p.x}px,${p.y}px) translate(-50%,-100%) rotate(${p.r ?? 0}deg) scale(${p.s ?? FIG_SCALE})`, opacity: p.o ?? 1, zIndex: String(Math.round(p.y)), easing: "ease-in-out" }));
  if (kf.length && kf[0]!.offset! > 0) kf.unshift({ ...kf[0]!, offset: 0 });
  if (kf.length && kf[kf.length - 1]!.offset! < 1) kf.push({ ...kf[kf.length - 1]!, offset: 1 });
  return kf;
};

/** La scenetta finale: i percorsi di `finale` riprodotti con le animazioni del browser. `seek` (solo prove): mostra l'istante dato. */
export function FinaleScene({ finale, cast, side, onDone, seek }: { finale: Finale; cast: (CastItem | null)[]; side: CastItem | null; onDone: () => void; seek?: number }) {
  const refs = useRef<Record<string, HTMLDivElement | null>>({}), heartRefs = useRef<(HTMLSpanElement | null)[]>([]), done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const anims: Animation[] = [];
    for (const f of finale.figs) { const el = refs.current[f.key]; if (el && f.wps.length) anims.push(el.animate(keyframes(f.wps, finale.duration), { duration: finale.duration, fill: "both", easing: "linear" })); }
    finale.hearts.forEach((h, i) => {
      const el = heartRefs.current[i]; if (!el) return;
      const top = { x: h.x + h.dx * 0.5, y: h.y - h.rise }, end = { x: h.x + h.dx, y: h.y + h.fall };
      anims.push(el.animate([
        { transform: `translate(${h.x}px,${h.y}px) scale(.3)`, opacity: 0, offset: 0 },
        { transform: `translate(${(h.x + top.x) / 2}px,${(h.y + top.y) / 2}px) scale(1)`, opacity: 1, offset: 0.2, easing: "ease-out" },
        { transform: `translate(${top.x}px,${top.y}px) scale(1.05) rotate(${h.dx > 0 ? 14 : -14}deg)`, opacity: 1, offset: 0.45, easing: "ease-in" },
        { transform: `translate(${end.x}px,${end.y}px) scale(.9) rotate(${h.dx > 0 ? 40 : -40}deg)`, opacity: 1, offset: 1 },
      ], { duration: h.dur, delay: h.t, fill: "both" }));
    });
    if (seek !== undefined) { for (const a of anims) { a.pause(); a.currentTime = seek; } return () => anims.forEach((a) => a.cancel()); }
    const timer = window.setTimeout(() => done.current(), finale.duration);
    return () => { window.clearTimeout(timer); anims.forEach((a) => a.cancel()); };
  }, [finale, seek]);
  return (
    <Scene>
      {finale.figs.map((f) => {
        const item = f.who === "side" ? side : cast[f.who - 1] ?? null;
        return item ? <div key={f.key} ref={(el) => { refs.current[f.key] = el; }} className="mr-fa" style={{ width: FIG_W, height: FIG_H }}><Figure item={item} style={{ position: "static", transform: "none" }} testId={`mr-fig-${f.key}`} /></div> : null;
      })}
      {finale.hearts.map((h, i) => (
        <span key={i} ref={(el) => { heartRefs.current[i] = el; }} className="mr-heart" style={{ width: h.size, height: h.size * 0.9, opacity: 0 }}>
          <svg viewBox="0 0 32 29"><path d="M16 27C-6 12 3 -3 16 7 29 -3 38 12 16 27Z" fill={`hsl(${h.hue} 88% 58%)`} stroke="#13224a" strokeWidth="2.4" strokeLinejoin="round" /></svg>
        </span>
      ))}
      {finale.bursts.map((b, i) => <span key={i} className="mr-burst" style={{ left: b.x - 60, top: b.y, animationDelay: `${b.t}ms` }}>{tx(b.kind === "bam" ? "mr.fx.bam" : "mr.fx.via")}</span>)}
    </Scene>
  );
}
export { SLOT };
