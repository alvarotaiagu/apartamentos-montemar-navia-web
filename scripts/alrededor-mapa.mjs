// Datos del mapa interactivo de «Alrededor»: costa, río Navia y sus embalses, río Eo, sitios de referencia y el
// TRAZADO de cada ruta. Receta de ../amaicha-ribadesella-web/scripts/alrededor-mapa.mjs.
//   node scripts/alrededor-mapa.mjs   → data/alrededor-mapa.json   (lo pide js/alrededor.js al acercarse)
// Lee ref/raw/rutas.json (cifras de OSRM, scripts/alrededor-rutas.mjs): aquí solo se añaden las líneas.
// Fuentes: OpenStreetMap (ODbL) vía Overpass; rutas de OSRM (coche) y routing.openstreetmap.de (a pie).
// Proyección: metros alrededor de la casa (equirrectangular con cos(lat) de la casa); x al este, y al SUR (como SVG).
// Caché de las descargas en ref/raw/mapa-cache/ (se puede borrar para rehacer).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { overpass, dormir, UA } from './alrededor-util.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(RAIZ, 'ref/raw/mapa-cache');
fs.mkdirSync(CACHE, { recursive: true });
const R = JSON.parse(fs.readFileSync(path.join(RAIZ, 'ref/raw/rutas.json'), 'utf8'));
const CASA = R.casa;

const RAD = Math.PI / 180, KX = 111320 * Math.cos(CASA.lat * RAD), KY = 110574;
const P = ([lon, lat]) => [(lon - CASA.lon) * KX, -(lat - CASA.lat) * KY];
const PG = (p) => P([p.lon, p.lat]);

async function cacheado(nombre, fn) {
  const f = path.join(CACHE, nombre);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  const j = await fn();
  fs.writeFileSync(f, JSON.stringify(j));
  return j;
}
async function pedir(url) {
  for (let i = 0; i < 5; i++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) }); if (r.ok) { const j = await r.json(); if (j.code === 'Ok') return j; } } catch (e) { /* reintenta */ }
    await dormir(2500);
  }
  throw new Error('falla ' + url);
}

