// Checks the built site in a real browser, as a reader would meet it, and exits non-zero if anything
// fails. It serves the site itself; it needs Node and Playwright with its Chromium
// (npm install playwright && npx playwright install chromium), and uses axe-core for an accessibility
// scan where it is installed (npm install axe-core).
//
//   node tools/check.js            every check
//   node tools/check.js zoom back  only those named
//
// What it checks:
//   built     the pages ask for the stylesheet and script by the stamp of their present contents, so that no
//             browser keeps an old script cached against new pages (python3 tools/build.py renews it)
//   pages     at a phone, a tablet, short and tall laptops and large screens, in both languages: no errors,
//             no failed or missing requests, no broken pictures; the layout each should have (the book,
//             the leaves on the desk, the leaves); no page of the book spilling into its foot margin; no
//             text running into a staff, a catchword or another block; nothing wider than the window
//   bind      wherever the book is bound, the page was kept from sight until it was (no flash of the page
//             unbound): the script at the head of src/page.html and geometry() in site.js agree
//   zoom      the reader's zoom (Ctrl +) makes the text larger at every step, whether the book holds it or not
//   back      turning pages adds nothing to the history; a jump by the thumb index does
//   names     one h1; headings in order; every picture described or hidden; every link and button named,
//             and no landmark named twice; with axe-core, no violations on the phone or without script
//   weight    a first visit fetches no more than the budget below, so a heavy file is caught when it comes
//   print     on paper the book is unbound and the thumb index is gone

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  console.error('Playwright is needed: npm install playwright && npx playwright install chromium');
  process.exit(2);
}

const ROOT = path.resolve(__dirname, '..');
const BUDGET_KB = { desk: 850, phone: 1000 };   // a first visit, with text as served compressed
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.json': 'application/json', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain' };

function serve() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'content-type': TYPES['.html'] });
      return res.end(fs.readFileSync(path.join(ROOT, '404.html')));
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

let failures = 0;
const pass = (name, detail = '') => console.log(`  ok    ${name}${detail ? '  ' + detail : ''}`);
const fail = (name, detail = '') => { failures++; console.log(`  FAIL  ${name}${detail ? '  ' + detail : ''}`); };
const expect = (ok, name, detail) => (ok ? pass(name, detail) : fail(name, detail));

// the layout the page is in
const MODE = () => { const c = document.documentElement.classList; return c.contains('bound') ? 'book' : c.contains('spread') ? 'desk' : c.contains('leaves') ? 'leaves' : 'page'; };

async function open(browser, base, url, ctxOpts = {}, init, day) {
  const ctx = await browser.newContext(ctxOpts);
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  if (day) await page.clock.setFixedTime(new Date(`${day}T15:00:00`));   // (the kalendar's day, and so its verse)
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`${r.status()} ${r.url()}`); });
  page.on('requestfailed', (r) => { if (!/\.mp4/.test(r.url())) errors.push(`failed ${r.url()}`); });
  await page.goto(base + url, { waitUntil: 'load' });
  await page.waitForTimeout(1300);
  return { ctx, page, errors };
}

