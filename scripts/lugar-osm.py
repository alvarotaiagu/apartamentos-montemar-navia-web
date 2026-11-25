# Lugares de OpenStreetMap para los rótulos del 3D de Montemar (© colaboradores de OpenStreetMap, ODbL).
# Pide a Overpass (con espejos y reintentos) los candidatos alrededor de la desembocadura de la ría de Navia
# y guarda la respuesta cruda en ref/raw/lugar-cache/osm-navia.json. El emparejado y la comprobación de
# coordenadas los hace scripts/lugar-datos.py (no se fía del nombre: mira etiquetas y distancia).
# Uso: python -I -X utf8 scripts/lugar-osm.py
import json, pathlib, time, urllib.parse, urllib.request

R = pathlib.Path(__file__).resolve().parent.parent
CACHE = R / 'ref' / 'raw' / 'lugar-cache'; CACHE.mkdir(parents=True, exist_ok=True)
UA = 'datos-mapa-script/1.0 (uso puntual)'          # sin datos personales; con UA de navegador Overpass da 406
ESPEJOS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter',
           'https://overpass.private.coffee/api/interpreter', 'https://overpass.osm.ch/api/interpreter']
CAJA = '43.530,-6.765,43.580,-6.680'
Q = f'''[out:json][timeout:90];
(
  node["place"~"town|village|hamlet|locality|suburb|neighbourhood"]({CAJA});
  nwr["man_made"~"breakwater|groyne|pier|lighthouse|beacon"]({CAJA});
  nwr["seamark:type"~"light|beacon"]({CAJA});
  nwr["natural"~"beach|cape|wood|sand|wetland|bay|peak"]["name"]({CAJA});
  nwr["landuse"="forest"]["name"]({CAJA});
  nwr["leisure"="park"]["name"]({CAJA});
  nwr["waterway"="river"]["name"~"Navia",i]({CAJA});
  nwr["name"~"Navia|Pinar|Moro|Frexulfe|Atalaya|Romanellas|Espig|Muelle|Faro",i]({CAJA});
  nwr["tourism"~"apartment|guest_house|hotel"]({CAJA});
);
out center tags;'''
# geometría completa de los espigones, las playas y la ría (para medir distancias y dibujar el plano)
QG = f'''[out:json][timeout:90];
(
  way["man_made"~"breakwater|groyne|pier"]({CAJA});
  nwr["natural"="beach"]({CAJA});
  way["waterway"="river"]["name"~"Navia",i]({CAJA});
);
out geom tags;'''


def pedir(Q):
    datos = urllib.parse.urlencode({'data': Q}).encode()
    espera = 4
    for vuelta in range(4):
        for url in ESPEJOS:
            try:
                req = urllib.request.Request(url, data=datos, headers={'User-Agent': UA})
                cuerpo = urllib.request.urlopen(req, timeout=150).read()
                j = json.loads(cuerpo)
                if 'elements' in j and j['elements']:
                    print('OK', url, len(j['elements']), 'elementos')
                    return j
                print('vacío', url)
            except Exception as e:
                print('falla', url, str(e)[:80])
        print('reintento en', espera, 's'); time.sleep(espera); espera *= 2
    raise SystemExit('Overpass no responde: vuelve a probar más tarde')


j = pedir(Q)
(CACHE / 'osm-navia.json').write_text(json.dumps(j, ensure_ascii=False), encoding='utf-8')
time.sleep(2)
j = pedir(QG)
(CACHE / 'osm-navia-geom.json').write_text(json.dumps(j, ensure_ascii=False), encoding='utf-8')
