import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { MINI_CYCLES, MINI_SLOT_MS, viewFor } from "@gdt/game-engine";
import type { BotLevel, MiniKind } from "@gdt/game-engine";
import type { ClientMessage } from "@gdt/game-protocol";
import MiniGame from "../components/MiniGame.tsx";
import { Stage, stageDims } from "../ui.tsx";
import { SIM_ME, SIM_NAMES, humanVote, newSim, optsFromQuery, optsToQuery, stepSim } from "../lib/miniSim.ts";
import type { SimOpts, SimRun, SimStart, SimVotes } from "../lib/miniSim.ts";

/**
 * Simulatore degli intervalli: /intervalli. Il motore vero, senza stanza né giocatori: si sceglie modalità, esito e punto di partenza
 * e si guarda (o si gioca) l'intervallo, senza aspettare che capiti in una partita. Il collegamento riproduce lo scenario scelto.
 * (Strumento per chi sviluppa: i testi dei controlli stanno qui e non in public/testi.json.)
 */
const KINDS: [MiniKind, string][] = [["accusa", "🔍 L'Accusa"], ["amore", "💘 Storia d'amore"], ["peggiore", "👎 Il peggiore"]];
const STARTS: [SimStart, string][] = [["inizio", "Dall'inizio (sipario)"], ["conto", "Dal 3-2-1"], ["corsa", "Dalla corsa"], ["verdetto", "Dal verdetto e scenetta"], ["punti", "Dai punti"]];
const VOTES: [SimVotes, string][] = [["caso", "Casuali"], ["presto", "Tutti subito"], ["forzato", "Forzati"], ["nessuno", "Nessuno"]];

