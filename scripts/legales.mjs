/* Genera los *.src.html de las páginas legales y el 404 con una plantilla común (receta de Amaicha).
   Uso: node scripts/legales.mjs  (después, node construir.mjs)
   Titular: el de su política de privacidad (ref/DATOS-MONTEMAR.md). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/montemar.json'), 'utf8'));
const T = D.titular, C = D.contacto;
const TEL = `<a href="tel:${C.telefono}">${C.telefonoTexto}</a>`;
const CORREO = `<a href="mailto:${C.correo}">${C.correo}</a>`;

const TITULAR = `<dl>
  <dt>Titular</dt><dd>${T.nombre}</dd>
  <dt>NIF</dt><dd>${T.nif}</dd>
  <dt>Inscripción</dt><dd>${T.registroMercantil}</dd>
  <dt>Representante</dt><dd>${T.representante}</dd>
  <dt>Domicilio</dt><dd>${T.domicilio}</dd>
  <dt>Nombre comercial</dt><dd>Apartamentos Montemar</dd>
  <dt>Teléfono</dt><dd>${TEL}</dd>
  <dt>Correo</dt><dd>${CORREO}</dd>
  <dt>Registro de turismo</dt><dd>${T.registroTuristico}. El chalet: <span class="aviso-corto">por confirmar</span></dd>
</dl>
<p class="aviso">PENDIENTE: confirmar con Montemar el registro turístico del chalet (no sale en la ficha AT0123) y revisar estos textos antes de publicar. Esta web es una propuesta que nadie ha encargado todavía.</p>`;

const paginas = {
  'aviso-legal': {
    titulo: 'Aviso legal',
    cuerpo: `
<p>En cumplimiento del artículo 10 de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), estos son los datos del titular de esta web:</p>
${TITULAR}
<h2>Uso de la web</h2>
<p>Esta web informa sobre Apartamentos Montemar, cuatro apartamentos turísticos y un chalet en Navia (Asturias). Los precios, la disponibilidad y las condiciones de cada reserva son los que muestra su motor de reservas en el momento de reservar.</p>
<p>La reserva se hace en el motor de reservas de Montemar (WuBook), que se abre dentro de esta página solo si lo pides. <b>Las reservas que se hacen en él son reales</b> y se rigen por las condiciones que muestra el propio motor.</p>
<h2>Propiedad intelectual</h2>
<p>Los textos, el logotipo y las fotografías de la casa son del titular o se usan con su permiso. Las letras Afacad, Fustat y Noto Sans Mono se usan con su licencia libre (SIL Open Font License).</p>
<p class="aviso">PENDIENTE: confirmar que todas las fotos son de la casa y se pueden usar (vienen de su web y de su ficha en un portal de reservas).</p>
<p>Las distancias y los tiempos de «Alrededor» se han calculado con OSRM (router.project-osrm.org y routing.openstreetmap.de) sobre datos de OpenStreetMap: © colaboradores de OpenStreetMap, con licencia ODbL (<a href="https://www.openstreetmap.org/copyright">openstreetmap.org/copyright</a>).</p>
<p>El tiempo de «La vista» viene de Open-Meteo (open-meteo.com), con licencia CC BY 4.0.</p>
<p>La sección «La ría, ahora» usa el relieve y la ortofoto del Instituto Geográfico Nacional (CC BY 4.0, «© Instituto Geográfico Nacional»), la cartografía de la Dirección General del Catastro y datos de OpenStreetMap (© colaboradores de OpenStreetMap, ODbL). La escena se dibuja con Three.js (licencia MIT), que va con esta misma web, y la marea y las nubes de ahora vienen de Open-Meteo.</p>
<h2>Publicidad de la ayuda recibida</h2>
<p>Actuaciones de eficiencia energética financiadas a través de las ayudas a proyectos de eficiencia energética y economía circular de empresas turísticas del Principado de Asturias, en el marco del Plan de Recuperación, Transformación y Resiliencia, financiado por la Unión Europea (NextGenerationEU). MONTEMAR S.L.: sustitución de equipos y aparatos electrodomésticos por otros de alta eficiencia con etiquetado energético (Resolución de 19 de julio de 2024, de la Consejería de Presidencia, Reto Demográfico, Igualdad y Turismo). El cartel está al pie de la página principal.</p>
<h2>Responsabilidad</h2>
<p>Los enlaces a otras webs (su motor de reservas, su cámara, Google Maps y su ficha de Google) llevan a servicios de terceros con sus propias condiciones.</p>
<h2>Ley aplicable</h2>
<p>Estas condiciones se rigen por la ley española.</p>`,
  },
  privacidad: {
    titulo: 'Política de privacidad',
    cuerpo: `
<h2>Responsable</h2>
${TITULAR}
<h2>Qué datos tratamos y para qué</h2>
<p>Los que nos das al reservar, al escribirnos o al llamarnos: nombre, teléfono, correo, las fechas, cuántos venís y lo que quieras contarnos. Los usamos para gestionar tu reserva y atenderte.</p>
<p>Al alojarte, la ley obliga a registrar los datos de los viajeros y comunicarlos a las autoridades (Real Decreto 933/2021).</p>
<h2>El motor de reservas</h2>
<p>El buscador de esta página no guarda ni envía nada: solo prepara la dirección de su motor de reservas con las fechas que elijas. Si lo abres, la reserva se hace en WuBook, el motor de reservas de Montemar, que trata tus datos por encargo del titular y con su propia política de privacidad.</p>
<h2>Base legal y plazos</h2>
<p>La base es tu consentimiento al reservar, la ejecución de la reserva y, para el registro de viajeros, una obligación legal. Los datos se conservan mientras dura la relación y, después, el tiempo que exige la ley.</p>
<h2>Con quién se comparten</h2>
<p>Con nadie, salvo el motor de reservas (WuBook) para gestionar la reserva y las obligaciones legales (el registro de viajeros), siempre con lo imprescindible.</p>
<h2>Tus derechos</h2>
<p>Puedes pedir el acceso, la rectificación, la supresión, la oposición, la limitación o la portabilidad de tus datos escribiendo a ${CORREO} o llamando al ${TEL}. Si crees que no se han respetado, puedes reclamar ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es">aepd.es</a>).</p>
<h2>Lo que guarda esta web en tu navegador</h2>
<p>Una sola cosa: <code>montemar-cookies</code> en el almacenamiento local, para recordar que ya has visto el aviso de cookies. Más detalles en <a href="cookies.html">cookies</a>.</p>`,
  },
  cookies: {
    titulo: 'Política de cookies',
    cuerpo: `
<p>Esta web no usa cookies propias de análisis ni de publicidad.</p>
<h2>Lo que se guarda en tu navegador</h2>
<ul>
  <li><b>montemar-cookies</b> (almacenamiento local): recuerda que has visto el aviso, para no enseñártelo en cada visita. Es técnica y no caduca sola; puedes borrarla desde tu navegador.</li>
</ul>
<h2>Servicios de terceros</h2>
<ul>
  <li><b>Google Fonts</b>: las letras de la web (Afacad, Fustat y Noto Sans Mono) se cargan desde los servidores de Google, que reciben tu dirección IP.</li>
  <li><b>Open-Meteo</b>: el tiempo de ahora en Navia se pide a open-meteo.com al llegar a esa sección. No instala cookies; recibe tu dirección IP.</li>
  <li><b>Motor de reservas (WuBook)</b>: solo se carga si pulsas «Buscar en su motor» o «Abrir su motor sin fechas». Pone sus propias cookies (por ejemplo, <code>wbocookies</code> y <code>ord</code>); a partir de ese momento se aplican sus condiciones.</li>
  <li><b>Su cámara</b>: el botón «Ver su cámara en directo» abre en otra pestaña la cámara del alojamiento; esta página no la carga.</li>
  <li><b>Google Maps</b>: el mapa de «Cómo llegar» solo se carga si pulsas «Ver el mapa». A partir de ese momento, Google puede instalar sus cookies.</li>
</ul>
<h2>Los dibujos y la ría en 3D</h2>
<p>La portada, el logo y la ría en 3D se dibujan en tu navegador con archivos que van con esta misma web: no instalan cookies.</p>
<p>La ría en 3D pide a Open-Meteo la marea y la nubosidad de ahora en Navia (sin cookies; recibe tu dirección IP).</p>
<p>Puedes volver a ver el aviso desde «Preferencias de cookies», en el pie de la página.</p>`,
  },
  accesibilidad: {
    titulo: 'Declaración de accesibilidad',
    cuerpo: `
<p>El titular se compromete a que esta web sea accesible conforme a la norma UNE-EN 301 549 (nivel AA de las WCAG 2.1).</p>
<h2>Situación de cumplimiento</h2>
<p class="aviso">PENDIENTE: completar tras la revisión de accesibilidad previa a la publicación.</p>
<p>La web se ha construido para poder usarse entera con el teclado y con lector de pantalla: contrastes de al menos 4,5:1 en el texto, foco visible, textos alternativos en las fotos, formularios con etiquetas y animaciones que se quitan si tu sistema pide reducir el movimiento. La portada en capas, el medidor de altura y la ría en 3D son un adorno: la información está también en el texto.</p>
<h2>Contenido de terceros</h2>
<p>El motor de reservas (WuBook), su cámara y el mapa de Google no dependen de esta web: su accesibilidad es la de sus servicios.</p>
<h2>Contacto</h2>
<p>Si encuentras una barrera, llama al ${TEL} o escribe a ${CORREO}. Te daremos la información en un formato accesible.</p>`,
  },
};

const FUENTES = 'https://fonts.googleapis.com/css2?family=Afacad:ital,wght@0,400..700;1,400..700&family=Fustat:wght@300..700&family=Noto+Sans+Mono:wght@400..600&display=swap';
const cabeza = (titulo) => `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo} · Apartamentos Montemar</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FUENTES}">
<link rel="stylesheet" href="css/base.css">
<link rel="stylesheet" href="css/legal.css">
<link rel="icon" href="marca/favicon.svg" type="image/svg+xml">
<link rel="icon" href="marca/favicon-32.png" sizes="32x32" type="image/png">
</head>`;

const MARCA = `<a class="legal-marca" href="./" aria-label="Montemar, a la portada"><img src="marca/simbolo.svg" width="46" height="39" alt=""><img src="marca/palabra.svg" width="118" height="19" alt=""></a>`;

for (const [nombre, p] of Object.entries(paginas)) {
  const html = `${cabeza(p.titulo)}
<body>
<header class="legal-cab">
  <div class="env">
    ${MARCA}
    <a class="volver" href="./">Volver a la portada</a>
  </div>
</header>
<main class="legal">
  <div class="env">
    <h1>${p.titulo}</h1>
${p.cuerpo}
  </div>
</main>
<footer class="legal-pie">
  <div class="env">
    <a href="aviso-legal.html">Aviso legal</a>
    <a href="privacidad.html">Privacidad</a>
    <a href="cookies.html">Cookies</a>
    <a href="accesibilidad.html">Accesibilidad</a>
  </div>
</footer>
</body>
</html>
`;
  fs.writeFileSync(path.join(RAIZ, `${nombre}.src.html`), html);
  console.log(`${nombre}.src.html`);
}

// el 404: el logo sin copas (la loma y la ola, vacías): «aquí no ha crecido nada»
fs.writeFileSync(path.join(RAIZ, '404.src.html'), `${cabeza('Página no encontrada')}
<body class="no-hay">
  <main class="no">
    <a class="no__logo" href="./" aria-label="Montemar, a la portada"><img src="marca/suelo.svg" width="436" height="368" alt=""></a>
    <h1>Aquí no ha crecido nada</h1>
    <p>La página que buscas no existe o ha cambiado de sitio. La finca sigue donde estaba: sobre la ría de Navia.</p>
    <p class="no__acc"><a class="btn btn--acento" href="./#reservar">Ver fechas</a><a class="btn btn--linea" href="./">Volver a la portada</a></p>
  </main>
</body>
</html>
`);
console.log('404.src.html');
