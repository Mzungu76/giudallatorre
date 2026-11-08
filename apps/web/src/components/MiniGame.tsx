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
import type { GameProps } from "../screens/Game.tsx";

interface KindInfo { title: string; icon: string; tag: string; steps: [string, string][]; /** Come si fanno punti: [valore, a chi / quando]. */ pts: [string, string][]; headCard: string | null; play: string; vote: string }
export const MINI: Record<MiniKind, KindInfo> = {
  accusa: {
    title: "L'Accusa", icon: "🔍", tag: "Qualcuno ha fatto una marachella", headCard: "L'accusatore",
    steps: [["Un personaggio accusa", "Una carta accusa uno di voi di una marachella."], ["Giocate il colpevole", "Ognuno gioca in segreto la carta che l'avrebbe fatta."], ["Si vota", "La carta più votata è il colpevole e cade dalla torre: fa punti a chi l'ha votata e a chi l'ha giocata."]],
    pts: [["voti", "Se voti il colpevole (la carta più votata, che cade): tanti punti quanti sono i suoi voti."], ["×2", "Se la carta del colpevole è la tua: il doppio dei voti che ha preso."]],
    play: "Chi ha fatto questa cosa? La scelta è segreta.", vote: "Puoi votare anche la tua. La più votata cade dalla torre.",
  },
  amore: {
    title: "La storia d'amore", icon: "💘", tag: "È nata una nuova coppia", headCard: "Il protagonista",
    steps: [["Un personaggio si innamora", "Una carta ha una nuova storia d'amore."], ["Giocate il partner", "Ognuno gioca in segreto la carta che gli starebbe meglio accanto."], ["Si vota", "Le carte più votate restano e fanno punti. Le altre cadono dalla torre."]],
    pts: [["voti", "Se voti una carta in testa (resta sulla torre): tanti punti quanti sono i suoi voti."], ["×2", "Se una carta in testa è la tua: il doppio dei voti che ha preso."]],
    play: "Chi è il partner perfetto? La scelta è segreta.", vote: "Puoi votare anche la tua. Le più votate restano, le altre cadono.",
  },
  peggiore: {
    title: "Il peggiore", icon: "👎", tag: "Chi butteresti giù oggi?", headCard: null,
    steps: [["Niente frase", "Questa volta nessuno accusa nessuno."], ["Giocate il peggiore", "Ognuno gioca in segreto il personaggio che per lui è il peggiore in assoluto."], ["Si vota chi cade", "Ognuno vota la carta da buttare giù, ma non la propria. Per ogni voto che prende la tua carta fai un punto."]],
    pts: [["+2", "Se voti una carta che cade (la più votata)."], ["+1", "Per ogni voto che prende la carta che hai giocato, cada o no."]],
    play: "Gioca il personaggio che per te è il peggiore in assoluto: più voti prende, più punti fai.", vote: "Vota la carta che butteresti giù. La tua non si può votare.",
  },
};

