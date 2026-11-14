/** Etichette nascoste (mai inviate ai client) che i giocatori virtuali usano per "capire" quanto un personaggio c'entra con una frase. */
export interface TagSet { tipo: string[]; temi: string[] }
let CARDS: Record<string, TagSet> = {}, PHRASES: Record<string, TagSet> = {};

/** Registra le etichette dei personaggi (per id carta) e delle frasi (per testo). Il Worker lo fa all'avvio; i test con mazzi finti non lo chiamano. */
export function registerTags(cards: Record<string, TagSet>, phrases: Record<string, TagSet>): void { CARDS = cards; PHRASES = phrases; buildLexicon(); }

// ---------- frasi nuove: le etichette si deducono dalle parole ----------
// Per le frasi inventate dal Megafono non ci sono etichette scritte a mano: dalle ~400 frasi etichettate si impara quali parole (radici) vanno con quali
// etichette, e il testo nuovo si etichetta di conseguenza. È un buon senso approssimativo (le parole-chiave: «soldi», «bugie», «festa»…), non una comprensione vera.
const STOP = new Set("sale salgono sulla torre oggi troppo tutto chi che con per una uno degli delle dello delle nella nelle sono come piu piu anche questo questa quelli quelle tutti tutte loro suo sua suoi sue sempre molto dopo prima ogni cosa cose essere fare fatto".split(" "));
const stems = (text: string): string[] => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 4 && !STOP.has(w)).map((w) => w.slice(0, 5));
/** Radici di parole-chiave per ogni etichetta: danno un punto di partenza al lessico (le frasi etichettate sono poche). */
const SEED: Record<string, string> = {
  "m:soldi": "soldi sold ricco ricch pover pagar spend spese costo costos banca conto lusso affar tasse mance prest",
  "m:bugie": "bugia bugie bugi mente mentir menzo finto finge fingere falso imbro trucc segreto nascon scus giura",
  "m:amore": "amore amare ament fidanz moglie marito ragaz bacio bacia sesso cotta tradi tradim relaz coppia matrim flirt",
  "m:lavoro": "lavor ufficio capo collega stipend carriera riunio turno cliente azienda dipend",
  "m:feste": "festa feste party disco balla ballo serata compleanno nottata brind",
  "m:religione": "chiesa prega prete messa dio fede santo madonna suora paradiso inferno",
  "m:alcol": "beve bere bevuto birra vino ubria sbornia alcol cocktail aperitivo brindi",
  "m:cibo": "mangia mangi cibo pranzo cena cuoco cucina pizza dolce torta panino dieta fame",
  "m:famiglia": "famiglia madre padre mamma papa nonno nonna fratello sorella figlio figli genitori suocer zio cugino",
  "m:social": "social selfie foto instag tiktok follower like storie post video web chat messaggio telefono",
  "m:viaggio": "viaggio viaggi vacanza vacanze aereo valigia hotel spiaggia mare turista",
  "p:avaro": "avaro avara spilorcio tirchio soldi sold risparmia",
  "p:bugiardo": "bugiardo mente bugie finto falso imbroglia",
  "p:vanitoso": "vanitoso vanto narcis specchio bello belli moda vestiti selfie",
  "p:rabbioso": "rabbia arrabbia urla litiga nervoso furioso insulta",
  "p:pigro": "pigro pigra divano dorme poltrone svogliato ritardo",
  "p:pettegolo": "pettegolo gossip sparla spettegola chiacchiere voci",
  "p:sportivo": "sport palestra corre corsa calcio muscoli allena",
  "p:religioso": "religioso chiesa prega fede",
  "p:politico": "politico politica elezioni voto partito governo",
  "p:lavoratore": "lavora lavoro ufficio capo",
  "p:genitore": "genitore genitori madre padre figli mamma papa",
  "p:influencer": "influencer follower social selfie video",
  "p:complottista": "complotto complotti segreti sospetta teoria",
  "p:furbo": "furbo furbizia truffa trucco scorciatoia",
  "p:goffo": "goffo inciampa cade impacciato maldestro",
  "p:drammatico": "drammatico dramma piange pianto scena esagera",
  "p:eccentrico": "eccentrico strano bizzarro matto originale",
  "p:ribelle": "ribelle trasgressivo regole infrange",
  "p:saputello": "saputello sapiente sa tutto spiega correzione professore",
};
let LEX: Map<string, Map<string, number>> = new Map(), DF: Map<string, number> = new Map(), NDOC = 1;
function buildLexicon(): void {
  LEX = new Map(); DF = new Map(); NDOC = 1;
  for (const [tag, words] of Object.entries(SEED)) for (const w of stems(words)) { const m = LEX.get(w) ?? new Map(); LEX.set(w, m); m.set(tag, (m.get(tag) ?? 0) + 2); DF.set(w, Math.max(DF.get(w) ?? 0, 1)); }
  for (const [text, ts] of Object.entries(PHRASES)) {
    NDOC++; const tags = [...ts.tipo.map((t) => `p:${t}`), ...ts.temi.map((t) => `m:${t}`)], seen = new Set<string>();
    for (const w of stems(text)) { if (!seen.has(w)) { seen.add(w); DF.set(w, (DF.get(w) ?? 0) + 1); } const m = LEX.get(w) ?? new Map(); LEX.set(w, m); for (const t of tags) m.set(t, (m.get(t) ?? 0) + 1); }
  }
}
/** Etichette dedotte da un testo libero, oppure `null` se nessuna parola è nota. `exclude`: testo da non usare nell'apprendimento (per la verifica). */
export function inferTags(text: string, minScore = 0.55): TagSet | null {
  const score = new Map<string, number>(); let known = 0;
  for (const w of new Set(stems(text))) {
    const m = LEX.get(w); if (!m) continue; known++;
    const df = DF.get(w) ?? 1, idf = Math.log(NDOC / df), tot = [...m.values()].reduce((a, b) => a + b, 0);
    for (const [t, c] of m) score.set(t, (score.get(t) ?? 0) + (c / tot) * idf * Math.min(1, df / 2));
  }
  if (!known) return null;
  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1]), top = ranked[0]?.[1] ?? 0, keep = ranked.filter(([, v]) => v >= Math.max(minScore, top * 0.6));
  const tipo = keep.filter(([t]) => t.startsWith("p:")).slice(0, 2).map(([t]) => t.slice(2)), temi = keep.filter(([t]) => t.startsWith("m:")).slice(0, 2).map(([t]) => t.slice(2));
  return tipo.length + temi.length ? { tipo, temi } : null;
}

/** Affinità tra un personaggio e una frase: temi in comune ×2, tipo umano in comune ×3. `null` se mancano le etichette. */
export function affinity(cardId: string, phraseText: string): number | null {
  const c = CARDS[cardId], p = PHRASES[phraseText] ?? inferTags(phraseText); if (!c || !p) return null;
  let a = 0; for (const t of p.temi) if (c.temi.includes(t)) a += 2; for (const t of p.tipo) if (c.tipo.includes(t)) a += 3; return a;
}
export const phraseTagCount = (text: string): number => { const p = PHRASES[text]; return p ? p.temi.length + p.tipo.length : 0; };
