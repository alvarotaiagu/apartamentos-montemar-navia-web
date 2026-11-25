# Vistas de comprobación del recorrido del 3D de Montemar, dibujadas SIN WebGL (render por columnas con el relieve y
# la ortofoto, el mismo de la vista del plan B). Sirven para comprobar la orientación (que nada salga en espejo), el
# encuadre de cada tramo y que desde la terraza se ve lo mismo que en su webcam. No viajan a la web.
# Salida: ref/raw/lugar-cache/comprueba-*.jpg   ·   Uso: python -I -X utf8 scripts/lugar-vistas.py
import pathlib, runpy, sys
import numpy as np
from PIL import Image, ImageDraw

R = pathlib.Path(__file__).resolve().parent.parent
sys.argv = [sys.argv[0]]
g = runpy.run_path(str(R / 'scripts' / 'lugar-datos.py'), run_name='vistas')
rec, vista, fpos, monotona, alt_xz, lugares, C = g['rec'], g['vista'], g['fpos'], g['monotona'], g['alt_xz'], g['lugares'], g['CACHE']
ps = [r['p'] for r in rec]
fmira = [monotona(ps, [r['mira'][k] for r in rec]) for k in range(3)]

# 1) la llegada a la terraza al lado del fotograma de su webcam (deben coincidir: cabo a la izquierda, pinar a la derecha)
fin = rec[-1]
img, _ = vista(960, 540, fin['pos'], fin['mira'], fov=55)
cam = Image.open(R / 'ref' / 'origen' / 'webcam-fotograma-2026-11-25.jpg').convert('RGB').resize((960, 540))
par = Image.new('RGB', (960, 1080 + 8), (0, 0, 0)); par.paste(cam, (0, 0)); par.paste(img, (0, 548))
d = ImageDraw.Draw(par); d.text((10, 10), 'webcam (25-nov-2026)', fill=(255, 255, 0)); d.text((10, 558), 'el 3D al final del recorrido (sin árboles ni casas)', fill=(255, 255, 0))
par.save(C / 'comprueba-terraza-vs-webcam.jpg', quality=86)

# 2) un fotograma por tramo
tiras = []
for p in (0.0, 0.15, 0.29, 0.40, 0.50, 0.60, 0.70, 0.80, 0.88):
    pos = [f(p) for f in fpos]; mira = [f(p) for f in fmira]
    im, _ = vista(640, 360, pos, mira, fov=48)
    ImageDraw.Draw(im).text((8, 8), f'p={p:.2f}  cámara a {pos[1]:.0f} m', fill=(255, 255, 0))
    tiras.append(im)
hoja = Image.new('RGB', (640 * 3, 360 * 3))
for i, im in enumerate(tiras):
    hoja.paste(im, ((i % 3) * 640, (i // 3) * 360))
hoja.save(C / 'comprueba-recorrido.jpg', quality=84)

# 3) desde la terraza, ¿se ven los rótulos del final? (línea de vista sobre el relieve)
P0 = np.array(fin['pos'])
for l in lugares:
    if not any(a >= 0.9 for a, b in l['fases']):
        continue
    T = np.array([l['x'], l['y'] - 6, l['z']])
    ts = np.linspace(0.02, 0.98, 300); pts = P0[None, :] + (T - P0)[None, :] * ts[:, None]
    tap = alt_xz(pts[:, 0], pts[:, 2]) > pts[:, 1] + 0.5
    print('desde la terraza →', l['nombre'], 'TAPADO' if tap.any() else 'a la vista')
print('vistas en', C)