/** Annuncio dell'intervallo: nastro, titolo, carta del personaggio e i tre passi. Si chiude con «Si parte». */
function MiniIntro({ kind, view, sound, ui, onGo }: { kind: MiniKind; view: PlayerView; sound: boolean; ui?: GameProps["ui"] | null; onGo: () => void }) {
  const k = MINI[kind], { H } = useStage(), short = H < 700, hh = short ? 100 : H < 960 ? 92 : 170, mini = view.mini;
  useEffect(() => { sfx.fanfare(sound); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const hand = view.myHand.slice(0, 3);
  return (
    <div className="bl" data-testid="mini-intro" role="dialog" aria-label="Intervallo" style={{ ["--hh" as string]: `${hh}px` }}>
      <BMeta turn={`Turno ${view.turn}/${view.totalTurns}`} right="🎭 Intervallo" />
      <div className="strip">★ INTERVALLO ★</div>
      <div className="ivl-title" data-testid="mini-title">{k.title}<small>{k.tag}</small></div>
      {!short && (
        <div className="ivl-hero">
          {mini?.cardId
            ? <div className="ivl-card" style={{ backgroundImage: `url(${cardFull(mini.cardId)})` }}><span className="ivl-badge">{k.icon}</span><em>{k.headCard}</em></div>
            : <div className="ivl-fan">{hand.map((c, i) => <div key={c} className="ivl-card" style={{ transform: i === 1 ? undefined : `translateX(${i === 0 ? -62 : 62}%) rotate(${i === 0 ? -10 : 10}deg)`, zIndex: i === 1 ? 2 : 1 }}><span className="rn-back" />{i === 1 && <span className="ivl-badge">{k.icon}</span>}</div>)}</div>}
        </div>
      )}
      <div className="pp ivl-steps">{k.steps.map(([t, x], i) => <div className="brg-step" key={t}><span className="how-ic">{i + 1}</span><div><b>{t}</b><p>{x}</p></div></div>)}</div>
      <div className="pp ivl-pts" data-testid="mini-points-info"><b>Come si fanno punti</b>{k.pts.map(([v, x]) => <div key={v + x} className="ivl-pr"><span className="v">{v}</span><span>{x}</span></div>)}</div>
      <div className="bsp" />
      <BSheet title="SI GIOCA UN MINI-GIOCO" sub="Intervallo, senza Megafono" ui={ui}><Row><Btn onClick={onGo} testId="mini-go">Si parte</Btn></Row></BSheet>
    </div>
  );
}

/** La carta pescata dell'intervallo con la sua accusa, sempre per intero. */
function MiniPill({ view }: { view: PlayerView }) {
  const mini = view.mini;
  if (!mini) return null;
  const k = MINI[mini.kind];
  const body = mini.kind === "accusa" ? `«${mini.text}»` : mini.kind === "amore" ? "Chi sarà il suo partner perfetto?" : "Chi è il peggiore di tutti?";
  const label = mini.kind === "accusa" ? "L'accusatore dice:" : k.tag, size = body.length > 90 ? " xl" : body.length > 55 ? " l" : "";
  return (
    <div className={`phrase-card pk${size}`} data-testid="mini-head">
      {mini.cardId ? <span className="ivl-thumb" style={{ backgroundImage: `url(${cardFull(mini.cardId)})` }} /> : <span className="mega-ic" aria-hidden>{k.icon}</span>}
      <span className="ctx ac">{mini.kind === "accusa" ? "Accusa" : k.title}</span><small>{label}</small><b>{body}</b>
    </div>
  );
}

type Entry = { name: string; color: string; pts: number };
interface Block { key: string; title: string; sub: string; entries: Entry[]; thumbs: number[]; neg?: boolean }
function blocksOf(res: MiniResult, name: (id: string) => { name: string; color: string }): Block[] {
  const by = (kind: string): Entry[] => Object.entries(res.lines).flatMap(([id, ls]) => ls.filter((l) => l.kind === kind).map((l) => ({ ...name(id), pts: l.pts })));
  const b: Block[] = [];
  const lead = res.leaders.map((x) => "n. " + x).join(", ");
  const push = (key: string, title: string, sub: string, thumbs: number[], neg = false) => { const entries = by(key); if (entries.length) b.push({ key, title, sub, entries, thumbs, neg }); };
  if (res.kind === "peggiore") { push("mini-giusto", "Voto giusto", "Hanno votato una carta caduta: +2 a testa.", res.fallenPositions); push("mini-peggiore", "Voti ricevuti", "Chi ha giocato una carta prende tanti punti quanti sono i voti che la sua carta ha ricevuto, cada o no.", Object.entries(res.counts).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]).map(([k]) => Number(k))); }
  else {
    const acc = res.kind === "accusa";
    push("mini-voto", acc ? "Colpevole votato" : "Voto in testa", `Hanno votato ${acc ? (res.leaders.length > 1 ? "un colpevole" : "il colpevole") : res.leaders.length > 1 ? "una carta in testa" : "la carta in testa"} (${lead}): tanti punti quanti sono i voti su quella carta, compreso il proprio.`, res.leaders);
    push("mini-carta", acc ? "Carta del colpevole ×2" : "Carta in testa ×2", acc ? "Chi aveva giocato la carta del colpevole prende il doppio dei voti ricevuti." : "Chi aveva giocato una carta in testa prende il doppio dei voti ricevuti.", res.leaders);
    push("mini-tetto", "Tetto ai punti", `Nessuno guadagna più di ${res.cap} punti in un mini-gioco: la partita resta aperta.`, [], true);
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
  const kind = mini?.kind ?? res?.kind ?? "amore", info = MINI[kind];
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
  const meta = <BMeta turn={`Turno ${view.turn}/${view.totalTurns}`} right={`🎭 ${info.title}`} deadline={phase !== "MINI_RESULTS" ? deadline : null} />;
  const counts = useMemo(() => { const c: Record<number, number> = {}; if (res) Object.values(res.votes).forEach((p) => { c[p] = (c[p] ?? 0) + 1; }); return c; }, [res]);
  // Chi vota per primo: il giocatore dopo l'ultimo Megafono, e così via a giro (l'ultimo voto è quello del Megafono uscente, come nei turni normali). Nessun Megafono in questo turno.
  const voters: Voter[] = useMemo(() => {
    const order = people.all, i0 = Math.max(0, order.findIndex((p) => p.id === view.megafonoId));
    return [...order.slice(i0 + 1), ...order.slice(0, i0), order[i0]!].filter((p) => res?.votes[p.id] !== undefined).map((p) => ({ id: p.id, name: p.nickname, color: p.color, mega: false }));
  }, [people, res, view.megafonoId]);
  const afterReveal = () => setStep(res && res.fallenPositions.length ? "fall" : "points");
  const leadersTxt = res ? res.leaders.map((x) => "n. " + x).join(", ") : "";
  const miniText = res ? (res.kind === "peggiore"
    ? { tally: [res.leaders.length > 1 ? "Pareggio!" : `Il più votato: n. ${res.leaders[0]}`, res.leaders.length > 1 ? `Cadono insieme tutte le carte a pari merito: ${leadersTxt}.` : `${counts[res.leaders[0]!] ?? 0} voti su ${voters.length}. Cade giù dalla torre!`] as [string, string], stamp: res.leaders.length > 1 ? `Cadono insieme: ${res.leaders.map((x) => "n. " + x).join(" e ")}!` : `Cade il n. ${res.leaders[0]}!`, focus: res.leaders }
    : res.kind === "accusa"
    ? { tally: [res.fallenPositions.length ? (res.leaders.length > 1 ? "Pareggio in testa!" : `Il colpevole: n. ${res.leaders[0]}`) : "Tutte a pari merito!", res.fallenPositions.length ? `${res.leaders.length > 1 ? "Cadono insieme le carte in testa" : `${counts[res.leaders[0]!] ?? 0} voti su ${voters.length}. Il colpevole cade giù dalla torre`} (${leadersTxt}) e fa punti.` : "Nessuna carta cade: nessun colpevole."] as [string, string], stamp: res.fallenPositions.length ? (res.leaders.length > 1 ? `Cadono insieme: ${res.leaders.map((x) => "n. " + x).join(" e ")}!` : `Cade il n. ${res.leaders[0]}!`) : "Nessun colpevole!", focus: res.leaders }
    : { tally: [res.fallenPositions.length ? (res.leaders.length > 1 ? "Pareggio in testa!" : `In testa: n. ${res.leaders[0]}`) : "Tutte a pari merito!", res.fallenPositions.length ? `Restano le carte in testa (${leadersTxt}) e fanno punti. Le altre cadono.` : "Nessuna carta cade: restano tutte e fanno punti."] as [string, string], stamp: res.fallenPositions.length ? `Restano: ${res.leaders.map((x) => "n. " + x).join(" e ")}!` : "Restano tutte!", focus: res.leaders }) : undefined;

  if (phase === "MINI_PLAY" && !seen && !readOnly) return <MiniIntro kind={kind} view={view} sound={sound} ui={uiv} onGo={() => setSeen(true)} />;

  return (
    <>
      {phase === "MINI_VOTE" && <Terrace cardIds={ids} votes={toks} onPick={canVote ? (n) => (isOwn(n) ? setOwnNote(true) : (setOwnNote(false), setZoomPos(n))) : undefined} selected={vpick} />}
      {phase === "MINI_RESULTS" && res && step === "points" && <Terrace cardIds={ids} votes={toks} />}
      {phase === "MINI_RESULTS" && res && step === "reveal" && miniText && (
        <Reveal cardIds={ids} voters={voters} votes={res.votes} counts={counts} lui={null} tie={res.leaders.length > 1} tieBreak={false} fallPositions={res.fallenPositions} megaName="" sound={sound} skip={skipN} interactive={!readOnly} mini={miniText} onDone={afterReveal} />
      )}
      {phase === "MINI_RESULTS" && res && step === "reveal" && !readOnly && <button className="skip" onClick={() => setSkipN((n) => n + 1)} data-testid="skip">Salta ›</button>}
      {phase === "MINI_RESULTS" && res && step === "fall" && <>
        <SceneHost cardIds={ids} cue={{ fallPositions: res.fallenPositions, seed }} sound={sound} onDone={() => setStep("points")} />
        {!readOnly && <button className="skip" onClick={() => setStep("points")} data-testid="skip">Salta ›</button>}
      </>}

      <div className="bl">
        {meta}
        {phase === "MINI_PLAY" && <>
          <MiniPill view={view} />
          {!readOnly && !view.players.find((p) => p.id === me)?.hasPlayed
            ? <HandPicker view={view} send={send} ui={uiv} sound={sound} title="SCEGLI LA CARTA" sub={info.play} />
            : <>
              <WaitCard text="Carta giocata." sub="Aspettiamo gli altri, poi le carte salgono sulla torre." />
              <BSheet title="ATTENDI" sub={`${flagsPlay.filter((f) => f.done).length} su ${flagsPlay.length} hanno giocato`} ui={uiv}><Flags flags={flagsPlay} people={people} /></BSheet>
            </>}
        </>}

        {phase === "MINI_VOTE" && <>
          <MiniPill view={view} />
          <div className="bsp" />
          {readOnly
            ? <BSheet title="VOTA" sub={`${view.players.filter((p) => p.hasVoted).length} su ${view.players.length} hanno votato`} />
            : canVote
              ? <BSheet title={mini?.kind === "accusa" ? "CHI È IL COLPEVOLE?" : mini?.kind === "amore" ? "CHI È IL PARTNER?" : "CHI BUTTI GIÙ?"} sub={ownNote ? "La tua carta non si può votare: scegline un'altra." : info.vote} ui={uiv}>
                <div data-testid="mini-vote"><Row>{tray}<Btn disabled={!vpick} onClick={() => vpick && act({ type: "vote", position: vpick })} testId="confirm-vote">{!vpick ? "Scegli una carta" : `Conferma il n. ${vpick}`}</Btn></Row></div>
              </BSheet>
              : <BSheet title="VOTO INVIATO" sub="Aspettiamo gli altri." ui={uiv}><Flags flags={flagsVote} people={people} /></BSheet>}
        </>}

        {phase === "MINI_RESULTS" && res && step === "points" && <>
          <div className="pp ivl-res" data-testid="mini-tally"><b>Cosa resta sulla torre</b>
            <div className="ivl-row">{ids.map((id, i) => { const pos = i + 1, out = res.fallenPositions.includes(pos); return (
              <div key={id} className={`ivl-t ${out ? "out" : "in"}`}><span className="th" style={{ backgroundImage: `url(${cardFull(id)})` }}><i>{pos}</i></span><b>{counts[pos] ?? 0}</b><u>{out ? "CADE" : "RESTA"}</u></div>); })}</div>
          </div>
          <div className="pb" data-testid="points-panel">
            <b className="rv-t" data-testid="points-title">Chi prende punti</b>
            <div className="pb-scroll">
              {blocks.length === 0 && <span className="pb-none">Questa volta nessuno cambia punteggio.</span>}
              {blocks.map((b, bi) => (
                <div className={`pb-blk ${b.neg ? "neg" : ""}`} key={b.key} data-testid="points-block" style={{ animationDelay: `${0.4 + bi * 1.4}s` }}>
                  <div className="pb-h">
                    <span className="pb-th">{b.thumbs.slice(0, 3).map((p) => <span key={p} className="pb-c" style={{ backgroundImage: `url(${cardFull(ids[p - 1]!)})` }}><i>{p}</i></span>)}</span>
                    <span className="pb-tx"><b>{b.title}</b><small>{b.sub}</small></span>
                  </div>
                  <div className="pb-who">{b.entries.map((e, k) => <span className={`pb-nm ${e.pts < 0 ? "neg" : ""}`} key={k}><i className="dc" style={{ background: e.color }} />{e.name} <em>{e.pts > 0 ? "+" : "−"}{Math.abs(e.pts)}</em></span>)}</div>
                </div>))}
            </div>
          </div>
          <div className="bsp" />
          <BSheet title="FINE INTERVALLO" sub="Poi si riprende la partita" ui={uiv}>
            {readOnly ? <span className="pb-wait">Il mini-gioco finisce a breve…</span> : <Row>{tray}<Btn onClick={() => setStep("board")} testId="points-continue">Continua ›</Btn></Row>}
          </BSheet>
        </>}
      </div>

      {phase === "MINI_RESULTS" && step === "board" && (
        <Standings rows={rows} turn={view.turn} total={view.totalTurns} title="Dopo l'intervallo" onClose={() => undefined}
          action={readOnly ? { wait: "Prosegue l'host…" } : isHost ? { label: "Riprendiamo la partita", onClick: () => act({ type: "advance" }) } : { wait: "Aspettiamo che l'host riprenda la partita…" }} />
      )}

      {zoomPos !== null && ids[zoomPos - 1] && (
        <Zoom cardId={ids[zoomPos - 1]!} pos={zoomPos} total={ids.length} onClose={() => setZoomPos(null)} onNav={setZoomPos}
          actionLabel={`Vota il n. ${zoomPos}`} onAction={() => { if (isOwn(zoomPos)) setOwnNote(true); else setVpick(zoomPos); setZoomPos(null); }} />
      )}
    </>
  );
}
