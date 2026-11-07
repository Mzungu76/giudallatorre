import { useEffect, useRef } from "react";
import { createScene } from "../scene/fallScene.ts";
import type { SceneApi, ResultCue } from "../scene/fallScene.ts";
import { FAST } from "../ui.tsx";

export interface SceneHostProps { cardIds: string[]; cue: ResultCue; sound: boolean; onDone: () => void; apiRef?: React.MutableRefObject<SceneApi | null> }
/** Contenitore React della scena della caduta (torre di profilo): una scena per turno. */
export default function SceneHost(p: SceneHostProps) {
  const el = useRef<HTMLDivElement>(null), cb = useRef(p);
  cb.current = p;
  useEffect(() => {
    const s = createScene(el.current!, { cardIds: p.cardIds, reduced: FAST, sound: () => cb.current.sound });
    if (p.apiRef) p.apiRef.current = s;
    s.play(p.cue, () => cb.current.onDone());
    return () => { s.destroy(); if (p.apiRef) p.apiRef.current = null; };
  }, [p.cardIds.join("|"), p.cue.fallPositions.join(","), p.cue.seed]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="scene-root" ref={el} data-testid="scene" />;
}
