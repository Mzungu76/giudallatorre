"""Ricava le mani alzate dall'immagine fornita dall'utente (docs/source-materials/originals/mani_utente.png,
derivata dalla copertina del regolamento): chroma-key dell'erba verde, pulizia e rilevamento delle punte.
Uso: python3 tools/cutout_hands.py docs/source-materials/originals/mani_utente.png public/scene"""
import sys, json, numpy as np
from pathlib import Path
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
from scipy.signal import find_peaks
src, out = Path(sys.argv[1]), Path(sys.argv[2])
im = Image.open(src).convert("RGBA"); a0 = np.asarray(im.getchannel("A")) > 128
rgb = im.convert("RGB"); H, W = a0.shape
hsv = np.asarray(rgb.convert("HSV")).astype(float); h, s, v = hsv[..., 0]*360/255, hsv[..., 1]/255, hsv[..., 2]/255
green = (h > 60) & (h < 175) & (s > .16)
mask = a0 & ~green
# residui arancio dei materassi (saturazione molto alta) e piccoli frammenti
mask &= ~((s > .66) & (h > 8) & (h < 52) & (v > .45))
mask = ndi.binary_opening(mask, iterations=1)
lab, n = ndi.label(mask); sizes = ndi.sum(mask, lab, range(1, n+1))
mask = np.isin(lab, [i+1 for i, z in enumerate(sizes) if z > 600])
mask = ndi.binary_fill_holes(ndi.binary_closing(mask, iterations=2))
rg = im.convert("RGB"); rg.putalpha(Image.fromarray((mask*255).astype("uint8")).filter(ImageFilter.GaussianBlur(.9)))
rg = rg.crop(rg.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox())
rg.save(out/"hands_cut.webp", quality=94, method=6)
A = np.asarray(rg.getchannel("A")) > 128
top = np.array([np.argmax(A[:, x]) if A[:, x].any() else A.shape[0] for x in range(A.shape[1])], float)
pk, _ = find_peaks(-ndi.uniform_filter1d(top, 15), prominence=25, distance=50)
tips = [[int(x), int(top[x])] for x in pk if top[x] < A.shape[0]-60]
json.dump({"size": list(rg.size), "tips": tips}, open(out/"hands_cut.json", "w")); print(rg.size, tips)
