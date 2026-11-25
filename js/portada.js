/* =====================================================================
   Montemar · portada.js: «Del monte al mar». Contrato: Montemar.portada.montar(el, { movimiento, densidad, webgl })
   → { destruir() }. El HTML de el ([data-modulo="portada"]) ya es la portada entera (respaldo: sin JS, con movimiento
   reducido y en la versión sobria se ve igual, quieta).
   - Contenido (siempre): ajusta el cuerpo de «Montemar» a su caja de cielo (ancho del titular, tope de alto).
   - Movimiento (solo con movimiento y en la versión cargada):
       · al bajar, las capas se separan: la palabra se hunde detrás de los olivos y del horizonte, los olivos se
         acercan (escala desde abajo) y el cielo apenas se mueve;
       · gesto propio (§5 bis): arrastrar en horizontal (dedo o ratón) es asomarse entre los olivos: los de delante se
         mueven más que la palabra y el cielo no se mueve. Al soltar vuelve con un muelle. touch-action: pan-y, así el
         scroll vertical sigue siendo de la página. Con ratón, sin pulsar, la escena sigue un poco al cursor.
   - El bucle solo corre con la portada en pantalla y mientras algo se mueve.
   ===================================================================== */
(function () {
  'use strict';
  const M = (window.Montemar = window.Montemar || {});

  M.portada = {
    montar(el, op) {
      op = op || {};
      const foto = el.querySelector('.portada__foto');
      const cielo = el.querySelector('.portada__cielo');
      const olivos = el.querySelector('.portada__olivos');
      const tit = el.querySelector('.portada__titulo');
      const pal = el.querySelector('.portada__palabra');
      if (!foto || !cielo || !olivos || !tit || !pal) return { destruir() {} };
      el.dataset.montado = '1';
      const limpiar = [];
      let pedir = () => {};

      /* ---------- 1. el titular a su caja (contenido) ---------- */
      function ajustar() {
        pal.style.fontSize = '';
        const ancho = tit.clientWidth;
        const natural = pal.scrollWidth;
        if (!ancho || !natural) return;
        const actual = parseFloat(getComputedStyle(pal).fontSize) || 100;
        const tope = foto.clientHeight * 0.36;          // que no pase del cielo libre
        pal.style.fontSize = Math.min(actual * ancho / natural, tope).toFixed(1) + 'px';
      }
      ajustar();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajustar);
      let anchoVisto = foto.clientWidth;
      const ro = 'ResizeObserver' in window ? new ResizeObserver(() => { if (Math.abs(foto.clientWidth - anchoVisto) < 2) return; anchoVisto = foto.clientWidth; ajustar(); pedir(); }) : null;
      if (ro) { ro.observe(foto); limpiar.push(() => ro.disconnect()); }

      if (!op.movimiento) {
        return { destruir() { limpiar.forEach((f) => f()); pal.style.fontSize = ''; delete el.dataset.montado; } };
      }

      /* ---------- 2. capas que se separan al bajar + asomarse ---------- */
      let visible = true, raf = 0;
      let dx = 0, vx = 0, objetivo = 0;               // desplazamiento horizontal (px) del gesto, con muelle
      let arrastrando = false, x0 = 0, y0 = 0, dx0 = 0, decidido = null, idPuntero = null;
      let ratonX = 0;                                 // -1..1 con el ratón encima, sin pulsar
      const TOPE = () => Math.min(28, foto.clientWidth * 0.022);

      function pintar() {
        raf = 0;
        const H = foto.clientHeight || 1;
        const p = Math.max(0, Math.min(1, scrollY / (H * 0.9)));
        // muelle del gesto
        if (!arrastrando) {
          const meta = objetivo + ratonX * TOPE() * 0.45;
          const f = (meta - dx) * 0.12;
          vx = (vx + f) * 0.78;
          dx += vx;
        }
        const t = TOPE();
        const k = Math.max(-1, Math.min(1, dx / t));
        // olivos: se acercan al bajar (escala desde abajo) y se mueven del todo con el gesto (escala extra para no
        // descubrir los bordes)
        const sO = 1 + p * 0.075 + Math.abs(k) * 0.035;
        olivos.style.transform = `translate3d(${(k * t).toFixed(2)}px,0,0) scale(${sO.toFixed(4)})`;
        olivos.style.transformOrigin = '50% 100%';
        // la palabra: se hunde hacia el horizonte (por detrás de los olivos) y sigue el gesto a medias
        tit.style.transform = `translate3d(${(k * t * 0.42).toFixed(2)}px,${(p * H * 0.34).toFixed(2)}px,0)`;
        // el cielo: casi quieto
        cielo.style.transform = `scale(${(1 + p * 0.02).toFixed(4)})`;
        cielo.style.transformOrigin = '50% 60%';
        const quieto = !arrastrando && Math.abs(vx) < 0.02 && Math.abs(objetivo + ratonX * TOPE() * 0.45 - dx) < 0.05;
        if (!quieto && visible) raf = requestAnimationFrame(pintar);
      }
      pedir = () => { if (!raf && visible) raf = requestAnimationFrame(pintar); };

      const alScroll = () => pedir();
      addEventListener('scroll', alScroll, { passive: true });
      limpiar.push(() => removeEventListener('scroll', alScroll));
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) pedir(); }, { rootMargin: '80px 0px' });
        io.observe(el);
        limpiar.push(() => io.disconnect());
      }

      // el gesto: Pointer Events; se decide en los primeros 8 px si es horizontal (gesto) o vertical (scroll de la página)
      const abajo = (e) => {
        if (e.button > 0 || arrastrando) return;
        idPuntero = e.pointerId; x0 = e.clientX; y0 = e.clientY; dx0 = dx; decidido = null;
      };
      const mueve = (e) => {
        if (e.pointerType === 'mouse' && idPuntero === null) {
          const r = foto.getBoundingClientRect();
          ratonX = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
          pedir();
          return;
        }
        if (e.pointerId !== idPuntero) return;
        const mx = e.clientX - x0, my = e.clientY - y0;
        if (decidido === null && Math.hypot(mx, my) > 8) {
          decidido = Math.abs(mx) > Math.abs(my) * 1.2 ? 'x' : 'y';
          if (decidido === 'x') { arrastrando = true; try { el.setPointerCapture(e.pointerId); } catch (er) { /* sin captura */ } el.classList.add('es-asomado'); }
        }
        if (!arrastrando) return;
        const t = TOPE();
        // resistencia: cuesta más cuanto más lejos (como tirar de una rama)
        const libre = dx0 + mx * 0.35;
        dx = Math.sign(libre) * t * (1 - Math.exp(-Math.abs(libre) / t));
        vx = 0;
        pedir();
      };
      const suelta = (e) => {
        if (e.pointerId !== idPuntero) return;
        idPuntero = null;
        if (arrastrando) { arrastrando = false; objetivo = 0; el.classList.remove('es-asomado'); pedir(); }
      };
      const fuera = (e) => { if (e.pointerType === 'mouse') { ratonX = 0; pedir(); } };
      const sinArrastre = (e) => e.preventDefault();   // las fotos no se arrastran como imagen (se cortaría el gesto)
      el.addEventListener('dragstart', sinArrastre);
      el.addEventListener('pointerdown', abajo);
      el.addEventListener('pointermove', mueve);
      el.addEventListener('pointerup', suelta);
      el.addEventListener('pointercancel', suelta);
      el.addEventListener('pointerleave', fuera);
      limpiar.push(() => {
        el.removeEventListener('pointerdown', abajo); el.removeEventListener('pointermove', mueve); el.removeEventListener('pointerup', suelta);
        el.removeEventListener('pointercancel', suelta); el.removeEventListener('pointerleave', fuera); el.removeEventListener('dragstart', sinArrastre);
      });
      pedir();

      const inst = {
        destruir() {
          limpiar.forEach((f) => f());
          if (raf) cancelAnimationFrame(raf);
          [olivos, tit, cielo].forEach((n) => { n.style.transform = ''; n.style.transformOrigin = ''; });
          pal.style.fontSize = '';
          delete el.dataset.montado;
        },
        // para las pruebas: el desplazamiento actual del gesto
        get gesto() { return dx; },
      };
      return inst;
    },
  };
})();
