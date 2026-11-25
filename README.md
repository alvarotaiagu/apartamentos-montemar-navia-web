# Montemar · «Del monte al mar»

Propuesta de web para **Apartamentos Montemar** (Camino Montemar, s/n, 33710 Navia, Asturias): cuatro apartamentos y
un chalet de piedra en una finca de olivos sobre la desembocadura de la ría de Navia. Tienen web (monte-mar.es) y no han
encargado esta. Una sola página (`index.html`) más legales y 404. **En local, sin publicar y sin commits.**
`noindex, nofollow` en todas las páginas. Solo castellano.

Datos: `ref/DATOS-MONTEMAR.md` (lo que no está ahí va a [`PENDIENTES.md`](PENDIENTES.md) o se marca «por confirmar»).
Encargo: [`ENCARGO.md`](ENCARGO.md). El 3D («La ría, ahora») es del agente Lugar 3D: sus notas, en [`LUGAR.md`](LUGAR.md).

## El concepto

**Su logo hecho paisaje.** El logo son tres olivos de copa redonda sobre una loma marrón y una ola azul: monte arriba,
mar abajo. La portada es su panorámica real de los olivos (`slider1.jpg`, 1780×800) **en capas**: atrás el cielo (con los
olivos borrados), en medio «Montemar» gigante, delante los olivos recortados y todo lo que queda por debajo del
horizonte (montes, ría, mar, pradera). La loma y la ola del logo cierran la portada por abajo. Al bajar, la palabra se
hunde detrás de los olivos y los olivos se acercan; arrastrando en horizontal (dedo o ratón) te asomas entre ellos.

**La web entera baja como el logo**: olivos y finca → la casa → la ría (3D) → la playa y alrededor → reservar. El fondo de
la página acompaña con mesura (verde muy claro en la finca, tierra en la casa, agua al llegar al mar) y un **medidor de
altura** discreto baja con el scroll desde la cota de la finca (`data/lugar.json`, `cotaFinca`: 54 m del MDT05 del IGN;
sin el fichero, 41) hasta 0 m al llegar a Reservar. **El pie completa el logo**: los troncos suben desde la loma y las
copas crecen, primero las de los lados y luego la grande.

Lectura de diseño (skill `design-taste-frontend`): web de alojamiento premium para quien decide y reserva, con el
lenguaje de su propio logo; moderna y luminosa; dials 7 / 6 / 3. Tema claro con una sola sección oscura deliberada
(`#lugar`, por contrato con el 3D); sin modo oscuro (como sus hermanas). Radios: 14 px en fotos y cajas, píldora en
botones, como el contorno redondo de las copas.

### Las letras (Google Fonts, `display=swap`, tres y ninguna más)

Ninguna está en la cartera (`verificar.mjs` lo comprueba en `../*-web`):

- **Afacad** (titulares y «Montemar» de la portada): palo seco humanista, como la palabra del logo, que también es
  humanista; a 700 tiene presencia a tamaño gigante sin ser una grotesca más.
- **Fustat** (texto): neutra y muy legible en párrafos y etiquetas.
- **Noto Sans Mono** (cifras: habitaciones, minutos, km, el tiempo, el medidor, el calendario): cifras tabulares, de
  instrumento, que van con la idea de medir (altitud, viento, oleaje).

### Los colores (del logo, medidos en el PNG; contraste en `node scripts/paleta.mjs`)

| Token | Color | Uso |
|---|---|---|
| `--hoja` | `#215A37` | verde de la copa grande: **acento** (botones de reservar, marcas activas, foco) |
| `--oscuro` | `#173E29` | verde de la copa derecha: `--marca`, cifras grandes, «Montemar» |
| `--loma` | `#814429` | marrón de la loma: `--tierra` (filetes, la loma de la portada); como texto, `#7A3F25` |
| `--ola` | `#498BC8` | azul de la ola: `--agua` (superficies, filetes); como texto, `#2A659D` |
| `--tinta` | `#132219` | texto |
| fondos | `#EDF2EC` · `#F3ECE7` · `#EAF1F6` | monte · tierra · agua (el fondo que baja) |
| `--noche` | `#0E1C14` | `#lugar` |

