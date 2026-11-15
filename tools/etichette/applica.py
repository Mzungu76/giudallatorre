#!/usr/bin/env python3
"""Applica le decisioni scaricate da /etichette.html alle passate e rigenera i file v2.
Uso: python3 tools/etichette/applica.py decisioni-etichette-frasi.json   (o ...-personaggi.json)
"""
import json, sys, os, re, subprocess
R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
d = json.load(open(sys.argv[1])); kind = d["tipo"]; dec = {k: v for k, v in d["decisioni"].items() if v != "ok"}
path = f"{R}/content/etichette/passate/{'frasi' if kind == 'frasi' else 'carte'}.A.txt"
fmt = lambda m: " ".join(f"{k}{w}" for k, w in m.items())
rows = []
for l in open(path):
    l = l.rstrip("\n")
    if not l: continue
    i, t, m = l.split("|")
    if i in dec: l = f"{i}|{fmt(dec[i]['tipi'])}|{fmt(dec[i]['temi'])}"
    rows.append(l)
open(path, "w").write("\n".join(rows) + "\n")
print(len(dec), "etichette modificate in", os.path.basename(path))
subprocess.run([sys.executable, f"{R}/tools/etichette/consenso.py"], check=True)
