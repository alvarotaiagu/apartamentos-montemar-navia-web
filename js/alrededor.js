/* ------------------------------------------------------------------
   Montemar · alrededor.js · el mapa de «Alrededor»
   La lista de sitios (con sus cifras de OSRM, que pone construir.mjs) es el mando: al pulsar uno, el mapa vuela hasta
   él y la ruta se dibuja desde la casa. A la playa y a Navia, la ruta que se dibuja es la de a pie (la de coche queda
   en discontinua); al resto, la de coche. Una ficha da tiempo, distancia, carreteras y el enlace a Google Maps.
   Datos: data/alrededor-mapa.json (scripts/alrededor-mapa.mjs): metros alrededor de la casa, x al este, y al sur.
   Contrato de main.js: Montemar.alrededor.montar(el, { movimiento, densidad, webgl }) → { destruir(), listo }.
   El respaldo es la propia lista: si algo falla, main.js la repone y pone «sin-modulo» (vuelve la maqueta sin mapa).
   Receta de ../amaicha-ribadesella-web/js/alrededor.js.
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  var M = window.Montemar = window.Montemar || {};
  var NS = 'http://www.w3.org/2000/svg';

  function svg(tag, at, padre) {
    var n = document.createElementNS(NS, tag);
    for (var k in at) n.setAttribute(k, at[k]);
    if (padre) padre.appendChild(n);
    return n;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function lista(xs) { return xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1]; }
  var suave = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  M.alrededor = {
    montar: function (el, op) {
      var movimiento = !!(op && op.movimiento);
      var hueco = el.querySelector('.alr__mapa');
      var lis = [].slice.call(el.querySelectorAll('.alr__lista li[data-ruta]'));
      if (!hueco || !lis.length) return { destruir: function () {} };

      var vivo = true, datos = null, W = 0, H = 0, vb = null, vuelo = 0, sel = null, primera = true, espera = 0;
      var limpiar = [];
      function on(t, ev, fn, o) { t.addEventListener(ev, fn, o); limpiar.push(function () { t.removeEventListener(ev, fn, o); }); }
      function liDe(id) { return lis.filter(function (l) { return l.dataset.ruta === id; })[0]; }
      function nombreDe(id) { return liDe(id).querySelector('b').textContent; }
      function aPie(id) { return liDe(id).classList.contains('cerca__item'); }

      /* ---------- la lista se vuelve mando ---------- */
      var botones = {};
      lis.forEach(function (li) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'alr__btn'; b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-controls', 'alr-lienzo');
        while (li.firstChild) b.appendChild(li.firstChild);
        li.appendChild(b);
        botones[li.dataset.ruta] = b;
        on(b, 'click', function () { elegir(li.dataset.ruta, true); });
        on(b, 'pointerenter', function (e) { if (e.pointerType === 'mouse') vista(li.dataset.ruta, true); });
        on(b, 'pointerleave', function () { vista(li.dataset.ruta, false); });
        on(b, 'focus', function () { vista(li.dataset.ruta, true); });
        on(b, 'blur', function () { vista(li.dataset.ruta, false); });
      });

      /* ---------- el lienzo ---------- */
      hueco.innerHTML =
        '<div class="amapa__lienzo" id="alr-lienzo">' +
          '<svg class="amapa__svg" role="img" aria-label="Mapa de los alrededores de Montemar" preserveAspectRatio="none"></svg>' +
          '<ol class="amapa__marcas" aria-hidden="true"></ol>' +
          '<p class="amapa__escala cifra" aria-hidden="true"><i></i><span></span></p>' +
        '</div>' +
        '<div class="amapa__ficha" aria-live="polite"></div>' +
        '<p class="amapa__fuente">Mapa: © colaboradores de OpenStreetMap (ODbL). Rutas: OSRM y routing.openstreetmap.de.</p>';
      var lienzo = hueco.querySelector('.amapa__lienzo'), raiz = hueco.querySelector('svg'), marcas = hueco.querySelector('.amapa__marcas');
      var ficha = hueco.querySelector('.amapa__ficha'), escala = hueco.querySelector('.amapa__escala');
      el.classList.add('con-mapa');
      el.dataset.montado = '';

      var capas = {}, rutasSvg = {}, selPpal, selCasco, selOtra, marcasPorId = {}, rotulosExtra = [];

      function pintar(d) {
        var gMar = svg('g', { class: 'm-mar' }, raiz);
        d.niveles.forEach(function (n) {
          var g = svg('g', { class: 'm-nivel', 'data-nivel': n.nombre }, gMar);
          svg('path', { d: n.d, class: 'm-agua' }, g);
          n.islas.forEach(function (i) { svg('path', { d: i, class: 'm-isla' }, g); });
          svg('path', { d: n.costa, class: 'm-costa' }, g);
          if (n.nombre === 'cerca') {                     // las playas y el callejero solo existen en la vista de cerca
            if (d.playas) svg('path', { d: d.playas, class: 'm-playa' }, g);
            if (d.calles && d.calles.b) svg('path', { d: d.calles.b, class: 'm-calle' }, g);
            if (d.calles && d.calles.a) svg('path', { d: d.calles.a, class: 'm-calle m-calle--a' }, g);
          }
          capas[n.nombre] = { g: g, n: n };
        });
        if (d.embalses) svg('path', { d: d.embalses, class: 'm-embalse' }, raiz);
        if (d.rios) svg('path', { d: d.rios, class: 'm-rio' }, raiz);
        var gR = svg('g', { class: 'm-rutas' }, raiz);
        Object.keys(d.rutas).forEach(function (id) {
          rutasSvg[id] = svg('path', { d: d.rutas[id].coche, class: 'm-ruta' }, gR);
        });
        selOtra = svg('path', { class: 'm-sel-otra' }, raiz);
        selCasco = svg('path', { class: 'm-sel-casco', pathLength: 1 }, raiz);
        selPpal = svg('path', { class: 'm-sel', pathLength: 1 }, raiz);

        // marcas en HTML encima (tamaño fijo en pantalla aunque el mapa se acerque)
        function marca(cls, x, y, txt, id) {
          var li = document.createElement('li');
          li.className = 'amapa__marca ' + cls; li.dataset.x = x; li.dataset.y = y;
          li.innerHTML = '<span>' + esc(txt) + '</span>';
          if (id) li.dataset.ruta = id;
          marcas.appendChild(li);
          return li;
        }
        (d.rotulos || []).forEach(function (r) { rotulosExtra.push({ li: marca('amapa__marca--agua', r.x, r.y, r.nombre), min: r.min }); });
        (d.ciudades || []).forEach(function (c) { rotulosExtra.push({ li: marca('amapa__marca--ciudad', c.x, c.y, c.nombre), min: 45000 }); });
        lis.forEach(function (li) {
          var r = d.rutas[li.dataset.ruta]; if (!r) return;
          marcasPorId[li.dataset.ruta] = marca('amapa__marca--sitio', r.x, r.y, nombreDe(li.dataset.ruta), li.dataset.ruta);
        });
        marca('amapa__marca--casa', 0, 0, 'Montemar');
      }

      /* ---------- encuadre ---------- */
      function medir() {
        var r = lienzo.getBoundingClientRect();
        W = Math.max(1, r.width); H = Math.max(1, r.height);
      }
      function fichaArriba() {       // en escritorio la ficha va encima del mapa, arriba a la izquierda (sobre el mar)
        if (getComputedStyle(ficha).position !== 'absolute') return 0;
        return Math.min(.45, (ficha.offsetHeight + 24) / H);
      }
      function encuadre(id) {
        var c = datos.rutas[id].caja;
        var cx = (c[0] + c[2]) / 2, cy = (c[1] + c[3]) / 2;
        var pw = Math.max(c[2] - c[0], 1400) * 1.3, ph = Math.max(c[3] - c[1], 1400) * 1.3;
        var m = fichaArriba(), asp = W / (H * (1 - m));
        if (pw / ph > asp) ph = pw / asp; else pw = ph * asp;
        var h = ph / (1 - m);
        return { cx: cx, cy: cy - (m * h) / 2, w: pw };
      }
      var PASOS = [100, 200, 500, 1000, 2000, 5000, 10000, 20000];
      function pintarEscala(w) {      // escala gráfica: el tramo redondo que ocupe unos 90 px
        var mpp = w / W, paso = PASOS[0];
        PASOS.forEach(function (p) { if (p / mpp <= 110) paso = p; });
        escala.firstChild.style.width = (paso / mpp).toFixed(1) + 'px';
        escala.lastChild.textContent = paso < 1000 ? paso + ' m' : (paso / 1000) + ' km';
      }
      function aplicar(v) {
        vb = v;
        var w = v.w, h = w * H / W, x = v.cx - w / 2, y = v.cy - h / 2;
        raiz.setAttribute('viewBox', x + ' ' + y + ' ' + w + ' ' + h);
        raiz.style.setProperty('--px', w / W);
        // nivel de detalle de la costa: el más fino que cubra la vista por el oeste, el este y el sur. Por el norte no
        // hace falta: ahí solo hay mar, y el polígono del mar de cada nivel sube 300 km (scripts/alrededor-mapa.mjs)
        var elegido = null;
        datos.niveles.forEach(function (n) {
          var k = n.caja; // [x0, y0, x1, y1]
          if (!elegido && w <= n.ancho_max && x >= k[0] && x + w <= k[2] && y + h <= k[3]) elegido = n.nombre;
        });
        if (!elegido) elegido = datos.niveles[datos.niveles.length - 1].nombre;
        for (var k in capas) capas[k].g.style.display = k === elegido ? '' : 'none';
        // marcas
        [].forEach.call(marcas.children, function (li) {
          var px = (li.dataset.x - x) / w * W, py = (li.dataset.y - y) / h * H;
          li.style.transform = 'translate(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px)';
          li.classList.toggle('fuera', px < 6 || px > W - 6 || py < 6 || py > H - 6);
          li.classList.toggle('a-la-izq', px > W * .72);
        });
        rotulosExtra.forEach(function (r) { r.li.classList.toggle('oculta', w < r.min); });
        pintarEscala(w);
      }
      function volar(hasta, animar) {
        cancelAnimationFrame(vuelo);
        if (!animar || !vb) { aplicar(hasta); return; }
        var de = vb, t0 = performance.now(), dur = 1100;
        var lw0 = Math.log(de.w), lw1 = Math.log(hasta.w);
        (function paso(t) {
          if (!vivo) return;
          var k = suave(Math.min(1, (t - t0) / dur));
          aplicar({ cx: de.cx + (hasta.cx - de.cx) * k, cy: de.cy + (hasta.cy - de.cy) * k, w: Math.exp(lw0 + (lw1 - lw0) * k) });
          if (k < 1) vuelo = requestAnimationFrame(paso);
        })(t0);
      }

      /* ---------- elegir un sitio ---------- */
      function vista(id, si) { if (rutasSvg[id]) rutasSvg[id].classList.toggle('es-vista', si && id !== sel); }
      function rellenarFicha(id) {
        var li = liDe(id), b = botones[id], pie = aPie(id);
        var rumbo = li.closest('.rumbo');
        var grupo = rumbo ? rumbo.querySelector('.rumbo__tit').firstChild.textContent.trim() : 'A pie desde la casa';
        var carr = (li.dataset.carreteras || '').split(' · ').filter(Boolean).map(function (c) { return 'la ' + c; });
        var min = b.querySelector('.cerca__min, .rumbo__min'), km = b.querySelector('.cerca__km, .rumbo__km');
        var casa = datos.casa;
        var url = 'https://www.google.com/maps/dir/?api=1&origin=' + casa.lat + ',' + casa.lon + '&destination=' + li.dataset.lat + ',' + li.dataset.lon + '&travelmode=' + (pie ? 'walking' : 'driving');
        ficha.innerHTML =
          '<p class="ficha__grupo">' + esc(grupo) + '</p>' +
          '<h3 class="ficha__tit">' + esc(nombreDe(id)) + '</h3>' +
          (min ? '<p class="ficha__min cifra">' + esc(min.textContent.trim()) + '</p>' : '') +
          (km ? '<p class="ficha__km cifra">' + esc(km.textContent.trim()) + (pie ? '' : ' en coche') + '</p>' : '') +
          (pie && li.dataset.coche ? '<p class="ficha__por">En coche, <span class="cifra">' + esc(li.dataset.coche) + '</span></p>' : '') +
          (!pie && carr.length ? '<p class="ficha__por">Por ' + esc(lista(carr)) + '</p>' : '') +
          (li.dataset.lat ? '<a class="ficha__ir" href="' + url + '" target="_blank" rel="noopener">Abrir la ruta en Google Maps<span aria-hidden="true"> ↗</span></a>' : '');
      }
      function elegir(id, animar) {
        if (!datos || !datos.rutas[id]) return;
        var cambia = sel !== id;
        sel = id;
        Object.keys(botones).forEach(function (k) { botones[k].setAttribute('aria-pressed', String(k === id)); });
        Object.keys(rutasSvg).forEach(function (k) { rutasSvg[k].classList.remove('es-vista'); rutasSvg[k].classList.toggle('es-elegida', k === id); });
        Object.keys(marcasPorId).forEach(function (k) { marcasPorId[k].classList.toggle('es-elegida', k === id); });
        rellenarFicha(id);
        var r = datos.rutas[id], pie = aPie(id) && !!r.pie;
        raiz.setAttribute('aria-label', 'Mapa: ruta ' + (pie ? 'a pie ' : 'en coche ') + 'de Montemar a ' + nombreDe(id));
        raiz.classList.toggle('es-a-pie', pie);
        selPpal.setAttribute('d', pie ? r.pie : r.coche); selCasco.setAttribute('d', pie ? r.pie : r.coche);
        selOtra.setAttribute('d', pie ? r.coche : ''); selOtra.classList.remove('se-ve');
        volar(encuadre(id), animar && movimiento);
        if (!cambia && !primera) return;
        primera = false;
        clearTimeout(espera);
        if (movimiento && animar) {
          [selPpal, selCasco].forEach(function (p) {
            p.getAnimations && p.getAnimations().forEach(function (a) { a.cancel(); });
            p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1500, delay: 350, easing: 'cubic-bezier(.55,0,.25,1)', fill: 'both' });
          });
          if (pie) espera = setTimeout(function () { if (vivo && sel === id) selOtra.classList.add('se-ve'); }, 1500);
        } else if (pie) selOtra.classList.add('se-ve');
      }

      /* ---------- datos y arranque ---------- */
      var listo = fetch('data/alrededor-mapa.json', { cache: 'no-cache' })
        .then(function (r) { if (!r.ok) throw new Error('alrededor-mapa.json ' + r.status); return r.json(); })
        .then(function (d) {
          if (!vivo) return;
          datos = d;
          pintar(d);
          medir();
          var primero = lis[0].dataset.ruta;
          // la primera ruta se dibuja cuando el mapa entra en pantalla
          if ('IntersectionObserver' in window && movimiento) {
            elegir(primero, false);
            selPpal.style.strokeDashoffset = selCasco.style.strokeDashoffset = 1;
            var io = new IntersectionObserver(function (es) {
              if (!es[0].isIntersecting) return;
              io.disconnect();
              selPpal.style.strokeDashoffset = selCasco.style.strokeDashoffset = '';
              primera = true; elegir(sel, true);
            }, { threshold: .35 });
            io.observe(lienzo);
            limpiar.push(function () { io.disconnect(); });
          } else elegir(primero, false);
          if ('ResizeObserver' in window) {
            var anchoAntes = W, altoAntes = H;
            var ro = new ResizeObserver(function () {
              medir();
              if (Math.abs(W - anchoAntes) < 1 && Math.abs(H - altoAntes) < 1) return;
              anchoAntes = W; altoAntes = H;
              if (sel) volar(encuadre(sel), false);
            });
            ro.observe(lienzo);
            limpiar.push(function () { ro.disconnect(); });
          }
          // las marcas de los sitios también eligen
          on(marcas, 'click', function (e) { var li = e.target.closest('[data-ruta]'); if (li) elegir(li.dataset.ruta, true); });
          lienzo.dataset.listo = '';
        })
        .catch(function (er) { el.classList.remove('con-mapa'); throw er; });   // main.js repone la lista

      return {
        listo: listo,
        destruir: function () {
          vivo = false;
          cancelAnimationFrame(vuelo);
          clearTimeout(espera);
          limpiar.forEach(function (f) { f(); });
          el.classList.remove('con-mapa');
          delete el.dataset.montado;
        }
      };
    }
  };
})();
