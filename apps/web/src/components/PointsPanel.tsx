import { useEffect } from "react";
import type { LuiOutcome, ScoreLine } from "@gdt/game-engine";
import { cardFull } from "../lib/cards.ts";
import { luiLabel } from "../lib/lui.ts";
import { sfx } from "../lib/sfx.ts";
import type { Voter } from "./Terrace.tsx";
import { Pt } from "./Pt.tsx";
import { t, ts } from "../lib/testi.ts";

const pts = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);

/** Riepilogo del turno dai giocatori: a sinistra chi è, al centro cosa ha fatto di giusto o sbagliato, a destra la carta votata. */
export default function PointsPanel({ cardIds, voters, votes, lines, lui, fallPositions, sound, interactive, onContinue, meId }: {
  /** Chi guarda: la sua riga va in cima e si chiama «Tu». */ meId?: string;
  cardIds: string[]; voters: Voter[]; votes: Record<string, number>; lines: Record<string, ScoreLine[]>; lui: LuiOutcome | null; fallPositions: number[]; sound: boolean; interactive: boolean; hideGo?: boolean; onContinue: () => void;
}) {
  useEffect(() => { sfx.tada(sound); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!interactive) { const t = setTimeout(onContinue, 6000); return () => clearTimeout(t); } return undefined; }, [interactive]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = (id: string) => (lines[id] ?? []).reduce((a, l) => a + l.pts, 0);
  const sorted = [...voters].map((v) => ({ v, t: total(v.id) })).sort((a, b) => b.t - a.t);
  const rows = meId ? [...sorted.filter((r) => r.v.id === meId), ...sorted.filter((r) => r.v.id !== meId)] : sorted;
  const fell = (p: number) => fallPositions.includes(p);
  const say = (v: Voter) => {
    const ls = lines[v.id] ?? [], p = votes[v.id]!, out: { ok: boolean; t: string }[] = [];
    out.push(fell(p) ? { ok: true, t: ts("pp.giusto") } : { ok: false, t: ts("pp.sbagliato") });
    const c = ls.find((l) => l.kind === "carta"); if (c) out.push({ ok: true, t: ts("pp.caduta") });
    const l = ls.find((x) => x.kind === "lui"), m = ls.find((x) => x.kind === "lui-mancato");
    if (l && lui) out.push({ ok: true, t: ts("pp.lui.ok", { lui: luiLabel(lui).toLowerCase() }) });
    if (m && lui) out.push({ ok: false, t: ts("pp.lui.ko", { lui: luiLabel(lui).toLowerCase() }) });
    if (ls.some((x) => x.kind === "gregge")) out.push({ ok: false, t: ts("pp.gregge") });
    return out;
  };
  return (
    <div className="pb pbp" data-testid="points-panel">
      <b className="rv-t" data-testid="points-title">{t("pp.titolo")}</b>
      <div className="pb-scroll">
        {rows.map(({ v, t }) => {
          const p = votes[v.id]!, id = cardIds[p - 1];
          return (
            <div className={`prow2${v.id === meId ? " you" : ""}`} key={v.id} data-testid="points-block">
              <div className="pr-who"><i className="dc" style={{ background: v.color }} /><span>{v.id === meId ? ts("pp.tu") : v.name}{v.mega ? " 📣" : ""}</span></div>
              <div className="pr-say">{say(v).map((s, i) => <span key={i} className={s.ok ? "ok" : "ko"}>{s.ok ? "✓" : "✗"} {s.t}</span>)}</div>
              <div className="pr-card">{id && <span className="pb-c" style={{ backgroundImage: `url(${cardFull(id)})` }}><i>{p}</i></span>}<b className={t > 0 ? "up" : t < 0 ? "dn" : "zz"}><Pt n={t} plus={t > 0} /></b></div>
            </div>
          );
        })}
      </div>
      {!interactive && <span className="pb-wait">{t("pp.attesa")}</span>}
    </div>
  );
}