Contrato con Lugar 3D (`css/base.css`): `--fondo`, `--superficie`, `--texto`, `--texto-suave`, `--marca`, `--acento`,
`--tierra`, `--agua`, `--linea`, `--letra-titular`, `--letra-texto`, `--letra-cifras` en `:root`; **dentro de `#lugar`
se redefinen `--fondo`, `--superficie`, `--texto`, `--texto-suave`, `--linea`, `--agua-texto` y `--foco` para fondo
oscuro** (texto `#EEF3EE` sobre `#0E1C14`, 15,6:1).

## Las secciones

1. **Portada «Del monte al mar»** (`js/portada.js`, `Montemar.portada`). Tres capas en el mismo encuadre; en escritorio
   la foto entera (2,225:1), en tableta recortada al centro a 1,6:1 y en móvil a 1:1, **con recortes propios de los
   mismos píxeles** (`img/portada/*-t*.webp`, `*-m*.webp`: nunca se amplía; a 1920 px de ancho la foto se estira 1,08×).
   El cuerpo de «Montemar» lo ajusta el JS a su caja de cielo. Debajo: la frase, «Ver fechas» y el teléfono.
2. **Dónde te quedas**: las dos fichas (apartamentos y chalet) con cifras grandes, servicios con **icono propio**
   (sprite `partes/iconos.html`, trazo 1,75 redondo) y, aparte, «Para todos, la finca» y «Incluido y condiciones».
   Los precios los da el motor.
3. **Por dentro**: índice fijo (Un apartamento / El chalet / Fuera) que marca la estancia que se ve, fotos sin marco en
   filas de la misma altura (ninguna más ancha que su original: `--max`) y el visor que abre por NOMBRE.
4. **La vista, con el tiempo de ahora** (`js/tiempo.js`): la terraza mirando a la ría y el tiempo real de Navia
   (Open-Meteo: cielo, temperatura, viento; su modelo marino: oleaje del mar abierto frente a la ría). Si falla, no sale
   ningún dato y se dice. Botón a **su cámara 24 h** en otra pestaña (va por HTTP: no se incrusta).
5. **La ría, ahora** (`#lugar`, oscura): el 3D de Lugar 3D. Respaldo de la Web: el fotograma de su webcam (sin la franja
   del rótulo) y su pie.
6. **Alrededor**: a pie (la playa y Navia, en grande) y en coche por rumbos (hacia Galicia, tierra adentro, hacia Luarca),
   **todo de OSRM** (`ref/raw/rutas.json`).
7. **Reseñas**: 4,8 sobre 5 con 78 reseñas en Google (recuento suficiente) y 9,7 sobre 10 con 92 en su motor; cinco
   copas como las del logo. Sin citas.
8. **Reservar**: buscador propio (llegada y salida con validación) que **crea** el iframe de su WuBook real al pulsar
   «Buscar en su motor». Aviso visible: «Es su motor de reservas real». Alternativa: teléfono y correo.
9. **Cómo llegar** y **pie**: dirección, teléfono, correo, el mapa de Google tras pulsar, el logo que se completa y **el
   cartel de la ayuda NextGenerationEU** (`img/difusion.jpg`, a su tamaño de 640 px, con su texto escrito al lado y
   enlace al cartel entero).

Legales (aviso legal, privacidad, cookies, accesibilidad) con el titular de DATOS (MONTEMAR - NAVIA S.L., B-74331406).
Aviso de cookies. 404 «Aquí no ha crecido nada» (la loma sin olivos).

## El motor de reservas (REAL)

**WuBook acepta las fechas por URL** (comprobado el 2026-11-25, ver DATOS):
`https://wubook.net/wbkd/wbk/?lcode=1601452661&dfrom=DD/MM/AAAA&dto=DD/MM/AAAA&lang=es`. `js/reserva.js` monta esa URL;
«Abrir su motor sin fechas» abre `?lcode=1601452661&lang=es`.

- El iframe **no existe** hasta que se pide (pone sus cookies `wbocookies` y `ord`; lo dicen el aviso y la política).
- Las personas y la unidad (apartamento o chalet) no se pasan por URL: se eligen dentro de su motor (lo dice el buscador).
- Alto del iframe: `clamp(720px, 92svh, 1040px)` en escritorio y `clamp(640px, 88svh, 900px)` en móvil.
- **Las reservas que se hagan dentro son reales.** Esto sustituye al simulador de reservas habitual.

