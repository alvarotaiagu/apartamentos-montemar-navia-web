/* Comprobación del módulo lugar de Montemar (agente Lugar 3D). NO pinta el 3D.
   1. Funciones puras de js/lugar.js en Node (vm): sol y luna en Navia, la marea (curva y pleamares), el recorrido.
   2. Datos: ficheros de img/lugar/ y data/, cajas, la casa, la parcela, los olivos, los lugares, pesos.
   3. Plan B en Chromium sin WebGL (--disable-3d-apis + navigator.webdriver): monta, imágenes, recorrido y marcas,
      la marea de ahora (Open-Meteo sustituido por datos fijos), alturas PNG bien decodificadas, holgura de la cámara
      sobre el relieve y los árboles en todo el recorrido, sin errores, destruir() repone el respaldo.
   4. La escena 3D con Three.js de verdad y un WebGLRenderer FALSO que no pinta: monta, rótulos y paradas por tramos,
      el agua a la altura de la marea, pausa fuera de pantalla, el botón del móvil, «Ver en plano», destruir().
   Uso: node scripts/lugar-prueba.mjs                 (puerto 8962; un solo Chromium, 1280×800 y 390×844, escala 1)
        node scripts/lugar-prueba.mjs --sin-navegador (solo 1 y 2)
   Antes de lanzarlo, mirar que no haya otra prueba en marcha (CLAUDE.md de WEBS NEGOCIOS). */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = 8962;
let fallos = 0, bien = 0;
const ok = (c, txt) => { if (c) { bien++; console.log('  ok  ', txt); } else { fallos++; console.log('  MAL ', txt); } };

/* ---------- 1. funciones puras ---------- */
console.log('1. funciones puras');
const ctx = { window: {}, document: { currentScript: null }, location: { href: 'http://localhost/', search: '' }, URL, URLSearchParams, Intl, Math, Date, console };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'js/lugar.js'), 'utf8'), ctx, { filename: 'lugar.js' });
const L = ctx.Montemar.lugar;
ok(typeof L.montar === 'function', 'expone Montemar.lugar.montar');
// mediodía solar en Navia (−6,72°): ~12:27 UTC ± ecuación del tiempo. Junio: 90 − 43,55 + 23,44 ≈ 69,9°; diciembre ≈ 23,0°; al sur
const s = L.sol(new Date('2026-06-21T12:29:00Z'));
ok(s.alt > 69 && s.alt < 70.6 && s.az > 175 && s.az < 185, `sol 21-jun 12:29 UTC: ${s.alt.toFixed(1)}° de altura, acimut ${s.az.toFixed(0)}° (sur)`);
const s2 = L.sol(new Date('2026-12-21T12:25:00Z'));
ok(s2.alt > 22.3 && s2.alt < 23.6 && s2.az > 175 && s2.az < 185, `sol 21-dic 12:25 UTC: ${s2.alt.toFixed(1)}°, acimut ${s2.az.toFixed(0)}°`);
const s3 = L.sol(new Date('2026-06-21T05:00:00Z'));
ok(s3.az > 45 && s3.az < 75, `sale por el noreste en junio (acimut ${s3.az.toFixed(0)}° a las 05:00 UTC, altura ${s3.alt.toFixed(1)}°)`);
const lu = L.luna(new Date('2026-11-24T22:00:00Z'));
ok(lu.luz >= 0 && lu.luz <= 1 && lu.fase >= 0 && lu.fase <= 1, `luna: ${(lu.luz * 100).toFixed(0)} % iluminada, fase ${lu.fase.toFixed(2)}`);
ok(/Navia/.test(L.fraseCielo(new Date(), 0.6)) && /60 %/.test(L.fraseCielo(new Date(), 0.6)), 'frase del cielo: ' + L.fraseCielo(new Date(), 0.6));
// marea: una semidiurna de 12,42 h y ±1,9 m, como la de Open-Meteo (horas locales con utc_offset_seconds)
const T0 = Date.UTC(2026, 10, 25, 0, 0) - 3600000, PER = 12.42 * 3600000, FASE = 3.1 * 3600000;
const mareaJ = (t) => 1.9 * Math.cos(2 * Math.PI * (t - FASE - T0) / PER) - 0.15;
const fixture = (desde) => {
  const time = [], v = [];
  for (let h = 0; h < 72; h++) { const t = desde + h * 3600000; const d = new Date(t + 3600000); time.push(d.toISOString().slice(0, 16)); v.push(+mareaJ(t).toFixed(2)); }
  return { utc_offset_seconds: 3600, timezone: 'Europe/Madrid', hourly_units: { sea_level_height_msl: 'm' }, hourly: { time, sea_level_height_msl: v } };
};
const pts = L.leerMarea(fixture(T0));
ok(pts.length === 72 && Math.abs(pts[0].t - T0) < 1, 'leerMarea: 72 horas, hora local → UTC con utc_offset_seconds');
let errMax = 0;
for (let t = T0 + 2 * 3600000; t < T0 + 60 * 3600000; t += 600000) errMax = Math.max(errMax, Math.abs(L.mareaEn(pts, t).v - mareaJ(t)));
ok(errMax < 0.06, `mareaEn entre horas: error máximo ${errMax.toFixed(3)} m`);
const ext = L.extremos(pts);
const pleaEsperada = T0 + FASE + PER;          // la segunda pleamar
const plea = ext.filter((x) => x.alta).sort((a, b) => Math.abs(a.t - pleaEsperada) - Math.abs(b.t - pleaEsperada))[0];
ok(plea && Math.abs(plea.t - pleaEsperada) < 12 * 60000 && Math.abs(plea.v - 1.75) < 0.05, `pleamar afinada: ${plea ? ((plea.t - pleaEsperada) / 60000).toFixed(1) + ' min de error, ' + plea.v.toFixed(2) + ' m' : 'no sale'}`);
ok(ext.length >= 9 && ext.length <= 12, `pleamares y bajamares en 3 días: ${ext.length}`);
const fr = L.fraseMarea({ pts, ext }, new Date(T0 + FASE + PER / 4));   // a media marea, bajando
ok(fr && fr.baja && /bajando/.test(fr.texto) && fr.prox.length === 2 && !fr.prox[0].alta, 'frase de la marea: ' + (fr && fr.texto));

