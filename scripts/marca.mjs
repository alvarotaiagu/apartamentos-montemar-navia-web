/* Favicons, imagen para compartir y el control del logo redibujado.
   Uso: node scripts/marca.mjs   (después de python -I -X utf8 scripts/marca-logo.py y node scripts/fotos.mjs)
   - marca/favicon.svg (el símbolo), favicon-32.png, apple-touch-icon.png (180) e icono-512.png (para manifest.json).
   - img/og.jpg (1200x630): la panorámica de los olivos con el logo entero sobre una placa clara.
   - Control del logo: pinta ref/raw/logo-control.svg a 457x486 y mide, color a color, el IoU contra el PNG original
     (las mismas siete clases de scripts/marca-logo.py). Escribe marca/logo-control.json. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const sharp = require('sharp');
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const R = (f) => path.join(RAIZ, f);

const simbolo = fs.readFileSync(R('marca/simbolo.svg'), 'utf8');
fs.writeFileSync(R('marca/favicon.svg'), simbolo);
const icono = async (lado, fondo, margen, f) => {
  const dentro = Math.round(lado * (1 - 2 * margen));
  const capa = await sharp(Buffer.from(simbolo), { density: 300 }).resize(dentro, dentro, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({ create: { width: lado, height: lado, channels: 4, background: fondo } }).composite([{ input: capa, gravity: 'center' }]).png().toFile(R(f));
  console.log(f);
};
await icono(32, { r: 0, g: 0, b: 0, alpha: 0 }, 0, 'marca/favicon-32.png');
await icono(180, '#EDF2EC', 0.12, 'marca/apple-touch-icon.png');
await icono(512, '#EDF2EC', 0.14, 'marca/icono-512.png');

// og:image
{
  const W = 1200, H = 630;
  const foto = await sharp(R('img/fotos/olivos-1780.jpg')).resize(W, H, { fit: 'cover', position: 'centre' }).toBuffer();
  const logo = await sharp(R('marca/logo.svg'), { density: 300 }).resize({ height: 300 }).png().toBuffer();
  const lm = await sharp(logo).metadata();
  const placa = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${lm.width + 80}" height="${lm.height + 70}"><rect width="100%" height="100%" rx="28" fill="#EDF2EC" fill-opacity=".94"/></svg>`);
  await sharp(foto).composite([{ input: placa, left: 56, top: H - lm.height - 70 - 48 }, { input: logo, left: 96, top: H - lm.height - 35 - 48 }]).jpeg({ quality: 84, mozjpeg: true }).toFile(R('img/og.jpg'));
  console.log('img/og.jpg');
}

// control del logo: IoU por color
{
  const PAL = [[255, 255, 255], [10, 6, 12], [0x46, 0x71, 0x3C], [0x21, 0x5A, 0x37], [0x17, 0x3E, 0x29], [0x84, 0x44, 0x2A], [0x4A, 0x8A, 0xC8]];
  const NOM = ['blanco', 'negro', 'izq', 'cen', 'der', 'tierra', 'agua'];
  const clases = async (buf) => {
    const { data, info } = await sharp(buf).flatten({ background: '#fff' }).resize(457, 486, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const out = new Uint8Array(info.width * info.height);
    for (let i = 0, j = 0; i < data.length; i += 3, j++) {
      let mejor = 0, dm = 1e9;
      for (let k = 0; k < PAL.length; k++) { const d = (data[i] - PAL[k][0]) ** 2 + (data[i + 1] - PAL[k][1]) ** 2 + (data[i + 2] - PAL[k][2]) ** 2; if (d < dm) { dm = d; mejor = k; } }
      out[j] = mejor;
    }
    return out;
  };
  const a = await clases(fs.readFileSync(R('ref/origen/logo-montemar-457.png')));
  const b = await clases(await sharp(R('ref/raw/logo-control.svg')).png().toBuffer());
  const iou = {};
  for (let k = 1; k < PAL.length; k++) {
    let i = 0, u = 0;
    for (let p = 0; p < a.length; p++) { const x = a[p] === k, y = b[p] === k; if (x && y) i++; if (x || y) u++; }
    iou[NOM[k]] = +(i / u).toFixed(3);
  }
  // todo lo que no es fondo
  let i = 0, u = 0;
  for (let p = 0; p < a.length; p++) { const x = a[p] !== 0, y = b[p] !== 0; if (x && y) i++; if (x || y) u++; }
  iou.silueta = +(i / u).toFixed(3);
  fs.writeFileSync(R('marca/logo-control.json'), JSON.stringify({ fecha: new Date().toISOString().slice(0, 10), iou }, null, 1));
  console.log('IoU del logo redibujado contra el PNG', iou);
}
