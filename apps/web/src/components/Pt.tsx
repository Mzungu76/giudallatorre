/** L'icona dei punti: una stella dorata. Sta sempre accanto al numero, così si capisce che quel numero sono punti. */
export const PtIcon = ({ s }: { s?: number }) => <i className="pt-ic" style={s ? { width: s, height: s } : undefined} aria-hidden />;

/** Un numero di punti con la sua icona: «★ +2». Una stringa (es. «+5…16», «voti») si mostra com'è. */
export function Pt({ n, plus = true, className = "" }: { n: number | string; plus?: boolean; className?: string }) {
  const v = typeof n === "number" ? (n < 0 ? `−${-n}` : plus ? `+${n}` : String(n)) : n;
  return <span className={`pt ${className}`} aria-label={`${v} punti`}><PtIcon /><b>{v}</b></span>;
}
