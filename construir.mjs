/* Genera las páginas a partir de sus fuentes *.src.html (arquitectura de ../amaicha-ribadesella-web/construir.mjs):
   1. <!--parte:partes/archivo.html--> → el contenido de ese archivo (si falta, un comentario y la web sigue).
   2. Una sola fuente de datos, data/montemar.json (de ref/DATOS-MONTEMAR.md):
        · <!--unidades--> las dos fichas (cifras, servicios con icono y condiciones aparte);
        · <!--vistazo--> la tabla «De un vistazo» (solo se ve en la versión sobria);
        · <!--finca--> lo común de la finca; <!--estancias--> «Por dentro»; <!--resenas-->.
   3. <!--alrededor--> y <!--llegar-->: las distancias de ref/raw/rutas.json (OSRM, scripts/alrededor-rutas.mjs). Sin el
      fichero, o sin un destino, no se escribe esa cifra: «por confirmar».
   4. La marca (marca/logo.json, de scripts/marca-logo.py): <!--logo-pie--> (el logo del pie, por piezas, para que
      crezca) y <!--suelo-portada--> (la loma y la ola que cierran la portada).
   5. {{COTA}}: la cota de la finca para el medidor (data/lugar.json, de Lugar 3D; sin él, 41). main.js la vuelve a leer.
   6. <img data-foto="nombre" ...> → <picture> con AVIF, WebP y JPG en todos los anchos de img/fotos/fotos.json.
      <!--precarga-portada--> → <link rel="preload"> de la capa de los olivos (el LCP).
   7. Los <link>/<script> de CSS/JS propios que no existen se quitan con un aviso, SALVO los del 3D (css/lugar.css y
      js/lugar.js, del agente Lugar 3D): esos se dejan siempre, para que en cuanto existan se carguen sin reconstruir.
   8. Ejecuta versionar.mjs (?v=<huella> en CSS y JS).
   Se edita SIEMPRE el *.src.html (o la parte); el .html generado se sobrescribe. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const leerJson = (f) => JSON.parse(fs.readFileSync(path.join(RAIZ, f), 'utf8'));
const FOTOS = new Map(leerJson('img/fotos/fotos.json').map((f) => [f.nombre, f]));
const D = leerJson('data/montemar.json');
const LOGO = leerJson('marca/logo.json');
const num = (n) => String(n).replace('.', ',');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const r2 = (v) => { const s = (Math.round(v * 100) / 100).toString(); return s === '-0' ? '0' : s; };

/* ---------- fotos ---------- */
const sets = (nombre) => {
  const f = FOTOS.get(nombre);
  if (!f) throw new Error('Foto desconocida: ' + nombre);
  const set = (ext) => f.anchos.map((w) => `img/fotos/${nombre}-${w}.${ext} ${w}w`).join(', ');
  return { f, set };
};
function picture(atrs) {
  const nombre = /data-foto="([^"]+)"/.exec(atrs)[1];
  const { f, set } = sets(nombre);
  const sizes = (/\bsizes="([^"]+)"/.exec(atrs) || [, '100vw'])[1];
  const base = f.anchos.includes(800) ? 800 : f.anchos[f.anchos.length - 1];
  let resto = atrs.replace(/\s*data-foto="[^"]+"/, '').replace(/\s*\bsizes="[^"]+"/, '');
  if (!/\bloading=/.test(resto) && !/fetchpriority="high"/.test(resto)) resto += ' loading="lazy"';
  if (!/\bdecoding=/.test(resto)) resto += ' decoding="async"';
  return `<picture data-foto="${nombre}">`
    + `<source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">`
    + `<source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">`
    + `<img src="img/fotos/${nombre}-${base}.jpg" srcset="${set('jpg')}" sizes="${sizes}" width="${f.ancho}" height="${f.alto}"${resto}>`
    + `</picture>`;
}
function precarga(html) {
  if (!html.includes('class="portada__capa portada__olivos"')) return html.replace('<!--precarga-portada-->', '');
  // la capa de los olivos, la de encima (el LCP), con el mismo recorte que usará cada pantalla (dirección de arte)
  const pre = (media, set) => `<link rel="preload" as="image" type="image/webp" media="${media}" imagesrcset="${set}" imagesizes="100vw" fetchpriority="high">`;
  return html.replace('<!--precarga-portada-->', [
    pre('(max-width: 699px)', 'img/portada/olivos-m560.webp 560w, img/portada/olivos-m800.webp 800w'),
    pre('(min-width: 700px) and (max-width: 1099px)', 'img/portada/olivos-t900.webp 900w, img/portada/olivos-t1280.webp 1280w'),
    pre('(min-width: 1100px)', 'img/portada/olivos-800.webp 800w, img/portada/olivos-1200.webp 1200w, img/portada/olivos-1780.webp 1780w'),
  ].join('\n'));
}
const razon = (n) => { const f = FOTOS.get(n); return (f.ancho / f.alto).toFixed(3); };