const meta = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/lugar-escena.json'), 'utf8'));
const ruta = L.camino(meta.recorrido);
let pasaDeLargo = 0, salto = 0, prev = null;
for (let i = 0; i <= 4000; i++) {
  const p = i / 4000, r = ruta(p);
  for (let k = 0; k < 3; k++) {
    const vs = meta.recorrido.map((x) => x.pos[k]);
    if (r.pos[k] < Math.min(...vs) - 0.01 || r.pos[k] > Math.max(...vs) + 0.01) pasaDeLargo++;
  }
  if (prev) salto = Math.max(salto, Math.hypot(r.pos[0] - prev[0], r.pos[1] - prev[1], r.pos[2] - prev[2]));
  prev = r.pos;
}
ok(pasaDeLargo === 0, 'el recorrido no se sale del rango de sus puntos');
ok(salto < 12, `paso máximo entre 1/4000 de scroll: ${salto.toFixed(2)} m`);
const r1 = ruta(1), fin = meta.recorrido.at(-1);
ok(Math.hypot(r1.pos[0] - fin.pos[0], r1.pos[2] - fin.pos[2]) < 0.01, 'acaba en la terraza');
const az = (Math.atan2(r1.mira[0] - r1.pos[0], -(r1.mira[2] - r1.pos[2])) * 180 / Math.PI + 360) % 360;
ok(az > 315 && az < 340, `al final mira al noroeste, a la bocana (acimut ${az.toFixed(0)}°), como su webcam`);

