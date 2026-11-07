import { useState } from "react";
import { Stage, Btn, navigate } from "../ui.tsx";
import HowTo from "../components/HowTo.tsx";
import HomeTools from "../components/HomeTools.tsx";

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
      <HomeTools />
      <div className="credit" data-testid="credit">Un gioco di D. Mansetti</div>
      {how && <HowTo onClose={() => setHow(false)} />}
    </Stage>
  );
}
