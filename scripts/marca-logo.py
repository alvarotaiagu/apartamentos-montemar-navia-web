"""El logo de Montemar redibujado en SVG a partir de ref/origen/logo-montemar-457.png (457x486, de WuBook).

Qué es el logo: tres árboles de copa redonda con contorno negro grueso (verde medio a la izquierda, verde en el centro,
delante, y verde oscuro a la derecha), tres troncos negros, una loma (filo negro, banda marrón) y una ola azul debajo;
abajo, «Montemar» en verde oscuro.

Cómo se redibuja (memoria «Logo de JPG: redibujar las rectas», aquí son círculos):
  1. Cada píxel se clasifica por el color más cercano de la paleta del logo (blanco, negro, tres verdes, marrón, azul).
  2. Las copas son CÍRCULOS: se ajusta un círculo (mínimos cuadrados con recorte de atípicos) al borde exterior del
     contorno negro de cada copa, solo en el tramo que da al blanco; el grueso del contorno es la mediana de la
     distancia del relleno a ese borde. Se dibujan con <circle> (relleno + trazo).
  3. Los troncos son rectángulos (ancho y eje medidos por filas).
  4. El filo negro de la loma, la banda marrón, la ola azul y la palabra van con potrace (curvas) sobre la máscara de
     cada color ampliada x8 y suavizada.
  5. Control: se pinta el SVG otra vez a 457x486 (scripts/marca.mjs con sharp) y se mide el IoU de cada color.

Uso: python -I -X utf8 scripts/marca-logo.py
Escribe marca/logo.svg (con la palabra), marca/simbolo.svg (sin la palabra), marca/palabra.svg (currentColor) y
marca/logo.json (la geometría: copas, troncos y trazados en el sistema del PNG, para la portada, el pie y el foco).
"""
import json, pathlib
import numpy as np
from PIL import Image
from scipy import ndimage
import potrace

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SAL = RAIZ / 'marca'
SAL.mkdir(exist_ok=True)
im = np.asarray(Image.open(RAIZ / 'ref/origen/logo-montemar-457.png').convert('RGB')).astype(np.float32)
H, W, _ = im.shape

NOMBRES = ['blanco', 'negro', 'izq', 'cen', 'der', 'tierra', 'agua']
PAL = np.array([(255, 255, 255), (10, 6, 12), (0x46, 0x71, 0x3C), (0x21, 0x5A, 0x37), (0x17, 0x3E, 0x29), (0x84, 0x44, 0x2A), (0x4A, 0x8A, 0xC8)], np.float32)
lab = ((im[:, :, None, :] - PAL[None, None]) ** 2).sum(-1).argmin(-1)
B = {n: lab == i for i, n in enumerate(NOMBRES)}

# el corte entre el dibujo y la palabra: la primera fila vacía por debajo de la ola
filas = np.nonzero(~(lab != 0).any(1))[0]
CORTE = int(filas[filas > 330][0])
print('corte dibujo/palabra en y =', CORTE)

# colores reales (mediana de cada clase en el PNG) para el SVG
def mediana(m):
    return '#%02X%02X%02X' % tuple(int(round(v)) for v in np.median(im[m], 0))
dibujo = np.zeros((H, W), bool); dibujo[:CORTE] = True
COL = {n: mediana(B[n] & dibujo) for n in ['izq', 'cen', 'der', 'tierra', 'agua']}
COL['negro'] = '#0B080C'
palabra_m = (lab != 0) & ~dibujo
COL['palabra'] = mediana(palabra_m & (im.mean(-1) < 120))
print('colores', COL)

