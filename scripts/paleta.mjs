// Contraste de la paleta de Montemar (WCAG 2 para el mínimo legal; APCA para elegir texto sobre color).
//   node scripts/paleta.mjs   → tabla; sale con código 1 si una pareja de texto no llega a su mínimo.
// Lib: scripts/lib/color.mjs (copia de ../plantilla-veterinaria-web/scripts/lib/color.mjs).
import { contraste, apca } from './lib/color.mjs';
export const P = {
  monte: '#EDF2EC',    // fondo arriba: verde muy claro (de los verdes del logo)
  tierra: '#F3ECE7',   // fondo en la casa: la tierra de la loma, muy aclarada
  agua: '#EAF1F6',     // fondo al llegar al agua: el azul de la ola, muy aclarado
  hoja: '#215A37',     // verde de la copa grande (acento: botones de reservar, marcas activas)
  oscuro: '#173E29',   // verde oscuro de la copa derecha (--marca)
  tinta: '#132219',    // texto
  suave: '#47574C',    // texto secundario
  loma: '#814429',     // marrón de la loma
  ola: '#498BC8',      // azul de la ola
  olaTexto: '#2A659D', // la ola como texto pequeño (el azul del logo no llega a 4,5 sobre claro)
  lomaTexto: '#7A3F25',
  noche: '#0E1C14',    // #lugar (sección oscura)
  claro: '#EEF3EE',    // texto sobre noche
  claroSuave: '#B5C4B9',
};
const fondosClaros = ['monte', 'tierra', 'agua', 'blanco'];
const C = { ...P, blanco: '#FFFFFF' };
const parejas = [
  ...fondosClaros.flatMap((f) => [['tinta', f, 4.5], ['suave', f, 4.5], ['hoja', f, 4.5], ['oscuro', f, 4.5], ['olaTexto', f, 4.5], ['lomaTexto', f, 4.5], ['ola', f, 3]]),
  ['claro', 'hoja', 4.5], ['claro', 'oscuro', 4.5], ['claro', 'loma', 4.5], ['blanco', 'ola', 3],
  ['claro', 'noche', 4.5], ['claroSuave', 'noche', 4.5], ['ola', 'noche', 3],
];
let mal = 0;
for (const [t, f, min] of parejas) {
  const c = contraste(C[t], C[f]); const a = apca(C[t], C[f]);
  const ok = c >= min; if (!ok) mal++;
  console.log(`${ok ? 'ok   ' : 'MAL  '} ${t.padEnd(11)} sobre ${f.padEnd(8)} ${c.toFixed(2).padStart(6)}:1 (mín ${min})  APCA Lc ${a.toFixed(0)}`);
}
process.exitCode = mal ? 1 : 0;
