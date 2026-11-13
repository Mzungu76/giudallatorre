/**
 * Le icone dei motivi dei punti: piccole scene nello stile delle illustrazioni (bordo blu notte, colori pieni).
 * target = voto giusto (la carta cade) · bolt = il voto più veloce · card = la tua carta cade · hand = il segnalino Lui! (anche per chi lo ha seguito)
 * · flag = obiettivo centrato.
 */
export type Reason = "target" | "bolt" | "card" | "hand" | "flag";
const NV = "#13224a", st = { stroke: NV, strokeLinejoin: "round", strokeLinecap: "round" } as const;

const Card = ({ x = 9, y = 6, w = 26, h = 34, rot = 0, ring = false, tint = false }: { x?: number; y?: number; w?: number; h?: number; rot?: number; ring?: boolean; tint?: boolean }) => (
  <g transform={`rotate(${rot} ${x + w / 2} ${y + h / 2})`}>
    <rect x={x} y={y} width={w} height={h} rx="3" fill="#fff7e0" {...st} strokeWidth="2.2" />
    <rect x={x + 3} y={y + 3} width={w - 6} height={h - 9} rx="1.5" fill="#f1c27d" stroke={NV} strokeWidth="1.2" />
    <circle cx={x + w / 2} cy={y + h * 0.38} r={w * 0.17} fill="#13224a55" /><path d={`M${x + w * 0.22} ${y + h * 0.78}q${w * 0.28} -${h * 0.3} ${w * 0.56} 0z`} fill="#13224a55" />
    {tint && <rect x={x} y={y} width={w} height={h} rx="3" fill="#e8362b66" />}
    {ring && <rect x={x} y={y} width={w} height={h} rx="3" fill="none" stroke="#ffc72c" strokeWidth="3.4" />}
  </g>
);
const Arrow = ({ x, y, s }: { x: number; y: number; s: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s / 60})`}><path d="M18 2h24v34h14L30 66 4 36h14z" fill="#e8362b" stroke="#fff" strokeWidth="5" strokeLinejoin="round" /><path d="M18 2h24v34h14L30 66 4 36h14z" fill="none" stroke={NV} strokeWidth="2.4" strokeLinejoin="round" /></g>
);
const Check = ({ cx, cy, r = 9 }: { cx: number; cy: number; r?: number }) => (
  <><circle cx={cx} cy={cy} r={r} fill="#2fbf6a" {...st} strokeWidth="2" /><path d={`M${cx - r * 0.45} ${cy}l${r * 0.3} ${r * 0.35}l${r * 0.6} -${r * 0.7}`} fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></>
);

function Body({ k }: { k: Reason }) {
  switch (k) {
    case "target": return (<><Card tint x={7} y={5} /><Arrow x={13} y={17} s={22} /><Check cx={36} cy={36} /></>);
    case "bolt": return (<>
      <circle cx="24" cy="27" r="15" fill="#fff7e0" {...st} strokeWidth="2.6" /><rect x="20" y="5" width="8" height="5" rx="1.5" fill="#e8362b" {...st} strokeWidth="2" />
      <g transform="translate(15 18) scale(.56)"><path d="M18.6 4.8 9.4 17.6h5.6l-2 9.6 9.6-13.4h-5.8z" fill="#ffc72c" stroke={NV} strokeWidth="2.6" strokeLinejoin="round" /></g>
      <circle cx="38" cy="10" r="8" fill="#ffc72c" {...st} strokeWidth="2" /><text x="38" y="14" textAnchor="middle" fontFamily="Anton, Impact, sans-serif" fontSize="11" fill={NV}>1°</text></>);
    case "card": return (<><Card ring x={8} y={8} /><Arrow x={16} y={22} s={20} /><path d="M36 2l2.4 5 5.4.7-4 3.7 1 5.4-4.8-2.7-4.8 2.7 1-5.4-4-3.7 5.4-.7z" transform="translate(-2 0)" fill="#ffc72c" {...st} strokeWidth="1.8" /></>);
    case "hand": return <image href="/lui-coperto.png" x="1" y="1" width="46" height="46" />;
    case "flag": return (<><Card x={6} y={10} w={24} h={32} /><path d="M32 42V4" stroke={NV} strokeWidth="3.2" strokeLinecap="round" /><path d="M33 5c6-3 10 3 14 0v12c-4 3-8-3-14 0z" fill="#e8362b" {...st} strokeWidth="2.2" /></>);
  }
}

export function ReasonIcon({ k, s = 20, className = "" }: { k: Reason; s?: number; className?: string }) {
  return <svg className={`rsn ${className}`} viewBox="0 0 48 48" width={s} height={s} aria-hidden><Body k={k} /></svg>;
}
