import { useState } from "react";
import { Stage, Btn, navigate } from "../ui.tsx";
import { IntroSlides } from "../components/Intro.tsx";
import HomeTools from "../components/HomeTools.tsx";
import { t } from "../lib/testi.ts";

export default function Home() {
  const [how, setHow] = useState(false);
  return (
    <Stage bg="sky" testId="home">
      <div className="logo">
        <div className="l1">{t("home.l1")}</div><div className="l2">{t("home.l2")}</div><div className="l3">{t("home.l3")}</div>
      </div>
      <img className="cut stk" alt="" src="/cutouts/p05-i01.webp" style={{ position: "absolute", height: 136, left: 66, top: 283, zIndex: 5 }} />
      <img className="cut stk" alt="" src="/cutouts/p05-i02.webp" style={{ position: "absolute", height: 148, left: 134, top: 262, zIndex: 5 }} />
      <img className="cut stk" alt="" src="/cutouts/p05-i03.webp" style={{ position: "absolute", height: 136, left: 212, top: 283, zIndex: 5 }} />
      <img alt="" src="/scene/tower_pop.webp" style={{ position: "absolute", left: 52, top: 322, width: 261, zIndex: 6 }} />
      <div className="home-btns">
        <Btn onClick={() => navigate("/crea")} testId="go-create">{t("home.crea")}</Btn>
        <Btn kind="red" onClick={() => navigate("/entra")} testId="go-join">{t("home.entra")}</Btn>
        <div className="seg">
          <Btn kind="pap" onClick={() => navigate("/crea?solo=1")} style={{ fontSize: 16, padding: "10px 6px" }} testId="go-solo">{t("home.solo")}</Btn>
          <Btn kind="pap" onClick={() => setHow(true)} style={{ fontSize: 16, padding: "10px 6px" }} testId="go-how">{t("home.come")}</Btn>
        </div>
      </div>
      <HomeTools />
      <div className="credit" data-testid="credit">{t("home.credito")}</div>
      {how && <IntroSlides onClose={() => setHow(false)} />}
    </Stage>
  );
}
