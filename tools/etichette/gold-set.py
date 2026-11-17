#!/usr/bin/env python3
"""Genera i casi della «prova del nove»: 100 frasi vere, ognuna con 5 carte a caso (seme fisso, quindi ripetibile).
Il proprietario indica per ogni caso la carta che voterebbe il gruppo e le altre plausibili; le risposte servono a misurare i bot sull'associazione frase–carta.
Uso: python3 tools/etichette/gold-set.py   -> content/etichette/gold/casi.json (solo id di frasi e carte: nessuna etichetta)."""
import json, os, random
R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
fr = json.load(open(f"{R}/content/frasi-megafono.json"))["frasi"]
cards = [c for c in json.load(open(f"{R}/content/tags-personaggi.json")) if os.path.exists(f"{R}/public/cards/{c}.webp")]
rnd = random.Random(20261115)
ph = rnd.sample(fr, 100)
casi = [{"id": f"c{i+1:03d}", "frase": p["id"], "testo": f"Oggi {p['verbo']} sulla torre {p['testo']}", "carte": rnd.sample(cards, 5)} for i, p in enumerate(ph)]
os.makedirs(f"{R}/content/etichette/gold", exist_ok=True)
json.dump({"versione": 1, "seme": 20261115, "casi": casi}, open(f"{R}/content/etichette/gold/casi.json", "w"), ensure_ascii=False, indent=1)
print(len(casi), "casi;", len({c for k in casi for c in k['carte']}), "carte diverse")
