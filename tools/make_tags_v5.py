"""Etichette nascoste per i bot sulle frasi del mazzo v5 (content/frasi-megafono.json).
Le frasi sono tratti di carattere o confronti, quindi le etichette si ricavano da parole chiave di tratto.
Personaggi: scritte a mano (content/tags-personaggi.json). Frasi v4: content/storico/tags-frasi-v4.json (make_tags.py).
Uso: python3 tools/make_tags_v5.py"""
import json, re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
# tipo umano: stesso vocabolario di tags-personaggi.json
TIPO = [
  (r"pigr|scansafatiche|fannulloni|lent[io]\b|senza fare niente|vivere senza lavorare", "pigro"),
  (r"vanit|narcis|vanesi|presuntuos|sbruffon|spaccon|fanfaron|arrogant|irresistibil|simpatic|anima della festa|oratore|genio", "vanitoso"),
  (r"tirch|avar|scrocc|spendacci|non pagherebbe|conto|prestito|prestare|soldi|euro|mancia", "avaro"),
  (r"bugiard|falsi|ipocrit|ment[ei]|inganna|imbroglion|fregare|furbett|paraculi|opportunist|ruffian|truff|corrott|subdol|viscid|manipolat|calcolat|infed|tradi|traditor|sleal", "bugiardo"),
  (r"furb|paracul|opportunist|ruffian|scrocc|approfitt|fare il furbo", "furbo"),
  (r"pettegol|sparl|spiffer|impicc|segret", "pettegolo"),
  (r"saccent|saputell|pedant|moralist|sentenzios|esperto di tutto|intelligente|genio incompreso|capire l.arte|ragione|ultima parola|bacchett", "saputello"),
  (r"rissos|nervos|permalos|polemic|rabbios|litig|scontros|brontol|intransigent|prepotent|vendicativ|rancoros|spietat|perdere la pazienza", "rabbioso"),
  (r"goff|svampit|distratt|smemorat|sbadat|chiavi|rompere|rovinerebbe|disordinat", "goffo"),
  (r"dramm|teatral|lament|lagnos|vittim|capricc|piang", "drammatico"),
  (r"social|telefono|messaggio|wi-fi|visualizzat|foto|selfie", "influencer"),
  (r"genitor|baby ?sitter|figli", "genitore"),
  (r"sport|partita|arbitro|squadra|montagna|campeggio|gita|sportivi", "sportivo"),
  (r"chiesa|\bmessa\b|religios|santarell|bigott|pregh|confess|funerale|natale|\bprete\b|\bfede\b", "religioso"),
  (r"complott|superstiz|sfortuna", "complottista"),
  (r"politic|elezion|governo|corrott", "politico"),
  (r"capo|ufficio|lavor|collega|carriera|aumento|socio|promozione|curriculum|azienda|arrivist", "lavoratore"),
  (r"ribell|regole", "ribelle"),
  (r"bere|bevut|ubriac|alcol|drink|bicchier", "eccentrico"),
  # tratti più astratti: assegnati al tipo umano più vicino del vocabolario dei personaggi
  (r"antipatic|maleducat|dispettos|sfacciat|tirannic|impulsiv|invidios|gelos|possessiv|pretenzios|rompiscatole|odiano il prossimo|trattano male|non cederebbe il posto|ti lascerebbe a piedi", "rabbioso"),
  (r"egoist|al centro dell.attenzione|piacere a tutti|nessun difetto|insostituibil|guidare meglio|sempre nel giusto|mondo giri intorno|parlano solo di s[eé]|meritare di pi|vantano|ridono alle proprie|viziat|spudorat|modest|perfettin|sempre ringraziato|salvare s[eé] stesso|salvarsi|prima fila|smielat|sdolcinat", "vanitoso"),
  (r"io l.avevo detto|consigli che nessuno|la morale|sanno sempre tutto|correggono|opinione sia un fatto|unico a capire|pignol|maniaci del controllo|spoiler|sempre ragione|non ammett|testard|umilt", "saputello"),
  (r"non sono stato io|colpa agli altri|scarica|cambiano idea|non mantengono|inaffidabil|gentili solo|a parole|\bpuri\b|onesti|fedeli|casti|innocenti|devoti|buoni|fare i bravi|solo quando|per interesse|pugnalano|è solo un.amicizia|non è colpa mia|scostant|sparirebbe senza|sparirebbe per settimane|mollerebbe", "bugiardo"),
  (r"ritard|puntual|impegnati|quando c.è da pulire|quando c.è da aiutare|spariscono quando|non risponderebbe", "pigro"),
  (r"ingenu|ansios|sbagliano sempre il tuo nome|rovinare una sorpresa|rumoros|codard|vigliacc", "goffo"),
  (r"chiacchieron|non sanno stare zitti|ce l.abbiano con lui|problema sia il pi|sentire in colpa|si offendono|scenata|raccontano sempre la stessa|noios", "drammatico"),
  (r"offrono mai un caff|mani vuote|comprando in offerta|comprano gli amici|autoinvit|ingord|non offr", "avaro"),
  (r"libertin|lussurios|vizios|dissolut|morbos|spogli|conquiste|flirt|avventura|ci provano|romantic|quando bevono|nuova fiamma", "eccentrico"),
  (r"non rispettano la fila|cinici|chiedono mai scusa|vigile|rubare il posto|chiedere scusa|fila\b", "ribelle"),
]
TEMI = [
  (r"soldi|euro|prestit|mancia|conto|eredit|tasse|pagare|costo", "soldi"),
  (r"amor|partner|fidanzat|\bex\b|cotta|letto|bacia|nuda|nudo", "amore"),
  (r"lavor|capo|ufficio|collega|carriera|promozione|aumento|socio", "lavoro"),
  (r"social|telefono|messaggio|wi-fi|visualizzat|foto", "social"),
  (r"chiesa|\bmessa\b|\bprete\b|funerale|natale|confess|religios", "religione"),
  (r"famiglia|genitor|parent|cognato|suocer", "famiglia"),
  (r"festa|cena|matrimonio|nozze|compleanno|ospite", "feste"),
  (r"viaggio|vacanza|campeggio|montagna|gita|autista|ombrellone", "viaggio"),
  (r"cuoc|cucina|mangiare|torta|fetta|pizza|pranzo", "cibo"),
  (r"bere|bevut|ubriac|alcol|drink", "alcol"),
  (r"segret|sparl|tradi|bugia|ment", "bugie"),
]
def tag(text):
    t = text.lower(); tipo, temi = [], []
    for rx, v in TIPO:
        if re.search(rx, t) and v not in tipo: tipo.append(v)
    for rx, v in TEMI:
        if re.search(rx, t) and v not in temi: temi.append(v)
    return {"tipo": tipo[:3], "temi": temi[:4]}
data = json.load(open(ROOT / "content/frasi-megafono.json"))["frasi"]
out = {}
for f in data:
    full = f"Oggi {f['verbo']} sulla torre {f['testo']}"
    out[full] = tag(f["testo"])
json.dump(out, open(ROOT / "content/tags-frasi.json", "w"), ensure_ascii=False, indent=0)
print(len(out), "frasi;", sum(1 for v in out.values() if not v["tipo"]), "senza tipo;", sum(1 for v in out.values() if not v["temi"]), "senza temi")
