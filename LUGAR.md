# Lugar 3D · «La ría, ahora»

Módulo `lugar` de la sección `#lugar` (agente Lugar 3D, 2026-11-25). Ficheros: `js/lugar.js`, `css/lugar.css`,
`img/lugar/`, `data/lugar.json`, `data/lugar-escena.json`, `vendor/three-0.160.0.module.min.js`, `scripts/lugar-*`,
`ref/raw/lugar-prueba.html` y `ref/raw/lugar-cache/` (caché de descargas y vistas de comprobación; no viaja a la web).

**Nadie lo ha visto pintado todavía.** El 3D no se prueba con Playwright (reglas del PC): lo tiene que mirar Álvaro en
su Chrome (ver «Qué mirar»). Lo que sí está comprobado, en «Pruebas».

## Qué hace

Un vuelo que avanza con el scroll (sección fijada con `position: sticky`, sin GSAP; se sale bajando o subiendo, con
rueda, táctil o teclado, porque el scroll es el del navegador):

| Scroll | Cámara | Parada | Rótulos |
|---|---|---|---|
| 0 – 24 % | sobre el Cantábrico, 3,3 km mar adentro y a 230 m, mirando al sur: la costa, la bocana, la loma de la finca y la sierra detrás | Desde el mar | Mar Cantábrico, Cabo de San Agustín, Montemar |
| 24 – 40 % | baja hacia la bocana y entra entre los dos espigones a ~30 m | La bocana | La bocana |
| 40 – 58 % | canal arriba a ~25 m, mirando a la izquierda (este): la playa de Navia, la laguna de arenales y el pinar | La playa y el pinar | Playa de Navia, El pinar |
| 58 – 86 % | mira ría arriba hacia la villa, gira y sube por la loma hasta la finca | Ría arriba | La ría de Navia, Navia, Montemar |
| 86 – 100 % | rodea la casa roja por el noroeste y acaba delante del porche alto, **a la altura de la terraza (60,4 m) mirando de vuelta al mar**: el encuadre de su webcam | La terraza | Cabo de San Agustín, La bocana, Playa de Navia, El pinar |

- **Relieve**: MDT05 del IGN (no hay MDT02 en el WCS: se ha mirado `GetCapabilities`) en una caja de 3,9 × 3,6 km, del
  cabo de San Agustín a la playa del Moro y del mar a la villa, con rejillas de alturas a 15 m (toda la caja), 5 m (la
  ría, 1,15 × 1,4 km) y 3 m (la finca, 600 m). La malla se aprieta a 3 m en la finca y a 6 m sobre la ría y se abre
  lejos (~100 000 vértices en escritorio, ~40 000 en móvil). Anillo lejano con MDT25 (13,6 × 17,3 km) para la sierra
  del sur y la costa a los lados. **A escala real, sin exagerar.**
- **Ortofoto PNOA**: 1,51 m/px en la caja cercana (2560 px; 3,0 m/px en móvil), **0,72 m/px en la ría** (WMTS z18,
  1600 px; 1,44 en móvil) y **0,29 m/px en la finca** (WMTS z19, 2048 px; 0,59 en móvil), fundidas en el sombreado
  del suelo. En la de la finca se borran los tejados (los edificios van en 3D).
- **Los espigones**: el MDT05 los aplasta, así que se levantan como escollera (7 m de ancho, 4,5 m sobre el nivel
  medio) sobre su trazado medido en la ortofoto. Puntas: oeste (−583, −940), este (−441, −765).
- **La casa roja** (Catastro `33041A01600277`, partes 1 a 3, 3 plantas; 14,0 × 12,9 m): planta de pizarra (con la
  terraza del este, de la misma fábrica), dos plantas rojas con recercados blancos y ventanas con cruceta, **porche de
  columnas blancas a dos alturas al norte** (barandillas blancas, techo blanco), **cubierta de pizarra a dos aguas con
  el frontón rojo y su triángulo blanco** sobre el porche, tres chimeneas forradas de pizarra con corona blanca,
  **escalera exterior** pegada a la fachada este subiendo hacia el porche alto, el **toldo de rayas** en el extremo
  sur de la terraza, puertas blancas en la planta de pizarra (apoyadas en el suelo del MDT; si no caben, no se ponen).
