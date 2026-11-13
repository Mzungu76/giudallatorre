import { MEGA_INNER } from "../scene/megaIcon.ts";

/** L'icona del Megafono (sempre la stessa, ovunque serva): vedi `scene/megaIcon.ts`. */
export const MegaIcon = ({ s = 22, className = "" }: { s?: number; className?: string }) => (
  <svg className={`mgi ${className}`} viewBox="0 0 32 32" width={s} height={s} aria-hidden dangerouslySetInnerHTML={{ __html: MEGA_INNER }} />
);
