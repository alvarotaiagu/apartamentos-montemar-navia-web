/* ------------------------------------------------------------------
   Montemar · Navia · «Del monte al mar» · lo común de la página (receta de ../amaicha-ribadesella-web/js/main.js)
   - Monta los módulos con su respaldo: la portada (Montemar.portada) al cargar y el 3D (Montemar.lugar, del agente
     Lugar 3D) al acercarse (IntersectionObserver, 900 px). Contrato: Montemar.<mod>.montar(el, { movimiento, densidad,
     webgl }) → { destruir() }. Si un módulo falla, vuelve su respaldo. Si js/lugar.js no está, se queda el respaldo.
   - Cabecera, menú móvil, el índice de estancias, el visor por NOMBRE, cookies, el mapa a petición, el foco del teclado
     con las tres copas, el fondo que baja (verde, tierra, agua), el medidor de altura, el logo del pie que se completa
     y el mando (?revision).
   - El buscador y el motor real van en js/reserva.js; el tiempo de ahora, en js/tiempo.js.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  const raiz = document.documentElement;
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = !quieto;
  const sobria = () => raiz.classList.contains('densidad-sobria');
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const M = (window.Montemar = window.Montemar || {});
  const anno = $('#anno');
  if (anno) anno.textContent = new Date().getFullYear();

  // el resize de la barra del móvil (mismo ancho, poca altura) no rehace NADA (checklist punto 10)
  let anchoVista = innerWidth, altoVista = innerHeight;
  const esBarra = () => innerWidth === anchoVista && Math.abs(innerHeight - altoVista) < 160;

  /* ============ 1. titulares que aparecen (solo con movimiento; se observa el CONTENEDOR, checklist 13) ============ */
  const titulares = $$('[data-aparece]');
  if (motion && 'IntersectionObserver' in window) {
    const deCaja = new Map();
    titulares.forEach((h) => { const c = h.parentElement || h; if (!deCaja.has(c)) deCaja.set(c, []); deCaja.get(c).push(h); });
    const vistos = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { (deCaja.get(e.target) || []).forEach((h) => h.classList.add('es-visto')); vistos.unobserve(e.target); }
    }), { rootMargin: '0px 0px -6% 0px' });
    deCaja.forEach((_, c) => vistos.observe(c));
    raiz.classList.add('con-movimiento');
  } else titulares.forEach((h) => h.classList.add('es-visto'));

  /* ============ 2. ir a un sitio ============ */
  const cabAlto = () => parseFloat(getComputedStyle(raiz).getPropertyValue('--cabecera')) || 72;
  const irA = (sel) => {
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (!el) return;
    const y = el.getBoundingClientRect().top + scrollY - cabAlto() - 8;
    scrollTo({ top: Math.max(0, y), behavior: quieto || sobria() ? 'auto' : 'smooth' });
  };

  /* ============ 3. cabecera: fondo al bajar y el enlace de la sección que se ve ============ */
  const cab = $('#cab');
  const enlaces = $$('.cab__nav a');
  const secciones = enlaces.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  let actual = null;
  function pintarCabecera() {
    cab.classList.toggle('sc', scrollY > 24);
    const y = cabAlto() + altoVista * 0.25;
    let sec = null;
    for (const s of secciones) { const r = s.getBoundingClientRect(); if (r.top <= y && r.bottom > y) sec = s; }
    if (sec !== actual) {
      actual = sec;
      enlaces.forEach((a) => { if (sec && a.getAttribute('href') === '#' + sec.id) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
    }
  }

  /* ============ 4. módulos: portada (al cargar) y lugar (al acercarse) ============ */
  const montados = new Map();
  const esperando = new Set();
  const modulo = (el) => { const m = M[el.dataset.modulo]; return m && typeof m.montar === 'function' ? m : null; };
  const opciones = () => ({ movimiento: motion && !sobria(), densidad: sobria() ? 'sobria' : 'monte', webgl: !raiz.classList.contains('sin-webgl') });
  function montarModulo(el) {
    if (montados.has(el)) return;
    const mod = modulo(el);
    if (!mod) { esperando.add(el); if (document.readyState === 'complete') el.classList.add('sin-modulo'); return; }
    esperando.delete(el);
    el.classList.remove('sin-modulo');
    const respaldo = el.innerHTML;
    try {
      const inst = mod.montar(el, opciones());
      montados.set(el, { inst, respaldo });
      if (inst && inst.listo && typeof inst.listo.catch === 'function') inst.listo.catch((er) => { console.warn('Módulo ' + el.dataset.modulo + ': se queda el respaldo', er); el.innerHTML = respaldo; delete el.dataset.montado; el.classList.add('sin-modulo'); });
    } catch (er) {
      console.warn('Módulo ' + el.dataset.modulo + ': se queda el respaldo', er);
      el.innerHTML = respaldo;
      el.classList.add('sin-modulo');
      montados.set(el, { inst: null, respaldo });
    }
  }
  const reintentar = () => { if (esperando.size) [...esperando].forEach(montarModulo); esperando.forEach((el) => el.classList.add('sin-modulo')); };
  addEventListener('load', reintentar);
  function remontarTodos() {
    [...montados].forEach(([el, { inst, respaldo }]) => {
      try { inst && inst.destruir && inst.destruir(); } catch (er) { console.warn(er); }
      el.innerHTML = respaldo;
      el.classList.remove('sin-modulo');
      delete el.dataset.montado;
      montados.delete(el);
      montarModulo(el);
    });
  }
  const portadaMod = $('#portada [data-modulo="portada"]');
  if (portadaMod) montarModulo(portadaMod);
  const resto = $$('[data-modulo]').filter((el) => el !== portadaMod);
  if ('IntersectionObserver' in window) {
    const ioMod = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { ioMod.unobserve(e.target); montarModulo(e.target); }
    }), { rootMargin: '900px 0px' });
    resto.forEach((el) => ioMod.observe(el));
  } else resto.forEach(montarModulo);
  // los clics dentro del 3D montado son del módulo
  const deModulo = (t) => !!t.closest('[data-modulo="lugar"][data-montado]');

  /* ============ 5. menú ============ */
  const btnMenu = $('#menu-btn'), menu = $('#menu-movil');
  const cerrarMenu = () => {
    document.body.classList.remove('menu');
    btnMenu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
  };
  btnMenu.addEventListener('click', () => {
    const abierto = document.body.classList.toggle('menu');
    btnMenu.setAttribute('aria-expanded', String(abierto));
    menu.setAttribute('aria-hidden', String(!abierto));
    pintarMedidor();
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('menu')) { cerrarMenu(); btnMenu.focus(); } });

  /* ============ 6. enlaces internos y «Ver fechas» de cada ficha ============ */
  M.reservar = function (unidad) {
    if (unidad && M.reserva) M.reserva.unidad(unidad);
    cerrarMenu();
    irA('#reservar');
  };
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || deModulo(e.target)) return;
    const r = e.target.closest('[data-reservar]');
    if (r) { e.preventDefault(); M.reservar(r.getAttribute('data-reservar')); return; }
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const destino = a.getAttribute('href');
    if (destino.length < 2 || !$(destino)) return;
    e.preventDefault();
    cerrarMenu();
    irA(destino);
    setTimeout(() => {
      const t = $(destino);
      if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
      t.focus({ preventScroll: true });
    }, 900);
  });

  /* ============ 7. por dentro: el índice marca la estancia que se ve (contenido: también con movimiento reducido) ============ */
  const indice = $$('.estancias__indice a');
  if (indice.length && 'IntersectionObserver' in window) {
    const marcar = (id) => indice.forEach((a) => { if (a.dataset.est === id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) marcar(e.target.id.replace('est-', '')); }), { rootMargin: '-35% 0px -60% 0px' });
    $$('.estancia').forEach((s) => io.observe(s));
  }

  /* ============ 8. cookies (y el mando se aparta mientras están) ============ */
  const ck = $('#cookies');
  const LLAVE = 'montemar-cookies';
  const leer = () => { try { return localStorage.getItem(LLAVE); } catch (e) { return null; } };
  const guardar = (v) => { try { localStorage.setItem(LLAVE, v); } catch (e) { /* sin almacenamiento */ } };
  const mando = $('#mando');
  const verMando = () => { if (mando && raiz.classList.contains('revision')) mando.hidden = !ck.hidden; };
  const cerrarCk = (v) => { guardar(v); ck.hidden = true; verMando(); pintarMedidor(); };
  $('#ck-si').addEventListener('click', () => cerrarCk('si'));
  $('#ck-no').addEventListener('click', () => cerrarCk('no'));
  $('#abrir-cookies').addEventListener('click', () => { ck.hidden = false; verMando(); pintarMedidor(); $('#ck-si').focus(); });
  if (!leer()) ck.hidden = false;
  verMando();

  /* ============ 9. mapa de Google solo al pedirlo (sin clave de API) ============ */
  $('#mapa-btn').addEventListener('click', () => {
    const marco = document.createElement('iframe');
    const q = $('#mapa').dataset.q || 'Apartamentos Montemar, Camino Montemar, 33710 Navia, Asturias';
    marco.src = 'https://www.google.com/maps?q=' + encodeURIComponent(q) + '&z=14&output=embed';
    marco.loading = 'lazy';
    marco.title = 'Mapa con Apartamentos Montemar en Navia';
    marco.referrerPolicy = 'no-referrer-when-downgrade';
    $('#mapa').appendChild(marco);
    $('#mapa-btn').remove();
  });

  /* ============ 10. visor de fotos: se abre por el NOMBRE de la foto (checklist 11) ============ */
  const visor = $('#visor');
  const vImg = $('#visor-img'), vPie = $('#visor-pie'), vN = $('#visor-n');
  function infoFoto(n) {
    const img = $('picture[data-foto="' + n + '"] img');
    let anchos = [800], ancho = 1024, alto = 675, alt = '';
    if (img) {
      const a = (img.getAttribute('srcset') || '').split(',').map((x) => parseInt(x.trim().split(/\s+/)[1], 10)).filter(Boolean).sort((p, q) => p - q);
      if (a.length) anchos = a;
      ancho = +img.getAttribute('width') || ancho; alto = +img.getAttribute('height') || alto;
      alt = img.alt;
    }
    return { n, alt, pie: alt, anchos, ancho, alto };
  }
  let lista = [], actualV = 0, origen = null;
  function poner(i) {
    actualV = (i + lista.length) % lista.length;
    const f = lista[actualV];
    const peq = f.anchos.includes(800) ? 800 : f.anchos[0];
    const gran = f.anchos.filter((w) => w <= 1920).pop() || f.anchos[f.anchos.length - 1];
    // primero la de 800 (ya en caché o ligera) y la grande al cargar
    vImg.src = `img/fotos/${f.n}-${peq}.jpg`;
    vImg.dataset.nombre = f.n;
    vImg.alt = f.alt;
    vImg.width = f.ancho; vImg.height = f.alto;
    vImg.style.maxWidth = f.ancho + 'px';            // nunca más grande que la foto
    if (gran !== peq) {
      const grande = new Image();
      grande.onload = () => { if (vImg.dataset.nombre === f.n) vImg.src = grande.src; };
      grande.src = `img/fotos/${f.n}-${gran}.jpg`;
    }
    vPie.textContent = f.pie;
    vN.textContent = (actualV + 1) + ' / ' + lista.length;
  }
  function abrirVisor(nombres, nombre, desde) {
    if (!visor || typeof visor.showModal !== 'function') return;
    const vistos = new Set();
    lista = [];
    (nombres || []).forEach((n) => { if (!n || vistos.has(n)) return; vistos.add(n); lista.push(infoFoto(n)); });
    if (!lista.length) return;
    let i = lista.findIndex((f) => f.n === nombre);
    if (i < 0) i = 0;
    origen = desde || document.activeElement;
    poner(i);
    if (!visor.open) visor.showModal();
  }
  M.visor = { abrir: (l, n) => abrirVisor(l, n) };
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || deModulo(e.target)) return;
    const b = e.target.closest('[data-visor]');
    if (!b) return;
    const g = b.getAttribute('data-grupo');
    const botones = g ? $$('[data-visor][data-grupo="' + g + '"]') : [b];
    abrirVisor(botones.map((x) => x.dataset.visor), b.dataset.visor, b);
  });
  if (visor) {
    $('#visor-ant').addEventListener('click', () => poner(actualV - 1));
    $('#visor-sig').addEventListener('click', () => poner(actualV + 1));
    $('#visor-cerrar').addEventListener('click', () => visor.close());
    visor.addEventListener('click', (e) => { if (e.target === visor || e.target.classList.contains('visor__fig')) visor.close(); });
    visor.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') poner(actualV - 1); else if (e.key === 'ArrowRight') poner(actualV + 1); });
    visor.addEventListener('close', () => { if (origen && document.contains(origen)) origen.focus({ preventScroll: true }); });
  }

  /* ============ 11. el foco del teclado: contorno redondeado + las tres copas del logo en la esquina ============ */
  const marco = $('#foco-copas');
  const marcoPath = marco && marco.querySelector('.foco-copas__marco');
  const copas = marco ? $$('circle', marco) : [];
  let enfocado = null;
  function ponerMarco() {
    if (!marco) return;
    const el = enfocado;
    if (!el || !document.contains(el) || el.closest('dialog')) { marco.classList.remove('es-visible'); return; }
    const r = el.getBoundingClientRect();
    if (!r.width) { marco.classList.remove('es-visible'); return; }
    const fijo = !!el.closest('.cab, .cookies, .mando, .menu-movil, .saltar');
    const m = 6, w = Math.round(r.width + 2 * m), h = Math.round(r.height + 2 * m);
    const rad = Math.min(16, h / 2);
    marco.classList.toggle('es-fijo', fijo);
    marco.style.left = (r.left - m + (fijo ? 0 : scrollX)) + 'px';
    marco.style.top = (r.top - m + (fijo ? 0 : scrollY)) + 'px';
    marco.style.width = w + 'px'; marco.style.height = h + 'px';
    marco.setAttribute('viewBox', `0 0 ${w} ${h}`);
    marcoPath.setAttribute('d', `M${rad} 1H${w - rad}A${rad - 1} ${rad - 1} 0 0 1 ${w - 1} ${rad}V${h - rad}A${rad - 1} ${rad - 1} 0 0 1 ${w - rad} ${h - 1}H${rad}A${rad - 1} ${rad - 1} 0 0 1 1 ${h - rad}V${rad}A${rad - 1} ${rad - 1} 0 0 1 ${rad} 1Z`);
    // las tres copas, sobre la esquina de arriba a la derecha, como en el logo (la grande en medio)
    const cx = w - 14, cy = 0;
    [[cx - 9, cy + 2], [cx, cy - 3], [cx + 8, cy + 3]].forEach(([x, y], i) => { copas[i].setAttribute('cx', x); copas[i].setAttribute('cy', y); });
    const cs = getComputedStyle(el);
    marco.style.color = cs.getPropertyValue('--foco').trim() || '#215A37';
    marco.style.setProperty('--foco-fondo', el.closest('#lugar, .visor') ? '#0E1C14' : (getComputedStyle(raiz).getPropertyValue('--fondo-pagina').trim() || '#EDF2EC'));
    marco.classList.add('es-visible');
  }
  let tFoco = 0;
  const mirarFoco = () => {
    clearTimeout(tFoco);
    tFoco = setTimeout(() => {
      const el = document.activeElement;
      let visible = false;
      try { visible = !!el && el !== document.body && el.matches(':focus-visible'); } catch (er) { /* navegador viejo */ }
      enfocado = visible ? el : null;
      ponerMarco();
    }, 0);
  };
  document.addEventListener('focusin', mirarFoco);
  document.addEventListener('focusout', mirarFoco);

  /* ============ 12. el pie: el logo se completa al llegar (con movimiento reducido ya está completo) ============ */
  // se mira en cada scroll (no con IntersectionObserver): si se salta al final de golpe (un enlace, la tecla Fin), el
  // logo pasa de abajo a arriba sin cruzar la pantalla y el observador no avisaría nunca
  const pieLogo = $('.pie__simbolo');
  if (pieLogo && !motion) pieLogo.classList.add('es-completo');
  const mirarPie = () => { if (pieLogo && !pieLogo.classList.contains('es-completo') && pieLogo.getBoundingClientRect().top < altoVista * 0.88) pieLogo.classList.add('es-completo'); };

  /* ============ 13. el fondo que baja (contenido: con movimiento reducido cambia igual, sin transición) ============ */
  const tramos = $$('main > section[data-tramo]');
  function pintarTramo() {
    const y = altoVista * 0.5;
    let t = 'monte';
    for (const s of tramos) { const r = s.getBoundingClientRect(); if (r.top <= y) t = s.dataset.tramo; }
    const pie = $('#pie'); if (pie && pie.getBoundingClientRect().top <= y) t = 'agua';
    if (raiz.dataset.tramo !== t) raiz.dataset.tramo = t;
  }

  /* ============ 14. el medidor de altura: de la cota de la finca (data/lugar.json) a 0 m al llegar a reservar ============ */
  const medidor = $('#medidor');
  const medN = $('#medidor-n');
  let cota = medidor ? (parseFloat(medidor.dataset.cota) || 41) : 41;
  let tMed = 0;
  if (medidor) {
    medidor.hidden = false;
    fetch('data/lugar.json').then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && Number.isFinite(j.cotaFinca)) { cota = j.cotaFinca; pintarMedidor(); } }).catch(() => {});
  }
  // se esconde sobre la portada (la foto ya dice dónde estás), en el 3D, en el buscador y el mapa, y en el pie
  const ESCONDE = ['#portada', '#lugar', '#reservar', '#contacto', '#pie'];
  function pintarMedidor(desdeScroll) {
    if (!medidor) return;
    // la bajada empieza al dejar la portada (aparece marcando la cota) y acaba al llegar a Reservar (0 m)
    const ini = $('#quedarse'), fin = $('#reservar');
    const iniY = ini ? ini.getBoundingClientRect().top + scrollY - altoVista * 0.5 : 0;
    const finY = fin ? fin.getBoundingClientRect().top + scrollY - altoVista * 0.5 : 1;
    const p = Math.max(0, Math.min(1, (scrollY - iniY) / Math.max(1, finY - iniY)));
    const alt = Math.round(cota * (1 - p));
    medN.textContent = alt;
    medidor.style.setProperty('--bajada', p.toFixed(4));
    const y = altoVista * 0.5;
    let tapa = ESCONDE.some((s) => { const el = $(s); if (!el) return false; const r = el.getBoundingClientRect(); return r.top <= y && r.bottom > y; });
    const movil = innerWidth < 1100;
    if (movil) {
      const por = $('#portada');
      if (por && por.getBoundingClientRect().bottom > altoVista * 0.6) tapa = true;   // no tapa «Ver fechas»
      if (document.body.classList.contains('menu') || !ck.hidden) tapa = true;
      // en móvil y tableta acompaña SOLO mientras se baja: se aparta 1,2 s después de parar
      if (tapa) { clearTimeout(tMed); medidor.classList.add('es-oculto'); return; }
      if (desdeScroll) { medidor.classList.remove('es-oculto'); clearTimeout(tMed); tMed = setTimeout(() => medidor.classList.add('es-oculto'), 1200); }
      return;
    }
    medidor.classList.toggle('es-oculto', tapa);
  }

  /* ============ 15. con el scroll (un rAF por fotograma, pasivo): cabecera, tramo, medidor, módulos y foco fijo ============ */
  let pend = 0;
  function alScroll() {
    pend = 0;
    pintarCabecera();
    pintarTramo();
    pintarMedidor(true);
    mirarPie();
    reintentar();
    if (enfocado && marco.classList.contains('es-fijo')) ponerMarco();
  }
  addEventListener('scroll', () => { if (!pend) pend = requestAnimationFrame(alScroll); }, { passive: true });
  pintarCabecera(); pintarTramo(); pintarMedidor(false);
  if (innerWidth < 1100 && medidor) medidor.classList.add('es-oculto');

  /* ============ 16. MANDO DE MAQUETA (no viaja al cliente) ============ */
  if (mando && raiz.classList.contains('revision')) {
    const botones = $$('button[data-densidad]', mando);
    const pintarMando = () => botones.forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.densidad === 'sobria') === sobria())));
    botones.forEach((b) => b.addEventListener('click', () => {
      const antes = sobria();
      raiz.classList.toggle('densidad-sobria', b.dataset.densidad === 'sobria');
      const u = new URL(location.href);
      if (b.dataset.densidad === 'sobria') u.searchParams.set('densidad', 'sobria'); else u.searchParams.delete('densidad');
      history.replaceState(null, '', u);
      pintarMando();
      if (antes === sobria()) return;
      remontarTodos();
      document.dispatchEvent(new CustomEvent('montemar:densidad', { detail: sobria() ? 'sobria' : 'monte' }));
    }));
    pintarMando();
    verMando();
  }
  /* fin del MANDO DE MAQUETA */

  /* ============ 17. resize de verdad (no el de la barra del móvil) ============ */
  let tRes = 0;
  addEventListener('resize', () => {
    if (esBarra()) return;
    clearTimeout(tRes);
    tRes = setTimeout(() => {
      anchoVista = innerWidth; altoVista = innerHeight;
      document.dispatchEvent(new CustomEvent('montemar:resize'));
      alScroll();
      ponerMarco();
    }, 200);
  });

  // recargar a media página: se entra arriba (checklist 12)
  addEventListener('pageshow', () => { if (!location.hash && scrollY > 0) scrollTo(0, 0); });

  // lo que pueden usar los módulos y las pruebas
  M.web = { motion, quieto, sobria, irA, montados, get altoVista() { return altoVista; }, get cota() { return cota; } };
  document.dispatchEvent(new CustomEvent('montemar:web'));
})();
