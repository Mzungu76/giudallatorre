import { useEffect, useMemo, useRef, useState } from "react";
import type { MiniResult } from "@gdt/game-engine";
import { MINI_COUNTDOWN_MS, MINI_CYCLES, MINI_INTRO_MS, MINI_SLOT_MS } from "@gdt/game-engine";
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
import { Curtain, FinaleScene, Letterbox, RunScene, useCast } from "./MiniStage.tsx";
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

/** Orologio locale a 50 ms: fa scorrere sipario, presentazione, 3-2-1 e carte. */
function useTick(ms = 50) { const [n, setN] = useState(Date.now()); useEffect(() => { const i = setInterval(() => setN(Date.now()), ms); return () => clearInterval(i); }, [ms]); return n; }

/** Il sipario resta chiuso per la scritta (poi si apre sul palco); dopo la corsa si richiude per il verdetto e dopo la scenetta per la fine. */
const CURTAIN_INTRO_MS = 1900, VERDICT_MS = 2800, OUTRO_MS = 2600;
type Post = null | "verdict" | "finale" | "outro" | "points" | "board";

export default function MiniGame({ room, view, goAt, send, readOnly, sound, ui }: GameProps) {
  const people = usePeople(room), me = view.viewerId, res = view.miniResult, mini = view.mini;
  const kind = (mini?.kind ?? res?.kind)!, info = miniInfo(kind), inRun = view.phase === "MINI_RUN", isHost = room.hostId === me;
  const now = useTick();
  const orderRef = useRef<number[]>(mini?.order ?? []); if (mini) orderRef.current = mini.order;
  const order = orderRef.current;
  const goRef = useRef<number | null>(goAt ?? null);
  const first = useRef<number | null>(null);
  if (goAt != null) goRef.current = goAt;
  const go = goRef.current ?? (first.current ??= Date.now() + MINI_INTRO_MS + MINI_COUNTDOWN_MS);
  const t0 = now - go, end = order.length * MINI_SLOT_MS, start = go - (MINI_INTRO_MS + MINI_COUNTDOWN_MS);

  // dopo la corsa: sipario (verdetto) → scenetta finale → sipario (fine) → punti → classifica
  const [post, setPost] = useState<Post>(() => (view.phase === "MINI_RESULTS" ? (FAST ? "points" : "verdict") : null));
  const marks = useRef({ shut: Date.now(), outro: 0 });
  useEffect(() => {
    if (post === null && (view.phase === "MINI_RESULTS" || (inRun && order.length > 0 && t0 >= end))) { marks.current.shut = Date.now(); setPost(FAST && view.phase === "MINI_RESULTS" ? "points" : "verdict"); }
    else if (post === "verdict" && view.phase === "MINI_RESULTS" && Date.now() - marks.current.shut >= (FAST ? 0 : VERDICT_MS)) setPost(FAST ? "points" : "finale");
    else if (post === "outro" && Date.now() - marks.current.outro >= OUTRO_MS) setPost("points");
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps
  const endFinale = () => { marks.current.outro = Date.now(); setPost("outro"); };

  const introShut = inRun && post === null && !FAST && now < start + CURTAIN_INTRO_MS;
  const shut = introShut || post === "verdict" || post === "outro";
  const curtainText = post === "verdict" || post === "finale" ? <b>{t("mr.sip.verdetto")}</b> : post !== null ? <b>{t("mg.fine.t")}</b> : <><small>{t("mg.strip")}</small><b>{info.icon} {info.title}</b></>;
  const showStage = post === null || post === "verdict", showFinale = post === "finale" || post === "outro";

  // suoni: apertura, ogni carta che esce, ultimo giro, verdetto, fine della scenetta
  const slot = Math.floor(t0 / MINI_SLOT_MS), running = inRun && post === null && t0 >= 0 && t0 < end;
  const lastSlot = useRef(-1);
  useEffect(() => { sfx.fanfare(sound); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (running && slot !== lastSlot.current) { lastSlot.current = slot; sfx.whoosh(sound); if (slot % 6 === 0 && slot > 0) sfx.drum(sound, 0.7); } }, [slot, running, sound]);
  useEffect(() => { if (post === "verdict") sfx.drum(sound, 1.4); if (post === "finale") sfx.tada(sound); }, [post]); // eslint-disable-line react-hooks/exhaustive-deps
  const count = inRun && post === null && t0 < 0 && t0 >= -MINI_COUNTDOWN_MS ? Math.ceil(-t0 / 1000) : null, lastCount = useRef<number | null>(null);
  useEffect(() => { if (count !== null && count !== lastCount.current) { lastCount.current = count; sfx.tap(sound, 440 + (3 - count) * 110); } }, [count, sound]);

  return (
    <>
      {showStage && <Run {...{ view, send, readOnly, sound, people, info, t0, end, running, order, go, post, introShut, count, slot }} />}
      {showFinale && res && <Finale res={res} view={view} readOnly={!!readOnly} sound={sound} onDone={endFinale} done={post === "outro"} />}
      {(post === "points" || post === "board") && res && <End {...{ room, view, send, readOnly, sound, ui, people, res, isHost }} step={post} onStep={setPost} />}
      <Curtain closed={shut} valance={post === "points" || post === "board" ? null : <span>{ts("mg.turno", { n: view.turn, tot: view.totalTurns })} · {info.icon} {info.title}</span>}>{curtainText}</Curtain>
    </>
  );
}

type People = ReturnType<typeof usePeople>;

interface RunProps extends Pick<GameProps, "view" | "send" | "readOnly" | "sound"> {
  people: People; info: ReturnType<typeof miniInfo>; t0: number; end: number; running: boolean; order: number[]; go: number; post: Post; introShut: boolean; count: number | null; slot: number;
}
/** La corsa: palco con il separé, le carte che escono (3 s l'una, 3 giri), conto dei giri e pulsante «QUESTO!». */
function Run({ view, send, readOnly, sound, people, info, t0, end, running, order, go, post, introShut, count, slot }: RunProps) {
  const mini = view.mini!, me = view.viewerId;
  const cast = useCast(view.tower.slice().sort((a, b) => a.position - b.position).map((x) => x.cardId)), side = useCast([mini.cardId])[0] ?? null;
  const [pending, setPending] = useState<number | null>(null), voted = view.myVote ?? pending, sent = useRef(false);
  useEffect(() => { if (pending !== null && view.myVote === null) { const x = setTimeout(() => { setPending(null); sent.current = false; }, 1500); return () => clearTimeout(x); } return undefined; }, [pending, view.myVote]);
  const voters = view.players.filter((p) => p.hasVoted).length, over = t0 >= end || post === "verdict";
  const intro = !introShut && t0 < -MINI_COUNTDOWN_MS, via = t0 >= 0 && t0 < 800 && post === null;
  const perCycle = Math.max(1, order.length / MINI_CYCLES), cyc = Math.min(MINI_CYCLES - 1, Math.max(0, Math.floor(slot / perCycle))), left = MINI_CYCLES - 1 - cyc;
  const showCycles = !introShut && t0 >= -MINI_COUNTDOWN_MS && !over, inSlot = t0 - slot * MINI_SLOT_MS;
  const banner = running && cyc >= 1 && slot % perCycle === 0 && inSlot < 1800 ? (left === 0 ? t("mr.ultimo") : ts("mr.giro.b", { n: cyc + 1 })) : null;
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
    <div className={`mr${running ? " live" : ""}`} data-testid="mini-run">
      <RunScene order={order} cast={cast} side={side} sideLabel={info.side} t={post === null ? t0 : -1} />
      <div className="mr-dark" aria-hidden />
      <div className={`mr-cap${body.length > 60 ? " l" : ""}`} data-testid="mini-head">
        <small>{mini.kind === "accusa" ? t("mg.accusatore") : info.tag}</small><b>{body || info.tag}</b>
      </div>
      {showCycles && (
        <div className={`mr-giri${left === 0 ? " last" : ""}`} data-testid="mr-giri" key={`g${cyc}`}>
          <b>{ts("mr.giro", { n: cyc + 1, tot: MINI_CYCLES })}</b>
          <small>{left === 0 ? t("mr.manca.0") : left === 1 ? t("mr.manca.1") : ts("mr.manca.n", { n: left })}</small>
          <span className="pips">{Array.from({ length: MINI_CYCLES }, (_, i) => <i key={i} className={i < cyc ? "done" : i === cyc ? "cur" : ""} />)}</span>
        </div>
      )}
      {banner && <div key={`bn${cyc}`} className={`mr-banner${left === 0 ? " last" : ""}`} data-testid="mr-banner">{banner}</div>}
      {intro && (
        <div className="mr-intro" data-testid="mini-intro" role="dialog" aria-label={ts("mg.interv.aria")}>
          <div className="strip">{t("mg.strip")}</div>
          <div className="mr-it">{info.icon} {info.title}</div>
          <p>{info.rule}</p>
        </div>
      )}
      {count !== null && <div key={count} className="mr-count" data-testid="mr-count">{count}</div>}
      {via && <div className="mr-count via" data-testid="mr-via">{t("mr.via")}</div>}
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

/** La scenetta finale: bande da cinema, sottotitolo, macchina da presa. */
function Finale({ res, view, readOnly, sound, onDone, done }: { res: MiniResult; view: GameProps["view"]; readOnly: boolean; sound: boolean; onDone: () => void; done: boolean }) {
  const kind = res.kind, ids = useMemo(() => view.tower.slice().sort((a, b) => a.position - b.position).map((x) => x.cardId), [view.tower]);
  const cast = useCast(ids), side = useCast([res.cardId])[0] ?? null;
  const finale = useMemo(() => buildFinale(kind, res.leaders, res.fallenPositions), [kind, res.leaders.join(","), res.fallenPositions.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const headline = res.leaders.length === 0 ? t("mr.fin.nessuno") : kind === "accusa" ? t("mr.fin.accusa") : kind === "amore" ? t("mr.fin.amore") : t("mr.fin.peggiore");
  return (
    <div className="mr" data-testid="mini-finale">
      <FinaleScene finale={finale} cast={cast} side={side} onDone={onDone} sound={sound} />
      <div className="mr-dark" aria-hidden />
      <Letterbox on text={headline} />
      {!readOnly && !done && <button className="skip" onClick={onDone} data-testid="skip">{t("mg.salta")}</button>}
    </div>
  );
}

/** Dopo il sipario di chiusura: chi prende punti, poi la classifica. */
function End({ room, view, send, readOnly, sound, ui, people, res, isHost, step, onStep }: Pick<GameProps, "room" | "view" | "send" | "readOnly" | "sound" | "ui"> & { people: People; res: MiniResult; isHost: boolean; step: Post; onStep: (p: Post) => void }) {
  const kind = res.kind, info = miniInfo(kind);
  const ids = useMemo(() => view.tower.slice().sort((a, b) => a.position - b.position).map((x) => x.cardId), [view.tower]);
  useEffect(() => { sfx.tada(sound); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const act = () => send({ t: "act", action: { type: "advance" } });
  const toks: VoteTok[] = useMemo(() => Object.entries(res.votes).map(([id, p]) => ({ p, c: people.get(id).color, mega: false })), [res, people]);
  const blocks = blocksOf(res, (id) => ({ name: people.get(id).name, color: people.get(id).color }));
  const rows = view.players.map((p) => ({ id: p.id, name: people.get(p.id).name, color: people.get(p.id).color, score: p.score }));
  const uiv = readOnly ? null : ui ?? null, tray = uiv ? <LuiTray view={view} ui={uiv} /> : null, counts = res.counts;
  void room;
  return (
    <>
      {step === "points" && <Terrace cardIds={ids} votes={toks} />}
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
            {readOnly ? <span className="pb-wait">{t("mg.finisce")}</span> : <Row>{tray}<button type="button" className="bt mus" onClick={() => onStep("board")} data-testid="points-continue">{t("mg.continua")}</button></Row>}
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