- **El chalet de piedra** (`33041A01600277_part4`, 1 planta, en L): muros de lajas de piedra, cubierta de pizarra con
  canto de madera y chimenea de piedra. Las casas vecinas del Catastro (dentro de la ortofoto de la finca, ~290 m), blancas con pizarra.
- **Los olivos**: 65 copas redondas (los árboles del logo) donde se ven en la ortofoto, solo dentro de la parcela del
  Catastro (10 023 m²): el marco del olivar al sur de la casa y los del jardín. Tronco corto, copa gris verdosa.
- **El pinar y las arboledas**: 5 244 copas detectadas en las ortofotos (1 554 pinos en el pinar entre la playa y la
  finca, con tronco alto y copa aplastada; el resto, frondosas). Con sombra solo los de < 160 m de la casa.
- **El cielo de ahora** en Navia: sol y luna en su posición real (fórmulas de SunCalc, en el navegador), color del
  cielo y de la luz según la altura del sol, sombras de la casa, los olivos y los árboles cercanos (mapa de sombras de
  220 m, recalculado solo cuando cambia el sol, cada minuto), **nubes con la nubosidad de ahora** (Open-Meteo,
  `cloud_cover`: tapan el cielo en esa proporción, apagan el sol y agrisan el horizonte). De noche: estrellas, la luna
  con su fase, ventanas y puertas de la casa roja encendidas con halo dibujado y luz cálida en el porche. Rótulo arriba:
  «15:42 en Navia · el sol de ahora» + la frase (hora, altura y rumbo del sol, nubes).

### La marea

- **Dato**: Open-Meteo Marine, `sea_level_height_msl` horario (en el punto 43,5585, −6,7265; el modelo lo resuelve en
  una celda mar adentro, la misma marea). En el navegador se interpola entre horas (Catmull-Rom) y se buscan pleamares
  y bajamares afinadas con una parábola. Se enseña en cifra: **«+0,9 m · bajando»**, qué pasa en los arenales y las
  dos próximas pleamar/bajamar con hora y altura; en el plano, además, la curva de 6 h antes a 18 h después con la
  línea de los arenales. Se refresca cada minuto.
- **En la escena, el agua sube y baja de verdad** (el plano del agua está a la altura de la marea de ahora). Es honrado
  porque el MDT05 del IGN **se voló con la marea baja**: el canal y el mar salen a 0 m (relleno plano) y **los
  arenales de la laguna de la playa y de la orilla oeste salen a 1 m, con sus caños a 0 m** (se ve en el ráster). Así:
  - el canal, los caños y el mar se bajan a un fondo inventado por debajo de la bajamar más baja (−2,8 m y más):
    siempre tienen agua;
  - **los 23,6 ha de arenal** (clase de 1 m pegada al agua, sin vegetación en la foto) quedan entre 0,5 y 1,5 m: el MDT
    redondea al metro, así que ese metro se reparte por la distancia a los caños (junto a ellos, 0,5 m; lejos, 1,5 m).
    **No se inventa nada fuera de ese metro**, pero la línea exacta del agua sobre el arenal es aproximada (se dice en
    el pie: «la línea del agua sobre los arenales es aproximada: el IGN los mide al metro»);
  - con la marea por encima de ~1,5 m los arenales quedan cubiertos; por debajo de ~0,5 m, a la vista; entre medias,
    el agua entra por los caños. Donde cubre poco, el agua se transparenta y deja ver la arena;
  - el resto de tierra por debajo de la pleamar se sube a 2,6 m (si no, el agua la cubriría);
  - en la ortofoto, el agua que había sobre los arenales el día de la foto (otra marea) se ha cambiado por **arena
    mojada** conservando el dibujo de los bancos de la foto: con la marea baja de ahora asoma la arena.
- Las alturas del IGN son sobre el nivel medio en Alicante y la marea de Open-Meteo sobre el nivel medio del mar: en el
  Cantábrico difieren pocos centímetros, menos que el redondeo del MDT.
- **Si la petición falla**, la escena funciona igual: el agua se queda en el nivel medio (0 m) y no se enseña ningún
  panel de marea ni se dice nada sobre ella. Para mirar otra marea: `?marea=-2` o `?marea=1.6`.

### Plan B (en el mismo hueco)

