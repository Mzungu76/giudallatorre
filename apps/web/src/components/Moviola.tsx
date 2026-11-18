import { useEffect, useMemo, useState } from "react";
import type { StereoScena } from "@gdt/game-engine";
import { fraseLuogo, ruoloDi } from "../lib/stereo.ts";
import { cardFull } from "../lib/cards.ts";
import { t, ts } from "../lib/testi.ts";

const hash = (x: string): number => { let h = 2166136261; for (const c of x) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const n1 = (x: number): string => String(Math.round(x * 10) / 10).replace(".", ",");
const MIN = (x: string): string => x.charAt(0).toLowerCase() + x.slice(1);
/** Quanti passi ha una scena: la frase, le carte, i voti, il segnalino, il verdetto. */
const PASSI = 5;

/** Il turno che ha generato un luogo comune, rivisto al rallentatore: la frase del Megafono, le carte in torre, i voti (pedine colorate), il segnalino e la caduta, con un commento ironico a ogni passo.
 *  `k` è il luogo comune; `peso` il suo peso totale; `scene` solo i turni che lo hanno generato. */
export default function Moviola({ k, peso, scene, persona, onChiudi }: { k: string; peso: number; scene: StereoScena[]; persona: (id: string) => { name: string; color: string }; onChiudi: () => void }) {
  const [si, setSi] = useState(0), [passo, setPasso] = useState(0), [auto, setAuto] = useState(false);
  const sc = scene[si] ?? scene[0];
  useEffect(() => {
    if (!auto) return undefined;
    const id = setInterval(() => setPasso((p) => { if (p < PASSI - 1) return p + 1; setAuto(false); return p; }), 2600);
    return () => clearInterval(id);
  }, [auto]);
  const calc = useMemo(() => {
    if (!sc) return null;
    const caldi = new Set(sc.c.filter((c) => c.k === k).map((c) => c.p)), conto: Record<number, number> = {}; for (const p of Object.values(sc.v)) conto[p] = (conto[p] ?? 0) + 1;
    const n = [...caldi].reduce((a, p) => a + (conto[p] ?? 0), 0), segCaldo = sc.m.find((m) => caldi.has(m.p)), segAltro = sc.m.length > 0 && !segCaldo;
    const evit = sc.e !== null && caldi.has(sc.e) ? Object.values(sc.v).filter((p) => p !== sc.e).length : 0;
    return { caldi, conto, n, segCaldo, segAltro, evit, ruolo: ruoloDi(k), seme: hash(k + si) };
  }, [sc, k, si]);
  if (!sc || !calc) return null;
  const frase = fraseLuogo(k), tot = scene.length, cade = new Set(sc.f);
  const v3 = calc.seme % 3;
  const msg: string[] = [
    ts(`mv.frase.${v3}` as "mv.frase.0", { frase: sc.t.replace(/\.$/, "") }),
    ts(`mv.carte.${v3}` as "mv.carte.0", { n: sc.c.length }),
    [calc.n === 0 ? ts("mv.voti.zero", { ruolo: calc.ruolo }) : calc.n === 1 ? ts("mv.voti.uno", { ruolo: calc.ruolo }) : ts(`mv.voti.${v3}` as "mv.voti.0", { n: calc.n, ruolo: calc.ruolo }), calc.evit > 0 ? ts("mv.m.evit", { n: calc.evit }) : ""].filter(Boolean).join(" "),
    [calc.segCaldo ? ts(`mv.m.${calc.segCaldo.e}` as "mv.m.cade", { ruolo: calc.ruolo }) : calc.segAltro ? ts("mv.m.altrove") : ts("mv.m.nessuno"), calc.segCaldo && (calc.segCaldo.e === "cade" || calc.segCaldo.e === "nulli") && calc.n > 0 ? ts("mv.m.conf") : ""].filter(Boolean).join(" "),
    ts(`mv.fine.${v3}` as "mv.fine.0", { frase, fraseMin: MIN(frase), peso: n1(peso) }),
  ];
  return (
    <div className="mv" data-testid="moviola">
      <div className="mv-h"><b>{t("mv.titolo")}</b><span>{ts("mv.scena", { n: si + 1, tot })}</span></div>
      <div className="mv-torre">
        <div className="mv-cards">
          {sc.c.map((c) => {
            const caldo = calc.caldi.has(c.p), voti = Object.entries(sc.v).filter(([, p]) => p === c.p), seg = sc.m.find((m) => m.p === c.p), cadeQui = passo >= 4 && cade.has(c.p);
            return (
              <div key={c.p} className={`mv-c ${caldo ? "hot" : ""} ${cadeQui ? "cade" : ""}`} style={{ opacity: passo >= 1 ? 1 : 0.15 }}>
                <div className="mv-pedine">{passo >= 2 && voti.map(([pid]) => { const pe = persona(pid); return <i key={pid} style={{ background: pe.color }} title={pe.name}>{pe.name.replace(/^Bot\s+/i, "").charAt(0).toUpperCase()}</i>; })}</div>
                {passo >= 3 && seg && <u className={`mv-seg ${seg.e}`}>{seg.e === "cade" ? "CADE" : seg.e === "noncade" ? "NON CADE" : "NULLI"}</u>}
                <img src={cardFull(c.id)} alt="" draggable={false} />
                {cadeQui && <em className="mv-aaah">{t("mv.aaah")}</em>}
                <small>{c.k ? ruoloDi(c.k) : t("mv.senza")}</small>
              </div>
            );
          })}
        </div>
        <div className="mv-base" />
      </div>
      <p className="mv-txt" data-testid="moviola-testo" key={`${si}-${passo}`}>{msg[passo]}</p>
      <div className="mv-ctl">
        <button onClick={() => { setAuto(false); setPasso((p) => Math.max(0, p - 1)); }} disabled={passo === 0} aria-label={ts("mv.indietro")}>◀</button>
        <div className="mv-dots">{Array.from({ length: PASSI }, (_, i) => <i key={i} className={i === passo ? "on" : ""} />)}</div>
        <button onClick={() => { setAuto(false); setPasso((p) => Math.min(PASSI - 1, p + 1)); }} disabled={passo === PASSI - 1} aria-label={ts("mv.avanti")} data-testid="moviola-avanti">▶</button>
        <button className="mv-auto" onClick={() => { if (passo === PASSI - 1) setPasso(0); setAuto((a) => !a); }}>{auto ? t("mv.ferma") : t("mv.parti")}</button>
        {tot > 1 && <button onClick={() => { setSi((si + 1) % tot); setPasso(0); setAuto(false); }}>{ts("mv.scena", { n: ((si + 1) % tot) + 1, tot })}</button>}
        <button className="mv-x" onClick={onChiudi}>{t("mv.chiudi")}</button>
      </div>
    </div>
  );
}
