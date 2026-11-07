import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { ChatDto, ClientMessage } from "@gdt/game-protocol";
import { MAX_CHAT_CHARS } from "@gdt/game-protocol";
import { Disc, PLAYER_COLORS } from "../ui.tsx";

const QUICK = ["😂", "👏", "😱", "🤔", "🔥", "🐑"];

/** Messaggi tra i giocatori: tasto con contatore dei non letti e pannello a comparsa. */
export default function Chat({ chat, me, players, send }: { chat: ChatDto[]; me: string; players: { id: string }[]; send: (m: ClientMessage) => void }) {
  const [open, setOpen] = useState(false), [text, setText] = useState(""), [seen, setSeen] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const last = chat.length ? chat[chat.length - 1]!.id : 0;
  const unread = open ? 0 : chat.filter((m) => m.id > seen && m.from !== me).length;
  useEffect(() => { if (open) { setSeen(last); list.current?.scrollTo({ top: list.current.scrollHeight }); } }, [open, last]);
  const colorOf = (id: string) => PLAYER_COLORS[Math.max(0, players.findIndex((p) => p.id === id)) % 8]!;
  function submit(e?: FormEvent) { e?.preventDefault(); const t = text.trim(); if (!t) return; send({ t: "chat", text: t }); setText(""); }
  return (
    <>
      <button className="chatbtn" onClick={() => setOpen(true)} aria-label={unread ? `Messaggi, ${unread} nuovi` : "Messaggi"} data-testid="chat-open">💬{unread > 0 && <i data-testid="chat-unread">{unread > 9 ? "9+" : unread}</i>}</button>
      {open && (
        <div className="chat" role="dialog" aria-label="Messaggi tra i giocatori" data-testid="chat">
          <div className="chat-h"><b>Messaggi</b><button onClick={() => setOpen(false)} aria-label="Chiudi" data-testid="chat-close">×</button></div>
          <div className="chat-l" ref={list} aria-live="polite">
            {chat.length === 0 && <div className="chat-e">Nessun messaggio. Prendi in giro gli altri (con affetto).</div>}
            {chat.map((m) => (
              <div key={m.id} className={`msg ${m.from === me ? "mine" : ""}`} data-testid="chat-msg"><small><Disc color={colorOf(m.from)} />{m.from === me ? "Tu" : m.name}</small><span>{m.text}</span></div>
            ))}
          </div>
          <div className="chat-q">{QUICK.map((q) => <button key={q} onClick={() => send({ t: "chat", text: q })} aria-label={`Invia ${q}`}>{q}</button>)}</div>
          <form className="chat-f" onSubmit={submit}>
            <input value={text} maxLength={MAX_CHAT_CHARS} onChange={(e) => setText(e.target.value)} placeholder="Scrivi un messaggio…" aria-label="Il tuo messaggio" data-testid="chat-input" autoComplete="off" />
            <button type="submit" disabled={!text.trim()} data-testid="chat-send">Invia</button>
          </form>
        </div>
      )}
    </>
  );
}
