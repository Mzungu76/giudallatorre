import { Btn } from "../ui.tsx";

export const HOWTO_INTRO = [
  "Da qualche parte, in un luogo talmente nascosto che persino i piccioni usano il GPS, svetta la mitica Torre del Giudizio Spicciolo. Fu costruita dopo una riunione del villaggio durata quattro giorni, in cui nessuno si mise d'accordo su niente, tranne su una cosa: buttare giù qualcuno quando serve.",
  "Oggi la domanda è sempre quella: «Chi butteresti giù dalla torre oggi?». Qui si accusa, si vota in segreto e si ride del meraviglioso caos dei comportamenti umani. Tranquilli: sotto la torre ci sono i materassi.",
];

export const HOWTO_STEPS: [string, string][] = [
  ["📣", "Il Megafono urla una frase: «Oggi sale sulla torre chi…». Ogni turno tocca a uno di voi."],
  ["🃏", "Tutti gli altri scelgono in segreto, dalla propria mano, il personaggio che quella cosa la farebbe di sicuro."],
  ["🎯", "Le carte salgono sulla torre. Il Megafono mette il gettone Lui! su una carta: «Cade lui!» oppure «Non cade»."],
  ["🗳", "Tutti votano in segreto il personaggio che più somiglia alla frase. Il più votato cade giù dalla torre (se è un pareggio, cadono tutti i più votati)."],
  ["⭐", "Si contano i punti e si passa il Megafono al giocatore dopo. Vince chi ha più punti quando tutti hanno fatto il Megafono."],
];

export const HOWTO_POINTS: [string, string][] = [
  ["+2", "hai votato un personaggio che cade"],
  ["+2", "la carta che hai giocato cade"],
  ["+1", "Megafono: per ogni voto degli altri sulla carta che ha votato (cada o no)"],
  ["+4 / +1", "Megafono: Lui! azzeccato («Cade lui!» / «Non cade»)"],
  ["−1", "Megafono: Lui! sbagliato"],
];

/** Come si gioca: introduzione, turno e punti. Si apre dalla Home, e da solo alla prima partita su questo dispositivo. */
export default function HowTo({ onClose }: { onClose: () => void }) {
  return (
    <div className="zoom on" onClick={onClose} role="dialog" aria-label="Come si gioca" data-testid="howto">
      <div className="how" onClick={(e) => e.stopPropagation()}>
        <h2>Benvenuti!</h2>
        <div className="how-intro" data-testid="howto-intro">{HOWTO_INTRO.map((t, i) => <p key={i}>{t}</p>)}</div>
        <h3>Come si gioca</h3>
        <ol className="how-steps">{HOWTO_STEPS.map(([ic, t]) => <li key={ic}><span className="how-ic">{ic}</span><span>{t}</span></li>)}</ol>
        <h3>Come si fanno punti</h3>
        <ul className="how-pts">{HOWTO_POINTS.map(([p, t]) => <li key={t}><b className={p.startsWith("−") ? "neg" : ""}>{p}</b><span>{t}</span></li>)}</ul>
        <Btn onClick={onClose} testId="howto-close">Ho capito!</Btn>
      </div>
    </div>
  );
}
