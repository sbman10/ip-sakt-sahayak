from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont


src = Path(r"C:\Users\thaku\AppData\Local\Temp\codex-clipboard-7fc1676f-9a9f-4e62-879d-594895adaf36.png")
dst = Path(r"C:\Users\thaku\Desktop\26045\ragvyn-ayurvedic-ipr-hero.png")

img = cv2.imread(str(src), cv2.IMREAD_COLOR)
if img is None:
    raise SystemExit(f"Could not read source image: {src}")

# Remove only the dark lettering in the two requested regions using inpainting.
mask = np.zeros(img.shape[:2], dtype=np.uint8)
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

def mark_dark(x1, y1, x2, y2, threshold=125):
    region = gray[y1:y2, x1:x2]
    dark = (region < threshold).astype(np.uint8) * 255
    # Small dilation covers anti-aliased text edges without affecting nearby UI.
    kernel = np.ones((3, 3), np.uint8)
    dark = cv2.dilate(dark, kernel, iterations=1)
    mask[y1:y2, x1:x2] = np.maximum(mask[y1:y2, x1:x2], dark)


mark_dark(336, 56, 430, 86, 150)     # Haven wordmark text only
mark_dark(285, 392, 1015, 493, 145)  # Main headline only
mask[458:512, 450:535] = 255          # Remove a descender remnant below old headline

restored = cv2.inpaint(img, mask, 5, cv2.INPAINT_TELEA)
restored_rgb = cv2.cvtColor(restored, cv2.COLOR_BGR2RGB)
pil = Image.fromarray(restored_rgb)
draw = ImageDraw.Draw(pil)

font_dir = Path(r"C:\Windows\Fonts")
font_bold = font_dir / "Arialbd.ttf"
font_regular = font_dir / "Arial.ttf"

def load_font(path, size):
    return ImageFont.truetype(str(path), size=size)


# Keep the original orange symbol and replace only the word beside it.
nav_font = load_font(font_bold, 18)
draw.text((340, 59), "ragvyn", fill=(22, 22, 38), font=nav_font)

# Fit the requested longer title cleanly on one centered line.
title = "Ayurvedic IPR and Regulatory Guide"
title_font = load_font(font_bold, 44)
box = draw.textbbox((0, 0), title, font=title_font)
title_w = box[2] - box[0]
title_x = (pil.width - title_w) // 2
draw.text((title_x, 414), title, fill=(18, 18, 38), font=title_font)

pil.save(dst, format="PNG", optimize=True)
print(dst)
