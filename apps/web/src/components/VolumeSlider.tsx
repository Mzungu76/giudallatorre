import { useAudio } from "../lib/audio.ts";
import { ts } from "../lib/testi.ts";

/** Cursore del volume della musica (0–100%), salvato sul dispositivo. */
export default function VolumeSlider() {
  const { volume, setVolume } = useAudio();
  return (
    <label className="vol" data-testid="volume">
      <span aria-hidden="true">🎵</span>
      <input type="range" min={0} max={100} step={1} value={Math.round(volume * 100)} aria-label={ts("vol.aria")} onChange={(e) => setVolume(Number(e.target.value) / 100)} />
      <b aria-hidden="true">{Math.round(volume * 100)}%</b>
    </label>
  );
}