# ---------- 2. copas: círculos ----------
blanco = B['blanco']
negro = B['negro']
borde_blanco = blanco & ndimage.binary_dilation(negro, iterations=1)   # blanco pegado al negro
copas = {}
for n in ['izq', 'cen', 'der']:
    fill = B[n] & dibujo
    fill = ndimage.binary_opening(fill, iterations=2)
    lbl, k = ndimage.label(fill)
    tam = ndimage.sum(fill, lbl, range(1, k + 1))
    fill = lbl == (1 + int(np.argmax(tam)))
    d_fill = ndimage.distance_transform_edt(~fill)
    otros = np.zeros_like(fill)
    for o in ['izq', 'cen', 'der']:
        if o != n: otros |= ndimage.binary_opening(B[o] & dibujo, iterations=2)
    d_otros = ndimage.distance_transform_edt(~otros)
    cand = borde_blanco & (d_fill < 18) & (d_otros > d_fill + 4)
    cand[230:] = False                          # por debajo, troncos y loma
    ys, xs = np.nonzero(cand)
    x, y = xs.astype(float), ys.astype(float)
    for _ in range(6):
        A = np.c_[2 * x, 2 * y, np.ones_like(x)]
        (cx, cy, c), *_ = np.linalg.lstsq(A, x * x + y * y, rcond=None)
        R = np.sqrt(c + cx * cx + cy * cy)
        res = np.abs(np.hypot(x - cx, y - cy) - R)
        ok = res < max(1.5, np.percentile(res, 85))
        x, y = x[ok], y[ok]
    grueso = float(np.median(d_fill[cand])) - 0.5
    copas[n] = {'cx': round(cx, 2), 'cy': round(cy, 2), 'r': round(R, 2), 'grueso': round(grueso, 2), 'puntos': int(len(x)), 'residuo': round(float(np.mean(np.abs(np.hypot(x - cx, y - cy) - R))), 2)}
    print(n, copas[n])
G = float(np.median([c['grueso'] for c in copas.values()]))

# ---------- 3. troncos ----------
troncos = []
cen_bajo = {n: copas[n]['cy'] + copas[n]['r'] for n in copas}
for n in ['izq', 'cen', 'der']:
    c = copas[n]
    y0 = int(c['cy'] + c['r'] + 3)
    anchos, ejes = [], []
    for yy in range(y0, y0 + 14):
        fila = negro[yy]
        xs = np.nonzero(fila[int(c['cx'] - 30):int(c['cx'] + 30)])[0] + int(c['cx'] - 30)
        if len(xs):
            anchos.append(xs.max() - xs.min() + 1); ejes.append((xs.max() + xs.min()) / 2)
    an, eje = float(np.median(anchos)), float(np.median(ejes))
    troncos.append({'copa': n, 'x': round(eje - an / 2, 2), 'ancho': round(an, 2), 'y0': round(c['cy'] + c['r'] - G, 2), 'y1': None})
    print('tronco', n, 'eje', round(eje, 1), 'ancho', an)

# ---------- 4. potrace ----------
E = 8
def trazar(m, alphamax=1.0, tol=0.4, suave=0.45):
    ys, xs = np.nonzero(m)
    x0, y0, x1, y1 = max(xs.min() - 4, 0), max(ys.min() - 4, 0), min(xs.max() + 5, W), min(ys.max() + 5, H)
    trozo = Image.fromarray(m[y0:y1, x0:x1].astype(np.float32), mode='F').resize(((x1 - x0) * E, (y1 - y0) * E), Image.BICUBIC)
    mask = ndimage.gaussian_filter(np.asarray(trozo), suave * E) > 0.5
    curvas = potrace.Bitmap(~mask).trace(turdsize=E * E * 6, alphamax=alphamax, opticurve=True, opttolerance=tol)
    F = lambda p: (round(p.x / E + x0, 1), round(p.y / E + y0, 1))
    d = ''
    for cv in curvas:
        sx, sy = F(cv.start_point)
        d += f'M{sx} {sy}'
        for s in cv.segments:
            if s.is_corner:
                (ax, ay), (bx, by) = F(s.c), F(s.end_point)
                d += f'L{ax} {ay}L{bx} {by}'
            else:
                (ax, ay), (bx, by), (ex, ey) = F(s.c1), F(s.c2), F(s.end_point)
                d += f'C{ax} {ay} {bx} {by} {ex} {ey}'
        d += 'Z'
    return d

# el filo negro de la loma: lo negro por debajo de los troncos (sin los troncos)
loma_negra = negro & dibujo
loma_negra[:250] = False
for t in troncos:
    loma_negra[:, int(t['x']) - 1:int(t['x'] + t['ancho']) + 2] &= np.arange(H)[:, None] > 262   # el filo empieza ~262
# el filo arranca donde la loma: el tronco baja hasta el filo
filo_top = {}
for t in troncos:
    col = negro[:, int(t['x'] + t['ancho'] / 2)]
    yy = int(cen_bajo[t['copa']] + 2)
    while yy < CORTE and col[yy]: yy += 1
    t['y1'] = round(float(yy + 1), 2)
