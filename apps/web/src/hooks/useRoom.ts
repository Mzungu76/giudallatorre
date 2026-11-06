import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, ServerMessage } from "@gdt/game-protocol";
import { RoomSocket } from "../lib/socket.ts";
import type { SocketStatus } from "../lib/socket.ts";
import { loadSession } from "../lib/session.ts";

export type RoomMsg = Extract<ServerMessage, { t: "room" }>;
export type ViewMsg = Extract<ServerMessage, { t: "view" }>;
const ERR: Record<string, string> = {
  NOT_HOST: "Solo l'host può farlo.", NOT_ENOUGH_PLAYERS: "Servono almeno 3 giocatori per iniziare.", WRONG_PHASE: "Troppo tardi: la fase è già cambiata.",
  ALREADY_DONE: "L'hai già fatto in questo turno.", NOT_ALLOWED: "Questa azione non è tua in questo momento.", RATE_LIMIT: "Troppi tocchi ravvicinati: rallenta un attimo.",
  CARD_NOT_IN_HAND: "Quella carta non è nella tua mano.", INVALID_POSITION: "Quel personaggio non c'è.", WRONG_STAGE: "Ora non si può.", DISPLAY_OFF: "Lo schermo condiviso è disattivato per questa stanza.",
};

export function useRoom(code: string, mode: "player" | "watch") {
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const [room, setRoom] = useState<RoomMsg | null>(null);
  const [view, setView] = useState<ViewMsg | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sock = useRef<RoomSocket | null>(null);
  useEffect(() => {
    const sess = mode === "player" ? loadSession(code) : null;
    if (mode === "player" && !sess) { setStatus("invalid"); return; }
    let timer = 0;
    const s = new RoomSocket({
      code, token: sess?.token, watch: mode === "watch", onStatus: setStatus,
      onMessage: (m) => {
        if (m.t === "room") setRoom(m);
        else if (m.t === "view") setView(m);
        else if (m.t === "error") { setError(ERR[m.code] ?? "Messaggio non accettato."); clearTimeout(timer); timer = window.setTimeout(() => setError(null), 3200); }
      },
    });
    sock.current = s; s.start();
    return () => { clearTimeout(timer); s.stop(); sock.current = null; };
  }, [code, mode]);
  const send = useCallback((m: ClientMessage) => sock.current?.send(m), []);
  return { status, room, view, error, send };
}
