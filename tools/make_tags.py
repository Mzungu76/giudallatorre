"""Etichette nascoste per i bot: temi e tipi umani di personaggi e frasi.
Personaggi: scritte a mano (content/tags-personaggi.json). Frasi: derivate dal contesto + parole chiave (questo script)."""
import json, re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
CTX = {"In bagno":["corpo","casa"],"In pubblico":["imbarazzo"],"Al ristorante":["cibo"],"Sui mezzi e in ascensore":["mezzi"],"Alle cerimonie":["feste","famiglia","religione"],
"Dai parenti":["famiglia","casa","cibo"],"In amore":["amore"],"In ufficio":["lavoro"],"In palestra":["sport","corpo"],"Al mare":["viaggio","corpo"],"Sul telefono":["tecnologia","social"],
"In condominio":["casa"],"Fai-da-te":["faidate","casa"],"Con animali e piante":["animali","natura"],"In cucina":["cibo","casa"],"Di notte":["notte","casa"],"Alle feste":["feste"],
"A scuola":["scuola"],"Dal dottore":["salute","corpo"],"Dal parrucchiere":["vanita","moda"],"In auto":["mezzi","legge"],"Nei negozi":["soldi","moda"],"Agli sportelli":["legge","soldi"],
"In viaggio":["viaggio","mezzi"],"Dopo qualche bicchiere":["alcol","notte","feste"],"Sul divano":["pigrizia","casa","tecnologia"],"Bugie e scuse":["bugie"],"Segreti":["bugie","imbarazzo"],
"Superstizioni":["superstizione","religione"],"Tifo":["sport","rabbia"],"Con la tecnologia":["tecnologia"],"Tra meteo e vestiti":["moda","natura"],"Con l’ex":["amore","social"],
"Allo specchio":["vanita","moda"],"Con i soldi":["soldi"],"Da genitori":["famiglia","bambini"],"Dai nonni":["vecchiaia","famiglia"],"In chiesa":["religione"],"Politica da bar":["politica","rabbia"],
"Al cinema e in tv":["spettacolo","cultura"],"Musica e karaoke":["musica","spettacolo"],"In campagna":["natura","animali"],"In gita":["natura","viaggio","sport"],"Con i bambini":["bambini","famiglia","imbarazzo"],
"In hotel":["viaggio","soldi"],"Al trasloco":["casa","faidate"],"Lavoro da casa":["lavoro","tecnologia","casa"],"Feste a sorpresa":["feste","famiglia"],"Nei sogni":["notte","curiosita"],
"Momenti di genio":["tecnologia","imbarazzo","casa"],"Alle poste":["legge","lavoro"],"Al cinema":["spettacolo"],"A tavola":["cibo"],"Ai regali":["feste","soldi"]}
KW_TEMI = [(r"prete|chiesa|messa|papa|croce|madonna|\bdio\b|santo|suora|vescovo|crocifisso|esorcist|benedi|cero\b|confess|preghi|pregat|paradiso|purgatorio|ostia|acqua santa","religione"),
(r"capo|ufficio|riunione|collega|team|preventivo|mail","lavoro"),(r"suocer|\bzia\b|nonn[oi]|cugin|parenti","famiglia"),(r"nonn|vecchi|dentiera|bastone","vecchiaia"),
(r"bambin|figli[oa]?\b|maestra|asilo","bambini"),(r"gatto|cane|criceto|pesce|gallina|maiale|pianta|orso","animali"),
(r"telefono|selfie|like|follower|diretta|vocale|messaggio|siri|wifi|computer|password|schermo|foto","tecnologia"),(r"follower|selfie|like|storia|diretta|tagg","social"),
(r"palestra|manubrio|tapis|bilanciere|allena","sport"),(r"cacca|bidet|scoreggi|rutto|bagno|water|sbav|vomit|mutand","corpo"),(r"sconto|mancia|conto|euro|pagat|soldi|\bresto\b|moneta","soldi"),
(r"vino|brindisi|bicchier|birra|ubriac","alcol"),(r"\bex\b|bacio|baciat|fidanzat|sposa|sposi|amore|ti amo","amore"),(r"arbitro|squadra|gol\b|rigore|tifo","sport"),
(r"elezion|governo|votat|politic|comizio|paese|tasse","politica"),(r"poste|sportello|contratto|multa|autovelox|vigile|tribunale|catasto|giur","legge"),
(r"karaoke|concerto|canzone|chitarra|cantat","musica"),(r"film|sala|cinema|serie|teatro","spettacolo"),(r"notte|sonno|sogn|russ","notte"),(r"treno|autobus|tram|auto\b|macchina|ascensore|parcheggi","mezzi"),
(r"mentit|\bbugi[ae]\b|scusa|finto|giurato|nonna morta","bugie"),(r"spiat|pettegol|segreto","pettegolo")]
KW_TIPO = [(r"dato la colpa|dispetto|nascosto|di nascosto|sconto","furbo"),(r"urlat|insultat|offes|rabbi","rabbioso"),(r"mentit|\bbugi[ae]\b|finto|scusa|nonna morta|giurato","bugiardo"),
(r"sconto|risparmi|monetine|\bresto\b|spiccioli","avaro"),(r"selfie|filtro|specchio|follower|foto","vanitoso"),(r"divano|letto|dormit|sveglie|telecomando","pigro"),
(r"prete|papa|croce|pregat|santo|suora|messa|vescovo|benedi","religioso"),(r"pianto|pianto|svenir|dramm|lacrime","drammatico"),(r"inciampat|caduto|sbagli|per sbaglio|scivolata|chiuso fuori","goffo"),
(r"complott|nasa|stagnola","complottista"),(r"spoiler|corregg|spiega|fa le prediche","saputello"),(r"promess|elezion|governo|comizio","politico"),(r"nonn[oi]|vecchi","vecchio"),
(r"figli[oa]?\b|bambin","genitore"),(r"suocer|\bzia\b|parent","genitore"),(r"karaoke|concerto|palco|canta","artista"),(r"palestra|manubrio|tapis|bilanciere","sportivo"),(r"computer|wifi|password|schermo","nerd")]
def tag(text, ctx):
    t = text.lower(); temi = list(CTX.get(ctx, [])); tipo = []
    for rx, v in KW_TEMI:
        if re.search(rx, t) and v not in temi: temi.append(v)
    for rx, v in KW_TIPO:
        if re.search(rx, t) and v not in tipo: tipo.append(v)
    return {"tipo": tipo[:3], "temi": temi[:5]}
d = json.load(open(ROOT / "content/su-sulla-torre.json"))
out = {}
for c in d["carte"]:
    for f, x in zip(c["frasi"], c["contesti"]): out[f] = tag(f, x)
json.dump(out, open(ROOT / "content/tags-frasi.json", "w"), ensure_ascii=False, indent=0)
print(len(out), sum(1 for v in out.values() if not v["temi"]), "senza temi;", sum(1 for v in out.values() if not v["tipo"]), "senza tipo")
