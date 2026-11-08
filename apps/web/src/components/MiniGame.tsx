import { useEffect, useMemo, useState } from "react";
import type { MiniKind, MiniResult, PlayerView } from "@gdt/game-engine";
import { Btn, Disc, FAST, useStage } from "../ui.tsx";
import { cardFull } from "../lib/cards.ts";
import { sfx } from "../lib/sfx.ts";
import SceneHost from "./SceneHost.tsx";
import Standings from "./Standings.tsx";
import Zoom from "./Zoom.tsx";
import { Reveal, Terrace } from "./Terrace.tsx";
import type { VoteTok, Voter } from "./Terrace.tsx";
import { BMeta, BSheet, LuiTray, Row, WaitCard } from "./BUi.tsx";
import { HandPicker, usePeople } from "../screens/Game.tsx";
import { HintBubble, HintPointer, useIdleHint } from "./IdleHint.tsx";
import { miniInfo } from "../lib/minis.ts";
import { hintFor } from "../lib/hints.tsx";
import { Pt, PtIcon } from "./Pt.tsx";
import type { GameProps } from "../screens/Game.tsx";
import { t, ts } from "../lib/testi.ts";
import type { TestoKey } from "../lib/testi.ts";

/** Annuncio dell'intervallo: nastro, titolo, carta del personaggio e i tre passi. Si chiude con «Si parte». */
function MiniIntro({ kind, view, sound, ui, onGo }: { kind: MiniKind; view: PlayerView; sound: boolean; ui?: GameProps["ui"] | null; onGo: () => void }) {
  const k = miniInfo(kind), { H } = useStage(), short = H < 700, hh = short ? 100 : H < 960 ? 92 : 170, mini = view.mini;
  useEffect(() => { sfx.fanfare(sound); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const hand = view.myHand.slice(0, 3);
  return (
    <div className="bl" data-testid="mini-intro" role="dialog" aria-label={ts("mg.interv.aria")} style={{ ["--hh" as string]: `${hh}px` }}>
      <BMeta turn={ts("mg.turno", { n: view.turn, tot: view.totalTurns })} right={ts("mg.interv")} />
      <div className="strip">{t("mg.strip")}</div>
      <div className="ivl-title" data-testid="mini-title">{k.title}<small>{k.tag}</small></div>
      {!short && (
        <div className="ivl-hero">
          {mini?.cardId
            ? <div className="ivl-card" style={{ backgroundImage: `url(${cardFull(mini.cardId)})` }}><span className="ivl-badge">{k.icon}</span><em>{k.headCard}</em></div>
            : <div className="ivl-fan">{hand.map((c, i) => <div key={c} className="ivl-card" style={{ transform: i === 1 ? undefined : `translateX(${i === 0 ? -62 : 62}%) rotate(${i === 0 ? -10 : 10}deg)`, zIndex: i === 1 ? 2 : 1 }}><span className="rn-back" />{i === 1 && <span className="ivl-badge">{k.icon}</span>}</div>)}</div>}
        </div>
      )}
      <div className="pp ivl-steps">{k.steps.map(([t, x], i) => <div className="brg-step" key={t}><span className="how-ic">{i + 1}</span><div><b>{t}</b><p>{x}</p></div></div>)}</div>
      <div className="pp ivl-pts" data-testid="mini-points-info"><b>{t("mg.come")}</b>{k.pts.map(([v, x]) => <div key={v + x} className="ivl-pr"><span className="v">{/^[+−]\d+$/.test(v) ? <Pt n={Number(v.replace("−", "-"))} /> : <><PtIcon />{v}</>}</span><span>{x}</span></div>)}</div>
      <div className="bsp" />
      <BSheet title={t("mg.sheet.t")} sub={t("mg.sheet.s")} ui={ui}><Row><Btn onClick={onGo} testId="mini-go">{t("mg.parti")}</Btn></Row></BSheet>
    </div>
  );
}

/** La carta pescata dell'intervallo con la sua accusa, sempre per intero. */
function MiniPill({ view }: { view: PlayerView }) {
  const mini = view.mini;
  if (!mini) return null;
  const k = miniInfo(mini.kind);
  const body = mini.kind === "accusa" ? `«${mini.text}»` : mini.kind === "amore" ? ts("mg.body.amore") : ts("mg.body.peggiore");
  const label = mini.kind === "accusa" ? ts("mg.accusatore") : k.tag, size = body.length > 90 ? " xl" : body.length > 55 ? " l" : "";
  return (
    <div className={`phrase-card pk${size}`} data-testid="mini-head">
      {mini.cardId ? <span className="ivl-thumb" style={{ backgroundImage: `url(${cardFull(mini.cardId)})` }} /> : <span className="mega-ic" aria-hidden>{k.icon}</span>}
      <span className="ctx ac">{mini.kind === "accusa" ? t("mg.ctx.accusa") : k.title}</span><small>{label}</small><b>{body}</b>
    </div>
  );
}

type Entry = { name: string; color: string; pts: number };
interface Block { key: string; title: string; sub: string; entries: Entry[]; thumbs: number[]; neg?: boolean }
function blocksOf(res: MiniResult, name: (id: string) => { name: string; color: string }): Block[] {
  const by = (kind: string): Entry[] => Object.entries(res.lines).flatMap(([id, ls]) => ls.filter((l) => l.kind === kind).map((l) => ({ ...name(id), pts: l.pts })));
  const b: Block[] = [];
    const push = (key: string, title: string, sub: string, thumbs: number[], neg = false) => { const entries = by(key); if (entries.length) b.push({ key, title, sub, entries, thumbs, neg }); };
  if (res.kind === "peggiore") { push("mini-giusto", ts("mg.blk.giusto.t"), ts("mg.blk.giusto.x"), res.fallenPositions); push("mini-peggiore", ts("mg.blk.ricevuti.t"), ts("mg.blk.ricevuti.x"), Object.entries(res.counts).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]).map(([k]) => Number(k))); }
  else {
    const acc = res.kind === "accusa";
    push("mini-voto", acc ? ts("mg.blk.voto.t.accusa") : ts("mg.blk.voto.t.amore"), ts(`mg.blk.voto.x.${acc ? "accusa" : "amore"}${res.leaders.length > 1 ? "N" : "1"}` as TestoKey), res.leaders);
    push("mini-carta", acc ? ts("mg.blk.carta.t.accusa") : ts("mg.blk.carta.t.amore"), acc ? ts("mg.blk.carta.x.accusa") : ts("mg.blk.carta.x.amore"), res.leaders);
  }
  return b;
}

