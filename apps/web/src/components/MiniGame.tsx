import { useEffect, useMemo, useRef, useState } from "react";
import type { MiniResult } from "@gdt/game-engine";
import { MINI_COUNTDOWN_MS, MINI_SLOT_MS } from "@gdt/game-engine";
import { Disc, FAST } from "../ui.tsx";
import { cardFull } from "../lib/cards.ts";
import { sfx } from "../lib/sfx.ts";
import Standings from "./Standings.tsx";
import { Terrace } from "./Terrace.tsx";
import type { VoteTok } from "./Terrace.tsx";
import { BMeta, BSheet, LuiTray, Row } from "./BUi.tsx";
import { usePeople } from "../screens/Game.tsx";
import { HintBubble, HintPointer, useIdleHint } from "./IdleHint.tsx";
import { miniInfo } from "../lib/minis.ts";
import { hintFor } from "../lib/hints.tsx";
import { buildFinale } from "../lib/miniScenes.ts";
import { FinaleScene, RunScene, useCast } from "./MiniStage.tsx";
import { Pt } from "./Pt.tsx";
import type { GameProps } from "../screens/Game.tsx";
import { t, ts } from "../lib/testi.ts";
import type { TestoKey } from "../lib/testi.ts";

type Entry = { name: string; color: string; pts: number };
interface Block { key: string; title: string; sub: string; entries: Entry[]; thumbs: number[] }
function blocksOf(res: MiniResult, name: (id: string) => { name: string; color: string }): Block[] {
  const by = (kind: string): Entry[] => Object.entries(res.lines).flatMap(([id, ls]) => ls.filter((l) => l.kind === kind).map((l) => ({ ...name(id), pts: l.pts })));
  const b: Block[] = [], giusto = by("mini-giusto"), veloce = by("mini-veloce");
  if (giusto.length) b.push({ key: "mini-giusto", title: ts("mg.blk.giusto.t"), sub: ts(`mg.blk.giusto.x.${res.kind}` as TestoKey), entries: giusto, thumbs: res.leaders });
  if (veloce.length) b.push({ key: "mini-veloce", title: ts("mg.blk.veloce.t"), sub: ts("mg.blk.veloce.x"), entries: veloce, thumbs: res.leaders });
  return b;
}

/** Orologio locale a 50 ms: serve a far scorrere presentazione, 3-2-1 e personaggi. */
function useTick(on: boolean, ms = 50) { const [n, setN] = useState(Date.now()); useEffect(() => { if (!on) return undefined; const i = setInterval(() => setN(Date.now()), ms); return () => clearInterval(i); }, [on, ms]); return n; }

