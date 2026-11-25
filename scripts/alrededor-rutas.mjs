// Distancias de «Alrededor» con OSRM (servidor público, perfil coche, datos de OpenStreetMap ODbL) y, a pie, con el
// perfil foot de routing.openstreetmap.de. Receta de ../amaicha-ribadesella-web/scripts/alrededor-rutas.mjs.
// Origen: las coordenadas de la casa de ref/DATOS-MONTEMAR.md (Turismo de Asturias: 43.548577, -6.718882).
// Destinos: se buscan en OpenStreetMap con Overpass por nombre y tipo (los ids que salen quedan en rutas.json).
//   node scripts/alrededor-rutas.mjs   → ref/raw/rutas.json   (lo lee construir.mjs; nada se escribe a ojo)
// Si un destino no se encuentra o un servicio no responde, ese destino queda «por confirmar» (sin cifra).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { osrm, overpass, dormir, hav, UA } from './alrededor-util.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CASA = { lat: 43.548577, lon: -6.718882, fuente: 'ref/DATOS-MONTEMAR.md (Turismo de Asturias)' };

// rumbo: oeste (hacia Galicia), este (hacia Luarca y Oviedo), interior (valle del Navia y los Oscos)
const LUGARES = [
  // la playa: se va al punto de la arena más cercano a la casa (no al centro del polígono, que queda a la otra punta)
  { id: 'playa', nombre: 'Playa de Navia', rumbo: 'cerca', pie: true, cercano: true, q: 'way(43.54,-6.75,43.575,-6.70)["natural"="beach"];out geom tags;', elegir: (e) => /navia/i.test(e.tags.name || '') },
  { id: 'navia', nombre: 'Navia', rumbo: 'cerca', pie: true, q: 'node(43.50,-6.78,43.58,-6.68)["place"~"town|village"]["name"="Navia"];out;' },
  { id: 'coana', nombre: 'Castro de Coaña', rumbo: 'interior', q: 'nwr(43.47,-6.82,43.54,-6.70)["historic"="archaeological_site"];out center tags;', elegir: (e) => /castro de co/i.test(e.tags.name || '') },
  { id: 'puertovega', nombre: 'Puerto de Vega', rumbo: 'este', q: 'node(43.53,-6.68,43.58,-6.60)["place"~"town|village|hamlet"]["name"~"Puerto de Vega"];out;' },
  { id: 'luarca', nombre: 'Luarca', rumbo: 'este', q: 'node(43.50,-6.60,43.58,-6.48)["place"~"town|village"]["name"~"Luarca"];out;' },
  { id: 'tapia', nombre: 'Tapia de Casariego', rumbo: 'oeste', q: 'node(43.54,-6.98,43.59,-6.90)["place"~"town|village"]["name"~"Tapia"];out;' },
  { id: 'ribadeo', nombre: 'Ribadeo', rumbo: 'oeste', q: 'node(43.50,-7.08,43.56,-7.00)["place"~"town|village"]["name"="Ribadeo"];out;' },
  { id: 'catedrales', nombre: 'Playa de las Catedrales', rumbo: 'oeste', q: 'nwr(43.53,-7.20,43.57,-7.10)["natural"="beach"];out center tags;', elegir: (e) => /catedra/i.test(e.tags.name || '') },
  { id: 'taramundi', nombre: 'Taramundi', rumbo: 'interior', q: 'node(43.33,-7.15,43.40,-7.05)["place"~"town|village"]["name"="Taramundi"];out;' },
  { id: 'oscos', nombre: 'Santa Eulalia de Oscos', rumbo: 'interior', q: 'node(43.22,-7.08,43.30,-6.98)["place"~"town|village|hamlet"]["name"~"Santa Eulalia de Oscos|Santalla"];out;' },
  { id: 'ovd', nombre: 'Aeropuerto de Asturias', rumbo: 'este', q: 'nwr(43.54,-6.08,43.58,-5.99)["aeroway"="aerodrome"];out center tags;' },
];

