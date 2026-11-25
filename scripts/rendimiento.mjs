/* LCP, peso y tareas largas en un móvil de gama media (Pixel 7 emulado: 412×915, DPR 2,625, 4G lento 1,6 Mb/s y
   150 ms, CPU ×4). Receta de ../amaicha-ribadesella-web/scripts/rendimiento.mjs.
   Uso: node scripts/rendimiento.mjs   (puerto 8961; 3 pasadas con movimiento y 1 con movimiento reducido; sin WebGL:
   --disable-3d-apis, ?sin-webgl, y js/lugar.js y vendor/ servidos vacíos: el 3D no entra en esta medida). Las letras
   de Google y Open-Meteo se sirven falsos (se mide con las letras de sistema). El texto va con gzip, como en GitHub Pages. INP aproximado: el retardo de un toque
   en la portada (el gesto) y de otro en el índice de «Por dentro». */
import { createRequire } from 'node:module';
import http from 'node:http';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.bin': 'application/octet-stream' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  // como GitHub Pages: el texto (HTML, CSS, JS, SVG, JSON) va comprimido con gzip
  const texto = /\.(html|css|js|svg|json)$/.test(f) && /gzip/.test(req.headers['accept-encoding'] || '');
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream', ...(texto ? { 'Content-Encoding': 'gzip' } : {}) });
  (texto ? fs.createReadStream(f).pipe(zlib.createGzip()) : fs.createReadStream(f)).pipe(res);
});
srv.on('error', (e) => { console.error('El puerto 8961 está ocupado: ' + e.message); process.exit(2); });
await new Promise((r) => srv.listen(8961, r));
const b = await chromium.launch({ args: ['--disable-3d-apis'] });
const resultados = [];
try {
  for (const [n, reducido] of [[1, false], [2, false], [3, false], [4, true]]) {
    const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, reducedMotion: reducido ? 'reduce' : 'no-preference' });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await ctx.route(/open-meteo\.com/, (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"current":{"time":"2026-11-25T14:15","temperature_2m":13,"weather_code":1,"is_day":1,"wind_speed_10m":20,"wind_direction_10m":290,"wave_height":2,"wave_period":9,"wave_direction":300}}' }));
    await ctx.route(/\/js\/lugar\.js|\/vendor\//, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
    await ctx.route(/\/css\/lugar\.css/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await ctx.addInitScript(() => {
      try { localStorage.setItem('montemar-cookies', 'si'); } catch (e) {}
      window.__lcp = null; window.__long = []; window.__ev = [];
      try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__ev.push(Math.round(e.duration)))).observe({ type: 'event', buffered: true, durationThreshold: 16 }); } catch (e) {}
      new PerformanceObserver((l) => { const e = l.getEntries().pop(); window.__lcp = { t: e.startTime, que: e.url ? e.url.split('/').pop() : (e.element ? e.element.tagName + '.' + String(e.element.className || '').split(' ')[0] : '?') }; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: true });
    });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    let bytes = 0, reqs = 0;
    cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; reqs++; });
    await page.goto('http://localhost:8961/index.html?sin-webgl', { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => ({ lcp: window.__lcp, long: window.__long }));
    await page.touchscreen.tap(200, 260);
    await page.evaluate(() => document.querySelector('.estancias__indice').scrollIntoView());
    await page.locator('.estancias__indice a[data-est="chalet"]').tap();
    await page.waitForTimeout(600);
    r.inp = await page.evaluate(() => Math.max(0, ...window.__ev));
    resultados.push(Math.round(r.lcp?.t ?? 99999));
    console.log(`pasada ${n}${reducido ? ' (movimiento reducido)' : ''}: LCP ${Math.round(r.lcp?.t ?? -1)} ms (${r.lcp?.que}) · ${reqs} peticiones, ${(bytes / 1024).toFixed(0)} KB hasta load · tareas largas ${JSON.stringify(r.long)} · INP aprox. ${r.inp} ms`);
    await ctx.close();
  }
} finally { await b.close(); srv.close(); }
const peor = Math.max(...resultados);
console.log(`\nLCP peor: ${peor} ms → ${peor <= 2500 ? 'dentro' : 'FUERA'} del presupuesto (≤ 2500 ms en móvil de gama media)`);
process.exitCode = peor <= 2500 ? 0 : 1;
