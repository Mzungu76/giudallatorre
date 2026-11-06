import { useState } from "react";
import { Stage, Btn, navigate } from "../ui.tsx";

export default function Home() {
  const [how, setHow] = useState(false);
  return (
    <Stage bg="sky" testId="home">
      <div className="logo">
        <div className="l1">GIÙ</div><div className="l2">DALLA</div><div className="l3">TORRE!</div>
      </div>
      <img className="cut stk" alt="" src="/cutouts/p05-i01.webp" style={{ position: "absolute", height: 136, left: 66, top: 283, zIndex: 5 }} />
      <img className="cut stk" alt="" src="/cutouts/p05-i02.webp" style={{ position: "absolute", height: 148, left: 134, top: 262, zIndex: 5 }} />
      <img className="cut stk" alt="" src="/cutouts/p05-i03.webp" style={{ position: "absolute", height: 136, left: 212, top: 283, zIndex: 5 }} />
      <img alt="" src="/scene/tower_pop.webp" style={{ position: "absolute", left: 52, top: 322, width: 261, zIndex: 6 }} />
      <div className="home-btns">
        <Btn onClick={() => navigate("/crea")} testId="go-create">Crea partita</Btn>
        <Btn kind="red" onClick={() => navigate("/entra")} testId="go-join">Entra con un codice</Btn>
        <Btn kind="pap" onClick={() => navigate("/crea?solo=1")} style={{ fontSize: 19, padding: 11 }} testId="go-solo">Gioca da solo (con bot)</Btn>
        <Btn kind="pap" onClick={() => setHow(true)} style={{ fontSize: 19, padding: 11 }}>Come si gioca</Btn>
      </div>
      {how && (
        <div className="zoom on" onClick={() => setHow(false)} role="dialog" aria-label="Come si gioca">
          <div className="how">
            <h2>Come si gioca</h2>
            <ol>
              <li><b>Il Megafono</b> urla una frase: “Oggi sale sulla torre…”</li>
              <li><b>La Folla</b> gioca in segreto la carta Personaggio che ci sta meglio. La Torre si riempie.</li>
              <li>Il Megafono posa il <b>“Lui!”</b> per scommettere. Poi <b>tutti votano</b> in segreto chi cade.</li>
              <li>Chi ha votato il caduto <b>+2</b>, chi ha giocato la sua carta <b>+2</b>, il Lui! vale <b>+4 / +1</b>. Pareggio: cade il personaggio votato dal Megafono.</li>
              <li>Tutti fanno il Megafono (2 volte fino a 5 giocatori, 1 volta da 6 a 8). Vince chi ha più punti.</li>
            </ol>
            <Btn onClick={() => setHow(false)}>Ho capito</Btn>
          </div>
        </div>
      )}
    </Stage>
  );
}
