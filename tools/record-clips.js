// Record the short silent clips that play over each work's plate when a pointer rests on it:
//   node tools/record-clips.js [id ...]
//
// Each work's own site is served locally (see WORKS below for the folders it expects beside
// this repository) and stepped through frame by frame on a virtual clock, so a page that is
// slow to draw never drops a frame. Every clip opens on, or comes to rest on, the frame its
// plate shows. Frames go to tools/.cache/clips/<id>/ (not committed), and ffmpeg writes
// assets/works/<id>.mp4 (H.264, 960x540, no sound). Needs Node with Playwright and
// Chromium, and ffmpeg.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const SITES = path.resolve(ROOT, '..', 'andresmessina-sdg');   // the works' repositories, cloned side by side
const CACHE = path.join(ROOT, 'tools', '.cache', 'clips');
const FPS = 30;
const W = 1200, H = 675;

// For each work: the folder of its site, the address of its plate's frame, how long to let it
// settle (real milliseconds), how long the clip runs, and what happens in it (at virtual
// milliseconds from its start). dsf is the pixel density; the WebGL painting is drawn at 1,
// since every frame of it is painted in software here.
const WORKS = {
  'church-history': {
    // the river runs in from Pentecost to today, as it does when the page opens, and comes to rest as the plate
    dir: 'church-history', url: '/index.html', settle: 4000, seconds: 4, fromLoad: true, dsf: 1,
  },
  worldviews: {
    // Christian theism, from Redemption on to New Creation
    dir: 'worldviews-in-motion', url: '/index.html#christian/redemption', settle: 25000, seconds: 5,
    dsf: 1, mouse: [1150, 250],
    script: [[600, (p) => p.keyboard.press('ArrowRight')]],
  },
  revelation: {
    // question 20, read on down the page
    dir: 'revelation-explainer', url: '/index.html#resurrection', settle: 4000, seconds: 6.5,
    script: [[700, (p) => smoothScroll(p, 'y', 560, 4800)]],
  },
  'pilgrims-road': {
    // a pilgrim writes a name and sets out; the road map is the plate
    dir: 'the-pilgrims-road', url: '/index.html', settle: 3000, seconds: 4.5,
    script: [
      ...[...'Andres'].map((c, i) => [500 + i * 140, (p) => p.evaluate((c) => {
        const el = document.getElementById('pname');
        el.value += c;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, c)]),
      [1900, (p) => p.evaluate(() => document.querySelector('button[type=submit]').form.requestSubmit())],
    ],
  },
};

const ease = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// Scroll by a set distance over a set (virtual) time, easing in and out, on whatever scrolls
// the page: the document, or the scroller in it with the most room.
function smoothScroll(page, axis, dist, ms) {
  return page.evaluate(([axis, dist, ms, easeSrc]) => {
    const ease = new Function('t', `return (${easeSrc})(t)`);
    const prop = axis === 'x' ? 'scrollLeft' : 'scrollTop';
    const [full, seen] = axis === 'x' ? ['scrollWidth', 'clientWidth'] : ['scrollHeight', 'clientHeight'];
    let el = document.scrollingElement, best = el[full] - el[seen];
    for (const c of document.querySelectorAll('*')) {
      const room = c[full] - c[seen];
      if (room > best && /(auto|scroll)/.test(getComputedStyle(c)[axis === 'x' ? 'overflowX' : 'overflowY'])) { el = c; best = room; }
    }
    const from = el[prop], t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / ms);
      el[prop] = from + dist * ease(t);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [axis, dist, ms, ease.toString()]);
}

function serve(dir) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
    '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(dir, p);
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

async function record(browser, id, work) {
  const dir = path.join(SITES, work.dir);
  if (!fs.existsSync(dir)) throw new Error(`${id}: clone its site to ${dir} first`);
  const server = await serve(dir);
  const out = path.join(CACHE, id);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const frames = Math.round(work.seconds * FPS);

  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: work.dsf || 2 });
  const [mx, my] = work.mouse || [W - 5, H - 5];
  await page.mouse.move(mx, my);
  await page.goto(`http://127.0.0.1:${server.address().port}${work.url}`, { waitUntil: 'load' });
  await page.mouse.move(mx + 1, my + 1);   // (a page learns where the pointer is only when it moves)
  await page.waitForTimeout(work.settle);

  const cdp = await page.context().newCDPSession(page);
  if (work.fromLoad) await screencast(page, cdp, work, frames, out);
  else await stepped(page, cdp, work, frames, out, id);
  await page.close();
  server.close();

  const mp4 = path.join(ROOT, 'assets', 'works', `${id}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(out, 'f%04d.jpg'),
    '-vf', 'scale=960:540:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '26',
    '-profile:v', 'high', '-movflags', '+faststart', '-an', mp4]);
  console.log(`wrote assets/works/${id}.mp4 (${(fs.statSync(mp4).size / 1024).toFixed(0)} KB)`);
}

// A page that draws itself in as it loads keeps to the real clock, not the virtual one: open it
// again and film it as the browser paints it, then lay those frames on an even 30 a second.
async function screencast(page, cdp, work, frames, out) {
  const shots = [];
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    shots.push({ data: Buffer.from(data, 'base64'), t: metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, everyNthFrame: 1 });
  await page.reload({ waitUntil: 'commit' });
  await page.waitForTimeout(work.seconds * 1000 + 1500);
  await cdp.send('Page.stopScreencast');
  // start from the barest frame of the new page in its first second and a half, before the river runs
  // (the frames before it still show the page as it was before the reload)
  const early = shots.filter((s) => s.t < shots[0].t + 1.5 && s.data.length > 20000);
  const bare = early.reduce((a, b) => (b.data.length < a.data.length ? b : a));
  const kept = shots.slice(shots.indexOf(bare));
  for (let f = 0, k = 0; f < frames; f++) {
    const t = kept[0].t + f / FPS;
    while (k + 1 < kept.length && kept[k + 1].t <= t) k++;
    fs.writeFileSync(path.join(out, `f${String(f).padStart(4, '0')}.jpg`), kept[k].data);
  }
}

async function stepped(page, cdp, work, frames, out, id) {
  await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pause' });
  const advance = (ms) => new Promise((ok) => {
    cdp.once('Emulation.virtualTimeBudgetExpired', ok);
    cdp.send('Emulation.setVirtualTimePolicy', { policy: 'advance', budget: ms });
  });
  const script = [...(work.script || [])];
  for (let f = 0; f < frames; f++) {
    while (script.length && script[0][0] <= f * 1000 / FPS) await script.shift()[1](page);
    await advance(1000 / FPS);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 95 });
    fs.writeFileSync(path.join(out, `f${String(f).padStart(4, '0')}.jpg`), Buffer.from(data, 'base64'));
    if (f % 30 === 29) process.stdout.write(`${id}: ${f + 1}/${frames}\n`);
  }
}

(async () => {
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(WORKS);
  const browser = await chromium.launch();
  for (const id of ids) await record(browser, id, WORKS[id]);
  await browser.close();
})();
