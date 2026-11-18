#!/usr/bin/env node
// Render the share images and icons from the same initial the page opens with (a real
// thirteenth-century Bible initial, assets/book/initial-a.webp), on the same parchment:
//   node tools/render-images.js
// Writes assets/og-en.png, assets/og-es.png, assets/icon-192.png,
// apple-touch-icon.png and the PNGs that tools/make-favicon.py packs into favicon.ico.
// Needs Playwright with Chromium. Serves the repository locally so the site's own fonts load.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'assets/site.css'), 'utf8');
const fontFaces = css.slice(0, css.indexOf(':root'));

const TYPES = { '.woff2': 'font/woff2', '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.webp': 'image/webp' };
const pages = {};

const og = (lang) => {
  const t = lang === 'es'
    ? { sub: 'Obras sobre las Escrituras y la iglesia', works: ['Scriptura', 'Worldviews in Motion', 'A History of the Christian Church', 'The Pilgrim’s Road', 'Apocalipsis: El Códice Iluminado'] }
    : { sub: 'Works on Scripture and the church', works: ['Scriptura', 'Worldviews in Motion', 'A History of the Christian Church', 'The Pilgrim’s Road', 'Revelation: The Illuminated Codex'] };
  return `<!doctype html><html lang="${lang}"><meta charset="utf-8"><style>${fontFaces}
  html,body{margin:0}
  body{width:1200px;height:630px;box-sizing:border-box;padding:0 92px;display:grid;grid-template-columns:272px 1fr;gap:60px;align-items:center;
    background:#FAF6ED url("/assets/book/paper.webp") 0 0 / 720px 720px;
    color:#2A2420;font-family:"EB Garamond",serif}
  .ini img{width:272px;height:auto;display:block;border-radius:2px;box-shadow:0 0 0 .5px rgba(60,40,10,.3),0 2px 4px rgba(60,40,10,.3)}
  .jj{font-family:"IM Fell English SC";color:#A27A28;font-size:26px;letter-spacing:.1em;margin:0 0 22px}
  h1{margin:0;font-weight:400;font-size:98px;line-height:.95;letter-spacing:-.012em}
  .sub{margin:18px 0 0;font-family:"IM Fell English SC";color:#B0361F;font-size:30px;letter-spacing:.05em}
  .staff{height:17px;margin:34px 0 0;position:relative;background:repeating-linear-gradient(to bottom,#D9CCB1 0 1px,transparent 1px 4px) no-repeat;background-size:100% 17px}
  .staff::after{content:"";position:absolute;right:0;top:0;width:8px;height:17px;background:linear-gradient(to right,#2A2420 0 1px,transparent 1px 3.5px,#2A2420 3.5px 8px)}
  .works{margin:18px 0 0;font-family:"IM Fell English SC";font-size:22px;letter-spacing:.04em;color:#685E50;line-height:1.45}
  .works b{font-weight:400;color:#A27A28;padding:0 .35em}
  .sdg{margin:16px 0 0;text-align:right;font-weight:600;font-size:40px;letter-spacing:.14em;margin-right:-.14em;
    background:url("/assets/book/gold.webp") center / 160px 160px;-webkit-background-clip:text;background-clip:text;color:transparent;
    -webkit-text-stroke:.4px #6E4F12}
  </style><body>
  <div class="ini"><img src="/assets/book/initial-a.webp" alt=""></div>
  <div><p class="jj">J.J.</p><h1>Andres Messina</h1><p class="sub">${t.sub}</p><div class="staff"></div>
  <p class="works">${t.works[0]}<b>·</b>${t.works[1]}<br>${t.works[2]}<b>·</b>${t.works[3]}<br>${t.works[4]}</p><p class="sdg">S.D.G.</p></div>
  </body></html>`;
};

// The icon: the initial alone, cut square from its top, where the A's stem, its bar and the gold are.
const icon = (size, small, pad) => `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;background:${pad ? '#F7F2E6' : 'transparent'}}
  body{width:${size}px;height:${size}px;display:grid;place-items:center}
  div{width:${pad ? Math.round(size * 0.84) : size}px;height:${pad ? Math.round(size * 0.84) : size}px;border-radius:${small ? 1 : Math.round(size * 0.04)}px;
    background:url("/assets/book/initial-a.webp") center ${small ? '22%' : '30%'} / ${small ? '118%' : '100%'} auto no-repeat}
  </style><body><div></div></body>`;

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