Sin WebGL, con movimiento reducido, en densidad «sobria», con ahorro de datos, en el móvil antes de pulsar el botón y
en navegadores automatizados (Playwright): **la ría desde el aire** (ortofoto PNOA de 0,7 m/px sin tocar, de la bocana a
la finca) con **el recorrido dibujado encima** (SVG, línea discontinua) y las marcas (La bocana, Playa de Navia «a 700 m
de la casa», El pinar, La ría de Navia, Montemar «54 m sobre el mar»); **la vista desde el mar dibujada** con los mismos
datos (render por columnas en Python, el mismo encuadre que el arranque del 3D, que también hace de póster mientras
carga); el cielo de ahora, el panel de la marea con su curva y las cinco paradas. De noche, la vista se oscurece y la
marca de la casa brilla. Sin JS, se queda el respaldo de Web (el fotograma de la webcam).

### Cuándo sale cada cosa

| Caso | Qué se ve |
|---|---|
| Escritorio con WebGL | el 3D se carga al montar (Web monta a ~900 px); mientras, el póster en el mismo hueco; se enseña cuando han llegado las texturas (o a los 6 s) |
| Móvil (≤ 820 px o puntero grueso) o ahorro de datos | plan B + botón **«Ver la ría en 3D»** (Three.js y texturas no se piden hasta pulsar) |
| `prefers-reduced-motion`, `movimiento: false`, `densidad: 'sobria'`, sin WebGL, `?sin-webgl` | plan B, sin botón |
| `navigator.webdriver` (Playwright) | plan B siempre; `?lugar=3d` lo fuerza (no usarlo en pruebas con WebGL de verdad) |
| En 3D | botón «Ver en plano» abajo a la derecha |
| Si falla la carga o se pierde el contexto WebGL | vuelve solo al plan B |

## Para Web

1. **HTML**: ya está bien en `index.src.html` (`<div data-modulo="lugar">` a todo el ancho, con el respaldo dentro).
   El contenido del div se guarda y se repone al destruir.
2. **CSS y JS**: `css/lugar.css` en el `<head>` y `js/lugar.js` con `defer` (ya están). **Three.js no lo cargas tú**:
   `lugar.js` lo pide con `import()` a `vendor/three-0.160.0.module.min.js` (copia propia de Three.js r160, MIT, la
   misma de Amaicha y Tanes) solo cuando hace falta. Sin import map, sin CDN.
3. **Montar**: `Montemar.lugar.montar(el, { movimiento, densidad, webgl })` → `{ destruir(), estado(), ver3d(), verPlano() }`.
   `webgl: false` fuerza el plan B; si no lo pasas, lo detecta él.
4. **La clase raíz del módulo es `.lugar-mod`** (tu sección ya se llama `.lugar`; así tus reglas de `.lugar` no tocan
   el div). Todo lo mío va con prefijo `lugar__` y no choca con tus `lugar__cab` y `lugar__respaldo`.
5. **Sticky**: el escenario va con `position: sticky` y `top: var(--lugar-arriba)`, que por defecto es tu
   `var(--cabecera)` (la cabecera fija). Ningún antepasado de `[data-modulo="lugar"]` puede llevar `overflow`
   (hidden/auto/clip, salvo el `overflow-x: clip` de `html`, que no rompe) ni `transform`/`filter`.
6. **Variables que lee** (las de `#lugar`, para fondo oscuro): `--fondo`, `--superficie`, `--texto`, `--texto-suave`,
   `--linea`, `--agua-texto` (recorrido, parada actual, curva de la marea y el botón), `--foco`, `--gutter` y `--ancho`
   (el plan B va al ancho del texto), `--cabecera`, `--letra-titular`, `--letra-texto`, `--letra-cifras`. **No usa
   `--marca` ni `--acento`**: los verdes del logo no contrastan sobre `#0E1C14`; la casa y los botones van en el color
   del texto. No define colores de página.
7. **`data/lugar.json`** (para tu medidor y tus textos): `cotaFinca` **54** (terreno en el centro de la casa roja,
   MDT05), `cotaTerraza` 58,8 (suelo del porche alto), `distanciaPlaya` **700** (m en línea recta del centro de la
   casa al borde del polígono de la playa de Navia de OSM), `distanciaBocana` 950, `distanciaNavia` 1100,
   `arenalesHa` 23,6. Ojo: **los 41 m de partida eran la altura de la celda de Open-Meteo**, no la de la finca. Su web
   dice «playa a 600 m»: en línea recta son ~700 m (andando, lo que dé OSRM).
