import { useEffect, useMemo, useState } from "react";
import Riepilogo from "../components/Riepilogo.tsx";
import ShareMenu from "../components/ShareMenu.tsx";
import type { ShareOption } from "../components/ShareMenu.tsx";
import type { PlayerView } from "@gdt/game-engine";
import { FAST, navigate } from "../ui.tsx";
import { forgetSession } from "../lib/session.ts";
import { usePeople } from "./Game.tsx";
import FinalScene from "../components/FinalScene.tsx";
import AwardScene from "../components/AwardScene.tsx";
import { music } from "../lib/music.ts";
import { ts } from "../lib/testi.ts";
import { dayId, fraseSocial } from "../lib/torre.ts";
import { condividiCartolina, condividiTesto, dataLunga } from "../lib/cartolina.ts";
import { leggiUltimo } from "../lib/ultimoTurno.ts";
import { condividiRotocalco, datiRotocalco } from "../lib/rotocalco.ts";
import { stereoGame, testoPartita } from "../lib/stereo.ts";
import type { RoomMsg } from "../hooks/useRoom.ts";
import type { UiCtl } from "../components/BUi.tsx";
import type { ClientMessage } from "@gdt/game-protocol";

export default function Final({ room, view, readOnly, sound = false, ui, send }: { room: RoomMsg; view: PlayerView; readOnly?: boolean; sound?: boolean; ui?: UiCtl; send?: (m: ClientMessage) => void }) {
  const people = usePeople(room), me = view.viewerId;
  const rows = useMemo(() => [...view.players].sort((a, b) => b.score - a.score).map((p) => ({ id: p.id, name: p.name, color: people.get(p.id).color, score: p.score })), [view.players, people]);
  const winners = useMemo(() => new Set(view.winners ?? []), [view.winners]);
  // Premio della serata prima della scalata: una volta per partita (e per scheda), mai nei test veloci
  const awKey = `gdt.award.${room.code}`, award = view.award;
  const [seen, setSeen] = useState(() => { if (FAST || !award) return true; try { return sessionStorage.getItem(awKey) === "1"; } catch { return false; } });
  const [sharing, setSharing] = useState(false), [cop, setCop] = useState(false), [riep, setRiep] = useState(false), [menu, setMenu] = useState(false), [nota, setNota] = useState<string | null>(null);
  const inAward = !seen && !!award;
  useEffect(() => { music.theme(inAward ? null : "musica-finale.mp3"); return () => music.theme(null); }, [inAward]);   // dalle statistiche in poi: la musica del finale
  const ultimo = leggiUltimo(room.code);
  const condividi = async () => {   // la cartolina della partita: l'ultimo turno, il mio punteggio e il mio posto
    if (!ultimo || sharing) return; setSharing(true);
    try {
      const mio = rows.find((r) => r.id === me), tot = mio?.score ?? ultimo.pts, posto = 1 + rows.filter((r) => r.score > tot).length, giorno = dayId(), pct = stereoGame(view.stereo)?.pct;
      const verdetto = ts(winners.has(me) ? "share.v.vinto" : posto <= 3 && rows.length > 3 ? "share.v.podio" : "share.v.altri");
      await condividiCartolina({ giorno, rec: { n: 0, pts: tot, cella: "", frase: ultimo.frase, carte: ultimo.carte, voto: ultimo.voto, cadute: ultimo.cadute, ...(ultimo.seg ? { seg: ultimo.seg } : {}), ...(pct !== undefined ? { pct } : {}) },
        sotto: ts(room.options.flash ? "share.sotto.flash" : "share.sotto.partita", { data: dataLunga(giorno) }), verdetto, banda: ts("share.banda", { punti: tot, posto, tot: rows.length }), indirizzo: location.host },
        [fraseSocial(ultimo.frase), ts("share.t", { punti: tot, posto, tot: rows.length }), location.origin].filter(Boolean).join("\n"), `giu-dalla-torre-${giorno}.png`);
    } catch { /* niente cartolina: si resta sulla classifica */ }
    setSharing(false);
  };
  if (!seen && award) {
    const w = people.get(award.winnerId);
    return <AwardScene award={award} winner={{ name: w.name, color: w.color }} age={room.options.ageBand} sound={sound} readOnly={readOnly} onDone={() => { try { sessionStorage.setItem(awKey, "1"); } catch { /* niente memoria: vale per questa visita */ } setSeen(true); }} />;
  }
  const copertina = async () => {   // la copertina del rotocalco: il personaggio del miglior lancio e il luogo comune più forte
    if (cop) return; setCop(true);
    try { const dd = datiRotocalco(view.stereo, ultimo ? ultimo.carte.find((c) => c.pos === ultimo.voto)?.id : undefined, dayId(), location.host); if (dd) await condividiRotocalco(dd, `copertina-${dd.giorno}.png`); } catch { /* niente copertina */ }
    setCop(false);
  };
  const testo = async () => {   // il messaggio di testo: Pregiudiziometro, luoghi comuni e il mio punteggio
    const mio = rows.find((r) => r.id === me), tot = mio?.score ?? ultimo?.pts ?? 0, posto = 1 + rows.filter((r) => r.score > tot).length;
    const r = await condividiTesto(testoPartita(view.stereo, mio ? { punti: tot, posto, tot: rows.length } : null, location.origin));
    if (r === "copiato") setNota(ts("sm.copiato")); else setMenu(false);
  };
  const occupato = sharing ? "cartolina" : cop ? "copertina" : null;
  const opzioni: ShareOption[] = [
    ...(ultimo ? [{ id: "cartolina", label: "sm.cartolina" as const, hint: "sm.cartolina.s" as const, icon: "🖼️", onPick: () => { void condividi().then(() => setMenu(false)); } }] : []),
    ...(datiRotocalco(view.stereo, ultimo ? ultimo.carte.find((c) => c.pos === ultimo.voto)?.id : undefined, dayId(), location.host) ? [{ id: "copertina", label: "sm.copertina" as const, hint: "sm.copertina.s" as const, icon: "📰", onPick: () => { void copertina().then(() => setMenu(false)); } }] : []),
    { id: "testo", label: "sm.testo" as const, hint: "sm.testo.s" as const, icon: "💬", onPick: () => { void testo(); } },
  ];
  return <FinalScene summary={riep} onDone={() => setRiep(true)} onShare={!readOnly ? () => { setNota(null); setMenu(true); } : undefined} sharing={sharing || cop} rows={rows} winners={winners} sound={sound} readOnly={readOnly} ui={ui} onLeave={() => { send?.({ t: "leave" }); forgetSession(room.code); navigate("/"); }} onNew={() => { send?.({ t: "leave" }); forgetSession(room.code); navigate("/crea"); }}>
    {riep && <Riepilogo rows={rows} winners={winners} stereo={view.stereo} isBot={(id) => people.get(id).bot} sound={sound}  />}
    {menu && <ShareMenu options={opzioni} busy={occupato} note={nota} onClose={() => setMenu(false)} />}
  </FinalScene>;
}
