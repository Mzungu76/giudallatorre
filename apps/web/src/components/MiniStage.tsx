import { useEffect, useMemo, useRef } from "react";
import type { MutableRefObject, ReactNode } from "react";
import { MINI_SLOT_MS } from "@gdt/game-engine";
import { terraceBaseHtml } from "../scene/draw.ts";
import { cardFull, useCards } from "../lib/cards.ts";
import { sfx } from "../lib/sfx.ts";
import { useStage } from "../ui.tsx";
import { FIG_SCALE, SIDE } from "../lib/miniScenes.ts";
import type { Cam, Finale, WP } from "../lib/miniScenes.ts";
import { t as tx } from "../lib/testi.ts";

/** Una carta da mostrare (sempre la carta intera, con la sua cornice). */
export interface CastItem { src: string }
export function useCast(ids: (string | null | undefined)[]): (CastItem | null)[] {
  const ready = useCards();
  return useMemo(() => ids.map((id) => (id && ready ? { src: cardFull(id) } : null)), [ready, ids.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** La terrazza (come nel resto del gioco) con le carte sopra: tutto nelle stesse coordinate del disegno. `camRef` = la «macchina da presa» che si può muovere. */
export function Scene({ children, camRef }: { children: ReactNode; camRef?: MutableRefObject<HTMLDivElement | null> }) {
  const { ts, ty } = useStage(), base = useMemo(() => terraceBaseHtml(), []);
  return (
    <div className="layer mr-scene" style={{ transformOrigin: "186px 300px", transform: `translateY(${ty}px) scale(${ts})` }} data-testid="mr-scene">
      <div className="mr-cam" ref={(el) => { if (camRef) camRef.current = el; }} style={{ left: 0, top: 0, width: 372, height: 826 }}>
        <div style={{ left: 0, top: 0, width: 372, height: 826 }} dangerouslySetInnerHTML={{ __html: base }} />
        {children}
      </div>
    </div>
  );
}

/** Il separé: tre pannelli a zig-zag, da dove escono le carte. */
export function Separe() {
  return (
    <svg className="mr-sep" viewBox="0 0 190 176" aria-hidden>
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

export const FIG_W = 84, FIG_H = 126, LEG = 8;
/** Una carta sul suo piedino nero (lo stesso, fermo, dei turni normali), con l'ombra. */
export function Figure({ item, style, className = "", testId }: { item: CastItem | null; style?: React.CSSProperties; className?: string; testId?: string }) {
  if (!item) return null;
  return (
    <div className={`mr-f ${className}`} style={{ width: FIG_W, height: FIG_H + LEG, ...style }} data-testid={testId}>
      <i className="mr-sh" />
      <img className="mr-card" src={item.src} alt="" draggable={false} />
      <i className="mr-foot" />
    </div>
  );
}

/** La carta `pos` esce dal separé, si gira, si mostra davanti e rientra: 3 secondi. `sx` = da che lato esce; `delay` = quanto è già avanti l'animazione (ms). */
export function Actor({ item, sx, delay, label }: { item: CastItem | null; sx: 1 | -1; delay: number; label?: string }) {
  return <Figure item={item} className="mr-act" testId={label} style={{ left: 186 - FIG_W / 2, top: 478 - FIG_H - LEG, ["--sx" as string]: sx, animationDelay: `${delay}ms`, animationDuration: `${MINI_SLOT_MS}ms` }} />;
}

/** Il palco durante la corsa: separé, carta di lato (accusatore / partner) e quella che sta uscendo, con il suo fascio di luce. `t` = ms dal «via». */
export function RunScene({ order, cast, side, sideLabel, t }: { order: number[]; cast: (CastItem | null)[]; side: CastItem | null; sideLabel: string | null; t: number }) {
  const slot = Math.floor(t / MINI_SLOT_MS), active = t >= 0 && slot < order.length ? order[slot]! : null;
  const delays = useRef<Record<number, number>>({});
  if (active !== null && delays.current[slot] === undefined) delays.current[slot] = -(t - slot * MINI_SLOT_MS);
  return (
    <Scene>
      {side && <Figure item={side} className="mr-side" style={{ left: SIDE.x - FIG_W / 2, top: SIDE.y - FIG_H - LEG, transform: `scale(${FIG_SCALE})` }} testId="mr-side" />}
      {side && sideLabel && <span className="mr-tag" style={{ left: 4, top: SIDE.y + 22 }}>{sideLabel}</span>}
      {active !== null && <i key={`b${slot}`} className="mr-beam" style={{ animationDelay: `${delays.current[slot]}ms`, animationDuration: `${MINI_SLOT_MS}ms` }} />}
      {active !== null && <Actor key={slot} item={cast[active - 1] ?? null} sx={slot % 2 ? -1 : 1} delay={delays.current[slot]!} label={`mr-actor-${active}`} />}
      <Separe />
    </Scene>
  );
}

/** Il sipario: due tende di velluto con frange dorate, e la mantovana in alto che resta sempre. `children` = scritta sulle tende chiuse. */
export function Curtain({ closed, valance = null, children }: { closed: boolean; /** testo sulla mantovana (null = niente mantovana) */ valance?: ReactNode; children?: ReactNode }) {
  return (
    <div className={`mr-curt${closed ? " shut" : ""}${valance ? "" : " nov"}`} data-testid="mr-curtain" data-shut={closed ? "1" : "0"} aria-hidden={!closed}>
      <div className="mr-cp l" /><div className="mr-cp r" />
      {valance && <div className="mr-cv"><b>{valance}</b></div>}
      <div className="mr-cs">{children}</div>
    </div>
  );
}

/** Le due bande nere del cinema: scendono per la scenetta finale; sotto, la didascalia come un sottotitolo. */
export function Letterbox({ on, text }: { on: boolean; text?: ReactNode }) {
  return (
    <div className={`mr-lb${on ? " on" : ""}`} aria-hidden={!on}>
      <div className="mr-lbt" /><div className="mr-lbb"><b>{text}</b></div>
    </div>
  );
}

const keyframes = (wps: WP[], D: number): Keyframe[] => {
  const w = wps.slice().sort((a, b) => a.t - b.t);
  const kf: Keyframe[] = w.map((p) => ({ offset: Math.min(1, Math.max(0, p.t / D)), transform: `translate(${p.x}px,${p.y}px) translate(-50%,-100%) rotate(${p.r ?? 0}deg) scale(${p.s ?? FIG_SCALE})`, opacity: p.o ?? 1, zIndex: String(Math.round(p.y)), easing: "ease-in-out" }));
  if (kf.length && kf[0]!.offset! > 0) kf.unshift({ ...kf[0]!, offset: 0 });
  if (kf.length && kf[kf.length - 1]!.offset! < 1) kf.push({ ...kf[kf.length - 1]!, offset: 1 });
  return kf;
};
const camFrames = (cam: Cam[], D: number): Keyframe[] => cam.slice().sort((a, b) => a.t - b.t).map((c) => ({ offset: Math.min(1, Math.max(0, c.t / D)), transform: `translate(${c.x}px,${c.y}px) scale(${c.s})`, easing: "ease-in-out" }));

/** La scenetta finale: i percorsi di `finale` riprodotti con le animazioni del browser, con macchina da presa ed effetti sonori. `seek` (solo prove): mostra l'istante dato. */
export function FinaleScene({ finale, cast, side, onDone, seek, sound = false }: { finale: Finale; cast: (CastItem | null)[]; side: CastItem | null; onDone: () => void; seek?: number; sound?: boolean }) {
  const refs = useRef<Record<string, HTMLDivElement | null>>({}), heartRefs = useRef<(HTMLSpanElement | null)[]>([]), camRef = useRef<HTMLDivElement | null>(null), done = useRef(onDone), snd = useRef(sound);
  done.current = onDone; snd.current = sound;
  useEffect(() => {
    const anims: Animation[] = [];
    for (const f of finale.figs) { const el = refs.current[f.key]; if (el && f.wps.length) anims.push(el.animate(keyframes(f.wps, finale.duration), { duration: finale.duration, fill: "both", easing: "linear" })); }
    if (camRef.current && finale.cam.length) anims.push(camRef.current.animate(camFrames(finale.cam, finale.duration), { duration: finale.duration, fill: "both", easing: "linear" }));
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
    const timers = finale.sounds.map((s) => window.setTimeout(() => { const on = snd.current; if (s.kind === "stamp") sfx.stamp(on); else if (s.kind === "whoosh") sfx.whoosh(on); else if (s.kind === "ding") sfx.ding(on); else if (s.kind === "drum") sfx.drum(on, 0.5); else sfx.tada(on); }, s.t));
    timers.push(window.setTimeout(() => done.current(), finale.duration));
    return () => { timers.forEach((x) => window.clearTimeout(x)); anims.forEach((a) => a.cancel()); };
  }, [finale, seek]);
  return (
    <Scene camRef={camRef}>
      {finale.figs.map((f) => {
        const item = f.who === "side" ? side : cast[f.who - 1] ?? null;
        return item ? <div key={f.key} ref={(el) => { refs.current[f.key] = el; }} className="mr-fa" style={{ width: FIG_W, height: FIG_H + LEG }}><Figure item={item} style={{ position: "static", transform: "none" }} testId={`mr-fig-${f.key}`} /></div> : null;
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