8. **Privacidad**: el módulo pide a Open-Meteo (marea y nubosidad) desde el navegador del visitante, sin cookies,
   `credentials: 'omit'` y sin referrer. Si la página de privacidad o de cookies lista Open-Meteo por el tiempo, ya
   está cubierto; si no, añadirlo. **Créditos**: el pie del módulo cita IGN (CC BY 4.0), Catastro, OSM y Open-Meteo.
9. **`verificar.mjs`**: tu prueba sirve `js/lugar.js` vacío, así que no toca nada mío. Mi prueba propia, abajo.
10. **Peso**: con `defer` y la carga diferida, nada entra en el LCP. El 3D baja **3,07 MB en escritorio** (Three.js
    655 KB incluido) y **1,91 MB en móvil** al pulsar el botón; el plan B, **~360 KB** (mapa de 640 px, vista de 960 px
    y `lugar-escena.json` de 240 KB). `img/lugar/` entero: 3,1 MB. `lugar.js` ~95 KB y `lugar.css` ~17 KB, sin minificar.

## Datos (cómo se rehacen)

```
python -I -X utf8 scripts/lugar-osm.py      # lugares, playas, espigones y el eje de la ría (Overpass con espejos) → ref/raw/lugar-cache/osm-navia*.json
python -I -X utf8 scripts/lugar-datos.py    # descargas (en caché), agua y arenales, alturas, ortofotos, Catastro, olivos,
                                            # árboles, recorrido con su holgura, plan B → img/lugar/, data/lugar*.json
python -I -X utf8 scripts/lugar-vistas.py   # vistas de comprobación sin WebGL → ref/raw/lugar-cache/comprueba-*.jpg
node scripts/lugar-prueba.mjs               # comprobaciones (ver «Pruebas»); --sin-navegador: solo las de Node
```

Todas las peticiones llevan el User-Agent genérico `datos-mapa-script/1.0 (uso puntual)`, sin datos personales.
Borrar `ref/raw/lugar-cache/` obliga a bajarlo todo otra vez (~40 MB).

| Fuente | Servicio | Uso |
|---|---|---|
| MDT05 IGN | WCS `servicios.idee.es/wcs-inspire/mdt`, `Elevacion4258_5` | relieve cercano (nativo 3,6 × 5 m, en metros enteros); agua, canal y arenales |
| MDT25 IGN | mismo WCS, `Elevacion4258_25` | anillo lejano |
| PNOA | WMS `www.ign.es/wms-inspire/pnoa-ma` (caja cercana y lejana, mosaicos de 2 × 2); **WMTS** `www.ign.es/wmts/pnoa-ma` z18 (ría) y z19 (finca) | color del suelo |
| Catastro INSPIRE | `wfsBU.aspx` (`BU:Building`, `BU:BuildingPart` con plantas), `wfsCP.aspx` (`GetParcel` de la finca) | la casa, el chalet, las vecinas y la parcela |
| OSM | Overpass (UA genérico; con UA de navegador da 406) | Navia (`place=town`), Playa de Navia (`natural=beach`, polígono), faro y cabo de San Agustín, eje del río (`waterway=river`, para el canal) |
| Sol y luna | fórmulas de SunCalc (V. Agafonkin), en el navegador | luz, cielo, astros, noche |
| Marea y nubes | Open-Meteo Marine (`sea_level_height_msl`) y Forecast (`current=cloud_cover`), en el navegador | agua, cifra, nubes |

Alturas en PNG RGB: `(R·256 + G) / 10 − 100` m. Coordenadas locales en metros desde el punto de Turismo de Asturias
(43,548577, −6,718882): x al este, z al sur, y = altura sobre el nivel medio del mar. `agua.png`: R distancia a tierra
en el mar (3 m por unidad), G 1 dentro de la ría (agua tranquila, sin rompientes), B cota del arenal (0,3–1,7 m).

### Comprobaciones hechas (y lo que no es como se suponía)

