"""Portada «Del monte al mar»: separa la panorámica de los olivos (slider1, 1780x800) en dos capas para poner «Montemar»
ENTRE el cielo y los olivos (receta de ../a-palleira-pesoz-web/scripts/portada-marco.py, aquí con un mate suave).

  · cielo-<ancho>.{webp,avif,jpg}: la foto entera con los olivos BORRADOS del cielo (se rellena el cielo que tapaban las
    copas con un inpainting a 1/4 de escala, que en un cielo liso no deja rastro). Es la capa de atrás.
  · olivos-<ancho>.webp: la foto con el cielo TRANSPARENTE. Lo que queda opaco: las copas y los troncos que asoman al
    cielo y todo lo que está por debajo del horizonte (montes, ría, mar, pradera). Es la capa de delante.

El horizonte (línea de los montes y del mar) se toma de una polilínea medida sobre la foto y se afina columna a columna
con el salto de luz más fuerte a ±12 px. Por encima del horizonte, el alfa de cada píxel es su distancia de color al
cielo rellenado (un mate suave: las hojas sueltas a contraluz quedan semitransparentes, sin halo blanco).

Lee img/fotos/olivos-1780.jpg (sale de scripts/fotos.mjs: así las capas y la foto son los mismos píxeles).
  python -I -X utf8 scripts/portada-capas.py          (con --ver deja ref/raw/portada-capas-ver.jpg sobre magenta)
Escribe img/portada/ y img/portada/capas.json (tamaño, horizonte medio y la caja libre de cielo para el titular).
"""
import json, sys, pathlib
import numpy as np
import cv2
from PIL import Image

RAIZ = pathlib.Path(__file__).resolve().parent.parent
src = np.asarray(Image.open(RAIZ / 'img/fotos/olivos-1780.jpg').convert('RGB')).astype(np.float32)
H, W, _ = src.shape
R, G, B = src[..., 0], src[..., 1], src[..., 2]
L = 0.3 * R + 0.59 * G + 0.11 * B

# ---------- horizonte ----------
POLI = [(0, 452), (600, 452), (700, 456), (1000, 458), (1060, 466), (1500, 466), (1560, 452), (1780, 436)]
k = W / 1780
xs_p = np.array([p[0] * k for p in POLI]); ys_p = np.array([p[1] * k for p in POLI])
base = np.interp(np.arange(W), xs_p, ys_p)
Ls = cv2.GaussianBlur(L, (0, 0), 1.2)
grad = np.zeros_like(Ls); grad[1:] = Ls[:-1] - Ls[1:]          # caída de luz hacia abajo
hor = np.zeros(W)
for x in range(W):
    y0 = int(base[x] - 12 * k); y1 = int(base[x] + 12 * k)
    hor[x] = y0 + int(np.argmax(grad[y0:y1, x]))
# suavizar (los troncos que cortan el horizonte dan picos)
hor = np.asarray(cv2.medianBlur(hor.astype(np.float32).reshape(1, -1), 5)).ravel()
hor = np.convolve(np.pad(hor, 15, mode='edge'), np.ones(31) / 31, mode='valid')
filas = np.arange(H)[:, None]
encima = filas < hor[None, :] - 1

