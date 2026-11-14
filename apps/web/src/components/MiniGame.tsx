import { useEffect, useMemo, useRef, useState } from "react";
import type { MiniResult } from "@gdt/game-engine";
import { MINI_COUNTDOWN_MS, MINI_CYCLES, MINI_INTRO_MS, MINI_SLOT_MS } from "@gdt/game-engine";
import { Disc, FAST } from "../ui.tsx";
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
import { ResultMarks, ScoreStrip } from "./ResultsView.tsx";
import BotProfile, { profileOf } from "./BotProfile.tsx";
import type { ProfileData } from "./BotProfile.tsx";
import type { GameProps } from "../screens/Game.tsx";
import { t, ts } from "../lib/testi.ts";

/** Orologio locale a 50 ms: fa scorrere sipario, presentazione, 3-2-1 e carte. */
function useTick(ms = 50) { const [n, setN] = useState(Date.now()); useEffect(() => { const i = setInterval(() => setN(Date.now()), ms); return () => clearInterval(i); }, [ms]); return n; }

/** Il sipario resta chiuso per la scritta (poi si apre sul palco); dopo la corsa si richiude per il verdetto e dopo la scenetta per la fine. */
const CURTAIN_INTRO_MS = 1900, VERDICT_MS = 2800, CLOSING_MS = 2200, LAST_VOTE_MS = 3000;
type Post = null | "verdict" | "finale" | "points" | "board" | "closing";

