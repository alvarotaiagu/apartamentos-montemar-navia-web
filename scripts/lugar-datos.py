# «La ría, ahora» · datos del 3D de Apartamentos Montemar (Navia, Asturias).
#
# Fuentes (todas abiertas):
#   - MDT05 y MDT25 del IGN por WCS (servicios.idee.es/wcs-inspire/mdt)              CC BY 4.0, © IGN
#     (no hay MDT02 en ese WCS: se ha mirado GetCapabilities el 2026-11-25)
#   - Ortofoto PNOA por WMS (www.ign.es/wms-inspire/pnoa-ma) y WMTS (www.ign.es/wmts/pnoa-ma)  CC BY 4.0, © IGN
#   - Edificios del Catastro INSPIRE (ovc.catastro.meh.es, WFS BU)                    © Dirección General del Catastro
#   - Lugares de OpenStreetMap (scripts/lugar-osm.py)                                 ODbL, © colaboradores de OSM
# Todo lo descargado se cachea en ref/raw/lugar-cache/ (no viaja a la web). Salida: img/lugar/ (imágenes y
# alturas), data/lugar-escena.json (la escena) y data/lugar.json (cifras para Web: cotaFinca, distancias).
#
# Coordenadas locales en metros desde el punto de Montemar (43.548577, -6.718882, Turismo de Asturias):
# x al este, z al sur, y arriba (altura sobre el nivel medio del mar, la del MDT).
# Alturas en PNG RGB: (R*256 + G) / 10 - 100 = metros (el mar lleva un fondo inventado, siempre < 0).
#
# Uso: python -I -X utf8 scripts/lugar-datos.py      (antes, una vez: scripts/lugar-osm.py)
import io, json, math, pathlib, re, time, urllib.request
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from scipy import ndimage
import tifffile

R = pathlib.Path(__file__).resolve().parent.parent
CACHE = R / 'ref' / 'raw' / 'lugar-cache'; CACHE.mkdir(parents=True, exist_ok=True)
OUT = R / 'img' / 'lugar'; OUT.mkdir(parents=True, exist_ok=True)
DATA = R / 'data'; DATA.mkdir(exist_ok=True)
UA = {'User-Agent': 'datos-mapa-script/1.0 (uso puntual)'}       # sin datos personales

CASA = (43.548577, -6.718882)
KX = 111320 * math.cos(math.radians(CASA[0])); KZ = 110950
def loc(lat, lon): return ((np.asarray(lon) - CASA[1]) * KX, (CASA[0] - np.asarray(lat)) * KZ)
def geo(x, z): return (CASA[0] - np.asarray(z) / KZ, CASA[1] + np.asarray(x) / KX)

# caja cercana (MDT05 + PNOA ~1,5 m/px): del cabo de San Agustín a la playa del Moro, del mar a la villa
CS, CN, CO, CE = 43.536, 43.568, -6.748, -6.700
# caja lejana (MDT25): la costa a los dos lados y la sierra del sur; alineada con la cercana
DLON, DLAT = (CE - CO) / 24, (CN - CS) / 16
LO, LE = CO - 30 * DLON, CE + 30 * DLON
LS, LN = CS - 40 * DLAT, CN + 22 * DLAT
# la ría (ortofoto más fina, WMTS z18) y la finca (WMTS z19), en metros locales: (x0, z0, x1, z1)
RIA = (-1000.0, -1150.0, 150.0, 250.0)
FINCA = (-300.0, -280.0, 300.0, 320.0)


