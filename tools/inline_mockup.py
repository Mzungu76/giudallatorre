"""Rende un mockup HTML autonomo (immagini incorporate come data URI) pronto per la pubblicazione come Artifact.
Uso: python3 tools/inline_mockup.py b4|gallery"""
import re, sys, base64, json
from pathlib import Path
root = Path(__file__).resolve().parent.parent
def uri(p): return "data:image/webp;base64," + base64.b64encode((root/p).read_bytes()).decode()
which = sys.argv[1]
if which == "b4":
    src = (root/"mockups/wow/b4-caduta.html").read_text()
    imgs = {i: uri(f"public/cutouts/{i}.webp") for i in ["p05-i01","p05-i02","p05-i03","p05-i04","p05-i05","p05-i06","p05-i07","p05-i09"]}
    imgs["tower"] = uri("public/scene/tower_pop.webp"); imgs["hands"] = uri("public/scene/hands_cut.webp")
    src = src.replace("const CUT=id=>`../../public/cutouts/${id}.webp`;", "const CUT=id=>window.IMGS[id];")
    src = src.replace("'../../public/scene/tower_pop.webp'", "window.IMGS.tower")
    src = src.replace("window.IMGS?window.IMGS.hands:'../../public/scene/hands_cut.webp'", "window.IMGS.hands")
    out = root/"mockups/wow/dist/b4-artifact.html"
elif which == "mod":
    src = (root/"mockups/modifiche.html").read_text()
    ids = ["p05-i01","p05-i02","p05-i03","p05-i04","p05-i05","p05-i06","p05-i07","p05-i09"]
    imgs = {i: uri(f"public/cutouts/{i}.webp") for i in ids}
    imgs["tower"] = uri("public/scene/tower_pop.webp"); imgs["hands"] = uri("public/scene/hands_cut.webp")
    src = re.sub(r"window\.IMGS=window\.IMGS\|\|\(\(\)=>\{.*?\}\)\(\);\n", "", src, flags=re.S)
    out = root/"mockups/dist/modifiche-artifact.html"
elif which == "pop":
    src = (root/"mockups/pop.html").read_text()
    ids = ["p05-i01","p05-i02","p05-i03","p05-i04","p05-i05","p05-i06","p05-i07","p05-i09"]
    imgs = {i: uri(f"public/cutouts/{i}.webp") for i in ids}
    imgs.update({f"c-p03-i0{n}": uri(f"public/cards/p03-i0{n}.webp") for n in range(1, 6)})
    imgs["tower"] = uri("public/scene/tower_pop.webp"); imgs["hands"] = uri("public/scene/hands_cut.webp")
    for n in ["torre","torre8","lui","zoom","risultati","caduta","impatto","punti","punti8"]:
        imgs["proto-"+n] = uri(f"mockups/pop-assets/proto-{n}.webp")
    src = re.sub(r"/\*PATHS\*/.*?/\*ENDPATHS\*/", "const PATHS={};", src, flags=re.S)
    out = root/"mockups/dist/gallery-artifact.html"
else:
    src = (root/"mockups/index.html").read_text()
    ids = [f"p{p:02d}-i{i:02d}" for p, i in [(3,1),(3,2),(3,3),(3,4),(3,5),(5,1),(5,2),(5,3),(5,4),(5,5)]]
    imgs = {i: uri(f"public/cards/{i}.webp") for i in ids}
    src = src.replace("const C=(p,i)=>`../public/cards/p${String(p).padStart(2,'0')}-i${String(i).padStart(2,'0')}.webp`;", "const C=(p,i)=>window.IMGS['p'+String(p).padStart(2,'0')+'-i'+String(i).padStart(2,'0')];")
    out = root/"mockups/dist/gallery-artifact.html"
out.parent.mkdir(parents=True, exist_ok=True)
assert "../public" not in src and "../../public" not in src.replace("tools/", ""), "percorsi relativi residui"
# da documento completo a contenuto per l'Artifact (niente doctype/html/head/body)
title = re.search(r"<title>.*?</title>", src, re.S).group(0)
head_rest = re.sub(r"<title>.*?</title>", "", re.search(r"<head>(.*?)</head>", src, re.S).group(1), flags=re.S)
head_rest = re.sub(r"<meta charset[^>]*>|<meta name=\"viewport\"[^>]*>", "", head_rest)
body = re.search(r"<body>(.*)</body>", src, re.S).group(1)
body = body.replace("<script>", "<script>window.IMGS=" + json.dumps(imgs) + ";</script>\n<script>", 1)
head_rest = head_rest.replace("padding:20px;", "padding:20px max(16px,env(safe-area-inset-right,0px)) 20px max(16px,env(safe-area-inset-left,0px));", 1)
fit = "<script>(function(){var f=function(){var k=Math.min(1,(innerWidth-32)/390),p=document.querySelector('.phone');if(p)p.style.zoom=k};f();addEventListener('resize',f)})()</script>"
out.write_text(title + '\n<meta name="claude:viewport-fit-sides" content="cover">\n' + head_rest + "\n" + body + "\n" + fit)
print(out, round(out.stat().st_size/1024), "KB")
