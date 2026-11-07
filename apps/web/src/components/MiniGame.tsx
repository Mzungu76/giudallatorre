import { useEffect, useMemo, useState } from "react";
import type { MiniKind, MiniResult, PlayerView } from "@gdt/game-engine";
import { Btn, Disc, FAST, useStage } from "../ui.tsx";
import { cardFull } from "../lib/cards.ts";
import { sfx } from "../lib/sfx.ts";
import SceneHost from "./SceneHost.tsx";
import Standings from "./Standings.tsx";
import Zoom from "./Zoom.tsx";
import { Terrace } from "./Terrace.tsx";
import type { VoteTok } from "./Terrace.tsx";
import { BMeta, BSheet, LuiTray, Row, WaitCard, useTimedOpen } from "./BUi.tsx";
import { HandPicker, usePeople } from "../screens/Game.tsx";
import type { GameProps } from "../screens/Game.tsx";

interface KindInfo { title: string; icon: string; tag: string; steps: [string, string][]; headCard: string | null; play: string; vote: string }
export const MINI: Record<MiniKind, KindInfo> = {
  accusa: {
    title: "L'Accusa", icon: "🔍", tag: "Qualcuno ha fatto una marachella", headCard: "L'accusatore",
    steps: [["Un personaggio accusa", "Una carta accusa uno di voi di una marachella."], ["Giocate il colpevole", "Ognuno gioca in segreto la carta che l'avrebbe fatta."], ["Si vota", "Le carte più votate restano e fanno punti. Le altre cadono dalla torre."]],
    play: "Chi ha fatto questa cosa? La scelta è segreta.", vote: "Puoi votare anche la tua. Le più votate restano, le altre cadono.",
  },
  amore: {
    title: "La storia d'amore", icon: "💘", tag: "È nata una nuova coppia", headCard: "Il protagonista",
    steps: [["Un personaggio si innamora", "Una carta ha una nuova storia d'amore."], ["Giocate il partner", "Ognuno gioca in segreto la carta che gli starebbe meglio accanto."], ["Si vota", "Le carte più votate restano e fanno punti. Le altre cadono dalla torre."]],
    play: "Chi è il partner perfetto? La scelta è segreta.", vote: "Puoi votare anche la tua. Le più votate restano, le altre cadono.",
  },
  raccomandato: {
    title: "Il raccomandato", icon: "🎩", tag: "Chi butteresti giù oggi?", headCard: null,
    steps: [["Niente frase", "Questa volta nessuno accusa nessuno."], ["Giocate una carta", "Una qualsiasi: finirà sulla torre."], ["Si vota", "Cadono le carte più votate. Chi le ha giocate perde punti."]],
    play: "Gioca una carta qualsiasi: finirà sulla torre.", vote: "Chi butteresti giù? Chi ha giocato le carte cadute perde punti.",
  },
};

/** Annuncio dell'intervallo: nastro, titolo, carta del personaggio e i tre passi. Si chiude con «Si parte». */
function MiniIntro({ kind, view, sound, ui, onGo }: { kind: MiniKind; view: PlayerView; sound: boolean; ui?: GameProps["ui"] | null; onGo: () => void }) {
  const k = MINI[kind], { H } = useStage(), short = H < 700, hh = short ? 100 : 170, mini = view.mini;
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
            : <div className="ivl-fan">{hand.map((c, i) => <div key={c} className="ivl-card" style={{ backgroundImage: `url(${cardFull(c)})`, transform: i === 1 ? undefined : `translateX(${i === 0 ? -62 : 62}%) rotate(${i === 0 ? -10 : 10}deg)`, zIndex: i === 1 ? 2 : 1 }}>{i === 1 && <span className="ivl-badge">{k.icon}</span>}</div>)}</div>}
        </div>
      )}
      <div className="pp ivl-steps">{k.steps.map(([t, x], i) => <div className="brg-step" key={t}><span className="how-ic">{i + 1}</span><div><b>{t}</b><p>{x}</p></div></div>)}</div>
      <div className="bsp" />
      <BSheet title="SI GIOCA UN MINI-GIOCO" sub="A metà partita, senza Megafono" ui={ui}><Row><Btn onClick={onGo} testId="mini-go">Si parte</Btn></Row></BSheet>
    </div>
  );
}

