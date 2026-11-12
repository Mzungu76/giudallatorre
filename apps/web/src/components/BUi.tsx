import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { LuiSpec, PlayerView } from "@gdt/game-engine";
import { luiTok } from "../scene/draw.ts";
import { luiEffectHow, luiLabel, objCond, objCondPublic } from "../lib/lui.ts";
import { useNow } from "../ui.tsx";
import { t, ts } from "../lib/testi.ts";

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
export function BMeta({ turn, mega, right, deadline, me }: { turn: string; mega?: string; right?: string; deadline?: number | null; /** Il giocatore è il Megafono: chip dorato sempre visibile. */ me?: boolean }) {
  const now = useNow(), s = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
  return <div className="bmeta"><span>{turn}{s !== null && <b data-testid="countdown"> · ⏱ {s}s</b>}</span><span>{me ? <span className="rolechip" data-testid="role-chip">{t("bui.megachip")}</span> : right ?? ts("bui.mega", { nome: mega ?? "" })}</span></div>;
}

/** La frase del Megafono, sempre per intero (il corpo si riduce se è lunga). */
export function PhrasePill({ phrase, megaName }: { phrase: PlayerView["phrase"]; megaName: string }) {
  if (!phrase) return null;
  let label = ts("bui.urla"), body: string;
  if (phrase.mode === "free") { label = ts("bui.oggi.libera"); body = phrase.text ?? ts("bui.libera"); }
  else {
    const m = phrase.text.match(/^Oggi (sale|salgono) sulla torre /);
    if (m) { label = ts("bui.oggi", { verbo: m[1]! }); body = phrase.text.slice(m[0].length); } else body = phrase.text;
  }
  const theme = phrase.mode === "card" ? phrase.theme : undefined, len = body.length, size = len > 90 ? " xl" : len > 55 ? " l" : "";
  return (
    <div className={`phrase-card pk${size}`} data-testid="phrase" aria-label={ts("bui.frase.aria", { nome: megaName, label, testo: body })}>
      <span className="mega-ic" aria-hidden>📣</span>{theme && <span className="ctx" data-testid="phrase-theme">{theme}</span>}<small>{label}</small><b>{body}</b>
    </div>
  );
}

/** PROPAGANDA, obiettivi contrapposti: al Megafono il suo obiettivo segreto (con il personaggio), agli altri la condizione opposta (senza). */
export function ObjPill({ view }: { view: PlayerView }) {
  const o = view.objective; if (!o) return null;
  const mine = o.position !== null;
  return (
    <div className={`objp${mine ? " mine" : ""}`} data-testid="objective">
      <small>{mine ? t("obj.t.mega") : t("obj.t.folla")}</small>
      <b>{mine ? t("obj.mega", { n: o.position!, cond: objCond(o), pt: o.pts }) : t("obj.folla", { cond: objCondPublic(o), pt: o.pts })}</b>
    </div>
  );
}

/** Pannello fisso sotto il pollice: titolo, istruzione breve, scorciatoie (chat, classifica, regolamento) e il contenuto della fase. */
export function BSheet({ title, sub, ui, children, gold }: { title: ReactNode; sub?: ReactNode; ui?: UiCtl | null; children?: ReactNode; /** Turno del Megafono: pannello dorato col badge 📣. */ gold?: boolean }) {
  return (
    <div className={`pp bsheet${gold ? " gold" : ""}`} data-testid="sheet">
      <span className="bgrip" />{gold && <i className="shb" aria-hidden>📣</i>}
      <div className="bhd">
        <b>{gold && ts("bui.sei")}{title}{sub && <small>{sub}</small>}</b>
        {ui && <>
          <button className="bib" onClick={ui.chat} aria-label={ui.unread ? ts("bui.chat.n", { n: ui.unread }) : ts("bui.chat")} data-testid="chat-open">💬{ui.unread > 0 && <i data-testid="chat-unread">{ui.unread > 9 ? "9+" : ui.unread}</i>}</button>
          <button className="bib" onClick={ui.rank} aria-label={ts("bui.classifica")} data-testid="standings-btn">🏆</button>
          <button className="bib" onClick={ui.rules} aria-label={ts("bui.aiuto")} data-testid="legend-btn">i</button>
        </>}
      </div>
      {children}
    </div>
  );
}

/** I tuoi segnalini Lui!: quelli già usati sono grigi. Un tocco li apre grandi. */
export function LuiTray({ view, ui }: { view: PlayerView; ui?: UiCtl | null }) {
  const left = (sp: LuiSpec) => view.myLuiLeft.includes(sp.slot);
  const label = ts("bui.tray.aria", { elenco: view.luiTokens.filter(left).map((x) => luiLabel(x)).join(", ") || ts("bui.nessuno") });
  return (
    <button className="bltr" onClick={ui?.lui} aria-label={label} data-testid="lui-tray">
      <span className="lab">{t("bui.lui.lab")}</span>
      {view.luiTokens.map((sp) => <span key={sp.slot} className={`lt ${left(sp) ? "" : "used"}`} title={`${luiLabel(sp)}${sp.effect ? "" : `: +${sp.pts}`}${left(sp) ? "" : ts("bui.usato")}`} dangerouslySetInnerHTML={{ __html: luiTok(sp, 34) }} />)}
    </button>
  );
}