- **El punto de Montemar cae en la casa**: la casa roja del Catastro tiene el centro a 13 m del punto de Turismo de
  Asturias y está dentro de su parcela. Su **cota es 54 m** (terreno del MDT05 en el centro de la casa; 53 m en el lado
  del porche, 55 m al sur), no 41.
- **Qué edificio es cada cosa** (fotos `slider2`, `13`, `14` y la ortofoto de z20): casa roja = `33041A01600277`
  partes 1–3 (3 plantas = la de pizarra + dos rojas, como en la foto); chalet de piedra = parte 4 (1 planta). **Que el
  porche esté al norte y la escalera al este se deduce**: la sombra del hastial norte en la ortofoto (en punta), el
  tobogán al noroeste y la terraza de piedra clara al este, compatibles con la foto `slider2` tomada desde el noreste.
  Las alturas de planta, los huecos, las chimeneas y el toldo van **a ojo** desde las fotos.
- **Los espigones**: OSM solo tiene dos trozos del este; su trazado se ha medido en la ortofoto.
- **El pinar** no tiene nombre en OSM: el rótulo dice «El pinar» (sin apellido) y va al centro de los pinos detectados
  entre la laguna de la playa y la finca (el de la webcam).
- **La orientación** se ha comprobado con una vista dibujada desde la terraza al lado del fotograma de la webcam
  (`ref/raw/lugar-cache/comprueba-terraza-vs-webcam.jpg`): el cabo con el faro a la izquierda, la bocana algo a la
  izquierda del centro, la playa, la laguna de arenales delante y el pinar a la derecha, como en la webcam. Desde la
  terraza se ven (sin relieve por medio) el cabo, la bocana, la playa y el pinar.
- **Dos fallos heredados del render de la vista de Amaicha, corregidos aquí**: salía en espejo (lo de la derecha de
  quien mira salía a la izquierda) y con el cabeceo al revés (mirando hacia abajo, el horizonte bajaba en vez de subir).
  Ver la nota para Amaicha en el informe.

## Pruebas

`node scripts/lugar-prueba.mjs` (servidor propio en el 8962, un solo Chromium **con WebGL desactivado**, ventanas de
1280×800 y 390×844, escala 1; se cierra al acabar; Open-Meteo se sustituye por datos fijos). Última pasada: **99 bien,
0 mal**. Comprueba:

1. **Node**: sol en Navia (solsticios a mediodía: 69,9° y 23,0° al sur; en junio sale por el noreste), luna, la frase
   del cielo; la marea (horas locales → UTC, interpolación con < 1 cm de error, pleamar afinada a 0,1 min, frase
   «bajando» con las dos próximas); el recorrido no se pasa de sus puntos ni da saltos (3 m máx. por 1/4000 de
   scroll) y acaba en la terraza mirando a 335° (noroeste, la bocana), como la webcam.
2. **Datos**: todos los ficheros existen y no sobra ninguno; pesos; `cotaFinca` = MDT05 en la casa; la casa junto al
   punto, dentro de su parcela, con el porche al norte; el chalet; 65 olivos, todos en la parcela; 5 244 árboles; todos
   los rótulos en su sitio (la villa al sur, la playa al norte, el cabo al noroeste); el espigón oeste sale más al mar.
3. **Plan B sin WebGL** (escritorio y móvil, este sin Open-Meteo): no hay lienzo ni pista; el mapa sin recortar (el
   recorrido cae en su sitio), sus cinco marcas y la vista con las suyas; cinco paradas y el cielo de ahora; la marea
   de ahora con su curva (o, sin dato, sin panel y sin errores); sin botón 3D (no hay WebGL); sin scroll horizontal;
   alturas PNG bien decodificadas (casa a 54,1 m, mar y canal por debajo de la bajamar, laguna a 1,1 m); **holgura de
   la cámara sobre el relieve y los árboles en todo el recorrido ≥ 11,9 m** (≥ 7,4 m en la llegada a la terraza);
   `destruir()` repone el respaldo; sin errores.