/** L'intervallo a tempo: scenetta e pulsante «QUESTO!» mentre i personaggi escono dal separé. */
function Run({ room, view, goAt, send, readOnly, sound }: GameProps) {
  const mini = view.mini!, info = miniInfo(mini.kind), order = mini.order, me = view.viewerId;
  const first = useRef<number | null>(null), now = useTick(true);
  const go = goAt ?? (first.current ??= Date.now() + 7500), t0 = now - go;   // t0 < 0: presentazione e conto alla rovescia; ≥ 0: i personaggi escono
  const cast = useCast(view.tower.slice().sort((a, b) => a.position - b.position).map((x) => x.cardId)), side = useCast([mini.cardId])[0] ?? null;
  const [pending, setPending] = useState<number | null>(null), voted = view.myVote ?? pending;
  useEffect(() => { if (pending !== null && view.myVote === null) { const x = setTimeout(() => setPending(null), 1500); return () => clearTimeout(x); } return undefined; }, [pending, view.myVote]);
  const people = usePeople(room), voters = view.players.filter((p) => p.hasVoted).length;
  const end = order.length * MINI_SLOT_MS, running = t0 >= 0 && t0 < end, over = t0 >= end;
  const intro = t0 < -MINI_COUNTDOWN_MS, count = !intro && t0 < 0 ? Math.ceil(-t0 / 1000) : null, via = t0 >= 0 && t0 < 800;
  useEffect(() => { sfx.fanfare(sound); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const lastCount = useRef<number | null>(null);
  useEffect(() => { if (count !== null && count !== lastCount.current) { lastCount.current = count; sfx.tap(sound, 440 + (3 - count) * 110); } }, [count, sound]);
  const sent = useRef(false);   // sul telefono un tocco può generare sia pointerdown sia click: un solo voto
  const vote = () => {
    if (readOnly || voted !== null || !running || sent.current) return;
    sent.current = true;
    const i = Math.floor((Date.now() - go) / MINI_SLOT_MS), pos = order[Math.min(order.length - 1, Math.max(0, i))]!;
    setPending(pos); send({ t: "act", action: { type: "vote", position: pos } }); sfx.tap(sound, 660);
  };
  const body = mini.kind === "accusa" ? `«${mini.text}»` : info.body ?? "";
  const hint = readOnly ? null : hintFor(view);
  const [hintOn, hintClose] = useIdleHint(!!hint && running && voted === null, `run-${view.turn}`);
  const label = voted !== null ? t("mr.btn.votato") : over ? t("mr.btn.fuori") : running ? t("mr.btn") : t("mr.btn.pronti");
  return (
    <div className="mr" data-testid="mini-run">
      <RunScene order={order} cast={cast} side={side} sideLabel={info.side} t={t0} />
      <div className="mr-top"><BMeta turn={ts("mg.turno", { n: view.turn, tot: view.totalTurns })} right={`🎭 ${info.title}`} /></div>
      <div className={`mr-cap${body.length > 60 ? " l" : ""}`} data-testid="mini-head">
        <small>{mini.kind === "accusa" ? t("mg.accusatore") : info.tag}</small><b>{body || info.tag}</b>
      </div>
      {intro && (
        <div className="mr-intro" data-testid="mini-intro" role="dialog" aria-label={ts("mg.interv.aria")}>
          <div className="strip">{t("mg.strip")}</div>
          <div className="mr-it">{info.icon} {info.title}</div>
          <p>{info.rule}</p>
        </div>
      )}
      {count !== null && <div key={count} className="mr-count" data-testid="mr-count">{count}</div>}
      {via && !intro && <div className="mr-count via" data-testid="mr-via">{t("mr.via")}</div>}
      {!readOnly ? (
        <div className="mr-bottom">
          <button type="button" className={`bt ${voted !== null || !running ? "dis" : "mus"} mr-btn`} disabled={voted !== null || !running} onClick={vote} onPointerDown={(e) => { if (e.pointerType === "touch" && running && voted === null) { e.preventDefault(); vote(); } }} data-testid="run-vote" aria-label={ts("mr.btn.aria")}>
            {voted !== null && <Disc color={people.get(me).color} />}{label}
          </button>
        </div>
      ) : <div className="mr-bottom ro"><b data-testid="run-voti">{ts("mg.hanno.votato", { n: voters, tot: view.players.length })}</b></div>}
      {hintOn && hint && <><HintBubble onClose={hintClose}>{hint.text}</HintBubble><HintPointer targets={hint.targets} /></>}
    </div>
  );
}

/** Dopo la corsa: scenetta finale → chi prende punti → classifica. */
function End({ room, view, send, readOnly, sound, ui }: GameProps) {
  const people = usePeople(room), res = view.miniResult!, me = view.viewerId, isHost = room.hostId === me, kind = res.kind, info = miniInfo(kind);
  const [step, setStep] = useState<"finale" | "points" | "board">(FAST ? "points" : "finale");
  const ids = useMemo(() => view.tower.slice().sort((a, b) => a.position - b.position).map((x) => x.cardId), [view.tower]);
  const cast = useCast(ids), side = useCast([res.cardId])[0] ?? null;
  const finale = useMemo(() => buildFinale(kind, res.leaders, res.fallenPositions), [kind, res.leaders.join(","), res.fallenPositions.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (step === "points") sfx.tada(sound); }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = () => send({ t: "act", action: { type: "advance" } });
  const toks: VoteTok[] = useMemo(() => Object.entries(res.votes).map(([id, p]) => ({ p, c: people.get(id).color, mega: false })), [res, people]);
  const blocks = blocksOf(res, (id) => ({ name: people.get(id).name, color: people.get(id).color }));
  const rows = view.players.map((p) => ({ id: p.id, name: people.get(p.id).name, color: people.get(p.id).color, score: p.score }));
  const headline = res.leaders.length === 0 ? t("mr.fin.nessuno") : kind === "accusa" ? t("mr.fin.accusa") : kind === "amore" ? t("mr.fin.amore") : t("mr.fin.peggiore");
  const uiv = readOnly ? null : ui ?? null, tray = uiv ? <LuiTray view={view} ui={uiv} /> : null;
  const counts = res.counts;
  return (
    <>
      {step === "points" && <Terrace cardIds={ids} votes={toks} />}
      {step === "finale" && (
        <div className="mr" data-testid="mini-finale">
          <FinaleScene finale={finale} cast={cast} side={side} onDone={() => setStep("points")} />
          <div className="mr-top"><BMeta turn={ts("mg.turno", { n: view.turn, tot: view.totalTurns })} right={`🎭 ${info.title}`} /></div>
          <div className="mr-cap head"><b>{headline}</b></div>
          {!readOnly && <button className="skip" onClick={() => setStep("points")} data-testid="skip">{t("mg.salta")}</button>}
        </div>
      )}
      <div className="bl">
        {step === "points" && <>
          <BMeta turn={ts("mg.turno", { n: view.turn, tot: view.totalTurns })} right={`🎭 ${info.title}`} />
          <div className="pp ivl-res" data-testid="mini-tally"><b>{t("mg.resta.t")}</b>
            <div className="ivl-row">{ids.map((id, i) => { const pos = i + 1, out = res.fallenPositions.includes(pos), win = kind === "amore" && res.leaders.includes(pos); return (
              <div key={id} className={`ivl-t ${out ? "out" : "in"}`}><span className="th" style={{ backgroundImage: `url(${cardFull(id)})` }}><i>{pos}</i></span><b>{counts[pos] ?? 0}</b><u>{out ? t("mg.cade") : win ? t("mg.vince") : t("mg.resta")}</u></div>); })}</div>
          </div>
          <div className="pb" data-testid="points-panel">
            <b className="rv-t" data-testid="points-title">{t("mg.chi.punti")}</b>
            <div className="pb-scroll">
              {blocks.length === 0 && <span className="pb-none">{t("mg.nessuno")}</span>}
              {blocks.map((b, bi) => (
                <div className="pb-blk" key={b.key} data-testid="points-block" style={{ animationDelay: `${0.4 + bi * 1.4}s` }}>
                  <div className="pb-h">
                    <span className="pb-th">{b.thumbs.slice(0, 3).map((p) => <span key={p} className="pb-c" style={{ backgroundImage: `url(${cardFull(ids[p - 1]!)})` }}><i>{p}</i></span>)}</span>
                    <span className="pb-tx"><b>{b.title}</b><small>{b.sub}</small></span>
                  </div>
                  <div className="pb-who">{b.entries.map((e, k) => <span className="pb-nm" key={k}><i className="dc" style={{ background: e.color }} />{e.name} <em><Pt n={e.pts} /></em></span>)}</div>
                </div>))}
            </div>
          </div>
          <div className="bsp" />
          <BSheet title={t("mg.fine.t")} sub={t("mg.fine.s")} ui={uiv}>
            {readOnly ? <span className="pb-wait">{t("mg.finisce")}</span> : <Row>{tray}<button type="button" className="bt mus" onClick={() => setStep("board")} data-testid="points-continue">{t("mg.continua")}</button></Row>}
          </BSheet>
        </>}
      </div>
      {step === "board" && (
        <Standings rows={rows} turn={view.turn} total={view.totalTurns} title={ts("mg.dopo")} onClose={() => undefined}
          action={readOnly ? { wait: ts("mg.host.wait") } : isHost ? { label: ts("mg.riprendiamo"), onClick: act } : { wait: ts("mg.host.aspetta") }} />
      )}
    </>
  );
}

export default function MiniGame(p: GameProps) {
  return p.view.phase === "MINI_RUN" && p.view.mini ? <Run {...p} /> : p.view.miniResult ? <End {...p} /> : null;
}
