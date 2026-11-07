import { useState } from "react";
import { Page, Btn, navigate } from "../ui.tsx";
import HowTo from "../components/HowTo.tsx";
import HomeTools from "../components/HomeTools.tsx";

/** Home: logo (zona alta) → azione principale → azioni secondarie → utility. Smartphone: colonna singola; tablet/PC: illustrazione a sinistra, azioni a destra. */
export default function Home() {
  const [how, setHow] = useState(false);
  return (
    <Page testId="home" wide bg="sky">
      <section className="hm-hero">
        <div className="logo">
          <div className="l1">GIÙ</div><div className="l2">DALLA</div><div className="l3">TORRE!</div>
        </div>
        <div className="credit" data-testid="credit">Un gioco di <b>D. Mansetti</b></div>
        <div className="hm-art" aria-hidden>
          <div className="hm-tower">
            <img className="cut stk" alt="" src="/cutouts/p05-i01.webp" style={{ height: 136, left: 14, top: -39 }} />
            <img className="cut stk" alt="" src="/cutouts/p05-i02.webp" style={{ height: 148, left: 82, top: -60 }} />
            <img className="cut stk" alt="" src="/cutouts/p05-i03.webp" style={{ height: 136, left: 160, top: -39 }} />
            <img alt="" src="/scene/tower_pop.webp" className="hm-tw" />
          </div>
        </div>
      </section>
      <nav className="hm-actions" aria-label="Azioni">
        <Btn onClick={() => navigate("/crea")} testId="go-create" style={{ fontSize: 30, padding: "18px 12px" }}>Crea partita</Btn>
        <Btn kind="red" onClick={() => navigate("/entra")} testId="go-join">Entra con un codice</Btn>
        <Btn kind="pap" onClick={() => navigate("/crea?solo=1")} style={{ fontSize: 19, padding: 11 }} testId="go-solo">Gioca da solo (con bot)</Btn>
        <div className="hm-util">
          <Btn kind="pap" onClick={() => setHow(true)} style={{ fontSize: 16, padding: "9px 14px" }} testId="go-how">Come si gioca</Btn>
          <HomeTools />
        </div>
      </nav>
      {how && <HowTo onClose={() => setHow(false)} />}
    </Page>
  );
}