/* ---------- unidades, finca, condiciones y la tabla de la sobria ---------- */
const ico = (n) => `<svg class="ico" aria-hidden="true"><use href="#i-${n}"/></svg>`;
function unidades() {
  const fichas = D.unidades.map((u, i) => `    <article class="unidad unidad--${u.id}" id="unidad-${u.id}" aria-labelledby="t-unidad-${u.id}">
      <figure class="unidad__f"><button type="button" class="foto-btn" data-visor="${u.foto}" data-grupo="unidades" aria-label="Ver más grande: ${esc(u.fotoAlt)}"><img data-foto="${u.foto}" alt="${esc(u.fotoAlt)}" sizes="(max-width: 899px) 92vw, 54vw"></button></figure>
      <div class="unidad__cuerpo">
        <p class="unidad__tipo">${esc(u.nombre)}</p>
        <h3 class="unidad__tit" id="t-unidad-${u.id}">${esc(u.titulo)}</h3>
        <p class="unidad__txt">${esc(u.texto)}</p>
        <dl class="unidad__cifras">
${u.cifras.map((c) => `          <div${c.pendiente ? ' class="es-pendiente"' : ''}><dt>${esc(c.t)}</dt><dd class="cifra">${esc(c.v)}</dd></div>`).join('\n')}
        </dl>
        <p class="unidad__nota">${esc(u.cifrasNota)}</p>
        <ul class="unidad__serv">
${u.servicios.map((s) => `          <li>${ico(s.icono)}<b>${esc(s.nombre)}</b>${s.detalle ? `<span>${esc(s.detalle)}</span>` : ''}</li>`).join('\n')}
        </ul>
        <a class="btn btn--acento" href="#reservar" data-reservar="${u.id}">Ver fechas<span class="vh">: ${esc(u.nombre.toLowerCase())}</span></a>
      </div>
    </article>`).join('\n');
  return '    <div class="unidades">\n' + fichas + '\n    </div>';
}
function finca() {
  return `    <div class="comun">
      <section class="comun__finca" aria-labelledby="t-finca">
        <h3 class="comun__tit" id="t-finca">Para todos, la finca</h3>
        <ul class="comun__lista">
${D.finca.map((s) => `          <li>${ico(s.icono)}<b>${esc(s.nombre)}</b><span>${esc(s.detalle)}</span></li>`).join('\n')}
        </ul>
      </section>
      <section class="comun__cond" aria-labelledby="t-cond">
        <h3 class="comun__tit" id="t-cond">Incluido y condiciones</h3>
        <ul class="cond">
${D.condiciones.map((c) => `          <li>${ico(c.icono)}<span>${esc(c.texto)}</span></li>`).join('\n')}
        </ul>
        <p class="cond__precio">Los precios, la disponibilidad y las condiciones de cada reserva los da su <a href="#reservar">motor de reservas</a>.</p>
      </section>
    </div>`;
}
function vistazo() {
  const filas = [
    ['Cuántos hay', '4, iguales', '1'],
    ['Dónde', 'En la casa roja, la principal', 'Un edificio de piedra aparte'],
    ['Habitaciones', '2', '3 (una con baño propio)'],
    ['Baños', '1', '2'],
    ['Personas', 'De 4 a 6', 'Por confirmar'],
    ['Cocina', 'Abierta al salón', 'Abierta al salón y al comedor'],
    ['Lo suyo', 'La terraza y la finca, comunes', 'Chimenea y patio independiente'],
    ['Mascotas', 'No se admiten', 'No se admiten'],
  ];
  return `    <div class="vistazo" id="vistazo">
      <h3 class="vistazo__tit">De un vistazo</h3>
      <div class="vistazo__caja" role="group" aria-label="Tabla comparativa del apartamento y el chalet">
        <table class="vistazo__tabla">
          <caption class="vh">Apartamento y chalet comparados</caption>
          <thead><tr><th scope="col"><span class="vh">Dato</span></th><th scope="col">Apartamento</th><th scope="col">Chalet</th></tr></thead>
          <tbody>
${filas.map(([h, ...c]) => `            <tr><th scope="row">${h}</th>${c.map((x) => `<td>${esc(x)}</td>`).join('')}</tr>`).join('\n')}
          </tbody>
        </table>
      </div>
    </div>`;
}

