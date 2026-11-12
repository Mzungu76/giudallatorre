import { ts } from "../lib/testi.ts";
import type { TestoKey } from "../lib/testi.ts";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatDto, ClientMessage, ServerMessage } from "@gdt/game-protocol";
import { RoomSocket } from "../lib/socket.ts";
import type { SocketStatus } from "../lib/socket.ts";
import { loadSession } from "../lib/session.ts";

export type RoomMsg = Extract<ServerMessage, { t: "room" }>;
/** La vista col «via!» dell'intervallo a tempo già convertito nell'orologio di questo dispositivo (`goAtLocal`). */
export type ViewMsg = Extract<ServerMessage, { t: "view" }> & { goAtLocal: number | null };
const WS_CODES = ["NOT_HOST", "NOT_ENOUGH_PLAYERS", "WRONG_PHASE", "ALREADY_DONE", "NOT_ALLOWED", "RATE_LIMIT", "CARD_NOT_IN_HAND", "INVALID_POSITION", "WRONG_STAGE", "DISPLAY_OFF", "INVALID_CHOICE", "INVALID_MESSAGE", "NOT_ON_STAGE"];
const errMsg = (code: string) => (WS_CODES.includes(code) ? ts(`ws.${code}` as TestoKey) : ts("ws.altro"));

export function useRoom(code: string, mode: "player" | "watch") {
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const [room, setRoom] = useState<RoomMsg | null>(null);
  const [view, setView] = useState<ViewMsg | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatDto[]>([]);
  const sock = useRef<RoomSocket | null>(null), skew = useRef(Number.NEGATIVE_INFINITY);   // orologio del server meno il nostro: il valore più alto è quello con meno ritardo di rete
  useEffect(() => {
    const sess = mode === "player" ? loadSession(code) : null;
    if (mode === "player" && !sess) { setStatus("invalid"); return; }
    let timer = 0;
    const s = new RoomSocket({
      code, token: sess?.token, watch: mode === "watch", onStatus: setStatus,
      onMessage: (m) => {
        if (m.t === "room") setRoom(m);
        else if (m.t === "view") {
          if (typeof m.now === "number") skew.current = Math.max(skew.current, m.now - Date.now());
          setView({ ...m, goAtLocal: typeof m.goAt === "number" ? m.goAt - (Number.isFinite(skew.current) ? skew.current : 0) : null });
        }
        else if (m.t === "chatlog") setChat(m.msgs);
        else if (m.t === "chat") setChat((c) => (c.some((x) => x.id === m.msg.id) ? c : [...c, m.msg].slice(-60)));
        else if (m.t === "error") { setError(errMsg(m.code)); clearTimeout(timer); timer = window.setTimeout(() => setError(null), 3200); }
      },
    });
    sock.current = s; s.start();
    return () => { clearTimeout(timer); s.stop(); sock.current = null; };
  }, [code, mode]);
  const send = useCallback((m: ClientMessage) => sock.current?.send(m), []);
  return { status, room, view, error, send, chat };
}