## Fotos

De su web (`ref/origen/web/`) y de su ficha de Booking (`ref/origen/ficha/`, 1024 px como mucho). Nitidez medida en todas
(`scripts/fotos-nitidez.py` → `ref/raw/nitidez.json`: cociente de detalle 1:1 / 1:2; ≲ 0,5 = ampliada).

- **Portada: `slider1.jpg`, 1780×800, nitidez 1,22** (resolución real). Capas en `scripts/portada-capas.py`: horizonte por
  polilínea medida y afinada columna a columna; cielo rellenado con inpainting a 1/4 (liso, sin rastro); mate suave por
  distancia de color al cielo rellenado (las hojas a contraluz quedan semitransparentes, sin halo).
- `slider2` (la casa roja, 0,88) y `slider3` (amanecer, 0,69) a 1780. Interiores y terraza de la ficha a **1024 como mucho**;
  las verticales del baño y el lavabo (500×667) y el chalet por fuera (500×375) **solo pequeñas**. Las de 450 px de su
  web no se usan.
- AVIF, WebP y JPG en 480, 800, 1200, 1600 y el ancho real (si caben); nunca se amplía.

## La marca

`scripts/marca-logo.py`: el logo **redibujado**. Cada píxel se clasifica por el color más cercano de su paleta; las
copas son **círculos** ajustados al borde exterior del contorno negro (residuo 0,2-0,5 px); los troncos, rectángulos
medidos por filas; el filo de la loma, la loma, la ola y la palabra, con potrace. Salen `marca/logo.svg`,
`simbolo.svg` (sin palabra), `palabra.svg`, `suelo.svg` (para el pie) y `logo.json`. Control
(`scripts/marca.mjs` → `marca/logo-control.json`): **IoU con el PNG 0,99 en la silueta**; por color 0,80 (copa izquierda)
a 0,96 (loma). `scripts/marca.mjs` hace también los favicons e `img/og.jpg`.

## Cómo se trabaja

```
python -I -X utf8 scripts/fotos-nitidez.py ref/origen ref/origen/web ref/origen/ficha   # → ref/raw/nitidez.json
node scripts/fotos.mjs                          # img/fotos/<nombre>-<ancho>.{avif,webp,jpg} + fotos.json (nunca amplía)
python -I -X utf8 scripts/portada-capas.py      # img/portada/ (cielo, olivos con alfa y recortes de móvil y tableta)
python -I -X utf8 scripts/marca-logo.py         # marca/*.svg y logo.json
node scripts/marca.mjs                          # favicons, img/og.jpg y el control del logo
node scripts/alrededor-rutas.mjs                # distancias OSRM → ref/raw/rutas.json
node scripts/paleta.mjs                         # contraste de la paleta (WCAG y APCA)
node scripts/legales.mjs                        # *.src.html de las legales y el 404
node construir.mjs                              # partes, datos, fotos → *.html; versionar.mjs pone ?v=<huella>
node verificar.mjs                              # Playwright, puerto 8961 (sin capturas, sin pintar WebGL)
node scripts/rendimiento.mjs                    # LCP e INP en móvil de gama media, puerto 8961
```

Para verla: un servidor local en esta carpeta (p. ej. `npx serve -l 8961`) y abrir `index.html` (y
`index.html?revision` para el mando). Con `file://` no van el tiempo ni el visor.

Se edita SIEMPRE el `*.src.html` o la parte (`partes/`); el `.html` se regenera. **Una sola fuente de datos:**
`data/montemar.json` (unidades, finca, condiciones, estancias, reseñas, contacto, titular). Las distancias, solo de
`ref/raw/rutas.json`. `construir.mjs` quita los `<link>`/`<script>` de ficheros que no existen, **salvo `css/lugar.css`
y `js/lugar.js`**: esos se quedan siempre (sin ellos, la página usa el respaldo y no falla).

### Módulos

