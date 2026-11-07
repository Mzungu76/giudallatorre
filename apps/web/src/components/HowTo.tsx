import { Btn } from "../ui.tsx";

export const HOWTO_STEPS: [string, string][] = [
  ["📣", "Il Megafono urla una frase: “Oggi sale sulla torre chi…”. Ogni turno tocca a uno di voi."],
  ["🃏", "La Folla (tutti gli altri) sceglie in segreto, dalla propria mano, il personaggio che quella cosa la farebbe di sicuro."],
  ["🎯", "Il Megafono scommette col gettone Lui!: “Cade lui!” (+4 se cade) oppure “Non cade” (+1 se resta su). Se sbaglia: −1."],
  ["🗳", "Tutti votano in segreto il personaggio che più somiglia alla frase. Il più votato cade giù dalla torre!"],
  ["⭐", "Punti: +2 se hai votato quello caduto, +2 se era la tua carta. In caso di pareggio cadono tutte le carte a pari merito. Il Megafono prende anche +1 per ogni voto degli altri sulla carta che ha votato, cada o no: gli altri cercano di non votare come lui. Vince chi ha più punti quando tutti hanno fatto il Megafono."],
];

/** Come si gioca, in 5 passi. Si apre dalla Home, e da solo alla prima partita su questo dispositivo. */
export default function HowTo({ onClose }: { onClose: () => void }) {
  return (
    <div className="zoom on" onClick={onClose} role="dialog" aria-label="Come si gioca" data-testid="howto">
      <div className="how" onClick={(e) => e.stopPropagation()}>
        <h2>Come si gioca</h2>
        <ol className="how-steps">{HOWTO_STEPS.map(([ic, t]) => <li key={ic}><span className="how-ic">{ic}</span><span>{t}</span></li>)}</ol>
        <Btn onClick={onClose} testId="howto-close">Ho capito!</Btn>
      </div>
    </div>
  );
}
