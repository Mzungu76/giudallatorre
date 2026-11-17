import { t } from "../lib/testi.ts";
import type { TestoKey } from "../lib/testi.ts";

export interface ShareOption { id: string; label: TestoKey; hint: TestoKey; icon: string; onPick: () => void }
/** Foglio con i modi di condividere la partita: ognuno è un'immagine o un testo diverso. */
export default function ShareMenu({ options, busy, note, onClose }: { options: ShareOption[]; busy?: string | null; note?: string | null; onClose: () => void }) {
  return (
    <div className="shm" data-testid="share-menu" onClick={onClose}>
      <div className="shm-box" onClick={(e) => e.stopPropagation()}>
        <div className="shm-t">{t("sm.titolo")}</div>
        {options.map((o) => (
          <button key={o.id} className="shm-o" disabled={!!busy} onClick={o.onPick} data-testid={`share-${o.id}`}>
            <i>{o.icon}</i><span><b>{busy === o.id ? t("sm.carico") : t(o.label)}</b><small>{t(o.hint)}</small></span>
          </button>
        ))}
        {note && <div className="shm-n" data-testid="share-note">{note}</div>}
        <button className="shm-x" onClick={onClose}>{t("sm.chiudi")}</button>
      </div>
    </div>
  );
}