/** La carta pescata dell'intervallo con la sua accusa: stessa striscia della frase, si apre con un tocco e si chiude da sola. */
function MiniPill({ view }: { view: PlayerView }) {
  const mini = view.mini, [open, setOpen] = useTimedOpen();
  if (!mini) return null;
  const k = MINI[mini.kind];
  const body = mini.kind === "accusa" ? `«${mini.text}»` : mini.kind === "amore" ? "Chi sarà il suo partner perfetto?" : "Chi butteresti giù oggi?";
  const label = mini.kind === "accusa" ? "L'accusatore dice:" : k.tag;
  return (
    <div className={`phrase-card pk${open ? " open" : ""}`} role="button" tabIndex={0} aria-expanded={open} data-testid="mini-head" onClick={() => setOpen(!open)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(!open); } }}>
      {mini.cardId ? <span className="ivl-thumb" style={{ backgroundImage: `url(${cardFull(mini.cardId)})` }} /> : <span className="mega-ic" aria-hidden>{k.icon}</span>}
      <span className="ctx ac">{mini.kind === "accusa" ? "Accusa" : k.title}</span><small>{label}</small><b>{body}</b><em className="chev" aria-hidden>▾</em>{open && <i className="tbar" />}
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
  if (res.kind === "raccomandato") push("mini-perdita", "Giù dalla torre", "Chi aveva giocato una carta caduta perde tanti punti quanti sono i suoi voti (mai sotto zero).", res.fallenPositions, true);
  else {
    push("mini-voto", "Voto in testa", `Hanno votato ${res.leaders.length > 1 ? "una carta in testa" : "la carta in testa"} (${lead}): tanti punti quanti sono i voti su quella carta, compreso il proprio.`, res.leaders);
    push("mini-carta", "Carta in testa ×2", "Chi aveva giocato una carta in testa prende il doppio dei voti ricevuti.", res.leaders);
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
  const [step, setStep] = useState<"tokens" | "fall" | "points" | "board">(FAST ? "points" : "tokens");
  const ids = useMemo(() => [...view.tower].sort((a, b) => a.position - b.position).map((t) => t.cardId), [view.tower]);
  const kind = mini?.kind ?? res?.kind ?? "amore", info = MINI[kind];
  const isHost = room.hostId === me;
  const act = (a: { type: "vote"; position: number } | { type: "advance" }) => send({ t: "act", action: a });
  const seed = useMemo(() => { let h = 11; for (const c of room.code) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) + view.turn; }, [room.code, view.turn]);
  const uiv = readOnly ? null : ui ?? null;
  const tray = uiv ? <LuiTray view={view} ui={uiv} /> : null;

  // risultati: gettoni → caduta → punti → classifica
  useEffect(() => {
    if (phase !== "MINI_RESULTS" || FAST) return;
    if (step === "tokens") { const t = setTimeout(() => setStep(res && res.fallenPositions.length ? "fall" : "points"), 3600); return () => clearTimeout(t); }
    return undefined;
  }, [phase, step, res]);
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
  const rows = view.players.map((p) => ({ id: p.id, name: people.get(p.id).name, color: people.get(p.id).color, score: p.score }));
  const blocks = res ? blocksOf(res, (id) => ({ name: people.get(id).name, color: people.get(id).color })) : [];
  const meta = <BMeta turn={`Turno ${view.turn}/${view.totalTurns}`} right={`🎭 ${info.title}`} deadline={phase !== "MINI_RESULTS" ? deadline : null} />;
  const counts = useMemo(() => { const c: Record<number, number> = {}; if (res) Object.values(res.votes).forEach((p) => { c[p] = (c[p] ?? 0) + 1; }); return c; }, [res]);

  if (phase === "MINI_PLAY" && !seen && !readOnly) return <MiniIntro kind={kind} view={view} sound={sound} ui={uiv} onGo={() => setSeen(true)} />;

  return (
    <>
      {phase === "MINI_VOTE" && <Terrace cardIds={ids} votes={toks} onPick={canVote ? (n) => setZoomPos(n) : undefined} selected={vpick} />}
      {phase === "MINI_RESULTS" && res && step !== "fall" && step !== "board" && <Terrace cardIds={ids} votes={toks} />}
      {phase === "MINI_RESULTS" && res && step === "tokens" && <>
        <div className="darkv" />
        <div className="rv" data-testid="mini-tokens"><b className="rv-t">Ecco i voti</b><span>{res.kind === "raccomandato" ? `Cadono le carte più votate (n. ${res.leaders.join(", ")}).` : res.fallenPositions.length ? `Restano le carte in testa (n. ${res.leaders.join(", ")}): le altre cadono.` : "Tutte le carte hanno gli stessi voti: non cade nessuna."}</span></div>
        {!readOnly && <button className="skip" onClick={() => setStep(res.fallenPositions.length ? "fall" : "points")} data-testid="skip">Salta ›</button>}
      </>}
      {phase === "MINI_RESULTS" && res && step === "fall" && <>
        <SceneHost cardIds={ids} cue={{ fallPositions: res.fallenPositions, seed }} sound={sound} onDone={() => setStep("points")} />
        {!readOnly && <button className="skip" onClick={() => setStep("points")} data-testid="skip">Salta ›</button>}
      </>}

      <div className="bl">
        {meta}
        {phase === "MINI_PLAY" && <>
          <MiniPill view={view} />
          {!readOnly && !view.players.find((p) => p.id === me)?.hasPlayed
            ? <HandPicker view={view} send={send} ui={uiv} title="SCEGLI LA CARTA" sub={info.play} />
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
              ? <BSheet title={mini?.kind === "accusa" ? "CHI È IL COLPEVOLE?" : mini?.kind === "amore" ? "CHI È IL PARTNER?" : "CHI BUTTI GIÙ?"} sub={info.vote} ui={uiv}>
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
            <b className="rv-t" data-testid="points-title">{res.kind === "raccomandato" ? "Chi perde punti" : "Chi prende punti"}</b>
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
          actionLabel={`Vota il n. ${zoomPos}`} onAction={() => { setVpick(zoomPos); setZoomPos(null); }} />
      )}
    </>
  );
}
