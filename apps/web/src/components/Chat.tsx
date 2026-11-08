import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { ChatDto, ClientMessage } from "@gdt/game-protocol";
import { MAX_CHAT_CHARS } from "@gdt/game-protocol";
import { Disc, PLAYER_COLORS } from "../ui.tsx";
import { sfx } from "../lib/sfx.ts";
import { t, ts } from "../lib/testi.ts";

const QUICK = ["😂", "👏", "😱", "🤔", "🔥", "🐑"];

/** Messaggi non letti e suono per i nuovi messaggi. `open` è lo stato della chat a tutto schermo. */
export function useChatState(chat: ChatDto[], me: string, sound: boolean) {
  const [open, setOpen] = useState(false), [seen, setSeen] = useState(0);
  const last = chat.length ? chat[chat.length - 1]!.id : 0, lastDing = useRef(last);
  useEffect(() => { if (last > lastDing.current) { const m = chat[chat.length - 1]; if (m && m.from !== me) sfx.ding(sound); } lastDing.current = last; }, [last]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) setSeen(last); }, [open, last]);
  const unread = open ? 0 : chat.filter((m) => m.id > seen && m.from !== me).length;
  return { open, setOpen, unread };
}

/** Chat a tutto schermo: si apre dal pannello in basso (o dalla lobby) e si chiude con la X. */
export default function ChatPanel({ chat, me, players, send, onClose }: { chat: ChatDto[]; me: string; players: { id: string }[]; send: (m: ClientMessage) => void; onClose: () => void }) {
  const [text, setText] = useState(""), list = useRef<HTMLDivElement>(null);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [chat.length]);
  const colorOf = (id: string) => PLAYER_COLORS[Math.max(0, players.findIndex((p) => p.id === id)) % 8]!;
  function submit(e?: FormEvent) { e?.preventDefault(); const t = text.trim(); if (!t) return; send({ t: "chat", text: t }); setText(""); }
  return (
    <div className="bov" role="dialog" aria-label={ts("chat.aria")} data-testid="chat-wrap">
      <div className="chat bchat" data-testid="chat">
        <div className="chat-h"><b>{t("chat.titolo")}</b><button onClick={onClose} aria-label={ts("chat.chiudi")} data-testid="chat-close">×</button></div>
        <div className="chat-sub">{players.length} giocatori · messaggi fino a {MAX_CHAT_CHARS} caratteri</div>
        <div className="chat-l" ref={list} aria-live="polite">
          {chat.length === 0 && <div className="chat-e">{t("chat.vuota")}</div>}
          {chat.map((m) => (
            <div key={m.id} className={`msg ${m.from === me ? "mine" : ""}`} data-testid="chat-msg"><small><Disc color={colorOf(m.from)} />{m.from === me ? ts("chat.tu") : m.name}</small><span>{m.text}</span></div>
          ))}
        </div>
        <div className="chat-q">{QUICK.map((q) => <button key={q} onClick={() => send({ t: "chat", text: q })} aria-label={ts("chat.invia.q", { q })}>{q}</button>)}</div>
        <form className="chat-f" onSubmit={submit}>
          <input value={text} maxLength={MAX_CHAT_CHARS} onChange={(e) => setText(e.target.value)} placeholder={ts("chat.ph")} aria-label={ts("chat.aria.in")} data-testid="chat-input" autoComplete="off" />
          <button type="submit" disabled={!text.trim()} data-testid="chat-send">{t("chat.invia")}</button>
        </form>
      </div>
    </div>
  );
}