# ---------- copas en el cielo: máscara inicial ----------
cielo_c = ((B > R + 22) & (L > 95)) | (L > 212)
arbol = encima & ~cielo_c
arbol = cv2.morphologyEx(arbol.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
arbol = cv2.dilate(arbol, np.ones((5, 5), np.uint8)).astype(bool)

# ---------- cielo rellenado: inpainting a 1/4 ----------
q = 4
peq = cv2.resize(src, (W // q, H // q), interpolation=cv2.INTER_AREA)
mq = cv2.resize((arbol | ~encima).astype(np.uint8) * 255, (W // q, H // q), interpolation=cv2.INTER_NEAREST)
mq = cv2.dilate(mq, np.ones((3, 3), np.uint8))
rell = cv2.inpaint(np.clip(peq, 0, 255).astype(np.uint8), mq, 9, cv2.INPAINT_TELEA).astype(np.float32)
rell = cv2.GaussianBlur(rell, (0, 0), 2.0)
cielo_lleno = cv2.resize(rell, (W, H), interpolation=cv2.INTER_CUBIC)

# ---------- mate de los olivos ----------
dist = np.sqrt(((src - cielo_lleno) ** 2).sum(-1))
alfa = np.clip((dist - 16) / 48, 0, 1)
alfa = np.where(encima, alfa, 1.0)
# limpiar: islas sueltas de menos de 30 px en el cielo fuera
bin_ = (alfa > 0.5).astype(np.uint8)
n, lbl, st, _ = cv2.connectedComponentsWithStats(bin_, 8)
for i in range(1, n):
    if st[i, cv2.CC_STAT_AREA] < 30 * k * k:
        alfa[lbl == i] = 0
# el borde del horizonte, sin escalón: 1,5 px de transición
transi = np.clip((filas - (hor[None, :] - 2.5)) / 1.5, 0, 1)
alfa = np.where(encima, np.maximum(alfa, transi), 1.0)
alfa = cv2.GaussianBlur(alfa.astype(np.float32), (0, 0), 0.6)

# la capa de atrás: el cielo rellenado donde había copa; abajo, la foto (queda tapada por la de delante)
peso = np.where(encima, np.clip(alfa * 1.6, 0, 1), 0)[..., None]
atras = src * (1 - peso) + cielo_lleno * peso

# ---------- la caja libre de cielo para el titular (sin copas) ----------
libre = encima & (alfa < 0.05)
filas_libres = libre.mean(1)
OUT = RAIZ / 'img/portada'
OUT.mkdir(parents=True, exist_ok=True)
datos = {'ancho': W, 'alto': H, 'horizonte_medio': round(float(np.median(hor)), 1), 'horizonte_min': round(float(hor.min()), 1),
         'cielo_libre_por_fila': [round(float(v), 3) for v in filas_libres[::20]], 'nota': 'filas cada 20 px: fracción de la fila que es cielo libre'}

ANCHOS = [800, 1200, 1780]
ra = Image.fromarray(np.clip(atras, 0, 255).astype(np.uint8))
fg = np.dstack([np.clip(src, 0, 255), np.clip(alfa * 255, 0, 255)]).astype(np.uint8)
rf = Image.fromarray(fg, 'RGBA')
for w in ANCHOS:
    h = round(H * w / W)
    a = ra if w == W else ra.resize((w, h), Image.LANCZOS)
    f = rf if w == W else rf.resize((w, h), Image.LANCZOS)
    a.save(OUT / f'cielo-{w}.webp', 'WEBP', quality=64, method=6)
    a.save(OUT / f'cielo-{w}.jpg', 'JPEG', quality=82, optimize=True, progressive=True)
    f.save(OUT / f'olivos-{w}.webp', 'WEBP', quality=80, alpha_quality=88, method=6)
    f.save(OUT / f'olivos-{w}.png', 'PNG', optimize=True)
    print(w, 'cielo', (OUT / f'cielo-{w}.webp').stat().st_size // 1024, 'KB · olivos', (OUT / f'olivos-{w}.webp').stat().st_size // 1024, 'KB (webp)', (OUT / f'olivos-{w}.png').stat().st_size // 1024, 'KB (png)')
datos['anchos'] = ANCHOS

# ---------- recortes para móvil y tableta (dirección de arte): los MISMOS píxeles, sin escalar ----------
# El encuadre de la portada recorta la foto al centro (object-fit: cover): en móvil es cuadrado (800x800, x 490-1290)
# y en tableta 1,6:1 (1280x800, x 250-1530). Servir solo ese trozo ahorra más de la mitad de los bytes del LCP.
RECORTES = {'m': (490, 800, [800, 560]), 't': (250, 1280, [1280, 900])}
datos['recortes'] = {}
for clave, (x0, ancho, anchos_r) in RECORTES.items():
    caja = (round(x0 * k), 0, round((x0 + ancho) * k), H)
    a0, f0 = ra.crop(caja), rf.crop(caja)
    for w in anchos_r:
        h = round(H * w / (caja[2] - caja[0]))
        a = a0 if w == caja[2] - caja[0] else a0.resize((w, h), Image.LANCZOS)
        f = f0 if w == caja[2] - caja[0] else f0.resize((w, h), Image.LANCZOS)
        a.save(OUT / f'cielo-{clave}{w}.webp', 'WEBP', quality=64, method=6)   # el cielo es liso: aguanta más compresión
        f.save(OUT / f'olivos-{clave}{w}.webp', 'WEBP', quality=80, alpha_quality=88, method=6)
        print(f'{clave}{w}', 'cielo', (OUT / f'cielo-{clave}{w}.webp').stat().st_size // 1024, 'KB · olivos', (OUT / f'olivos-{clave}{w}.webp').stat().st_size // 1024, 'KB')
    datos['recortes'][clave] = {'x': x0, 'ancho': ancho, 'anchos': anchos_r}
(OUT / 'capas.json').write_text(json.dumps(datos, indent=1), encoding='utf-8')
print('horizonte medio', datos['horizonte_medio'])

if '--ver' in sys.argv:
    mag = np.zeros_like(src); mag[..., 0] = 255; mag[..., 2] = 255
    ver = src * alfa[..., None] + mag * (1 - alfa[..., None])
    Image.fromarray(np.clip(ver, 0, 255).astype(np.uint8)).save(RAIZ / 'ref/raw/portada-capas-ver.jpg', quality=85)
    Image.fromarray(np.clip(atras, 0, 255).astype(np.uint8)).save(RAIZ / 'ref/raw/portada-cielo-ver.jpg', quality=85)
