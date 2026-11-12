/**
 * Le icone dei motivi dei punti, nello stile delle illustrazioni: tondo con bordo blu notte spesso, colori pieni e un riflesso chiaro.
 * target = voto giusto · bolt = il più veloce · card = carta propria · hand = Lui! · flag = obiettivo.
 */
export type Reason = "target" | "bolt" | "card" | "hand" | "flag";
const NV = "#13224a", W = 2.4;

function Body({ k }: { k: Reason }) {
  switch (k) {
    case "target": return (<>
      <circle cx="16" cy="16" r="13" fill="#e8362b" stroke={NV} strokeWidth={W} />
      <circle cx="16" cy="16" r="8.4" fill="#fff7e0" stroke={NV} strokeWidth="1.6" />
      <circle cx="16" cy="16" r="4.2" fill="#e8362b" stroke={NV} strokeWidth="1.6" />
      <path d="M6 7.5A12 12 0 0 1 12 4.4" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".7" />
    </>);
    case "bolt": return (<>
      <circle cx="16" cy="16" r="13" fill="#ffc72c" stroke={NV} strokeWidth={W} />
      <path d="M18.6 4.8 9.4 17.6h5.6l-2 9.6 9.6-13.4h-5.8z" fill="#fff7e0" stroke={NV} strokeWidth="2" strokeLinejoin="round" />
      <path d="M6 8A12 12 0 0 1 11 4.6" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".7" />
    </>);
    case "card": return (<>
      <circle cx="16" cy="16" r="13" fill="#14a3a1" stroke={NV} strokeWidth={W} />
      <g transform="rotate(-12 16 16)"><rect x="9.6" y="6.4" width="12.8" height="19.2" rx="2.4" fill="#fff7e0" stroke={NV} strokeWidth="2" />
        <rect x="12" y="9" width="8" height="9" rx="1.2" fill="#ff9f2e" stroke={NV} strokeWidth="1.3" /><path d="M12.4 21.6h7.2" stroke={NV} strokeWidth="1.8" strokeLinecap="round" /></g>
    </>);
    case "hand": return (<>
      <circle cx="16" cy="16" r="13" fill="#ff9f2e" stroke={NV} strokeWidth={W} />
      <path d="M6.2 14.2h8.6c.6-1.6 3.4-1.6 3.4 0h1.2c1.9 0 3.4 1.5 3.4 3.4v1.6c0 2.4-1.9 4.3-4.3 4.3h-5.2c-1.7 0-3.2-1-3.9-2.6l-2.6-4.2c-.7-1.1-.3-2.5.9-2.5z" fill="#fff7e0" stroke={NV} strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M15 17.4v3" stroke={NV} strokeWidth="1.5" strokeLinecap="round" />
    </>);
    case "flag": return (<>
      <circle cx="16" cy="16" r="13" fill="#4a7bd8" stroke={NV} strokeWidth={W} />
      <path d="M11.4 25V7.2" stroke={NV} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M12.4 7.8c3.2-1.8 5.8 1.8 9.6 0v8.2c-3.8 1.8-6.4-1.8-9.6 0z" fill="#fff7e0" stroke={NV} strokeWidth="2" strokeLinejoin="round" />
      <path d="M14.4 10.4c1.8-.8 3.2.4 5 .4" stroke="#e8362b" strokeWidth="2" strokeLinecap="round" fill="none" />
    </>);
  }
}

export function ReasonIcon({ k, s = 20, className = "" }: { k: Reason; s?: number; className?: string }) {
  return <svg className={`rsn ${className}`} viewBox="0 0 32 32" width={s} height={s} aria-hidden><Body k={k} /></svg>;
}