/* ---------- 2. datos ---------- */
console.log('2. datos');
const dir = path.join(RAIZ, 'img/lugar');
const usados = new Set([meta.orto.agua.archivo, ...meta.planB.vista.archivos, ...meta.planB.mapa.archivos]);
Object.values(meta.rasters).forEach((r) => usados.add(r.archivo));
['cerca', 'ria', 'finca', 'lejos'].forEach((k) => Object.values(meta.orto[k].archivos).forEach((a) => usados.add(a)));
usados.forEach((f) => ok(fs.existsSync(path.join(dir, f)), 'existe img/lugar/' + f));
const sobran = fs.readdirSync(dir).filter((f) => !usados.has(f));
ok(sobran.length === 0, 'ningún fichero sin usar en img/lugar/' + (sobran.length ? ': ' + sobran.join(', ') : ''));
const tam = (f) => fs.statSync(path.join(dir, f)).size;
const peso = fs.readdirSync(dir).reduce((a, f) => a + tam(f), 0);
ok(peso < 4.2e6, `peso de img/lugar/: ${(peso / 1048576).toFixed(2)} MB`);
const three = fs.statSync(path.join(RAIZ, 'vendor/three-0.160.0.module.min.js')).size;
const escena = fs.statSync(path.join(RAIZ, 'data/lugar-escena.json')).size;
const alturas = Object.values(meta.rasters).reduce((a, r) => a + tam(r.archivo), 0) + tam(meta.orto.agua.archivo);
const pesoEsc = alturas + ['cerca', 'ria', 'finca'].reduce((a, k) => a + tam(meta.orto[k].archivos.alta), 0) + tam(meta.orto.lejos.archivos.alta) + tam('vista-mar-1600.webp') + three + escena;
const pesoMov = alturas + ['cerca', 'ria', 'finca'].reduce((a, k) => a + tam(meta.orto[k].archivos.baja), 0) + tam(meta.orto.lejos.archivos.baja) + tam('vista-mar-960.webp') + three + escena;
const pesoB = tam('plano-ria-640.webp') + tam('vista-mar-960.webp') + escena;
console.log(`       lo que baja el 3D: escritorio ${(pesoEsc / 1048576).toFixed(2)} MB · móvil ${(pesoMov / 1048576).toFixed(2)} MB (Three.js incluido, sin gzip) · plan B ${(pesoB / 1024).toFixed(0)} KB`);
ok(pesoEsc < 4.5e6 && pesoMov < 2.6e6, 'pesos del 3D contenidos');
const resumen = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/lugar.json'), 'utf8'));
ok(Number.isInteger(resumen.cotaFinca) && resumen.cotaFinca === Math.round(meta.casa.suelo_centro) && resumen.cotaFinca > 45 && resumen.cotaFinca < 65,
  `data/lugar.json: cotaFinca ${resumen.cotaFinca} m (MDT05 en el centro de la casa: ${meta.casa.suelo_centro} m)`);