def bajar(url, destino, intentos=5):
    if destino.exists() and destino.stat().st_size > 2000:
        return destino.read_bytes()
    for k in range(intentos):
        try:
            b = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180).read()
            if len(b) < 2000 and b'<' in b[:200]:
                raise IOError(b[:120])
            destino.write_bytes(b); print('bajado', destino.name, len(b) // 1024, 'KB'); return b
        except Exception as e:
            print('falla', destino.name, str(e)[:90]); time.sleep(3 + 4 * k)
    raise SystemExit('No se pudo bajar ' + destino.name)


def wms(S, O, N, E, w, h, nombre):
    url = ('https://www.ign.es/wms-inspire/pnoa-ma?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=OI.OrthoimageCoverage'
           f'&STYLES=&CRS=EPSG:4326&BBOX={S},{O},{N},{E}&WIDTH={w}&HEIGHT={h}&FORMAT=image/jpeg')
    return Image.open(io.BytesIO(bajar(url, CACHE / nombre))).convert('RGB')


def mosaico(S, O, N, E, W, H, nx, ny, base):
    f = CACHE / (base + '.png')
    if f.exists():
        return Image.open(f).convert('RGB')
    im = Image.new('RGB', (W, H))
    for i in range(nx):
        for j in range(ny):
            o, e = O + (E - O) * i / nx, O + (E - O) * (i + 1) / nx
            n, s = N - (N - S) * j / ny, N - (N - S) * (j + 1) / ny
            im.paste(wms(s, o, n, e, W // nx, H // ny, f'{base}-{i}{j}.jpg'), (i * W // nx, j * H // ny))
    im.save(f); return im


def wmts_caja(S, O, N, E, zoom, W, H, nombre):
    """Ortofoto PNOA por teselas WMTS (GoogleMapsCompatible) llevada a la caja lat/lon (W x H, sin espejo: fila 0 = norte)."""
    f = CACHE / (nombre + '.png')
    if f.exists():
        return Image.open(f).convert('RGB')
    n = 2 ** zoom
    tx = lambda lon: (np.asarray(lon, np.float64) + 180) / 360 * n
    ty = lambda lat: (1 - np.arcsinh(np.tan(np.radians(np.asarray(lat, np.float64)))) / np.pi) / 2 * n
    x0, x1, y0, y1 = tx(O), tx(E), ty(N), ty(S)
    cols = range(int(x0), int(x1) + 1); filas = range(int(y0), int(y1) + 1)
    lienzo = Image.new('RGB', (len(cols) * 256, len(filas) * 256))
    tdir = CACHE / f'wmts{zoom}'; tdir.mkdir(exist_ok=True)
    for i, c in enumerate(cols):
        for j, r in enumerate(filas):
            url = ('https://www.ign.es/wmts/pnoa-ma?layer=OI.OrthoimageCoverage&style=default&tilematrixset=GoogleMapsCompatible'
                   f'&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg&TileMatrix={zoom}&TileCol={c}&TileRow={r}')
            lienzo.paste(Image.open(io.BytesIO(bajar(url, tdir / f'{c}-{r}.jpg'))).convert('RGB'), (i * 256, j * 256))
    a = np.asarray(lienzo, np.float32)
    lat = N - (np.arange(H) + 0.5) / H * (N - S); lon = O + (np.arange(W) + 0.5) / W * (E - O)
    py = (ty(lat) - int(y0)) * 256 - 0.5; px = (tx(lon) - int(x0)) * 256 - 0.5
    PY, PX = np.meshgrid(py, px, indexing='ij')
    out = np.stack([ndimage.map_coordinates(a[..., k], [PY, PX], order=1) for k in range(3)], -1)
    im = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)); im.save(f); return im


def wcs(cov, S, N, O, E, nombre):
    url = ('https://servicios.idee.es/wcs-inspire/mdt?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage'
           f'&COVERAGEID={cov}&FORMAT=image/tiff&SUBSET=Lat({S},{N})&SUBSET=Long({O},{E})')
    bajar(url, CACHE / nombre)
    return tifffile.imread(CACHE / nombre).astype(np.float32)


def caja_geo(c):
    """(x0, z0, x1, z1) locales → (S, O, N, E)."""
    x0, z0, x1, z1 = c
    n, o = geo(x0, z0); s, e = geo(x1, z1)
    return float(s), float(o), float(n), float(e)


# ------------------------------------------------------------------ descargas
mdt5 = wcs('Elevacion4258_5', CS, CN, CO, CE, 'mdt5-cerca.tif')
mdt25 = wcs('Elevacion4258_25', LS, LN, LO, LE, 'mdt25-lejos.tif')
orto_c = mosaico(CS, CO, CN, CE, 2560, 2346, 2, 2, 'pnoa-cerca')
orto_l = mosaico(LS, LO, LN, LE, 1600, 2042, 2, 2, 'pnoa-lejos')
S_, O_, N_, E_ = caja_geo(RIA)
orto_r = wmts_caja(S_, O_, N_, E_, 18, 1600, int(round(1600 * (RIA[3] - RIA[1]) / (RIA[2] - RIA[0]))), 'pnoa-ria-z18')
S_, O_, N_, E_ = caja_geo(FINCA)
orto_f = wmts_caja(S_, O_, N_, E_, 19, 2048, 2048, 'pnoa-finca-z19')
print('MDT05', mdt5.shape, 'MDT25', mdt25.shape, 'ría', orto_r.size)


# ------------------------------------------------------------------ muestreo geográfico
CAJA5 = (CS, CN, CO, CE); CAJA25 = (LS, LN, LO, LE)


def muestrea(a, caja, lat, lon, orden=1):
    """Muestrea el ráster `a` (fila 0 = norte) de caja (S, N, O, E) en lat/lon (arrays)."""
    S, N, O, E = caja
    fil = (N - np.asarray(lat)) / (N - S) * a.shape[0] - 0.5
    col = (np.asarray(lon) - O) / (E - O) * a.shape[1] - 0.5
    return ndimage.map_coordinates(a, [fil, col], order=orden, mode='nearest')


def malla_geo(caja, w, h):
    S, N, O, E = caja
    lat = N - (np.arange(h) + 0.5) / h * (N - S); lon = O + (np.arange(w) + 0.5) / w * (E - O)
    LON, LAT = np.meshgrid(lon, lat)
    return LAT, LON


paso5 = ((CE - CO) * KX / mdt5.shape[1], (CN - CS) * KZ / mdt5.shape[0])
print('paso MDT05 (m):', [round(v, 2) for v in paso5])

# ---- el agua y la marea (ver LUGAR.md, «La marea»)
# El MDT05 viene en metros enteros y se voló con la marea baja: el mar y el canal de la ría salen a 0 (relleno
# plano), los arenales de la laguna de la playa y de la orilla oeste a 1 m, con sus caños a 0 m.
LATm, LONm = malla_geo(CAJA5, mdt5.shape[1], mdt5.shape[0])
Xm, Zm = loc(LATm, LONm)
ria_zona = (Xm > -1150) & (Xm < 50) & (Zm > -1000) & (Zm < 1400)       # la ría, de la bocana a la villa
agua0 = mdt5 <= 0.4
et, n = ndimage.label(agua0)
toca = set(np.unique(et[0, :])) - {0}                                     # conectado con el mar abierto (borde norte)
agua = np.isin(et, list(toca))
# el canal de la ría: a menos de 75 m del eje del río de OSM (el MDT deja una mancha de 1 m dentro del canal)
geo_osm = json.loads((CACHE / 'osm-navia-geom.json').read_text(encoding='utf-8'))['elements']
eje = [e for e in geo_osm if e.get('tags', {}).get('waterway') == 'river']
eje_pts = np.array([loc(p['lat'], p['lon']) for e in eje for p in e['geometry']])
lienzo_eje = Image.new('L', (mdt5.shape[1], mdt5.shape[0]), 0)
def a_celda(x, z):
    la, lo = geo(x, z)
    return ((lo - CO) / (CE - CO) * mdt5.shape[1], (CN - la) / (CN - CS) * mdt5.shape[0])
for e in eje:
    ImageDraw.Draw(lienzo_eje).line([a_celda(*loc(p['lat'], p['lon'])) for p in e['geometry']], fill=255, width=1)
dist_eje = ndimage.distance_transform_edt(np.asarray(lienzo_eje) == 0, sampling=(paso5[1], paso5[0]))
canal = (mdt5 <= 1.4) & (dist_eje < 75) & ria_zona
agua = agua | canal | (agua0 & ria_zona)
# los puntos sueltos de «tierra» en mar abierto (ruido del LiDAR en las olas, < 8 celdas) vuelven al mar
et, n = ndimage.label(~agua)
tam = ndimage.sum(np.ones_like(et), et, range(1, n + 1))
islas = np.isin(et, [i + 1 for i, t in enumerate(tam) if t < 8]) & (Zm < -700)
agua = agua | islas
# arenales: la clase de 1 m pegada al agua dentro de la ría, sin vegetación en la ortofoto (el agua verdosa de la
# foto no cuenta como vegetación: G por encima de R y de B)
oc_m = np.stack([muestrea(np.asarray(orto_c, np.float32)[..., k], CAJA5, LATm, LONm) for k in range(3)], -1)
veg = oc_m[..., 1] - np.maximum(oc_m[..., 0], oc_m[..., 2]) > 8
uno = (mdt5 > 0.4) & (mdt5 <= 1.4) & ria_zona & ~veg & ~agua
et, n = ndimage.label(uno)
pega = set(np.unique(et[ndimage.binary_dilation(agua, iterations=2) & uno])) - {0}
arenal = np.isin(et, list(pega))
arenal = ndimage.binary_opening(arenal, iterations=1)
print('agua', int(agua.sum()), 'arenal', int(arenal.sum()), 'celdas;', round(float(arenal.sum()) * paso5[0] * paso5[1] / 1e4, 1), 'ha de arenal')
# el agua de dentro de los arenales (caños) se queda como agua

dist_agua = ndimage.distance_transform_edt(~agua, sampling=(paso5[1], paso5[0]))     # m desde el agua (en tierra)
dist_tierra = ndimage.distance_transform_edt(agua, sampling=(paso5[1], paso5[0]))    # m desde la tierra (en el agua)
# cota modelada del arenal: de 0,5 m junto a los caños a 1,5 m lejos de ellos (por rango: mitad de la superficie a 1 m).
# El MDT solo dice «1 m» (redondeado): esto reparte ese metro, no inventa nada fuera de él.
cota_arenal = np.zeros_like(mdt5)
if arenal.any():
    d = dist_agua[arenal]
    rango = np.argsort(np.argsort(d)) / max(1, len(d) - 1)
    cota_arenal[arenal] = 0.5 + 1.0 * rango
cota_arenal = np.where(arenal, ndimage.gaussian_filter(cota_arenal, 1.0) / np.maximum(ndimage.gaussian_filter(arenal.astype(np.float32), 1.0), 1e-3), 0)
MAREA_MAX = 2.6                                                     # ninguna marea de Navia llega aquí (el rango es ~±2,2 m)
mdt5_s = ndimage.gaussian_filter(mdt5, 1.1)
fondo = -2.8 - np.minimum(dist_tierra * 0.04, 40.0)                  # fondo inventado, siempre por debajo de la bajamar
tierra = np.maximum(mdt5_s, np.where(ndimage.binary_dilation(agua | arenal, iterations=3), 0.6, MAREA_MAX))
# la tierra que no es playa ni arenal y queda por debajo de la pleamar se sube a MAREA_MAX (si no, el agua la cubriría)
playa_baja = (mdt5 <= 2.4) & ndimage.binary_dilation(agua, iterations=6) & ~arenal
tierra = np.where(playa_baja, np.maximum(mdt5_s, 0.6), np.maximum(tierra, np.where(arenal, 0, MAREA_MAX) * (~playa_baja)))
alt5 = np.where(agua, fondo, np.where(arenal, cota_arenal, tierra))
alt5 = np.where(agua, alt5, np.maximum(alt5, 0.45))

mar25 = mdt25 <= 0.4
et, n = ndimage.label(mar25); toca = set(np.unique(et[0, :])) - {0}; mar25 = np.isin(et, list(toca))
dist25 = ndimage.distance_transform_edt(mar25, sampling=(25.0, 25.0))
alt25 = np.where(mar25, -30.0 - np.minimum(dist25 * 0.02, 60), np.maximum(mdt25, MAREA_MAX))


def alt_en(lat, lon, fina=True):
    """Altura (m) combinando el MDT05 (dentro de la caja cercana) y el MDT25 (fuera)."""
    lat = np.asarray(lat, np.float64); lon = np.asarray(lon, np.float64)
    a = muestrea(alt25, CAJA25, lat, lon)
    if fina:
        dentro = (lat >= CS) & (lat <= CN) & (lon >= CO) & (lon <= CE)
        if dentro.any():
            a = a.copy(); a[dentro] = muestrea(alt5, CAJA5, lat[dentro], lon[dentro])
    return a


def alt_xz(x, z):
    la, lo = geo(np.atleast_1d(x), np.atleast_1d(z)); return alt_en(la, lo)


def mdt_xz(x, z):
    """La cota del MDT05 tal cual (sin el agua ni los arenales modelados)."""
    la, lo = geo(np.atleast_1d(x), np.atleast_1d(z)); return muestrea(mdt5_s, CAJA5, la, lo)


def png_alturas(h, nombre):
    v = np.clip(np.round((h + 100.0) * 10), 0, 65535).astype(np.uint16)
    rgb = np.stack([(v >> 8).astype(np.uint8), (v & 255).astype(np.uint8), np.zeros_like(v, np.uint8)], -1)
    Image.fromarray(rgb, 'RGB').save(OUT / nombre, optimize=True)


def rejilla_local(x0, z0, x1, z1, paso):
    nx = int(round((x1 - x0) / paso)) + 1; nz = int(round((z1 - z0) / paso)) + 1
    xs = np.linspace(x0, x1, nx); zs = np.linspace(z0, z1, nz)
    X, Z = np.meshgrid(xs, zs)
    lat, lon = geo(X, Z)
    return X, Z, lat, lon, nx, nz


rasters = {}
cx0, cz0 = loc(CN, CO); cx1, cz1 = loc(CS, CE)
cx0, cz0, cx1, cz1 = float(cx0), float(cz0), float(cx1), float(cz1)
for nombre, (x0, z0, x1, z1, paso) in {
    'cerca': (cx0, cz0, cx1, cz1, 15.0),
    'ria': (RIA[0], RIA[1], RIA[2], RIA[3], 5.0),
    'finca': (FINCA[0], FINCA[1], FINCA[2], FINCA[3], 3.0),
}.items():
    X, Z, lat, lon, nx, nz = rejilla_local(x0, z0, x1, z1, paso)
    h = alt_en(lat, lon)
    png_alturas(h, f'alturas-{nombre}.png')
    rasters[nombre] = {'x0': round(x0, 2), 'z0': round(z0, 2), 'x1': round(x1, 2), 'z1': round(z1, 2), 'w': nx, 'h': nz,
                       'archivo': f'alturas-{nombre}.png'}
    print('alturas', nombre, nx, 'x', nz, round(float(h.min()), 1), round(float(h.max()), 1))

nlx = int(round((LE - LO) / DLON)) + 1; nlz = int(round((LN - LS) / DLAT)) + 1
lons = LO + np.arange(nlx) * DLON; lats = LN - np.arange(nlz) * DLAT
LON_, LAT_ = np.meshgrid(lons, lats)
hl = muestrea(alt25, CAJA25, LAT_, LON_)
dentro = (LAT_ >= CS - 1e-9) & (LAT_ <= CN + 1e-9) & (LON_ >= CO - 1e-9) & (LON_ <= CE + 1e-9)
hl[dentro] = muestrea(alt5, CAJA5, LAT_[dentro], LON_[dentro])
png_alturas(hl, 'alturas-lejos.png')
lx0, lz0 = loc(LN, LO); lx1, lz1 = loc(LS, LE)
rasters['lejos'] = {'x0': round(float(lx0), 2), 'z0': round(float(lz0), 2), 'x1': round(float(lx1), 2), 'z1': round(float(lz1), 2), 'w': nlx, 'h': nlz,
                    'archivo': 'alturas-lejos.png',
                    'hueco': [int(round((CO - LO) / DLON)), int(round((LN - CN) / DLAT)), int(round((CE - LO) / DLON)), int(round((LN - CS) / DLAT))]}
print('lejos', nlx, 'x', nlz, 'hueco', rasters['lejos']['hueco'], 'cumbre', round(float(hl.max())))

# ------------------------------------------------------------------ el agua para el sombreado (caja cercana)
# R: distancia a tierra en el mar (0..765 m, 3 m por unidad) · G: 255 dentro de la ría (agua tranquila, sin rompientes)
# B: la cota del arenal (para que el agua somera deje ver la arena)
CW, CH = 1024, 940
LATc, LONc = malla_geo(CAJA5, CW, CH)
fil = (CN - LATc) / (CN - CS) * mdt5.shape[0] - 0.5; col = (LONc - CO) / (CE - CO) * mdt5.shape[1] - 0.5
d_mar = ndimage.map_coordinates(dist_tierra, [fil, col], order=1)
Xc, Zc = loc(LATc, LONc)
# la ría empieza en la bocana: al sur de la punta de los espigones (z ≈ -800 m) y entre ellos
en_ria = ndimage.map_coordinates((ria_zona & (Zm > -790)).astype(np.float32), [fil, col], order=1)
en_ria = ndimage.gaussian_filter(en_ria, 3)
are = ndimage.map_coordinates(arenal.astype(np.float32), [fil, col], order=1)
cot = ndimage.map_coordinates(cota_arenal, [fil, col], order=1) / np.maximum(are, 1e-3)
# B: la cota del arenal (0,3..1,7 m → 1..255; 0 = no es arenal): el agua se hace transparente donde cubre poco
b_are = np.where(are > 0.5, 1 + np.clip((cot - 0.3) / 1.4, 0, 1) * 254, 0)
costa = np.stack([np.clip(d_mar / 3.0, 0, 255), np.clip(en_ria * 255, 0, 255), b_are], -1).astype(np.uint8)
Image.fromarray(costa, 'RGB').save(OUT / 'agua.png', optimize=True)

# ------------------------------------------------------------------ ortofotos
def gradua(img, ref_img, mascara_img=None, mascara_ref=None):
    """Iguala medias y contrastes por canal (lo lejano, al color de lo cercano)."""
    a = np.asarray(img, np.float32); b = np.asarray(ref_img, np.float32)
    ma = a.reshape(-1, 3) if mascara_img is None else a[mascara_img]
    mb = b.reshape(-1, 3) if mascara_ref is None else b[mascara_ref]
    out = (a - ma.mean(0)) / (ma.std(0) + 1e-3) * mb.std(0) + mb.mean(0)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def capa_en(mascara, caja_ll, w, h):
    """Una máscara del MDT05 llevada a la malla de una ortofoto (caja lat/lon S, N, O, E)."""
    LAT, LON = malla_geo(caja_ll, w, h)
    return muestrea(mascara.astype(np.float32), CAJA5, LAT, LON)


AGUA_COL = np.array([24, 60, 74], np.float32)


def arena_mojada(img, m_are, m_agua, d_agua, semilla):
    """En los arenales, el agua de la foto (tomada con otra marea) se cambia por arena mojada; el canal, uniforme.
    Así, con la marea baja de ahora asoma la arena; con la alta la tapa el plano del agua."""
    a = np.asarray(img, np.float32).copy()
    lum = a.mean(-1)
    azul = (a[..., 2] - a[..., 0] > 8) | (lum < 70)
    seca = (m_are > 0.5) & ~azul
    base = np.median(a[seca], 0) if seca.sum() > 200 else np.array([150, 140, 118], np.float32)
    mojada = 0.45 * base * 0.82 + 0.55 * np.array([126, 114, 92], np.float32)      # arena y fango mojados, más pardos
    rng = np.random.default_rng(semilla)
    grano = ndimage.gaussian_filter(rng.random(a.shape[:2]).astype(np.float32), 1.5)
    vetas = ndimage.gaussian_filter(rng.random(a.shape[:2]).astype(np.float32), 14.0)
    vetas = (vetas - vetas.mean()) / (vetas.std() + 1e-6)
    humedad = 0.80 + 0.20 * np.clip(d_agua / 35.0, 0, 1)                             # más oscura junto a los caños
    detalle = np.clip((lum + 4) / (ndimage.gaussian_filter(lum, 6) + 4), 0.7, 1.35) ** 0.7   # los bancos de la foto
    tono = mojada[None, None, :] * (humedad * detalle * (1 + 0.08 * (grano - 0.5) + 0.03 * vetas))[..., None]
    k = np.clip(m_are, 0, 1)[..., None] * np.where(azul, 1.0, 0.35)[..., None]
    a = a * (1 - k) + tono * k
    ka = np.clip(m_agua, 0, 1)[..., None]
    a = a * (1 - ka) + AGUA_COL * ka
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)), base


