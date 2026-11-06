"""Scontorna i personaggi delle carte (derivati; gli originali non vengono toccati).
Uso: python3 tools/cutout_cards.py public/cards public/cutouts
Modello: rembg 'isnet-general-use' (open source, gratuito) + pulizia dell'alpha (buchi, polvere).
Output: <id>.webp RGBA + cutouts-report.json (controllo qualità: componenti, bordo toccato)."""
import sys, json
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
from rembg import remove, new_session
src, out = Path(sys.argv[1]), Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
ss = new_session("isnet-general-use")
man = json.load(open(src/"manifest.json")); rep = []
for m in man:
    if "file" not in m: continue
    im = Image.open(src/m["file"]).convert("RGB")
    a = np.asarray(remove(im, session=ss, only_mask=True))
    mask = a > 110
    lab, n = ndi.label(mask)
    if n:
        sizes = ndi.sum(mask, lab, range(1, n+1)); keep = [i+1 for i, s in enumerate(sizes) if s > 0.02*sizes.max()]
        mask = np.isin(lab, keep)
    mask = ndi.binary_closing(mask, iterations=3)
    mask = ndi.binary_fill_holes(mask)
    soft = Image.fromarray((mask*255).astype("uint8")).filter(ImageFilter.GaussianBlur(0.9))
    rgba = im.copy(); rgba.putalpha(soft)
    bbox = rgba.getchannel("A").point(lambda v: 255 if v > 128 else 0).getbbox()
    rgba = rgba.crop(bbox)
    rgba.save(out/m["file"], quality=94, method=6)
    H, W = mask.shape
    rep.append({"id": m["id"], "components": int(len(keep)) if n else 0, "area_pct": round(100*mask.mean(), 1),
                "touches_edge": bool(mask[0].any() or mask[:, 0].any() or mask[:, -1].any()), "bbox": list(bbox), "size": list(rgba.size)})
json.dump(rep, open(out/"cutouts-report.json", "w"), indent=1)
print(len(rep), "scontornate")