ok(resumen.distanciaPlaya > 500 && resumen.distanciaPlaya < 900, `distancia a la playa en línea recta: ${resumen.distanciaPlaya} m`);
const dentro = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
const C = meta.rasters.cerca;
ok(dentro(meta.rasters.finca, meta.casa.cx, meta.casa.cz) && Math.hypot(meta.casa.cx, meta.casa.cz) < 25, `la casa roja cae junto al punto de Montemar (${meta.casa.cx}, ${meta.casa.cz}) y dentro del relieve fino`);
const enPol = (pt, an) => { let c = false; for (let i = 0, j = an.length - 1; i < an.length; j = i++) { const a = an[i], b = an[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
ok(enPol([meta.casa.cx, meta.casa.cz], meta.parcela), `la casa está dentro de su parcela del Catastro (${meta.parcela_m2} m²)`);
const nor = [Math.cos(meta.casa.ang), Math.sin(meta.casa.ang)];
ok(nor[1] < -0.95, `el porche (+u) mira al norte (${nor.map((v) => v.toFixed(2)).join(', ')})`);
ok(meta.casa.largo > 12 && meta.casa.largo < 17 && meta.casa.fondo > 11 && meta.casa.fondo < 15, `planta de la casa: ${meta.casa.largo} × ${meta.casa.fondo} m`);
ok(meta.edificios.some((e) => e.tipo === 'chalet'), 'está el chalet (Catastro part4)');
ok(meta.olivos.length >= 50 && meta.olivos.every((o) => enPol([o[0], o[2]], meta.parcela)), `olivos: ${meta.olivos.length}, todos dentro de la parcela`);
ok(meta.arboles.length > 1000, `árboles: ${meta.arboles.length} (pinos ${meta.arboles.filter((a) => a[6] === 1).length})`);
for (const l of meta.lugares) {
  if (l.clave === 'mar') { ok(l.z < -900, 'rótulo del mar sobre el mar'); continue; }
  if (l.clave === 'cabo') { ok(l.x < -800 && l.z < -1300, `cabo de San Agustín al noroeste (${l.x.toFixed(0)}, ${l.z.toFixed(0)}) [${l.osm}]`); continue; }
  ok(dentro(C, l.x, l.z), `${l.nombre} dentro del relieve cercano (${l.x.toFixed(0)}, ${l.z.toFixed(0)}) [${l.osm || l.nota}]`);
}
const nav = meta.lugares.find((x) => x.clave === 'navia'), pla = meta.lugares.find((x) => x.clave === 'playa');
ok(nav.z > 700 && pla.z < -500, 'la villa al sur y la playa al norte de la finca (OSM)');
const esp = meta.espigones;
ok(esp.oeste[0][1] < esp.este[0][1] && esp.oeste[0][0] < esp.este[0][0], 'espigones: el oeste sale más al mar que el este (como en la ortofoto)');

/* ---------- 3. plan B en el navegador, sin WebGL ---------- */
if (process.argv.includes('--sin-navegador')) { console.log(`\n${bien} bien, ${fallos} mal (sin navegador)`); process.exit(fallos ? 1 : 0); }
console.log('3. plan B en Chromium sin WebGL');
const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
const srv = http.createServer((req, res) => {
  const f = path.join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => srv.listen(PUERTO, r));
// Open-Meteo, sustituido: la marea de la curva de arriba centrada en este momento, y 60 % de nubes
const AHORA = Date.now(), T0v = Math.floor(AHORA / 3600000) * 3600000 - 24 * 3600000;
const mareaFija = (t) => 1.9 * Math.cos(2 * Math.PI * (t - AHORA + 2 * 3600000) / PER) - 0.15;   // pleamar hace 2 h: ahora baja
const fixtureVivo = () => { const time = [], v = []; for (let h = 0; h < 72; h++) { const t = T0v + h * 3600000; time.push(new Date(t + 3600000).toISOString().slice(0, 16)); v.push(+mareaFija(t).toFixed(3)); } return { utc_offset_seconds: 3600, hourly: { time, sea_level_height_msl: v } }; };
async function openMeteo(ctxB, falla) {
  await ctxB.route(/open-meteo\.com/, (r) => {
    if (falla) return r.abort();
    const u = r.request().url();
    const body = /marine/.test(u) ? fixtureVivo() : { current: { time: '', cloud_cover: 60 } };
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  });
}
const browser = await chromium.launch({ args: ['--disable-3d-apis', '--disable-webgl', '--disable-gpu'] });
try {
  for (const [w, h, falla] of [[1280, 800, false], [390, 844, true]]) {
    const ctxB = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    await openMeteo(ctxB, falla);
    const page = await ctxB.newPage();
    const errores = [];
    page.on('pageerror', (e) => errores.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error' && !/open-meteo|ERR_FAILED/.test(m.text() + (m.location().url || ''))) errores.push(m.text()); });
    page.on('requestfailed', (r) => { if (!/open-meteo/.test(r.url())) errores.push('falla ' + r.url()); });
    await page.goto(`http://localhost:${PUERTO}/ref/raw/lugar-prueba.html`);
    await page.waitForFunction(() => document.querySelector('[data-modulo="lugar"]').dataset.montado === '1');
    await page.locator('#lugar').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelectorAll('.lugar__marco--mapa .lugar__marca').length > 0, null, { timeout: 8000 });
    await page.waitForFunction(() => [...document.querySelectorAll('.lugar__planob img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 8000 });
    if (!falla) await page.waitForFunction(() => !document.querySelector('[data-l="marea2d"]').hidden, null, { timeout: 5000 });
    else await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const el = document.querySelector('[data-modulo="lugar"]');
      const vis = (s) => { const n = el.querySelector(s); return !!n && n.getBoundingClientRect().height > 0 && getComputedStyle(n).display !== 'none'; };
      const mapa = el.querySelector('.lugar__marco--mapa').getBoundingClientRect(), img = el.querySelector('.lugar__marco--mapa img');
      return {
        modo: el.dataset.modo, pistaVisible: getComputedStyle(el.querySelector('.lugar__pista')).display !== 'none',
        planob: vis('.lugar__planob'), mapa: vis('.lugar__mapa img'), vista: vis('.lugar__vista img'),
        proporcion: [mapa.width / mapa.height, img.naturalWidth / img.naturalHeight],
        ruta: el.querySelector('.lugar__ruta polyline').getAttribute('points').split(' ').length,
        marcasMapa: [...el.querySelectorAll('.lugar__marco--mapa .lugar__marca')].map((m) => m.textContent),
        marcasVista: [...el.querySelectorAll('.lugar__marcas--vista .lugar__marca')].filter((m) => !m.hidden).map((m) => m.textContent),
        pasos: el.querySelectorAll('.lugar__pasos li').length, ahora: el.querySelector('[data-l="ahora2d"]').textContent,
        marea: el.querySelector('[data-l="marea2d"]').hidden ? null : el.querySelector('[data-l="marea2d"]').textContent,
        curva: !!el.querySelector('[data-l="marea2d"] .lugar__curva path'),
        boton: !el.querySelector('[data-l="a3d"]').hidden, lienzo: !!el.querySelector('canvas'),
        anchoDoc: document.documentElement.scrollWidth, anchoVista: innerWidth, est: window.__lugar.estado(),
      };
    });
    console.log(`   ${w}×${h}${falla ? ' (sin Open-Meteo)' : ''}`);
    ok(r.modo === 'plano' && !r.pistaVisible && !r.lienzo, 'plan B, sin pista y sin lienzo (no se pinta WebGL)');
    ok(r.planob && r.mapa && r.vista, 'se ven la ría desde el aire y la vista desde el mar');
    ok(Math.abs(r.proporcion[0] - r.proporcion[1]) < 0.01, `el mapa no se recorta (proporción ${r.proporcion[0].toFixed(3)} = ${r.proporcion[1].toFixed(3)}): el recorrido cae en su sitio`);
    ok(r.ruta > 60, `recorrido dibujado (${r.ruta} puntos)`);
    ok(['La bocana', 'Playa de Navia', 'El pinar', 'Montemar'].every((n) => r.marcasMapa.some((m) => m.startsWith(n))), 'marcas en el mapa: ' + r.marcasMapa.join(' · '));
    ok(r.marcasVista.length >= 2, 'marcas en la vista: ' + r.marcasVista.join(' · '));
    ok(r.pasos === 5 && /Navia/.test(r.ahora), 'cinco paradas y el cielo de ahora: ' + r.ahora);
    if (falla) ok(r.marea === null && r.est.nubes === null, 'sin Open-Meteo: no hay panel de marea ni nubes, y nada se rompe');
    else ok(r.curva && /bajando/.test(r.marea) && /Pleamar|Bajamar/.test(r.marea) && r.est.nubes === 0.6, 'la marea de ahora (datos fijos): ' + r.marea.replace(/\s+/g, ' ').slice(0, 140));
    ok(!r.boton, 'sin botón 3D cuando no hay WebGL');
    ok(r.anchoDoc <= r.anchoVista, `sin scroll horizontal (${r.anchoDoc} ≤ ${r.anchoVista})`);
    if (w === 1280) {
      // alturas (decodificación del PNG en canvas 2D) y holgura de la cámara en todo el recorrido
      const alt = await page.evaluate(async () => {
        const m = await (await fetch('../../data/lugar-escena.json')).json();
        const dec = async (r) => {
          const b = await (await fetch('../../img/lugar/' + r.archivo)).blob();
          const bmp = await createImageBitmap(b, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
          const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
          const g = c.getContext('2d'); g.drawImage(bmp, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data;
          const at = (x, z) => {
            const fx = Math.max(0, Math.min(c.width - 1.001, (x - r.x0) / (r.x1 - r.x0) * (c.width - 1))), fz = Math.max(0, Math.min(c.height - 1.001, (z - r.z0) / (r.z1 - r.z0) * (c.height - 1)));
            const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, H = (ii, jj) => { const k = (jj * c.width + ii) * 4; return (d[k] * 256 + d[k + 1]) / 10 - 100; };
            return (H(i, j) * (1 - u) + H(i + 1, j) * u) * (1 - v) + (H(i, j + 1) * (1 - u) + H(i + 1, j + 1) * u) * v;
          };
          return { at, w: c.width, h: c.height, r };
        };
        const f = await dec(m.rasters.finca), ri = await dec(m.rasters.ria), c = await dec(m.rasters.cerca), l = await dec(m.rasters.lejos);
        const caja = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
        const h = (x, z) => caja(f.r, x, z) ? f.at(x, z) : caja(ri.r, x, z) ? ri.at(x, z) : caja(c.r, x, z) ? c.at(x, z) : l.at(x, z);
        const rejilla = {}; m.arboles.forEach((a) => { const k = Math.floor(a[0] / 20) + ',' + Math.floor(a[2] / 20); (rejilla[k] = rejilla[k] || []).push(a); });
        const arbol = (x, z) => { let t = -1e9; for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) (rejilla[(Math.floor(x / 20) + di) + ',' + (Math.floor(z / 20) + dj)] || []).forEach((a) => { if (Math.hypot(x - a[0], z - a[2]) < a[3] + 2) t = Math.max(t, a[1] + a[4]); }); return t; };
        const ruta = window.Montemar.lugar.camino(m.recorrido);
        let min = 1e9, pmin = 0, minFinal = 1e9;
        for (let i = 0; i <= 3000; i++) {
          const p = i / 3000, r = ruta(p), suelo = Math.max(h(r.pos[0], r.pos[2]), 2.6), hol = r.pos[1] - Math.max(suelo, arbol(r.pos[0], r.pos[2]));
          if (p < 0.95) { if (hol < min) { min = hol; pmin = p; } } else minFinal = Math.min(minFinal, hol);
        }
        // arenal: dentro de la laguna de la playa, entre 0,5 y 1,5 m; el canal y el mar, por debajo de la bajamar
        return { casa: f.at(m.casa.cx, m.casa.cz), mar: c.at(0, -2000), canal: ri.at(-530, -300), laguna: ri.at(-300, -450), dims: [f.w, f.h, m.rasters.finca.w, m.rasters.finca.h], min, pmin, minFinal };
      });
      ok(alt.dims[0] === alt.dims[2] && alt.dims[1] === alt.dims[3], 'tamaño del PNG de alturas = el del JSON');
      ok(Math.abs(alt.casa - meta.casa.suelo_centro) < 1, `altura en la casa: ${alt.casa.toFixed(1)} m`);
      ok(alt.mar < -2.5 && alt.canal < -2.5, `el mar (${alt.mar.toFixed(1)} m) y el canal de la ría (${alt.canal.toFixed(1)} m), por debajo de la bajamar más baja`);
      ok(alt.laguna > 0.3 && alt.laguna < 1.7, `la laguna de arenales a ${alt.laguna.toFixed(2)} m: la marea la cubre y la descubre`);
      ok(alt.min > 10, `holgura de la cámara sobre relieve y árboles (hasta el 95 %): ${alt.min.toFixed(1)} m (en p=${alt.pmin.toFixed(3)})`);
      ok(alt.minFinal > 5, `holgura en la llegada a la terraza: ${alt.minFinal.toFixed(1)} m`);
      const rep = await page.evaluate(() => { window.__lugar.destruir(); const el = document.querySelector('[data-modulo="lugar"]'); return { resp: !!el.querySelector('figure.respaldo'), clase: el.classList.contains('lugar-mod') }; });
      ok(rep.resp && !rep.clase, 'destruir() repone el HTML de respaldo');
    }
    ok(errores.length === 0, 'sin errores en consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
    await ctxB.close();
  }

  /* ---------- 4. la escena 3D se construye y se recorre, SIN WebGL ----------
     Three.js real, con un WebGLRenderer falso que no pinta (solo cuenta triángulos y mira que no haya NaN).
     Los shaders (GLSL) NO se compilan aquí: eso solo se ve en el Chrome de Álvaro. */
  console.log('4. escena 3D con renderizador falso (no pinta)');
  const ENVOLTORIO = `import * as T from '/vendor/three-0.160.0.module.min.js?real';
export * from '/vendor/three-0.160.0.module.min.js?real';
export class WebGLRenderer {
  constructor(o) { this.domElement = o.canvas; this.shadowMap = { enabled: false, type: 0, autoUpdate: true, needsUpdate: false };
    this.capabilities = { getMaxAnisotropy: () => 8 }; this.info = { render: { triangles: 0, calls: 0 } }; this._pr = 1; window.__pintadas = 0; }
  setPixelRatio(v) { this._pr = v; } getPixelRatio() { return this._pr; } setSize() {} compile() {}
  render(esc, cam) {
    window.__pintadas++; let tri = 0, calls = 0;
    esc.updateMatrixWorld();
    esc.traverse((o) => { if ((o.isMesh || o.isPoints || o.isSprite) && o.visible && o.geometry) { calls++; const g = o.geometry; const n = g.index ? g.index.count : g.attributes.position.count; tri += n / 3 * (o.isInstancedMesh ? o.count : 1);
      const pa = g.attributes.position && g.attributes.position.array; if (pa && !window.__nan) { for (let i = 0; i < pa.length; i += 97) if (!Number.isFinite(pa[i])) { window.__nan = (o.name || o.type) + ' ' + i; break; } }
      if (o.isInstancedMesh && !window.__nan) { const a = o.instanceMatrix.array; for (let i = 0; i < o.count * 16; i += 13) if (!Number.isFinite(a[i])) { window.__nan = 'instancias ' + i; break; } } } });
    this.info.render.triangles = tri; this.info.render.calls = calls;
    if (![cam.position.x, cam.position.y, cam.position.z].every(Number.isFinite)) throw new Error('cámara con NaN');
    window.__cam = [cam.position.x, cam.position.y, cam.position.z, cam.near, cam.fov];
  }
  dispose() {} forceContextLoss() {}
}`;
  const fuerza3d = async (ctxB) => {
    await ctxB.route((u) => u.pathname.endsWith('/vendor/three-0.160.0.module.min.js') && !u.search.includes('real'),
      (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: ENVOLTORIO }));
    await openMeteo(ctxB, false);
  };
  const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  await fuerza3d(ctx3);
  const page = await ctx3.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /Lugar/.test(m.text()))) errores.push(m.text()); });
  await page.goto(`http://localhost:${PUERTO}/ref/raw/lugar-prueba.html?lugar=3d`);
  await page.locator('#lugar').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => window.__lugar && window.__lugar.estado().t3 && window.__pintadas > 0 && window.__lugar.estado().cargado, null, { timeout: 40000 });
  await page.waitForFunction(() => window.__lugar.estado().marea, null, { timeout: 8000 });
  const e0 = await page.evaluate(() => ({ est: window.__lugar.estado(), modo: document.querySelector('[data-modulo="lugar"]').dataset.modo, nan: window.__nan || null,
    listo: document.querySelector('.lugar__escenario').classList.contains('lugar--listo'), hud: document.querySelector('[data-l="ahora3d"]').textContent, marea: document.querySelector('[data-l="marea3d"]').textContent }));
  ok(e0.modo === '3d' && e0.listo, 'modo 3D montado; se enseña cuando han llegado las texturas');
  ok(!e0.nan, 'ninguna geometría ni instancia con NaN' + (e0.nan ? ': ' + e0.nan : ''));
  console.log('       triángulos', Math.round(e0.est.t3.triangulos), '· objetos', e0.est.t3.llamadas, '· huecos', e0.est.t3.ventanas, '· árboles', e0.est.t3.arboles, '· olivos', e0.est.t3.olivos);
  ok(e0.est.t3.triangulos > 150000 && e0.est.t3.triangulos < 1500000, 'triángulos en un rango razonable');
  ok(/en Navia · el (sol|cielo) de ahora/.test(e0.hud) && /bajando/.test(e0.marea), 'rótulo de la hora y del sol de ahora, y la marea: ' + e0.hud.slice(0, 60) + '… · ' + e0.marea.replace(/\s+/g, ' ').slice(0, 60));
  const esperado = mareaFija(Date.now());
  ok(Math.abs(e0.est.t3.nivel - esperado) < 0.08, `el agua está a la altura de la marea de ahora: ${e0.est.t3.nivel.toFixed(2)} m (esperado ${esperado.toFixed(2)})`);
  const tramos = [[0, ['Mar Cantábrico', 'Montemar'], 'Desde el mar'], [0.3, ['La bocana'], 'La bocana'], [0.45, ['Playa de Navia'], 'La playa y el pinar'],
    [0.7, ['Montemar'], 'Ría arriba'], [0.995, ['La bocana', 'Playa de Navia'], 'La terraza']];
  for (const [p, esperados, parada] of tramos) {
    await page.evaluate((p) => { const pista = document.querySelector('.lugar__pista'); const esc = document.querySelector('.lugar__escenario');
      const y0 = pista.getBoundingClientRect().top + scrollY; scrollTo(0, y0 + p * (pista.offsetHeight - esc.offsetHeight)); }, p);
    await page.waitForFunction((p) => { const t = window.__lugar.estado().t3; return t && Math.abs(t.pVis - p) < 0.004; }, p, { timeout: 15000 });
    await page.waitForTimeout(120);
    const r = await page.evaluate(() => ({ rot: [...document.querySelectorAll('.lugar__rotulo.es-visible b')].map((b) => b.textContent), par: (document.querySelector('.lugar__paradas li.es-actual b') || {}).textContent, cam: window.__cam }));
    const faltan = esperados.filter((x) => !r.rot.includes(x));
    ok(faltan.length === 0 && r.par === parada, `p=${p}: parada «${r.par}», rótulos: ${r.rot.join(' · ') || '(ninguno)'} · cámara a ${r.cam[1].toFixed(1)} m, near ${r.cam[3].toFixed(2)}`);
  }
  // fuera de pantalla no pinta
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  const fuera = await page.evaluate(() => { const a = window.__pintadas; return new Promise((res) => setTimeout(() => res(window.__pintadas - a), 700)); });
  ok(fuera === 0, `fuera de pantalla no pinta (${fuera} fotogramas en 0,7 s)`);
  await page.evaluate(() => document.querySelector('[data-l="aplano"]').click());
  const pl = await page.evaluate(() => ({ modo: document.querySelector('[data-modulo="lugar"]').dataset.modo, boton: !document.querySelector('[data-l="a3d"]').hidden }));
  ok(pl.modo === 'plano' && pl.boton, '«Ver en plano» vuelve al plan B y ofrece volver al 3D');
  const rep = await page.evaluate(() => { window.__lugar.destruir(); return !!document.querySelector('[data-modulo="lugar"] figure.respaldo') && !document.querySelector('canvas'); });
  ok(rep, 'destruir() con el 3D montado repone el respaldo y quita el lienzo');
  ok(errores.length === 0, 'sin errores en consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await ctx3.close();

  // ?marea=-2 (bajamar forzada) y el móvil: plan B con botón; al pulsar, monta el 3D
  const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, reducedMotion: 'no-preference' });
  await fuerza3d(ctxM);
  const pm = await ctxM.newPage();
  const erroresM = [];
  pm.on('pageerror', (e) => erroresM.push(String(e)));
  await pm.goto(`http://localhost:${PUERTO}/ref/raw/lugar-prueba.html?lugar=3d&marea=-2`);
  await pm.locator('#lugar').scrollIntoViewIfNeeded();
  await pm.waitForFunction(() => window.__lugar && document.querySelector('[data-modulo="lugar"]').dataset.montado === '1');
  await pm.waitForTimeout(300);
  const m0 = await pm.evaluate(() => ({ modo: document.querySelector('[data-modulo="lugar"]').dataset.modo, boton: !document.querySelector('[data-l="a3d"]').hidden, t3: !!window.__lugar.estado().t3, pintadas: window.__pintadas || 0 }));
  ok(m0.modo === 'plano' && m0.boton && !m0.t3 && !m0.pintadas, 'móvil: plan B con el botón «Ver la ría en 3D» y sin cargar Three.js');
  await pm.evaluate(() => document.querySelector('[data-l="a3d"]').click());
  await pm.waitForFunction(() => window.__lugar.estado().t3 && window.__pintadas > 0, null, { timeout: 40000 });
  const m1 = await pm.evaluate(() => ({ modo: document.querySelector('[data-modulo="lugar"]').dataset.modo, est: window.__lugar.estado() }));
  ok(m1.modo === '3d' && Math.abs(m1.est.t3.nivel + 2) < 0.01, `al pulsar monta el 3D (móvil: ${Math.round(m1.est.t3.triangulos)} triángulos), con ?marea=-2 el agua a ${m1.est.t3.nivel} m`);
  ok(erroresM.length === 0, 'móvil sin errores' + (erroresM.length ? ': ' + erroresM.join(' | ') : ''));
  await ctxM.close();
} finally {
  await browser.close();
  srv.close();
}
console.log(`\n${bien} bien, ${fallos} mal`);
process.exit(fallos ? 1 : 0);