oc = orto_c
m_are_c = capa_en(arenal, CAJA5, oc.width, oc.height); m_agua_c = capa_en(agua & ~ndimage.binary_dilation(arenal, iterations=1), CAJA5, oc.width, oc.height)
orto_c2, base_arena = arena_mojada(oc, m_are_c, m_agua_c, capa_en(np.minimum(dist_agua, 200), CAJA5, oc.width, oc.height), 5)
print('arena seca de la foto (RGB):', [int(v) for v in base_arena])
orto_c2.save(OUT / 'orto-cerca-2560.webp', quality=70, method=6)
orto_c2.resize((1280, int(round(1280 * oc.height / oc.width))), Image.LANCZOS).save(OUT / 'orto-cerca-1280.webp', quality=74, method=6)

caja_ria_ll = (lambda s, o, n, e: (s, n, o, e))(*caja_geo(RIA))
m_are_r = capa_en(arenal, caja_ria_ll, orto_r.width, orto_r.height); m_agua_r = capa_en(agua & ~ndimage.binary_dilation(arenal, iterations=1), caja_ria_ll, orto_r.width, orto_r.height)
orto_r2, _ = arena_mojada(orto_r, m_are_r, m_agua_r, capa_en(np.minimum(dist_agua, 200), caja_ria_ll, orto_r.width, orto_r.height), 6)
orto_r2.save(OUT / 'orto-ria-1600.webp', quality=72, method=6)
orto_r2.resize((800, int(round(800 * orto_r.height / orto_r.width))), Image.LANCZOS).save(OUT / 'orto-ria-800.webp', quality=76, method=6)

# lejos: graduada al color de la cercana, con el mar oscuro
ol = orto_l.copy()
marL = muestrea(alt25, CAJA25, *malla_geo(CAJA25, ol.width, ol.height)) < 0
S, N, O, E = CAJA25
i0 = int((CO - O) / (E - O) * ol.width); i1 = int((CE - O) / (E - O) * ol.width)
j0 = int((N - CN) / (N - S) * ol.height); j1 = int((N - CS) / (N - S) * ol.height)
ref = orto_c2.resize((i1 - i0, j1 - j0), Image.LANCZOS)
marRef = capa_en(agua, CAJA5, i1 - i0, j1 - j0) > 0.5
olg = np.asarray(gradua(ol, ref, ~marL & (np.asarray(ol).sum(-1) < 700), ~marRef), np.float32)
gris = olg.mean(-1, keepdims=True); olg = gris + (olg - gris) * 0.75
olg[marL] = AGUA_COL
Image.fromarray(olg.astype(np.uint8)).save(OUT / 'orto-lejos-1600.webp', quality=70, method=6)


