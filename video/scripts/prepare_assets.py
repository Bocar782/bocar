"""Prépare les assets dérivés : wordmark détouré depuis l'image OG officielle, texture de grain."""
import numpy as np
from PIL import Image
from pathlib import Path

root = Path(__file__).resolve().parent.parent
og = np.asarray(Image.open(root.parent / "src/app/opengraph-image.png").convert("RGB")).astype(np.float32) / 255

def extract(box, out):
    x0, y0, x1, y1 = box
    crop = og[y0:y1, x0:x1]
    # Fond estimé par la médiane des bords, puis alpha par luminance au-dessus du fond.
    border = np.concatenate([crop[:3].reshape(-1, 3), crop[-3:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    diff = np.clip(crop - bg, 0, 1)
    alpha = np.clip(diff.max(axis=2) / 0.85, 0, 1)
    alpha = np.clip((alpha - 0.04) / 0.96, 0, 1)
    rgb = np.where(alpha[..., None] > 0.001, np.clip(diff / np.maximum(alpha[..., None], 1e-3), 0, 1), 0)
    img = np.dstack([rgb, alpha])
    Image.fromarray((img * 255).astype(np.uint8), "RGBA").save(root / "public/brand" / out)
    print(out, crop.shape)

extract((250, 352, 955, 446), "tavyra-wordmark.png")

rng = np.random.default_rng(7)
n = rng.normal(0.5, 0.18, (512, 512))
Image.fromarray((np.clip(n, 0, 1) * 255).astype(np.uint8), "L").save(root / "public/grain.png")