export default function MiniGame({ room, view, goAt, send, readOnly, sound, ui, startAt }: GameProps & { /** Solo simulatore: apri direttamente il riepilogo dei punti. */ startAt?: "points" }) {
  const people = usePeople(room), me = view.viewerId, res = view.miniResult, mini = view.mini;
  const kind = (mini?.kind ?? res?.kind)!, info = miniInfo(kind), inRun = view.phase === "MINI_RUN", isHost = room.hostId === me;
  const now = useTick(), [prof, setProf] = useState<ProfileData | null>(null);
  const orderRef = useRef<number[]>(mini?.order ?? []); if (mini) orderRef.current = mini.order;
  const order = orderRef.current;
  const goRef = useRef<number | null>(goAt ?? null);
  const first = useRef<number | null>(null);
  if (goAt != null) goRef.current = goAt;
  const go = goRef.current ?? (first.current ??= Date.now() + MINI_INTRO_MS + MINI_COUNTDOWN_MS);
  const t0 = now - go, end = order.length * MINI_SLOT_MS, start = go - (MINI_INTRO_MS + MINI_COUNTDOWN_MS);

  // dopo la corsa: sipario (verdetto) → scenetta finale → punti → classifica → sipario di chiusura → si riprende la partita
  const [post, setPost] = useState<Post>(() => (view.phase === "MINI_RESULTS" ? (FAST || startAt === "points" ? "points" : "verdict") : null));
  const marks = useRef({ shut: Date.now(), closing: 0, res: 0 }), advanced = useRef(false);
  useEffect(() => {
    const at = Date.now();
    if (post === null) {
      // hanno votato tutti: si aspettano ancora 3 secondi (l'ultima carta resta in scena), poi il sipario; altrimenti si chiude a fine giri
      if (view.phase === "MINI_RESULTS" && !marks.current.res) marks.current.res = at;
      const allVoted = view.phase === "MINI_RESULTS" && at - marks.current.res >= (FAST ? 0 : LAST_VOTE_MS), timeUp = inRun && order.length > 0 && t0 >= end;
      if (allVoted || timeUp) { marks.current.shut = at; setPost(FAST && view.phase === "MINI_RESULTS" ? "points" : "verdict"); }
    } else if (post === "verdict" && view.phase === "MINI_RESULTS" && at - marks.current.shut >= (FAST ? 0 : VERDICT_MS)) setPost(FAST ? "points" : "finale");
    else if (post === "closing" && !advanced.current && at - marks.current.closing >= (FAST ? 0 : CLOSING_MS)) { advanced.current = true; send({ t: "act", action: { type: "advance" } }); }
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps
  const endFinale = () => setPost("points");
  /** «Riprendiamo la partita»: prima si chiude il sipario, poi si torna al gioco normale. */
  const resume = () => { marks.current.closing = Date.now(); advanced.current = false; setPost("closing"); };

  const introShut = inRun && post === null && !FAST && now < start + CURTAIN_INTRO_MS;
  const shut = introShut || post === "verdict" || post === "closing";
  const curtainText = post === "verdict" || post === "finale" ? <b>{t("mr.sip.verdetto")}</b> : post === "closing" ? <b>{t("mg.chiusura")}</b> : <><small>{t("mg.strip")}</small><b>{info.icon} {info.title}</b></>;
  const showStage = post === null || post === "verdict", showFinale = post === "finale";

  // suoni: apertura, ogni carta che esce, ultimo giro, verdetto, fine della scenetta
  const slot = Math.floor(t0 / MINI_SLOT_MS), running = inRun && post === null && t0 >= 0 && t0 < end;
  const lastSlot = useRef(-1);
  useEffect(() => { sfx.fanfare(sound); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (running && slot !== lastSlot.current) { lastSlot.current = slot; sfx.whoosh(sound); if (slot % 6 === 0 && slot > 0) sfx.drum(sound, 0.7); } }, [slot, running, sound]);
  useEffect(() => { if (post === "verdict") sfx.drum(sound, 1.4); if (post === "finale") sfx.tada(sound); if (post === "closing") sfx.drum(sound, 1.2); }, [post]); // eslint-disable-line react-hooks/exhaustive-deps
  const count = inRun && post === null && t0 < 0 && t0 >= -MINI_COUNTDOWN_MS ? Math.ceil(-t0 / 1000) : null, lastCount = useRef<number | null>(null);
  useEffect(() => { if (count !== null && count !== lastCount.current) { lastCount.current = count; sfx.tap(sound, 440 + (3 - count) * 110); } }, [count, sound]);

  return (
    <>
      {showStage && <Run {...{ view, send, readOnly, sound, people, info, t0, end, running, order, go, post, introShut, count, slot }} />}
      {showFinale && res && <Finale res={res} view={view} readOnly={!!readOnly} sound={sound} onDone={endFinale} done={false} />}
      {(post === "points" || post === "board" || post === "closing") && res && <End {...{ view, send, readOnly, sound, ui, people, res, isHost }} step={post === "closing" ? "board" : post} onStep={setPost} onResume={resume} closing={post === "closing"} onProfile={(id) => setProf(profileOf(room.players, id))} />}
      {prof && <BotProfile p={prof} onClose={() => setProf(null)} />}
      <Curtain closed={shut} valance={post === "points" || post === "board" || post === "closing" ? null : <span>{ts("mg.turno", { n: view.turn, tot: view.totalTurns })} · {info.icon} {info.title}</span>}>{curtainText}</Curtain>
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
          <p>{info.rule}</p><p className="pts">{t("mini.punti")}</p>
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

/** Dopo il sipario di chiusura: lo stesso riepilogo dei turni normali («Com'è andata» + «Punti del turno»), poi la classifica. */
function End({ view, readOnly, sound, ui, people, res, isHost, step, onStep, onResume, closing, onProfile }: Pick<GameProps, "view" | "send" | "readOnly" | "sound" | "ui"> & { onProfile: (id: string) => void; people: People; res: MiniResult; isHost: boolean; step: Post; onStep: (p: Post) => void; onResume: () => void; closing: boolean }) {
  const kind = res.kind, info = miniInfo(kind), me = view.viewerId;
  const ids = useMemo(() => view.tower.slice().sort((a, b) => a.position - b.position).map((x) => x.cardId), [view.tower]);
  const toks: VoteTok[] = useMemo(() => Object.entries(res.votes).map(([id, p]) => ({ p, c: people.get(id).color, mega: false, id })), [res, people]);
  const rows = view.players.map((p) => ({ id: p.id, name: people.get(p.id).name, color: people.get(p.id).color, score: p.score }));
  const uiv = readOnly ? null : ui ?? null, tray = uiv ? <LuiTray view={view} ui={uiv} /> : null;
  const body = kind === "accusa" ? `«${res.text}»` : info.body ?? "", size = body.length > 90 ? " xl" : body.length > 55 ? " l" : "";
  return (
    <>
      {step === "points" && <Terrace cardIds={ids} votes={toks} spread sink={res.fallenPositions} />}
      {step === "points" && <ResultMarks spread sink={res.fallenPositions} n={ids.length} fallen={res.fallenPositions} win={kind === "amore" ? res.leaders : []} />}
      {step === "points" && (
        <div className="bl">
          <BMeta turn={ts("mg.turno", { n: view.turn, tot: view.totalTurns })} right={`🎭 ${info.title}`} />
          <div className={`phrase-card pk${size}`} data-testid="mini-head">
            <span className="mega-ic" aria-hidden>{info.icon}</span><small>{kind === "accusa" ? t("mg.accusatore") : info.tag}</small><b>{body || info.tag}</b>
          </div>
          <div className="bsp" />
          <ScoreStrip ids={view.players.map((p) => p.id)} lines={res.lines} colorOf={(id) => people.get(id).color} meId={readOnly ? undefined : me} sound={sound} interactive={!readOnly} onContinue={() => onStep("board")} />
          <BSheet title={t("g.punti.t")} sub={ts("mg.mani", { n: view.turn, tot: view.totalTurns })} ui={uiv}>
            {readOnly ? <span className="pb-wait">{t("mg.finisce")}</span> : <Row>{tray}<button type="button" className="bt mus" onClick={() => onStep("board")} data-testid="points-continue">{t("g.continua")}</button></Row>}
          </BSheet>
        </div>
      )}
      {step === "board" && (
        <Standings onProfile={onProfile} rows={rows} turn={view.turn} total={view.totalTurns} title={ts("mg.dopo")} onClose={() => undefined}
          action={readOnly ? { wait: ts("mg.host.wait") } : isHost ? { label: ts("mg.riprendiamo"), onClick: closing ? () => undefined : onResume } : { wait: ts("mg.host.aspetta") }} />
      )}
    </>
  );
}