/* ---------- por dentro y reseñas ---------- */
function estancias() {
  const ind = `    <nav class="estancias__indice" aria-label="Estancias">
      <ol>
${D.estancias.map((e, i) => `        <li><a href="#est-${e.id}" data-est="${e.id}"${i === 0 ? ' aria-current="true"' : ''}><span class="estancias__largo">${esc(e.nombre)}</span><span class="estancias__corto" aria-hidden="true">${esc(e.corto)}</span><span class="estancias__n cifra" aria-hidden="true">${e.fotos.length}</span></a></li>`).join('\n')}
      </ol>
    </nav>`;
  const grupos = D.estancias.map((e) => `      <section class="estancia" id="est-${e.id}" aria-labelledby="t-est-${e.id}">
        <h3 class="estancia__tit" id="t-est-${e.id}">${esc(e.nombre)}</h3>
        <p class="estancia__txt">${esc(e.texto)}</p>
        <div class="filas">
${e.fotos.map((f) => { const F = FOTOS.get(f.n); return `          <figure class="foto" style="--r:${razon(f.n)};--max:${F.ancho}px"><button type="button" class="foto-btn" data-visor="${f.n}" data-grupo="dentro" aria-label="Ver más grande: ${esc(f.alt)}"><img data-foto="${f.n}" alt="${esc(f.alt)}" sizes="(max-width: 699px) 92vw, (max-width: 1099px) 46vw, 30vw"></button></figure>`; }).join('\n')}
        </div>
      </section>`).join('\n');
  return `    <div class="estancias">\n${ind}\n      <div class="estancias__grupos">\n${grupos}\n      </div>\n    </div>`;
}
function resenas() {
  const R = D.resenas;
  const n = parseFloat(R.nota.replace(',', '.'));
  // cinco copas, como las del logo: la última, llena en la proporción de la nota
  const copas = [0, 1, 2, 3, 4].map((i) => { const p = Math.max(0, Math.min(1, n - i)); return `<span class="copa" style="--p:${(p * 100).toFixed(0)}%"></span>`; }).join('');
  return `    <div class="resenas__in">
      <p class="resenas__nota" aria-hidden="true"><span class="cifra">${R.nota}</span><span class="resenas__copas">${copas}</span></p>
      <div class="resenas__txt">
        <h2 id="t-resenas" class="sec-tit" data-aparece>La nota de quienes han estado</h2>
        <p class="resenas__dato">${R.nota} sobre ${R.sobre} con <span class="cifra">${R.recuento}</span> reseñas en su ficha de ${R.fuente}. En ${esc(R.otra.fuente)}, <span class="cifra">${R.otra.nota}</span> sobre ${R.otra.sobre} con <span class="cifra">${R.otra.recuento}</span> opiniones.</p>
        <p><a class="btn btn--oscuro" href="${esc(R.ficha)}" target="_blank" rel="noopener">Leer las reseñas en Google<span class="vh"> (se abre en otra pestaña)</span></a></p>
      </div>
    </div>`;
}

