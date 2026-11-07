import { useEffect, useMemo, useState } from "react";
import type { MiniKind, MiniResult, PlayerView } from "@gdt/game-engine";
import { Chips, Countdown, Disc, FAST, useStage } from "../ui.tsx";
import { cardFull } from "../lib/cards.ts";
import { sfx } from "../lib/sfx.ts";
import SceneHost from "./SceneHost.tsx";
import Standings from "./Standings.tsx";
import Zoom from "./Zoom.tsx";
import { Terrace } from "./Terrace.tsx";
import type { VoteTok } from "./Terrace.tsx";
import { HandPicker, Tip, Waiting, usePeople } from "../screens/Game.tsx";
import type { GameProps } from "../screens/Game.tsx";

interface KindInfo { title: string; icon: string; tag: string; what: string[]; headCard: string | null; play: string; vote: string }
export const MINI: Record<MiniKind, KindInfo> = {
  accusa: {
    title: "L'Accusa!", icon: "🕵️", tag: "Un personaggio accusa qualcuno…", headCard: "L'accusatore",
    what: ["Un personaggio accusa uno di voi di aver fatto una marachella.", "Giocate la carta del colpevole, poi votate (anche la vostra!).", "Le carte più votate restano e fanno punti. Le altre cadono dalla torre!"],
    play: "Scegli il personaggio che secondo te ha fatto questa cosa. Resta segreta!", vote: "Chi è il colpevole? Puoi votare anche la tua carta. Le carte più votate restano e fanno punti, le altre cadono!",
  },
  amore: {
    title: "La storia d'amore", icon: "💘", tag: "È nata una nuova storia d'amore!", headCard: "Il protagonista",
    what: ["Durante la partita è nata una storia d'amore!", "Giocate la carta che secondo voi è il partner del personaggio pescato.", "Le carte più votate restano e fanno punti. Le altre cadono dalla torre!"],
    play: "Scegli il personaggio che sarebbe il partner perfetto. Resta segreta!", vote: "Chi è il partner perfetto? Puoi votare anche la tua carta. Le carte più votate restano e fanno punti, le altre cadono!",
  },
  raccomandato: {
    title: "Il raccomandato", icon: "🎩", tag: "Chi buttereste giù oggi?", headCard: null,
    what: ["Nessuna frase, nessuna accusa: solo la torre.", "Giocate una carta e poi votate chi buttereste giù.", "Cadono le carte più votate: chi le ha giocate perde punti!"],
    play: "Gioca una carta qualsiasi: finirà sulla torre. Occhio a chi la voterà!", vote: "Chi buttereste giù dalla torre? Cadono le carte più votate, e chi le ha giocate perde punti.",
  },
};

/** Intervallo: schermata speciale che annuncia il mini-gioco. Si chiude con un pulsante. */
function MiniIntro({ kind, sound, onGo }: { kind: MiniKind; sound: boolean; onGo: () => void }) {
  const k = MINI[kind];
  useEffect(() => { sfx.fanfare(sound); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const floaters = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ l: 4 + ((i * 53) % 92), d: (i * 0.37) % 2.4, s: 20 + ((i * 7) % 18), e: ["⭐", k.icon, "✨", "🎉"][i % 4]! })), [k.icon]);
  return (
    <div className="mi" role="dialog" aria-label="Intervallo" data-testid="mini-intro">
      <div className="mi-rays" />
      <div className="mi-curtain l" /><div className="mi-curtain r" />
      {floaters.map((f, i) => <span key={i} className="mi-fl" style={{ left: `${f.l}%`, animationDelay: `${f.d}s`, fontSize: f.s }}>{f.e}</span>)}
      <div className="mi-body">
        <div className="mi-badge">⭐ INTERVALLO ⭐</div>
        <div className="mi-ic">{k.icon}</div>
        <h2 data-testid="mini-title">{k.title}</h2>
        <p className="mi-tag">{k.tag}</p>
        <ul>{k.what.map((t) => <li key={t}>{t}</li>)}</ul>
        <button className="mi-go" onClick={onGo} data-testid="mini-go">Si parte!</button>
      </div>
    </div>
  );
}

