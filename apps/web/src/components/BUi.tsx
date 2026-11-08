import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { LuiSpec, PlayerView } from "@gdt/game-engine";
import { luiTok } from "../scene/draw.ts";
import { luiLabel } from "../lib/lui.ts";
import { useNow } from "../ui.tsx";

/** Comandi delle finestre (chat, classifica, regolamento, segnalini Lui!) per il pannello in basso. */
export interface UiCtl { unread: number; chat: () => void; rank: () => void; rules: () => void; lui: () => void }

export const OPEN_MS = 6000;
/** Apertura a tempo: un tocco apre, un altro chiude, e si richiude da sola. */
export function useTimedOpen(ms = OPEN_MS) {
  const [open, setOpen] = useState(false), t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const set = (v: boolean) => { clearTimeout(t.current); setOpen(v); if (v) t.current = setTimeout(() => setOpen(false), ms); };
  useEffect(() => () => clearTimeout(t.current), []);
  return [open, set] as const;
}

/** Riga in alto: turno (con il timer, se c'è) e Megafono. */
export function BMeta({ turn, mega, right, deadline }: { turn: string; mega?: string; right?: string; deadline?: number | null }) {
  const now = useNow(), s = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
  return <div className="bmeta"><span>{turn}{s !== null && <b data-testid="countdown"> · ⏱ {s}s</b>}</span><span>{right ?? `📣 ${mega}`}</span></div>;
}

/** La frase del Megafono, sempre per intero (il corpo si riduce se è lunga). */
export function PhrasePill({ phrase, megaName }: { phrase: PlayerView["phrase"]; megaName: string }) {
  if (!phrase) return null;
  let label = "Il Megafono urla:", body: string;
  if (phrase.mode === "free") { label = "Oggi sale sulla torre…"; body = phrase.text ?? "una frase tutta sua (detta a voce)!"; }
  else {
    const m = phrase.text.match(/^Oggi (sale|salgono) sulla torre /);
    if (m) { label = `Oggi ${m[1]} sulla torre…`; body = phrase.text.slice(m[0].length); } else body = phrase.text;
  }
  const theme = phrase.mode === "card" ? phrase.theme : undefined, len = body.length, size = len > 90 ? " xl" : len > 55 ? " l" : "";
  return (
    <div className={`phrase-card pk${size}`} data-testid="phrase" aria-label={`${megaName} urla: ${label} ${body}`}>
      <span className="mega-ic" aria-hidden>📣</span>{theme && <span className="ctx" data-testid="phrase-theme">{theme}</span>}<small>{label}</small><b>{body}</b>
    </div>
  );
}

/** Pannello fisso sotto il pollice: titolo, istruzione breve, scorciatoie (chat, classifica, regolamento) e il contenuto della fase. */
export function BSheet({ title, sub, ui, children }: { title: ReactNode; sub?: ReactNode; ui?: UiCtl | null; children?: ReactNode }) {
  return (
    <div className="pp bsheet" data-testid="sheet">
      <span className="bgrip" />
      <div className="bhd">
        <b>{title}{sub && <small>{sub}</small>}</b>
        {ui && <>
          <button className="bib" onClick={ui.chat} aria-label={ui.unread ? `Chat, ${ui.unread} messaggi nuovi` : "Chat"} data-testid="chat-open">💬{ui.unread > 0 && <i data-testid="chat-unread">{ui.unread > 9 ? "9+" : ui.unread}</i>}</button>
          <button className="bib" onClick={ui.rank} aria-label="Classifica" data-testid="standings-btn">🏆</button>
          <button className="bib" onClick={ui.rules} aria-label="Regolamento e suoni" data-testid="legend-btn">i</button>
        </>}
      </div>
      {children}
    </div>
  );
}

/** I tuoi segnalini Lui!: quelli già usati sono grigi. Un tocco li apre grandi. */
export function LuiTray({ view, ui }: { view: PlayerView; ui?: UiCtl | null }) {
  const left = (sp: LuiSpec) => view.myLuiLeft.includes(sp.slot);
  const label = `I tuoi segnalini Lui!: ${view.luiTokens.filter(left).map((t) => luiLabel(t)).join(", ") || "nessuno"}`;
  return (
    <button className="bltr" onClick={ui?.lui} aria-label={label} data-testid="lui-tray">
      <span className="lab">LUI!</span>
      {view.luiTokens.map((sp) => <span key={sp.slot} className={`lt ${left(sp) ? "" : "used"}`} title={`${luiLabel(sp)}: +${sp.pts}${left(sp) ? "" : " (già usato)"}`} dangerouslySetInnerHTML={{ __html: luiTok(sp, 34) }} />)}
    </button>
  );
}

export const Row = ({ children }: { children: ReactNode }) => <div className="bcrow">{children}</div>;

/** Messaggio di attesa al centro della scena. */
export function WaitCard({ text, sub }: { text: string; sub?: string }) {
  return <div className="bwait" data-testid="waiting"><div className="pp"><b>{text}</b>{sub && <small>{sub}</small>}</div></div>;
}

/** Popup dei segnalini Lui! in grande. */
export function LuiPopup({ view, onClose }: { view: PlayerView; onClose: () => void }) {
  return (
    <div className="bov" onClick={onClose} role="dialog" aria-label="I tuoi segnalini Lui!" data-testid="lui-popup">
      <div className="pp bpop" onClick={(e) => e.stopPropagation()}>
        <h3>I tuoi segnalini Lui!</h3>
        {view.luiTokens.map((sp) => {
          const left = view.myLuiLeft.includes(sp.slot);
          return (
            <div key={sp.slot} className={`blrow ${left ? "" : "used"}`}>
              <span className="tk" dangerouslySetInnerHTML={{ __html: luiTok(sp, 76) }} />
              <div><b>{luiLabel(sp)}</b><small>{left ? (sp.slot === "zero" ? "Nessun altro vota la carta del gettone." : `Almeno ${sp.k} giocatori votano la carta del gettone.`) : "Già usato in questa partita."}</small></div>
              <span className="pt">+{sp.pts}</span>
            </div>
          );
        })}
        <div className="hint" style={{ margin: "6px 0 10px" }}>Ogni gettone si usa una sola volta. Contano solo i voti degli altri, non il tuo. Gli altri non vedono quali ti restano.</div>
        <button className="bt pap" style={{ fontSize: 18, padding: 10, width: "100%" }} onClick={onClose} data-testid="lui-popup-close">Chiudi</button>
      </div>
    </div>
  );
}