/* ---------- alrededor (ref/raw/rutas.json) ---------- */
function leerRutas() {
  const f = path.join(RAIZ, 'ref/raw/rutas.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}
const tiempoTxt = (m) => (m >= 60 ? Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' min' : m + ' min');
const kmTxt = (v) => (v < 10 ? num(Math.round(v * 10) / 10) : String(Math.round(v))) + ' km';
const RUMBOS = [['oeste', 'Hacia Galicia', 'La costa al oeste'], ['interior', 'Tierra adentro', 'El castro, Taramundi y los Oscos'], ['este', 'Hacia Luarca', 'La costa al este y el aeropuerto']];
function alrededor() {
  const R = leerRutas();
  if (!R) { console.warn('  (sin ref/raw/rutas.json: «Alrededor» va sin distancias)'); return '    <p class="alrededor__fino" data-sin-rutas>Las distancias están por confirmar.</p>'; }
  const fecha = new Date(R.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const D2 = R.destinos;
  const cerca = ['playa', 'navia'].map((id) => {
    const d = D2[id];
    const p = d && d.pie;
    const c = d && d.coche;
    return `      <li class="cerca__item" data-ruta="${id}"${d ? ` data-lat="${d.lat}" data-lon="${d.lon}"` : ''}${c ? ` data-coche="${tiempoTxt(c.minutos)} · ${kmTxt(c.km)}"` : ''}>${ico('pie')}<b class="cerca__nombre">${esc(d ? d.nombre : id)}</b>${p ? `<span class="cerca__min cifra">${p.minutos}<small> min</small></span><span class="cerca__km cifra">${kmTxt(p.km)} andando</span>` : '<span class="cerca__km">por confirmar</span>'}</li>`;
  }).join('\n');
  const cols = RUMBOS.map(([r, tit, sub]) => {
    const ids = R.orden.filter((id) => D2[id] && D2[id].rumbo === r);
    return `      <section class="rumbo rumbo--${r}" aria-labelledby="t-rumbo-${r}">
        <h3 class="rumbo__tit" id="t-rumbo-${r}">${tit}<small>${sub}</small></h3>
        <ol class="rumbo__lista">
${ids.map((id) => { const d = D2[id]; const c = d.coche; return `          <li data-ruta="${id}" data-lat="${d.lat}" data-lon="${d.lon}"${c && c.carreteras && c.carreteras.length ? ` data-carreteras="${esc([...new Set(c.carreteras)].join(' · '))}"` : ''}><b>${esc(d.nombre)}</b>${c ? `<span class="rumbo__min cifra">${tiempoTxt(c.minutos)}</span><span class="rumbo__km cifra">${kmTxt(c.km)}</span>` : '<span class="rumbo__km">por confirmar</span>'}</li>`; }).join('\n')}
        </ol>
      </section>`;
  }).join('\n');
  // la lista es el contenido y el respaldo; js/alrededor.js la vuelve el mando del mapa (data/alrededor-mapa.json)
  const conMapa = fs.existsSync(path.join(RAIZ, 'data/alrededor-mapa.json')) && fs.existsSync(path.join(RAIZ, 'js/alrededor.js'));
  return `    <div class="alr${conMapa ? '' : ' sin-modulo'}"${conMapa ? ' data-modulo="alrededor"' : ''}>
    <div class="alr__lista">
    <ul class="cerca" aria-label="A pie desde la casa">
${cerca}
    </ul>
    <div class="rumbos">
${cols}
    </div>
    </div>
    <div class="alr__mapa"></div>
    </div>
    <p class="alrededor__fino">En coche, por carretera, y a pie, por calles y caminos, desde la casa. Calculado con OSRM sobre datos de © colaboradores de OpenStreetMap el ${fecha}: tiempos sin tráfico ni paradas, orientativos. A la playa, hasta el punto de la arena más cercano.</p>`;
}
function llegar() {
  const R = leerRutas();
  if (!R) return '';
  const d = R.destinos;
  const tr = (id, txt) => (d[id] && d[id].coche ? `${txt} <span class="cifra">${tiempoTxt(d[id].coche.minutos)}</span>` : `${txt} por confirmar`);
  return `      <p class="contacto__ruta">En Navia, sobre la desembocadura de la ría. ${tr('ovd', 'El aeropuerto de Asturias queda a')} en coche${d.luarca && d.luarca.coche ? ` y Luarca a <span class="cifra">${tiempoTxt(d.luarca.coche.minutos)}</span>` : ''}.</p>`;
}
function mapa(html) {
  const q = 'Apartamentos Montemar, Camino Montemar, 33710 Navia, Asturias';
  return html.replace('<div class="mapa" id="mapa">', `<div class="mapa" id="mapa" data-q="${esc(q)}">`);
}

/* ---------- la marca: el logo del pie (por piezas) y la loma y la ola de la portada ---------- */
function logoPie() {
  const [x, y, w, h] = LOGO.viewBox.dibujo;
  const G = LOGO.grueso, C = LOGO.colores;
  const tr = LOGO.troncos.map((t, i) => `<rect class="lp-tronco lp-t${i + 1}" x="${r2(t.x)}" y="${r2(t.y0)}" width="${r2(t.ancho)}" height="${r2(t.y1 - t.y0)}" fill="${C.negro}"/>`).join('');
  const orden = [['izq', 1], ['der', 2], ['cen', 3]];
  const cp = orden.map(([n, i]) => { const c = LOGO.copas[n]; return `<g class="lp-copa lp-c${i}" style="transform-origin:${r2(c.cx)}px ${r2(c.cy + c.r)}px"><circle cx="${r2(c.cx)}" cy="${r2(c.cy)}" r="${r2(c.r - G / 2)}" fill="${C[n]}" stroke="${C.negro}" stroke-width="${r2(G)}"/></g>`; }).join('');
  return `        <svg class="pie__simbolo" viewBox="${x} ${y} ${w} ${h}" aria-hidden="true" focusable="false"><g class="lp-arboles">${tr}${cp}</g><image href="marca/suelo.svg" x="${x}" y="${y}" width="${w}" height="${h}"/></svg>`;
}
// la loma (filo y tierra) y la ola de la portada: las mismas curvas del logo, abiertas a todo el ancho
function sueloPortada() {
  return `      <svg class="portada__suelo" viewBox="0 0 1440 150" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path class="ps-filo" d="M0 70C300 24 960 8 1440 44V52C960 18 300 34 0 78Z"/>
        <path class="ps-tierra" d="M0 77C300 33 960 17 1440 51V66C960 34 300 50 0 96Z"/>
        <path class="ps-ola" d="M0 95C300 49 960 33 1440 65V80C1100 58 620 56 300 84C170 96 70 112 0 128Z"/>
        <path class="ps-fondo" d="M0 127C70 111 170 95 300 83C620 55 1100 57 1440 79V150H0Z"/>
      </svg>`;
}

/* ---------- la cota de la finca ---------- */
function cota() {
  const f = path.join(RAIZ, 'data/lugar.json');
  try { const j = JSON.parse(fs.readFileSync(f, 'utf8')); if (Number.isFinite(j.cotaFinca)) return String(Math.round(j.cotaFinca)); } catch (e) { /* sin el fichero de Lugar */ }
  return '41';
}

/* ---------- partes y ausentes ---------- */
const partes = (html, prof = 0) => html.replace(/<!--parte:([^\s>]+)\s*-->/g, (m, ruta) => {
  const f = path.join(RAIZ, ruta);
  if (!fs.existsSync(f)) { console.warn('  (falta ' + ruta + ')'); return `<!-- sin ${ruta} -->`; }
  if (prof > 3) throw new Error('Partes anidadas de más: ' + ruta);
  return partes(fs.readFileSync(f, 'utf8').trim(), prof + 1);
});
const DEL_3D = new Set(['css/lugar.css', 'js/lugar.js']);
const quitarAusentes = (html) => html
  .replace(/[ \t]*<link rel="stylesheet" href="(css\/[^"?]+)"[^>]*>\r?\n?/g, (m, r) => (DEL_3D.has(r) || fs.existsSync(path.join(RAIZ, r)) ? m : (console.warn('  (sin ' + r + ': se quita su <link>)'), '')))
  .replace(/[ \t]*<script (?:type="module" )?src="(js\/[^"?]+)"[^>]*><\/script>\r?\n?/g, (m, r) => (DEL_3D.has(r) || fs.existsSync(path.join(RAIZ, r)) ? m : (console.warn('  (sin ' + r + ': se quita su <script>)'), '')));

for (const r of DEL_3D) if (!fs.existsSync(path.join(RAIZ, r))) console.warn(`  (aún no está ${r}, del agente Lugar 3D: la etiqueta se queda y la página usa el respaldo)`);

const fuentes = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.src.html'));
for (const src of fuentes) {
  let html = quitarAusentes(partes(fs.readFileSync(path.join(RAIZ, src), 'utf8')));
  html = html.replace(/\{\{COTA\}\}/g, cota)
    .replace('<!--suelo-portada-->', sueloPortada)
    .replace('<!--logo-pie-->', logoPie)
    .replace('<!--unidades-->', unidades)
    .replace('<!--vistazo-->', vistazo)
    .replace('<!--finca-->', finca)
    .replace('<!--estancias-->', estancias)
    .replace('<!--resenas-->', resenas)
    .replace('<!--alrededor-->', alrededor)
    .replace('<!--llegar-->', llegar);
  if (html.includes('<div class="mapa" id="mapa">')) html = mapa(html);
  html = precarga(html);
  html = html.replace(/<img\b([^>]*\bdata-foto="[^"]+"[^>]*)>/g, (m, a) => picture(a.replace(/\s*\/$/, '')));
  const destino = src.replace('.src.html', '.html');
  fs.writeFileSync(path.join(RAIZ, destino), html);
  console.log(`${src} → ${destino} (${(html.length / 1024).toFixed(0)} KB)`);
}
execFileSync(process.execPath, [path.join(RAIZ, 'versionar.mjs')], { stdio: 'inherit' });