function useWindow() { const [s, setS] = useState({ w: window.innerWidth, h: window.innerHeight }); useEffect(() => { const f = () => setS({ w: window.innerWidth, h: window.innerHeight }); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []); return s; }
function Seg<T extends string | number>({ value, items, onChange }: { value: T; items: [T, string][]; onChange: (v: T) => void }) {
  return <div className="sim-seg">{items.map(([v, l]) => <button key={String(v)} type="button" className={v === value ? "on" : ""} onClick={() => onChange(v)}>{l}</button>)}</div>;
}
const Field = ({ label, children }: { label: string; children: ReactNode }) => <div className="sim-f"><span>{label}</span>{children}</div>;
const nm = (id: string) => SIM_NAMES[Number(id.slice(1)) - 1] ?? id;

export default function Simulator() {
  const [opts, setOpts] = useState<SimOpts>(() => optsFromQuery(new URLSearchParams(location.search)));
  const [H, setH] = useState(() => Number(new URLSearchParams(location.search).get("h")) || 826), [sound, setSound] = useState(false);
  const [ids, setIds] = useState<string[] | null>(null), [run, setRun] = useState<SimRun | null>(null), [runId, setRunId] = useState(0), [err, setErr] = useState(""), [toast, setToast] = useState("");
  const runRef = useRef<SimRun | null>(null); runRef.current = run;
  const { w, h } = useWindow(), wide = w >= 860;
  useEffect(() => { fetch("/cards/manifest.json").then((r) => r.json() as Promise<{ id: string; duplicate_of?: string }[]>).then((m) => setIds(m.filter((c) => !c.duplicate_of).map((c) => c.id))).catch(() => setErr("Non riesco a leggere l'elenco delle carte.")); }, []);

  const start = useCallback((o: SimOpts = opts) => {
    if (!ids) return;
    try { setErr(""); setToast(""); const r = newSim({ ...o, seed: o.seed || Math.floor(Math.random() * 1e9) + 1 }, ids, Date.now()); setRun(r); setRunId((n) => n + 1); }
    catch (e) { setErr(String(e)); }
  }, [ids, opts]);
  const set = (p: Partial<SimOpts>, restart = false) => { const o = { ...opts, ...p }; setOpts(o); if (restart) start(o); };
  useEffect(() => { try { history.replaceState(null, "", `/intervalli?${optsToQuery(opts, { h: String(H) })}`); } catch { /* */ } }, [opts, H]);
  const wantGo = useRef(new URLSearchParams(location.search).get("go") === "1");   // letto subito: l'indirizzo viene riscritto senza «go»
  useEffect(() => { if (ids && wantGo.current) { wantGo.current = false; start(); } }, [ids, start]);

  // il tempo scorre: i bot votano, a fine corsa si contano i voti
  useEffect(() => { const i = setInterval(() => setRun((r) => (r ? stepSim(r, Date.now()) : r)), 100); return () => clearInterval(i); }, []);
  const [now, setNow] = useState(Date.now()); useEffect(() => { const i = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(i); }, []);
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(""), 2200); return () => clearTimeout(t); }, [toast]);

  const send = useCallback((m: ClientMessage) => {
    if (m.t !== "act") return;
    const a = m.action;
    if (a.type === "vote") { const nx = runRef.current ? humanVote(runRef.current, a.position, Date.now()) : null; if (nx) setRun(nx); else setToast("Troppo tardi: quella carta non è più in scena"); }
    else if (a.type === "advance") start();   // «Riprendiamo la partita»: nel simulatore si ricomincia
  }, [start]);

  const n = opts.players, room = useMemo(() => ({ t: "room", seq: 0, code: "SIMUL", stage: "PLAYING", you: SIM_ME, hostId: SIM_ME, options: {}, players: SIM_NAMES.slice(0, n).map((nickname, i) => ({ id: `p${i + 1}`, nickname, isHost: i === 0, connected: true, char: i, ...(i ? { isBot: true, level: "medium" } : {}) })) }) as never, [n]);
  const view = useMemo(() => (run ? viewFor(run.state, SIM_ME) : null), [run?.state]); // eslint-disable-line react-hooks/exhaustive-deps
  const k = Math.max(0.4, Math.min(1.5, (h - 24) / H, wide ? (w - 400) / 372 : w / 372));
  const t0 = run ? now - run.goAt : 0, order = run?.state.mini?.order ?? [], slot = Math.floor(t0 / MINI_SLOT_MS), res = run?.state.miniResult;
  const toggleForced = (c: number) => set({ forced: opts.forced.includes(c) ? opts.forced.filter((x) => x !== c) : [...opts.forced, c].sort() });
  const link = () => `${location.origin}/intervalli?${optsToQuery(opts, { h: String(H), go: "1" })}`;

  return (
    <div className="sim" data-testid="simulatore">
      <div className="sim-phone" style={{ width: 372 * k, height: H * k }}>
        {run && view ? (
          <Stage bg="sky" dims={stageDims(k, H)}>
            <MiniGame key={runId} room={room} view={view} deadline={null} goAt={run.goAt} send={send} sound={sound} startAt={opts.start === "punti" ? "points" : undefined} />
          </Stage>
        ) : <div className="sim-start"><b>Simulatore degli intervalli</b><p>Scegli le opzioni e premi Avvia.</p><button type="button" className="sim-go" disabled={!ids} onClick={() => start()} data-testid="sim-avvia">{ids ? "▶ Avvia" : "Carico le carte…"}</button></div>}
        {toast && <div className="sim-toast">{toast}</div>}
      </div>
      <aside className="sim-ctl">
        <h1>Simulatore intervalli</h1>
        <div className="sim-row"><button type="button" className="sim-go" disabled={!ids} onClick={() => start()}>{run ? "↻ Ricomincia" : "▶ Avvia"}</button><button type="button" className="sim-btn" onClick={() => { void navigator.clipboard?.writeText(link()).then(() => setToast("Collegamento copiato")).catch(() => setToast(link())); }}>🔗 Copia il collegamento</button></div>
        <Field label="Mini-gioco"><Seg value={opts.kind} items={KINDS} onChange={(v) => set({ kind: v }, !!run)} /></Field>
        <Field label="Parti da"><Seg value={opts.start} items={STARTS} onChange={(v) => set({ start: v }, true)} /></Field>
        <Field label="Giocatori"><Seg value={opts.players} items={[3, 4, 5, 6].map((x) => [x, String(x)] as [number, string])} onChange={(v) => set({ players: v }, !!run)} /></Field>
        <Field label="Voti dei bot"><Seg value={opts.votes} items={VOTES} onChange={(v) => set({ votes: v }, !!run)} /></Field>
        {(opts.votes === "forzato" || opts.votes === "presto") && (
          <Field label="Carte che vincono / cadono (più carte = parità)"><div className="sim-seg">{[1, 2, 3, 4, 5, 6].map((c) => <button key={c} type="button" className={opts.forced.includes(c) ? "on" : ""} onClick={() => toggleForced(c)}>{c}</button>)}</div></Field>
        )}
        <Field label="Il tuo voto"><Seg value={opts.autoMe ? 1 : 0} items={[[0, "Premo io «QUESTO!»"], [1, "In automatico"]]} onChange={(v) => set({ autoMe: v === 1 }, !!run)} /></Field>
        <Field label="Bot"><Seg value={opts.level} items={[["easy", "Facili"], ["medium", "Medi"], ["hard", "Difficili"]] as [BotLevel, string][]} onChange={(v) => set({ level: v }, !!run)} /></Field>
        <Field label="Altezza del telefono"><Seg value={H} items={[[640, "Corto"], [740, "Medio"], [826, "Standard"], [940, "Lungo"]]} onChange={setH} /></Field>
        <Field label="Suoni"><Seg value={sound ? 1 : 0} items={[[0, "Spenti"], [1, "Accesi"]]} onChange={(v) => setSound(v === 1)} /></Field>
        {err && <p className="sim-err">{err}</p>}
        {run && (
          <div className="sim-live" data-testid="sim-live">
            <b>Cosa succede</b>
            <p>Fase: <u>{run.state.phase}</u>{run.state.phase === "MINI_RUN" && (t0 < 0 ? ` · via tra ${(-t0 / 1000).toFixed(1)} s` : ` · ${(t0 / 1000).toFixed(1)} s dal via · carta in scena: ${slot < order.length ? order[slot] : "—"} · giro ${Math.min(MINI_CYCLES, Math.floor(slot / 6) + 1)}/${MINI_CYCLES}`)}</p>
            <p>Ordine di uscita: {order.map((c, i) => <span key={i} className={i === slot && t0 >= 0 ? "cur" : ""}>{c}{(i + 1) % 6 ? " " : " | "}</span>)}</p>
            <p>Voti previsti dei bot: {Object.keys(run.plan).length ? Object.entries(run.plan).map(([id, v]) => `${nm(id)} → carta ${v.position} tra ${Math.max(0, (v.at - now) / 1000).toFixed(1)} s`).join(" · ") : "—"}</p>
            <p>Voti arrivati: {run.log.length ? run.log.map((l) => `${nm(l.who)} → ${l.position}`).join(" · ") : "nessuno"}</p>
            {res && <p>Esito: in testa {res.leaders.length ? res.leaders.join(", ") : "nessuna"} · {res.kind === "amore" ? "vincono" : "cadono"} {res.fallenPositions.length ? res.fallenPositions.join(", ") : res.kind === "amore" && res.leaders.length ? res.leaders.join(", ") : "nessuna"} · il più veloce: {res.fastest ? nm(res.fastest) : "—"} · punti: {Object.entries(res.points).map(([id, p]) => `${nm(id)} ${p}`).join(", ")}</p>}
          </div>
        )}
        <p className="sim-note">Un collegamento con <code>&amp;go=1</code> parte da solo. Le carte, i personaggi e i tempi sono quelli veri del gioco.</p>
      </aside>
    </div>
  );
}