const checks = {
  // the stamp tools/build.py puts on assets/site.css and site.js: the first ten of the SHA-256 of both, in order
  async built() {
    const h = crypto.createHash('sha256');
    for (const f of fs.readdirSync(path.join(ROOT, 'assets')).filter((f) => /^site\./.test(f)).sort()) h.update(fs.readFileSync(path.join(ROOT, 'assets', f)));
    const v = h.digest('hex').slice(0, 10);
    for (const page of ['index.html', 'es/index.html', '404.html']) {
      const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
      const stamps = [...html.matchAll(/\/assets\/site\.(?:css|js)\?v=([0-9a-f]+)/g)].map((m) => m[1]);
      expect(stamps.length > 0 && stamps.every((s) => s === v), `built: ${page} asks for site.css and site.js as they are`, stamps.every((s) => s === v) ? v : `has ${[...new Set(stamps)].join(', ')}, files are ${v}: run python3 tools/build.py`);
    }
  },

  async pages(browser, base) {
    const cases = [
      [1440, 900, '', 'book'], [1280, 720, 'es/', 'book'], [1366, 657, '', 'book'], [1366, 657, 'es/', 'book'],
      [1920, 1080, 'es/', 'book'], [2560, 1440, '', 'book'], [1280, 600, '', 'desk'], [1024, 600, 'es/', 'desk'],
      [820, 1180, '', 'leaves'], [390, 844, '', 'leaves'], [390, 844, 'es/', 'leaves'], [320, 640, 'es/', 'leaves'],
      // and the kalendar at its fullest, whatever day the check is run: a Sunday, its name in red, with
      // one of the longest of the verses
      [1366, 657, '', 'book', '2026-03-22'], [1366, 657, 'es/', 'book', '2026-02-08'],
    ];
    for (const [W, H, lang, want, day] of cases) {
      const name = `${W}x${H} ${lang || 'en/'}${day ? ` on ${day}` : ''}`;
      const { ctx, page, errors } = await open(browser, base, '/' + lang, { viewport: { width: W, height: H } }, undefined, day);
      // read the leaves down, so that every picture is asked for and every staff drawn
      if (want !== 'book') for (let y = 0; y < 12000; y += 600) { await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(40); }
      const r = await page.evaluate((MODE) => {
        const mode = new Function(`return (${MODE})()`)();
        const broken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.loading !== 'lazy').map((i) => i.src);
        const spill = [...document.querySelectorAll('.book .page')].filter((p) => p.scrollHeight > p.clientHeight + 1).map((p) => p.className);
        const wide = document.documentElement.scrollWidth > innerWidth + 1;
        const over = [];
        const boxes = (root) => [...root.querySelectorAll('p, h1, h2, .score, .catch, .plate, blockquote, .go, .facts, nav, .initial')]
          .map((e) => [e, e.getBoundingClientRect()]).filter(([, r]) => r.width && r.height);
        for (const page of document.querySelectorAll('.face:not([inert]) .page, main .page')) {
          const bs = boxes(page);
          for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
            const [a, ra] = bs[i], [c, rc] = bs[j];
            if (a.contains(c) || c.contains(a)) continue;
            const x = Math.min(ra.right, rc.right) - Math.max(ra.left, rc.left), y = Math.min(ra.bottom, rc.bottom) - Math.max(ra.top, rc.top);
            if (x > 2 && y > 2) over.push(`${a.className || a.tagName} / ${c.className || c.tagName}`);
          }
        }
        return { mode, broken, spill, wide, over };
      }, MODE.toString());
      const bad = [
        r.mode !== want && `${r.mode}, not ${want}`, errors.length && `errors: ${errors.slice(0, 3).join('; ')}`,
        r.broken.length && `broken: ${r.broken.join(', ')}`, r.spill.length && `spills: ${r.spill.join(', ')}`,
        r.wide && 'wider than the window', r.over.length && `overlaps: ${r.over.slice(0, 3).join('; ')}`,
      ].filter(Boolean);
      expect(!bad.length, `pages ${name}`, bad.join(' | ') || r.mode);
      await ctx.close();
    }
  },

  async bind(browser, base) {
    for (const [W, H] of [[960, 644], [1000, 650], [1100, 650], [1366, 657], [1440, 900], [1280, 600], [959, 800]]) {
      const { ctx, page, errors } = await open(browser, base, '/', { viewport: { width: W, height: H } }, () => {
        window.__hidden = false;
        new MutationObserver(() => { if (document.documentElement.classList.contains('binding')) window.__hidden = true; })
          .observe(document, { attributes: true, subtree: true, attributeFilter: ['class'] });
      });
      const [mode, hidden, still] = await page.evaluate((MODE) => [new Function(`return (${MODE})()`)(), window.__hidden, document.documentElement.classList.contains('binding')], MODE.toString());
      expect(!(mode === 'book' && !hidden) && !still && !errors.length, `bind ${W}x${H}`,
        mode === 'book' && !hidden ? 'the book was bound with the page in sight' : still ? 'the page is still hidden' : errors.join('; ') || `${mode}${hidden ? ', hidden until bound' : ''}`);
      await ctx.close();
    }
  },

  async zoom(browser, base) {
    // the window's outer width stays in the screen's pixels while the page is zoomed, as Chromium has it
    const sizes = [];
    for (const f of [1, 1.1, 1.25, 1.5, 2]) {
      const { ctx, page, errors } = await open(browser, base, '/#worldviews',
        { viewport: { width: Math.round(1920 / f), height: Math.round(1040 / f) }, deviceScaleFactor: f },
        () => Object.defineProperty(window, 'outerWidth', { get: () => 1920 }));
      const r = await page.evaluate((MODE) => {
        // the text of the Worldviews' right page (the first red one, in the page and in the book alike),
        // at its size on the screen: the book is zoomed as a whole
        const shown = document.querySelector('.page-r.red');
        const scale = shown.getBoundingClientRect().width / shown.offsetWidth;
        return { mode: new Function(`return (${MODE})()`)(), px: parseFloat(getComputedStyle(shown).fontSize) * scale * devicePixelRatio };
      }, MODE.toString());
      sizes.push([r.px, `${Math.round(f * 100)}% ${r.mode} ${r.px.toFixed(1)}px`]);
      if (errors.length) fail(`zoom ${Math.round(f * 100)}%`, errors.join('; '));
      await ctx.close();
    }
    const grows = sizes.every(([px], i) => i === 0 || px > sizes[i - 1][0]);
    expect(grows, 'zoom: the text grows at every step', sizes.map((s) => s[1]).join(' → '));
  },

  async back(browser, base) {
    const { ctx, page } = await open(browser, base, '/404.html', { viewport: { width: 1440, height: 900 } });
    await page.goto(base + '/'); await page.waitForTimeout(1200);
    for (let i = 0; i < 3; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1150); }
    await page.goBack(); await page.waitForTimeout(600);
    expect(page.url().endsWith('/404.html'), 'back: one press leaves the book after turning', page.url());
    await page.goto(base + '/#scriptura'); await page.waitForTimeout(1300);
    await page.click('.thumb[href="#revelation"]'); await page.waitForTimeout(1500);
    await page.goBack(); await page.waitForTimeout(1500);
    const at = await page.evaluate(() => location.hash);
    expect(at === '#scriptura', 'back: a jump by the thumb index is retraced', at);
    await ctx.close();
  },

  async names(browser, base) {
    let axeSource = null;
    try { axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'); } catch (e) {}
    for (const [label, opts, url] of [['phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, '/'],
      ['phone es', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, '/es/'], ['book', { viewport: { width: 1440, height: 900 } }, '/']]) {
      const { ctx, page } = await open(browser, base, url, opts);
      const r = await page.evaluate(() => {
        const out = [];
        const name = (e) => (e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') && e.getAttribute('aria-labelledby').split(' ').map((id) => (document.getElementById(id) || {}).textContent || '').join(' ') || e.textContent || '').trim()
          || [...e.querySelectorAll('img[alt]')].map((i) => i.alt).join(' ').trim();
        if (document.querySelectorAll('h1').length !== 1) out.push('not one h1');
        let last = 0;
        for (const h of document.querySelectorAll('h1, h2, h3, h4')) { const n = +h.tagName[1]; if (n > last + 1) out.push(`${h.tagName} after h${last}: ${h.textContent.trim()}`); last = n; }
        for (const i of document.images) if (!i.hasAttribute('alt')) out.push(`picture without alt: ${i.src}`);
        for (const e of document.querySelectorAll('a[href], button')) {
          if (e.closest('[aria-hidden="true"], [hidden]') || e.getAttribute('aria-hidden') === 'true') continue;
          if (!name(e)) out.push(`unnamed ${e.tagName.toLowerCase()}.${e.className}`);
        }
        // the contents' folio numerals are for the eye: read aloud they would run into the titles
        for (const n of document.querySelectorAll('.contents .c-fol')) if (n.getAttribute('aria-hidden') !== 'true') out.push(`folio numeral read with its title: ${n.parentElement.textContent.trim()}`);
        const marks = {};
        for (const l of document.querySelectorAll('main, nav, header, footer, aside, section[aria-label], section[aria-labelledby], form')) {
          if (l.closest('[aria-hidden="true"]')) continue;
          const key = `${l.tagName}:${name(l).slice(0, 40)}`;
          if (l.tagName !== 'SECTION' && l.tagName !== 'NAV') continue;
          if (marks[key]) out.push(`landmark named twice: ${key}`);
          marks[key] = 1;
        }
        if (!document.documentElement.lang) out.push('no lang');
        return out;
      });
      expect(!r.length, `names ${label}`, r.slice(0, 5).join(' | '));
      if (axeSource && label !== 'book') {
        await page.evaluate((src) => { (0, eval)(src); }, axeSource);
        const v = await page.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations.map((x) => `${x.id} (${x.nodes.length})`));
        expect(!v.length, `axe ${label}`, v.join(', '));
      }
      await ctx.close();
    }
    if (!axeSource) console.log('  --    axe-core is not installed: its scan was skipped');
  },

  async weight(browser, base) {
    for (const [label, opts] of [['desk', { viewport: { width: 1440, height: 900 } }], ['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }]]) {
      const ctx = await browser.newContext(opts);
      const page = await ctx.newPage();
      const sizes = [];
      page.on('response', async (r) => {
        try {
          const b = await r.body();
          const text = /text|javascript|xml|svg/.test(r.headers()['content-type'] || '');
          sizes.push([r.url().replace(base, ''), text ? zlib.gzipSync(b).length : b.length]);
        } catch (e) {}
      });
      await page.goto(base + '/', { waitUntil: 'load' });
      await page.waitForTimeout(2000);
      const kb = Math.round(sizes.reduce((a, [, n]) => a + n, 0) / 1024);
      const heavy = sizes.sort((a, b) => b[1] - a[1]).slice(0, 3).map(([u, n]) => `${u} ${Math.round(n / 1024)}KB`).join(', ');
      expect(kb <= BUDGET_KB[label], `weight ${label}: ${kb} KB of ${BUDGET_KB[label]}`, `heaviest: ${heavy}`);
      await ctx.close();
    }
  },

  // the letter on the calendar page: a reading for every day of the year, morning and evening; it opens over
  // the book and on a phone, takes the focus, and is put away by Esc and by Back, giving the focus back
  async letter(browser, base) {
    const dir = require('path').join(__dirname, '..', 'assets', 'morning-evening');
    const days = require('fs').readdirSync(dir).filter((f) => f.endsWith('.json'));
    const bad = days.filter((f) => { const d = JSON.parse(require('fs').readFileSync(require('path').join(dir, f), 'utf8')); return !(d.m && d.e && d.m.body.length && d.e.body.length && d.m.ref && d.e.ref); });
    expect(days.length === 366 && !bad.length, 'letter: 366 days, each a morning and an evening', `${days.length} files; incomplete: ${bad.join(', ')}`);
    for (const [label, opts, how] of [['book', { viewport: { width: 1440, height: 900 } }, 'Escape'], ['phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, 'Back']]) {
      const { ctx, page, errors } = await open(browser, base, '/', opts, null, '2026-11-23');
      await page.evaluate(() => document.querySelector('.envelope').scrollIntoView({ block: 'center' }));
      await page.click('.envelope');
      await page.waitForFunction(() => document.activeElement && document.activeElement.classList.contains('me-scroll'), null, { timeout: 8000 }).catch(() => {});
      const o = await page.evaluate(() => ({ open: document.querySelector('.me-letter').open, words: document.querySelector('.me-body').textContent.split(/\s+/).length, inside: !!document.activeElement.closest('.me-letter') }));
      expect(o.open && o.words > 200 && o.inside, `letter ${label}: opens with the reading, focus within`, JSON.stringify(o));
      if (how === 'Back') await page.goBack(); else await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.me-letter').open, null, { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(800);   // (the book's last steps home)
      const c = await page.evaluate(() => ({ open: document.querySelector('.me-letter').open, focus: document.activeElement.className, book: document.querySelector('.book') ? getComputedStyle(document.querySelector('.book')).transform : 'none', at: location.pathname }));
      expect(!c.open && c.focus === 'envelope' && c.book === 'none' && c.at === '/', `letter ${label}: ${how} puts it away`, JSON.stringify(c));
      expect(!errors.length, `letter ${label}: no errors`, errors.join('; '));
      await ctx.close();
    }
    const { ctx, page } = await open(browser, base, '/es/', { viewport: { width: 1440, height: 900 } });
    expect(!(await page.$('.envelope')), 'letter: none on the Spanish page (no free Spanish text yet)');
    await ctx.close();
  },

  async print(browser, base) {
    const { ctx, page } = await open(browser, base, '/', { viewport: { width: 1440, height: 900 } });
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await page.emulateMedia({ media: 'print' });
    const r = await page.evaluate(() => ({ bound: document.documentElement.classList.contains('bound'), thumbs: getComputedStyle(document.querySelector('.thumbs')).display }));
    expect(!r.bound && r.thumbs === 'none', 'print: unbound, no thumb index', JSON.stringify(r));
    await ctx.close();
  },
};

(async () => {
  const want = process.argv.slice(2);
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  for (const [name, run] of Object.entries(checks)) {
    if (want.length && !want.includes(name)) continue;
    console.log(name);
    try { await run(browser, base); } catch (e) { fail(name, e.message.split('\n')[0]); }
  }
  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} failed` : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