const Flags = ({ flags, people }: { flags: { id: string; done: boolean }[]; people: ReturnType<typeof usePeople> }) => (
  <div className="bflags">{flags.map((f) => <span key={f.id} className="chip">{<Disc color={people.get(f.id).color} />}{people.get(f.id).name}{f.done ? " ✓" : " …"}</span>)}</div>
);

export default function MiniGame({ room, view, deadline, send, readOnly, sound, ui }: GameProps) {
  const people = usePeople(room), me = view.viewerId, phase = view.phase, mini = view.mini, res = view.miniResult;
  const [seen, setSeen] = useState(false), [zoomPos, setZoomPos] = useState<number | null>(null);
  const [step, setStep] = useState<"reveal" | "fall" | "points" | "board">(FAST ? "points" : "reveal"), [skipN, setSkipN] = useState(0), [ownNote, setOwnNote] = useState(false);
  const ids = useMemo(() => [...view.tower].sort((a, b) => a.position - b.position).map((t) => t.cardId), [view.tower]);
  const kind = mini?.kind ?? res?.kind ?? "amore", info = miniInfo(kind);
  const isHost = room.hostId === me;
  const act = (a: { type: "vote"; position: number } | { type: "advance" }) => send({ t: "act", action: a });
  const seed = useMemo(() => { let h = 11; for (const c of room.code) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) + view.turn; }, [room.code, view.turn]);
  const uiv = readOnly ? null : ui ?? null;
  const tray = uiv ? <LuiTray view={view} ui={uiv} /> : null;

  // risultati: spoglio (un voto alla volta, come nei turni normali) → caduta → punti → classifica
  useEffect(() => { if (phase === "MINI_RESULTS" && step === "points") sfx.tada(sound); }, [phase, step]); // eslint-disable-line react-hooks/exhaustive-deps

  const toks: VoteTok[] = useMemo(() => {
    if (res) return Object.entries(res.votes).map(([id, p]) => ({ p, c: people.get(id).color, mega: false }));
    if (phase === "MINI_VOTE" && view.myVote) return [{ p: view.myVote, c: people.get(me).color }];
    return [];
  }, [res, phase, view.myVote, me, people]);
  const flagsPlay = view.players.map((p) => ({ id: p.id, done: p.hasPlayed }));
  const flagsVote = view.players.map((p) => ({ id: p.id, done: p.hasVoted }));
  const canVote = phase === "MINI_VOTE" && !readOnly && view.myVote === null;
  const [vpick, setVpick] = useState<number | null>(null);
  const isOwn = (n: number) => mini?.kind === "peggiore" && view.myPosition === n;
  const rows = view.players.map((p) => ({ id: p.id, name: people.get(p.id).name, color: people.get(p.id).color, score: p.score }));
  const blocks = res ? blocksOf(res, (id) => ({ name: people.get(id).name, color: people.get(id).color })) : [];
  const meta = <BMeta turn={ts("mg.turno", { n: view.turn, tot: view.totalTurns })} right={`🎭 ${info.title}`} deadline={phase !== "MINI_RESULTS" ? deadline : null} />;
  const counts = useMemo(() => { const c: Record<number, number> = {}; if (res) Object.values(res.votes).forEach((p) => { c[p] = (c[p] ?? 0) + 1; }); return c; }, [res]);
  // Chi vota per primo: il giocatore dopo l'ultimo Megafono, e così via a giro (l'ultimo voto è quello del Megafono uscente, come nei turni normali). Nessun Megafono in questo turno.
  const voters: Voter[] = useMemo(() => {
    const order = people.all, i0 = Math.max(0, order.findIndex((p) => p.id === view.megafonoId));
    return [...order.slice(i0 + 1), ...order.slice(0, i0), order[i0]!].filter((p) => res?.votes[p.id] !== undefined).map((p) => ({ id: p.id, name: p.nickname, color: p.color, mega: false }));
  }, [people, res, view.megafonoId]);
  const afterReveal = () => setStep(res && res.fallenPositions.length ? "fall" : "points");
  const nn = (x: number) => ts("mg.n", { n: x });
  const leadersTxt = res ? res.leaders.map(nn).join(", ") : "", leadersE = res ? res.leaders.map(nn).join(ts("mg.e")) : "", lead1 = res ? nn(res.leaders[0]!) : "";
  const vt = res ? { v: counts[res.leaders[0]!] ?? 0, tot: voters.length } : { v: 0, tot: 0 };
  const miniText = res ? (res.kind === "peggiore"
    ? { tally: [res.leaders.length > 1 ? ts("mg.pareggio") : ts("mg.pegg.piu", { c: lead1 }), res.leaders.length > 1 ? ts("mg.pegg.pari", { lista: leadersTxt }) : ts("mg.pegg.uno", vt)] as [string, string], stamp: res.leaders.length > 1 ? ts("mg.pegg.stamp.pari", { lista: leadersE }) : ts("mg.pegg.stamp.uno", { c: lead1 }), focus: res.leaders }
    : res.kind === "accusa"
    ? { tally: [res.fallenPositions.length ? (res.leaders.length > 1 ? ts("mg.pareggio.testa") : ts("mg.acc.colp", { c: lead1 })) : ts("mg.tutte"), res.fallenPositions.length ? (res.leaders.length > 1 ? ts("mg.acc.pari", { lista: leadersTxt }) : ts("mg.acc.uno", { ...vt, lista: leadersTxt })) : ts("mg.acc.nessuna")] as [string, string], stamp: res.fallenPositions.length ? (res.leaders.length > 1 ? ts("mg.pegg.stamp.pari", { lista: leadersE }) : ts("mg.pegg.stamp.uno", { c: lead1 })) : ts("mg.acc.nessuno"), focus: res.leaders }
    : { tally: [res.fallenPositions.length ? (res.leaders.length > 1 ? ts("mg.pareggio.testa") : ts("mg.am.testa", { c: lead1 })) : ts("mg.tutte"), res.fallenPositions.length ? ts("mg.am.restano", { lista: leadersTxt }) : ts("mg.am.nessuna")] as [string, string], stamp: res.fallenPositions.length ? ts("mg.am.stamp", { lista: leadersE }) : ts("mg.am.stamp.tutte"), focus: res.leaders }) : undefined;

  // suggerimento a fumetto con freccia: solo se devi agire e resti fermo a lungo
  const hint = readOnly || (phase === "MINI_PLAY" && !seen) ? null : hintFor(view);
  const [hintOn, hintClose] = useIdleHint(!!hint && zoomPos === null, `${view.turn}-${phase}`);
  if (phase === "MINI_PLAY" && !seen && !readOnly) return <MiniIntro kind={kind} view={view} sound={sound} ui={uiv} onGo={() => setSeen(true)} />;

  return (
    <>
      {phase === "MINI_VOTE" && <Terrace cardIds={ids} votes={toks} onPick={canVote ? (n) => (isOwn(n) ? setOwnNote(true) : (setOwnNote(false), setZoomPos(n))) : undefined} selected={vpick} />}
      {phase === "MINI_RESULTS" && res && step === "points" && <Terrace cardIds={ids} votes={toks} />}
      {phase === "MINI_RESULTS" && res && step === "reveal" && miniText && (
        <Reveal cardIds={ids} voters={voters} votes={res.votes} counts={counts} lui={null} tie={res.leaders.length > 1} tieBreak={false} fallPositions={res.fallenPositions} megaName="" sound={sound} skip={skipN} interactive={!readOnly} mini={miniText} onDone={afterReveal} />
      )}
      {phase === "MINI_RESULTS" && res && step === "reveal" && !readOnly && <button className="skip" onClick={() => setSkipN((n) => n + 1)} data-testid="skip">{t("mg.salta")}</button>}
      {phase === "MINI_RESULTS" && res && step === "fall" && <>
        <SceneHost cardIds={ids} cue={{ fallPositions: res.fallenPositions, seed }} sound={sound} onDone={() => setStep("points")} />
        {!readOnly && <button className="skip" onClick={() => setStep("points")} data-testid="skip">{t("mg.salta")}</button>}
      </>}

      <div className="bl">
        {meta}
        {phase === "MINI_PLAY" && <>
          <MiniPill view={view} />
          {!readOnly && !view.players.find((p) => p.id === me)?.hasPlayed
            ? <HandPicker view={view} send={send} ui={uiv} sound={sound} title={ts("mg.scegli.t")} sub={info.play} />
            : <>
              <WaitCard text={ts("mg.giocata")} sub={ts("mg.giocata.x")} />
              <BSheet title={t("mg.attendi")} sub={ts("mg.hanno.giocato", { n: flagsPlay.filter((f) => f.done).length, tot: flagsPlay.length })} ui={uiv}><Flags flags={flagsPlay} people={people} /></BSheet>
            </>}
        </>}

        {phase === "MINI_VOTE" && <>
          <MiniPill view={view} />
          <div className="bsp" />
          {readOnly
            ? <BSheet title={t("mg.vota.t")} sub={ts("mg.hanno.votato", { n: view.players.filter((p) => p.hasVoted).length, tot: view.players.length })} />
            : canVote
              ? <BSheet title={mini?.kind === "accusa" ? t("mg.chi.accusa") : mini?.kind === "amore" ? t("mg.chi.amore") : t("mg.chi.peggiore")} sub={ownNote ? ts("mg.propria") : info.vote} ui={uiv}>
                <div data-testid="mini-vote"><Row>{tray}<Btn disabled={!vpick} onClick={() => vpick && act({ type: "vote", position: vpick })} testId="confirm-vote">{!vpick ? ts("mg.scegli.carta") : ts("mg.conferma", { c: nn(vpick) })}</Btn></Row></div>
              </BSheet>
              : <BSheet title={t("mg.inviato")} sub={t("mg.aspettiamo")} ui={uiv}><Flags flags={flagsVote} people={people} /></BSheet>}
        </>}

        {phase === "MINI_RESULTS" && res && step === "points" && <>
          <div className="pp ivl-res" data-testid="mini-tally"><b>{t("mg.resta.t")}</b>
            <div className="ivl-row">{ids.map((id, i) => { const pos = i + 1, out = res.fallenPositions.includes(pos); return (
              <div key={id} className={`ivl-t ${out ? "out" : "in"}`}><span className="th" style={{ backgroundImage: `url(${cardFull(id)})` }}><i>{pos}</i></span><b>{counts[pos] ?? 0}</b><u>{out ? t("mg.cade") : t("mg.resta")}</u></div>); })}</div>
          </div>
          <div className="pb" data-testid="points-panel">
            <b className="rv-t" data-testid="points-title">{t("mg.chi.punti")}</b>
            <div className="pb-scroll">
              {blocks.length === 0 && <span className="pb-none">{t("mg.nessuno")}</span>}
              {blocks.map((b, bi) => (
                <div className={`pb-blk ${b.neg ? "neg" : ""}`} key={b.key} data-testid="points-block" style={{ animationDelay: `${0.4 + bi * 1.4}s` }}>
                  <div className="pb-h">
                    <span className="pb-th">{b.thumbs.slice(0, 3).map((p) => <span key={p} className="pb-c" style={{ backgroundImage: `url(${cardFull(ids[p - 1]!)})` }}><i>{p}</i></span>)}</span>
                    <span className="pb-tx"><b>{b.title}</b><small>{b.sub}</small></span>
                  </div>
                  <div className="pb-who">{b.entries.map((e, k) => <span className={`pb-nm ${e.pts < 0 ? "neg" : ""}`} key={k}><i className="dc" style={{ background: e.color }} />{e.name} <em><Pt n={e.pts} /></em></span>)}</div>
                </div>))}
            </div>
          </div>
          <div className="bsp" />
          <BSheet title={t("mg.fine.t")} sub={t("mg.fine.s")} ui={uiv}>
            {readOnly ? <span className="pb-wait">{t("mg.finisce")}</span> : <Row>{tray}<Btn onClick={() => setStep("board")} testId="points-continue">{t("mg.continua")}</Btn></Row>}
          </BSheet>
        </>}
      </div>

      {phase === "MINI_RESULTS" && step === "board" && (
        <Standings rows={rows} turn={view.turn} total={view.totalTurns} title={ts("mg.dopo")} onClose={() => undefined}
          action={readOnly ? { wait: ts("mg.host.wait") } : isHost ? { label: ts("mg.riprendiamo"), onClick: () => act({ type: "advance" }) } : { wait: ts("mg.host.aspetta") }} />
      )}

      {hintOn && hint && <><HintBubble onClose={hintClose} onRules={uiv?.rules}>{hint.text}</HintBubble><HintPointer targets={hint.targets} /></>}
      {zoomPos !== null && ids[zoomPos - 1] && (
        <Zoom cardId={ids[zoomPos - 1]!} pos={zoomPos} total={ids.length} onClose={() => setZoomPos(null)} onNav={setZoomPos}
          actionLabel={ts("mg.vota.il", { c: nn(zoomPos) })} onAction={() => { if (isOwn(zoomPos)) setOwnNote(true); else setVpick(zoomPos); setZoomPos(null); }} />
      )}
    </>
  );
}