# ------------------------------------------------------------------ Catastro
def wfs(servicio, tipo, S, O, N, E, nombre):
    url = (f'https://ovc.catastro.meh.es/INSPIRE/{servicio}.aspx?service=WFS&version=2.0.0&request=GetFeature'
           f'&typenames={tipo}&srsname=EPSG::4258&bbox={S},{O},{N},{E}')
    return bajar(url, CACHE / nombre).decode('latin-1')


def poligonos(xml, patron_id):
    out = []
    for m in re.finditer(r'<(?:gml:featureMember|wfs:member|member)>(.*?)</(?:gml:featureMember|wfs:member|member)>', xml, re.S):
        f = m.group(1)
        lid = re.search(patron_id, f)
        pis = re.search(r'numberOfFloorsAboveGround>(\d+)', f)
        uso = re.search(r'currentUse>([^<]+)', f)
        anillos = []
        for pl in re.findall(r'<gml:posList[^>]*>([^<]+)</gml:posList>', f):
            v = list(map(float, pl.split()))
            anillos.append([(v[i], v[i + 1]) for i in range(0, len(v), 2)])     # lat lon (EPSG:4258)
        out.append({'id': lid.group(1) if lid else '?', 'pisos': int(pis.group(1)) if pis else None,
                    'uso': uso.group(1) if uso else None, 'anillos': anillos})
    return out


FS, FO, FN, FE = caja_geo((-380.0, -360.0, 380.0, 400.0))
bp = poligonos(wfs('wfsBU', 'BU:BuildingPart', FS, FO, FN, FE, 'bp-finca.xml'), r'localId>([^<]+)')
bu = poligonos(wfs('wfsBU', 'BU:Building', FS, FO, FN, FE, 'bu-finca.xml'), r'reference>([^<]+)')
usos = {b['id']: b['uso'] for b in bu}
print('Catastro: partes', len(bp), 'edificios', len(bu))


def rect_orientado(pts):
    """Rectángulo mínimo (por giro de 0,5°) que contiene el polígono: centro, lados y ángulo."""
    P = np.array(pts); mejor = None
    for g in np.radians(np.arange(0, 90, 0.5)):
        c, s = math.cos(g), math.sin(g)
        u = P[:, 0] * c + P[:, 1] * s; v = -P[:, 0] * s + P[:, 1] * c
        a = (u.max() - u.min()) * (v.max() - v.min())
        if mejor is None or a < mejor[0]:
            mejor = (a, g, (u.max() + u.min()) / 2, (v.max() + v.min()) / 2, u.max() - u.min(), v.max() - v.min())
    a, g, uc, vc, lu, lv = mejor
    c, s = math.cos(g), math.sin(g)
    cx, cz = uc * c - vc * s, uc * s + vc * c
    if lv > lu:                                  # el lado largo, siempre en «largo»
        lu, lv, g = lv, lu, g + math.pi / 2
    return {'cx': round(cx, 2), 'cz': round(cz, 2), 'largo': round(lu, 2), 'fondo': round(lv, 2), 'ang': round(g, 4)}


def area(pts):
    return 0.5 * abs(sum(pts[i][0] * pts[i - 1][1] - pts[i - 1][0] * pts[i][1] for i in range(len(pts))))


# Qué es cada edificio (por las fotos slider2, 13 y 14 de su web y la ortofoto; ver LUGAR.md):
#   33041A01600277 part1+part2+part3 = la casa roja (3 plantas: la de pizarra y dos rojas), porche al norte
#   33041A01600277 part4             = el chalet de piedra (1 planta)
REF_CASA = '33041A01600277'
edificios = []
casa_pts = []
for b in bp:
    if not b['anillos']:
        continue
    pts = [tuple(map(float, loc(la, lo))) for la, lo in b['anillos'][0]]
    if pts[0] == pts[-1]:
        pts = pts[:-1]
    if area(pts) < 4:
        continue
    cm_ = np.mean(pts, axis=0)                   # solo dentro de la ortofoto de la finca (ahí se borran los tejados)
    if not (FINCA[0] + 12 < cm_[0] < FINCA[2] - 12 and FINCA[1] + 12 < cm_[1] < FINCA[3] - 12):
        continue
    ref = b['id'].split('_')[0]
    if ref == REF_CASA and not b['id'].endswith('part4'):
        casa_pts += pts                          # la casa se levanta entera en lugar.js, con su forma
        continue
    tipo = 'chalet' if b['id'] == REF_CASA + '_part4' else 'vecina'
    rc = rect_orientado(pts)
    lat = np.array([geo(x, z)[0] for x, z in pts]); lon = np.array([geo(x, z)[1] for x, z in pts])
    hs = alt_en(lat, lon)
    pisos = b['pisos'] or 1
    edificios.append({'id': b['id'], 'tipo': tipo, 'uso': usos.get(ref), 'pisos': pisos,
                      'cubierta': '2' if (tipo == 'chalet' or rc['largo'] > 1.5 * rc['fondo']) else '4',
                      'suelo': round(float(hs.min()), 2), 'suelo_max': round(float(hs.max()), 2),
                      'anillo': [[round(x, 2), round(z, 2)] for x, z in pts], 'rect': rc, 'area': round(area(pts), 1)})
edificios.sort(key=lambda e: (e['tipo'] == 'vecina', e['id']))
# la casa roja: el rectángulo de sus tres partes, con +u hacia el porche (norte) y +v hacia la escalera (este)
rc = rect_orientado(casa_pts)
ang = rc['ang']
# se elige el giro (de 90 en 90) que deja +u lo más al norte (−z)
mejor = None
for k in range(4):
    a = ang + k * math.pi / 2
    norte = -math.sin(a)                         # componente z de (cos a, sin a), cambiada de signo
    if mejor is None or norte > mejor[0]:
        mejor = (norte, a, k)
_, ang_c, k = mejor
largo, fondo = (rc['largo'], rc['fondo']) if k % 2 == 0 else (rc['fondo'], rc['largo'])
la_, lo_ = geo(np.array([p[0] for p in casa_pts]), np.array([p[1] for p in casa_pts]))
hs = alt_en(la_, lo_)
CASA_ROJA = {'cx': rc['cx'], 'cz': rc['cz'], 'largo': round(largo, 2), 'fondo': round(fondo, 2), 'ang': round(ang_c, 4),
             'suelo': round(float(hs.min()), 2), 'suelo_max': round(float(hs.max()), 2),
             'suelo_centro': round(float(alt_xz(rc['cx'], rc['cz'])[0]), 2),
             'anillo': [[round(x, 2), round(z, 2)] for x, z in casa_pts], 'catastro': REF_CASA + ' (part1-3)', 'plantas': 3}
print('casa roja', {k: v for k, v in CASA_ROJA.items() if k != 'anillo'})
print('edificios', len(edificios), [(e['id'], e['tipo'], e['pisos']) for e in edificios if e['tipo'] != 'vecina'])
COTA_FINCA = round(CASA_ROJA['suelo_centro'])


# ------------------------------------------------------------------ máscara de edificios (para no poner árboles encima)
def a_px_de(caja_loc, W, H):
    x0, z0, x1, z1 = caja_loc
    return lambda x, z: ((x - x0) / (x1 - x0) * W, (z - z0) / (z1 - z0) * H)


def mascara_edificios(caja_loc, W, H, margen=2.0):
    a_px = a_px_de(caja_loc, W, H)
    m = Image.new('L', (W, H), 0); dm = ImageDraw.Draw(m)
    anillos = [e['anillo'] for e in edificios] + [CASA_ROJA['anillo']]
    for an in anillos:
        P = np.array(an); c = P.mean(0)
        crece = [(c[0] + (x - c[0]) * 1.0 + np.sign(x - c[0]) * margen, c[1] + (z - c[1]) * 1.0 + np.sign(z - c[1]) * margen) for x, z in an]
        dm.polygon([a_px(x, z) for x, z in crece], fill=255)
    return np.asarray(m) > 0


# ------------------------------------------------------------------ la parcela de la finca (Catastro, wfsCP)
xml_cp = bajar('https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx?service=wfs&version=2&request=GetFeature'
               f'&STOREDQUERIE_ID=GetParcel&refcat={REF_CASA}&srsname=EPSG::4258', CACHE / 'cp-finca.xml').decode('latin-1')
v = list(map(float, re.search(r'<gml:posList[^>]*>([^<]+)</gml:posList>', xml_cp).group(1).split()))
PARCELA = [tuple(float(t) for t in loc(v[i], v[i + 1])) for i in range(0, len(v), 2)]
PARCELA_M2 = int(re.search(r'areaValue[^>]*>([0-9.]+)<', xml_cp).group(1).split('.')[0])
print('parcela', REF_CASA, PARCELA_M2, 'm2,', len(PARCELA), 'vértices')


