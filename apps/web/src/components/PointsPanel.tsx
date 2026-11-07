import { useEffect } from "react";
import type { LuiOutcome, ScoreLine } from "@gdt/game-engine";
import { cardFull } from "../lib/cards.ts";
import { luiLabel } from "../lib/lui.ts";
import { sfx } from "../lib/sfx.ts";
import type { Voter } from "./Terrace.tsx";

const BLK_DT = 1.9;
const thumb = (id: string) => ({ backgroundImage: `url(${cardFull(id)})` });

/** Spiegazione dei punti del turno, DOPO la caduta: un blocco per motivo (chi e perché), si chiude a mano. */
export default function PointsPanel({ cardIds, voters, lines, lui, fallPositions, sound, interactive, hideGo, onContinue }: {
  cardIds: string[]; voters: Voter[]; lines: Record<string, ScoreLine[]>; lui: LuiOutcome | null; fallPositions: number[]; sound: boolean; interactive: boolean; hideGo?: boolean; onContinue: () => void;
}) {
  const multi = fallPositions.length > 1, fallPos = fallPositions[0]!;
  useEffect(() => { sfx.tada(sound); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!interactive) { const t = setTimeout(onContinue, 6000); return () => clearTimeout(t); } return undefined; }, [interactive]); // eslint-disable-line react-hooks/exhaustive-deps
  const who = (kinds: string[]) => voters.flatMap((v) => (lines[v.id] ?? []).filter((l) => kinds.includes(l.kind)).map(() => ({ name: v.name + (v.mega ? " 📣" : ""), color: v.color })));
  const lineOf = (kinds: string[]) => voters.flatMap((v) => (lines[v.id] ?? []).filter((l) => kinds.includes(l.kind)))[0];
  const blocks = (() => {
    const b: { key: string; title: string; sub: string; label: string; who: { name: string; color: string }[]; thumbs: number[]; neg?: boolean }[] = [];
    const vw = who(["voto"]);
    if (vw.length) b.push({ key: "voto", title: "Voto giusto", sub: multi ? "Hanno votato una delle carte cadute" : `Hanno votato il n. ${fallPos}, che cade`, label: "+2 a testa", who: vw, thumbs: fallPositions });
    const cw = who(["carta"]);
    if (cw.length) b.push({ key: "carta", title: "Carta caduta", sub: multi ? "Avevano giocato le carte cadute" : "Aveva giocato la carta caduta", label: "+2 a carta", who: cw, thumbs: fallPositions });
    if (lui) {
      const hit = lui.hit, who2 = who(["lui", "lui-mancato"]);
      b.push({ key: "lui", title: hit ? "Lui! azzeccato" : "Lui! mancato", sub: `${luiLabel(lui)} sul n. ${lui.position}: ${lui.others === 0 ? "nessun altro l'ha votata" : lui.others === 1 ? "1 voto degli altri" : lui.others + " voti degli altri"}${hit ? "" : " — niente punti, il segnalino è speso"}`, label: hit ? `+${lui.pts}` : "0", who: who2, thumbs: [lui.position], neg: !hit });
    }
    return b;
  })();
  const totals = voters.map((v) => ({ v, t: (lines[v.id] ?? []).reduce((a, l) => a + l.pts, 0) })).filter((x) => (lines[x.v.id] ?? []).length > 0).sort((a, b) => b.t - a.t);
  return (
    (
        <div className="pb" data-testid="points-panel">
          <b className="rv-t" data-testid="points-title">Chi prende punti</b>
          <div className="pb-scroll">
            {blocks.length === 0 && <span className="pb-none">Questa volta nessuno prende punti.</span>}
            {blocks.map((b, bi) => (
              <div className={`pb-blk ${b.neg ? "neg" : ""}`} key={b.key} data-testid="points-block" style={{ animationDelay: `${0.4 + bi * BLK_DT}s` }}>
                <div className="pb-h">
                  <span className="pb-th">{b.thumbs.map((p) => <span key={p} className="pb-c" style={thumb(cardIds[p - 1]!)}><i>{p}</i></span>)}</span>
                  <span className="pb-tx"><b>{b.title}</b><small>{b.sub}</small></span>
                  <span className="pb-pts">{b.label}</span>
                </div>
                <div className="pb-who">{b.who.map((w, k) => <span className="pb-nm" key={k}><i className="dc" style={{ background: w.color }} />{w.name}</span>)}</div>
              </div>))}
            {totals.length > 0 && <div className="pb-sum" data-testid="points-total" style={{ animationDelay: `${0.4 + blocks.length * BLK_DT}s` }}><b>In totale nel turno</b><span>{totals.map((x) => <span className={`pb-nm ${x.t < 0 ? "neg" : ""}`} key={x.v.id}><i className="dc" style={{ background: x.v.color }} />{x.v.name} <em>{x.t > 0 ? "+" : "−"}{Math.abs(x.t)}</em></span>)}</span></div>}
          </div>
          {hideGo ? null : interactive
            ? <button className="pb-go" onClick={onContinue} data-testid="points-continue">Continua ›</button>
            : <span className="pb-wait">Il Megafono prosegue…</span>}
        </div>)
  );
}
