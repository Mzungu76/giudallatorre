import { useEffect, useRef } from "react";
import { createScene } from "../scene/towerScene.ts";
import type { SceneApi, ResultCue, Token } from "../scene/towerScene.ts";

export interface SceneHostProps {
  cardIds: string[]; selected: number | null; tokens: Token[];
  lui: { pos: number; kind: "CADE" | "NON_CADE" | null } | null;
  cue: ResultCue | null; cueKey: string; sound: boolean; onPick: (pos: number) => void; onDone: () => void;
  apiRef?: React.MutableRefObject<SceneApi | null>;
}
/** Contenitore React della scena imperativa: una scena per turno (key = turno). */
export default function SceneHost(p: SceneHostProps) {
  const el = useRef<HTMLDivElement>(null), api = useRef<SceneApi | null>(null), played = useRef<string>(""), cb = useRef(p);
  cb.current = p;
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const s = createScene(el.current!, { cardIds: p.cardIds, reduced, sound: () => cb.current.sound, onPick: (n) => cb.current.onPick(n) });
    api.current = s; if (p.apiRef) p.apiRef.current = s;
    return () => { s.destroy(); api.current = null; if (p.apiRef) p.apiRef.current = null; };
  }, [p.cardIds.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.current?.setSelected(p.selected); }, [p.selected, p.cardIds.join("|")]); // eslint-disable-line
  useEffect(() => { api.current?.setLui(p.lui); }, [p.lui?.pos, p.lui?.kind, p.cardIds.join("|")]); // eslint-disable-line
  useEffect(() => { if (!p.cue) api.current?.showTokens(p.tokens); }, [JSON.stringify(p.tokens), p.cue, p.cardIds.join("|")]); // eslint-disable-line
  useEffect(() => { if (p.cue && played.current !== p.cueKey) { played.current = p.cueKey; api.current?.play(p.cue, () => cb.current.onDone()); } }, [p.cue, p.cueKey, p.cardIds.join("|")]); // eslint-disable-line
  return <div className="scene-root" ref={el} data-testid="scene" />;
}
