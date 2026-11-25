/* =====================================================================
   Montemar · tiempo.js: el tiempo de ahora en Navia (sección «La vista»).
   - Open-Meteo (sin clave, CORS abierto): cielo (código WMO), temperatura, sensación, viento y rachas para la casa
     (43.5486, -6.7189). Su modelo marino (marine-api.open-meteo.com) da el oleaje del mar abierto frente a la ría
     (la celda más cercana con mar está a unos 18 km al norte).
   - Si una petición falla, NO se inventa nada: ese dato no sale y se dice; el botón de su cámara sigue ahí.
   - No guarda nada en el navegador. Se pide al acercarse a la sección (IntersectionObserver) y cada 15 minutos
     mientras la página siga abierta y visible.
   - Montemar.tiempo: { estado, pedir() } (para las pruebas).
   ===================================================================== */
(function () {
  'use strict';
  const M = (window.Montemar = window.Montemar || {});
  const $ = (id) => document.getElementById(id);
  const caja = $('tiempo');
  if (!caja) return;
  const LAT = 43.5486, LON = -6.7189;
  const URL_TIEMPO = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,wind_direction_10m,wind_gusts_10m&timezone=Europe%2FMadrid&wind_speed_unit=kmh`;
  const URL_MAR = `https://marine-api.open-meteo.com/v1/marine?latitude=${LAT}&longitude=${LON}&current=wave_height,wave_direction,wave_period&timezone=Europe%2FMadrid`;

  const CIELO = [
    [[0], 'Despejado', 'sol'], [[1], 'Casi despejado', 'sol'], [[2], 'Algunas nubes', 'sol-nube'], [[3], 'Cubierto', 'nube'],
    [[45, 48], 'Niebla', 'niebla'], [[51, 53, 55], 'Llovizna', 'lluvia'], [[56, 57], 'Llovizna helada', 'lluvia'],
    [[61], 'Lluvia débil', 'lluvia'], [[63], 'Lluvia', 'lluvia'], [[65], 'Lluvia fuerte', 'lluvia'], [[66, 67], 'Lluvia helada', 'lluvia'],
    [[71, 73, 75, 77], 'Nieve', 'nieve'], [[80], 'Chubascos débiles', 'lluvia'], [[81], 'Chubascos', 'lluvia'], [[82], 'Chubascos fuertes', 'lluvia'],
    [[85, 86], 'Chubascos de nieve', 'nieve'], [[95], 'Tormenta', 'tormenta'], [[96, 99], 'Tormenta con granizo', 'tormenta'],
  ];
  const RUMBOS = ['del norte', 'del nordeste', 'del este', 'del sudeste', 'del sur', 'del sudoeste', 'del oeste', 'del noroeste'];
  const rumbo = (g) => RUMBOS[Math.round(((g % 360) + 360) % 360 / 45) % 8];
  const coma = (v, d = 0) => v.toFixed(d).replace('.', ',');
  const estado = { tiempo: null, mar: null, error: null, hora: null };

  async function leer(url) {
    const ctl = 'AbortController' in window ? new AbortController() : null;
    const t = setTimeout(() => ctl && ctl.abort(), 9000);
    try {
      const r = await fetch(url, ctl ? { signal: ctl.signal } : {});
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if (!j || !j.current) throw new Error('sin datos');
      return j.current;
    } finally { clearTimeout(t); }
  }

  function pintar() {
    const T = estado.tiempo, O = estado.mar;
    const datos = $('tiempo-datos');
    if (!T) {
      datos.hidden = true;
      caja.dataset.estado = 'error';
      $('tiempo-estado').textContent = 'Ahora mismo no se puede leer el tiempo de Navia. Su cámara lo enseña en directo.';
      $('tiempo-estado').hidden = false;
      return;
    }
    const c = CIELO.find(([cods]) => cods.includes(T.weather_code)) || [[], 'Sin dato del cielo', 'nube'];
    let icono = c[2];
    if (!T.is_day && (icono === 'sol')) icono = 'luna';
    if (!T.is_day && icono === 'sol-nube') icono = 'nube';
    $('tiempo-ico').setAttribute('href', '#i-' + icono);
    $('t-cielo').textContent = c[1];
    $('t-temp').textContent = coma(T.temperature_2m) + ' °C';
    $('t-sensa').textContent = Number.isFinite(T.apparent_temperature) ? `sensación de ${coma(T.apparent_temperature)} °C` : '';
    $('t-viento').textContent = coma(T.wind_speed_10m) + ' km/h';
    $('t-viento-dir').textContent = rumbo(T.wind_direction_10m) + (Number.isFinite(T.wind_gusts_10m) ? `, rachas de ${coma(T.wind_gusts_10m)}` : '');
    const datoOla = $('t-ola').closest('.tiempo__dato');
    if (O && Number.isFinite(O.wave_height)) {
      datoOla.hidden = false;
      $('t-ola').textContent = coma(O.wave_height, 1) + ' m';
      $('t-ola-per').textContent = (Number.isFinite(O.wave_period) ? `cada ${coma(O.wave_period)} s` : '') + (Number.isFinite(O.wave_direction) ? `, ${rumbo(O.wave_direction)}` : '');
    } else datoOla.hidden = true;
    datos.hidden = false;
    caja.dataset.estado = 'listo';
    const h = (T.time || '').slice(11, 16);
    estado.hora = h;
    $('tiempo-estado').hidden = true;
    $('tiempo-fuente').textContent = `Ahora en Navia (dato de las ${h}, hora de Navia), según Open-Meteo.` + (O && Number.isFinite(O.wave_height) ? ' El oleaje, de su modelo marino para el mar abierto frente a la ría.' : ' El oleaje no se ha podido leer.');
  }

  let pidiendo = false;
  async function pedir() {
    if (pidiendo) return;
    pidiendo = true;
    const [a, b] = await Promise.allSettled([leer(URL_TIEMPO), leer(URL_MAR)]);
    estado.tiempo = a.status === 'fulfilled' ? a.value : null;
    estado.mar = b.status === 'fulfilled' ? b.value : null;
    estado.error = a.status === 'rejected' ? String(a.reason) : null;
    pidiendo = false;
    pintar();
  }

  let cada = 0;
  const empezar = () => {
    pedir();
    if (!cada) cada = setInterval(() => { if (document.visibilityState === 'visible') pedir(); }, 15 * 60 * 1000);
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { io.disconnect(); empezar(); } }, { rootMargin: '600px 0px' });
    io.observe(caja);
  } else empezar();

  M.tiempo = { estado, pedir };
})();
