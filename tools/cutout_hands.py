"""Ricava le mani alzate della copertina del regolamento (chroma-key del verde/cielo + rimozione materasso).
Uso: python3 tools/cutout_hands.py <dir_pdfimages>/i-000.png public/scene"""
import sys, json, numpy as np
from pathlib import Path
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
from scipy.signal import find_peaks
src, out = Path(sys.argv[1]), Path(sys.argv[2])
cov = Image.open(src).convert("RGB").crop((0, 540, 533, 800))
H, W = cov.size[1], cov.size[0]
hsv = np.asarray(cov.convert("HSV")).astype(float); h, s, v = hsv[..., 0]*360/255, hsv[..., 1]/255, hsv[..., 2]/255
bg = ((h > 45) & (h < 175) & (s > .16)) | ((h > 170) & (h < 265) & (s > .10)) | ((s < .14) & (v > .72))
bg |= (s > .64) & (h > 8) & (h < 52) & (v > .45)                      # materassi arancio/senape
yy, xx = np.mgrid[0:H, 0:W]
mask = (~bg) & ((yy >= 108) | (xx >= 445))
mask = ndi.binary_opening(mask, iterations=1)
lab, n = ndi.label(mask); sizes = ndi.sum(mask, lab, range(1, n+1))
mask = np.isin(lab, [i+1 for i, z in enumerate(sizes) if z > 250])
mask = ndi.binary_fill_holes(ndi.binary_closing(mask, iterations=2))
img = cov.copy(); img.putalpha(Image.fromarray((mask*255).astype("uint8")).filter(ImageFilter.GaussianBlur(.7)))
img = img.crop(img.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox())
# ritocchi: residui di pietra/torre e braccio con megafono tagliato (coordinate nell'immagine ritagliata)
a = np.array(img.getchannel("A"))
for x0, x1, y0, y1 in [(0, 150, 0, 230), (210, 232, 0, 66), (426, 452, 0, 116), (512, 531, 0, 230)]:
    a[y0:y1, x0:x1] = 0
img.putalpha(Image.fromarray(a))
img = img.crop(img.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox())
img.save(out/"hands_cut.webp", quality=94, method=6)
A = np.asarray(img.getchannel("A")) > 128
top = np.array([np.argmax(A[:, x]) if A[:, x].any() else A.shape[0] for x in range(A.shape[1])], float)
pk, _ = find_peaks(-ndi.uniform_filter1d(top, 7), prominence=10, distance=22)
tips = [[int(x), int(top[x])] for x in pk if top[x] < A.shape[0]-25]
json.dump({"size": list(img.size), "tips": tips}, open(out/"hands_cut.json", "w")); print(img.size, tips)