tierra = ndimage.binary_closing(B['tierra'] & dibujo, iterations=1); tierra[:250] = False
agua = ndimage.binary_closing(B['agua'] & dibujo, iterations=1); agua[:270] = False
# las juntas: el antialias del PNG deja una línea de píxeles mezclados entre negro, marrón y azul que no es de ninguno.
# Se rellena con el color de la capa de debajo (se pinta negro, luego marrón, luego azul encima), así no quedan rendijas.
dil = lambda m, k=2: ndimage.binary_dilation(m, iterations=k)
loma_negra = loma_negra | (dil(loma_negra) & dil(tierra) & ~B["blanco"])
tierra = tierra | (dil(tierra) & dil(agua) & ~B["blanco"])
D = {
    'filo': trazar(loma_negra, alphamax=1.3, tol=10.0, suave=0.8),
    'tierra': trazar(tierra, alphamax=1.3, tol=10.0, suave=0.8),
    'agua': trazar(agua, alphamax=1.3, tol=10.0, suave=0.8),
    'palabra': trazar(palabra_m, alphamax=1.1, tol=4.0, suave=0.45),
}
for k, v in D.items(): print(k, len(v), 'caracteres')

# ---------- 5. SVG ----------
def r2(v): return ('%.2f' % v).rstrip('0').rstrip('.')
def arboles():
    s = ''
    for t in troncos:
        s += f'<rect x="{r2(t["x"])}" y="{r2(t["y0"])}" width="{r2(t["ancho"])}" height="{r2(t["y1"] - t["y0"])}" fill="{COL["negro"]}"/>'
    for n in ['izq', 'der', 'cen']:   # la del centro, delante
        c = copas[n]
        s += f'<circle cx="{r2(c["cx"])}" cy="{r2(c["cy"])}" r="{r2(c["r"] - G / 2)}" fill="{COL[n]}" stroke="{COL["negro"]}" stroke-width="{r2(G)}"/>'
    return s
def suelo():
    return f'<path d="{D["filo"]}" fill="{COL["negro"]}"/><path d="{D["tierra"]}" fill="{COL["tierra"]}"/><path d="{D["agua"]}" fill="{COL["agua"]}"/>'

ys, xs = np.nonzero((lab != 0) & dibujo)
vb_d = (int(xs.min()) - 2, int(ys.min()) - 2, int(xs.max() - xs.min()) + 5, int(ys.max() - ys.min()) + 5)
ys2, xs2 = np.nonzero(lab != 0)
vb_l = (int(xs2.min()) - 2, int(ys2.min()) - 2, int(xs2.max() - xs2.min()) + 5, int(ys2.max() - ys2.min()) + 5)
ys3, xs3 = np.nonzero(palabra_m)
vb_p = (int(xs3.min()) - 1, int(ys3.min()) - 1, int(xs3.max() - xs3.min()) + 3, int(ys3.max() - ys3.min()) + 3)
VB = lambda v: ' '.join(map(str, v))
(SAL / 'logo.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VB(vb_l)}" role="img" aria-label="Montemar"><title>Montemar</title>{arboles()}{suelo()}<path d="{D["palabra"]}" fill="{COL["palabra"]}"/></svg>\n', encoding='utf-8')
(SAL / 'simbolo.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VB(vb_d)}" aria-hidden="true">{arboles()}{suelo()}</svg>\n', encoding='utf-8')
(SAL / 'palabra.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VB(vb_p)}" aria-hidden="true"><path d="{D["palabra"]}" fill="{COL["palabra"]}"/></svg>\n', encoding='utf-8')
# el suelo solo (filo, loma y ola), para el logo del pie, que dibuja las copas y los troncos aparte para hacerlos crecer
(SAL / 'suelo.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VB(vb_d)}" aria-hidden="true">{suelo()}</svg>\n', encoding='utf-8')
# para comparar con el PNG (mismo lienzo 457x486)
(RAIZ / 'ref/raw').mkdir(parents=True, exist_ok=True)
(RAIZ / 'ref/raw/logo-control.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><rect width="{W}" height="{H}" fill="#fff"/>{arboles()}{suelo()}<path d="{D["palabra"]}" fill="{COL["palabra"]}"/></svg>\n', encoding='utf-8')
np.save(RAIZ / 'ref/raw/logo-clases.npy', lab.astype(np.uint8))

json.dump({
    'fuente': 'ref/origen/logo-montemar-457.png (457x486), redibujado por scripts/marca-logo.py',
    'colores': COL, 'grueso': round(G, 2), 'copas': copas, 'troncos': troncos,
    'viewBox': {'dibujo': vb_d, 'logo': vb_l, 'palabra': vb_p}, 'corte': CORTE, 'trazados': D,
}, open(SAL / 'logo.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('marca/logo.svg, simbolo.svg, palabra.svg, logo.json')