| Módulo | Agente | Hueco | Ficheros |
|---|---|---|---|
| `portada` | Web | `#portada [data-modulo="portada"]` (respaldo: las capas quietas; es el LCP) | `js/portada.js` (CSS en `css/estilos.css`) |
| `lugar` | Lugar 3D | `#lugar [data-modulo="lugar"]` (respaldo: el fotograma de su webcam y su pie) | `js/lugar.js`, `css/lugar.css`, `img/lugar/`, `data/lugar*.json`, `vendor/`, `scripts/lugar-*` → [`LUGAR.md`](LUGAR.md) |

Contrato: `Montemar.<mod>.montar(el, { movimiento, densidad, webgl })` → `{ destruir() }`. `main.js` monta la portada al
cargar y el lugar al acercarse (900 px). Eventos: `montemar:resize` (solo los resize de verdad, no la barra del móvil),
`montemar:densidad`. `Montemar.web` (movimiento, `irA`, `altoVista`, `cota`), `Montemar.reserva`, `Montemar.tiempo` y
`Montemar.visor.abrir(lista, nombre)` los pone la web. Ningún antepasado de `[data-modulo="lugar"]` lleva overflow,
transform ni filter (lo comprueba el bloque 10).

## Mando de densidades (solo con `?revision`)

`index.html?revision` enseña «Versión: **Del monte al mar** / **Sobria**» (abajo a la izquierda; se aparta mientras está
el aviso de cookies). Sin `?revision` no existe.

- **Del monte al mar** (cargada): las capas de la portada que se separan y el gesto de asomarse, el fondo que baja
  (verde, tierra, agua) y el medidor de altura.
- **Sobria**: la portada quieta, un solo fondo, sin medidor, y **añade** la tabla «De un vistazo» (apartamento y chalet
  comparados en ocho filas).

No lleva mando de paleta: es la web de un negocio real con su marca (como Amaicha y Casa Benito).

### Receta de borrado (antes de enseñársela al cliente como web suya)

1. `partes/cabeza.html`: borrar desde `// MANDO DE MAQUETA` hasta el cierre de su `if (q.has('revision')) { … }`.
2. `partes/pie.html`: borrar desde `<!-- MANDO DE MAQUETA` hasta `<!-- fin del MANDO DE MAQUETA -->`.
3. `js/main.js`: borrar el bloque `/* ===… 16. MANDO DE MAQUETA` … `/* fin del MANDO DE MAQUETA */`.
4. `css/estilos.css`: borrar desde `/* MANDO DE MAQUETA` hasta `/* fin del MANDO DE MAQUETA */`.
5. Si ya no hace falta la tabla de la sobria: quitar `.replace('<!--vistazo-->', vistazo)` y el `<!--vistazo-->`.
6. `node construir.mjs && node verificar.mjs` (el bloque 1 comprueba esta receta sobre copias en memoria).

## Lo que no se negocia (y su prueba en `verificar.mjs`)

Checklist de webs desde cero, para las piezas que lleva: menú móvil a 100dvh dentro de la cabecera con blur (bloques 1 y
9), cookies con `:not([hidden])` (1 y 7), resize de la barra del móvil que no rehace nada (9), visor por NOMBRE con ratón
y con el dedo, botones tocables en toda su altura (4 y 9), recargar a media página vuelve arriba (11), titulares que
aparecen observando el contenedor (11), portada sin pisarse a 360×640, 375×667, 390×844, 768×1024 y 1280×800 (2),
`con-movimiento` solo sin movimiento reducido (1), contraste WCAG medido sobre el fondo de cada tramo (3). Sin cursor
propio, sin pila sticky, sin marquesina, sin cortina, sin letra a letra (1).

§5 bis: **fórmula rota** (fuera cortina, pila, marquesina, cursor, letra a letra y botones magnéticos; **pieza propia**:
la portada en capas con la palabra entre el cielo y los olivos, y el medidor de altura que baja del monte al mar);
**gesto del hero** (asomarse arrastrando, con muelle y resistencia; `touch-action: pan-y`; probado con eventos táctiles
reales por CDP en el bloque 11); **el objeto se completa en el pie** (el logo crece; con movimiento reducido ya está
completo: 3 y 11); **foco con forma propia** (contorno redondeado de 2 px + las tres copas del logo en la esquina,
`#foco-copas`: 3); **rendimiento medido** (abajo). Menú §5 bis: **dato real en vivo** (el tiempo y el oleaje de ahora en
Navia; si falla, se oculta y se dice).