/** Carta pescata del mini-gioco (accusatore / protagonista) con il suo fumetto, separata dalla torre. */
function MiniHead({ view }: { view: PlayerView }) {
  const mini = view.mini; if (!mini) return null;
  const k = MINI[mini.kind];
  if (!mini.cardId) return <div className="mhead nocard" data-testid="mini-head"><b>{k.icon} {k.tag}</b><small>Nessuna frase, nessuna accusa: si vota e basta.</small></div>;
  return (
    <div className="mhead" data-testid="mini-head">
      <div className="mh-card" style={{ backgroundImage: `url(${cardFull(mini.cardId)})` }}><em>{k.headCard}</em></div>
      <div className="mh-bubble">
        <small>{mini.kind === "accusa" ? "Accusa:" : k.tag}</small>
        {mini.kind === "accusa" ? <b>«{mini.text}»</b> : <b>Chi sarà il suo partner perfetto?</b>}
      </div>
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
  if (res.kind === "raccomandato") push("mini-perdita", "Giù dalla torre!", "Chi aveva giocato una carta caduta perde tanti punti quanti sono i suoi voti (mai sotto zero).", res.fallenPositions, true);
  else {
    push("mini-voto", "Voto in testa", `Hanno votato ${res.leaders.length > 1 ? "una carta in testa" : "la carta in testa"} (${lead}): tanti punti quanti sono i voti su quella carta, compreso il proprio.`, res.leaders);
    push("mini-carta", "Carta in testa ×2", "Chi aveva giocato una carta in testa prende il doppio dei voti ricevuti.", res.leaders);
    push("mini-tetto", "Tetto ai punti", `Nessuno guadagna più di ${res.cap} punti in un mini-gioco: la partita resta aperta.`, [], true);
  }
  return b;
}

export default function MiniGame({ room, view, deadline, send, readOnly, sound }: GameProps) {
  const { H } = useStage(), people = usePeople(room), me = view.viewerId, phase = view.phase, mini = view.mini, res = view.miniResult;
  const [seen, setSeen] = useState(false), [zoomPos, setZoomPos] = useState<number | null>(null), [board, setBoard] = useState(false);
  const [step, setStep] = useState<"tokens" | "fall" | "points" | "board">(FAST ? "points" : "tokens");
  const ids = useMemo(() => [...view.tower].sort((a, b) => a.position - b.position).map((t) => t.cardId), [view.tower]);
  const kind = mini?.kind ?? res?.kind ?? "amore", info = MINI[kind];
  const isHost = room.hostId === me;
  const act = (a: { type: "vote"; position: number } | { type: "advance" }) => send({ t: "act", action: a });
  const seed = useMemo(() => { let h = 11; for (const c of room.code) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) + view.turn; }, [room.code, view.turn]);

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
  const stripText = phase === "MINI_RESULTS" ? (step === "fall" ? "GIÙ DALLA TORRE!" : "ECCO I VOTI") : info.title.toUpperCase();
  const rows = view.players.map((p) => ({ id: p.id, name: people.get(p.id).name, color: people.get(p.id).color, score: p.score }));
  const blocks = res ? blocksOf(res, (id) => ({ name: people.get(id).name, color: people.get(id).color })) : [];

  if (phase === "MINI_PLAY" && !seen && !readOnly) return <MiniIntro kind={kind} sound={sound} onGo={() => setSeen(true)} />;

  return (
    <>
      <Chips left={<><Disc color={people.get(me).color} />{readOnly ? "Schermo condiviso" : people.get(me).name}</>} mid={<>🎭 Intervallo</>} right={`Turno ${view.turn}/${view.totalTurns}`} />
      <div className="strip" data-testid="strip">★ {stripText} ★</div>
      {deadline && phase !== "MINI_RESULTS" && <div className="cd"><Countdown deadline={deadline} /></div>}
      <button className="trophybtn" onClick={() => setBoard(true)} aria-label="Classifica attuale" data-testid="standings-btn">🏆</button>

      {phase !== "MINI_RESULTS" && <MiniHead view={view} />}

      {phase === "MINI_PLAY" && !readOnly && !view.players.find((p) => p.id === me)?.hasPlayed && <HandPicker view={view} send={send} top={mini?.cardId ? 252 : 206} tip={info.play} />}
      {phase === "MINI_PLAY" && (readOnly || view.players.find((p) => p.id === me)?.hasPlayed) && <Waiting text="Carta giocata! Aspettiamo gli altri…" sub="Tra poco le carte salgono sulla torre." flags={flagsPlay} people={people} />}

      {phase === "MINI_VOTE" && <Terrace cardIds={ids} votes={toks} onPick={canVote ? (n) => setZoomPos(n) : undefined} selected={null} />}
      {phase === "MINI_VOTE" && !readOnly && (canVote
        ? <div className="bottom" data-testid="mini-vote"><Tip>{info.vote}</Tip></div>
        : <Waiting bottom sub="Il tuo gettone è sulla carta scelta. Il risultato arriva quando hanno votato tutti." text="Voto inviato 🔒 Aspettiamo gli altri…" flags={flagsVote} people={people} />)}
      {phase === "MINI_VOTE" && readOnly && <div className="bottom"><div className="pp mini">{view.players.filter((p) => p.hasVoted).length} su {view.players.length} hanno votato</div></div>}

      {phase === "MINI_RESULTS" && res && step !== "fall" && step !== "board" && <>
        <Terrace cardIds={ids} votes={toks} />
        {step === "tokens" && <>
          <div className="darkv" />
          <div className="rv" data-testid="mini-tokens"><b className="rv-t">Ecco i voti!</b><span>{res.kind === "raccomandato" ? `Cadono le carte più votate (n. ${res.leaders.join(", ")}).` : res.fallenPositions.length ? `Restano le carte in testa (n. ${res.leaders.join(", ")}): le altre cadono!` : "Tutte le carte hanno gli stessi voti: non cade nessuna!"}</span></div>
          {!readOnly && <button className="skip" onClick={() => setStep(res.fallenPositions.length ? "fall" : "points")} data-testid="skip">Salta ›</button>}
        </>}
      </>}
      {phase === "MINI_RESULTS" && res && step === "fall" && <>
        <SceneHost cardIds={ids} cue={{ fallPositions: res.fallenPositions, seed }} sound={sound} onDone={() => setStep("points")} />
        {!readOnly && <button className="skip" onClick={() => setStep("points")} data-testid="skip">Salta ›</button>}
      </>}
      {phase === "MINI_RESULTS" && res && step === "points" && (
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
          {readOnly ? <span className="pb-wait">Il mini-gioco finisce a breve…</span> : <button className="pb-go" onClick={() => setStep("board")} data-testid="points-continue">Continua ›</button>}
        </div>
      )}
      {phase === "MINI_RESULTS" && step === "board" && (
        <Standings rows={rows} turn={view.turn} total={view.totalTurns} title="Dopo il mini-gioco" onClose={() => undefined}
          action={readOnly ? { wait: "Prosegue l'host…" } : isHost ? { label: "Riprendiamo la partita!", onClick: () => act({ type: "advance" }) } : { wait: "Aspettiamo che l'host riprenda la partita…" }} />
      )}

      {zoomPos !== null && ids[zoomPos - 1] && (
        <Zoom cardId={ids[zoomPos - 1]!} pos={zoomPos} total={ids.length} onClose={() => setZoomPos(null)} onNav={setZoomPos}
          actionLabel={`Voto il n. ${zoomPos}`} onAction={() => { act({ type: "vote", position: zoomPos }); setZoomPos(null); }} />
      )}
      {board && phase !== "MINI_RESULTS" && <Standings rows={rows} turn={view.turn} total={view.totalTurns} onClose={() => setBoard(false)} />}
    </>
  );
}
