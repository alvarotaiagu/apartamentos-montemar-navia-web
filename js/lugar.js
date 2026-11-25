/* ------------------------------------------------------------------
   Montemar · lugar.js · «La ría, ahora»
   window.Montemar.lugar.montar(el, { movimiento, densidad, webgl }) → { destruir() }

   Un vuelo en 3D que avanza con el scroll: la cámara entra desde el
   Cantábrico por la bocana de la ría de Navia (entre los dos espigones),
   pasa la playa, la laguna de arenales y el pinar, remonta la ría y sube
   a la finca, hasta quedar a la altura de la terraza de la casa roja
   mirando de vuelta al mar (la vista de su webcam).
   - Relieve MDT05/MDT25 y ortofoto PNOA del IGN (CC BY 4.0), edificios
     sobre su planta del Catastro, olivos colocados donde están en la
     ortofoto, lugares de OpenStreetMap (scripts/lugar-datos.py).
   - El sol, la luna y la luz de este momento en Navia (fórmulas de
     SunCalc, en el navegador) y la nubosidad de ahora (Open-Meteo).
   - La marea de ahora (Open-Meteo Marine, sea_level_height_msl): el agua
     sube y baja de verdad sobre los arenales de la ría (ver LUGAR.md).
   - Three.js 0.160.0, copia propia en vendor/, pedido con import() solo
     cuando hace falta.
   - Plan B en el mismo hueco (sin WebGL, movimiento reducido, «sobria»,
     ahorro de datos, móvil antes de pulsar el botón, Playwright): la ría
     desde el aire con el recorrido + la vista desde el mar dibujada.
   El HTML que trae `el` es el respaldo: se guarda y se repone al destruir.
   Parámetros: ?fps (rendimiento), ?sin-webgl (plan B), ?lugar=3d (fuerza
   el 3D aunque el navegador sea automatizado), ?hora=22:30 (otra hora del
   día, para ver la noche), ?marea=-2 (otra marea, en metros).
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  var MM = (window.Montemar = window.Montemar || {});
  if (MM.lugar && MM.lugar.montar) return;

  var SCRIPT = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  var RAIZ = SCRIPT ? new URL('../', SCRIPT).href : (typeof location !== 'undefined' ? new URL('./', location.href).href : './');
  var BASE = RAIZ + 'img/lugar/';
  var ESCENA = RAIZ + 'data/lugar-escena.json';
  var THREE_URL = RAIZ + 'vendor/three-0.160.0.module.min.js';
  var LAT = 43.548577, LON = -6.718882, TZ = 'Europe/Madrid', RAD = Math.PI / 180;
  var MAREA_URL = 'https://marine-api.open-meteo.com/v1/marine?latitude=43.5585&longitude=-6.7265&hourly=sea_level_height_msl&timezone=Europe%2FMadrid&past_days=1&forecast_days=2';
  var NUBES_URL = 'https://api.open-meteo.com/v1/forecast?latitude=43.5486&longitude=-6.7189&current=cloud_cover&timezone=Europe%2FMadrid';

  /* ============ utilidades ============ */
  var lim = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var suave = function (a, b, x) { var t = lim((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var hexA = function (c) { return [1, 3, 5].map(function (i) { return parseInt(c.slice(i, i + 2), 16); }); };
  var mezcla = function (a, b, t) { var x = hexA(a), y = hexA(b); return '#' + x.map(function (v, i) { return pad(Math.round(lim(lerp(v, y[i], t), 0, 255)).toString(16)); }).join(''); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var RUMBOS = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];
  var rumbo = function (az) { return RUMBOS[Math.round((((az % 360) + 360) % 360) / 45) % 8]; };
  var num = function (v, dec) { return v.toFixed(dec == null ? 1 : dec).replace('.', ',').replace('-', '−'); };
  var conSigno = function (v) { return (v > 0.04 ? '+' : '') + num(v); };

  /* ============ la hora (con ?hora=HH:MM para ver otra hora de hoy) ============ */
  var fmtHora = null;
  function horaNavia(f) {
    try {
      fmtHora = fmtHora || new Intl.DateTimeFormat('es-ES', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
      return fmtHora.format(f);
    } catch (e) { return pad(f.getHours()) + ':' + pad(f.getMinutes()); }
  }
  var horaForzada = null;
  function ahora() {
    var d = new Date();
    if (!horaForzada) return d;
    var hm = horaNavia(d).split(':'), act = (+hm[0]) * 60 + (+hm[1]);
    return new Date(d.getTime() + (horaForzada - act) * 60000);
  }

  /* ============ el sol y la luna (fórmulas de SunCalc, V. Agafonkin) ============ */
  var J1970 = 2440588, J2000 = 2451545, OBL = RAD * 23.4397;
  var dias = function (f) { return f.valueOf() / 864e5 - 0.5 + J1970 - J2000; };
  var ascRec = function (l, b) { return Math.atan2(Math.sin(l) * Math.cos(OBL) - Math.tan(b) * Math.sin(OBL), Math.cos(l)); };
  var declin = function (l, b) { return Math.asin(Math.sin(b) * Math.cos(OBL) + Math.cos(b) * Math.sin(OBL) * Math.sin(l)); };
  var sideral = function (d) { return RAD * (280.16 + 360.9856235 * d) - RAD * -LON; };
  function altAz(H, dec) {
    var phi = RAD * LAT;
    return {
      alt: Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)) / RAD,
      az: (Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) / RAD + 180 + 360) % 360, // desde el norte, hacia el este
    };
  }
  function solCoords(d) {
    var M = RAD * (357.5291 + 0.98560028 * d);
    var L = M + RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + RAD * 102.9372 + Math.PI;
    return { dec: declin(L, 0), ra: ascRec(L, 0) };
  }
  function lunaCoords(d) {
    var L = RAD * (218.316 + 13.176396 * d), M = RAD * (134.963 + 13.064993 * d), F = RAD * (93.272 + 13.22935 * d);
    var l = L + RAD * 6.289 * Math.sin(M), b = RAD * 5.128 * Math.sin(F);
    return { ra: ascRec(l, b), dec: declin(l, b), dist: 385001 - 20905 * Math.cos(M) };
  }
  function sol(f) { var d = dias(f), c = solCoords(d); return altAz(sideral(d) - c.ra, c.dec); }
  function luna(f) {
    var d = dias(f), m = lunaCoords(d), s = solCoords(d), p = altAz(sideral(d) - m.ra, m.dec);
    var phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
    var inc = Math.atan2(149598000 * Math.sin(phi), m.dist - 149598000 * Math.cos(phi));
    var ang = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra), Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
    return { alt: p.alt, az: p.az, luz: (1 + Math.cos(inc)) / 2, fase: 0.5 + 0.5 * inc * (ang < 0 ? -1 : 1) / Math.PI };
  }
  function nombreFase(f) {
    if (f < 0.03 || f >= 0.97) return 'nueva';
    if (f < 0.22) return 'creciente';
    if (f < 0.28) return 'en cuarto creciente';
    if (f < 0.47) return 'gibosa creciente';
    if (f < 0.53) return 'llena';
    if (f < 0.72) return 'gibosa menguante';
    if (f < 0.78) return 'en cuarto menguante';
    return 'menguante';
  }
  // la frase del cielo de ahora (igual en el 3D y en el plano)
  function fraseCielo(f, nubes) {
    var s = sol(f), l = luna(f), h = horaNavia(f), txt;
    if (s.alt > 0) txt = 'En Navia son las ' + h + ' y el sol está a ' + Math.round(s.alt) + '° sobre el horizonte, al ' + rumbo(s.az) + '.';
    else if (s.alt > -6) txt = 'En Navia son las ' + h + ': ' + (s.az < 180 ? 'está amaneciendo' : 'está anocheciendo') + '.';
    else {
      txt = 'En Navia son las ' + h + ' y es de noche';
      if (l.alt > 0 && l.luz > 0.03) txt += '; la luna, ' + nombreFase(l.fase) + ', está a ' + Math.round(l.alt) + '° al ' + rumbo(l.az);
      txt += '.';
    }
    if (nubes != null) txt += ' Cielo ' + (nubes < 0.12 ? 'despejado' : nubes > 0.88 ? 'cubierto' : Math.round(nubes * 100) + ' % cubierto') + '.';
    return txt;
  }

  /* ============ la marea (Open-Meteo Marine, nivel del mar sobre el medio, cada hora) ============ */
  function leerMarea(j) {
    var off = (j.utc_offset_seconds || 0) * 1000, t = j.hourly.time, v = j.hourly.sea_level_height_msl, pts = [];
    for (var i = 0; i < t.length; i++) {
      if (v[i] == null || !isFinite(v[i])) continue;
      var p = t[i].split(/[-T:]/);
      pts.push({ t: Date.UTC(+p[0], +p[1] - 1, +p[2], +p[3], +(p[4] || 0)) - off, v: +v[i] });
    }
    return pts;
  }
  // valor (m) y tendencia (m/h) en un instante: Catmull-Rom entre las horas
  function mareaEn(pts, ms) {
    if (!pts || pts.length < 4) return null;
    var n = pts.length, k = 0;
    if (ms < pts[1].t || ms > pts[n - 2].t) return null;
    while (k < n - 2 && pts[k + 1].t <= ms) k++;
    var p0 = pts[Math.max(0, k - 1)].v, p1 = pts[k].v, p2 = pts[k + 1].v, p3 = pts[Math.min(n - 1, k + 2)].v;
    var h = (pts[k + 1].t - pts[k].t) / 3600000, t = (ms - pts[k].t) / (pts[k + 1].t - pts[k].t);
    var a = -0.5 * p0 + 1.5 * p1 - 1.5 * p2 + 0.5 * p3, b = p0 - 2.5 * p1 + 2 * p2 - 0.5 * p3, c = -0.5 * p0 + 0.5 * p2;
    return { v: ((a * t + b) * t + c) * t + p1, dv: ((3 * a * t + 2 * b) * t + c) / h };
  }
  // pleamares y bajamares (máximos y mínimos, afinados con una parábola por tres horas)
  function extremos(pts) {
    var out = [];
    for (var i = 1; i < pts.length - 1; i++) {
      var a = pts[i - 1].v, b = pts[i].v, c = pts[i + 1].v, alto = b >= a && b > c, bajo = b <= a && b < c;
      if (!alto && !bajo) continue;
      var den = a - 2 * b + c, o = den ? lim(0.5 * (a - c) / den, -0.5, 0.5) : 0;
      out.push({ t: pts[i].t + o * (pts[i + 1].t - pts[i].t), v: b - 0.25 * (a - c) * o, alta: alto });
    }
    return out;
  }
  var ARENAL = [0.5, 1.5];
  function fraseMarea(m, f) {
    if (!m) return null;
    var ms = f.valueOf(), e = mareaEn(m.pts, ms);
    if (!e) return null;
    var sube = e.dv > 0.03, baja = e.dv < -0.03;
    var prox = m.ext.filter(function (x) { return x.t > ms; }).slice(0, 2);
    var arenales = e.v < ARENAL[0] ? 'los arenales de la ría están al descubierto' :
      e.v > ARENAL[1] ? 'el agua cubre los arenales de la ría' :
        (sube ? 'el agua está entrando en los arenales' : baja ? 'el agua se está retirando de los arenales' : 'el agua está a ras de los arenales');
    return {
      v: e.v, dv: e.dv, sube: sube, baja: baja, arenales: arenales,
      prox: prox.map(function (x) { return { alta: x.alta, hora: horaNavia(new Date(x.t)), v: x.v }; }),
      texto: 'Marea de ahora: ' + conSigno(e.v) + ' m sobre el nivel medio' + (sube ? ', subiendo' : baja ? ', bajando' : '') + '; ' + arenales + '.' +
        prox.map(function (x) { return ' ' + (x.alta ? 'Pleamar' : 'Bajamar') + ' a las ' + horaNavia(new Date(x.t)) + ' (' + conSigno(x.v) + ' m).'; }).join(''),
    };
  }
  // la curva de la marea: de 6 h antes a 18 h después, con el ahora y la línea de los arenales
  function curvaMarea(m, f) {
    var ms = f.valueOf(), t0 = ms - 6 * 3600000, t1 = ms + 18 * 3600000, W = 240, H = 64, v0 = -2.6, v1 = 2.4;
    var X = function (t) { return ((t - t0) / (t1 - t0) * W).toFixed(1); }, Y = function (v) { return ((v1 - v) / (v1 - v0) * H).toFixed(1); };
    var d = '';
    for (var t = t0; t <= t1; t += 900000) { var e = mareaEn(m.pts, t); if (e) d += (d ? 'L' : 'M') + X(t) + ' ' + Y(e.v); }
    var e0 = mareaEn(m.pts, ms), marcas = m.ext.filter(function (x) { return x.t > t0 && x.t < t1; }).map(function (x) {
      return '<text x="' + X(x.t) + '" y="' + (x.alta ? +Y(x.v) - 5 : +Y(x.v) + 12) + '" text-anchor="middle">' + horaNavia(new Date(x.t)) + '</text>';
    }).join('');
    return '<svg class="lugar__curva" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="La marea de 6 horas antes a 18 horas después de ahora">' +
      '<line class="lugar__curva-arenal" x1="0" x2="' + W + '" y1="' + Y(1) + '" y2="' + Y(1) + '"/>' +
      '<text class="lugar__curva-nota" x="' + (W - 2) + '" y="' + (+Y(1) - 3) + '" text-anchor="end">arenales</text>' +
      '<path d="' + d + '"/>' + marcas +
      (e0 ? '<line class="lugar__curva-ahora" x1="' + X(ms) + '" x2="' + X(ms) + '" y1="0" y2="' + H + '"/><circle cx="' + X(ms) + '" cy="' + Y(e0.v) + '" r="3.2"/>' : '') +
      '</svg>';
  }

  /* ============ el color del cielo según la altura del sol ============ */
  var CIELO = [            // [altura del sol, cenit, horizonte]
    [-18, '#04070f', '#0c1222'],
    [-10, '#081028', '#1e2644'],
    [-4, '#1a2752', '#7a5562'],
    [0, '#34508c', '#e08a64'],
    [6, '#5279b8', '#efbf96'],
    [18, '#6893cc', '#d9e2e9'],
    [45, '#4c82c4', '#cddcea'],
  ];
  function cieloPara(alt) {
    if (alt <= CIELO[0][0]) return { cz: CIELO[0][1], ch: CIELO[0][2] };
    for (var i = 1; i < CIELO.length; i++) {
      if (alt <= CIELO[i][0]) {
        var a = CIELO[i - 1], b = CIELO[i], t = (alt - a[0]) / (b[0] - a[0]);
        return { cz: mezcla(a[1], b[1], t), ch: mezcla(a[2], b[2], t) };
      }
    }
    var u = CIELO[CIELO.length - 1];
    return { cz: u[1], ch: u[2] };
  }

  /* ============ el recorrido: interpolación monótona por componente ============ */
  // Hermite con tangentes de Fritsch-Butland: no se pasa de largo aunque los tramos sean de
  // kilómetros al principio y de metros al final. Empieza y acaba en reposo.
  function monotona(ps, vs) {
    var n = ps.length, d = [], m = [], i;
    for (i = 0; i < n - 1; i++) d[i] = (vs[i + 1] - vs[i]) / (ps[i + 1] - ps[i]);
    m[0] = 0; m[n - 1] = 0;
    for (i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) { m[i] = 0; continue; }
      var h0 = ps[i] - ps[i - 1], h1 = ps[i + 1] - ps[i];
      m[i] = 3 * (h0 + h1) / ((2 * h1 + h0) / d[i - 1] + (h1 + 2 * h0) / d[i]);
    }
    return function (p) {
      if (p <= ps[0]) return vs[0];
      if (p >= ps[n - 1]) return vs[n - 1];
      var k = 0; while (k < n - 2 && p > ps[k + 1]) k++;
      var h = ps[k + 1] - ps[k], t = (p - ps[k]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * vs[k] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * vs[k + 1] + (t3 - t2) * h * m[k + 1];
    };
  }
  function camino(rec) {
    var ps = rec.map(function (r) { return r.p; });
    var f = [0, 1, 2].map(function (k) { return monotona(ps, rec.map(function (r) { return r.pos[k]; })); });
    var g = [0, 1, 2].map(function (k) { return monotona(ps, rec.map(function (r) { return r.mira[k]; })); });
    return function (p) { return { pos: [f[0](p), f[1](p), f[2](p)], mira: [g[0](p), g[1](p), g[2](p)] }; };
  }

  /* ============ alturas: PNG RGB → metros ============ */
  function cargarAlturas(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error('alturas ' + r.status); return r.blob(); })
      .then(function (b) {
        var op = { colorSpaceConversion: 'none', premultiplyAlpha: 'none' };
        return (window.createImageBitmap ? createImageBitmap(b, op).catch(function () { return createImageBitmap(b); }) : Promise.reject(new Error('sin createImageBitmap')));
      })
      .then(function (bmp) {
        var c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
        var g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0);
        var d = g.getImageData(0, 0, c.width, c.height).data, n = c.width * c.height, out = new Float32Array(n);
        for (var i = 0; i < n; i++) out[i] = (d[i * 4] * 256 + d[i * 4 + 1]) / 10 - 100;
        if (bmp.close) bmp.close();
        return { w: c.width, h: c.height, data: out };
      });
  }
  function muestreador(r) {
    var sx = (r.w - 1) / (r.x1 - r.x0), sz = (r.h - 1) / (r.z1 - r.z0), w = r.w, h = r.h, a = r.data;
    return function (x, z) {
      var fx = lim((x - r.x0) * sx, 0, w - 1.0001), fz = lim((z - r.z0) * sz, 0, h - 1.0001);
      var i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * w + i;
      return (a[k] * (1 - u) + a[k + 1] * u) * (1 - v) + (a[k + w] * (1 - u) + a[k + w + 1] * u) * v;
    };
  }
  function pesoCaja(r, x, z, b) {            // 0..1 de «dentro de la caja», con un borde de b metros
    var d = Math.min(x - r.x0, r.x1 - x, z - r.z0, r.z1 - z);
    return lim(d / b, 0, 1);
  }

  /* ============ texturas dibujadas (ligeras) ============ */
  function azar(semilla) { var s = semilla >>> 0 || 1; return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
  function lienzo(lado, pintar, alto) { var c = document.createElement('canvas'); c.width = lado; c.height = alto || lado; pintar(c.getContext('2d'), lado, alto || lado); return c; }
  function ruidoPlano(g, L, r, k) {
    var im = g.getImageData(0, 0, L, L), d = im.data;
    for (var i = 0; i < d.length; i += 4) { var n = (r() - 0.5) * k; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(im, 0, 0);
  }
  function texLajas(base, semilla, alto) {   // pizarra o piedra en lajas: hiladas de piezas alargadas con junta clara
    return lienzo(512, function (g, L) {
      var r = azar(semilla);
      g.fillStyle = mezcla(base, '#d8d4cc', 0.35); g.fillRect(0, 0, L, L);
      var y = 0;
      while (y < L) {
        var hh = (alto || 22) * (0.7 + r() * 0.6), x = -r() * 50;
        while (x < L) {
          var ww = 40 + r() * 70;
          g.fillStyle = mezcla(mezcla(base, r() < 0.5 ? '#2c3038' : '#8a8f96', r() * 0.35), r() < 0.3 ? '#6b5a48' : base, r() * 0.25);
          g.fillRect(x + 1.5, y + 1.5, ww - 3, hh - 3);
          x += ww;
        }
        y += hh;
      }
      ruidoPlano(g, L, r, 16);
    });
  }
  function texRevoco(base, semilla) {
    return lienzo(256, function (g, L) {
      var r = azar(semilla); g.fillStyle = base; g.fillRect(0, 0, L, L);
      ruidoPlano(g, L, r, 12);
      for (var k = 0; k < 40; k++) { g.fillStyle = 'rgba(0,0,0,' + (r() * 0.04).toFixed(3) + ')'; g.fillRect(r() * L, r() * L, 10 + r() * 40, 2 + r() * 30); }
    });
  }
  function texTejado(base, semilla) {        // pizarra de cubierta: hileras escalonadas de placas
    return lienzo(256, function (g, L) {
      var r = azar(semilla), filas = 12, cols = 9, fh = L / filas, cw = L / cols;
      g.fillStyle = mezcla(base, '#000000', 0.45); g.fillRect(0, 0, L, L);
      for (var j = 0; j < filas; j++) {
        for (var i = -1; i < cols; i++) {
          var x = i * cw + (j % 2) * cw / 2, y = j * fh;
          g.fillStyle = mezcla(mezcla(base, r() < 0.5 ? '#25282d' : '#666b72', r() * 0.4), '#3a4048', r() * 0.2);
          g.fillRect(x + 1, y + 1, cw - 2, fh - 1);
          g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x + 1, y + fh - 2, cw - 2, 2);
        }
      }
    });
  }
  function texToldo() {                      // lona de rayas grises y blancas (el toldo de la terraza)
    return lienzo(128, function (g, L) {
      for (var i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f2f1ec' : '#6d7075'; g.fillRect(i * L / 8, 0, L / 8, L); }
    });
  }

  /* ============ módulo ============ */
  function montar(el, opciones) {
    opciones = opciones || {};
    var q = new URLSearchParams(location.search);
    if (q.has('hora')) { var hq = String(q.get('hora')).split(':'); if (hq.length === 2 && isFinite(hq[0]) && isFinite(hq[1])) horaForzada = lim(+hq[0], 0, 23) * 60 + lim(+hq[1], 0, 59); }
    var mareaForzada = q.has('marea') && isFinite(parseFloat(q.get('marea'))) ? lim(parseFloat(q.get('marea')), -2.5, 2.3) : null;
    var reduce = opciones.movimiento === false || matchMedia('(prefers-reduced-motion: reduce)').matches;
    var sobria = opciones.densidad === 'sobria';
    var movil = matchMedia('(max-width: 820px)').matches || matchMedia('(pointer: coarse)').matches;
    var ahorro = !!(navigator.connection && navigator.connection.saveData);
    var forzar3d = q.get('lugar') === '3d';                                       // solo para pruebas
    var automatizado = !!navigator.webdriver && !forzar3d;                         // Playwright: nunca pinta el 3D
    var sinWebgl = opciones.webgl === false || q.has('sin-webgl') || automatizado;
    if (!sinWebgl && !sobria && !reduce && !forzar3d) {
      try { var cv0 = document.createElement('canvas'); sinWebgl = !(cv0.getContext('webgl2') || cv0.getContext('webgl')); } catch (e) { sinWebgl = true; }
    }
    var puede3d = !sinWebgl && !sobria && !reduce;
    var auto3d = puede3d && !movil && !ahorro;
    var respaldo = el.innerHTML;
    var estado = { modo: 'plano', destruido: false, error3d: null, cargado: false, p: 0, pVis: 0, calidad: 0, nubes: null, marea: null };
    var escuchas = [];
    var escucha = function (o, ev, fn, op) { o.addEventListener(ev, fn, op); escuchas.push(function () { o.removeEventListener(ev, fn, op); }); };
    var t3 = null, meta = null, cargando = null, intervalo = 0;

    /* ---------- DOM ---------- */
    el.classList.add('lugar-mod');
    el.innerHTML =
      '<div class="lugar__pista">' +
        '<div class="lugar__escenario" role="img" aria-label="Vuelo en 3D desde el mar Cantábrico por la bocana de la ría de Navia hasta la terraza de Montemar, con el relieve real, la luz de este momento y la marea de ahora">' +
          '<img class="lugar__poster" alt="" decoding="async" src="' + BASE + 'vista-mar-1600.webp" srcset="' + BASE + 'vista-mar-960.webp 960w, ' + BASE + 'vista-mar-1600.webp 1600w" sizes="100vw">' +
          '<div class="lugar__rotulos" aria-hidden="true"></div>' +
          '<div class="lugar__hud"><p class="lugar__ahora" data-l="ahora3d"></p><div class="lugar__marea" data-l="marea3d" hidden></div></div>' +
          '<ol class="lugar__paradas"></ol>' +
          '<div class="lugar__pie3d"><p class="lugar__creditos">Relieve y foto: IGN · Edificios: Catastro · Marea y nubes: Open-Meteo</p>' +
          '<button type="button" class="lugar__btn lugar__btn--suave" data-l="aplano">Ver en plano</button></div>' +
          '<p class="lugar__aviso" data-l="aviso" role="status" hidden></p>' +
        '</div>' +
      '</div>' +
      '<div class="lugar__planob">' +
        '<figure class="lugar__mapa">' +
          '<div class="lugar__marco lugar__marco--mapa"><img alt="La desembocadura de la ría de Navia desde el aire: la bocana entre los dos espigones, la playa, la laguna de arenales, el pinar y la finca de Montemar en la loma" decoding="async" loading="lazy" src="' + BASE + 'plano-ria-640.webp" srcset="' + BASE + 'plano-ria-640.webp 640w, ' + BASE + 'plano-ria-1000.webp 1000w" sizes="(max-width: 820px) 100vw, 44vw">' +
          '<svg class="lugar__ruta" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points=""/></svg>' +
          '<ul class="lugar__marcas" aria-hidden="true"></ul></div>' +
          '<figcaption>El recorrido del 3D sobre la ortofoto del IGN: del mar por la bocana, ría arriba y a la finca.</figcaption>' +
        '</figure>' +
        '<figure class="lugar__vista">' +
          '<div class="lugar__marco"><img alt="La costa de Navia vista desde el mar: la bocana de la ría, la playa y, en la loma, Montemar" decoding="async" loading="lazy" src="' + BASE + 'vista-mar-960.webp" srcset="' + BASE + 'vista-mar-960.webp 960w, ' + BASE + 'vista-mar-1600.webp 1600w" sizes="(max-width: 820px) 100vw, 50vw">' +
          '<i class="lugar__noche" aria-hidden="true"></i><ul class="lugar__marcas lugar__marcas--vista" aria-hidden="true"></ul></div>' +
          '<figcaption>Desde el mar, dibujado con el relieve y la ortofoto del IGN.</figcaption>' +
        '</figure>' +
        '<div class="lugar__panel"><p class="lugar__ahora" data-l="ahora2d"></p><div class="lugar__marea" data-l="marea2d" hidden></div></div>' +
        '<ol class="lugar__pasos"></ol>' +
        '<p class="lugar__acciones"><button type="button" class="lugar__btn" data-l="a3d" hidden>Ver la ría en 3D</button></p>' +
      '</div>' +
      '<p class="lugar__fuente" data-l="fuente">Relieve MDT05 y MDT25 y ortofoto PNOA © Instituto Geográfico Nacional (CC BY 4.0) · Planta de los edificios © Dirección General del Catastro · Lugares © colaboradores de OpenStreetMap · Marea y nubosidad: Open-Meteo (CC BY 4.0). A escala real, sin exagerar el relieve. El sol y la luna se calculan en tu navegador para Navia. La línea del agua sobre los arenales es aproximada: el IGN los mide al metro.</p>';
    var $ = function (k) { return el.querySelector('[data-l="' + k + '"]'); };
    var pista = el.querySelector('.lugar__pista'), escenario = el.querySelector('.lugar__escenario');
    var capaRot = el.querySelector('.lugar__rotulos');
    var aviso = $('aviso');
    var avisar = function (t) { aviso.textContent = t || ''; aviso.hidden = !t; };

    /* ---------- paradas (las mismas en el 3D y en el plano) ---------- */
    var PARADAS = [
      { desde: 0, t: 'Desde el mar', d: 'El Cantábrico delante; en la costa se abre la bocana de la ría, entre dos espigones.' },
      { desde: 0.24, t: 'La bocana', d: 'Por aquí entra la marea y sale el río Navia.' },
      { desde: 0.4, t: 'La playa y el pinar', d: 'A la izquierda, la playa de Navia, la laguna de arenales y el pinar.' },
      { desde: 0.58, t: 'Ría arriba', d: 'La ría sube hacia la villa; en lo alto de la loma, la finca.' },
      { desde: 0.86, t: 'La terraza', d: 'Montemar: la casa roja, el chalet de piedra y los olivos. Desde arriba, la misma vista de su webcam.' },
    ];
    var htmlParadas = PARADAS.map(function (p, i) { return '<li data-i="' + i + '"><b>' + esc(p.t) + '</b><span>' + esc(p.d) + '</span></li>'; }).join('');
    el.querySelector('.lugar__paradas').innerHTML = htmlParadas;
    el.querySelector('.lugar__pasos').innerHTML = htmlParadas;
    var lisParadas = el.querySelectorAll('.lugar__paradas li');
    var paradaActual = -1;
    function marcarParada(p) {
      var i = 0; for (var k = 0; k < PARADAS.length; k++) if (p >= PARADAS[k].desde - 0.001) i = k;
      if (i === paradaActual) return;
      paradaActual = i;
      lisParadas.forEach(function (li, k) { li.classList.toggle('es-actual', k === i); li.classList.toggle('es-pasada', k < i); });
    }

    /* ---------- el cielo y la marea de ahora, en texto ---------- */
    function nivelAhora(f) {
      if (mareaForzada != null) return mareaForzada;
      var e = estado.marea && mareaEn(estado.marea.pts, f.valueOf());
      return e ? e.v : null;
    }
    function pintarMarea(f) {
      var fr = estado.marea ? fraseMarea(estado.marea, f) : null;
      ['marea2d', 'marea3d'].forEach(function (k) {
        var n = $(k);
        if (!fr) { n.hidden = true; return; }
        n.hidden = false;
        var prox = fr.prox.map(function (x) { return '<span>' + (x.alta ? 'Pleamar' : 'Bajamar') + ' <b>' + x.hora + '</b> · ' + conSigno(x.v) + ' m</span>'; }).join('');
        n.innerHTML = '<p class="lugar__marea-cifra"><b>' + conSigno(fr.v) + ' m</b><span>' + (fr.sube ? 'subiendo' : fr.baja ? 'bajando' : 'parada') + '</span></p>' +
          '<p class="lugar__marea-texto">Marea de ahora: ' + esc(fr.arenales) + '.</p>' +
          (k === 'marea2d' ? curvaMarea(estado.marea, f) : '') + '<p class="lugar__marea-prox">' + prox + '</p>';
      });
    }
    function cieloTexto() {
      var f = ahora(), txt = fraseCielo(f, estado.nubes), s = sol(f);
      $('ahora2d').textContent = txt;
      $('ahora3d').innerHTML = '<b>' + horaNavia(f) + ' en Navia · ' + (s.alt > -6 ? 'el sol de ahora' : 'el cielo de ahora') + '</b><span> ' + esc(txt) + '</span>';
      el.style.setProperty('--lugar-noche', String(lim((-s.alt - 1) / 10, 0, 1).toFixed(2)));
      pintarMarea(f);
      if (t3) { t3.luces(f); t3.nivel(nivelAhora(f)); }
    }
    // datos en vivo: si fallan, la escena sigue igual (agua al nivel medio, sin nubes) y no se dice nada falso
    var pedirJSON = function (u) { return fetch(u, { credentials: 'omit', referrerPolicy: 'no-referrer' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); };
    function pedirEnVivo() {
      pedirJSON(MAREA_URL).then(function (j) {
        var pts = leerMarea(j); if (pts.length < 6) throw new Error('marea sin datos');
        estado.marea = { pts: pts, ext: extremos(pts) };
        if (!estado.destruido) cieloTexto();
      }).catch(function (e) { console.warn('Lugar: sin dato de marea', e); });
      pedirJSON(NUBES_URL).then(function (j) {
        var c = j && j.current && j.current.cloud_cover;
        if (c != null && isFinite(c)) { estado.nubes = lim(c / 100, 0, 1); if (!estado.destruido) cieloTexto(); }
      }).catch(function (e) { console.warn('Lugar: sin dato de nubes', e); });
    }

    /* ---------- plan B: el recorrido y las marcas sobre las dos imágenes ---------- */
    function montarPlano(m) {
      var nombres = {}; m.lugares.forEach(function (l) { nombres[l.clave] = l; });
      var mp = m.planB.mapa;
      el.querySelector('.lugar__marco--mapa').style.aspectRatio = mp.ancho + ' / ' + mp.alto;
      el.querySelector('.lugar__ruta polyline').setAttribute('points', mp.ruta.map(function (p) { return p[0] + ',' + p[1]; }).join(' '));
      el.querySelector('.lugar__marco--mapa .lugar__marcas').innerHTML = mp.marcas.map(function (k) {
        var l = nombres[k.clave]; if (!l) return '';
        var der = k.pos[0] > 62;
        return '<li class="lugar__marca' + (k.clave === 'finca' ? ' lugar__marca--casa' : '') + (der ? ' a-la-izq' : '') + '" style="left:' + k.pos[0] + '%;top:' + k.pos[1] + '%"><span>' + esc(l.nombre) + (l.sub && k.clave !== 'bocana' ? ' <small>' + esc(l.sub) + '</small>' : '') + '</span></li>';
      }).join('');
      var ulV = el.querySelector('.lugar__marcas--vista');
      ulV.innerHTML = m.planB.vista.marcas.map(function (k) {
        var l = nombres[k.clave]; if (!l) return '';
        return '<li class="lugar__marca' + (k.clave === 'finca' ? ' lugar__marca--casa' : '') + '" data-x="' + k.x + '" data-y="' + k.y + '"><span>' + esc(l.nombre) + '</span></li>';
      }).join('');
      colocarMarcas();
    }
    // la vista del mar se recorta con object-fit: cover; las marcas siguen al recorte y se ocultan si quedan fuera
    function colocarMarcas() {
      var marco = el.querySelector('.lugar__vista .lugar__marco'); if (!marco || !meta) return;
      var W = marco.clientWidth, H = marco.clientHeight; if (!W || !H) return;
      var iw = meta.planB.vista.ancho, ih = meta.planB.vista.alto, k = Math.max(W / iw, H / ih);
      var ox = (W - iw * k) / 2, oy = (H - ih * k) * 0.7;
      el.querySelectorAll('.lugar__marcas--vista .lugar__marca').forEach(function (li) {
        var x = ox + (+li.dataset.x) / 100 * iw * k, y = oy + (+li.dataset.y) / 100 * ih * k;
        li.hidden = x < 12 || x > W - 12 || y < 8 || y > H - 8;
        li.style.left = x.toFixed(1) + 'px'; li.style.top = y.toFixed(1) + 'px';
        li.classList.toggle('a-la-izq', x > W * 0.66);
      });
    }

    function ponModo(m) {
      estado.modo = m;
      el.dataset.modo = m;
      $('a3d').hidden = !(puede3d && m === 'plano' && !estado.error3d);
      if (t3) t3.activo(m === '3d');
    }

    /* ---------- datos ---------- */
    var pMeta = fetch(ESCENA).then(function (r) { if (!r.ok) throw new Error('lugar-escena.json ' + r.status); return r.json(); })
      .then(function (m) { meta = m; if (m.marea && m.marea.arenal_cota) ARENAL = m.marea.arenal_cota; if (!estado.destruido) montarPlano(m); return m; });
    pMeta.catch(function (e) { console.warn('Lugar: sin datos', e); });

    /* ---------- el 3D ---------- */
    function cargar3d() {
      if (t3) return Promise.resolve(t3);
      if (cargando) return cargando;
      avisar('Cargando el relieve de la ría…');
      var hiDef = !movil && !ahorro;
      cargando = pMeta.then(function (m) {
        return Promise.all([
          import(THREE_URL),
          cargarAlturas(BASE + m.rasters.cerca.archivo), cargarAlturas(BASE + m.rasters.ria.archivo),
          cargarAlturas(BASE + m.rasters.finca.archivo), cargarAlturas(BASE + m.rasters.lejos.archivo),
        ]).then(function (r) {
          if (estado.destruido) return null;
          var R = {};
          ['cerca', 'ria', 'finca', 'lejos'].forEach(function (k, i) { var b = r[i + 1], o = m.rasters[k]; R[k] = Object.assign({}, o, { w: b.w, h: b.h, data: b.data }); });
          return crear3d(r[0], m, R, hiDef);
        });
      }).then(function (t) { avisar(''); return t; }, function (e) {
        estado.error3d = String((e && e.message) || e);
        console.warn('Lugar: el 3D no está disponible:', e);
        avisar(''); cargando = null; ponModo('plano');
        return null;
      });
      return cargando;
    }

    function crear3d(THREE, m, R, hiDef) {
      var cv = document.createElement('canvas');
      cv.className = 'lugar__lienzo'; cv.setAttribute('aria-hidden', 'true');
      escenario.insertBefore(cv, capaRot);
      var ren = new THREE.WebGLRenderer({ canvas: cv, antialias: hiDef, powerPreference: 'high-performance', alpha: false, stencil: false });
      var topeDPR = function () { return estado.calidad >= 1 ? 1 : (movil ? 1.25 : 1.5); };
      ren.setPixelRatio(Math.min(devicePixelRatio || 1, topeDPR()));
      ren.outputColorSpace = THREE.SRGBColorSpace;
      ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFSoftShadowMap; ren.shadowMap.autoUpdate = false;
      var anis = Math.min(8, ren.capabilities.getMaxAnisotropy());
      var esc3 = new THREE.Scene();
      var cam = new THREE.PerspectiveCamera(40, 1.6, 1, 160000);
      var disponer = [];
      var guarda = function (o) { disponer.push(o); return o; };
      var i, j, k;

      /* --- alturas combinadas: finca 3 m, ría 5 m, cerca 15 m, lejos ~180 m (a escala real) --- */
      var hC = muestreador(R.cerca), hR = muestreador(R.ria), hF = muestreador(R.finca), hL = muestreador(R.lejos);
      function altura(x, z) {                  // metros; el agua, negativo
        var wc = pesoCaja(R.cerca, x, z, 1);
        if (wc <= 0) return hL(x, z);
        var h = hC(x, z);
        var wr = pesoCaja(R.ria, x, z, 60); if (wr > 0) h = lerp(h, hR(x, z), wr);
        var wf = pesoCaja(R.finca, x, z, 40); if (wf > 0) h = lerp(h, hF(x, z), wf);
        return h;
      }
      var yDe = altura;

      /* --- el suelo: ortofoto cercana + la de la ría + la de la finca, fundidas en el sombreado --- */
      var ldr = new THREE.TextureLoader(), pendientes = 0, tListo = performance.now() + 6000;
      var cargaTex = function (url, alListo) {
        pendientes++;
        return ldr.load(url, function (t) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = anis; t.needsUpdate = true; if (alListo) alListo(t); pendientes--; pedir(true); },
          undefined, function () { pendientes--; console.warn('Lugar: no carga', url); pedir(true); });
      };
      var O = m.orto, calidadTex = hiDef ? 'alta' : 'baja';
      var uSuelo = {
        mapRia: { value: null }, riaCaja: { value: new THREE.Vector4(O.ria.x0, O.ria.z0, O.ria.x1, O.ria.z1) }, riaListo: { value: 0 },
        mapFinca: { value: null }, fincaCaja: { value: new THREE.Vector4(O.finca.x0, O.finca.z0, O.finca.x1, O.finca.z1) }, fincaListo: { value: 0 },
      };
      var matCerca = guarda(new THREE.MeshLambertMaterial({ color: '#6b7660' }));
      matCerca.onBeforeCompile = function (sh) {
        Object.assign(sh.uniforms, uSuelo);
        sh.vertexShader = 'varying vec2 vXZ;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vXZ = position.xz;');
        sh.fragmentShader = 'varying vec2 vXZ;\nuniform sampler2D mapRia;\nuniform vec4 riaCaja;\nuniform float riaListo;\nuniform sampler2D mapFinca;\nuniform vec4 fincaCaja;\nuniform float fincaListo;\n' +
          sh.fragmentShader.replace('#include <map_fragment>', [
            '#ifdef USE_MAP',
            '  vec4 texel = texture2D(map, vMapUv);',
            '  vec2 ru = (vXZ - riaCaja.xy) / (riaCaja.zw - riaCaja.xy);',
            '  if (riaListo > 0.5 && ru.x > 0.0 && ru.x < 1.0 && ru.y > 0.0 && ru.y < 1.0) {',
            '    vec4 tr = texture2D(mapRia, vec2(ru.x, 1.0 - ru.y));',
            '    texel = mix(texel, tr, smoothstep(0.0, 0.05, min(min(ru.x, 1.0 - ru.x), min(ru.y, 1.0 - ru.y))));',
            '  }',
            '  vec2 fu = (vXZ - fincaCaja.xy) / (fincaCaja.zw - fincaCaja.xy);',
            '  if (fincaListo > 0.5 && fu.x > 0.0 && fu.x < 1.0 && fu.y > 0.0 && fu.y < 1.0) {',
            '    vec4 tf = texture2D(mapFinca, vec2(fu.x, 1.0 - fu.y));',
            '    texel = mix(texel, tf, smoothstep(0.0, 0.1, min(min(fu.x, 1.0 - fu.x), min(fu.y, 1.0 - fu.y))));',
            '  }',
            '  diffuseColor *= texel;',
            '#endif'].join('\n'));
      };
      cargaTex(BASE + O.cerca.archivos[calidadTex], function (t) { matCerca.map = t; matCerca.color.set('#ffffff'); matCerca.needsUpdate = true; });
      cargaTex(BASE + O.ria.archivos[calidadTex], function (t) { uSuelo.mapRia.value = t; uSuelo.riaListo.value = 1; });
      cargaTex(BASE + O.finca.archivos[calidadTex], function (t) { uSuelo.mapFinca.value = t; uSuelo.fincaListo.value = 1; });
      var matLejos = guarda(new THREE.MeshLambertMaterial({ color: '#5c6658', polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 }));
      cargaTex(BASE + O.lejos.archivos.alta, function (t) { matLejos.map = t; matLejos.color.set('#ffffff'); matLejos.needsUpdate = true; });

      /* --- relieve cercano: rejilla densa en la finca y en la ría, más abierta lejos --- */
      var F_ = hiDef ? 1 : 1.7;
      function ejes(a0, a1, zonas) {             // zonas: [desde, hasta, paso]; el paso crece un 6 % por metro fuera de cada zona
        var pasoEn = function (v) {
          var s = 60;
          zonas.forEach(function (zn) { var d = v < zn[0] ? zn[0] - v : v > zn[1] ? v - zn[1] : 0; s = Math.min(s, zn[2] * F_ + 0.06 * d); });
          return s;
        };
        var out = [a0], v = a0;
        while (v < a1 - 0.01) { v = Math.min(a1, v + pasoEn(v + pasoEn(v) / 2)); out.push(v); }
        return out;
      }
      var C = R.cerca;
      var CAS = m.casa;
      var xs = ejes(C.x0, C.x1, [[CAS.cx - 150, CAS.cx + 150, 3], [-740, 160, 6]]);
      var zs = ejes(C.z0, C.z1, [[CAS.cz - 150, CAS.cz + 160, 3], [-1060, 230, 6]]);
      function rejilla(xs, zs, yFn, uvCaja, hueco, faldon) {
        var nx = xs.length, nz = zs.length, n = nx * nz;
        var nF = faldon ? 2 * (nx + nz) : 0;
        var pos = new Float32Array((n + nF) * 3), uv = new Float32Array((n + nF) * 2);
        var kk = 0, ii, jj;
        for (jj = 0; jj < nz; jj++) for (ii = 0; ii < nx; ii++, kk++) {
          var x = xs[ii], z = zs[jj];
          pos[kk * 3] = x; pos[kk * 3 + 1] = yFn(x, z, ii, jj); pos[kk * 3 + 2] = z;
          uv[kk * 2] = (x - uvCaja.x0) / (uvCaja.x1 - uvCaja.x0); uv[kk * 2 + 1] = 1 - (z - uvCaja.z0) / (uvCaja.z1 - uvCaja.z0);
        }
        var idx = [];
        for (jj = 0; jj < nz - 1; jj++) for (ii = 0; ii < nx - 1; ii++) {
          if (hueco && ii >= hueco[0] && ii < hueco[2] && jj >= hueco[1] && jj < hueco[3]) continue;
          var a = jj * nx + ii, b = a + 1, c = a + nx, d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
        if (faldon) {                                     // el borde baja como una pared: tapa las rendijas entre mallas
          var borde = [], f0 = n;
          for (ii = 0; ii < nx; ii++) borde.push(ii);
          for (jj = 1; jj < nz; jj++) borde.push(jj * nx + nx - 1);
          for (ii = nx - 2; ii >= 0; ii--) borde.push((nz - 1) * nx + ii);
          for (jj = nz - 2; jj > 0; jj--) borde.push(jj * nx);
          borde.forEach(function (v, qq) {
            var w = f0 + qq;
            pos[w * 3] = pos[v * 3]; pos[w * 3 + 1] = Math.min(pos[v * 3 + 1], 0) - faldon; pos[w * 3 + 2] = pos[v * 3 + 2];
            uv[w * 2] = uv[v * 2]; uv[w * 2 + 1] = uv[v * 2 + 1];
          });
          for (var q2 = 0; q2 < borde.length; q2++) {
            var v0 = borde[q2], v1 = borde[(q2 + 1) % borde.length], w0 = f0 + q2, w1 = f0 + (q2 + 1) % borde.length;
            idx.push(v0, w0, v1, v1, w0, w1, v0, v1, w0, v1, w1, w0);     // por las dos caras
          }
        }
        var g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        g.setIndex(n + nF > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
        g.computeVertexNormals();
        return guarda(g);
      }
      var cerca = new THREE.Mesh(rejilla(xs, zs, function (x, z) { return yDe(x, z); }, O.cerca, null, 120), matCerca);
      cerca.receiveShadow = true;
      esc3.add(cerca);

      var L = R.lejos, xsL = [], zsL = [];
      for (i = 0; i < L.w; i++) xsL.push(L.x0 + i * (L.x1 - L.x0) / (L.w - 1));
      for (j = 0; j < L.h; j++) zsL.push(L.z0 + j * (L.z1 - L.z0) / (L.h - 1));
      var lejos = new THREE.Mesh(rejilla(xsL, zsL, function (x, z, ii, jj) { return L.data[jj * L.w + ii]; }, O.lejos, L.hueco, 400), matLejos);
      esc3.add(lejos);

      /* --- el agua: un plano a la altura de la marea de ahora --- */
      // agua.png: R distancia a tierra en el mar (3 m por unidad) · G 1 dentro de la ría (agua tranquila) ·
      // B cota del arenal (0,3..1,7 m; 0 = no es arenal): donde el agua cubre poco el arenal, se transparenta
      var aguaTex = cargaTex(BASE + O.agua.archivo, function (t) { t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true; });
      aguaTex.colorSpace = THREE.NoColorSpace;
      var uAgua = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        tiempo: { value: 0 }, aguaMapa: { value: null }, aguaCaja: { value: new THREE.Vector4(C.x0, C.z0, C.x1, C.z1) }, nivel: { value: 0 },
        dirSol: { value: new THREE.Vector3(0, 1, 0) }, colSol: { value: new THREE.Color('#ffffff') }, brilloSol: { value: 1 },
        dirLuna: { value: new THREE.Vector3(0, 1, 0) }, brilloLuna: { value: 0 },
        cZ: { value: new THREE.Color('#5a82bf') }, cH: { value: new THREE.Color('#d9e2e9') },
        profundo: { value: new THREE.Color('#123a4f') }, somero: { value: new THREE.Color('#2f7d86') }, ria: { value: new THREE.Color('#2c5a5c') },
        arena: { value: new THREE.Color('#8a7c62') }, luzAgua: { value: 1 },
        olas: { value: reduce ? 0 : 1 }, cajaLejos: { value: new THREE.Vector4(R.lejos.x0, R.lejos.z0, R.lejos.x1, R.lejos.z1) },
      }]);
      uAgua.aguaMapa.value = aguaTex;
      var matAgua = guarda(new THREE.ShaderMaterial({
        uniforms: uAgua, fog: true, toneMapped: false, transparent: true,
        vertexShader: [
          'varying vec3 vW;', '#include <fog_pars_vertex>',
          'void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;', '#include <fog_vertex>', '}'].join('\n'),
        fragmentShader: [
          'uniform float tiempo; uniform sampler2D aguaMapa; uniform vec4 aguaCaja; uniform float nivel; uniform vec3 dirSol; uniform vec3 colSol; uniform float brilloSol;',
          'uniform vec3 dirLuna; uniform float brilloLuna; uniform vec3 cZ; uniform vec3 cH; uniform vec3 profundo; uniform vec3 somero; uniform vec3 ria; uniform vec3 arena;',
          'uniform float luzAgua; uniform float olas; uniform vec4 cajaLejos;',
          'varying vec3 vW;', '#include <fog_pars_fragment>',
          'float ruido(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);',
          '  float a = fract(sin(dot(i, vec2(127.1,311.7)))*43758.5), b = fract(sin(dot(i+vec2(1,0), vec2(127.1,311.7)))*43758.5);',
          '  float c = fract(sin(dot(i+vec2(0,1), vec2(127.1,311.7)))*43758.5), d = fract(sin(dot(i+vec2(1,1), vec2(127.1,311.7)))*43758.5);',
          '  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }',
          'void main(){',
          '  if ((vW.x < cajaLejos.x || vW.x > cajaLejos.z || vW.z > cajaLejos.w) && vW.z > -3000.0) discard;',
          '  vec2 p = vW.xz; float t = tiempo * olas;',
          '  vec3 V = normalize(cameraPosition - vW); float dist = length(cameraPosition - vW);',
          '  vec2 cu = (p - aguaCaja.xy) / (aguaCaja.zw - aguaCaja.xy);',
          '  float dc = 800.0; float enRia = 0.0; float cota = -9.0;',
          '  if (cu.x > 0.0 && cu.x < 1.0 && cu.y > 0.0 && cu.y < 1.0) { vec4 c = texture2D(aguaMapa, vec2(cu.x, 1.0 - cu.y)); dc = c.r * 765.0; enRia = c.g;',
          '    if (c.b > 0.5 / 255.0) cota = 0.3 + (c.b * 255.0 - 1.0) / 254.0 * 1.4; }',
          '  float mar = 1.0 - enRia;',
          '  float fade = 1.0 - smoothstep(500.0, 9000.0, dist);',
          '  vec2 g = vec2(0.0);',
          '  g += vec2(0.35, 0.94) * cos(dot(p, vec2(0.35, 0.94)) * 0.055 - t * 0.9) * 0.55 * mar;',
          '  g += vec2(-0.6, 0.8) * cos(dot(p, vec2(-0.6, 0.8)) * 0.11 - t * 1.3) * (0.35 * mar + 0.08);',
          '  g += vec2(0.9, 0.42) * cos(dot(p, vec2(0.9, 0.42)) * 0.23 - t * 1.9) * (0.22 * mar + 0.1);',
          '  float e = 0.6; vec2 q = p * 0.09 + vec2(t * 0.15, t * 0.08);',
          '  g += vec2(ruido(q + vec2(e, 0.0)) - ruido(q - vec2(e, 0.0)), ruido(q + vec2(0.0, e)) - ruido(q - vec2(0.0, e))) * (0.9 * mar + 0.35);',
          '  vec3 N = normalize(vec3(-g.x * 0.11 * fade, 1.0, -g.y * 0.11 * fade));',
          '  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);',
          '  vec3 Rf = reflect(-V, N); Rf.y = abs(Rf.y);',
          '  vec3 cielo = mix(cH, cZ, smoothstep(0.0, 0.45, Rf.y));',
          '  vec3 cuerpo = mix(mix(somero, profundo, smoothstep(10.0, 260.0, dc)), ria, enRia) * luzAgua;',
          '  float alfa = 1.0;',
          '  if (cota > -1.0) { float hondo = nivel - cota; cuerpo = mix(arena * luzAgua, cuerpo, smoothstep(0.0, 0.6, hondo)); alfa = smoothstep(0.0, 0.25, hondo) * 0.9 + 0.1 * smoothstep(0.25, 0.8, hondo); }',
          '  vec3 col = mix(cuerpo, cielo, fres * 0.85);',
          '  col += colSol * brilloSol * (pow(max(dot(Rf, dirSol), 0.0), 380.0) * 6.0 + pow(max(dot(Rf, dirSol), 0.0), 30.0) * 0.18);',
          '  col += vec3(0.75, 0.82, 1.0) * brilloLuna * pow(max(dot(Rf, dirLuna), 0.0), 120.0) * 2.5;',
          '  float banda = 0.5 + 0.5 * sin(dc * 0.35 - t * 1.6 + ruido(p * 0.05) * 6.0);',
          '  float esp = (1.0 - smoothstep(4.0, 34.0, dc)) * (0.55 + 0.45 * banda) + (1.0 - smoothstep(0.0, 8.0, dc)) * 0.6;',
          '  esp *= (0.55 + 0.45 * ruido(p * 0.35 + t * 0.3)) * mar;',
          '  col = mix(col, vec3(0.92, 0.94, 0.93) * max(luzAgua, 0.08), clamp(esp, 0.0, 1.0));',
          '  gl_FragColor = vec4(col, alfa);',
          '  #include <fog_fragment>',
          '  #include <colorspace_fragment>',
          '}'].join('\n'),
      }));
      var agua = new THREE.Mesh(guarda(new THREE.PlaneGeometry(300000, 300000).rotateX(-Math.PI / 2)), matAgua);
      agua.renderOrder = 1;
      esc3.add(agua);
      function ponNivel(v) {
        var y = v == null ? 0 : lim(v, -2.5, 2.3);
        agua.position.y = y; uAgua.nivel.value = y; pedir(true);
      }

      /* --- cielo: cúpula con degradado, brillo hacia el sol y las nubes de ahora --- */
      var uCielo = { cZ: { value: new THREE.Color() }, cH: { value: new THREE.Color() }, dirSol: { value: new THREE.Vector3(0, 1, 0) }, brillo: { value: 0 },
        cLuz: { value: new THREE.Color('#ffb070') }, nubes: { value: 0 }, noche: { value: 0 } };
      var cielo = new THREE.Mesh(guarda(new THREE.SphereGeometry(120000, 40, 20)), guarda(new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, toneMapped: false, fog: false, uniforms: uCielo,
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: ['uniform vec3 cZ; uniform vec3 cH; uniform vec3 dirSol; uniform float brillo; uniform vec3 cLuz; uniform float nubes; uniform float noche; varying vec3 vP;',
          'float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
          'float rd(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hs(i), hs(i+vec2(1,0)), f.x), mix(hs(i+vec2(0,1)), hs(i+vec2(1,1)), f.x), f.y); }',
          'float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int k = 0; k < 5; k++) { s += a * rd(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }',
          'void main(){ vec3 d = normalize(vP); float h = d.y; vec3 c = mix(cH, cZ, smoothstep(0.0, 0.55, h)); if (h < 0.0) c = cH;',
          ' float s = max(dot(d, dirSol), 0.0); float vel = 1.0 - smoothstep(0.0, 0.45, abs(h));',
          ' c += cLuz * brillo * (pow(s, 6.0) * 0.5 + pow(s, 60.0) * 0.45) * vel;',
          ' if (h > 0.0 && nubes > 0.02) {',
          '   vec2 uv = d.xz / (h + 0.1) * 1.3;',
          '   float n = fbm(uv), um = 0.78 - nubes * 0.6;',
          '   float cob = smoothstep(um - 0.06, um + 0.14, n) * smoothstep(0.0, 0.1, h);',
          '   vec3 cn = mix(cH, vec3(1.0), 0.55) * (1.0 - noche * 0.9) * (0.82 + 0.18 * smoothstep(um, um + 0.3, n));',
          '   cn += cLuz * brillo * pow(s, 3.0) * 0.4;',
          '   c = mix(c, cn, cob * 0.92);',
          ' }',
          ' gl_FragColor = vec4(c, 1.0);', ' #include <colorspace_fragment>', '}'].join('\n'),
      })));
      cielo.renderOrder = -10; cielo.frustumCulled = false;
      esc3.add(cielo);
      esc3.fog = new THREE.FogExp2('#d9e2e9', 1 / 26000);

      // estrellas
      var rnd = azar(23), nE = hiDef ? 900 : 500, ePos = new Float32Array(nE * 3);
      for (i = 0; i < nE; i++) {
        var a0 = rnd() * Math.PI * 2, hh = Math.asin(0.03 + rnd() * 0.96);
        ePos[i * 3] = Math.cos(hh) * Math.sin(a0) * 100000; ePos[i * 3 + 1] = Math.sin(hh) * 100000; ePos[i * 3 + 2] = -Math.cos(hh) * Math.cos(a0) * 100000;
      }
      var eGeo = guarda(new THREE.BufferGeometry()); eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
      var estrellas = new THREE.Points(eGeo, guarda(new THREE.PointsMaterial({ color: '#f3eee4', size: movil ? 1.4 : 1.7, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })));
      estrellas.frustumCulled = false; esc3.add(estrellas);
      // sol y luna como discos en su dirección real
      var texDe = function (lado, f) { var c = lienzo(lado, f), t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return guarda(t); };
      var solS = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: texDe(128, function (g, l) { var r = g.createRadialGradient(l / 2, l / 2, 0, l / 2, l / 2, l / 2); r.addColorStop(0, 'rgba(255,246,222,1)'); r.addColorStop(0.14, 'rgba(255,232,180,1)'); r.addColorStop(0.32, 'rgba(255,205,140,.35)'); r.addColorStop(1, 'rgba(255,205,140,0)'); g.fillStyle = r; g.fillRect(0, 0, l, l); }), fog: false, depthWrite: false, transparent: true, toneMapped: false })));
      solS.scale.set(9000, 9000, 1); esc3.add(solS);
      var lunaCv = document.createElement('canvas'); lunaCv.width = lunaCv.height = 128;
      var lunaTex = guarda(new THREE.CanvasTexture(lunaCv)); lunaTex.colorSpace = THREE.SRGBColorSpace;
      var lunaS = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: lunaTex, fog: false, depthWrite: false, transparent: true, toneMapped: false })));
      lunaS.scale.set(3600, 3600, 1); esc3.add(lunaS);
      function pintarLuna(fase) {
        var g = lunaCv.getContext('2d'), Ld = 128, r = Ld * 0.36, c = Ld / 2;
        g.clearRect(0, 0, Ld, Ld); g.save(); g.translate(c, c);
        g.fillStyle = 'rgba(40,50,70,.5)'; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
        var crec = fase < 0.5, p = crec ? fase : 1 - fase; if (!crec) g.scale(-1, 1);
        var kk = Math.cos(2 * Math.PI * p);
        g.shadowColor = 'rgba(242,236,227,.55)'; g.shadowBlur = Ld * 0.1; g.fillStyle = '#f1ebdc';
        g.beginPath(); g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
        g.ellipse(0, 0, Math.max(0.01, Math.abs(kk)) * r, r, 0, Math.PI / 2, kk >= 0 ? -Math.PI / 2 : 3 * Math.PI / 2, kk >= 0);
        g.fill(); g.restore(); lunaTex.needsUpdate = true;
      }

      /* --- luces --- */
      var FINCA = new THREE.Vector3(CAS.cx, CAS.suelo, CAS.cz + 18);
      var luzSol = new THREE.DirectionalLight('#ffffff', 2.6);
      luzSol.castShadow = true;
      var SM = hiDef ? 2048 : 1024;
      luzSol.shadow.mapSize.set(SM, SM);
      Object.assign(luzSol.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 1, far: 1800 });
      luzSol.shadow.camera.updateProjectionMatrix();
      luzSol.shadow.bias = -0.0004; luzSol.shadow.normalBias = 0.05;
      luzSol.target.position.copy(FINCA);
      var luzLuna = new THREE.DirectionalLight('#a8bce0', 0);
      luzLuna.target.position.copy(FINCA);
      var hemi = new THREE.HemisphereLight('#dfe8f0', '#5d5444', 1.5);
      var luzPorche = new THREE.PointLight('#ffc27a', 0, 30, 2);       // siempre está: si no, cambiaría el programa al anochecer
      esc3.add(luzSol, luzSol.target, luzLuna, luzLuna.target, hemi, luzPorche);

      /* --- materiales de los edificios --- */
      var texRep = function (c) { var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = anis; return guarda(t); };
      var lam = function (o) { return guarda(new THREE.MeshLambertMaterial(o)); };
      var MAT = {
        rojo: lam({ map: texRep(texRevoco('#c04a3a', 12)) }),
        pizarraMuro: lam({ map: texRep(texLajas('#545a63', 15, 20)) }),
        piedra: lam({ map: texRep(texLajas('#8a7a66', 16, 16)) }),
        blanca: lam({ map: texRep(texRevoco('#ebe6db', 14)) }),
        tejado: lam({ map: texRep(texTejado('#4a4e55', 5)) }),
        blanco: lam({ color: '#f3f1ec' }),
        gris: lam({ color: '#8d9096' }),
        losa: lam({ color: '#b3b0a8' }),
        cristal: lam({ color: '#262b33' }),
        madera: lam({ color: '#6b4a33' }),
        roca: lam({ map: texRep(texLajas('#77736b', 31, 34)) }),
        toldo: lam({ map: texRep(texToldo()), side: THREE.DoubleSide }),
      };
      var MAT2 = {};                             // copias por las dos caras (muros extruidos)
      var dosCaras = function (k) { if (!MAT2[k]) { MAT2[k] = guarda(MAT[k].clone()); MAT2[k].side = THREE.DoubleSide; } return MAT2[k]; };
      // caja con la textura a escala real (tesela de 2,4 m), por cara
      function cajaGeo(w, h, d, tesela) {
        var g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, T = tesela || 2.4;
        var dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
        for (var f = 0; f < 6; f++) for (var v = 0; v < 4; v++) { var ix = f * 4 + v; uv.setXY(ix, uv.getX(ix) * dims[f][0] / T, uv.getY(ix) * dims[f][1] / T); }
        return guarda(g);
      }
      function caja(grupo, w, h, d, mat, x, y, z, ry, sombra) {
        var me = new THREE.Mesh(cajaGeo(w, h, d), mat);
        me.position.set(x, y, z); if (ry) me.rotation.y = ry;
        me.castShadow = sombra !== false; me.receiveShadow = true; grupo.add(me); return me;
      }
      var finca = new THREE.Group(); esc3.add(finca);
      var ventanas = [];                         // {x, y, z, ang, luz, w, h}: cristales (de noche, algunos encendidos)
      var balaustres = [];                       // matrices de los barrotes blancos de las barandillas
      var mtx = new THREE.Matrix4(), qt = new THREE.Quaternion(), eje = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(1, 1, 1), ps = new THREE.Vector3();

      /* --- la casa roja (Catastro 33041A01600277, 3 plantas): planta de pizarra, dos plantas rojas con recercados
             blancos, porche de columnas a dos alturas al norte, escalera exterior al este, cubierta de pizarra a dos
             aguas con frontón. Medidas de altura y huecos a ojo, sacadas de las fotos (ver LUGAR.md). --- */
      var casa = new THREE.Group();
      (function () {
        var Lc = CAS.largo, Fc = CAS.fondo, D = 2.9, h0 = 2.8, hp = 2.9, alero = h0 + 2 * hp, ex = 0.55, pend = Math.tan(30 * RAD);
        var cumbre = alero + (Fc / 2 + ex) * pend;
        casa.position.set(CAS.cx, CAS.suelo, CAS.cz); casa.rotation.y = -CAS.ang;
        var bajo = Math.min(-1.2, Math.min(CAS.suelo, yDe(CAS.cx, CAS.cz)) - CAS.suelo - 0.6) - Math.max(0, CAS.suelo_max - CAS.suelo);
        // planta de pizarra (con la terraza del este, que es de la misma fábrica)
        var hb = h0 - bajo;
        caja(casa, Lc, hb, Fc + 2.6, MAT.pizarraMuro, 0, bajo + hb / 2, 1.3);
        caja(casa, Lc + 0.12, 0.16, Fc + 2.72, MAT.gris, 0, h0 - 0.06, 1.3);             // la cornisa de la terraza
        // cuerpo rojo (las dos plantas), retranqueado en el porche
        var Lr = Lc - D;
        caja(casa, Lr, 2 * hp, Fc, MAT.rojo, -D / 2, h0 + hp, 0);
        // losa del porche alto y techo del porche
        caja(casa, D, 0.24, Fc, MAT.gris, Lc / 2 - D / 2, h0 + hp, 0);
        caja(casa, D + ex, 0.14, Fc + 2 * ex, MAT.blanco, Lc / 2 - D / 2 + ex / 2, alero - 0.07, 0, 0, false);
        // columnas blancas (dos alturas) en el frente del porche
        var colG = guarda(new THREE.CylinderGeometry(0.19, 0.22, 1, 16));
        [-Fc / 2 + 0.35, 0, Fc / 2 - 0.35].forEach(function (v) {
          [[h0, h0 + hp - 0.12], [h0 + hp + 0.12, alero - 0.14]].forEach(function (tr) {
            var c = new THREE.Mesh(colG, MAT.blanco); c.scale.y = tr[1] - tr[0]; c.position.set(Lc / 2 - 0.35, (tr[0] + tr[1]) / 2, v);
            c.castShadow = true; casa.add(c);
            caja(casa, 0.5, 0.1, 0.5, MAT.blanco, Lc / 2 - 0.35, tr[0] + 0.05, v);
          });
        });
        // cubierta de pizarra a dos aguas (cumbrera a lo largo, del porche al fondo) con su alero
        (function () {
          var u0 = -Lc / 2 - 0.45, u1 = Lc / 2 + 0.5, vH = Fc / 2 + ex, pos = [], uv = [];
          var lg = Math.hypot(vH, cumbre - alero);
          [[-1], [1]].forEach(function (s) {
            var sv = s[0], A = [u0, alero, sv * vH], B = [u1, alero, sv * vH], Cc = [u1, cumbre, 0], Dd = [u0, cumbre, 0];
            var tris = sv > 0 ? [A, B, Cc, A, Cc, Dd] : [A, Cc, B, A, Dd, Cc];
            var uvs = sv > 0 ? [[0, 0], [(u1 - u0) / 1.6, 0], [(u1 - u0) / 1.6, lg / 1.6], [0, 0], [(u1 - u0) / 1.6, lg / 1.6], [0, lg / 1.6]]
              : [[0, 0], [(u1 - u0) / 1.6, lg / 1.6], [(u1 - u0) / 1.6, 0], [0, 0], [0, lg / 1.6], [(u1 - u0) / 1.6, lg / 1.6]];
            tris.forEach(function (p, n) { pos.push(p[0], p[1], p[2]); uv.push(uvs[n][0], uvs[n][1]); });
          });
          var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
          g.computeVertexNormals();
          var t = new THREE.Mesh(guarda(g), MAT.tejado); t.castShadow = true; t.receiveShadow = true; casa.add(t);
          // el grueso del alero y las tablas blancas (aleros y frontón)
          var rak = Math.hypot(vH, cumbre - alero), angR = Math.atan2(cumbre - alero, vH);
          [-1, 1].forEach(function (sv) {
            caja(casa, u1 - u0, 0.26, 0.1, MAT.blanco, (u0 + u1) / 2, alero - 0.1, sv * (vH + 0.02), 0, false);
            [u0 - 0.02, u1 + 0.02].forEach(function (uu) {
              var b = caja(casa, 0.1, 0.3, rak, MAT.blanco, uu, (alero + cumbre) / 2 - 0.1, sv * vH / 2, 0, false);
              b.rotation.x = sv * angR;
            });
          });
        })();
        // los hastiales: el frontón del porche (rojo, con su triángulo blanco) y el del fondo
        (function () {
          var vW = Fc / 2 + ex, g = new THREE.BufferGeometry(), yC = cumbre - 0.02;
          var pos = [], uv = [];
          [[Lc / 2 - 0.02, 1], [-Lc / 2 + 0.02, -1]].forEach(function (d) {
            var u = d[0], s = d[1];
            var P = s > 0 ? [[u, alero, vW], [u, alero, -vW], [u, yC, 0]] : [[u, alero, -vW], [u, alero, vW], [u, yC, 0]];
            P.forEach(function (p) { pos.push(p[0], p[1], p[2]); uv.push((p[2] + vW) / 2.4, p[1] / 2.4); });
          });
          g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
          var me = new THREE.Mesh(guarda(g), MAT.rojo); me.castShadow = true; me.receiveShadow = true; casa.add(me);
          // el triángulo blanco del frontón (rejilla de ventilación)
          var tri = new THREE.Shape(); tri.moveTo(-0.8, 0); tri.lineTo(0.8, 0); tri.lineTo(0, 0.85); tri.lineTo(-0.8, 0);
          var tg = guarda(new THREE.ShapeGeometry(tri));
          var tb = new THREE.Mesh(tg, MAT.blanco); tb.position.set(Lc / 2 + 0.01, yC - 1.55, 0); tb.rotation.y = Math.PI / 2; casa.add(tb);
          var tn = new THREE.Mesh(tg, MAT.cristal); tn.scale.set(0.72, 0.72, 1); tn.position.set(Lc / 2 + 0.02, yC - 1.47, 0); tn.rotation.y = Math.PI / 2; casa.add(tn);
        })();
        // chimeneas forradas de pizarra con su corona blanca (tres, como en la foto)
        [[-Lc / 2 + 2.3, -2.4], [-0.9, 1.7], [1.9, -1.9]].forEach(function (c) {
          var yr = alero + (Fc / 2 + ex - Math.abs(c[1])) * pend, top = cumbre + 1.1;
          caja(casa, 0.8, top - yr + 0.6, 0.8, MAT.pizarraMuro, c[0], (yr - 0.6 + top) / 2, c[1]);
          caja(casa, 1.0, 0.14, 1.0, MAT.blanco, c[0], top + 0.07, c[1]);
          [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]].forEach(function (o) { caja(casa, 0.14, 0.32, 0.14, MAT.blanco, c[0] + o[0], top + 0.3, c[1] + o[1], 0, false); });
        });
        // huecos: recercado blanco + cristal (o puerta blanca); n = normal hacia fuera en coordenadas de la casa
        function hueco(u, y, v, nU, nV, w, h, puerta) {
          var ang = Math.atan2(nU, nV);       // giro local para que el frente mire a (nU, nV)
          var g = new THREE.Group(); g.position.set(u + nU * 0.04, y, v + nV * 0.04); g.rotation.y = ang;
          var m1 = new THREE.Mesh(cajaGeo(w + 0.32, h + 0.32, 0.1), MAT.blanco); g.add(m1);
          var m2 = new THREE.Mesh(cajaGeo(w, h, 0.1), puerta ? MAT.blanco : MAT.cristal); m2.position.z = 0.04; g.add(m2);
          if (!puerta) {
            var mv = new THREE.Mesh(cajaGeo(0.07, h, 0.06), MAT.blanco); mv.position.z = 0.1; g.add(mv);
            var mh = new THREE.Mesh(cajaGeo(w, 0.07, 0.06), MAT.blanco); mh.position.set(0, h * 0.18, 0.1); g.add(mh);
          } else {
            var pc = new THREE.Mesh(cajaGeo(w * 0.62, h * 0.4, 0.06), MAT.cristal); pc.position.set(0, h * 0.2, 0.08); g.add(pc);
          }
          casa.add(g);
          ventanas.push({ casa: true, u: u + nU * 0.16, y: y, v: v + nV * 0.16, ang: ang, w: puerta ? w * 0.55 : w * 0.92, h: puerta ? h * 0.38 : h * 0.92, dy: puerta ? h * 0.2 : 0, luz: true });
        }
        var yv = [h0 + 1.55, h0 + hp + 1.55];
        [-1, 1].forEach(function (sv) {          // fachadas largas: tres ventanas por planta
          for (var n = 0; n < 3; n++) yv.forEach(function (y) { hueco(-Lc / 2 + Lr * (n + 0.5) / 3, y, sv * Fc / 2, 0, sv, 1.25, 1.3, false); });
        });
        yv.forEach(function (y) { [-2.6, 2.6].forEach(function (v) { hueco(-Lc / 2, y, v, -1, 0, 1.2, 1.3, false); }); });       // fondo
        yv.forEach(function (y, n) {             // el frente del porche: dos puertas y dos ventanas por planta
          [-1.6, 1.6].forEach(function (v) { hueco(Lc / 2 - D, y - 0.45, v, 1, 0, 0.95, 2.15, true); });
          [-4.4, 4.4].forEach(function (v) { hueco(Lc / 2 - D, y, v, 1, 0, 1.1, 1.25, false); });
        });
        // la planta de pizarra: puertas blancas y una ventana bajo el porche y en la terraza del este, apoyadas en el
        // suelo del MDT junto a ese muro (si el terreno sube y no caben, no se ponen: mejor nada que media puerta enterrada)
        var ca_ = Math.cos(CAS.ang), sa_ = Math.sin(CAS.ang);
        var sueloEn = function (u, v) { return yDe(CAS.cx + u * ca_ - v * sa_, CAS.cz + u * sa_ + v * ca_) - CAS.suelo; };
        function huecoBajo(u, v, nU, nV, puerta) {
          var hh = puerta ? 2.1 : 1.0, base = Math.max(0.05, sueloEn(u + nU * 0.8, v + nV * 0.8) + 0.05) + (puerta ? 0 : 0.8);
          if (base + hh > h0 - 0.25) return;
          hueco(u, base + hh / 2, v, nU, nV, puerta ? 1.0 : 0.9, hh, puerta);
        }
        [[-2.8, true], [0.6, false], [3.6, true]].forEach(function (d) { huecoBajo(Lc / 2, d[0], 1, 0, d[1]); });
        huecoBajo(-1.5, Fc / 2 + 2.6, 0, 1, true); huecoBajo(2.4, Fc / 2 + 2.6, 0, 1, false);
        // barandillas blancas: barra arriba, barra abajo y barrotes (instanciados)
        function baranda(a, b, y0, alto) {     // de a a b ([u, v]), con el suelo en y0 (o [y0a, y0b] si sube)
          var ya = Array.isArray(y0) ? y0[0] : y0, yb = Array.isArray(y0) ? y0[1] : y0;
          var du = b[0] - a[0], dv = b[1] - a[1], l = Math.hypot(du, dv), lg = Math.hypot(l, yb - ya), angY = Math.atan2(-dv, du), angZ = Math.atan2(yb - ya, l);
          [alto, 0.12].forEach(function (hh) {
            var bar = new THREE.Mesh(cajaGeo(lg, hh === alto ? 0.07 : 0.05, 0.06), MAT.blanco);
            bar.position.set((a[0] + b[0]) / 2, (ya + yb) / 2 + hh, (a[1] + b[1]) / 2); bar.rotation.set(0, angY, angZ, 'YXZ');
            casa.add(bar);
          });
          var nB = Math.max(2, Math.round(l / 0.13));
          for (var s = 0; s <= nB; s++) {
            var t = s / nB, u = a[0] + du * t, v = a[1] + dv * t, y = ya + (yb - ya) * t;
            ps.set(u, y + 0.12 + (alto - 0.12) / 2, v); qt.identity(); sc.set(1, alto - 0.12, 1); mtx.compose(ps, qt, sc); balaustres.push(mtx.clone());
          }
        }
        var uF = Lc / 2 - 0.08, vF = Fc / 2 - 0.05;
        [h0, h0 + hp + 0.12].forEach(function (y) {
          baranda([uF, -vF], [uF, vF], y, 1.0);
          baranda([Lc / 2 - D, -vF], [uF, -vF], y, 1.0);
        });
        baranda([Lc / 2 - D, vF], [uF, vF], h0 + hp + 0.12, 1.0);
        baranda([-Lc / 2 + 0.05, Fc / 2 + 2.52], [Lc / 2 - 0.05, Fc / 2 + 2.52], h0, 1.0);          // borde de la terraza del este
        baranda([Lc / 2 - 0.05, Fc / 2 + 0.2], [Lc / 2 - 0.05, Fc / 2 + 2.52], h0, 1.0);
        // la escalera exterior: sube pegada a la fachada este, hacia el porche alto
        (function () {
          var huella = 0.26, n = 16, sube = hp / n, uFin = Lc / 2 - D + 0.1, uIni = uFin - n * huella, vE = Fc / 2 + 0.65;
          for (var s = 0; s < n; s++) caja(casa, huella + 0.02, 0.07, 1.1, MAT.losa, uIni + (s + 0.5) * huella, h0 + (s + 1) * sube - 0.035, vE);
          var zanca = caja(casa, Math.hypot(n * huella, hp), 0.22, 1.1, MAT.losa, (uIni + uFin) / 2, h0 + hp / 2 - 0.2, vE);
          zanca.rotation.z = Math.atan2(hp, n * huella);
          caja(casa, 1.2, 0.22, 1.15, MAT.losa, uFin + 0.6, h0 + hp, vE);                         // rellano al porche
          baranda([uIni, vE + 0.58], [uFin, vE + 0.58], [h0, h0 + hp], 0.95);
        })();
        // el toldo de rayas en el extremo sur de la terraza del este
        (function () {
          var g = new THREE.PlaneGeometry(3.6, 2.5); guarda(g);
          var t = new THREE.Mesh(g, MAT.toldo); t.position.set(-Lc / 2 + 2.3, h0 + 2.25, Fc / 2 + 1.25); t.rotation.set(-Math.PI / 2 + 0.16, 0, 0, 'YXZ');
          t.castShadow = true; casa.add(t);
          [-Lc / 2 + 0.6, -Lc / 2 + 4.0].forEach(function (u) { caja(casa, 0.05, 2.0, 0.05, MAT.gris, u, h0 + 1.0, Fc / 2 + 2.45, 0, false); });
        })();
        luzPorche.position.set(CAS.cx, CAS.suelo + h0 + hp + 2.2, CAS.cz);
        var cs = Math.cos(CAS.ang), sn = Math.sin(CAS.ang), up = Lc / 2 - 1.2;
        luzPorche.position.x += up * cs; luzPorche.position.z += up * sn;
      })();
      finca.add(casa);

      /* --- el chalet de piedra y las casas vecinas, sobre su planta del Catastro --- */
      var geoMuros = {};
      function añadeMuro(clave, a, b, y0, y1, u0) {
        var g = geoMuros[clave] || (geoMuros[clave] = { p: [], uv: [] });
        var dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), u1 = u0 + l / 2.4;
        g.p.push(a[0], y0, a[1], b[0], y0, b[1], b[0], y1, b[1], a[0], y0, a[1], b[0], y1, b[1], a[0], y1, a[1]);
        g.uv.push(u0, y0 / 2.4, u1, y0 / 2.4, u1, y1 / 2.4, u0, y0 / 2.4, u1, y1 / 2.4, u0, y1 / 2.4);
      }
      function dentro(pt, anillo) {
        var c = false;
        for (var a = 0, b = anillo.length - 1; a < anillo.length; b = a++) {
          var A = anillo[a], B = anillo[b];
          if ((A[1] > pt[1]) !== (B[1] > pt[1]) && pt[0] < (B[0] - A[0]) * (pt[1] - A[1]) / (B[1] - A[1]) + A[0]) c = !c;
        }
        return c;
      }
      function tejado(rc, y0, tipo, alero, matGab, matCanto) {
        var c = Math.cos(rc.ang), s = Math.sin(rc.ang);
        var Lh = rc.largo / 2 + alero, Fh = rc.fondo / 2 + alero, pend = Math.tan(28 * RAD), sube = (rc.fondo / 2 + alero) * pend;
        var P = function (u, v, y) { return [rc.cx + u * c - v * s, y, rc.cz + u * s + v * c]; };
        var tris = [], uvs = [];
        var cara = function (pts, uvsC) {                 // se invierte cada triángulo: la cara buena mira al cielo
          for (var t = 0; t < pts.length; t += 3) {
            [pts[t], pts[t + 2], pts[t + 1]].forEach(function (v) { tris.push(v[0], v[1], v[2]); });
            [uvsC[t], uvsC[t + 2], uvsC[t + 1]].forEach(function (v) { uvs.push(v[0], v[1]); });
          }
        };
        var Y0 = y0, Y1 = y0 + sube, lg = Math.hypot(Fh, sube);
        if (tipo === '4') {
          var cr = Math.max(0, Lh - Fh);
          cara([P(-Lh, -Fh, Y0), P(Lh, -Fh, Y0), P(cr, 0, Y1), P(-Lh, -Fh, Y0), P(cr, 0, Y1), P(-cr, 0, Y1)], [[0, 0], [2 * Lh / 1.6, 0], [(Lh + cr) / 1.6, lg / 1.6], [0, 0], [(Lh + cr) / 1.6, lg / 1.6], [(Lh - cr) / 1.6, lg / 1.6]]);
          cara([P(Lh, Fh, Y0), P(-Lh, Fh, Y0), P(-cr, 0, Y1), P(Lh, Fh, Y0), P(-cr, 0, Y1), P(cr, 0, Y1)], [[0, 0], [2 * Lh / 1.6, 0], [(Lh + cr) / 1.6, lg / 1.6], [0, 0], [(Lh + cr) / 1.6, lg / 1.6], [(Lh - cr) / 1.6, lg / 1.6]]);
          var lgL = Math.hypot(Lh - cr, sube);
          cara([P(Lh, -Fh, Y0), P(Lh, Fh, Y0), P(cr, 0, Y1)], [[0, 0], [2 * Fh / 1.6, 0], [Fh / 1.6, lgL / 1.6]]);
          cara([P(-Lh, Fh, Y0), P(-Lh, -Fh, Y0), P(-cr, 0, Y1)], [[0, 0], [2 * Fh / 1.6, 0], [Fh / 1.6, lgL / 1.6]]);
        } else {
          cara([P(-Lh, -Fh, Y0), P(Lh, -Fh, Y0), P(Lh, 0, Y1), P(-Lh, -Fh, Y0), P(Lh, 0, Y1), P(-Lh, 0, Y1)], [[0, 0], [2 * Lh / 1.6, 0], [2 * Lh / 1.6, lg / 1.6], [0, 0], [2 * Lh / 1.6, lg / 1.6], [0, lg / 1.6]]);
          cara([P(Lh, Fh, Y0), P(-Lh, Fh, Y0), P(-Lh, 0, Y1), P(Lh, Fh, Y0), P(-Lh, 0, Y1), P(Lh, 0, Y1)], [[0, 0], [2 * Lh / 1.6, 0], [2 * Lh / 1.6, lg / 1.6], [0, 0], [2 * Lh / 1.6, lg / 1.6], [0, lg / 1.6]]);
          var Lw = rc.largo / 2, Fw = rc.fondo / 2, Yw = y0 + Fw * pend;
          var gb = [P(Lw, -Fw, Y0), P(Lw, Fw, Y0), P(Lw, 0, Yw), P(-Lw, Fw, Y0), P(-Lw, -Fw, Y0), P(-Lw, 0, Yw)];
          var gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute([].concat.apply([], gb), 3));
          gg.setAttribute('uv', new THREE.Float32BufferAttribute([0, Y0 / 2.4, Fw / 1.2, Y0 / 2.4, Fw / 2.4, Yw / 2.4, 0, Y0 / 2.4, Fw / 1.2, Y0 / 2.4, Fw / 2.4, Yw / 2.4], 2));
          gg.computeVertexNormals();
          var mg = new THREE.Mesh(guarda(gg), matGab); mg.castShadow = true; mg.receiveShadow = true; finca.add(mg);
        }
        var tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3)); tg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); tg.computeVertexNormals();
        var mt = new THREE.Mesh(guarda(tg), MAT.tejado); mt.castShadow = true; mt.receiveShadow = true; finca.add(mt);
        var canto = new THREE.Mesh(cajaGeo(2 * Lh, 0.16, 2 * Fh), matCanto);
        canto.position.set(rc.cx, y0 - 0.1, rc.cz); canto.rotation.y = -rc.ang; canto.castShadow = true; finca.add(canto);
        return Y1;
      }
      var ESTILO = {
        chalet: { muro: 'piedra', planta: 3.1, luz: 0.7, canto: MAT.madera },
        vecina: { muro: 'blanca', planta: 2.8, luz: 0.3, canto: MAT.blanco },
      };
      m.edificios.forEach(function (e) {
        var est = ESTILO[e.tipo] || ESTILO.vecina;
        var suelo = Math.min(e.suelo, yDe(e.rect.cx, e.rect.cz)) - 0.6;
        var arriba = e.suelo + 0.25 + e.pisos * est.planta;
        var an = e.anillo, u = 0;
        for (var n = 0; n < an.length; n++) {
          var A0 = an[n], B0 = an[(n + 1) % an.length], l = Math.hypot(B0[0] - A0[0], B0[1] - A0[1]);
          if (l < 0.05) continue;
          añadeMuro(est.muro, A0, B0, suelo, arriba, u);
          u += l / 2.4;
          if (l >= 2.6 && e.rect.fondo >= 1.6) {
            var nxv = (B0[1] - A0[1]) / l, nzv = -(B0[0] - A0[0]) / l, mid = [(A0[0] + B0[0]) / 2 + nxv * 0.3, (A0[1] + B0[1]) / 2 + nzv * 0.3];
            if (dentro(mid, an)) { nxv = -nxv; nzv = -nzv; }
            var nV = Math.max(1, Math.floor((l - 1.0) / 3.0));
            for (var pi = 0; pi < e.pisos; pi++) for (var w = 0; w < nV; w++) {
              var t = (w + 0.5) / nV, wx = A0[0] + (B0[0] - A0[0]) * t, wz = A0[1] + (B0[1] - A0[1]) * t;
              var hs = Math.abs(Math.sin(wx * 12.9898 + wz * 78.233 + pi * 3.1) * 43758.5453) % 1;
              ventanas.push({ x: wx + nxv * 0.03, z: wz + nzv * 0.03, y: e.suelo + 0.25 + pi * est.planta + 1.5, ang: Math.atan2(nxv, nzv), luz: hs < est.luz, w: 0.9, h: 1.1, dy: 0, tipo: e.tipo });
            }
          }
        }
        if (e.rect.fondo >= 1.6) tejado(e.rect, arriba, e.cubierta, e.tipo === 'chalet' ? 0.6 : 0.45, dosCaras(est.muro), est.canto);
      });
      Object.keys(geoMuros).forEach(function (kk) {
        var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(geoMuros[kk].p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(geoMuros[kk].uv, 2)); g.computeVertexNormals();
        var me = new THREE.Mesh(guarda(g), dosCaras(kk)); me.castShadow = true; me.receiveShadow = true; finca.add(me);
      });
      // la chimenea de piedra del chalet
      (function () {
        var e = m.edificios.filter(function (x) { return x.tipo === 'chalet'; })[0];
        if (!e) return;
        var rc = e.rect, y1 = e.suelo + 0.25 + e.pisos * 3.1 + (rc.fondo / 2 + 0.6) * Math.tan(28 * RAD);
        var ch = caja(finca, 0.9, 2.2, 0.9, MAT.piedra, rc.cx + Math.cos(rc.ang) * rc.largo * 0.28, y1 - 0.2, rc.cz + Math.sin(rc.ang) * rc.largo * 0.28, -rc.ang);
        caja(finca, 1.1, 0.12, 1.1, MAT.losa, ch.position.x, ch.position.y + 1.15, ch.position.z, -rc.ang);
      })();

      /* --- barrotes de todas las barandillas (una sola malla) --- */
      if (balaustres.length) {
        var bal = new THREE.InstancedMesh(guarda(new THREE.BoxGeometry(0.035, 1, 0.035)), MAT.blanco, balaustres.length);
        balaustres.forEach(function (mm, n) { bal.setMatrixAt(n, mm); });
        bal.castShadow = true; casa.add(bal);
      }

      /* --- cristales: oscuros de día; de noche, unos cuantos encendidos (la casa roja, casi todos) --- */
      var nVen = ventanas.length;
      var casaMtx = new THREE.Matrix4().compose(casa.position, casa.quaternion, new THREE.Vector3(1, 1, 1));
      var encendidas = ventanas.filter(function (v) { return v.luz; });
      var luzV = new THREE.InstancedMesh(guarda(new THREE.PlaneGeometry(1, 1)), guarda(new THREE.MeshBasicMaterial({ color: '#ffc77a', toneMapped: false, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })), Math.max(1, encendidas.length));
      var vidrio = new THREE.InstancedMesh(guarda(new THREE.PlaneGeometry(1, 1)), guarda(new THREE.MeshLambertMaterial({ color: '#2a2622', side: THREE.DoubleSide })), Math.max(1, nVen));
      var haloTex = texDe(64, function (g, l) { var r = g.createRadialGradient(l / 2, l / 2, 0, l / 2, l / 2, l / 2); r.addColorStop(0, 'rgba(255,196,120,.85)'); r.addColorStop(0.3, 'rgba(255,190,110,.25)'); r.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = r; g.fillRect(0, 0, l, l); });
      var halos = [];
      var mundo = function (v, sep) {            // posición y giro en el mundo de un hueco (de la casa o de otro edificio)
        if (v.casa) {
          var p = new THREE.Vector3(v.u + Math.sin(v.ang) * sep, v.y + v.dy, v.v + Math.cos(v.ang) * sep).applyMatrix4(casaMtx);
          return { p: p, ang: v.ang - CAS.ang };
        }
        return { p: new THREE.Vector3(v.x + Math.sin(v.ang) * sep, v.y, v.z + Math.cos(v.ang) * sep), ang: v.ang };
      };
      var nVid = 0, nLuz = 0;
      ventanas.forEach(function (v) {
        if (!v.casa) {                            // en los edificios genéricos, el cristal con su marco
          var w0 = mundo(v, 0.0); qt.setFromAxisAngle(eje, w0.ang); sc.set(v.w, v.h, 1); mtx.compose(w0.p, qt, sc); vidrio.setMatrixAt(nVid++, mtx);
        }
        if (v.luz) {
          var w1 = mundo(v, v.casa ? 0.03 : 0.02); qt.setFromAxisAngle(eje, w1.ang); sc.set(v.w, v.h, 1); mtx.compose(w1.p, qt, sc); luzV.setMatrixAt(nLuz++, mtx);
          if (v.casa || v.tipo === 'chalet') {
            var w2 = mundo(v, 0.45);
            var hS = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 }));
            guarda(hS.material); hS.position.copy(w2.p); hS.scale.set(3.0, 3.0, 1); hS.visible = false; finca.add(hS); halos.push(hS);
          }
        }
      });
      sc.set(1, 1, 1);
      vidrio.count = nVid; luzV.count = nLuz; luzV.visible = false;
      finca.add(vidrio, luzV);

      /* --- los espigones de la bocana (escollera sobre su trazado en la ortofoto) --- */
      var ESP = m.espigones;
      ['oeste', 'este'].forEach(function (lado) {
        var P = ESP[lado];
        for (var n = 0; n < P.length - 1; n++) {
          var a = P[n], b = P[n + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
          var me = caja(esc3, l + ESP.ancho * 0.6, ESP.alto + 5, ESP.ancho, MAT.roca, (a[0] + b[0]) / 2, (ESP.alto - 5) / 2, (a[1] + b[1]) / 2, -Math.atan2(b[1] - a[1], b[0] - a[0]), false);
          me.receiveShadow = false;
        }
        var punta = new THREE.Mesh(guarda(new THREE.CylinderGeometry(ESP.ancho * 0.8, ESP.ancho * 1.1, ESP.alto + 5, 14)), MAT.roca);
        punta.position.set(P[0][0], (ESP.alto - 5) / 2, P[0][1]); esc3.add(punta);
      });

      /* --- los olivos: copa redonda sobre tronco corto (los árboles del logo), donde están en la ortofoto --- */
      var copaGeo = function (detalle, semilla) {
        var g = new THREE.IcosahedronGeometry(1, detalle), cp = g.attributes.position;
        for (var n = 0; n < cp.count; n++) {           // por posición: los vértices repetidos se mueven igual (sin grietas)
          var vx = cp.getX(n), vy = cp.getY(n), vz = cp.getZ(n), hsh = Math.abs(Math.sin(vx * 12.99 + vy * 78.23 + vz * 37.72 + semilla) * 43758.55) % 1, f = 0.84 + hsh * 0.3;
          cp.setXYZ(n, vx * f, vy * f, vz * f);
        }
        g.computeVertexNormals(); return guarda(g);
      };
      var rr = azar(77), col = new THREE.Color();
      var oli = m.olivos;
      var copasO = new THREE.InstancedMesh(copaGeo(1, 3), guarda(new THREE.MeshLambertMaterial({ color: '#ffffff' })), oli.length);
      var troncosO = new THREE.InstancedMesh(guarda(new THREE.CylinderGeometry(0.2, 0.34, 1, 7)), guarda(new THREE.MeshLambertMaterial({ color: '#5a4f44' })), oli.length);
      var baseO = new THREE.Color('#71805a');
      oli.forEach(function (o, n) {
        var x = o[0], z = o[2], r = o[3], y0 = yDe(x, z), tH = 1.6 + rr() * 0.7;
        qt.setFromAxisAngle(eje, rr() * 6.28);
        ps.set(x, y0 + tH + r * 0.72, z); sc.set(r, r * (0.82 + rr() * 0.12), r); mtx.compose(ps, qt, sc); copasO.setMatrixAt(n, mtx);
        col.copy(baseO).offsetHSL((rr() - 0.5) * 0.02, (rr() - 0.5) * 0.06, (rr() - 0.5) * 0.05); copasO.setColorAt(n, col);
        ps.set(x, y0 + tH / 2 + 0.2, z); sc.set(1, tH + 0.6, 1); mtx.compose(ps, qt, sc); troncosO.setMatrixAt(n, mtx);
      });
      sc.set(1, 1, 1);
      copasO.castShadow = troncosO.castShadow = true; copasO.receiveShadow = true;
      finca.add(copasO, troncosO);

      /* --- el pinar y las arboledas (copas detectadas en la ortofoto); cerca de la casa, con sombra --- */
      var arbol = m.arboles.filter(function (a, n) { return hiDef || n % 2 === 0 || Math.hypot(a[0] - CAS.cx, a[2] - CAS.cz) < 180; });
      var cercaA = arbol.filter(function (a) { return Math.hypot(a[0] - CAS.cx, a[2] - CAS.cz) < 160; });
      var lejosA = arbol.filter(function (a) { return Math.hypot(a[0] - CAS.cx, a[2] - CAS.cz) >= 160; });
      var troncoGeo = guarda(new THREE.CylinderGeometry(0.16, 0.3, 1, 5));
      var matCopa = guarda(new THREE.MeshLambertMaterial({ color: '#ffffff' })), matTronco = guarda(new THREE.MeshLambertMaterial({ color: '#4a3d30' }));
      var verdeF = new THREE.Color('#4f6b3a'), verdeP = new THREE.Color('#34492e');
      function arboleda(lista, detalle, sombra) {
        if (!lista.length) return;
        var copas = new THREE.InstancedMesh(copaGeo(detalle, 9), matCopa, lista.length);
        var troncos = new THREE.InstancedMesh(troncoGeo, matTronco, lista.length);
        lista.forEach(function (a, n) {
          var x = a[0], z = a[2], r = a[3], alto = a[4], pino = a[6] === 1, y0 = yDe(x, z);
          qt.setFromAxisAngle(eje, rr() * 6.28);
          if (pino) {                             // pino: tronco alto y desnudo, copa aplastada arriba
            ps.set(x, y0 + alto - r * 0.5, z); sc.set(r, r * (0.5 + rr() * 0.15), r);
          } else {
            ps.set(x, y0 + alto - r * 0.95, z); sc.set(r, r * (0.85 + rr() * 0.3), r);
          }
          mtx.compose(ps, qt, sc); copas.setMatrixAt(n, mtx);
          col.set(a[5]); col.lerp(pino ? verdeP : verdeF, 0.45); col.multiplyScalar(1.12 + rr() * 0.2); copas.setColorAt(n, col);
          var tt = pino ? alto - r * 0.6 : Math.max(0.5, alto - r);
          ps.set(x, y0 + tt / 2, z); sc.set(pino ? 0.9 : 1, tt, pino ? 0.9 : 1); mtx.compose(ps, qt, sc); troncos.setMatrixAt(n, mtx);
        });
        sc.set(1, 1, 1);
        copas.castShadow = troncos.castShadow = sombra; copas.receiveShadow = sombra;
        esc3.add(copas, troncos);
      }
      arboleda(cercaA, 1, true);
      arboleda(lejosA, hiDef ? 1 : 0, false);

      /* --- rótulos (HTML encima del lienzo) --- */
      var rotulos = m.lugares.map(function (l) {
        var li = document.createElement('span');
        li.className = 'lugar__rotulo' + (l.clave === 'finca' ? ' lugar__rotulo--casa' : '');
        li.innerHTML = '<span><b>' + esc(l.nombre) + '</b>' + (l.sub ? '<small>' + esc(l.sub) + '</small>' : '') + '</span>';
        capaRot.appendChild(li);
        return { el: li, l: l, v: new THREE.Vector3(l.x, l.y, l.z), visto: false };
      });
      function tapado(a, b) {                     // ¿el relieve tapa la línea de la cámara al rótulo?
        for (var n = 1; n < 24; n++) {
          var t = n / 24, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, y = a.y + (b.y - a.y) * t;
          if (yDe(x, z) > y + 2) return true;
        }
        return false;
      }

      /* --- el cielo de ahora: luces, colores, astros, nubes --- */
      var dirSol = new THREE.Vector3(), dirLuna = new THREE.Vector3(), noche = 0;
      var dirDe = function (az, alt, v) { return v.set(Math.sin(az * RAD) * Math.cos(alt * RAD), Math.sin(alt * RAD), -Math.cos(az * RAD) * Math.cos(alt * RAD)); };
      var faseLuna = -1;
      function luces(f) {
        f = f || ahora();
        var s = sol(f), l = luna(f), c = cieloPara(s.alt), nub = estado.nubes == null ? 0 : estado.nubes;
        noche = lim((-s.alt - 2) / 10, 0, 1);
        var dia = lim((s.alt + 4) / 14, 0, 1);
        var gris = 0.45 * nub * nub;              // con el cielo cubierto, el cielo y el horizonte se agrisan
        var cz = mezcla(c.cz, mezcla('#8d97a3', '#0c1018', noche), gris), ch = mezcla(c.ch, mezcla('#c9ced3', '#151a24', noche), gris);
        uCielo.cZ.value.set(cz); uCielo.cH.value.set(ch);
        dirDe(s.az, s.alt, dirSol); dirDe(l.az, l.alt, dirLuna);
        uCielo.dirSol.value.copy(dirSol);
        uCielo.brillo.value = lim(1 - Math.abs(s.alt - 1) / 14, 0, 1) * (1 - 0.6 * nub);
        uCielo.nubes.value = nub; uCielo.noche.value = noche;
        esc3.fog.color.set(mezcla(ch, cz, 0.12));
        esc3.fog.density = (1 + 1.4 * nub) / 26000;
        // sol (directo, menos con nubes; nunca por debajo del horizonte)
        luzSol.position.copy(FINCA).addScaledVector(dirSol, 800);
        luzSol.intensity = 2.7 * suave(-1, 10, s.alt) * (1 - 0.62 * nub);
        luzSol.color.set(mezcla('#fff6ea', '#ff9d5c', lim(1 - s.alt / 22, 0, 1)));
        solS.visible = s.alt > -3; solS.material.opacity = lim((s.alt + 3) / 4, 0, 1) * (1 - 0.7 * nub);
        luzLuna.position.copy(FINCA).addScaledVector(dirLuna, 800);
        luzLuna.intensity = l.alt > 0 ? (0.25 + 0.9 * l.luz) * noche * (1 - 0.6 * nub) : 0;
        lunaS.visible = l.alt > -1.5 && l.luz > 0.03;
        if (lunaS.visible) { var fk = Math.round(l.fase * 100); if (fk !== faseLuna) { faseLuna = fk; pintarLuna(l.fase); } lunaS.material.opacity = lim((l.alt + 1.5) / 3, 0, 1) * (1 - 0.6 * nub); }
        hemi.intensity = lerp(0.45, 1.55, dia) * (1 + 0.25 * nub);
        hemi.color.set(mezcla('#3c4f86', '#dfe8f0', dia)); hemi.groundColor.set(mezcla('#15131c', '#5d5444', dia));
        estrellas.material.opacity = noche * noche * (1 - nub);
        uAgua.cZ.value.set(cz); uAgua.cH.value.set(ch); uAgua.dirSol.value.copy(dirSol); uAgua.dirLuna.value.copy(dirLuna);
        uAgua.colSol.value.copy(luzSol.color); uAgua.brilloSol.value = suave(-2, 6, s.alt) * (1 - 0.8 * nub);
        uAgua.brilloLuna.value = l.alt > 0 ? l.luz * noche * (1 - nub) : 0;
        uAgua.luzAgua.value = lerp(0.1, 1, dia) * (1 - 0.25 * nub);
        // la casa de noche
        var enc = noche > 0.05;
        luzV.visible = enc; luzV.material.opacity = lim(noche * 1.4, 0, 1);
        halos.forEach(function (h) { h.visible = enc; h.material.opacity = noche * 0.9; });
        luzPorche.intensity = noche * 45;
        ren.shadowMap.needsUpdate = true;
        pedir(true);
      }

      /* --- cámara: el recorrido con el scroll --- */
      var ruta = camino(m.recorrido);
      var vista = { w: 0, h: 0 };
      var hProm = 0;
      function ajustar() {
        var w = escenario.clientWidth, h = escenario.clientHeight;
        if (!w || !h) return;
        // la barra del navegador del móvil cambia solo el alto: no se rehace nada (si no, salta)
        if (vista.w === w && Math.abs(vista.h - h) < 160 && vista.h) { if (vista.h !== h) { vista.h = h; ren.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); pedir(true); } return; }
        vista.w = w; vista.h = h;
        ren.setPixelRatio(Math.min(devicePixelRatio || 1, topeDPR()));
        ren.setSize(w, h, false);
        cam.aspect = w / h;
        cam.fov = w / h < 1 ? 58 : w / h < 1.3 ? 48 : 42;          // en vertical se abre para que quepan la bocana y la playa
        cam.updateProjectionMatrix();
        pedir(true);
      }
      function situar(p) {
        var r = ruta(p);
        cam.position.set(r.pos[0], r.pos[1], r.pos[2]);
        cam.lookAt(r.mira[0], r.mira[1], r.mira[2]);
        var sobre = Math.max(2, r.pos[1] - Math.max(agua.position.y, yDe(r.pos[0], r.pos[2])));
        var cerca2 = lim(sobre * 0.1, 0.3, 20);
        if (Math.abs(cerca2 - cam.near) / cam.near > 0.1) { cam.near = cerca2; cam.updateProjectionMatrix(); }
        hProm = r.pos[1];
      }
      var v3 = new THREE.Vector3();
      var enFase = function (l, p) { return l.fases.some(function (f) { return p >= f[0] && p <= f[1]; }); };
      function colocarRotulos(p) {
        var w = vista.w, h = vista.h;
        rotulos.forEach(function (r) {
          var ok = enFase(r.l, p);
          if (ok) {
            v3.copy(r.v).project(cam);
            ok = v3.z < 1 && Math.abs(v3.x) < 0.94 && v3.y > -0.9 && v3.y < 0.92;
            if (ok && r.l.clave !== 'mar') ok = !tapado(cam.position, r.v);
          }
          if (ok) r.el.style.transform = 'translate3d(' + ((v3.x + 1) / 2 * w).toFixed(1) + 'px,' + ((1 - v3.y) / 2 * h).toFixed(1) + 'px,0)';
          if (ok !== r.visto) { r.visto = ok; r.el.classList.toggle('es-visible', ok); }
        });
      }

      /* --- bucle: pinta si algo cambia; el agua se mueve mientras se ve; se para fuera de pantalla --- */
      var raf = 0, tPrev = 0, tPint = 0, activo = false, visible = true, sucio = true, primero = true, pAnt = -1, tAgua = 0;
      var fpsEl = null, fN = 0, fT0 = 0, tAc = 0, nAc = 0;
      if (q.has('fps')) { fpsEl = document.createElement('p'); fpsEl.className = 'lugar__fps'; escenario.appendChild(fpsEl); }
      function leerScroll() {
        var r = pista.getBoundingClientRect(), recorrido = pista.offsetHeight - escenario.offsetHeight;
        estado.p = recorrido > 0 ? lim(-r.top / recorrido, 0, 1) : 0;
      }
      function paso(t) {
        raf = 0;
        if (estado.destruido || !activo || !visible) return;
        var dt = tPrev ? Math.min(0.1, (t - tPrev) / 1000) : 0.016; tPrev = t;
        leerScroll();
        var kk = reduce ? 1 : 1 - Math.exp(-dt * 5.5);                  // inercia suave, independiente de los fps
        var pV = estado.pVis + (estado.p - estado.pVis) * kk;
        if (Math.abs(estado.p - pV) < 0.00005) pV = estado.p;
        var mueve = Math.abs(pV - pAnt) > 0.00001;
        estado.pVis = pV;
        // quieto, el agua se repinta a ~30 fps (basta para el oleaje y ahorra la mitad)
        var aguaViva = !reduce && (t - tPint > 31);
        if (mueve || sucio || aguaViva) {
          tAgua += mueve || sucio ? dt : (t - tPint) / 1000; uAgua.tiempo.value = tAgua; tPint = t;
          situar(pV);
          cielo.position.copy(cam.position); estrellas.position.copy(cam.position);
          solS.position.copy(cam.position).addScaledVector(dirSol, 100000);
          lunaS.position.copy(cam.position).addScaledVector(dirLuna, 100000);
          ren.render(esc3, cam);
          colocarRotulos(pV); marcarParada(pV);
          pAnt = pV; sucio = false;
          if (primero && (pendientes <= 0 || t > tListo)) { primero = false; escenario.classList.add('lugar--listo'); estado.cargado = true; }
          if (fpsEl) { fN++; if (!fT0) fT0 = t; if (t - fT0 > 500) { fpsEl.textContent = (fN * 1000 / (t - fT0)).toFixed(0) + ' fps · calidad ' + estado.calidad + ' · DPR ' + ren.getPixelRatio().toFixed(2) + ' · cámara a ' + Math.round(hProm) + ' m · ' + Math.round(ren.info.render.triangles / 1000) + ' k triángulos · marea ' + num(agua.position.y, 2) + ' m'; fN = 0; fT0 = t; } }
          if (mueve) { tAc += dt; nAc++; }
          if (nAc >= 50) { var media = tAc / nAc; tAc = 0; nAc = 0; if (media > 0.03 && estado.calidad < 2 && !document.hidden) bajarCalidad(); }
        }
        raf = requestAnimationFrame(paso);
      }
      function pedir(ensuciar) { if (ensuciar) sucio = true; if (!raf && activo && visible && !estado.destruido) { tPrev = 0; raf = requestAnimationFrame(paso); } }
      function bajarCalidad() {
        estado.calidad++;
        if (estado.calidad === 1) { ren.setPixelRatio(1); ren.setSize(vista.w, vista.h, false); }
        if (estado.calidad === 2) { ren.shadowMap.enabled = false; luzSol.castShadow = false; ren.setPixelRatio(0.8); ren.setSize(vista.w, vista.h, false); esc3.traverse(function (o) { if (o.material) o.material.needsUpdate = true; }); }
        pedir(true);
      }
      var alRedim = new ResizeObserver(function () { ajustar(); });
      alRedim.observe(escenario);
      var io = new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible) pedir(true); else { cancelAnimationFrame(raf); raf = 0; }
      }, { rootMargin: '120px' });
      io.observe(pista);
      escucha(window, 'scroll', function () { pedir(false); }, { passive: true });
      cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); estado.error3d = 'contexto perdido'; ponModo('plano'); });

      ajustar();
      try { ren.compile(esc3, cam); } catch (e) { /* sin compilación previa */ }

      t3 = {
        luces: luces,
        nivel: ponNivel,
        activo: function (si) { activo = si; cv.hidden = !si; if (si) { vista.w = 0; ajustar(); pedir(true); } else { cancelAnimationFrame(raf); raf = 0; } },
        estado: function () { return { p: estado.p, pVis: estado.pVis, calidad: estado.calidad, near: cam.near, fov: cam.fov, triangulos: ren.info.render.triangles, llamadas: ren.info.render.calls, ventanas: nVen, arboles: arbol.length, olivos: oli.length, nivel: agua.position.y, cam: [cam.position.x, cam.position.y, cam.position.z] }; },
        destruir: function () {
          cancelAnimationFrame(raf); raf = 0; alRedim.disconnect(); io.disconnect();
          disponer.forEach(function (o) { try { o.dispose(); } catch (e) { /* ya */ } });
          esc3.traverse(function (o) { if (o.material && o.material.dispose) o.material.dispose(); });
          try { ren.dispose(); ren.forceContextLoss(); } catch (e) { /* ya */ }
          cv.remove();
        },
      };
      luces(); ponNivel(nivelAhora(ahora()));
      return t3;
    }

    /* ---------- mandos ---------- */
    function activar3d(desdeBoton) {
      ponModo('3d');
      if (desdeBoton) el.scrollIntoView({ block: 'start', behavior: 'auto' });
      cargar3d().then(function (t) { if (t && !estado.destruido && estado.modo === '3d') t.activo(true); });
    }
    $('a3d').addEventListener('click', function () { activar3d(true); });
    $('aplano').addEventListener('click', function () { ponModo('plano'); el.scrollIntoView({ block: 'start', behavior: 'auto' }); });
    var alRedimPlano = new ResizeObserver(function () { colocarMarcas(); });
    alRedimPlano.observe(el);
    escuchas.push(function () { alRedimPlano.disconnect(); });

    cieloTexto();
    pedirEnVivo();
    intervalo = setInterval(function () { if (!document.hidden) cieloTexto(); }, 60000);
    marcarParada(0);
    if (auto3d) activar3d(false); else ponModo('plano');
    el.dataset.montado = '1';

    return {
      destruir: function () {
        estado.destruido = true;
        clearInterval(intervalo);
        escuchas.forEach(function (f) { f(); });
        if (t3) t3.destruir();
        t3 = null;
        el.classList.remove('lugar-mod'); delete el.dataset.modo; delete el.dataset.montado;
        el.style.removeProperty('--lugar-noche');
        el.innerHTML = respaldo;
      },
      estado: function () { return { modo: estado.modo, puede3d: puede3d, auto3d: auto3d, error3d: estado.error3d, cargado: estado.cargado, nubes: estado.nubes, marea: estado.marea ? fraseMarea(estado.marea, ahora()) : null, t3: t3 ? t3.estado() : null }; },
      ver3d: function () { activar3d(false); },
      verPlano: function () { ponModo('plano'); },
    };
  }

  MM.lugar = { montar: montar, sol: sol, luna: luna, fraseCielo: fraseCielo, cieloPara: cieloPara, camino: camino, monotona: monotona,
    leerMarea: leerMarea, mareaEn: mareaEn, extremos: extremos, fraseMarea: fraseMarea };
})();
