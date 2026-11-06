import { cardImage } from "../lib/cards.ts";
import { Btn } from "../ui.tsx";

/** Personaggio a schermo intero: si guarda bene, si scorre con le frecce, poi si sceglie. */
export default function Zoom({ cardId, pos, total, onClose, onNav, actionLabel, onAction, title = "guardalo bene, poi decidi" }: {
  cardId: string; pos: number; total: number; onClose: () => void; onNav: (pos: number) => void; actionLabel: string; onAction: () => void; title?: string;
}) {
  const img = cardImage(cardId);
  return (
    <div className="zoom on" role="dialog" aria-label={`Personaggio numero ${pos}`} data-testid="zoom">
      <div className="zt">{title}</div>
      <div className="zc">
        <img src={img.src} alt={`Personaggio ${pos}`} className={img.cut ? "" : "fullcard"} />
        <div className="zn">{pos}</div>
      </div>
      <button className="arr al" aria-label="Precedente" onClick={() => onNav(((pos + total - 2) % total) + 1)}>‹</button>
      <button className="arr ar" aria-label="Successivo" onClick={() => onNav((pos % total) + 1)}>›</button>
      <div className="zb">
        <Btn onClick={onAction} testId="zoom-action">{actionLabel}</Btn>
        <Btn kind="pap" onClick={onClose} style={{ fontSize: 18, padding: 10 }} testId="zoom-close">Indietro</Btn>
      </div>
    </div>
  );
}