def dentro(pt, anillo):
    c = False
    for i in range(len(anillo)):
        a, b = anillo[i], anillo[i - 1]
        if (a[1] > pt[1]) != (b[1] > pt[1]) and pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]:
            c = not c
    return c


# ------------------------------------------------------------------ los olivos (los árboles del logo)
of = np.asarray(orto_f, np.float32)
FW = of.shape[1]; paso_f = (FINCA[2] - FINCA[0]) / FW
lum_f = of.mean(-1)
fondo_f = ndimage.median_filter(ndimage.zoom(lum_f, 0.125, order=1), size=9)
fondo_f = ndimage.zoom(fondo_f, 8, order=1)[:FW, :FW]
verde_f = of[..., 1] - np.maximum(of[..., 0], of[..., 2])
oscuro = (lum_f < 0.72 * fondo_f) & (lum_f < 105)
oscuro = ndimage.binary_opening(oscuro, iterations=2)
etq, nn = ndimage.label(oscuro)
edif_f = mascara_edificios(FINCA, FW, FW, 3.0)
olivos = []
cms = ndimage.center_of_mass(oscuro, etq, range(1, nn + 1))
tams = ndimage.sum(oscuro, etq, range(1, nn + 1))
anillo_claro = ndimage.binary_dilation(oscuro, iterations=10) & ~ndimage.binary_dilation(oscuro, iterations=4)
for k, ((fy, fx), t) in enumerate(zip(cms, tams)):
    area_m2 = t * paso_f * paso_f
    r_eq = math.sqrt(area_m2 / math.pi)
    if r_eq < 0.8 or r_eq > 3.6:
        continue
    x = FINCA[0] + (fx + 0.5) * paso_f; z = FINCA[1] + (fy + 0.5) * paso_f
    if not dentro((x, z + 0.6), PARCELA):      # solo los de la finca (parcela del Catastro; la copa, 0,6 m al sur)
        continue
    iy, ix = int(fy), int(fx)
    if edif_f[iy, ix]:
        continue
    # aislado sobre la pradera: alrededor, hierba clara y verde
    y0_, y1_ = max(0, iy - 40), min(FW, iy + 40); x0_, x1_ = max(0, ix - 40), min(FW, ix + 40)
    ent = anillo_claro[y0_:y1_, x0_:x1_] & (etq[y0_:y1_, x0_:x1_] == 0)
    if ent.sum() < 50:
        continue
    lum_ent = lum_f[y0_:y1_, x0_:x1_][ent].mean(); ver_ent = verde_f[y0_:y1_, x0_:x1_][ent].mean()
    if lum_ent < 105 or ver_ent < 8:
        continue
    # la copa está en la parte sur de la mancha (la sombra cae al norte con el sol del mediodía)
    r_copa = round(min(3.0, max(1.9, r_eq * 0.9)), 2)
    olivos.append([round(x, 1), 0.0, round(z + 0.6, 1), r_copa])
for o in olivos:
    o[1] = round(float(alt_xz(o[0], o[2])[0]), 2)
print('olivos', len(olivos))

# vista de comprobación (no viaja a la web)
chk = orto_f.copy(); dch = ImageDraw.Draw(chk)
a_px_f = a_px_de(FINCA, FW, FW)
for o in olivos:
    px_, pz_ = a_px_f(o[0], o[2]); rr = o[3] / paso_f
    dch.ellipse([px_ - rr, pz_ - rr, px_ + rr, pz_ + rr], outline=(255, 220, 0), width=2)
dch.line([a_px_f(x, z) for x, z in PARCELA], fill=(0, 255, 255), width=2)
for an in [e['anillo'] for e in edificios] + [CASA_ROJA['anillo']]:
    dch.line([a_px_f(x, z) for x, z in an] + [a_px_f(*an[0])], fill=(255, 0, 0), width=2)
chk.crop((500, 500, 1600, 1500)).save(CACHE / 'comprueba-olivos.jpg', quality=85)
olivos = [o for o in olivos if math.hypot(o[0] + 29, o[2] - 23) > 5.5]        # no las esquinas del cuadro oscuro del jardín
print('olivos (sin el cuadro del jardín)', len(olivos))


# ------------------------------------------------------------------ el resto de los árboles: pinar y arboledas
def deteccion_arboles(img, caja_loc, paso_cand, semilla, excluir):
    a = np.asarray(img, np.float32)
    H_, W_ = a.shape[:2]
    pm = (caja_loc[2] - caja_loc[0]) / W_
    lum = a.mean(-1)
    verde = a[..., 1] - (a[..., 0] + a[..., 2]) / 2
    k = max(3, int(round(3.0 / pm)))
    m1 = ndimage.uniform_filter(lum, k); m2 = ndimage.uniform_filter(lum * lum, k)
    rug = np.sqrt(np.maximum(m2 - m1 * m1, 0))
    lum_s = ndimage.gaussian_filter(lum, 1.5 / pm)
    copa = (lum_s < 88) & (rug > 7) & (ndimage.gaussian_filter(verde, 1.5 / pm) > -4) & ~excluir
    copa = ndimage.binary_opening(copa, iterations=2)
    rng = np.random.default_rng(semilla)
    s = max(1, int(round(paso_cand / pm)))
    cand = np.argwhere(copa[::s, ::s]) * s
    rng.shuffle(cand)
    return a, pm, cand, rng


arboles = []                                   # [x, y, z, r, alto, '#color', tipo]  tipo: 0 frondosa, 1 pino
ocupado = {}


