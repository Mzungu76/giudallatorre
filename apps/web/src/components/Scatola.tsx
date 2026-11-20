import type { CSSProperties } from "react";
import { ts } from "../lib/testi.ts";

/**
 * La scatolina 3D di un mazzo (come le espansioni dei giochi da tavolo): fronte con titolo e tre carte, lato e coperchio.
 * Il disegno è 150×200 (profondità 46) e viene scalato con `scala`.
 */
export default function Scatola({ nome, colore, carte, scala = 1 }: { nome: string; colore: string; carte: string[]; scala?: number }) {
  const W = 150, H = 200, D = 46, fs = nome.length > 7 ? 28 : 34;
  const pos = [{ b: 4, l: W * 0.06, r: -8, z: 1 }, { b: 10, l: W * 0.52, r: 8, z: 2 }, { b: 0, l: W * 0.29, r: -1, z: 3 }];
  return (
    <div className="eb-sc" style={{ width: (W + D) * scala, height: (H + 20) * scala }} role="img" aria-label={ts("esp.aria.scatola", { nome })}>
      <div className="eb-k" style={{ transform: `scale(${scala})` } as CSSProperties}>
        <div className="eb" style={{ "--a": colore, "--fs": `${fs}px`, width: W, height: H } as CSSProperties}>
          <div className="eb-f" style={{ width: W, height: H, transform: `translateZ(${D / 2}px)` }}>
            <div className="eb-band">{ts("esp.scatola.fascia")}</div>
            <div className="eb-nm">{nome}</div>
            <div className="eb-art">
              {carte.slice(0, 3).map((u, i) => <i key={u} style={{ bottom: pos[i]!.b, left: pos[i]!.l, width: W * 0.4, transform: `rotate(${pos[i]!.r}deg)`, zIndex: pos[i]!.z, backgroundImage: `url(${u})` }} />)}
            </div>
          </div>
          <div className="eb-sd" style={{ width: D, height: H, left: (W - D) / 2, transform: `rotateY(90deg) translateZ(${W / 2}px)` }}><span>{nome}</span></div>
          <div className="eb-tp" style={{ width: W, height: D, top: (H - D) / 2, transform: `rotateX(90deg) translateZ(${H / 2}px)` }} />
        </div>
      </div>
    </div>
  );
}