## Rendimiento

**Medido el 2026-11-25** con `scripts/rendimiento.mjs` (Pixel 7 emulado: 412×915, DPR 2,625, 4G lento 1,6 Mb/s y 150 ms,
CPU ×4; texto con gzip como en Pages; sin el 3D, que tiene su propio presupuesto): **LCP 1,45-1,58 s** (la capa del
cielo, `cielo-m800.webp`, en las cuatro pasadas, también con movimiento reducido), 21-24 peticiones y 410-490 KB hasta
`load`, una tarea larga de 80-107 ms al cargar, **INP aproximado 32-168 ms** (un toque en la portada y otro en el índice
de «Por dentro»). Presupuesto: LCP ≤ 2,5 s, INP ≤ 200 ms.

La portada no usa canvas (no hay DPR que topar): anima `transform` de tres capas. El bucle solo corre con la portada en
pantalla (IntersectionObserver) y solo mientras algo se mueve (se para solo cuando el muelle está quieto). Sin
librerías (ni GSAP ni Lenis). Primera medida: 2,7 s (sin recortes de móvil, cielo a calidad 80, logos secundarios sin
`loading="lazy"` y el servidor de prueba sin gzip); con todo eso, 1,5 s.

## Verificación y «no repetir»

`node verificar.mjs` (2026-11-25, con `js/lugar.js` de Lugar 3D ya en la carpeta pero servido vacío en las pruebas):
**141 bien, 1 mal** en el pase entero; el fallo era de la propia prueba (miraba el medidor justo en la línea entre la
portada y «Dónde te quedas»). Corregida, el bloque 3 vuelve a pasar: **9 bien, 0 mal**. Once bloques: archivos y contrato,
portada a cinco tamaños, contraste/foco/fondo/medidor, fichas y visor por nombre, el tiempo (y su fallo), el buscador y el
iframe de WuBook (escritorio y móvil), cookies y mapa, mando de densidades, móvil, legales y hueco del 3D y, una vez,
con movimiento (capas, gesto táctil por CDP, pie, recarga).

`node ../plantillas-negocios-web/scripts/repeticion.mjs ../apartamentos-montemar-navia-web` (2026-11-25): en las últimas
diez webs no domina ninguna pieza (marquesina, letra a letra, cursor, cortina y serif 0/10; crema con acento 1/10).
**Montemar no usa ninguna del kit** → **repite 0 de las dominantes (tope 2)**.

## Qué mirar en Chrome

Nadie ha visto todavía la web pintada: las pruebas miden comportamiento, no aspecto. Abrir con un servidor local.

1. **Portada**: que «Montemar» se lea bien entre el cielo y los olivos (la M asoma detrás del olivo grande en escritorio);
   que el recorte de los olivos no deje halo claro alrededor de las hojas, sobre todo junto al sol; que la loma y la ola
   abajo se lean como las del logo. Bajar despacio: la palabra se hunde detrás de los olivos. Arrastrar en horizontal.
2. **Móvil y tableta**: la portada se recorta al centro; mirar que la palabra no quede tapada y que el olivo del centro
   y la ría se vean.
3. **El fondo que baja** (verde → tierra → agua): que el cambio sea suave y no se note «a saltos».
4. **El medidor** a la derecha: discreto, que no tape nada; en móvil solo aparece mientras se baja.
5. **Dónde te quedas**: que las cifras grandes respiren y que los iconos propios se lean como una familia.
6. **Por dentro**: filas de la misma altura; las fotos pequeñas (baño, lavabo, chalet por fuera) no deben verse blandas.
7. **La vista**: el tiempo de ahora (con red) y el botón de la cámara.
8. **La ría, ahora**: cómo encaja el 3D de Lugar con la sección oscura.
9. **Reservar**: elegir llegada y salida y pulsar «Buscar en su motor»: debe abrirse SU WuBook con esas fechas. **No
   completar una reserva (son reales).**
10. **Pie**: el logo que crece y el cartel de la ayuda, legible.
11. El **foco del teclado** (Tab): el contorno redondeado con las tres copas en la esquina.
12. `?revision` → **Sobria**: la tabla «De un vistazo».
