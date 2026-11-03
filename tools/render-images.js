#!/usr/bin/env node
// Render the share images and icons from the same gilded initial the page uses:
//   node tools/render-images.js
// Writes assets/og-en.png, assets/og-es.png, assets/icon-192.png,
// apple-touch-icon.png and the PNGs that tools/make-favicon.py packs into favicon.ico.
// Needs Playwright with Chromium. Serves the repository locally so the site's own fonts load.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const initial = fs.readFileSync(path.join(ROOT, 'src/initial.svg'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'assets/site.css'), 'utf8');
const fontFaces = css.slice(0, css.indexOf(':root'));

const TYPES = { '.woff2': 'font/woff2', '.html': 'text/html; charset=utf-8', '.css': 'text/css' };
const pages = {};

const og = (lang) => {
  const t = lang === 'es'
    ? { sub: 'Obras sobre las Escrituras y la iglesia', works: ['Scriptura', 'A History of the Christian Church', 'Apocalipsis: El Códice Iluminado', 'The Pilgrim’s Road'] }
    : { sub: 'Works on Scripture and the church', works: ['Scriptura', 'A History of the Christian Church', 'Revelation: The Illuminated Codex', 'The Pilgrim’s Road'] };
  return `<!doctype html><html lang="${lang}"><meta charset="utf-8"><style>${fontFaces}
  html,body{margin:0}
  body{width:1200px;height:630px;box-sizing:border-box;padding:0 92px;display:grid;grid-template-columns:272px 1fr;gap:60px;align-items:center;
    background:#F7F2E6 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .42 0 0 0 0 .33 0 0 0 0 .2 0 0 0 .07 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    color:#2A2420;font-family:"EB Garamond",serif}
  .ini svg{width:272px;height:272px;display:block;overflow:visible;filter:drop-shadow(0 2px 1px rgba(80,55,10,.25))}
  .jj{font-family:"IM Fell English SC";color:#A27A28;font-size:26px;letter-spacing:.1em;margin:0 0 22px}
  h1{margin:0;font-weight:400;font-size:98px;line-height:.95;letter-spacing:-.012em}
  .sub{margin:18px 0 0;font-family:"IM Fell English SC";color:#B0361F;font-size:30px;letter-spacing:.05em}
  .staff{height:17px;margin:34px 0 0;position:relative;background:repeating-linear-gradient(to bottom,#D9CCB1 0 1px,transparent 1px 4px) no-repeat;background-size:100% 17px}
  .staff::after{content:"";position:absolute;right:0;top:0;width:8px;height:17px;background:linear-gradient(to right,#2A2420 0 1px,transparent 1px 3.5px,#2A2420 3.5px 8px)}
  .works{margin:18px 0 0;font-family:"IM Fell English SC";font-size:22px;letter-spacing:.04em;color:#6F6556;line-height:1.45}
  .works b{font-weight:400;color:#A27A28;padding:0 .35em}
  .sdg{margin:16px 0 0;text-align:right;font-weight:600;font-size:40px;letter-spacing:.14em;margin-right:-.14em;
    background:linear-gradient(to bottom,#F0DA94 0%,#C9A045 42%,#A27A28 70%,#7C5B19 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
  </style><body>
  <div class="ini">${initial}</div>
  <div><p class="jj">J.J.</p><h1>Andres Messina</h1><p class="sub">${t.sub}</p><div class="staff"></div>
  <p class="works">${t.works[0]}<b>·</b>${t.works[1]}<br>${t.works[2]}<b>·</b>${t.works[3]}</p><p class="sdg">S.D.G.</p></div>
  </body></html>`;
};

// The icon: the initial alone. Small sizes drop the vine and dots, which only blur.
const icon = (size, small, pad) => `<!doctype html><meta charset="utf-8"><style>${fontFaces}
  html,body{margin:0;background:${pad ? '#F7F2E6' : 'transparent'}}
  body{width:${size}px;height:${size}px;display:grid;place-items:center}
  svg{width:${pad ? Math.round(size * 0.8) : size}px;height:${pad ? Math.round(size * 0.8) : size}px;display:block}
  ${small ? 'svg g[clip-path], svg rect[fill="url(#dots)"], svg g[fill="#F7F2E6"]{display:none}' : ''}
  </style><body>${initial.replace('viewBox="0 0 120 120"', pad ? 'viewBox="-2 -2 124 124"' : 'viewBox="3 3 114 114"')}</body>`;

pages['/og-en.html'] = og('en');
pages['/og-es.html'] = og('es');

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (pages[url]) { res.writeHead(200, { 'content-type': TYPES['.html'] }); return res.end(pages[url]); }
  const file = path.join(ROOT, url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const shoot = async (name, html, w, h, out, transparent) => {
    pages[name] = html;
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await page.goto(base + name, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(ROOT, out), omitBackground: !!transparent });
    await page.close();
    console.log('wrote', out);
  };
  await shoot('/og-en.html', pages['/og-en.html'], 1200, 630, 'assets/og-en.png');
  await shoot('/og-es.html', pages['/og-es.html'], 1200, 630, 'assets/og-es.png');
  await shoot('/i180.html', icon(180, false, true), 180, 180, 'apple-touch-icon.png');
  await shoot('/i192.html', icon(192, false, false), 192, 192, 'assets/icon-192.png', true);
  for (const s of [16, 32, 48]) {
    await shoot(`/i${s}.html`, icon(s, true, false), s, s, `tools/favicon-${s}.png`, true);
  }
  await browser.close();
  server.close();
})();