export const Row = ({ children }: { children: ReactNode }) => <div className="bcrow">{children}</div>;

/** Messaggio di attesa al centro della scena. */
export function WaitCard({ text, sub }: { text: string; sub?: string }) {
  return <div className="bwait" data-testid="waiting"><div className="pp"><b>{text}</b>{sub && <small>{sub}</small>}</div></div>;
}

/** Popup informativo sul Lui! posato sulla Torre (tocco sul gettone durante il voto): cosa può essere e come funziona. Agli altri non dice quale gettone è. */
export function LuiInfo({ view, onClose }: { view: PlayerView; onClose: () => void }) {
  const placed = view.luiSlot ? view.luiTokens.find((x) => x.slot === view.luiSlot) ?? null : null;
  // gioco base «Cade / Non cade»: il Megafono vede i suoi due segnalini, gli altri i tre possibili
  const mine = view.cnc ? view.marks.filter((m) => m.slot).map((m) => view.luiTokens.find((x) => x.slot === m.slot)!).filter(Boolean) : [];
  const list = view.cnc ? (mine.length ? mine : view.luiTokens) : placed ? [placed] : view.luiTokens;
  const how = (sp: LuiSpec) => sp.effect ? luiEffectHow(sp) : sp.trap ? t("bui.info.trap", { pt: sp.pts }) : sp.herd ? t("bui.info.herd", { k: sp.k, pt: sp.pts }) : sp.slot === "zero" ? t("bui.info.zero", { pt: sp.pts }) : t("bui.info.k", { k: sp.k, pt: sp.pts });
  return (
    <div className="bov" onClick={onClose} role="dialog" aria-label={ts("bui.info.titolo")} data-testid="lui-info">
      <div className="pp bpop" onClick={(e) => e.stopPropagation()}>
        <h3>{t("bui.info.titolo")}</h3>
        <div className="hint" style={{ margin: "0 0 6px" }}>{view.cnc ? (mine.length ? t("bui.info.cnc.mio", { a: view.marks[0]?.position ?? 0 }) : t("bui.info.cnc.altri", { a: view.marks[0]?.position ?? 0 })) : placed ? t("bui.info.mio", { n: view.luiPosition ?? 0 }) : t("bui.info.altri", { n: view.luiPosition ?? 0 })}</div>
        {list.map((sp) => (
          <div key={sp.slot} className="blrow">
            <span className="tk" dangerouslySetInnerHTML={{ __html: luiTok(sp, 64) }} />
            <div><b>{luiLabel(sp)}</b><small>{how(sp)}</small></div>
          </div>
        ))}
        <div className="hint" style={{ margin: "6px 0 10px" }}>{view.cnc ? t("bui.info.nota.cnc") : view.propaganda ? t("bui.info.nota.prop") : t("bui.info.nota")}</div>
        <button className="bt pap" style={{ fontSize: 18, padding: 10, width: "100%" }} onClick={onClose} data-testid="lui-info-close">{t("bui.chiudi")}</button>
      </div>
    </div>
  );
}

/** Popup dei segnalini Lui! in grande. */
export function LuiPopup({ view, onClose }: { view: PlayerView; onClose: () => void }) {
  return (
    <div className="bov" onClick={onClose} role="dialog" aria-label={ts("bui.popup.titolo")} data-testid="lui-popup">
      <div className="pp bpop" onClick={(e) => e.stopPropagation()}>
        <h3>{t("bui.popup.titolo")}</h3>
        {view.luiTokens.map((sp) => {
          const left = view.myLuiLeft.includes(sp.slot);
          return (
            <div key={sp.slot} className={`blrow ${left ? "" : "used"}`}>
              <span className="tk" dangerouslySetInnerHTML={{ __html: luiTok(sp, 76) }} />
              <div><b>{luiLabel(sp)}</b><small>{left ? (sp.effect ? luiEffectHow(sp) : sp.trap ? t("bui.popup.gregge", { pt: sp.pts }) : sp.slot === "zero" ? t("bui.popup.zero") : sp.herd ? t("bui.popup.k.gregge", { k: sp.k }) : t("bui.popup.k", { k: sp.k })) : t("bui.popup.usato")}</small></div>
              <span className="pt">{sp.effect ? (sp.positive ? "+" : "−") : `+${sp.pts}`}</span>
            </div>
          );
        })}
        <div className="hint" style={{ margin: "6px 0 10px" }}>{view.cnc ? t("bui.popup.nota.cnc") : t("bui.popup.nota")}</div>
        <button className="bt pap" style={{ fontSize: 18, padding: 10, width: "100%" }} onClick={onClose} data-testid="lui-popup-close">{t("bui.chiudi")}</button>
      </div>
    </div>
  );
}