// ---------- geometría ----------
function simplificar(pts, tol) {               // Ramer–Douglas–Peucker iterativo
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const pila = [[0, pts.length - 1]], t2 = tol * tol;
  while (pila.length) {
    const [a, b] = pila.pop(); const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    let max = -1, im = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i]; let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
      const ex = ax + t * dx - px, ey = ay + t * dy - py, d = ex * ex + ey * ey;
      if (d > max) { max = d; im = i; }
    }
    if (max > t2) { keep[im] = 1; pila.push([a, im], [im, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
// un anillo cerrado se parte por el vértice más lejano al primero (si no, la recta base mide 0 y se queda en 2 puntos)
function simplificarAnillo(pts, tol) {
  if (pts.length < 5) return pts.slice();
  let im = 0, max = -1;
  pts.forEach(([x, y], i) => { const d = (x - pts[0][0]) ** 2 + (y - pts[0][1]) ** 2; if (d > max) { max = d; im = i; } });
  return simplificar(pts.slice(0, im + 1), tol).concat(simplificar(pts.slice(im), tol).slice(1));
}
// camino SVG compacto: M absoluto y luego l relativos, con la precisión que pida el nivel de detalle
function camino(pts, dec = 0, cerrar = false) {
  const f = 10 ** dec, r = (v) => Math.round(v * f) / f;
  let s = 'M' + r(pts[0][0]) + ' ' + r(pts[0][1]), px = r(pts[0][0]), py = r(pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const x = r(pts[i][0]), y = r(pts[i][1]), dx = r(x - px), dy = r(y - py);
    if (!dx && !dy) continue;
    s += 'l' + dx + (dy < 0 ? '' : ' ') + dy; px = x; py = y;
  }
  return s.replace(/ -/g, '-') + (cerrar ? 'z' : '');
}
const dentro = ([x, y], c) => x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1;
const caja = (o, s, e, n) => { const [x0, y1] = P([o, s]), [x1, y0] = P([e, n]); return { x0, x1, y0, y1 }; };
const clave = (p) => p.lon.toFixed(7) + ',' + p.lat.toFixed(7);
// une trozos (listas de {lon, lat}) por sus extremos, en cualquier sentido
function unir(piezas) {
  piezas = piezas.map((p) => p.slice());
  const cadenas = [];
  while (piezas.length) {
    let c = piezas.pop(), creció = true;
    while (creció) {
      creció = false;
      for (let i = 0; i < piezas.length; i++) {
        const t = piezas[i];
        if (clave(t[0]) === clave(c[c.length - 1])) { c = c.concat(t.slice(1)); piezas.splice(i, 1); creció = true; break; }
        if (clave(t[t.length - 1]) === clave(c[c.length - 1])) { c = c.concat(t.slice(0, -1).reverse()); piezas.splice(i, 1); creció = true; break; }
        if (clave(t[t.length - 1]) === clave(c[0])) { c = t.concat(c.slice(1)); piezas.splice(i, 1); creció = true; break; }
        if (clave(t[0]) === clave(c[0])) { c = t.slice(1).reverse().concat(c); piezas.splice(i, 1); creció = true; break; }
      }
    }
    cadenas.push(c);
  }
  return cadenas;
}

// ---------- costa: une las vías de natural=coastline en cadenas ----------
// De la playa de las Catedrales (oeste) al aeropuerto de Asturias (este), con holgura para que ninguna vista se salga.
const BB = { s: 43.10, o: -7.45, n: 43.80, e: -5.75 };
const costaOSM = await cacheado('costa.json', () => overpass(`[out:json][timeout:180];way["natural"="coastline"](${BB.s},${BB.o},${BB.n},${BB.e});out geom;`, { timeout: 200000 }));
let trozos = costaOSM.elements.filter((w) => w.geometry).map((w) => w.geometry.slice());
const cadenas = [];
while (trozos.length) {                         // en OSM la costa va siempre con la tierra a la izquierda: se une sin girar
  let c = trozos.pop(), creció = true;
  while (creció) {
    creció = false;
    for (let i = 0; i < trozos.length; i++) {
      const t = trozos[i];
      if (clave(t[0]) === clave(c[c.length - 1])) { c = c.concat(t.slice(1)); trozos.splice(i, 1); creció = true; break; }
      if (clave(t[t.length - 1]) === clave(c[0])) { c = t.concat(c.slice(1)); trozos.splice(i, 1); creció = true; break; }
    }
  }
  cadenas.push(c);
}
const abiertas = cadenas.filter((c) => clave(c[0]) !== clave(c[c.length - 1])).sort((a, b) => b.length - a.length);
const islas = cadenas.filter((c) => clave(c[0]) === clave(c[c.length - 1]) && c.length > 6);
const tierra = abiertas[0].map(PG);             // va de este a oeste
console.log('costa:', costaOSM.elements.length, 'vías →', cadenas.length, 'cadenas;', abiertas.length, 'abiertas (la mayor,', tierra.length, 'puntos; las demás:', abiertas.slice(1).map((c) => c.length).join(','), ');', islas.length, 'islas');
console.log('  la costa va de x =', Math.round(tierra[0][0]), 'a x =', Math.round(tierra[tierra.length - 1][0]), 'm');

// el mar de un nivel de detalle: el tramo de costa dentro de su caja, cerrado MUY al norte (300 km): las vistas largas
// (aeropuerto, Oscos) suben más allá del borde de la caja y ahí tiene que seguir habiendo mar, no el color de la tierra
function mar(c, tol) {
  const i0 = tierra.findIndex((p) => dentro(p, c)), i1 = tierra.length - 1 - [...tierra].reverse().findIndex((p) => dentro(p, c));
  const tramo = tierra.slice(Math.max(0, i0 - 1), Math.min(tierra.length, i1 + 2));
  const s = simplificar(tramo, tol);
  const ini = s[0], fin = s[s.length - 1];
  const anillo = s.concat([[fin[0], c.y0 - 300000], [ini[0], c.y0 - 300000]]);
  const isl = islas.map((c2) => c2.map(PG)).filter((r) => r.some((p) => dentro(p, c))).map((r) => simplificarAnillo(r, tol)).filter((r) => r.length > 3);
  const dec = tol < 10 ? 1 : 0;
  return { caja: [c.x0, c.y0, c.x1, c.y1].map(Math.round), d: camino(anillo, dec, true), islas: isl.map((r) => camino(r, dec, true)), costa: camino(s, dec) };
}
const niveles = [
  { nombre: 'cerca', ancho_max: 9000, ...mar(caja(-6.82, 43.50, -6.60, 43.61), 4) },
  { nombre: 'medio', ancho_max: 70000, ...mar(caja(-7.32, 43.18, -6.38, 43.66), 28) },
  { nombre: 'lejos', ancho_max: Infinity, ...mar(caja(BB.o, BB.s, BB.e, BB.n), 150) },
];
niveles.forEach((n) => console.log('mar', n.nombre, Math.round((n.d.length + n.costa.length) / 1024), 'KB,', n.islas.length, 'islas'));

// ---------- los ríos: el Navia (el valle de «Tierra adentro») y el Eo (la raya con Galicia) ----------
const riosOSM = await cacheado('rios.json', () => overpass(`[out:json][timeout:120];way["waterway"="river"]["name"~"^(R[íi]o Navia|R[íi]o Eo|Navia|Eo)$"](${BB.s},-7.40,43.57,-6.55);out geom tags;`, { timeout: 150000 }));
const porRio = {};
riosOSM.elements.filter((w) => w.geometry).forEach((w) => { const n = /Eo/.test(w.tags.name) ? 'eo' : 'navia'; (porRio[n] = porRio[n] || []).push(w.geometry); });
const rios = {}, rioPts = {};
for (const n of Object.keys(porRio)) {
  const cs = unir(porRio[n]).map((c) => c.map(PG)).filter((c) => c.length > 1);
  rioPts[n] = cs.sort((a, b) => b.length - a.length)[0];
  rios[n] = cs.map((c) => camino(simplificar(c, 30), 0)).join('');
  console.log('río', n + ':', porRio[n].length, 'vías →', cs.length, 'cadenas,', Math.round(rios[n].length / 1024 * 10) / 10, 'KB');
}

// ---------- los embalses del Navia: Arbón, Doiras y Salime ----------
let embalses = '';
try {
  const embOSM = await cacheado('embalses.json', () => overpass(`[out:json][timeout:120];(way["natural"="water"]["name"~"Arb[óo]n|Doiras|Salime"](43.15,-7.05,43.52,-6.60);relation["natural"="water"]["name"~"Arb[óo]n|Doiras|Salime"](43.15,-7.05,43.52,-6.60););out geom tags;`, { timeout: 150000 }));
  const anillos = [];
  embOSM.elements.forEach((e) => {
    if (e.type === 'way' && e.geometry) anillos.push(e.geometry);
  });
  // Salime es una relación y Overpass la devuelve sin sus vías: se piden aparte y se toma el anillo mayor (la orilla)
  const sal = await cacheado('salime.json', () => overpass('[out:json][timeout:120];relation["natural"="water"]["name"~"Salime"](43.15,-7.05,43.52,-6.60);way(r);out geom;', { timeout: 150000 }));
  const orilla = unir(sal.elements.filter((w) => w.geometry).map((w) => w.geometry)).sort((p, q) => q.length - p.length)[0];
  if (orilla) anillos.push(orilla);
  embalses = anillos.filter((a) => a.length > 8).map((a) => camino(simplificarAnillo(a.map(PG), 25), 0, true)).join('');
  console.log('embalses:', embOSM.elements.map((e) => e.tags && e.tags.name).join(', '), '→', anillos.length, 'anillos,', Math.round(embalses.length / 1024 * 10) / 10, 'KB');
} catch (e) { console.warn('sin embalses:', e.message); }

// ---------- de cerca: las playas y el callejero de Navia (solo se ven en las vistas a pie) ----------
const CERCA = { s: 43.528, o: -6.765, n: 43.566, e: -6.675 };
let playas = '', calles = { a: '', b: '' };
try {
  const plOSM = await cacheado('playas.json', () => overpass(`[out:json][timeout:60];way["natural"="beach"](${CERCA.s},${CERCA.o},${CERCA.n},${CERCA.e});out geom tags;`));
  playas = plOSM.elements.filter((w) => w.geometry && w.geometry.length > 3).map((w) => camino(simplificarAnillo(w.geometry.map(PG), 3), 0, true)).join('');
  console.log('playas:', plOSM.elements.map((w) => w.tags.name || '(sin nombre)').join(', '), '→', Math.round(playas.length / 1024 * 10) / 10, 'KB');
} catch (e) { console.warn('sin playas:', e.message); }
try {
  const caOSM = await cacheado('calles.json', () => overpass(`[out:json][timeout:120];way["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|secondary|tertiary|unclassified|residential|living_street|pedestrian|track|path)$"](${CERCA.s},${CERCA.o},${CERCA.n},${CERCA.e});out geom tags;`, { timeout: 150000 }));
  const GORDAS = /^(motorway|motorway_link|trunk|trunk_link|primary|secondary|tertiary)$/;
  const vistos = new Set(), sal = { a: [], b: [] };
  caOSM.elements.filter((w) => w.geometry && w.geometry.length > 1).forEach((w) => {
    const d = camino(simplificar(w.geometry.map(PG), 3), 0);
    if (vistos.has(d) || d.indexOf('l') < 0) return;
    vistos.add(d); sal[GORDAS.test(w.tags.highway) ? 'a' : 'b'].push(d);
  });
  calles = { a: sal.a.join(''), b: sal.b.join('') };
  console.log('calles:', caOSM.elements.length, 'vías →', sal.a.length, 'carreteras (', Math.round(calles.a.length / 1024), 'KB ) y', sal.b.length, 'calles y caminos (', Math.round(calles.b.length / 1024), 'KB )');
} catch (e) { console.warn('sin calles:', e.message); }

// ---------- sitios de referencia (solo para situarse en las vistas largas) ----------
const QUIERO = ['Oviedo', 'Avilés', 'Vegadeo'];
const ciudOSM = await cacheado('ciudades.json', () => overpass(`[out:json][timeout:60];node["place"~"city|town|village"]["name"~"Oviedo|Avilés|Vegadeo"](${BB.s},${BB.o},${BB.n},${BB.e});out;`));
const ciudades = QUIERO.map((n) => {
  const e = ciudOSM.elements.filter((x) => (x.tags.name || '').split(/\s*\/\s*/).some((p) => p === n)).sort((a) => (a.tags.place === 'city' ? -1 : 1))[0];
  if (!e) { console.warn('sin ciudad', n); return null; }
  const [x, y] = PG(e); return { nombre: n, x: Math.round(x), y: Math.round(y) };
}).filter(Boolean);
console.log('referencias:', ciudades.map((c) => c.nombre).join(', '));

// rótulos de agua: el mar, frente a la costa; el río, sobre su curso (a la altura del embalse de Arbón)
const rotulos = [];
{ const [x, y] = P([-6.62, 43.635]); rotulos.push({ nombre: 'Mar Cantábrico', x: Math.round(x), y: Math.round(y), min: 14000 }); }
if (rioPts.navia) {
  const obj = P([CASA.lon, 43.44])[1];
  const p = rioPts.navia.reduce((m, q) => (Math.abs(q[1] - obj) < Math.abs(m[1] - obj) ? q : m));
  rotulos.push({ nombre: 'Río Navia', x: Math.round(p[0]), y: Math.round(p[1]), min: 22000 });
}

// ---------- las rutas ----------
const rutas = {};
for (const id of R.orden) {
  const d = R.destinos[id];
  if (!d || !d.coche) { console.warn(id, 'sin ruta en rutas.json'); continue; }
  const coche = await cacheado(`coche-${id}.json`, () => pedir(`https://router.project-osrm.org/route/v1/driving/${CASA.lon},${CASA.lat};${d.lon},${d.lat}?overview=full&geometries=geojson`));
  const largo = coche.routes[0].distance;
  const tol = Math.max(3, largo / 2500);         // ~2.500 tramos como mucho por ruta
  const pc = coche.routes[0].geometry.coordinates.map(P);
  const r = { coche: camino(simplificar(pc, tol), tol < 10 ? 1 : 0) };
  let pp = [];
  if (d.pie) {
    const pie = await cacheado(`pie-${id}.json`, () => pedir(`https://routing.openstreetmap.de/routed-foot/route/v1/driving/${CASA.lon},${CASA.lat};${d.lon},${d.lat}?overview=full&geometries=geojson`));
    pp = pie.routes[0].geometry.coordinates.map(P);
    r.pie = camino(simplificar(pp, 3), 1);
  }
  const [x, y] = P([d.lon, d.lat]);
  const todos = pc.concat(pp, [[x, y], [0, 0]]);   // caja de la ruta (coche, pie, destino y casa), para encuadrarla
  rutas[id] = { x: Math.round(x), y: Math.round(y), caja: [Math.min(...todos.map((p) => p[0])), Math.min(...todos.map((p) => p[1])), Math.max(...todos.map((p) => p[0])), Math.max(...todos.map((p) => p[1]))].map(Math.round), ...r };
  console.log(id.padEnd(12), Math.round(largo / 100) / 10, 'km (rutas.json:', d.coche.km + ');', Math.round(r.coche.length / 1024 * 10) / 10, 'KB', r.pie ? '+ a pie' : '');
  await dormir(700);
}

const salida = {
  fuente: 'Costa, ríos, embalses, playas, calles y caminos: © colaboradores de OpenStreetMap (ODbL). Rutas: OSRM (coche) y routing.openstreetmap.de (a pie).',
  fecha: R.fecha,
  casa: { lat: CASA.lat, lon: CASA.lon },
  niveles, rios: Object.values(rios).join(''), embalses, playas, calles, ciudades, rotulos, rutas,
};
fs.mkdirSync(path.join(RAIZ, 'data'), { recursive: true });
const txt = JSON.stringify(salida);
fs.writeFileSync(path.join(RAIZ, 'data/alrededor-mapa.json'), txt);
console.log('data/alrededor-mapa.json', Math.round(txt.length / 1024), 'KB');
