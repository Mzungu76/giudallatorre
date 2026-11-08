import { charBlurb, charName, cardUrl, charIdx, tokenUrl } from "../lib/characters.ts";
import { useStage } from "../ui.tsx";
import { t, ts } from "../lib/testi.ts";

/** All'inizio della partita: «Questo sei tu». La carta e il segnalino del proprio colore. */
export default function CharIntro({ color, onClose }: { color: string; onClose: () => void }) {
  const { H } = useStage(), i = charIdx(color);
  return (
    <div className="chi" style={{ height: H }} data-testid="char-intro" role="dialog" aria-label={ts("chi.aria")}>
      <div className="stbd-sky" /><div className="stbd-rays" />
      <div className="chi-t"><small>{t("chi.titolo")}</small><b>{charName(i)}</b></div>
      <img className="chi-card" src={cardUrl(color)} alt={charName(i)} />
      <div className="chi-s"><img src={tokenUrl(color)} width={44} height={44} alt="" /><span>{charBlurb(i)}.<br />{t("chi.segnalino")}</span></div>
      <button className="stbd-ok" onClick={onClose} data-testid="char-ok">{t("chi.ok")}</button>
    </div>
  );
}