def libre(x, z, r):
    ci, cj = int(x // 12), int(z // 12)
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            for ox, oz, orr in ocupado.get((ci + di, cj + dj), ()):
                if (x - ox) ** 2 + (z - oz) ** 2 < (0.9 * (r + orr)) ** 2:
                    return False
    return True


def ocupa(x, z, r):
    ocupado.setdefault((int(x // 12), int(z // 12)), []).append((x, z, r))


for o in olivos:
    ocupa(o[0], o[2], o[3] + 1.0)


def en_pinar(x, z):
    return -470 < x < 70 and -810 < z < -60


def anade(img, caja_loc, paso_cand, semilla, excluir, filtro, tope):
    a, pm, cand, rng = deteccion_arboles(img, caja_loc, paso_cand, semilla, excluir)
    n0 = len(arboles)
    for fy, fx in cand:
        if len(arboles) - n0 >= tope:
            break
        x = caja_loc[0] + (fx + 0.5) * pm; z = caja_loc[1] + (fy + 0.5) * pm
        if not filtro(x, z):
            continue
        pino = en_pinar(x, z)
        r = (2.3 + rng.random() * 1.6) if pino else (2.4 + rng.random() * 2.4)
        if not libre(x, z, r):
            continue
        ocupa(x, z, r)
        col = a[max(0, fy - 3):fy + 3, max(0, fx - 3):fx + 3].reshape(-1, 3).mean(0)
        alto = (15 + rng.random() * 8) if pino else r * (2.0 + rng.random() * 1.3)
        arboles.append([round(x, 1), 0.0, round(z, 1), round(r, 2), round(alto, 1), '#%02x%02x%02x' % tuple(int(v) for v in col), 1 if pino else 0])


# la finca (ortofoto de 0,29 m/px), sin los olivos ni los edificios
excl_f = edif_f.copy()
for o in olivos:
    px_, pz_ = a_px_f(o[0], o[2]); rr = int((o[3] + 1.5) / paso_f)
    excl_f[max(0, int(pz_) - rr):int(pz_) + rr, max(0, int(px_) - rr):int(px_) + rr] = True
anade(orto_f, FINCA, 2.5, 11, excl_f, lambda x, z: math.hypot(x, z - 20) < 300, 2600)
n_finca = len(arboles)
# la ría (0,72 m/px): el pinar de la playa y las arboledas de las orillas, fuera de la caja de la finca
H_r, W_r = orto_r.height, orto_r.width
excl_r = mascara_edificios(RIA, W_r, H_r, 2.0)
anade(orto_r, RIA, 3.5, 12, excl_r, lambda x, z: not (FINCA[0] < x < FINCA[2] and FINCA[1] < z < FINCA[3]), 4200)
for t in arboles:
    t[1] = round(float(alt_xz(t[0], t[2])[0]), 2)
arboles = [t for t in arboles if t[1] > MAREA_MAX - 0.1]                       # nada en el agua ni en los arenales
print('árboles', len(arboles), '(finca', n_finca, ', pinos', sum(1 for t in arboles if t[6] == 1), ')')

chk = Image.fromarray(np.asarray(orto_r)).copy(); dch = ImageDraw.Draw(chk)
a_px_r = a_px_de(RIA, W_r, H_r)
for t in arboles:
    px_, pz_ = a_px_r(t[0], t[2]); rr = t[3] / 0.72
    dch.ellipse([px_ - rr, pz_ - rr, px_ + rr, pz_ + rr], outline=(255, 60, 0) if t[6] else (255, 255, 0), width=1)
chk.resize((800, int(800 * H_r / W_r))).save(CACHE / 'comprueba-arboles.jpg', quality=85)


# ------------------------------------------------------------------ los espigones (medidos en la ortofoto PNOA de z18)
# Las escolleras de la bocana: en el MDT05 salen aplastadas (5 m de celda), así que se levantan a mano sobre su
# trazado en la ortofoto (2026-11-25). Puntas: oeste (-583, -940), este (-441, -765).
ESPIGONES = {
    'oeste': [[-583, -940], [-590, -780], [-606, -570], [-617, -420]],
    'este': [[-441, -765], [-452, -712], [-459, -569], [-471, -353]],
    'ancho': 7.0, 'alto': 4.5,
}

# ------------------------------------------------------------------ lugares (OSM y medidas)
osm = json.loads((CACHE / 'osm-navia.json').read_text(encoding='utf-8'))['elements']


def busca(cond, cerca_de=None, max_m=None, fuente=None):
    mejor = None
    for e in (fuente or osm):
        t = e.get('tags', {})
        lat = e.get('lat', e.get('center', {}).get('lat')); lon = e.get('lon', e.get('center', {}).get('lon'))
        if lat is None or not cond(t):
            continue
        x, z = (float(v) for v in loc(lat, lon))
        d = 0 if cerca_de is None else math.hypot(x - cerca_de[0], z - cerca_de[1])
        if max_m is not None and d > max_m:
            continue
        if mejor is None or d < mejor[0]:
            mejor = (d, e, x, z)
    if mejor is None:
        raise SystemExit('No encuentro en OSM un lugar que cumpla la condición')
    return mejor


CX, CZ = CASA_ROJA['cx'], CASA_ROJA['cz']
# la playa de Navia: el polígono natural=beach con ese nombre; distancia en línea recta desde el centro de la casa
playa = next(e for e in geo_osm if e.get('tags', {}).get('natural') == 'beach' and e['tags'].get('name') == 'Playa de Navia')
playa_pts = np.array([loc(p['lat'], p['lon']) for p in playa['geometry']], np.float64)
# distancia al borde del polígono (segmento a segmento)
def dist_poligono(px_, pz_, P):
    best = 1e9
    for i in range(len(P)):
        a, b = P[i - 1], P[i]
        ab = b - a; t = np.clip(np.dot([px_ - a[0], pz_ - a[1]], ab) / max(1e-9, np.dot(ab, ab)), 0, 1)
        q = a + t * ab; best = min(best, math.hypot(px_ - q[0], pz_ - q[1]))
    return best
D_PLAYA = dist_poligono(CX, CZ, playa_pts)
pc = playa_pts.mean(0)
D_BOCANA = math.hypot(CX - (-516), CZ - (-790))
_, e_faro, xf, zf = busca(lambda t: t.get('man_made') == 'lighthouse' and 'San Agust' in t.get('name', ''))
_, e_cabo, xcb, zcb = busca(lambda t: t.get('natural') == 'cape' and 'San Agust' in t.get('name', ''), (xf, zf), 600)
_, e_nav, xn, zn = busca(lambda t: t.get('place') == 'town' and t.get('name') == 'Navia')
D_NAVIA = math.hypot(CX - xn, CZ - zn)
print(f'playa de Navia a {D_PLAYA:.0f} m en línea recta (centro de la casa → borde del polígono OSM); bocana a {D_BOCANA:.0f} m; '
      f'faro a {math.hypot(CX - xf, CZ - zf):.0f} m; Navia (place=town) a {D_NAVIA:.0f} m')

lugares = []
def pon(clave, nombre, sub, x, z, dy, fases, osm_ref, nota, y=None):
    yy = (max(float(alt_xz(x, z)[0]), 0) + dy) if y is None else y
    lugares.append({'clave': clave, 'nombre': nombre, 'sub': sub, 'x': round(float(x), 1), 'z': round(float(z), 1),
                    'y': round(yy, 1), 'fases': fases, 'osm': osm_ref, 'nota': nota})


pon('mar', 'Mar Cantábrico', None, -760, -2100, 0, [[0.0, 0.26]], None, 'rótulo en el mar', y=30)
pon('cabo', 'Cabo de San Agustín', 'el faro', xf, zf, 18, [[0.0, 0.34], [0.93, 1.01]],
    f"{e_faro['type']}/{e_faro['id']}", f'man_made=lighthouse + natural=cape {e_cabo["id"]}')
pon('bocana', 'La bocana', 'entre los dos espigones', -516, -800, 9, [[0.06, 0.44], [0.93, 1.01]], None,
    'punto medio entre las puntas de los espigones (ortofoto)', y=9)
pon('playa', 'Playa de Navia', f'a {round(D_PLAYA / 10) * 10:.0f} m de la casa', float(pc[0]), float(pc[1]), 7,
    [[0.18, 0.62], [0.93, 1.01]], f"way/{playa['id']}", 'natural=beach, centro del polígono')
pinos_banda = np.array([(t[0], t[2]) for t in arboles if t[6] == 1 and -620 < t[2] < -280 and t[0] < 40])
PINAR_C = pinos_banda.mean(0) if len(pinos_banda) else np.array([-80.0, -430.0])
print('pinos en la banda del pinar', len(pinos_banda), 'centro', PINAR_C.round(1))
pon('pinar', 'El pinar', None, float(PINAR_C[0]), float(PINAR_C[1]), 24, [[0.32, 0.72], [0.93, 1.01]], None,
    'pinar entre la laguna de la playa y la finca (ortofoto; el de la webcam)')
pon('ria', 'La ría de Navia', None, -540, 120, 6, [[0.5, 0.8]], 'way/210829901', 'eje waterway=river', y=6)
pon('navia', 'Navia', 'la villa', xn, zn, 26, [[0.52, 0.84]], f"{e_nav['type']}/{e_nav['id']}", 'place=town')
pon('finca', 'Montemar', f'{COTA_FINCA} m sobre el mar', CX, CZ, 14, [[0.0, 0.3], [0.56, 0.92]], None,
    'la casa roja (Catastro)', y=CASA_ROJA['suelo'] + 14)
for l in lugares:
    print('lugar', l['clave'], l['x'], l['z'], l['y'], l['nota'])


# ------------------------------------------------------------------ recorrido de la cámara
# p: progreso del scroll (0..1). pos y mira en metros locales (y = altura sobre el nivel medio del mar).
# Entra desde el Cantábrico por la bocana, pasa la playa y el pinar, remonta la ría, sube a la finca y acaba a la
# altura de la terraza de arriba (el porche norte de la casa roja), mirando de vuelta al mar: la vista de su webcam.
SUELO_CASA = CASA_ROJA['suelo']
Y_TERRAZA = round(SUELO_CASA + 2.8 + 2.9 + 1.6, 2)          # planta de pizarra + 1.ª roja + ojos (1,6 m) en el porche alto
ca, sa = math.cos(CASA_ROJA['ang']), math.sin(CASA_ROJA['ang'])
def casa_pt(u, v):                                          # u hacia el porche (norte), v hacia la escalera (este)
    return [round(CX + u * ca - v * sa, 2), round(CZ + u * sa + v * ca, 2)]
FRENTE = casa_pt(CASA_ROJA['largo'] / 2 + 1.6, -CASA_ROJA['fondo'] * 0.18)   # 1,6 m por delante del porche
BOC = [-516.0, 2.5, -800.0]
# la mirada final: hacia la bocana, girada 7° al este para encuadrar como su webcam (la bocana algo a la izquierda,
# el pinar a la derecha); comprobado con scripts/lugar-vistas.py → comprueba-terraza-vs-webcam.jpg
_dx, _dz = BOC[0] - FRENTE[0], BOC[2] - FRENTE[1]; _g = math.radians(7)
MIRA_FIN = [round(FRENTE[0] + _dx * math.cos(_g) - _dz * math.sin(_g), 2), BOC[1], round(FRENTE[1] + _dx * math.sin(_g) + _dz * math.cos(_g), 2)]
rec = [
    {'p': 0.00, 'pos': [-560, 230, -3300], 'mira': [-470, 40, -520]},
    {'p': 0.15, 'pos': [-548, 125, -1950], 'mira': [-505, 4, -650]},
    {'p': 0.29, 'pos': [-528, 34, -1090], 'mira': [-525, 6, -420]},
    {'p': 0.40, 'pos': [-522, 24, -720], 'mira': [-250, 8, -690]},
    {'p': 0.50, 'pos': [-534, 27, -430], 'mira': [-90, 16, -430]},
    {'p': 0.60, 'pos': [-545, 40, -90], 'mira': [-470, 10, 760]},
    {'p': 0.70, 'pos': [-395, 78, 20], 'mira': [CX, SUELO_CASA + 4, CZ]},
    {'p': 0.80, 'pos': [-150, 80, -40], 'mira': [CX, SUELO_CASA + 4, CZ]},
    {'p': 0.88, 'pos': [-58, 70, -46], 'mira': [CX, SUELO_CASA + 5, CZ]},
    {'p': 0.935, 'pos': [-30, 64, -10], 'mira': [CX + 6, SUELO_CASA + 6.5, CZ - 6]},
    {'p': 0.968, 'pos': [-12, Y_TERRAZA + 0.8, 0.5], 'mira': [-60, SUELO_CASA - 3, -70]},
    {'p': 1.00, 'pos': [FRENTE[0], Y_TERRAZA, FRENTE[1]], 'mira': MIRA_FIN},
]
for r_ in rec:
    r_['pos'] = [round(float(v), 2) for v in r_['pos']]; r_['mira'] = [round(float(v), 2) for v in r_['mira']]


def monotona(ps, vs):
    """La misma interpolación que lugar.js (Hermite con tangentes de Fritsch-Butland, en reposo en los extremos)."""
    n = len(ps); d = [(vs[i + 1] - vs[i]) / (ps[i + 1] - ps[i]) for i in range(n - 1)]; m = [0.0] * n
    for i in range(1, n - 1):
        if d[i - 1] * d[i] <= 0:
            continue
        h0, h1 = ps[i] - ps[i - 1], ps[i + 1] - ps[i]
        m[i] = 3 * (h0 + h1) / ((2 * h1 + h0) / d[i - 1] + (h1 + 2 * h0) / d[i])
    def f(p):
        if p <= ps[0]: return vs[0]
        if p >= ps[-1]: return vs[-1]
        k = 0
        while k < n - 2 and p > ps[k + 1]: k += 1
        h = ps[k + 1] - ps[k]; t = (p - ps[k]) / h; t2 = t * t; t3 = t2 * t
        return (2 * t3 - 3 * t2 + 1) * vs[k] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * vs[k + 1] + (t3 - t2) * h * m[k + 1]
    return f


ps_ = [r['p'] for r in rec]
fpos = [monotona(ps_, [r['pos'][k] for r in rec]) for k in range(3)]
# los árboles que tocan la trayectoria de cerca o tapan la vista final (de la terraza a la bocana) se quitan:
# la vista existe (la webcam la enseña) y la posición de cada copa es aproximada
P_ = np.array([[f(p) for f in fpos] for p in np.linspace(0, 1, 3000)])
quitar = set()
for i, t in enumerate(arboles + [[o[0], o[1], o[2], o[3], 0] for o in olivos]):
    dmin = np.min(np.hypot(P_[:, 0] - t[0], P_[:, 2] - t[2]) - t[3])
    if dmin < 9:
        k = int(np.argmin(np.hypot(P_[:, 0] - t[0], P_[:, 2] - t[2])))
        top = t[1] + (t[4] if len(t) > 4 and t[4] else t[3] * 2.6)
        if P_[k, 1] < top + 6:
            quitar.add(i)
fin = np.array(rec[-1]['pos']); vb = np.array(MIRA_FIN) - fin
for i, t in enumerate(arboles):
    w = np.array([t[0], 0, t[2]]) - fin
    s_ = np.clip(np.dot(w[[0, 2]], vb[[0, 2]]) / np.dot(vb[[0, 2]], vb[[0, 2]]), 0, 1)
    q = fin + s_ * vb
    if s_ > 0 and math.hypot(q[0] - t[0], q[2] - t[2]) < t[3] + 1.5 and t[1] + t[4] > q[1] - 0.5:
        quitar.add(i)
n_ant = len(arboles)
arboles = [t for i, t in enumerate(arboles) if i not in quitar]
print('árboles quitados por la trayectoria o la vista final:', n_ant - len(arboles))

# holgura: altura de la cámara sobre el relieve, los árboles, los espigones y la casa, en todo el recorrido
rej = {}
for t in arboles:
    rej.setdefault((int(t[0] // 20), int(t[2] // 20)), []).append(t)
def tope_arboles(x, z):
    best = -1e9
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            for t in rej.get((int(x // 20) + di, int(z // 20) + dj), ()):
                if math.hypot(x - t[0], z - t[2]) < t[3] + 2.5:
                    best = max(best, t[1] + t[4])
    return best
hol = []
for p in np.linspace(0, 1, 2001):
    x, y, z = (f(p) for f in fpos)
    suelo = max(float(alt_xz(x, z)[0]), 2.6)             # el agua llega como mucho a +1,6 m
    arb = tope_arboles(x, z)
    hol.append((p, y - suelo, y - max(suelo, arb)))
hol = np.array(hol)
for a, b in ((0, 0.3), (0.3, 0.6), (0.6, 0.85), (0.85, 0.95), (0.95, 1.001)):
    m = (hol[:, 0] >= a) & (hol[:, 0] < b)
    k = np.argmin(hol[m, 2])
    print(f'holgura {a:.2f}-{b:.2f}: mínima {hol[m, 2].min():.1f} m sobre relieve/árboles (en p={hol[m, 0][k]:.3f}), {hol[m, 1].min():.1f} m sobre el suelo')


# ------------------------------------------------------------------ ortofoto de la finca, sin tejados
# Los edificios se levantan en 3D: debajo, el color medio de alrededor (convolución normalizada) con algo de grano.
ofa = np.asarray(orto_f, np.uint8).copy()
masc = Image.fromarray((mascara_edificios(FINCA, FW, FW, 1.8) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))
m_ = np.asarray(masc, np.float32)[..., None] / 255.0
libre_ = 1.0 - m_
num = np.stack([ndimage.gaussian_filter(ofa[..., k] * libre_[..., 0], 20) for k in range(3)], -1)
den = ndimage.gaussian_filter(libre_[..., 0], 20)[..., None] + 1e-4
relleno = num / den * (0.93 + 0.07 * np.random.default_rng(3).random(ofa.shape[:2] + (1,)))
suave_ = ndimage.gaussian_filter(m_[..., 0], 2.5)[..., None]
ofa = np.clip(ofa * (1 - suave_) + relleno * suave_, 0, 255).astype(np.uint8)
orto_f2 = Image.fromarray(ofa)
orto_f2.save(OUT / 'orto-finca-2048.webp', quality=72, method=6)
orto_f2.resize((1024, 1024), Image.LANCZOS).save(OUT / 'orto-finca-1024.webp', quality=76, method=6)


# ------------------------------------------------------------------ plan B (1): la ría desde el aire, con el recorrido
# La foto sin tocar (PNOA z18), de la bocana a la finca. El recorrido y los rótulos se dibujan encima en lugar.js (SVG).
MAPA = RIA
orto_r.resize((1000, int(round(1000 * orto_r.height / orto_r.width))), Image.LANCZOS).save(OUT / 'plano-ria-1000.webp', quality=74, method=6)
orto_r.resize((640, int(round(640 * orto_r.height / orto_r.width))), Image.LANCZOS).save(OUT / 'plano-ria-640.webp', quality=76, method=6)


def en_mapa(x, z):
    return [round((x - MAPA[0]) / (MAPA[2] - MAPA[0]) * 100, 2), round((z - MAPA[1]) / (MAPA[3] - MAPA[1]) * 100, 2)]


ruta_mapa = []
for p in np.linspace(0, 1, 160):
    x, y, z = (f(p) for f in fpos)
    if MAPA[0] <= x <= MAPA[2] and MAPA[1] <= z <= MAPA[3]:
        ruta_mapa.append(en_mapa(x, z))
marcas_mapa = [{'clave': l['clave'], 'pos': en_mapa(l['x'], l['z'])} for l in lugares
               if MAPA[0] < l['x'] < MAPA[2] and MAPA[1] < l['z'] < MAPA[3]]


# ------------------------------------------------------------------ plan B (2) y póster: la vista desde el mar, dibujada
def vista(W, Hh, pos, mira, fov=42.0):                 # 42°: el campo vertical del 3D en escritorio
    """Render por columnas (voxel space): relieve real + ortofoto, con bruma, mar y cielo. Sin WebGL."""
    px_, py_, pz_ = pos
    yaw = math.atan2(mira[0] - px_, mira[2] - pz_)
    pitch = math.atan2(mira[1] - py_, math.hypot(mira[0] - px_, mira[2] - pz_))
    f = (Hh / 2) / math.tan(math.radians(fov / 2))
    K = 2400
    d = 30.0 * (60000 / 30.0) ** (np.arange(K) / (K - 1))
    cols = np.arange(W) - W / 2 + 0.5
    ang = yaw - np.arctan(cols / f)            # a la derecha de la imagen, a la derecha del que mira (sin espejo)
    cosd = np.cos(ang - yaw)
    X = px_ + np.outer(d, np.sin(ang)); Z = pz_ + np.outer(d, np.cos(ang))
    lat, lon = geo(X, Z)
    h = alt_en(lat, lon)
    agua_ = h < 0.3
    hv = np.where(agua_, 0.0, h)
    prof = d[:, None] * cosd[None, :]
    y = Hh / 2 - f * (hv - py_) / prof + f * math.tan(pitch)      # mirando hacia abajo (pitch < 0), el horizonte sube
    oc_ = np.asarray(orto_c2, np.float32)

    def col_de(img, caja):
        S, N, O, E = caja
        fy = (N - lat) / (N - S) * img.shape[0] - 0.5; fx = (lon - O) / (E - O) * img.shape[1] - 0.5
        return np.stack([ndimage.map_coordinates(img[..., c], [fy, fx], order=1, mode='nearest') for c in range(3)], -1)
    color = col_de(olg, CAJA25)
    dentro_ = (lat >= CS) & (lat <= CN) & (lon >= CO) & (lon <= CE)
    cc = col_de(oc_, CAJA5); color[dentro_] = cc[dentro_]
    e = 10.0
    hx = alt_en(*geo(X + e, Z)); hz = alt_en(*geo(X, Z + e))
    nx_, nz_ = -(hx - h) / e, -(hz - h) / e
    luz = np.array([0.35, 0.6, 0.72]); luz /= np.linalg.norm(luz)            # sol de mediodía, del sur
    sh = (nx_ * luz[0] + luz[1] + nz_ * luz[2]) / np.sqrt(nx_ ** 2 + nz_ ** 2 + 1)
    color *= np.clip(0.6 + 0.6 * sh, 0.4, 1.2)[..., None]
    dc = np.where(dentro_, ndimage.map_coordinates(dist_tierra, [(CN - lat) / (CN - CS) * dist_tierra.shape[0] - 0.5,
                                                                 (lon - CO) / (CE - CO) * dist_tierra.shape[1] - 0.5], order=1, mode='nearest'), 2000)
    somero = np.clip(1 - dc / 220, 0, 1)
    mar_c = np.array([20, 58, 80], np.float32) * (1 - somero[..., None]) + np.array([44, 112, 122], np.float32) * somero[..., None]
    rasante = np.clip(1 - (py_ / prof) * 6, 0, 1)[..., None]
    mar_c = mar_c * (1 - 0.5 * rasante) + np.array([196, 208, 216], np.float32) * 0.5 * rasante
    espuma = (dc < 12) & agua_ & ~(dentro_ & (Z > -790) & (X > -1150) & (X < 50))
    mar_c[espuma] = [232, 238, 236]
    color = np.where(agua_[..., None], mar_c, color)
    bruma = np.array([206, 214, 222], np.float32)
    kf = 1 - np.exp(-(d / 30000.0) ** 2 * 1.6)
    color = color * (1 - kf[:, None, None]) + bruma * kf[:, None, None]
    img = np.zeros((Hh, W, 3), np.float32)
    filas = np.arange(Hh)
    yy = np.minimum.accumulate(np.minimum(y, Hh), axis=0)
    cielo_t = np.array([112, 154, 204], np.float32); cielo_h = np.array([224, 230, 234], np.float32)
    for c_ in range(W):
        col_y = yy[:, c_]
        idx = np.searchsorted(-col_y, -filas, side='left')
        ok = idx < K
        img[ok, c_] = color[idx[ok], c_]
        t = np.clip(filas[~ok] / (Hh * 0.55), 0, 1)[:, None]
        img[~ok, c_] = cielo_t * (1 - t) + cielo_h * t
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)), (f, yaw, pitch)


def proyecta(pt, pos, f, yaw, pitch, W, Hh):
    dx, dz = pt[0] - pos[0], pt[2] - pos[2]
    fr = dx * math.sin(yaw) + dz * math.cos(yaw); la = -dx * math.cos(yaw) + dz * math.sin(yaw)   # «la»: a la derecha, positivo
    if fr <= 0:
        return None
    return (W / 2 + f * la / fr, Hh / 2 - f * (pt[1] - pos[1]) / fr + f * math.tan(pitch))


WB, HB = 1600, 1000
p0 = rec[0]
vista_img, (fB, yawB, pitchB) = vista(WB, HB, p0['pos'], p0['mira'])
vista_img.save(OUT / 'vista-mar-1600.webp', quality=74, method=6)
vista_img.resize((960, 600), Image.LANCZOS).save(OUT / 'vista-mar-960.webp', quality=76, method=6)
marcas_vista = []
for l in lugares:
    if not any(a <= 0.001 for a, b in l['fases']):
        continue
    pr = proyecta((l['x'], l['y'], l['z']), p0['pos'], fB, yawB, pitchB, WB, HB)
    if pr and 0 < pr[0] < WB and 0 < pr[1] < HB:
        marcas_vista.append({'clave': l['clave'], 'x': round(pr[0] / WB * 100, 2), 'y': round(pr[1] / HB * 100, 2)})
print('vista desde el mar, marcas', marcas_vista)


# ------------------------------------------------------------------ salida
def r2(v): return round(float(v), 2)


escena = {
    'version': 1,
    'origen': {'lat': CASA[0], 'lon': CASA[1], 'nota': 'Turismo de Asturias'},
    'kx': round(KX, 3), 'kz': KZ,
    'rasters': rasters,
    'orto': {
        'cerca': {'x0': rasters['cerca']['x0'], 'z0': rasters['cerca']['z0'], 'x1': rasters['cerca']['x1'], 'z1': rasters['cerca']['z1'],
                  'archivos': {'alta': 'orto-cerca-2560.webp', 'baja': 'orto-cerca-1280.webp'}},
        'ria': {'x0': RIA[0], 'z0': RIA[1], 'x1': RIA[2], 'z1': RIA[3], 'archivos': {'alta': 'orto-ria-1600.webp', 'baja': 'orto-ria-800.webp'}},
        'finca': {'x0': FINCA[0], 'z0': FINCA[1], 'x1': FINCA[2], 'z1': FINCA[3], 'archivos': {'alta': 'orto-finca-2048.webp', 'baja': 'orto-finca-1024.webp'}},
        'lejos': {'x0': rasters['lejos']['x0'], 'z0': rasters['lejos']['z0'], 'x1': rasters['lejos']['x1'], 'z1': rasters['lejos']['z1'],
                  'archivos': {'alta': 'orto-lejos-1600.webp', 'baja': 'orto-lejos-1600.webp'}},
        'agua': {'archivo': 'agua.png', 'metros_por_unidad': 3.0},
    },
    'marea': {'max': MAREA_MAX, 'arenales_ha': round(float(arenal.sum()) * paso5[0] * paso5[1] / 1e4, 1),
              'arenal_cota': [0.5, 1.5], 'nota': 'MDT05 a 1 m (redondeado) en los arenales; marea de Open-Meteo Marine (sea_level_height_msl)'},
    'casa': CASA_ROJA, 'parcela': [[r2(x), r2(z)] for x, z in PARCELA], 'parcela_m2': PARCELA_M2,
    'edificios': edificios, 'espigones': ESPIGONES,
    'olivos': olivos, 'arboles': arboles,
    'lugares': lugares, 'recorrido': rec, 'yTerraza': Y_TERRAZA,
    'planB': {'mapa': {'archivos': ['plano-ria-640.webp', 'plano-ria-1000.webp'], 'ancho': 1000, 'alto': int(round(1000 * orto_r.height / orto_r.width)),
                       'caja': list(MAPA), 'ruta': ruta_mapa, 'marcas': marcas_mapa},
              'vista': {'archivos': ['vista-mar-960.webp', 'vista-mar-1600.webp'], 'ancho': WB, 'alto': HB, 'marcas': marcas_vista}},
    'fuentes': {
        'ign': 'Relieve MDT05 y MDT25 y ortofoto PNOA © Instituto Geográfico Nacional (CC BY 4.0)',
        'catastro': 'Planta de los edificios © Dirección General del Catastro',
        'osm': 'Lugares © colaboradores de OpenStreetMap (ODbL)',
        'marea': 'Marea: Open-Meteo Marine (CC BY 4.0)',
    },
    'fecha_datos': time.strftime('%Y-%m-%d'),
}
(DATA / 'lugar-escena.json').write_text(json.dumps(escena, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
resumen = {
    'cotaFinca': COTA_FINCA,
    'cotaFincaNota': 'metros sobre el nivel medio del mar: terreno en el centro de la casa roja (MDT05 del IGN)',
    'cotaTerraza': round(Y_TERRAZA - 1.6, 1),
    'distanciaPlaya': int(round(D_PLAYA / 10) * 10),
    'distanciaPlayaNota': 'metros en línea recta del centro de la casa al borde de la playa de Navia (polígono de OSM)',
    'distanciaBocana': int(round(D_BOCANA / 10) * 10),
    'distanciaNavia': int(round(D_NAVIA / 10) * 10),
    'arenalesHa': escena['marea']['arenales_ha'],
    'fuente': 'scripts/lugar-datos.py (agente Lugar 3D)',
    'fecha': time.strftime('%Y-%m-%d'),
}
(DATA / 'lugar.json').write_text(json.dumps(resumen, ensure_ascii=False, indent=1), encoding='utf-8')
print('lugar.json', resumen)
tot = 0
for f_ in sorted(OUT.iterdir()):
    tot += f_.stat().st_size; print(f'{f_.name:28s} {f_.stat().st_size // 1024:6d} KB')
print('total img/lugar', tot // 1024, 'KB · escena', (DATA / 'lugar-escena.json').stat().st_size // 1024, 'KB')