4. **Escena con un `WebGLRenderer` falso** (Three.js real, no pinta): se monta sin NaN (~784 000 triángulos en
   escritorio, ~268 000 en móvil); se enseña cuando han llegado las texturas; el rótulo «… en Navia · el sol de ahora»
   y la marea; **el agua a la altura de la marea de ahora** (0,86 m con el dato fijo); paradas y rótulos por tramos
   (p=0: Mar Cantábrico · Cabo de San Agustín · Montemar; p=0,3: La bocana; p=0,45: Playa de Navia · El pinar; p=0,7:
   Montemar; p≈1: Cabo de San Agustín · La bocana · Playa de Navia · El pinar, cámara a 60,4 m); fuera de pantalla no
   pinta; «Ver en plano» vuelve; `destruir()` libera y quita el lienzo; en el móvil, plan B con el botón y sin pedir
   Three.js, y al pulsar monta el 3D (con `?marea=-2`, el agua a −2 m); sin errores.

**No comprobado**: nada se ha pintado con WebGL (ni los shaders compilados, ni la casa vista, ni el agua sobre los
arenales, ni las nubes, ni los fps). Las imágenes del plan B y las vistas de comprobación sí las he mirado.

## Rendimiento

Sin `transmission`, sin `RectAreaLight`, sin bloom (halos dibujados con sprites aditivos), colores en sRGB (`'#hex'`),
DPR ≤ 1,5 (1,25 en móvil) con bajada automática (DPR 1; luego sin sombras y DPR 0,8 si los fotogramas pasan de 30 ms),
sombras PCF solo en 220 m alrededor de la casa y recalculadas solo cuando cambia el sol, pausa fuera de pantalla. El
agua se mueve: mientras se ve, se repinta; **quieto, a ~30 fps** (el oleaje no pide más). Lo más caro: los ~5 200
árboles (una malla instanciada, 80 triángulos cada uno; en móvil, la mitad de los lejanos y con 20) y el relieve.
La prueba con el renderizador falso **no compila los shaders**: un error de GLSL solo se vería en Chrome, en la
consola (`THREE.WebGLProgram: Shader Error`), con el agua, el cielo o el suelo en negro o sin pintar.

## Qué mirar (Álvaro, en su Chrome)

Servidor local en la carpeta de la web (`python -m http.server 8962`) y abrir
`http://localhost:8962/ref/raw/lugar-prueba.html` (solo el módulo) o la página de Web.

1. **`?fps`**: arriba a la derecha, fps, calidad, DPR, altura de la cámara, triángulos y la marea. Si la calidad baja
   sola a 1 o 2, va justo: decirlo.
2. **La casa al llegar** (último 15 %): que se reconozca (rojo, recercados y columnas blancas, porche a dos alturas,
   escalera, pizarra, frontón con su triángulo). Si algo sale del revés (el porche al sur, la escalera al oeste),
   avisar: la orientación es deducida.
3. **El final**: que desde la terraza se vea como su webcam (cabo a la izquierda, bocana, playa, pinar a la derecha).
4. **La marea**: abrir con `?marea=-2` (arenales a la vista, arena mojada) y con `?marea=1.6` (cubiertos), y mirar la
   orilla del agua en la laguna (que no salgan escalones raros ni manchas).
5. **Los espigones** al entrar por la bocana: que encajen con las líneas de la ortofoto y no floten.
6. **De noche** (`?hora=22:30`): ventanas de la casa encendidas, luna, estrellas; **nubes**: con cielo cubierto,
   que no tapen de golpe ni se vean costuras.
7. **Rótulos**: que caigan en su sitio y no se monten (sobre todo al final, con cuatro a la vez).
8. **Móvil real**: el botón «Ver la ría en 3D», que el scroll no se trabe, que el escenario no salte al esconderse la
   barra del navegador y que el panel de la marea quepa arriba sin tapar la escena.
9. Si va a menos de 5 fps: Chrome sin aceleración por hardware (`chrome://settings/system`).

## Pendiente

- Que Álvaro lo vea pintado (nadie lo ha visto).
- Confirmar con la casa la orientación del porche y la escalera (deducida) y las medidas a ojo (alturas, huecos,
  chimeneas, toldo). Que el chalet sea la parte 4 del Catastro.
- El cuadro oscuro del jardín al oeste de la casa (¿piscina cubierta, arenero?) no se ha modelado.
- Las fotos de la ortofoto son de verano (sombras al norte, a mediodía): debajo de cada olivo queda su sombra pintada,
  que no gira con el sol de ahora.