async function aPie(a, b) {
  const u = `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(40000) });
      if (r.ok) { const j = await r.json(); if (j.code === 'Ok') return { km: +(j.routes[0].distance / 1000).toFixed(2), minutos: Math.max(1, Math.round(j.routes[0].duration / 60)), snap_destino_m: Math.round(j.waypoints[1].distance) }; }
    } catch (e) { /* reintenta */ }
    await dormir(2000);
  }
  return null;
}
const resumen = (j) => {
  const r = j.routes[0];
  const carreteras = [];
  for (const leg of r.legs) for (const s of leg.steps) { const ref = (s.ref || '').split(';')[0].trim(); if (ref && s.distance > 300 && carreteras[carreteras.length - 1] !== ref) carreteras.push(ref); }
  return { km: +(r.distance / 1000).toFixed(1), minutos: Math.max(1, Math.round(r.duration / 60)), carreteras, snap_destino_m: Math.round(j.waypoints[1].distance) };
};

const salida = {
  fuente: 'OSRM (router.project-osrm.org, perfil coche) y routing.openstreetmap.de/routed-foot (a pie); datos de © colaboradores de OpenStreetMap, ODbL',
  fecha: new Date().toISOString().slice(0, 10),
  nota: 'Tiempos de OSRM con velocidades teóricas, sin tráfico ni paradas: orientativos. snap_destino_m = distancia del punto del lugar al camino más cercano.',
  casa: CASA,
  orden: LUGARES.map((l) => l.id),
  destinos: {},
};
for (const l of LUGARES) {
  const d = { nombre: l.nombre, rumbo: l.rumbo };
  try {
    const j = await overpass('[out:json][timeout:40];' + l.q);
    const els = j.elements.filter((e) => (l.elegir ? l.elegir(e) : true));
    const e = els[0];
    if (!e) throw new Error('sin resultado en OSM');
    let pt = { lat: e.lat ?? (e.center && e.center.lat), lon: e.lon ?? (e.center && e.center.lon) };
    if (l.cercano && e.geometry) pt = e.geometry.reduce((m, g) => (hav(CASA, g) < hav(CASA, m) ? g : m));
    Object.assign(d, { osm: `${e.type}/${e.id}`, osm_nombre: e.tags && e.tags.name, lat: +pt.lat.toFixed(6), lon: +pt.lon.toFixed(6), ...(l.cercano ? { punto: 'el punto de la arena más cercano a la casa' } : {}) });
    d.recta_km = +(hav(CASA, d) / 1000).toFixed(2);
    try { d.coche = resumen(await osrm(CASA, d)); } catch (er) { d.coche = null; d.error_coche = er.message; }
    await dormir(900);
    if (l.pie) d.pie = await aPie(CASA, d);
  } catch (er) {
    d.error = er.message;
  }
  salida.destinos[l.id] = d;
  console.log(l.id.padEnd(11), d.osm || '-', d.osm_nombre || '', '| coche', d.coche ? `${d.coche.km} km ${d.coche.minutos} min ${d.coche.carreteras.join('>')}` : 'POR CONFIRMAR', d.pie ? `| a pie ${d.pie.km} km ${d.pie.minutos} min` : '', '| recta', d.recta_km);
  await dormir(700);
}
const D = salida.destinos;
salida.contraste = {
  su_web: { playa: '600 m, 5 minutos andando', navia: '800 m', luarca: '21 km', tapia: '15 km', ribadeo: '30 km', oscos_taramundi: '30 min' },
  osrm: {
    playa: D.playa.pie ? `${D.playa.pie.km} km a pie, ${D.playa.pie.minutos} min` : 'por confirmar',
    navia: D.navia.pie ? `${D.navia.pie.km} km a pie` : 'por confirmar',
    luarca: D.luarca.coche ? `${D.luarca.coche.km} km` : 'por confirmar',
    tapia: D.tapia.coche ? `${D.tapia.coche.km} km` : 'por confirmar',
    ribadeo: D.ribadeo.coche ? `${D.ribadeo.coche.km} km` : 'por confirmar',
    oscos: D.oscos.coche ? `${D.oscos.coche.minutos} min` : 'por confirmar',
    taramundi: D.taramundi.coche ? `${D.taramundi.coche.minutos} min` : 'por confirmar',
  },
};
fs.mkdirSync(path.join(RAIZ, 'ref/raw'), { recursive: true });
fs.writeFileSync(path.join(RAIZ, 'ref/raw/rutas.json'), JSON.stringify(salida, null, 1));
console.log('contraste', JSON.stringify(salida.contraste, null, 1));
