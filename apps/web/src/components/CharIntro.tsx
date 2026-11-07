import { CHAR_BLURB, CHAR_NAMES, cardUrl, charIdx, tokenUrl } from "../lib/characters.ts";
import { useStage } from "../ui.tsx";

/** All'inizio della partita: «Questo sei tu». La carta e il segnalino del proprio colore. */
export default function CharIntro({ color, onClose }: { color: string; onClose: () => void }) {
  const { H } = useStage(), i = charIdx(color);
  return (
    <div className="chi" style={{ height: H }} data-testid="char-intro" role="dialog" aria-label="Il tuo personaggio">
      <div className="stbd-sky" /><div className="stbd-rays" />
      <div className="chi-t"><small>Il tuo personaggio</small><b>{CHAR_NAMES[i]}</b></div>
      <img className="chi-card" src={cardUrl(color)} alt={CHAR_NAMES[i]} />
      <div className="chi-s"><img src={tokenUrl(color)} width={44} height={44} alt="" /><span>{CHAR_BLURB[i]}.<br />Questo segnalino userai per votare.</span></div>
      <button className="stbd-ok" onClick={onClose} data-testid="char-ok">Ci sono!</button>
    </div>
  );
}
