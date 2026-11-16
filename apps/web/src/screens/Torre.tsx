import { useEffect, useMemo, useRef, useState } from "react";
import { applyAction, DEFAULT_AGE_BAND, viewFor } from "@gdt/game-engine";
import type { GameState, TurnResult } from "@gdt/game-engine";
import type { ClientMessage } from "@gdt/game-protocol";
import { Stage, Btn, navigate, useNow } from "../ui.tsx";
import { useAudio } from "../lib/audio.ts";
import { useCards } from "../lib/cards.ts";
import { PersonaProvider } from "../components/Persona.tsx";
import { sfx } from "../lib/sfx.ts";
import { t } from "../lib/testi.ts";
import { cella, dayId, loadTorre, numeroDelGiorno, playedToday, registra, saveTorre, secondiAMezzanotte, testoDaCondividere, torreIndex } from "../lib/torre.ts";
import type { TorreDb, Indice, Torre } from "../lib/torre.ts";
import type { RoomMsg } from "../hooks/useRoom.ts";
import Game from "./Game.tsx";
import { Plancia } from "./Room.tsx";

const clock = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/** «Torre del giorno»: un solo turno già pronto, con le schermate di gioco di sempre (voto, segnalino, caduta, punti); poi il riepilogo. Una stanza finta, tutta sul dispositivo. */
export default function Torre() {
  const { sound } = useAudio(), ready = useCards(), day = useMemo(() => dayId(), []), now = useNow(1000);
  const [db, setDb] = useState<TorreDb>(loadTorre), [k, setK] = useState(() => playedToday(loadTorre(), day));
  const [idx, setIdx] = useState<Indice | null>(null), [torre, setTorre] = useState<Torre | null>(null), [err, setErr] = useState(0);
  const [stato, setStato] = useState<GameState | null>(null), [fine, setFine] = useState(false), [copied, setCopied] = useState(false), done = useRef(false);
  useEffect(() => { let on = true; setIdx(null); fetch("/oggi/indice.json").then((r) => (r.ok ? r.json() : Promise.reject())).then((x: Indice) => { if (on) setIdx(x); }).catch(() => { if (on) setErr((e) => e + 1); }); return () => { on = false; }; }, [err]);
  useEffect(() => {
    if (!idx) return; let on = true; setTorre(null); setStato(null); setFine(false); setCopied(false); done.current = false;
    fetch(`/oggi/${torreIndex(idx, day, k)}.json`).then((r) => (r.ok ? r.json() : Promise.reject())).then((x: Torre) => { if (on) { setTorre(x); setStato(x.stato); } }).catch(() => { if (on) setErr((e) => e + 1); });
    return () => { on = false; };
  }, [idx, k, day]);

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
      if (next.lastResult && !done.current) { done.current = true; const nd = registra(db, day, numero, k, next.lastResult, torre.umano); setDb(nd); saveTorre(nd); }
    } else if (a.type === "advance" && stato.phase === "RESULTS") { setFine(true); if ((r?.points[torre.umano] ?? 0) > 0) sfx.fanfare(sound); }
  };
  const share = async () => {
    if (!torre || !r) return;
    const text = testoDaCondividere(numero, cella(r, torre.umano), r.points[torre.umano] ?? 0, db.serie, `${location.origin}/torre`);
    try { if (navigator.share) { await navigator.share({ text }); return; } } catch { /* annullato: si copia */ }
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { /* niente appunti */ }
  };

  if (!torre || !room || !view || !ready) return (
    <Stage bg="sky" testId="torre-wait"><div className="center-msg">{err > 0 ? <><h2>{t("torre.errore")}</h2><Btn kind="pap" onClick={() => setErr(0)}>{t("torre.riprova")}</Btn></> : <h2>{t("torre.carico")}</h2>}</div></Stage>
  );
  if (fine && r) {
    const pts = r.points[torre.umano] ?? 0;
    return (
      <Stage bg="sky" testId="torre-fine">
        <div className="fl">
          <div className="fl-top"><div className="fl-t">{k === 0 ? t("torre.oggi") : t("torre.altra")}<small>{t("torre.titolo")} n.{numero}</small></div></div>
          <div className="fl-res" data-testid="torre-risultato">
            <div className="fl-pt"><b data-testid="torre-punti">{t("torre.pt", { n: pts })}</b><span>{t("torre.punti")}</span></div>
            <div className="fl-st"><span><b>{db.totale}</b>{t("torre.totale")}</span><span><b>{db.serie}</b>{t("torre.serie")}</span></div>
            <div className="fl-next">{t("torre.prossima", { t: clock(secondiAMezzanotte(new Date(now))) })}</div>
            <div className="fl-row"><Btn onClick={share} testId="torre-condividi">{copied ? t("torre.copiato") : t("torre.condividi")}</Btn><Btn kind="pap" onClick={() => setK(k + 1)} testId="torre-ancora">{t("torre.ancora")}</Btn></div>
            <button className="fl-home" onClick={() => navigate("/")} data-testid="torre-home">{t("torre.home")}</button>
          </div>
        </div>
      </Stage>
    );
  }
  return (
    <PersonaProvider players={room.players}>
      <Plancia room={room} view={view}>
        <Stage bg="sky" testId="game"><Game room={room} view={view} deadline={null} send={send} sound={sound} /></Stage>
      </Plancia>
    </PersonaProvider>
  );
}
