import { cardFull } from "../lib/cards.ts";
import { Btn } from "../ui.tsx";
import { t, ts } from "../lib/testi.ts";

/** Personaggio a schermo intero: si guarda bene, si scorre con le frecce, poi si sceglie. */
export default function Zoom({ cardId, pos, total, onClose, onNav, actionLabel, onAction, title = ts("zoom.titolo") }: {
  cardId: string; pos: number; total: number; onClose: () => void; onNav: (pos: number) => void; actionLabel: string; onAction: () => void; title?: string;
}) {
  return (
    <div className="zoom on" role="dialog" aria-label={ts("zoom.aria", { n: pos })} data-testid="zoom">
      <div className="zt">{title}</div>
      <div className="zc">
        <img src={cardFull(cardId)} alt={ts("zoom.alt", { n: pos })} className="fullcard" />
      </div>
      <button className="arr al" aria-label={ts("zoom.prec")} onClick={() => onNav(((pos + total - 2) % total) + 1)}>‹</button>
      <button className="arr ar" aria-label={ts("zoom.succ")} onClick={() => onNav((pos % total) + 1)}>›</button>
      <div className="zb">
        <Btn onClick={onAction} testId="zoom-action">{actionLabel}</Btn>
        <Btn kind="pap" onClick={onClose} style={{ fontSize: 18, padding: 10 }} testId="zoom-close">{t("zoom.indietro")}</Btn>
      </div>
    </div>
  );
}
