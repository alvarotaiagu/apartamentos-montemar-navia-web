/* Verificación de la web de Montemar (Playwright, UN navegador, ventanas pequeñas, escala 1).
   Uso: node verificar.mjs            (puerto 8961; todo)
        node verificar.mjs 3 4        (solo esos bloques, para depurar)
   Sin capturas: lo que hay que mirar a ojo va en el README. El 3D NO se pinta: el navegador arranca con
   --disable-3d-apis, la página se abre con ?sin-webgl y js/lugar.js y vendor/ se sirven vacíos (del 3D solo se comprueba
   que existe su contenedor y que se ve el respaldo). El motor real (WuBook), Google Maps, Open-Meteo y las letras se
   sirven falsos: no se hace ninguna petición de verdad a terceros. Todo va con movimiento reducido salvo el bloque 10,
   una vez y al final. Mide comportamiento, no aspecto. */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PUERTO = 8961;
const SOLO = process.argv.slice(2).map(Number).filter(Boolean);
const toca = (n) => !SOLO.length || SOLO.includes(n);
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.bin': 'application/octet-stream' };
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
servidor.on('error', (e) => { console.error(`El puerto ${PUERTO} está ocupado (¿otra sesión?): ${e.message}`); process.exit(2); });
await new Promise((r) => servidor.listen(PUERTO, r));
const BASE = `http://localhost:${PUERTO}/`;
const PAG = BASE + 'index.html?sin-webgl';

const fallos = [];
let nOk = 0;
const comprobar = (cond, m, detalle) => { if (cond) { nOk++; console.log('  ok     ' + m); } else { fallos.push(m); console.log('  FALLO  ' + m + (detalle !== undefined ? ' → ' + JSON.stringify(detalle).slice(0, 700) : '')); } };
const nota = (m) => console.log('  ·      ' + m);
const LLAVE = 'montemar-cookies';
const sinCookies = `try { localStorage.setItem('${LLAVE}', 'si'); } catch (e) {}`;
const existe = (f) => fs.existsSync(path.join(RAIZ, f));
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const D = JSON.parse(leer('data/montemar.json'));
const RUTAS = existe('ref/raw/rutas.json') ? JSON.parse(leer('ref/raw/rutas.json')) : null;
const kmTxt = (v) => (v < 10 ? String(Math.round(v * 10) / 10).replace('.', ',') : String(Math.round(v))) + ' km';
const TIEMPO_FALSO = { current: { time: '2026-11-25T14:15', temperature_2m: 13.1, apparent_temperature: 8.7, weather_code: 1, is_day: 1, wind_speed_10m: 27.1, wind_direction_10m: 289, wind_gusts_10m: 50.4 } };
const MAR_FALSO = { current: { time: '2026-11-25T14:15', wave_height: 3.38, wave_direction: 318, wave_period: 8.75 } };

