import { useEffect, useMemo, useRef, useState } from "react";
import { applyAction, DEFAULT_AGE_BAND, viewFor } from "@gdt/game-engine";
import type { GameState, TurnResult } from "@gdt/game-engine";
import type { ClientMessage } from "@gdt/game-protocol";
import { Stage, Btn, navigate, useNow } from "../ui.tsx";
import { useAudio } from "../lib/audio.ts";
import { useCards } from "../lib/cards.ts";
import { PersonaProvider } from "../components/Persona.tsx";
import { sfx } from "../lib/sfx.ts";
import { t, ts } from "../lib/testi.ts";
import { cella, dayId, loadTorre, numeroDelGiorno, registra, saveTorre, secondiAllaProssima, segnaVista, testoDaCondividere, torreUrl } from "../lib/torre.ts";
import type { TorreDb, Indice, Torre } from "../lib/torre.ts";
import type { RoomMsg } from "../hooks/useRoom.ts";
import Game from "./Game.tsx";
import ModeSplash from "../components/ModeSplash.tsx";
import { music } from "../lib/music.ts";
import { condividiRotocalco, datiRotocalco } from "../lib/rotocalco.ts";
import StereoScene from "../components/StereoScene.tsx";
import TorreFinale from "../components/TorreFinale.tsx";
import { Plancia } from "./Room.tsx";

/** «Torre del giorno»: un solo turno già pronto, con le schermate di gioco di sempre (voto, segnalino, caduta, punti); poi il riepilogo. Una stanza finta, tutta sul dispositivo. */
export default function Torre() {
  const { sound } = useAudio(), ready = useCards(), day = useMemo(() => dayId(), []), now = useNow(1000);
  const [db, setDb] = useState<TorreDb>(loadTorre), [giaGiocata] = useState(() => loadTorre().giorni[day]), [splash, setSplash] = useState(() => !loadTorre().giorni[day]);   // già giocata oggi all'apertura: si vede solo il risultato
  const [idx, setIdx] = useState<Indice | null>(null), [torre, setTorre] = useState<Torre | null>(null), [err, setErr] = useState(0);
  const [stato, setStato] = useState<GameState | null>(null), [fine, setFine] = useState(false), [stats, setStats] = useState(false), [copied, setCopied] = useState(false), done = useRef(false);
  useEffect(() => { let on = true; setIdx(null); fetch("/oggi/indice.json").then((r) => (r.ok ? r.json() : Promise.reject())).then((x: Indice) => { if (on) setIdx(x); }).catch(() => { if (on) setErr((e) => e + 1); }); return () => { on = false; }; }, [err]);
  useEffect(() => {
    if (!idx || giaGiocata) return; let on = true; setTorre(null); setStato(null); setFine(false); setStats(false); setCopied(false); done.current = false;
    fetch(torreUrl(idx, day)).then((r) => (r.ok ? r.json() : Promise.reject())).then((x: Torre) => { if (on) { setTorre(x); setStato(x.stato); { const nd = segnaVista(loadTorre(), day); saveTorre(nd); setDb((o) => ({ ...o, visto: nd.visto })); } } }).catch(() => { if (on) setErr((e) => e + 1); });
    return () => { on = false; };
  }, [idx, day]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (giaGiocata) { const nd = segnaVista(loadTorre(), day); saveTorre(nd); setDb(nd); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { music.theme(fine || giaGiocata ? "musica-finale.mp3" : null); return () => music.theme(null); }, [fine, giaGiocata]);   // dalle statistiche in poi: la musica del finale
  const [cop, setCop] = useState(false);
  const numero = idx ? numeroDelGiorno(idx, day) : 1;
  const room = useMemo<RoomMsg | null>(() => torre && ({ t: "room", seq: 1, code: "FLASH", stage: "PLAYING", you: torre.umano, hostId: torre.umano, options: { ageBand: DEFAULT_AGE_BAND, turnTimerSec: 0, display: false },
    players: torre.giocatori.map((g) => ({ id: g.id, nickname: g.nickname, isHost: g.id === torre.umano, connected: true, char: g.char, ...(g.isBot ? { isBot: true, level: "hard" as const } : {}) })) }), [torre]);
  const view = useMemo(() => (torre && stato ? viewFor(stato, torre.umano) : null), [torre, stato]);
  const r: TurnResult | null = stato?.lastResult ?? null;

  const send = (m: ClientMessage) => {
    if (!torre || !stato || m.t !== "act") return;
    const a = m.action;
    if (a.type === "vote" && stato.phase === "VOTE") {
      const next = applyAction(stato, { type: "vote", playerId: torre.umano, position: a.position }).state; setStato(next);
      if (next.lastResult && !done.current) { done.current = true; const nd = registra(db, day, numero, next.lastResult, torre.umano, torre); setDb(nd); saveTorre(nd); }
    } else if (a.type === "advance" && stato.phase === "RESULTS") setFine(true);
  };
  const rec = giaGiocata ?? (fine && r && torre ? db.giorni[day] ?? { n: numero, pts: r.points[torre.umano] ?? 0, cella: cella(r, torre.umano) } : null);
  const stereo = r && torre ? torre.stereo?.[r.votes[torre.umano]!] : undefined;   // le stesse statistiche del turno di una partita normale
  const copertina = async () => { if (cop || !torre || !r) return; setCop(true); try { const dd = datiRotocalco(stereo, torre.stato.tower.find((c) => c.position === r.votes[torre.umano])?.cardId, day, location.host); if (dd) await condividiRotocalco(dd, `copertina-${day}.png`); } catch { /* niente copertina */ } setCop(false); };
  if (!giaGiocata && fine && !stats && torre && stereo) return <Stage bg="sky" testId="torre-stats"><StereoScene onShare={copertina} sharing={cop} stereo={stereo} isBot={(id) => !!torre.giocatori.find((g) => g.id === id)?.isBot} sound={sound} label={ts("torre.stats")} onDone={() => setStats(true)} /></Stage>;
  if (rec) return (
    <Stage bg="sky" testId="torre-fine"><TorreFinale day={day} rec={rec} serie={db.serie} totale={db.totale} secondi={secondiAllaProssima(now)} testo={testoDaCondividere(rec.n, rec.cella, rec.pts, db.serie, `${location.origin}/torre`, rec.frase)} sound={sound} onHome={() => navigate("/")} /></Stage>
  );
  if (splash) return <Stage bg="sky" testId="torre-splash"><ModeSplash kind="torre" sound={sound} onDone={() => setSplash(false)} /></Stage>;
  if (!torre || !room || !view || !ready) return (
    <Stage bg="sky" testId="torre-wait"><div className="center-msg">{err > 0 ? <><h2>{t("torre.errore")}</h2><Btn kind="pap" onClick={() => setErr(0)}>{t("torre.riprova")}</Btn></> : <h2>{t("torre.carico")}</h2>}</div></Stage>
  );
  return (
    <PersonaProvider players={room.players}>
      <Plancia room={room} view={view}>
        <Stage bg="sky" testId="game"><Game room={room} view={view} deadline={null} send={send} sound={sound} /></Stage>
      </Plancia>
    </PersonaProvider>
  );
}