/* ================= 1. archivos (sin navegador) ================= */
if (toca(1)) {
console.log('\n1. Archivos, textos y contrato');
const htmls = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.html') && !f.endsWith('.src.html'));
for (const f of htmls) {
  const s = leer(f);
  comprobar(/^<!DOCTYPE html>\s*<html lang="es">\s*<head>\s*<meta charset="utf-8">\s*<meta name="robots" content="noindex, nofollow">/.test(s), `${f}: charset lo primero y noindex, nofollow justo detrás`);
  const ids = [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const rep = ids.filter((x, i) => ids.indexOf(x) !== i);
  comprobar(rep.length === 0, `${f}: ningún id repetido`, [...new Set(rep)]);
  comprobar(!/<!--parte:/.test(s) && !/<!-- sin partes\//.test(s) && !/\{\{[A-Z]+\}\}/.test(s) && !/<!--(unidades|vistazo|finca|estancias|alrededor|resenas|llegar|suelo-portada|logo-pie|precarga-portada)-->/.test(s), `${f}: todas las partes y datos incluidos`);
  comprobar(!/[ÃÂ][\u0080-\u00BF]|\uFFFD/.test(s), `${f}: sin caracteres rotos`);
}
comprobar(['.nojekyll', '404.html', 'manifest.json', 'img/og.jpg', 'img/difusion.jpg', 'marca/favicon.svg', 'marca/favicon-32.png', 'marca/apple-touch-icon.png', 'marca/icono-512.png', 'marca/logo.svg', 'marca/simbolo.svg', 'marca/palabra.svg', 'marca/suelo.svg', 'marca/logo.json'].every(existe), 'están .nojekyll, 404, manifest, og, favicons, el cartel de la ayuda y el logo vectorizado (logo, símbolo, palabra, suelo)');
const L = JSON.parse(leer('marca/logo.json'));
const iou = existe('marca/logo-control.json') ? JSON.parse(leer('marca/logo-control.json')).iou : {};
comprobar(Object.keys(L.copas).length === 3 && Object.values(L.copas).every((c) => c.residuo < 1) && iou.silueta >= 0.95 && ['izq', 'cen', 'der', 'tierra', 'agua'].every((k) => iou[k] >= 0.78), `logo redibujado: tres copas como círculos (residuo < 1 px), IoU con el PNG ${JSON.stringify(iou)}`);
comprobar(/<circle /.test(leer('marca/simbolo.svg')) && (leer('marca/simbolo.svg').match(/<circle /g) || []).length === 3, 'marca/simbolo.svg: las copas son tres <circle>');
const html = leer('index.html');
const fotosJson = JSON.parse(leer('img/fotos/fotos.json'));
{
  const rutas = new Set();
  for (const m of html.matchAll(/(src|srcset|href|imagesrcset)="([^"]+)"/g)) for (const parte of (/srcset/.test(m[1]) ? m[2].split(',') : [m[2]])) {
    const r = parte.trim().split(/\s+/)[0].split('?')[0];
    if (r && r !== './' && !/^(https?:|mailto:|tel:|#|data:)/.test(r)) rutas.add(r);
  }
  const faltan = [...rutas].filter((r) => !existe(r) && !/^(css\/lugar\.css|js\/lugar\.js)$/.test(r));
  comprobar(faltan.length === 0, `index.html: existen los ${rutas.size} archivos que enlaza (lugar.css y lugar.js, del otro agente, pueden faltar)`, faltan);
  if (!existe('js/lugar.js') || !existe('css/lugar.css')) nota('aún no están ' + ['css/lugar.css', 'js/lugar.js'].filter((f) => !existe(f)).join(' y ') + ' (Lugar 3D): la página usa el respaldo');

  /* fotos: nunca más grandes que el original */
  const pedidas = [...new Set([...html.matchAll(/<picture data-foto="([^"]+)"/g)].map((m) => m[1]))];
  comprobar(pedidas.length >= 15 && pedidas.every((n) => fotosJson.some((f) => f.nombre === n)), `las ${pedidas.length} fotos de la página existen en img/fotos/fotos.json`, pedidas.filter((n) => !fotosJson.some((f) => f.nombre === n)));
  const faltanFotos = [];
  for (const f of fotosJson) for (const w of f.anchos) for (const e of ['avif', 'webp', 'jpg']) if (!existe(`img/fotos/${f.nombre}-${w}.${e}`)) faltanFotos.push(`${f.nombre}-${w}.${e}`);
  comprobar(faltanFotos.length === 0, 'cada foto existe en todos sus anchos y en AVIF, WebP y JPG', faltanFotos.slice(0, 5));
  const nit = existe('ref/raw/nitidez.json') ? JSON.parse(leer('ref/raw/nitidez.json')) : {};
  const clave = (o) => o.split('/').slice(-2).join('/');
  const amplia = fotosJson.filter((f) => { const o = nit[clave(f.origen)]; return !o || Math.max(...f.anchos) > o.ancho || f.ancho > o.ancho; });
  comprobar(amplia.length === 0, 'ninguna foto se amplía: ningún ancho pasa del de su original (ref/raw/nitidez.json)', amplia.map((f) => f.nombre));
  comprobar(fotosJson.filter((f) => f.ancho <= 1024).every((f) => Math.max(...f.anchos) <= 1024), 'las de la ficha (1024 px y menos) no se sirven por encima de su tamaño');
  const pc = JSON.parse(leer('img/portada/capas.json'));
  comprobar(pc.ancho === 1780 && pc.anchos.every((w) => w <= 1780) && pc.anchos.every((w) => existe(`img/portada/cielo-${w}.webp`) && existe(`img/portada/olivos-${w}.webp`) && existe(`img/portada/olivos-${w}.png`)), 'portada: capas del cielo y de los olivos (con transparencia) a 800, 1200 y 1780, nunca más que la foto (1780)');
  comprobar((nit['web/slider1.jpg'] || {}).cociente >= 0.6, `la foto de la portada tiene resolución real (nitidez ${(nit['web/slider1.jpg'] || {}).cociente})`);
  comprobar((html.match(/<link rel="preload" as="image" type="image\/webp" media="[^"]+" imagesrcset="img\/portada\/olivos-/g) || []).length === 3 && (html.match(/<section id="portada"[\s\S]*?<\/section>/)[0].match(/fetchpriority="high"/g) || []).length === 2, 'la capa de los olivos se precarga con el recorte de cada pantalla (móvil, tableta, escritorio) y las dos capas llevan fetchpriority="high" (LCP)');

  /* textos: nada inventado, solo castellano, sin rayas */
  const texto = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const alts = [...html.matchAll(/(?:alt|aria-label|title)="([^"]*)"/g)].map((m) => m[1]).join(' ');
  comprobar(!/[—–]/.test(texto + alts), 'ni una raya (— ni –) en el texto visible, los alt ni las etiquetas');
  comprobar(/649 972 451/.test(texto) && /tel:\+34649972451/.test(html) && /monte-mar@outlook\.com/.test(texto) && /Camino Montemar, s\/n/.test(texto) && /33710 Navia/.test(texto), 'contacto: teléfono, correo y dirección de DATOS');
  comprobar(!/985 ?473 ?222|672 ?314 ?293|33719|Llanes|acceso directo a la playa|Hotel Montemar|El Olivo|más de 20 años|mejor precio|pet friendly/i.test(texto + alts), 'nada de las trampas de DATOS: ni los teléfonos de Turismo, ni 33719, ni el Montemar de Llanes, ni «acceso directo a la playa», ni «El Olivo»');
  comprobar(/>4,8</.test(html) && /<span class="cifra">78<\/span> reseñas/.test(html) && /9,7/.test(texto) && /92<\/span> opiniones/.test(html), 'reseñas: 4,8 con 78 reseñas en Google (recuento suficiente) y 9,7 con 92 en su motor');
  comprobar(!/\b(1|una)( sola| única)? reseña\b/i.test(texto) && !/clientes satisfechos|cientos de|«[^»]{20,}»/i.test(texto), 'sin prueba social ni citas inventadas');
  comprobar(/Es su motor de reservas real\./.test(texto) && /reservas que hagas dentro son de verdad/.test(texto), 'junto al motor, el aviso de que es su motor REAL');
  comprobar(!/<iframe/.test(html) && !/dfrom=/.test(html.replace(/<!--[\s\S]*?-->/g, '')), 'el iframe del motor no está en el HTML (se crea al pedirlo)');
  comprobar(/href="http:\/\/185\.154\.211\.67:8000\/cgi-bin\/mjpg\/video\.cgi\?channel=1" target="_blank" rel="noopener"/.test(html) && /cámara del alojamiento/.test(texto) && !/<(img|iframe|video)[^>]+185\.154/.test(html), 'la webcam: botón a pestaña nueva que dice que es la cámara del alojamiento; no se incrusta');
  comprobar(/<dd class="cifra">4-6<\/dd>/.test(html) && /<dd class="cifra">3<\/dd>/.test(html) && /<dd class="cifra">2<\/dd>/.test(html) && /No se admiten mascotas/.test(texto) && /Limpieza una vez a la semana/.test(texto) && /Toda la ropa de cama, incluida/.test(texto) && /toallas cada día, si lo pides/.test(texto), 'fichas con los datos de DATOS: 4 apartamentos de 4 a 6, chalet de 3 habitaciones y 2 baños, condiciones aparte');
  comprobar((html.match(/<article class="unidad /g) || []).length === 2 && !/<li>\s*•/.test(html) && (html.match(/<svg class="ico" aria-hidden="true"><use href="#i-/g) || []).length >= 25, 'fichas diseñadas: apartamento y chalet, servicios con icono propio (sprite #i-…), sin viñetas de texto');
  const iconosUsados = new Set([...html.matchAll(/use href="#(i-[a-z-]+)"/g)].map((m) => m[1]));
  ['i-sol', 'i-luna', 'i-sol-nube', 'i-nube', 'i-niebla', 'i-lluvia', 'i-nieve', 'i-tormenta'].forEach((i) => iconosUsados.add(i));
  comprobar([...iconosUsados].every((i) => new RegExp(`<symbol id="${i}"`).test(html)), `los ${iconosUsados.size} iconos que se usan (también los del tiempo) existen en el sprite`, [...iconosUsados].filter((i) => !new RegExp(`<symbol id="${i}"`).test(html)));
  comprobar(/<img src="img\/difusion\.jpg" width="640" height="520"/.test(html) && /NextGenerationEU/.test(texto) && /MONTEMAR S\.L\./.test(texto) && /Resolución de 19 de julio de 2024/.test(texto), 'pie: el cartel NextGenerationEU a su tamaño (640 px) con su texto escrito al lado');
  if (RUTAS) {
    const bloque = html.match(/<ul class="cerca"[\s\S]*?<p class="alrededor__fino">/)[0];
    const okR = RUTAS.orden.every((id) => { const d = RUTAS.destinos[id]; const v = id === 'playa' || id === 'navia' ? d.pie : d.coche; return v ? new RegExp(`data-ruta="${id}"[\\s\\S]*?${kmTxt(v.km)}`).test(bloque) : /por confirmar/.test(bloque); });
    comprobar(okR && (bloque.match(/data-ruta=/g) || []).length === RUTAS.orden.length, `Alrededor: los ${RUTAS.orden.length} destinos con las cifras de ref/raw/rutas.json (OSRM), ninguna a ojo`);
    comprobar(!/600 m|800 m|5 minutos andando|\b15 km\b/.test(texto), 'ninguna distancia copiada de su web sin comprobar (600 m, 800 m, 15 km)');
  } else nota('sin ref/raw/rutas.json');

  /* contrato web ↔ módulos */
  const sitios = [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/data-modulo="([^"]+)"/g)].map((m) => m[1]);
  comprobar(JSON.stringify(sitios) === JSON.stringify(['portada', 'lugar']), 'los huecos de los módulos: portada y lugar', sitios);
  comprobar(/<section id="lugar"[^>]*aria-labelledby="t-lugar">[\s\S]*?<div data-modulo="lugar">\s*<figure class="lugar__respaldo">[\s\S]*?webcam[\s\S]*?<figcaption>[\s\S]*?<\/figure>\s*<\/div>/.test(html), '#lugar: <div data-modulo="lugar"> con el respaldo (fotograma de su webcam y texto)');
  const cabeza = html.split('</head>')[0];
  comprobar(/<link rel="stylesheet" href="css\/lugar\.css/.test(cabeza) && /<script src="js\/lugar\.js[^"]*" defer><\/script>/.test(html) && html.indexOf('js/lugar.js') < html.indexOf('js/main.js') && html.indexOf('js/portada.js') < html.indexOf('js/main.js'), 'carga css/lugar.css (en el <head>) y js/lugar.js (defer, antes de main.js) aunque aún no existan');
  comprobar(['js/portada.js', 'js/tiempo.js', 'js/reserva.js', 'js/main.js'].every((s) => new RegExp(`<script src="${s}\\?v=[0-9a-f]+" defer>`).test(html)), 'los JS propios con defer y ?v=<huella>');
  comprobar(!/data-(partir|split|letras|chars?)\b/.test(html) && !/class="[^"]*\bcortina\b|id="cortina"/.test(html), 'ni letra a letra ni cortina');
  comprobar(/data-cota="\d+"/.test(html), 'el medidor lleva la cota de la finca (data/lugar.json o 41)');
}

/* CSS y JS: lo que no se negocia */
const base = leer('css/base.css'), css = leer('css/estilos.css');
const raizCss = base.match(/:root \{[\s\S]*?\n\}/)[0];
comprobar(['--fondo', '--superficie', '--texto', '--texto-suave', '--marca', '--acento', '--tierra', '--agua', '--linea', '--letra-titular', '--letra-texto', '--letra-cifras'].every((v) => new RegExp(`\\s${v}:`).test(raizCss)), 'las doce variables comunes del contrato, en :root de css/base.css');
const lugarCss = base.match(/#lugar \{[\s\S]*?\n\}/)[0];
comprobar(['--fondo', '--texto', '--texto-suave', '--linea'].every((v) => new RegExp(`\\s${v}:`).test(lugarCss)), '#lugar redefine --fondo, --texto, --texto-suave y --linea para fondo oscuro');
comprobar(/--hoja: #215A37/.test(base) && /--oscuro: #173E29/.test(base) && /--loma: #814429/.test(base) && /--ola: #498BC8/.test(base), 'la paleta sale del logo: #215A37, #173E29, #814429, #498BC8');
comprobar(/\.cookies:not\(\[hidden\]\)\s*\{[^}]*display:\s*flex/.test(css) && !/\.cookies\s*\{[^}]*display:/.test(css), 'cookies: display solo en :not([hidden])');
comprobar(/\.mando:not\(\[hidden\]\)/.test(css) && !/\.mando\s*\{[^}]*display:/.test(css), 'mando: display solo en :not([hidden])');
comprobar(/\[hidden\]\s*\{\s*display:\s*none\s*!important/.test(base), '[hidden] siempre oculta');
comprobar(/\.menu-movil\s*\{[^}]*height:\s*100dvh/.test(css) && !/\.menu-movil\s*\{[^}]*inset:\s*0/.test(css), 'menú móvil: altura 100dvh, nunca inset:0 (la cabecera lleva backdrop-filter)');
comprobar(!/\ddvh/.test(css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\.menu-movil\s*\{[^}]*\}/, '')), 'fuera del menú fijo, ningún dvh (la barra del móvil no mueve nada)');
const js = ['js/main.js', 'js/reserva.js', 'js/portada.js', 'js/tiempo.js'].map(leer).join('\n');
comprobar(!/cursor:\s*none/.test(base + css + js) && !/marquee/i.test(css + html) && !/li\s*\{[^}]*position:\s*sticky/.test(css), 'sin cursor propio, sin marquesina y sin pila sticky de tarjetas');
comprobar(/:focus-visible\s*\{\s*outline:\s*2px solid/.test(base) && /\.foco-copas__arboles circle/.test(base), 'foco: contorno de 2 px y las tres copas (#foco-copas)');
const mainJs = leer('js/main.js');
comprobar(/raiz\.classList\.add\('con-movimiento'\)/.test(mainJs) && /const motion = !quieto;/.test(mainJs), '«con-movimiento» solo sin movimiento reducido');
comprobar(/if \(esBarra\(\)\) return;/.test(mainJs) && /if \(innerWidth === anchoVista\) return;/.test(leer('js/reserva.js')), 'el resize de la barra del móvil no rehace nada (main y el calendario)');
comprobar(/history\.scrollRestoration = 'manual'/.test(leer('partes/cabeza.html')) && /scrollTo\(0, 0\)/.test(mainJs), 'recargar a media página: scrollRestoration manual y vuelta arriba');
comprobar(!/(cdnjs|jsdelivr|unpkg|gsap|lenis)/i.test(html.replace(/<!--[\s\S]*?-->/g, '')), 'ninguna librería de CDN en la página (sin GSAP ni Lenis): solo las letras de Google');
comprobar(!/localStorage/.test(leer('js/tiempo.js')) && !/localStorage/.test(leer('js/reserva.js')), 'ni el tiempo ni el buscador guardan nada en el navegador');
const fuentes = html.match(/fonts\.googleapis\.com\/css2\?[^"]+/)[0];
const familias = [...fuentes.matchAll(/family=([A-Za-z+]+)/g)].map((m) => m[1]);
comprobar(JSON.stringify(familias) === '["Afacad","Fustat","Noto+Sans+Mono"]' && /display=swap/.test(fuentes), 'Google Fonts: Afacad, Fustat y Noto Sans Mono, display=swap, ninguna más');
{
  const otras = [];
  for (const d of fs.readdirSync(path.join(RAIZ, '..'))) {
    if (!/-web$/.test(d) || d === path.basename(RAIZ)) continue;
    const dir = path.join(RAIZ, '..', d);
    let lista = [];
    try { lista = [...fs.readdirSync(dir).filter((f) => f.endsWith('.html')).map((f) => path.join(dir, f)), ...(fs.existsSync(path.join(dir, 'css')) ? fs.readdirSync(path.join(dir, 'css')).filter((f) => f.endsWith('.css')).map((f) => path.join(dir, 'css', f)) : [])]; } catch (e) { continue; }
    for (const f of lista) { const s = fs.readFileSync(f, 'utf8'); for (const fam of familias) if (s.includes('family=' + fam + ':') || s.includes('family=' + fam + '&') || new RegExp(`['"]${fam.replace(/\+/g, ' ')}['"]`).test(s)) otras.push(fam + ' en ' + d); }
  }
  comprobar(otras.length === 0, 'ninguna de las tres letras está ya en otra web de la cartera (grep en ../*-web)', [...new Set(otras)]);
}
// receta de borrado del mando (README), comprobada sobre copias en memoria
{
  const quitar = (s, re) => (re.test(s) ? s.replace(re, '') : null);
  const cab = quitar(leer('partes/cabeza.html').split('\r\n').join('\n'), /\s*\/\/ MANDO DE MAQUETA[^\n]*\n\s*if \(q\.has\('revision'\)\) \{[\s\S]*?\n    \}\n/);
  const pie = quitar(leer('partes/pie.html').split('\r\n').join('\n'), /<!-- MANDO DE MAQUETA[\s\S]*?<!-- fin del MANDO DE MAQUETA -->\n?/);
  const mj = quitar(mainJs.split('\r\n').join('\n'), /\s*\/\* =+ \d+\. MANDO DE MAQUETA[\s\S]*?\/\* fin del MANDO DE MAQUETA \*\//);
  const cs = quitar(css.split('\r\n').join('\n'), /\/\* MANDO DE MAQUETA[\s\S]*?\/\* fin del MANDO DE MAQUETA \*\/\n?/);
  let ok = !!(cab && pie && mj && cs) && !/revision|densidad-sobria/.test(cab) && !/id="mando"|data-densidad/.test(pie) && !/data-densidad|pintarMando/.test(mj) && !/\.mando/.test(cs);
  try { new vm.Script(mj); new vm.Script(cab.match(/<script>([\s\S]*?)<\/script>/)[1]); } catch (e) { ok = false; }
  comprobar(ok, 'la receta de borrado del mando (README) quita los cuatro bloques y el JS sigue siendo válido');
}
}

/* ================= navegador: uno solo, sin WebGL ================= */
const conNavegador = !SOLO.length || SOLO.some((n) => n >= 2);
const browser = conNavegador ? await chromium.launch({ headless: true, args: ['--disable-3d-apis'] }) : null;
try {
  async function nueva(op = {}, { script, abortar, tiempo = 'bien' } = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'reduce', ...op });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await ctx.route(/google\.com\/maps/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>mapa</p>' }));
    await ctx.route(/wubook\.net/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><p>motor de prueba</p>' }));
    await ctx.route(/open-meteo\.com/, (r) => {
      if (tiempo === 'mal') return r.abort();
      const marino = /marine-api/.test(r.request().url());
      r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(marino ? MAR_FALSO : TIEMPO_FALSO) });
    });
    await ctx.route(/185\.154\.211\.67/, (r) => r.abort());
    // del 3D solo el contenedor y el respaldo: su JS y sus librerías no se cargan
    await ctx.route(/\/js\/lugar\.js|\/vendor\//, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: '/* sin 3D en las pruebas */' }));
    await ctx.route(/\/css\/lugar\.css/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    if (abortar) await ctx.route(abortar, (r) => r.abort());
    if (script) await ctx.addInitScript(script);
    const page = await ctx.newPage();
    page._errores = [];
    page.on('pageerror', (e) => page._errores.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::|WebGL|webgl/.test(m.text())) page._errores.push('consola: ' + m.text()); });
    page.on('response', (r) => { if (r.status() >= 400) page._errores.push(r.status() + ' ' + r.url()); });
    return { ctx, page };
  }
  const contrastes = (page, sel) => page.evaluate((sel) => {
    const lz = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const rgba = (c) => { lz.clearRect(0, 0, 1, 1); lz.fillStyle = '#000'; lz.fillStyle = c; lz.fillRect(0, 0, 1, 1); return [...lz.getImageData(0, 0, 1, 1).data]; };
    const L = (m) => { m = m.map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * m[0] + .7152 * m[1] + .0722 * m[2]; };
    const fondo = (el) => { while (el) { const b = getComputedStyle(el).backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b) && !/[, /] ?0\)$/.test(b)) return rgba(b).slice(0, 3); el = el.parentElement; } return rgba(getComputedStyle(document.documentElement).backgroundColor).slice(0, 3); };
    return sel.map((s) => {
      const el = document.querySelector(s); if (!el) return [s, 'falta'];
      const f = fondo(el), c = rgba(getComputedStyle(el).color), a = c[3] / 255;
      const t = [0, 1, 2].map((i) => c[i] * a + f[i] * (1 - a));
      const x = L(t), y = L(f); return [s, Math.round(((Math.max(x, y) + .05) / (Math.min(x, y) + .05)) * 100) / 100];
    });
  }, sel);
  const irA = (page, sel, frac = 0.3) => page.evaluate(([s, f]) => { const el = document.querySelector(s); scrollTo(0, el.getBoundingClientRect().top + scrollY - innerHeight * f); }, [sel, frac]);
  const cuadro = () => new Promise((r) => setTimeout(r, 120));

  /* ---------- 2. portada (respaldo, movimiento reducido) a cinco tamaños ---------- */
  if (toca(2)) {
  console.log('\n2. Portada (movimiento reducido) a 360×640, 375×667, 390×844, 768×1024 y 1280×800');
  for (const [w, h] of [[360, 640], [375, 667], [390, 844], [768, 1024], [1280, 800]]) {
    const movil = w < 1000;
    const { ctx, page } = await nueva({ viewport: { width: w, height: h }, isMobile: movil, hasTouch: movil }, { script: sinCookies });
    await page.goto(PAG);
    await page.waitForFunction(() => [...document.querySelectorAll('#portada img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 8000 }).catch(() => {});
    const r = await page.evaluate(() => {
      const q = (s) => document.querySelector(s).getBoundingClientRect();
      const caja = q('.portada__foto'), t = q('.portada__palabra');
      const z = (s) => +getComputedStyle(document.querySelector(s)).zIndex;
      const b = [...document.querySelectorAll('.portada__acc .btn')].map((x) => x.getBoundingClientRect());
      return {
        capas: [...document.querySelectorAll('#portada img')].every((i) => i.complete && i.naturalWidth > 0),
        orden: z('.portada__cielo') < z('.portada__titulo') && z('.portada__titulo') < z('.portada__olivos') && z('.portada__olivos') < z('.portada__suelo'),
        titularEnElCielo: t.bottom <= caja.top + caja.height * 0.6 && t.top >= caja.top - 2,
        titularDentro: t.left >= caja.left - 2 && t.right <= caja.right + 2 && t.width >= caja.width * 0.5,
        botones: b.every((x) => x.right <= innerWidth + 1 && x.height >= 44),
        sinScroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ctaVisible: b[0].bottom <= innerHeight + 1 || innerHeight < 700,
        noAmplia: q('.portada__foto').width <= 1920,
        _pos: (() => { const fs = parseFloat(getComputedStyle(document.querySelector('.portada__palabra')).fontSize); const k = 800 / caja.height, x0 = (1780 - caja.width * k) / 2; return `palabra ${Math.round(fs)} px; en la foto x ${Math.round(x0 + (t.left - caja.left) * k)}-${Math.round(x0 + (t.right - caja.left) * k)}, y ${Math.round((t.top - caja.top) * k)}-${Math.round((t.bottom - caja.top) * k)} (de 1780x800)`; })(),
      };
    });
    nota(`${w}×${h}: ${r._pos}`); delete r._pos;
    comprobar(Object.values(r).every(Boolean), `${w}×${h}: capas cargadas en orden (cielo, palabra, olivos, loma), «Montemar» dentro del cielo, botones ≥ 44 px, «Ver fechas» a la vista y sin scroll lateral`, r);
    comprobar(page._errores.length === 0, `${w}×${h}: sin errores`, page._errores.slice(0, 3));
    await ctx.close();
  }
  }

  /* ---------- 3. contraste, foco, fondo que baja y medidor (escritorio) ---------- */
  if (toca(3)) {
  console.log('\n3. Contraste, foco, el fondo que baja y el medidor (escritorio, movimiento reducido)');
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(PAG);
  await page.waitForLoadState('load');
  const sel = ['.portada__antes', '.portada__sub', '.portada__acc .btn--acento', '.portada__acc .btn--linea',
    '#t-quedarse', '#quedarse .sec-txt', '.unidad__tipo', '.unidad__tit', '.unidad__txt', '.unidad__cifras dd', '.unidad__cifras dt', '.unidad__nota', '.unidad__serv b', '.unidad__serv span', '.unidad .btn--acento',
    '.comun__tit', '.comun__lista b', '.comun__lista span', '.cond li span', '.cond__precio',
    '#t-dentro', '.estancias__indice a[aria-current]', '.estancias__indice a:not([aria-current])', '.estancia__txt',
    '#t-vista', '#vista .sec-txt', '.vista__nota', '.vista__cam .btn',
    '#t-lugar', '#lugar .sec-txt', '.lugar__respaldo figcaption',
    '.cerca__nombre', '.cerca__min', '.cerca__km', '.rumbo__tit', '.rumbo__tit small', '.rumbo__lista b', '.rumbo__min', '.rumbo__km', '.alrededor__fino',
    '.resenas__dato', '#resenas .btn', '.real', '.busca__eti', '.busca__resumen', '.busca__pista', '.cal__tit', '.cal__dias button:not(:disabled)', '.motor__vacio p', '.reservar__alt', '#busca-ir',
    '.contacto__dir', '.contacto__ruta', '.map-consent b', '.map-consent span', '.pie__h', '.pie__cols p', '.pie__cols a', '.ayuda__txt', '.pie__legal p', '.pie__legal a'];
  // el contraste se mide con el fondo del tramo que le toca a cada sección
  const cs = [];
  for (const s of sel) {
    await page.evaluate((s) => { const el = document.querySelector(s); if (el) scrollTo(0, el.getBoundingClientRect().top + scrollY - innerHeight * 0.45); }, s);
    await cuadro();
    cs.push(...await contrastes(page, [s]));
  }
  const grandes = new Set(['#t-quedarse', '.unidad__tit', '.unidad__cifras dd', '.comun__tit', '#t-dentro', '#t-vista', '#t-lugar', '.cerca__min', '.rumbo__tit', '.cal__tit', '.contacto__dir']);
  const malos = cs.filter(([s, c]) => c === 'falta' || c < (grandes.has(s) ? 3 : 4.5));
  comprobar(malos.length === 0, `contraste WCAG ≥ 4,5:1 (3:1 en rótulos grandes) en ${cs.length} parejas de texto, cada una sobre el fondo de su tramo`, malos);
  nota('peores: ' + cs.filter(([, c]) => c !== 'falta').sort((a, b) => a[1] - b[1]).slice(0, 4).map(([s, c]) => `${s} ${c}`).join(' · '));
  // cabecera
  await page.evaluate(() => scrollTo(0, 900)); await cuadro();
  const cb = await contrastes(page, ['.cab__nav a', '.cab__tel']);
  comprobar(await page.evaluate(() => document.getElementById('cab').classList.contains('sc')) && cb.every(([, c]) => c >= 4.5), 'cabecera: al bajar, fondo con blur y texto ≥ 4,5:1', cb);
  // el fondo que baja: monte → tierra → agua
  const tramos = [];
  for (const s of ['#quedarse', '#dentro', '#vista', '#alrededor', '#reservar']) { await irA(page, s, 0.2); await cuadro(); tramos.push(await page.evaluate(() => [document.documentElement.dataset.tramo, getComputedStyle(document.documentElement).backgroundColor])); }
  comprobar(JSON.stringify(tramos.map((t) => t[0])) === '["monte","tierra","tierra","agua","agua"]' && new Set(tramos.map((t) => t[1])).size === 3, 'el fondo baja como el logo: verde en la finca, tierra en la casa, agua al llegar al mar (contenido: también con movimiento reducido)', tramos);
  // el medidor de altura: de la cota a 0 al llegar a Reservar; se esconde en #lugar
  await page.evaluate(() => scrollTo(0, 0)); await cuadro();
  const mP = await page.evaluate(() => document.getElementById('medidor').classList.contains('es-oculto'));
  await irA(page, '#quedarse', 0.42); await cuadro();   // la portada ya ha dejado la línea media de la pantalla
  const m0 = await page.evaluate(() => ({ n: +document.getElementById('medidor-n').textContent, vis: getComputedStyle(document.getElementById('medidor')).display !== 'none' && !document.getElementById('medidor').classList.contains('es-oculto'), cota: window.Montemar.web.cota }));
  await irA(page, '#lugar', 0.1); await cuadro();
  const mL = await page.evaluate(() => document.getElementById('medidor').classList.contains('es-oculto'));
  await irA(page, '#alrededor', 0.2); await cuadro();
  const mA = await page.evaluate(() => +document.getElementById('medidor-n').textContent);
  await irA(page, '#reservar', 0.5); await cuadro();
  const mR = await page.evaluate(() => +document.getElementById('medidor-n').textContent);
  const lj = existe('data/lugar.json') ? JSON.parse(leer('data/lugar.json')).cotaFinca : 41;
  comprobar(mP && m0.vis && m0.n === Math.round(lj) && mL && mA < m0.n && mA > 0 && mR === 0, `medidor: escondido sobre la portada, ${m0.n} m al empezar a bajar (data/lugar.json: ${lj}), oculto en el 3D, ${mA} m en Alrededor y 0 m al llegar a Reservar`, { mP, m0, mL, mA, mR });
  const medR = await page.evaluate(() => { const r = document.getElementById('medidor').getBoundingClientRect(); const e = document.querySelector('#alrededor .env').getBoundingClientRect(); return { med: r.left, contenido: e.right }; });
  comprobar(medR.med >= medR.contenido, 'en escritorio el medidor va en el margen, sin tapar contenido', medR);
  // foco del teclado
  await page.evaluate(() => scrollTo(0, 0));
  const focos = [];
  for (const s of ['.portada__acc .btn--acento', '.unidad .foto-btn', '.estancias__indice a', '#lugar figcaption', '#mapa-btn', '.pie__cols a', '#busca-ir']) {
    const loc = page.locator(s).first();
    if (s === '#lugar figcaption') { await page.evaluate(() => { const f = document.querySelector('#lugar figcaption'); f.tabIndex = -1; }); }
    await loc.scrollIntoViewIfNeeded();
    await loc.focus();
    await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
    await page.waitForTimeout(60);
    focos.push(await page.evaluate(() => {
      const el = document.activeElement, c = getComputedStyle(el), m = document.getElementById('foco-copas');
      const r = el.getBoundingClientRect(), rm = m.getBoundingClientRect();
      return { el: el.tagName + '.' + el.className.toString().slice(0, 20), ancho: c.outlineWidth, estilo: c.outlineStyle, marco: m.classList.contains('es-visible') && rm.left < r.left && rm.right > r.right && rm.top < r.top && m.querySelectorAll('circle').length === 3 };
    }));
  }
  const fOk = focos.filter((f) => !/FIGCAPTION/.test(f.el));
  comprobar(fOk.length >= 5 && fOk.every((f) => f.ancho === '2px' && f.estilo === 'solid' && f.marco), 'foco del teclado: contorno de 2 px y el marco redondeado con las tres copas en la esquina', focos);
  const cf = await page.evaluate(() => {
    const lz = document.createElement('canvas').getContext('2d');
    const rgb = (c) => { lz.fillStyle = c; lz.fillRect(0, 0, 1, 1); return [...lz.getImageData(0, 0, 1, 1).data].slice(0, 3); };
    const L = (m) => { m = m.map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * m[0] + .7152 * m[1] + .0722 * m[2]; };
    const k = (a, b) => { const x = L(rgb(a)), y = L(rgb(b)); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    return { hojaMonte: k('#215A37', '#EDF2EC'), hojaTierra: k('#215A37', '#F3ECE7'), hojaAgua: k('#215A37', '#EAF1F6'), claroNoche: k('#EEF3EE', '#0E1C14') };
  });
  comprobar(Object.values(cf).every((v) => v >= 3), 'el color del foco llega a 3:1 contra los cuatro fondos', cf);
  // el pie, con movimiento reducido, ya está completo
  comprobar(await page.evaluate(() => document.querySelector('.pie__simbolo').classList.contains('es-completo') && getComputedStyle(document.querySelector('.lp-c3')).transform === 'none'), 'pie: con movimiento reducido el logo ya está completo (estado final)');
  comprobar(page._errores.length === 0, 'sin errores de consola', page._errores.slice(0, 3));
  await ctx.close();
  }

  /* ---------- 4. letras, fichas, por dentro y el visor por nombre ---------- */
  if (toca(4)) {
  console.log('\n4. Letras, fichas, el índice de estancias y el visor por NOMBRE');
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(PAG);
  const fam = await page.evaluate(() => ({ h: getComputedStyle(document.querySelector('.unidad__tit')).fontFamily, cifra: getComputedStyle(document.querySelector('.unidad__cifras dd')).fontFamily, p: getComputedStyle(document.querySelector('.unidad__txt')).fontFamily }));
  comprobar(/Afacad/.test(fam.h) && /Noto Sans Mono/.test(fam.cifra) && /Fustat/.test(fam.p), 'titulares en Afacad, cifras en Noto Sans Mono y texto en Fustat', fam);
  // «Ver fechas» de una ficha baja a Reservar
  await page.click('#unidad-chalet [data-reservar="chalet"]');
  await page.waitForTimeout(250);
  const rv = await page.evaluate(() => ({ top: document.getElementById('reservar').getBoundingClientRect().top, unidad: window.Montemar.reserva.estado.unidad }));
  comprobar(rv.top > -10 && rv.top < 140 && rv.unidad === 'chalet', '«Ver fechas» del chalet baja a Reservar', rv);
  // índice de estancias
  const marcadas = [];
  for (const id of ['apartamento', 'chalet', 'fuera']) {
    await page.evaluate((id) => { const s = document.getElementById('est-' + id); scrollTo(0, s.getBoundingClientRect().top + scrollY - innerHeight * 0.3); }, id);
    await page.waitForTimeout(150);
    marcadas.push(await page.evaluate(() => document.querySelector('.estancias__indice a[aria-current="true"]').dataset.est));
  }
  comprobar(JSON.stringify(marcadas) === '["apartamento","chalet","fuera"]', 'el índice marca la estancia que se ve (también con movimiento reducido)', marcadas);
  const filas = await page.evaluate(() => [...document.querySelectorAll('.estancia .filas')].map((f) => { const ys = new Map(); f.querySelectorAll('.foto').forEach((x) => { const r = x.getBoundingClientRect(); const k = Math.round(r.top); if (!ys.has(k)) ys.set(k, []); ys.get(k).push(Math.round(r.height)); }); return [...ys.values()].every((hs) => Math.max(...hs) - Math.min(...hs) <= 2); }));
  const grandes = await page.evaluate(() => [...document.querySelectorAll('.foto')].filter((f) => f.getBoundingClientRect().width > parseFloat(getComputedStyle(f).maxWidth) + 1).length);
  comprobar(filas.every(Boolean) && grandes === 0, 'por dentro: fotos sin marco con la misma altura en cada fila, ninguna más ancha que su original', { filas, grandes });
  // el visor abre la MISMA foto que se pulsa (por nombre), todas
  const malV = [];
  for (const b of await page.$$('#dentro [data-visor]')) {
    const n = await b.getAttribute('data-visor');
    await b.scrollIntoViewIfNeeded(); await b.click();
    await page.waitForFunction(() => document.getElementById('visor').open);
    const v = await page.evaluate(() => document.getElementById('visor-img').dataset.nombre);
    if (v !== n) malV.push([n, v]);
    await page.click('#visor-cerrar');
  }
  comprobar(malV.length === 0, 'visor: cada foto de «Por dentro» abre ella misma (por nombre), con ratón', malV);
  await page.click('#dentro [data-visor="chalet-cocina"]');
  await page.click('#visor-sig');
  const sig = await page.evaluate(() => document.getElementById('visor-img').dataset.nombre);
  await page.keyboard.press('Escape');
  comprobar(sig === 'chalet-limones', 'visor: «siguiente» sigue el orden de la estancia', sig);
  comprobar(page._errores.length === 0, 'sin errores de consola', page._errores.slice(0, 3));
  await ctx.close();
  }

  /* ---------- 5. el tiempo de ahora (Open-Meteo servido falso) y su fallo ---------- */
  if (toca(5)) {
  console.log('\n5. El tiempo de ahora (Open-Meteo falso) y qué pasa si no responde');
  {
    const { ctx, page } = await nueva({}, { script: sinCookies });
    await page.goto(PAG);
    await irA(page, '#vista');
    await page.waitForFunction(() => document.getElementById('tiempo').dataset.estado !== 'cargando', null, { timeout: 8000 }).catch(() => {});
    const t = await page.evaluate(() => ({ e: document.getElementById('tiempo').dataset.estado, cielo: document.getElementById('t-cielo').textContent, temp: document.getElementById('t-temp').textContent, viento: document.getElementById('t-viento').textContent + ' ' + document.getElementById('t-viento-dir').textContent, ola: document.getElementById('t-ola').textContent + ' ' + document.getElementById('t-ola-per').textContent, ico: document.getElementById('tiempo-ico').getAttribute('href'), fuente: document.getElementById('tiempo-fuente').textContent }));
    comprobar(t.e === 'listo' && t.cielo === 'Casi despejado' && t.temp === '13 °C' && /27 km\/h del oeste, rachas de 50/.test(t.viento) && /3,4 m cada 9 s, del noroeste/.test(t.ola) && t.ico === '#i-sol' && /14:15/.test(t.fuente), 'el tiempo de Navia: cielo, temperatura, viento y oleaje con su hora y su fuente', t);
    comprobar(page._errores.length === 0, 'sin errores de consola', page._errores.slice(0, 3));
    await ctx.close();
  }
  {
    const { ctx, page } = await nueva({}, { script: sinCookies, tiempo: 'mal' });
    await page.goto(PAG);
    await irA(page, '#vista');
    await page.waitForFunction(() => document.getElementById('tiempo').dataset.estado === 'error', null, { timeout: 12000 }).catch(() => {});
    const t = await page.evaluate(() => ({ e: document.getElementById('tiempo').dataset.estado, datos: document.getElementById('tiempo-datos').hidden, txt: document.getElementById('tiempo-estado').textContent, cam: !!document.querySelector('.vista__cam a') }));
    comprobar(t.e === 'error' && t.datos && /no se puede leer/.test(t.txt) && t.cam, 'si Open-Meteo no responde: no sale ningún dato, se dice, y el botón de su cámara sigue', t);
    await ctx.close();
  }
  }

  /* ---------- 6. reservar: el buscador y el iframe de su WuBook real (servido falso) ---------- */
  if (toca(6)) {
  console.log('\n6. Reservar: validación y el motor real (WuBook servido falso) en escritorio y móvil');
  for (const movil of [false, true]) {
    const op = movil ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {};
    const { ctx, page } = await nueva(op, { script: sinCookies });
    await page.goto(PAG);
    await irA(page, '#reservar', 0.1);
    const v0 = await page.evaluate(() => ({ iframe: !!document.querySelector('#motor iframe'), aviso: getComputedStyle(document.querySelector('.real')).display !== 'none' }));
    // sin fechas: error y nada de iframe
    if (movil) await page.tap('#busca-ir'); else await page.click('#busca-ir');
    const e1 = await page.evaluate(() => ({ err: document.getElementById('busca-error').textContent, vis: !document.getElementById('busca-error').hidden, iframe: !!document.querySelector('#motor iframe') }));
    // dos días del calendario (el 10 y el 13 del mes que viene)
    if (movil) await page.tap('.cal__flecha[data-nav="1"]'); else await page.click('.cal__flecha[data-nav="1"]');
    const dias = await page.$$('.cal__mes:first-of-type .cal__dias button:not([disabled])');
    if (movil) { await dias[9].tap(); await dias[12].tap(); } else { await dias[9].click(); await dias[12].click(); }
    const k = await page.evaluate(() => ({ a: window.Montemar.reserva.estado.entrada, b: window.Montemar.reserva.estado.salida, n: document.querySelector('[data-noches]').textContent }));
    if (movil) await page.tap('#busca-ir'); else await page.click('#busca-ir');
    await page.waitForSelector('#motor iframe');
    const u = await page.evaluate(() => ({ src: document.getElementById('motor-iframe').src, fuera: document.getElementById('motor-fuera').href, alto: document.getElementById('motor-iframe').getBoundingClientRect().height, ancho: document.getElementById('motor-iframe').getBoundingClientRect().width }));
    await page.waitForFunction(() => /con tus fechas/.test(document.getElementById('motor-estado').textContent), null, { timeout: 5000 }).catch(() => {});
    const est = await page.evaluate(() => document.getElementById('motor-estado').textContent);
    const okUrl = /^https:\/\/wubook\.net\/wbkd\/wbk\/\?lcode=1601452661&dfrom=\d{2}\/\d{2}\/\d{4}&dto=\d{2}\/\d{2}\/\d{4}&lang=es$/.test(u.src);
    const [d1, m1, a1] = u.src.match(/dfrom=(\d{2})\/(\d{2})\/(\d{4})/).slice(1).map(Number), [d2, m2, a2] = u.src.match(/dto=(\d{2})\/(\d{2})\/(\d{4})/).slice(1).map(Number);
    const noches = Math.round((new Date(a2, m2 - 1, d2) - new Date(a1, m1 - 1, d1)) / 864e5);
    const tag = movil ? 'móvil' : 'escritorio';
    comprobar(!v0.iframe && v0.aviso && e1.vis && /llegada/.test(e1.err) && !e1.iframe, `${tag}: sin fechas no se abre nada y se dice qué falta; el aviso de motor real se ve`, { v0, e1 });
    comprobar(okUrl && noches === 3 && d1 === 10 && /3 noches/.test(k.n) && u.fuera === u.src && /con tus fechas/.test(est) && u.alto >= 600 && u.ancho <= (movil ? 390 : 1280), `${tag}: el iframe de su WuBook se CREA al buscar, con dfrom/dto en DD/MM/AAAA y lang=es, y el enlace a otra pestaña`, { src: u.src, n: k.n, est, alto: u.alto });
    await page.click('#motor-sin-fechas');
    const sinF = await page.evaluate(() => document.getElementById('motor-iframe').src);
    comprobar(sinF === 'https://wubook.net/wbkd/wbk/?lcode=1601452661&lang=es', `${tag}: «Abrir su motor sin fechas» abre la dirección base`, sinF);
    // la salida antes de la llegada no vale (por API)
    const m = await page.evaluate(() => { window.Montemar.reserva.fechas('2027-03-12', '2027-03-10'); return window.Montemar.reserva.validar(); });
    comprobar(/salida|llegada/.test(m), `${tag}: una salida anterior a la llegada no pasa la validación`, m);
    comprobar(page._errores.length === 0, `${tag}: sin errores de consola`, page._errores.slice(0, 3));
    await ctx.close();
  }
  }

  /* ---------- 7. cookies y mapa ---------- */
  if (toca(7)) {
  console.log('\n7. Aviso de cookies y mapa bajo clic');
  const { ctx, page } = await nueva();
  await page.goto(PAG);
  const c1 = await page.evaluate(() => getComputedStyle(document.getElementById('cookies')).display);
  await page.click('#ck-si');
  const c2 = await page.evaluate((k) => [getComputedStyle(document.getElementById('cookies')).display, localStorage.getItem(k)], LLAVE);
  await page.reload();
  const c3 = await page.evaluate(() => getComputedStyle(document.getElementById('cookies')).display);
  comprobar(c1 === 'flex' && c2[0] === 'none' && c2[1] === 'si' && c3 === 'none', 'cookies: sale, «Entendido» lo cierra de verdad, se guarda y no vuelve al recargar', { c1, c2, c3 });
  await page.click('#abrir-cookies');
  comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('cookies')).display === 'flex'), '«Preferencias de cookies» lo vuelve a enseñar');
  await page.click('#ck-no');
  const m0 = await page.evaluate(() => document.querySelectorAll('iframe').length);
  await irA(page, '#contacto');
  await page.click('#mapa-btn');
  const m1 = await page.evaluate(() => { const f = document.querySelector('#mapa iframe'); return f && f.src; });
  comprobar(m0 === 0 && /google\.com\/maps\?q=Apartamentos%20Montemar.*output=embed/.test(m1 || ''), 'mapa: ningún iframe hasta pulsar; luego Google Maps sin clave', m1);
  comprobar(page._errores.length === 0, 'sin errores de consola', page._errores.slice(0, 3));
  await ctx.close();
  }

  /* ---------- 8. mando de densidades (?revision) ---------- */
  if (toca(8)) {
  console.log('\n8. Mando de maqueta: «Del monte al mar» y «Sobria»');
  {
    const { ctx, page } = await nueva({}, { script: sinCookies });
    await page.goto(PAG);
    comprobar(await page.evaluate(() => document.getElementById('mando').hidden && getComputedStyle(document.getElementById('mando')).display === 'none'), 'sin ?revision el mando no existe para el cliente');
    await ctx.close();
  }
  const { ctx, page } = await nueva();
  await page.goto(BASE + 'index.html?sin-webgl&revision');
  const a0 = await page.evaluate(() => document.getElementById('mando').hidden);
  await page.click('#ck-si');
  const a1 = await page.evaluate(() => getComputedStyle(document.getElementById('mando')).display);
  comprobar(a0 === true && a1 === 'flex', 'el mando se aparta mientras está el aviso de cookies y aparece al cerrarlo', { a0, a1 });
  const ancho0 = await page.evaluate(() => document.documentElement.scrollWidth);
  await page.click('button[data-densidad="sobria"]');
  await irA(page, '#dentro', 0.2); await cuadro();
  const s = await page.evaluate(() => ({ cls: document.documentElement.classList.contains('densidad-sobria'), vistazo: getComputedStyle(document.getElementById('vistazo')).display, filas: document.querySelectorAll('#vistazo tbody tr').length, medidor: getComputedStyle(document.getElementById('medidor')).display, fondo: getComputedStyle(document.documentElement).backgroundColor, url: location.search, ancho: document.documentElement.scrollWidth, pulsado: document.querySelector('button[data-densidad="sobria"]').getAttribute('aria-pressed') }));
  comprobar(s.cls && s.vistazo === 'block' && s.filas === 8 && s.medidor === 'none' && s.fondo === 'rgb(237, 242, 236)' && /densidad=sobria/.test(s.url) && s.ancho <= ancho0 && s.pulsado === 'true', 'Sobria: fondo de un solo color, sin medidor, portada quieta y AÑADE la tabla «De un vistazo» (8 filas), sin desbordar', s);
  await page.click('button[data-densidad="monte"]');
  const v = await page.evaluate(() => ({ cls: document.documentElement.classList.contains('densidad-sobria'), vistazo: getComputedStyle(document.getElementById('vistazo')).display }));
  comprobar(!v.cls && v.vistazo === 'none', 'y se puede volver a «Del monte al mar»', v);
  comprobar(page._errores.length === 0, 'sin errores de consola', page._errores.slice(0, 3));
  await ctx.close();
  }

  /* ---------- 9. móvil: menú, desbordes, visor con el dedo y la barra del navegador ---------- */
  if (toca(9)) {
  console.log('\n9. Móvil (390×844): menú, sin desbordes, visor con el dedo y la barra del navegador');
  const { ctx, page } = await nueva({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, { script: sinCookies });
  await page.goto(PAG);
  const des = [];
  for (const s of ['#portada', '#quedarse', '#dentro', '#vista', '#lugar', '#alrededor', '#resenas', '#reservar', '#contacto', '#pie']) {
    await irA(page, s, 0); await cuadro();
    des.push(await page.evaluate((s) => [s, document.documentElement.scrollWidth, innerWidth], s));
  }
  comprobar(des.every(([, a, b]) => a <= b), 'ninguna sección desborda en horizontal a 390 px', des.filter(([, a, b]) => a > b));
  await page.evaluate(() => scrollTo(0, 0));
  await page.tap('#menu-btn');
  const m1 = await page.evaluate(() => ({ exp: document.getElementById('menu-btn').getAttribute('aria-expanded'), vis: getComputedStyle(document.getElementById('menu-movil')).visibility, alto: document.getElementById('menu-movil').getBoundingClientRect().height }));
  await page.tap('#menu-btn');
  const m2 = await page.evaluate(() => document.getElementById('menu-btn').getAttribute('aria-expanded'));
  await page.tap('#menu-btn');
  await page.tap('#menu-movil a[href="#alrededor"]');
  await page.waitForTimeout(300);
  const m3 = await page.evaluate(() => ({ exp: document.getElementById('menu-btn').getAttribute('aria-expanded'), top: document.getElementById('alrededor').getBoundingClientRect().top }));
  comprobar(m1.exp === 'true' && m1.vis === 'visible' && m1.alto >= 800 && m2 === 'false' && m3.exp === 'false' && Math.abs(m3.top) < 160, 'menú móvil: abre a toda la altura, se cierra con el mismo botón y un enlace lleva a su sección', { m1, m2, m3 });
  // visor con el dedo, y los botones tocables en toda su altura
  await irA(page, '#est-chalet', 0.2);
  await page.tap('#dentro [data-visor="chalet-verde"]');
  await page.waitForFunction(() => document.getElementById('visor').open);
  const vn = await page.evaluate(() => document.getElementById('visor-img').dataset.nombre);
  const toques = await page.evaluate(() => { const b = document.getElementById('visor-sig').getBoundingClientRect(); return [0.25, 0.5, 0.75, 0.9].every((f) => { const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height * f); return el && el.closest('#visor-sig'); }); });
  await page.tap('#visor-sig');
  const vs = await page.evaluate(() => document.getElementById('visor-img').dataset.nombre);
  await page.tap('#visor-cerrar');
  comprobar(vn === 'chalet-verde' && toques && vs === 'chalet-dos-camas', 'visor con el dedo: abre la que se toca, el botón «siguiente» responde en toda su altura', { vn, toques, vs });
  // el medidor en móvil: escondido al entrar; acompaña solo al bajar
  await page.evaluate(() => scrollTo(0, 0)); await cuadro();
  const md0 = await page.evaluate(() => document.getElementById('medidor').classList.contains('es-oculto'));
  comprobar(md0, 'medidor en móvil: escondido en la portada (no tapa «Ver fechas»)');
  // la barra del navegador: cambiar solo el alto no rehace nada ni mueve el contenido
  await page.addStyleTag({ content: '.portada__foto{max-height:none!important}' });
  await irA(page, '#dentro', 0.3); await cuadro();
  let eventos = 0;
  await page.exposeFunction('contarResize', () => { eventos++; });
  await page.evaluate(() => document.addEventListener('montemar:resize', () => window.contarResize()));
  const top0 = await page.evaluate(() => document.querySelector('#t-dentro').getBoundingClientRect().top + scrollY);
  for (const h of [900, 844, 900, 844]) { await page.setViewportSize({ width: 390, height: h }); await page.waitForTimeout(260); }
  const top1 = await page.evaluate(() => document.querySelector('#t-dentro').getBoundingClientRect().top + scrollY);
  comprobar(eventos === 0 && Math.abs(top1 - top0) < 1, 'la barra del móvil (solo cambia el alto) no rehace nada ni mueve el contenido', { eventos, top0, top1 });
  comprobar(page._errores.length === 0, 'sin errores de consola', page._errores.slice(0, 3));
  await ctx.close();
  }

  /* ---------- 10. legales, 404 y el 3D (solo contenedor y respaldo) ---------- */
  if (toca(10)) {
  console.log('\n10. Legales, 404 y el hueco del 3D');
  const { ctx, page } = await nueva({}, { script: sinCookies });
  for (const f of ['aviso-legal.html', 'privacidad.html', 'cookies.html', 'accesibilidad.html', '404.html']) {
    page._errores = [];
    await page.goto(BASE + f);
    const t = await page.evaluate(() => document.body.innerText);
    const ok = page._errores.length === 0 && (f === '404.html' ? /Aquí no ha crecido nada/.test(t) : !/aviso-legal|privacidad/.test(f) || (/MONTEMAR - NAVIA S\.L\./.test(t) && /B-74331406/.test(t)));
    comprobar(ok, `${f}: carga sin errores${/aviso-legal|privacidad/.test(f) ? ' y lleva el titular (MONTEMAR - NAVIA S.L., B-74331406)' : ''}`, page._errores.slice(0, 3));
  }
  comprobar(/WuBook/.test(leer('cookies.html')) && /wbocookies/.test(leer('cookies.html')) && /Open-Meteo/.test(leer('cookies.html')) && /montemar-cookies/.test(leer('privacidad.html')), 'cookies y privacidad cuentan lo que pasa: WuBook (wbocookies), Open-Meteo y la única clave guardada');
  page._errores = [];
  await page.goto(PAG);
  await irA(page, '#lugar', 0.1);
  await page.waitForFunction(() => { const i = document.querySelector('#lugar [data-modulo="lugar"] img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 6000 }).catch(() => {});
  const l = await page.evaluate(() => {
    const div = document.querySelector('#lugar [data-modulo="lugar"]'), img = div && div.querySelector('img');
    const sec = document.getElementById('lugar'), cs = getComputedStyle(sec);
    let a = div, ancestros = true;
    while (a && a !== document.documentElement) { const s = getComputedStyle(a); if (a !== div && (s.transform !== 'none' || s.filter !== 'none' || /hidden|scroll|auto/.test(s.overflow))) ancestros = false; a = a.parentElement; }
    return { div: !!div, foto: !!img && img.complete && img.naturalWidth > 0 && img.getBoundingClientRect().height > 100, texto: !!div.querySelector('figcaption'), fondo: cs.backgroundColor, color: cs.color, ancestros, webgl: !!div.querySelector('canvas') };
  });
  comprobar(l.div && l.foto && l.texto && l.fondo === 'rgb(14, 28, 20)' && l.color === 'rgb(238, 243, 238)' && l.ancestros && !l.webgl, '#lugar: sección oscura con texto claro, el contenedor existe, el respaldo (foto + texto) se ve y ningún antepasado lleva transform/filter/overflow (sin pintar WebGL)', l);
  comprobar(page._errores.length === 0, 'sin errores de consola (con js/lugar.js vacío)', page._errores.slice(0, 3));
  await ctx.close();
  }

  /* ---------- 11. con movimiento (una vez, al final): capas, gesto táctil, pie y recarga ---------- */
  if (toca(11)) {
  console.log('\n11. Con movimiento (una sola pasada): capas que se separan, gesto con el dedo, el logo del pie y la recarga');
  {
    const { ctx, page } = await nueva({ reducedMotion: 'no-preference' }, { script: sinCookies });
    await page.goto(PAG);
    await page.waitForFunction(() => document.querySelector('[data-modulo="portada"]').dataset.montado === '1');
    const t0 = await page.evaluate(() => getComputedStyle(document.querySelector('.portada__titulo')).transform);
    await page.mouse.move(640, 300);
    await page.mouse.wheel(0, 320);
    await page.waitForFunction(() => scrollY > 200);
    await page.waitForTimeout(250);
    const t1 = await page.evaluate(() => ({ tit: new DOMMatrix(getComputedStyle(document.querySelector('.portada__titulo')).transform).m42, oli: new DOMMatrix(getComputedStyle(document.querySelector('.portada__olivos')).transform).a, y: scrollY }));
    comprobar(t1.tit > 40 && t1.oli > 1.01, 'al bajar, «Montemar» se hunde detrás de los olivos y los olivos se acercan', { t0, t1 });
    // titulares que aparecen
    const vistos = [];
    for (const s of ['#t-quedarse', '#t-dentro', '#t-alrededor', '#t-reservar']) { await irA(page, s, 0.5); await page.waitForTimeout(200); vistos.push(await page.evaluate((s) => document.querySelector(s).classList.contains('es-visto'), s)); }
    comprobar(vistos.every(Boolean), 'los titulares aparecen al llegar (observando su contenedor)', vistos);
    // el pie: el logo se completa al llegar
    const p0 = await page.evaluate(() => document.querySelector('.pie__simbolo').classList.contains('es-completo'));
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(2300);   // la última copa: 0,8 s de espera + 1 s de muelle
    const p1 = await page.evaluate(() => ({ c: document.querySelector('.pie__simbolo').classList.contains('es-completo'), t: getComputedStyle(document.querySelector('.lp-c3')).transform }));
    comprobar(!p0 && p1.c && (p1.t === 'none' || /matrix\(1, 0, 0, 1/.test(p1.t)), 'pie: el logo crece al llegar (troncos y copas) y acaba completo', { p0, p1 });
    // recargar a media página: se entra arriba
    await page.evaluate(() => scrollTo(0, 2400));
    await page.reload();
    await page.waitForLoadState('load');
    await page.waitForTimeout(200);
    comprobar(await page.evaluate(() => scrollY) === 0, 'recargar a media página entra arriba');
    comprobar(page._errores.length === 0, 'sin errores de consola', page._errores.slice(0, 3));
    await ctx.close();
  }
  {
    // el gesto propio de la portada con eventos táctiles reales (CDP)
    const { ctx, page } = await nueva({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' }, { script: sinCookies });
    await page.goto(PAG);
    await page.waitForFunction(() => document.querySelector('[data-modulo="portada"]').dataset.montado === '1');
    const cdp = await ctx.newCDPSession(page);
    const caja = await page.evaluate(() => { const r = document.querySelector('.portada__foto').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const toque = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const gesto = () => page.evaluate(() => { for (const [el, v] of window.Montemar.web.montados) if (el.dataset.modulo === 'portada') return v.inst.gesto; return null; });
    await toque('touchStart', caja.x, caja.y);
    for (let i = 1; i <= 10; i++) { await toque('touchMove', caja.x + i * 14, caja.y + i); await page.waitForTimeout(16); }
    const durante = await gesto();
    const tr = await page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.portada__olivos')).transform).m41);
    await toque('touchEnd');
    await page.waitForTimeout(900);
    const despues = await gesto();
    const y0 = await page.evaluate(() => scrollY);
    await toque('touchStart', caja.x, caja.y + 80);
    for (let i = 1; i <= 10; i++) { await toque('touchMove', caja.x, caja.y + 80 - i * 22); await page.waitForTimeout(16); }
    await toque('touchEnd');
    await page.waitForTimeout(500);
    const y1 = await page.evaluate(() => scrollY);
    comprobar(durante > 4 && tr > 4 && Math.abs(despues) < 1 && y1 > y0 + 50, 'gesto con el dedo: arrastrar en horizontal mueve los olivos (asomarse), al soltar vuelven, y en vertical la página sigue bajando', { durante, tr, despues, y0, y1 });
    comprobar(page._errores.length === 0, 'sin errores de consola', page._errores.slice(0, 3));
    await ctx.close();
  }
  }
} finally {
  if (browser) await browser.close();
  servidor.close();
}

console.log(`\n${nOk} comprobaciones bien, ${fallos.length} mal`);
if (fallos.length) { console.log('Fallan:\n - ' + fallos.join('\n - ')); process.exitCode = 1; }
