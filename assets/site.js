// The little that moves on this page, and the book it becomes on a wide screen. Nothing here is
// needed to read it: without this script the page is one finished leaf. Nothing moves for readers
// who ask for stillness, and nothing sounds unless it is asked for.
(() => {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const main = document.getElementById('main');
  let UI = {};
  try { UI = JSON.parse((main && main.dataset.ui) || '{}'); } catch (e) {}
  const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'];
  const el = (tag, cls, attrs = {}) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };


  // ---------------------------------------------------------------------------------------------
  // The organ: a small principal chorus in a stone room, made in the browser. It plays what a staff
  // carries in its data-play attribute (from tools/engrave.py): every voice as [start, length, MIDI
  // note] in beats, and the times at which each of its written notes sounds, to light them.
  const Organ = (() => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    let ctx = null, out = null, wave = null, current = null;
    function room() {
      ctx = new Ctx();
      const len = Math.floor(ctx.sampleRate * 3.2);
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
      }
      const verb = ctx.createConvolver();
      verb.buffer = ir;
      const wet = ctx.createGain(); wet.gain.value = 0.4;
      const dry = ctx.createGain(); dry.gain.value = 0.75;
      const limit = ctx.createDynamicsCompressor();
      limit.threshold.value = -14; limit.ratio.value = 6;
      out = ctx.createGain(); out.gain.value = 0.3;
      out.connect(dry).connect(limit);
      out.connect(verb).connect(wet).connect(limit);
      limit.connect(ctx.destination);
      const real = new Float32Array(9), imag = new Float32Array(9);
      [0, 1, 0.55, 0.3, 0.34, 0.07, 0.14, 0, 0.1].forEach((v, i) => { imag[i] = v; });
      wave = ctx.createPeriodicWave(real, imag);
    }
    function pipe(midi, at, len, level, nodes) {
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(level, at + 0.05);
      env.gain.setValueAtTime(level, at + len);
      env.gain.exponentialRampToValueAtTime(0.0001, at + len + 0.28);
      env.connect(out);
      const ranks = midi < 52 ? [[freq, 1], [freq / 2, 0.3]] : [[freq, 1]];   // a 16' stop under the bass
      for (const [f, g] of ranks) {
        const o = ctx.createOscillator();
        o.setPeriodicWave(wave);
        o.frequency.value = f;
        const v = ctx.createGain(); v.gain.value = g;
        o.connect(v).connect(env);
        o.start(at); o.stop(at + len + 0.32);
        nodes.push(o);
      }
      // the breath of air as the pipe speaks
      const n = ctx.createBufferSource();
      const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.07), ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      n.buffer = b;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq * 4; bp.Q.value = 3;
      const ng = ctx.createGain(); ng.gain.value = 0.08 * level;
      n.connect(bp).connect(ng).connect(out);
      n.start(at);
      nodes.push(n);
      nodes.push(env);
    }
    function stop() {
      if (!current) return;
      const c = current;
      current = null;
      c.timers.forEach(clearTimeout);
      c.lights.forEach((e) => e.classList.remove('lit'));
      c.done();
      if (ctx) {
        const t = ctx.currentTime;
        for (const n of c.nodes) {
          if (n.gain) { try { n.gain.cancelScheduledValues(t); n.gain.setTargetAtTime(0, t, 0.06); } catch (e) {} }
          else { try { n.stop(t + 0.3); } catch (e) {} }
        }
      }
    }
    // play(svg, lightsFor, done): lightsFor(i) gives the elements to light for note i
    function play(svg, lightsFor, done = () => {}) {
      if (!Ctx || !svg || !svg.dataset.play) return;
      let data;
      try { data = JSON.parse(svg.dataset.play); } catch (e) { return; }
      stop();
      if (!ctx) room();
      if (ctx.state === 'suspended') ctx.resume();
      const beat = data.beat, t0 = ctx.currentTime + 0.08;
      const voices = new Set(data.events.map((e) => e[0])).size > data.lights.length ? 0.6 : 1;
      const c = { nodes: [], timers: [], lights: [], done };
      for (const [s, l, m] of data.events) pipe(m, t0 + s * beat, Math.max(0.08, l * beat - 0.03), 0.5 * voices, c.nodes);
      data.lights.forEach((s, i) => {
        c.timers.push(setTimeout(() => {
          c.lights.forEach((e) => e.classList.remove('lit'));
          c.lights = lightsFor(i);
          c.lights.forEach((e) => e.classList.add('lit'));
        }, (0.08 + s * beat) * 1000));
      });
      const end = Math.max(...data.events.map(([s, l]) => s + l)) * beat;
      c.timers.push(setTimeout(() => { if (current === c) stop(); }, (0.08 + end + 0.4) * 1000));
      current = c;
    }
    return { ok: !!Ctx, play, stop };
  })();

  // every staff is an instrument: press it to hear its line in Bach's four parts
  function playStaff(score) {
    const svg = score.querySelector('svg[data-play]');
    const notes = svg ? svg.querySelectorAll('.n') : [];
    Organ.play(svg, (i) => (notes[i] ? [notes[i]] : []));
  }
  if (Organ.ok) {
    for (const score of document.querySelectorAll('.score')) {
      const svg = score.querySelector('svg[data-play]');
      if (!svg) continue;
      score.setAttribute('role', 'button');
      score.tabIndex = 0;
      score.setAttribute('aria-label', `${UI.play_line || 'Play'}: ${svg.getAttribute('aria-label') || ''}`);
      score.addEventListener('click', () => playStaff(score));
      score.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playStaff(score); }
      });
    }
    // B-A-C-H, his name in German note names, each note and letter lit as it sounds
    const motif = document.querySelector('.motif-play');
    if (motif) {
      motif.hidden = false;
      const svg = motif.querySelector('svg.motif');
      const notes = motif.querySelectorAll('.motif .n'), letters = motif.querySelectorAll('.motif-letters text');
      motif.addEventListener('click', () => {
        motif.classList.add('playing');
        Organ.play(svg, (i) => [notes[i], letters[i]].filter(Boolean), () => motif.classList.remove('playing'));
      });
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Moving plates: a short silent clip of each work, laid over its picture. Where a pointer can rest
  // it plays while the pointer is on the plate, and in the book it plays once as the book opens to
  // it. Nothing is fetched until then, and nothing at all for readers who ask for stillness or where
  // the browser asks to save data.
  const hover = window.matchMedia('(hover: hover) and (pointer: fine)');
  const thrift = navigator.connection && navigator.connection.saveData;
  const clips = new Map();
  function clipFor(plate) {
    if (!plate || !plate.dataset.clip || still.matches || thrift) return null;
    let c = clips.get(plate);
    if (c) return c;
    const video = el('video', '', { 'aria-hidden': 'true' });
    video.muted = true; video.playsInline = true; video.preload = 'auto';
    video.disablePictureInPicture = true;
    video.tabIndex = -1;
    video.src = plate.dataset.clip;
    c = { video, wanted: false };
    video.addEventListener('playing', () => { if (c.wanted) video.classList.add('on'); });
    plate.appendChild(video);
    clips.set(plate, c);
    return c;
  }
  function playClip(plate) {
    const c = clipFor(plate);
    if (!c) return;
    c.wanted = true;
    c.video.currentTime = 0;
    const p = c.video.play();
    if (p && p.catch) p.catch(() => {});
  }
  function stopClip(plate) {
    const c = clips.get(plate);
    if (!c) return;
    c.wanted = false;
    c.video.classList.remove('on');
    setTimeout(() => { if (!c.wanted) c.video.pause(); }, 500);
  }
  for (const plate of document.querySelectorAll('.plate[data-clip]')) {
    const work = plate.closest('.work');
    work.addEventListener('pointerenter', () => { if (hover.matches) clipFor(plate); });
    plate.addEventListener('pointerenter', () => { if (hover.matches) playClip(plate); });
    plate.addEventListener('pointerleave', () => stopClip(plate));
    plate.addEventListener('focus', () => { if (hover.matches) playClip(plate); });
    plate.addEventListener('blur', () => stopClip(plate));
  }

  // ---------------------------------------------------------------------------------------------
  // The scribe at work: what the reader has not yet come to is marked .pending, and .inked when they
  // come to it, as it scrolls into view or as the book opens to it: staves engraved, versals washed
  // with colour, pen-flourishing drawn down the margin, plates laid, S.D.G. written and sealed.
  const INKS = '.versal, .score, .signature';
  function mark(scope, plates) {
    scope.querySelectorAll(plates ? INKS + ', .plate' : INKS).forEach((e) => e.classList.add('pending'));
  }
  function ink(scope) {
    for (const e of [scope, ...scope.querySelectorAll('.pending')]) {
      if (!e.classList.contains('pending')) continue;
      e.classList.replace('pending', 'inked');
      if (e.classList.contains('signature')) sign(e);
    }
  }
  function unmark() { document.querySelectorAll('.pending').forEach((e) => e.classList.remove('pending')); }
  // When the last pen stroke is down, lift the mask and let the light cross the gold.
  function sign(sig) {
    const strokes = sig.querySelectorAll('.sdg-pen path');
    const last = strokes[strokes.length - 1];
    const glint = document.getElementById('sdg-glint');
    if (!last) return;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      sig.classList.add('written');
      if (glint && glint.beginElement) { try { glint.beginElement(); } catch (e) {} }
    };
    last.addEventListener('animationend', finish, { once: true });
    setTimeout(finish, 5000);
  }
  // in the scrolling page: whatever is below the fold is drawn in as it comes into view
  let seen = null;
  function scrollScribe() {
    if (still.matches || !('IntersectionObserver' in window)) return;
    const fold = window.innerHeight * 0.9;
    seen = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        seen.unobserve(e.target);
        ink(e.target);
        const work = e.target.closest('.work');
        if (work && e.target.classList.contains('page-v')) ink(work);
      }
    }, { rootMargin: '0px 0px -12% 0px' });
    for (const page of document.querySelectorAll('.page')) {
      if (page.getBoundingClientRect().top < fold) continue;
      mark(page, true);
      const work = page.closest('.work');
      if (work && page.classList.contains('page-v')) work.classList.add('pending');
      page.classList.add('pending');
      seen.observe(page);
    }
  }
  function stopScrollScribe() { if (seen) { seen.disconnect(); seen = null; } }

  // ---------------------------------------------------------------------------------------------
  // The thumb index: a tab for each folio. In the book it stands out from the left edge and its links
  // turn the book (see onLink); on a narrow page it folds to the left edge as slim spines: a first
  // touch draws all the tabs out, a touch on one goes there, and anything else folds them away.
  const thumbs = document.querySelector('.thumbs');
  const tabs = thumbs ? [...thumbs.querySelectorAll('.thumb')] : [];
  function markThumb(k) { tabs.forEach((t, i) => (i === k ? t.setAttribute('aria-current', 'true') : t.removeAttribute('aria-current'))); }
  function slimThumbs() {
    if (!thumbs) return;
    root.classList.add('thumbable');
    thumbs.classList.add('slim');      // the leaves (below) tell it which folio is open
  }
  // Folded, the spines do not say what they are; so once in a visit they are drawn out for a moment
  // as the page opens, and folded again.
  function hintThumbs() {
    if (!thumbs || still.matches || root.classList.contains('spread') || !thumbs.classList.contains('slim')) return;
    try { if (sessionStorage.getItem('thumbs-shown')) return; sessionStorage.setItem('thumbs-shown', '1'); } catch (e) { return; }
    setTimeout(() => {
      if (!thumbs.classList.contains('slim') || root.classList.contains('spread') || window.scrollY > 40) return;
      thumbs.classList.add('open');
      setTimeout(() => thumbs.classList.remove('open'), 1700);
    }, 900);
  }
  if (thumbs) {
    thumbs.addEventListener('click', (e) => {
      if (!thumbs.classList.contains('slim')) return;           // in the book, onLink turns to it
      if (root.classList.contains('spread')) return;            // lettered on the desk: a click goes straight there
      const a = e.target.closest('.thumb');
      if (!a) return;
      if (!thumbs.classList.contains('open')) { e.preventDefault(); thumbs.classList.add('open'); return; }
      thumbs.classList.remove('open');                           // and the link takes the reader there
    });
    const fold = (e) => { if (thumbs.classList.contains('open') && !thumbs.contains(e.target)) thumbs.classList.remove('open'); };
    document.addEventListener('pointerdown', fold);
    window.addEventListener('scroll', () => { if (thumbs.classList.contains('open')) thumbs.classList.remove('open'); }, { passive: true });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') thumbs.classList.remove('open'); });
  }

  // ---------------------------------------------------------------------------------------------
  // Leaves. Where the page is read down (a phone, a narrow or a short window), each folio is a leaf
  // laid over the one before, as the eras of the church history are: the reader reads down a leaf,
  // it holds still at its foot for a moment's scrolling, and the next rises over it, the one beneath
  // dimming a little as it is covered. Each is held by position: sticky, at the height that keeps its
  // foot in view (site.css lays the leaves; here each is given that height); its folio number stands
  // at its head, and the thumb index follows it. Links to a folio go to where its leaf begins.
  let leaves = null;
  const onDesk = window.matchMedia('(min-width: 1000px)');
  function leavesOn() {
    if (leaves || !main || book) return;
    const folios = [...main.querySelectorAll(':scope > .folio')];
    if (!folios.length) return;
    root.classList.add('leaves');
    const shades = [], made = [];
    folios.forEach((f, k) => {
      const anchor = el('div', 'anchor', { 'aria-hidden': 'true' });
      const shade = el('span', 'shade', { 'aria-hidden': 'true' });
      const num = el('span', 'leafnum', { 'aria-hidden': 'true' });
      num.textContent = ROMAN[k];
      f.before(anchor);
      f.prepend(shade, num);
      shades.push(shade);
      made.push(anchor, shade, num);
    });
    let raf = 0, cur = -1;
    // on a wide window the leaves lie on the desk, two pages to a sheet (site.css); the first sheet
    // reaches up to take in the page's head
    const head = document.querySelector('.head');
    const layout = () => {
      root.classList.toggle('spread', onDesk.matches);
      // the type on the desk is the book's at the reader's zoom, and never less than 20px
      if (onDesk.matches) { const g = geometry(); root.style.setProperty('--desk-u', `${Math.max(20, g.u * g.z).toFixed(1)}px`); }
      for (const f of folios) f.style.top = `${Math.min(0, window.innerHeight - f.offsetHeight)}px`;
      if (head) folios[0].style.setProperty('--cap', `${folios[0].previousElementSibling.offsetTop - head.offsetTop}px`);
    };
    const look = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const h = window.innerHeight, tops = folios.map((f) => f.getBoundingClientRect().top);
        let k = 0;
        folios.forEach((f, i) => {
          // the shade deepens as the next leaf rises over this one; a leaf two beneath is not drawn at all
          const c = i + 1 < folios.length ? Math.max(0, Math.min(1, 1 - tops[i + 1] / h)) : 0;
          shades[i].style.opacity = still.matches ? '0' : (c * 0.12).toFixed(3);
          f.classList.toggle('deep', i + 2 < folios.length && tops[i + 2] <= 1);
          if (tops[i] <= h * 0.35) k = i;
        });
        if (k !== cur) { cur = k; markThumb(k); }
      });
    };
    // to a folio, or to something on one: where its leaf begins in the page, and as far down it as that is
    const to = (id, instant) => {
      const t = id && document.getElementById(id);
      const f = t && t.closest('.folio');
      if (!f || f.parentElement !== main) return false;
      const k = folios.indexOf(f);
      const within = t === f ? 0 : t.getBoundingClientRect().top - f.getBoundingClientRect().top;
      const y = k === 0 && t === f ? 0 : f.previousElementSibling.getBoundingClientRect().top + window.scrollY + within;
      const far = Math.abs(y - window.scrollY) > window.innerHeight * 1.6;
      window.scrollTo({ top: y, behavior: instant || still.matches || far ? 'auto' : 'smooth' });
      if (far && !instant && !still.matches) f.animate([{ opacity: 0.6, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.23, 1, .32, 1)' });
      if (!f.hasAttribute('tabindex')) f.setAttribute('tabindex', '-1');
      f.focus({ preventScroll: true });
      return true;
    };
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = decodeURIComponent(a.getAttribute('href').slice(1));
      if (!to(id)) return;
      e.preventDefault();
      if (location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
    };
    const onHash = () => to(decodeURIComponent(location.hash.slice(1)), true);
    const onResize = () => { layout(); look(); };
    const ro = 'ResizeObserver' in window ? new ResizeObserver(onResize) : null;
    if (ro) folios.forEach((f) => ro.observe(f));
    document.addEventListener('click', onClick);
    window.addEventListener('hashchange', onHash);
    window.addEventListener('scroll', look, { passive: true });
    window.addEventListener('resize', onResize);
    layout();
    look();
    if (location.hash) to(decodeURIComponent(location.hash.slice(1)), true);
    leaves = {
      off() {
        if (ro) ro.disconnect();
        document.removeEventListener('click', onClick);
        window.removeEventListener('hashchange', onHash);
        window.removeEventListener('scroll', look);
        window.removeEventListener('resize', onResize);
        cancelAnimationFrame(raf);
        made.forEach((e) => e.remove());
        folios.forEach((f) => { f.style.top = ''; f.classList.remove('deep'); });
        folios[0].style.removeProperty('--cap');
        root.classList.remove('leaves', 'spread');
        root.style.removeProperty('--desk-u');
        leaves = null;
      },
    };
  }
  function leavesOff() { if (leaves) leaves.off(); }

  // ---------------------------------------------------------------------------------------------
  // The book. Each folio of the page is a spread: its .page-v on the left, its .page-r on the right.
  // The pages are bound as leaves turning on the gutter: leaf j carries the right page of spread j
  // on its front and the left page of spread j + 1 on its back; the first left page and the last
  // right page lie on the boards.
  const wideEnough = window.matchMedia('(min-width: 960px) and (min-height: 600px)');
  let book = null, printing = false;

  // The book's measures, from the window (site.css explains each as it uses it). The book fills the
  // window but for a band of 36px above it for the controls and 10px of desk round the rest.
  //  - Zoom: the square root of the window's height over 900, so the book grows more slowly than the
  //    window does.
  //  - Pages: as tall as the window allows, and as wide, but no wider than a squarish codex (0.88 of
  //    their height) and no narrower than a book of hours (2:3); never less than 740 by 494 in the
  //    book's own pixels, the room their contents need; where that cannot be had at a zoom of 0.78
  //    or more, the page stays a page.
  //  - Type: the page's width over 36, which sets about 66 to 70 characters a line; from 17 up to 20,
  //    or up to 22 on screens taller than 1080, which are read from further off. On the screen that is
  //    about 16px at 720 high, 18 at 900, 21 at 1080, 24 at 1440, and never less than 15.
  //  - The reader's own zoom (Ctrl +) is kept: the type is set as it would be in the window at their
  //    zoom of 100%, so the larger the zoom, the larger the type on its page; where the pages can no
  //    longer hold it, the book is laid aside for the leaves (see decide()).
  //  - Margins: inner 6.2% of the width and outer 11% at the least; where a line would run past 31
  //    units the text block stops there, and the width to spare goes one part to the gutter and two
  //    to the outer margin, as the canon of manuscript margins has it; head 7.2% and foot 10% of the
  //    height.
  //  - The thumb index stands 42 of the book's pixels out from its left board, and the desk gives it room.
  const TOP = 36, SIDE = 10, FOOT = 10, BOARD = 13, EDGE = 12, THUMBS = 42;
  const MIN_PH = 740, TALLEST = 2 / 3, WIDEST = 0.88, MIN_PW = Math.ceil(MIN_PH * TALLEST);
  function measure(W, H) {
    const aw = W - 2 * SIDE, ah = H - TOP - FOOT;
    let z = Math.min(1.4, Math.max(0.8, Math.sqrt(H / 900)));
    z = Math.min(z, ah / (MIN_PH + 2 * BOARD), aw / (2 * MIN_PW + 2 * BOARD + 2 * EDGE + THUMBS));
    let ph = ah / z - 2 * BOARD;
    let pw = (aw / z - 2 * BOARD - 2 * EDGE - THUMBS) / 2;
    pw = Math.min(pw, ph * WIDEST);
    ph = Math.min(ph, pw / TALLEST);
    const most = Math.min(22, Math.max(20, 20 + (H - 1080) / 180));
    const u = Math.min(most, Math.max(17, pw / 36));
    return { z, pw, ph, u };
  }
  // The reader's zoom. Chromium keeps the window's outer width in the screen's pixels while its inner
  // width shrinks as the page is zoomed, so the one over the other is the zoom; it is taken only when it
  // is one of the browser's zoom steps and leaves the screen a pixel ratio that screens have (a panel
  // open beside the page would otherwise read as zoom). Elsewhere the zoom is not told, and is 1.
  const STEPS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
  const SCREENS = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3, 3.5, 4];
  function readerZoom() {
    const raw = window.outerWidth / window.innerWidth;
    if (!/Chrome\//.test(navigator.userAgent) || !(raw > 0) || !isFinite(raw)) return 1;
    const f = STEPS.reduce((a, b) => (Math.abs(b - raw) < Math.abs(a - raw) ? b : a));
    if (Math.abs(f - raw) > 0.04 * f) return 1;
    const dpr = window.devicePixelRatio / f;
    return SCREENS.some((d) => Math.abs(d - dpr) < 0.03) ? f : 1;
  }
  function geometry() {
    const W = window.innerWidth, H = window.innerHeight, f = readerZoom();
    const g = measure(W, H);
    const at100 = f === 1 ? g : measure(W * f, H * f);
    const z = g.z;
    const u = Math.max(15, at100.u * at100.z) / z;
    const { pw, ph } = g;
    const block = Math.min(pw * (1 - 0.062 - 0.11), 31 * u);
    const mi = Math.max(pw * 0.062, (pw - block) / 3), mo = pw - block - mi;
    const mt = ph * 0.072, mb = ph * 0.1;
    return { ok: z >= 0.78, z, f, pw, ph, u, mi, mo, mt, mb, sz: u / 14 };
  }

  function face(page, side, back) {
    const f = el('div', `face ${side}${back ? ' back' : ''}`);
    f.shade = el('div', 'shade');
    f.cast = el('div', 'cast');
    f.append(f.shade, f.cast);
    if (page) f.append(page);
    return f;
  }

  // the window's title names the folio the book lies open at; the browser's own colour is the desk's
  const TITLE = document.title;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const PAGE = themeColor ? themeColor.getAttribute('content') : '', DESK = '#653A1D';

  function build() {
    leavesOff();
    stopScrollScribe();
    unmark();
    document.querySelectorAll('.inked').forEach((e) => e.classList.remove('inked'));
    const folios = [...main.querySelectorAll(':scope > .folio')];
    const spreads = folios.map((f) => ({
      folio: f, id: f.id, name: f.dataset.name,
      v: f.querySelector(':scope > .page-v'), r: f.querySelector(':scope > .page-r'),
    }));
    const N = spreads.length - 1;
    const jj = document.querySelector('.head .jj');
    if (jj) spreads[0].v.prepend(jj);

    const stage = el('div', 'stage');
    const bk = el('div', 'book');
    const block = el('div', 'block');
    const edgeL = el('div', 'edge l'), edgeR = el('div', 'edge r');
    block.append(edgeL, edgeR);

    const fixedL = el('div', 'sheet fixed-l');
    const fL = face(spreads[0].v, 'verso');
    fixedL.append(fL);
    const fixedR = el('div', 'sheet fixed-r');
    const fR = face(spreads[N].r, 'recto');
    fixedR.append(fR);
    block.append(fixedL, fixedR);
    const leaves = [];
    for (let j = 0; j < N; j++) {
      const sheet = el('div', 'sheet leaf');
      const front = face(spreads[j].r, 'recto'), back = face(spreads[j + 1].v, 'verso', true);
      // the outer part's two sides, each a panel of its own on the fold (see bend, below)
      const hingeF = el('div', 'hinge f', { 'aria-hidden': 'true' }), hingeB = el('div', 'hinge b', { 'aria-hidden': 'true' });
      hingeF.hidden = hingeB.hidden = true;
      sheet.append(front, back, hingeF, hingeB);
      block.append(sheet);
      leaves.push({ sheet, front, back, hingeF, hingeB, a: 0, bent: null });
    }
    // which face shows each page: the verso of spread k, and the recto
    const versoFace = (k) => (k === 0 ? fL : leaves[k - 1].back);
    const rectoFace = (k) => (k === N ? fR : leaves[k].front);

    // foliation, catchwords and corners
    spreads.forEach((s, k) => {
      const rf = rectoFace(k), vf = versoFace(k);
      // a face takes its page's setting, so that its foliation and catchwords are set to match
      rf.classList.toggle('modern', s.r.classList.contains('modern'));
      vf.classList.toggle('modern', s.v.classList.contains('modern'));
      rf.append(el('span', 'folnum', { 'aria-hidden': 'true' }));
      rf.lastChild.textContent = ROMAN[k];
      if (k < N) {
        const c = el('button', 'catch next', { type: 'button', 'aria-label': `${UI.turn_next || 'Next'}: ${spreads[k + 1].name}` });
        c.textContent = spreads[k + 1].name;
        c.addEventListener('click', () => go(k + 1, { replace: true, focus: 'next' }));
        const corner = el('button', 'corner next', { type: 'button', tabindex: '-1', 'aria-hidden': 'true' });
        corner.addEventListener('click', () => go(k + 1, { replace: true }));
        corner.addEventListener('pointerenter', () => peek(k, 10));
        corner.addEventListener('pointerleave', () => peek(k, 0));
        rf.append(c, corner);
      }
      if (k > 0) {
        const c = el('button', 'catch prev', { type: 'button', 'aria-label': `${UI.turn_prev || 'Back'}: ${spreads[k - 1].name}` });
        c.textContent = spreads[k - 1].name;
        c.addEventListener('click', () => go(k - 1, { replace: true, focus: 'prev' }));
        const corner = el('button', 'corner prev', { type: 'button', tabindex: '-1', 'aria-hidden': 'true' });
        corner.addEventListener('click', () => go(k - 1, { replace: true }));
        corner.addEventListener('pointerenter', () => peek(k - 1, 170));
        corner.addEventListener('pointerleave', () => peek(k - 1, 180));
        vf.append(c, corner);
      }
    });

    // the thumb index stands out from the book's left edge
    if (thumbs) { thumbs.classList.remove('slim', 'open'); bk.append(thumbs); }

    bk.append(block);
    stage.append(bk);
    main.append(stage);
    root.classList.add('bound');
    if (themeColor) themeColor.setAttribute('content', DESK);

    book = { stage, bk, block, edgeL, edgeR, fixedL, fixedR, fL, fR, leaves, spreads, N, versoFace, rectoFace,
      cur: 0, busy: false, queued: null, seenSpreads: new Set() };

    // the pages not yet opened to are drawn in when they are
    if (!still.matches) {
      spreads.forEach((s) => {
        for (const p of [s.v, s.r]) { mark(p, false); if (p.classList.contains('page-v') && p.querySelector('.versal')) p.classList.add('pending'); }
      });
    }
    // links to a folio turn to it
    bk.addEventListener('click', onLink);
    bindTurning();
    layout();
    const start = spreadFromHash();
    open(start);
    history.replaceState({ spread: start }, '', hashFor(start));
  }

  function unbuild() {
    if (!book) return;
    Organ.stop();
    // (the keys are the document's, so their listener goes with the book, or a book bound again would hear each key twice)
    document.removeEventListener('keydown', book.onKey);
    const { spreads, stage } = book;
    const cur = book.cur;
    for (const s of spreads) {
      s.folio.append(s.v, s.r);
    }
    const jj = spreads[0].v.querySelector('.jj');
    if (jj) document.querySelector('.head').prepend(jj);
    if (thumbs) { main.before(thumbs); slimThumbs(); }
    stage.remove();
    root.classList.remove('bound');
    if (themeColor) themeColor.setAttribute('content', PAGE);
    document.title = TITLE;
    unmark();
    document.querySelectorAll('[inert]').forEach((e) => e.removeAttribute('inert'));
    book = null;
    if (organBtn) organBtn.hidden = true;
    if (fsBtn) fsBtn.hidden = true;
    if (!printing) leavesOn();
    if (cur > 0) { const f = spreads[cur].folio, a = f.previousElementSibling; (a && a.classList.contains('anchor') ? a : f).scrollIntoView(); }
  }

  function layout() {
    if (!book) return;
    const g = geometry();
    const b = book.bk;
    b.style.zoom = g.z;
    for (const k of ['pw', 'ph', 'u', 'mi', 'mo', 'mt', 'mb']) b.style.setProperty(`--${k}`, `${g[k].toFixed(1)}px`);
    b.style.setProperty('--sz', g.sz.toFixed(3));
    b.style.setProperty('--z', g.z.toFixed(3));
    book.stage.style.paddingLeft = `${Math.round(SIDE + THUMBS * g.z)}px`;
    fitWithin();
  }

  // A work's contents run on in a paragraph; where its page has room for them as a list, one to a
  // line, they are set so, in one column or else in two, whichever the page holds without spilling.
  function fitWithin() {
    const fits = (p) => p.scrollHeight <= p.clientHeight + 1;
    for (const s of book.spreads) {
      s.v.classList.remove('tight');
      const w = s.r.querySelector('.within'), parts = s.r.querySelector('.parts');
      const p = w && w.querySelector('p'), items = w ? [...p.querySelectorAll('.it')] : [];
      // three columns are narrow: they are taken only if every item still keeps to one line
      const unbroken = () => { const h = items.map((it) => it.getBoundingClientRect().height); return Math.max(...h) < Math.min(...h) * 1.5; };
      // and where even the paragraph will not go, the page's smaller text is set a size smaller
      for (const tight of [false, true]) {
        s.r.classList.toggle('tight', tight);
        if (w) {
          for (const [cls, cols] of [[['listed'], 1], [['listed', 'cols'], 2], [['listed', 'cols', 'three'], 3], [[], 0]]) {
            w.classList.remove('listed', 'cols', 'three');
            w.classList.add(...cls);
            p.style.setProperty('--rows', Math.ceil(items.length / Math.max(1, cols)));
            if (fits(s.r) && (cols < 3 || unbroken())) break;
          }
        }
        // a work's parts as a table: in one column, or two (down the first, then the second); only where
        // neither will go even a size smaller are they run on as a paragraph, each after its number
        if (parts) {
          const forms = tight ? ['', 'two', 'run'] : ['', 'two'];
          for (const form of forms) {
            parts.classList.remove('two', 'run');
            if (form) parts.classList.add(form);
            if (fits(s.r)) break;
          }
          if (!tight && !fits(s.r)) continue;
        }
        if (fits(s.r)) break;
      }
      if (!fits(s.v)) s.v.classList.add('tight');
    }
  }

  // ---- where the book lies open ----
  function spreadFromHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!book || !id || id === 'opening') return 0;
    if (id === 'works') return 1;
    const k = book.spreads.findIndex((s) => s.id === id);
    return k < 0 ? 0 : k;
  }
  const hashFor = (k) => (k === 0 ? location.pathname + location.search : `#${book.spreads[k].id}`);

  // A leaf is paper, not board: as it turns it bows. Its outer part (beyond 55% of its width) is laid on a
  // hinge of its own and bent ahead of the rest as the leaf rises, then lets it trail as the leaf falls,
  // the most at a quarter and three quarters of the turn and not at all at rest. The same bend serves a
  // turn forward or back, a hand dragging the leaf and a corner lifted under the pointer.
  const BEND = 20;
  const bendAt = (a) => BEND * Math.sin(2 * Math.PI * a / 180);
  // while a leaf is off the page its outer part is drawn by a copy of its two faces, cut at the fold; the
  // copy is only seen, never read or pressed, and is let go when the leaf lies down again
  function bend(L, on) {
    if (on === !!L.bent) return;
    if (!on) {
      for (const h of [L.hingeF, L.hingeB]) { h.replaceChildren(); h.hidden = true; }
      L.front.classList.remove('cut'); L.back.classList.remove('cut');
      L.bent = null;
      return;
    }
    const copy = (f) => {
      const c = f.cloneNode(true);
      c.classList.add('copy');
      c.setAttribute('inert', '');
      for (const v of c.querySelectorAll('video')) v.remove();
      for (const e of c.querySelectorAll('[id]')) e.removeAttribute('id');
      for (const i of c.querySelectorAll('img[loading]')) i.loading = 'eager';
      return c;
    };
    const fc = copy(L.front), bc = copy(L.back);
    L.hingeF.replaceChildren(fc); L.hingeB.replaceChildren(bc);
    L.hingeF.hidden = L.hingeB.hidden = false;
    L.front.classList.add('cut'); L.back.classList.add('cut');
    L.bent = { fShade: fc.querySelector(':scope > .shade'), bShade: bc.querySelector(':scope > .shade') };
  }
  // the darkening of a face turned from the lamp: none flat, the most edge on
  const shadeFor = (a, front) => (front ? (a > 0 && a < 90 ? (a / 90) * 0.6 : 0) : (a > 90 && a < 180 ? ((180 - a) / 90) * 0.6 : 0));
  function setAngle(j, a) {
    const L = book.leaves[j];
    L.a = a;
    // (a corner only lifted under the pointer stays flat, and so stays to be pressed; it bends once it turns)
    const moving = a > 0.01 && a < 179.99 && (book.busy || !!book.drag);
    bend(L, moving);
    const b = moving ? bendAt(a) : 0;
    L.sheet.style.transform = a ? `rotateY(${-a}deg)` : '';
    if (L.bent) {
      // the front of the outer part turns on the fold; its back is the same panel turned over about its middle
      L.hingeF.style.transform = `rotateY(${-b}deg)`;
      L.hingeB.style.transform = `rotateY(${-b}deg) translateX(50%) rotateY(180deg) translateX(-50%)`;
      L.bent.fShade.style.opacity = shadeFor(a + b, true);
      L.bent.bShade.style.opacity = shadeFor(a + b, false);
    }
    // a leaf in motion lies above the leaves at rest; on the right the earlier above the later, on the
    // left the later above the earlier, as they lie in the book
    if (L.active) L.sheet.style.zIndex = a + b / 2 < 90 ? 300 - j : 300 + j;
    const lift = Math.sin(a * Math.PI / 180);
    const [shadeF, shadeB, castBelow, castBehind] = overlays(j);
    shadeF.style.opacity = shadeFor(a, true);
    shadeB.style.opacity = shadeFor(a, false);
    // the shadow it casts on the page it is leaving, or the one it is coming down on
    castBelow.style.opacity = a > 0 && a < 90 ? lift * 0.75 : 0;
    castBehind.style.opacity = a >= 90 && a < 180 ? lift * 0.75 : 0;
  }
  // the light across leaf j and the shadows it casts: on the page below it and the page behind it
  function overlays(j) {
    const L = book.leaves[j];
    const below = j + 1 < book.N ? book.leaves[j + 1].front : book.fR;
    const behind = j > 0 ? book.leaves[j - 1].back : book.fL;
    return [L.front.shade, L.back.shade, below.cast, behind.cast];
  }
  // While leaves turn, their light and shadows are laid on layers of their own, so that the pages under
  // them are not drawn again at every step of the turn; at rest they go back into their pages, which
  // keeps the book's memory small.
  function lifting(js, on) {
    for (const j of js) for (const o of overlays(j)) o.style.willChange = on ? 'opacity' : '';
  }
  function stack(active = []) {
    // the leaves in motion have their light and shadows lifted (above); the rest are let down
    if (book.lifted) lifting(book.lifted, false);
    lifting(active, true);
    book.lifted = active;
    // unturned leaves on the right, the first on top; turned ones on the left, the last on top;
    // a leaf in motion above them all
    book.leaves.forEach((L, j) => {
      L.active = active.includes(j);
      L.sheet.style.zIndex = L.active ? (L.a + bendAt(L.a) / 2 < 90 ? 300 - j : 300 + j) : (L.a >= 90 ? 100 + j : 100 - j);
    });
  }
  function edges() {
    const k = book.cur, N = book.N;
    book.edgeL.style.setProperty('--w', `${3 + k * 1.6}px`);
    book.edgeR.style.setProperty('--w', `${3 + (N - k) * 1.6}px`);
  }
  function visibility() {
    const k = book.cur;
    const show = new Set([book.versoFace(k), book.rectoFace(k)]);
    for (const f of book.block.querySelectorAll('.face')) {
      if (show.has(f)) f.removeAttribute('inert'); else f.setAttribute('inert', '');
    }
  }

  // open the book at spread k without turning (on arrival, or when stillness is asked for)
  function open(k) {
    book.leaves.forEach((L, j) => setAngle(j, j < k ? 180 : 0));
    book.cur = k;
    stack();
    arrive(false);
  }

  // a cubic Bézier easing, as CSS has them
  function bezier(x1, y1, x2, y2) {
    const at = (t, p1, p2) => 3 * (1 - t) * (1 - t) * t * p1 + 3 * (1 - t) * t * t * p2 + t * t * t;
    return (x) => {
      if (x <= 0 || x >= 1) return x;
      let lo = 0, hi = 1, t = x;
      for (let i = 0; i < 24; i++) { t = (lo + hi) / 2; if (at(t, x1, x2) < x) lo = t; else hi = t; }
      return at(t, y1, y2);
    };
  }
  // a leaf is lifted briskly, crosses fast, and settles slowly on the other side
  const ease = bezier(0.42, 0, 0.18, 1);
  const easeOut = bezier(0.2, 0.7, 0.3, 1);
  // a leaf has one motion at a time: a new one (a click on a corner still lifting under the pointer)
  // takes over from where the last has brought it, and a motion stops if the book is laid aside
  function animate(j, from, to, ms, curve, done) {
    const t0 = performance.now(), L = book.leaves[j], token = {};
    L.motion = token;
    const step = () => {
      if (!book || book.leaves[j] !== L || L.motion !== token) return;
      const t = Math.min(1, (performance.now() - t0) / ms);
      setAngle(j, from + (to - from) * curve(t));
      if (t < 1) requestAnimationFrame(step); else { L.motion = null; done(); }
    };
    requestAnimationFrame(step);
  }

  // turn to spread k: one leaf, or several in a riffle, each a little after the last
  function go(k, opts = {}) {
    if (!book) return;
    k = Math.max(0, Math.min(book.N, k));
    if (book.busy) { if (k !== book.target) book.queued = [k, opts]; return; }
    if (k === book.cur) return;
    book.target = k;
    Organ.stop();
    const from = book.cur;
    const fwd = k > from;
    const js = fwd ? range(from, k) : range(k, from).reverse();
    // a turn of the page keeps the address in step without adding to the history, so that Back leaves the
    // book in one press; a jump (the contents, the thumb index, a link) is a step that Back retraces
    if (opts.push) history.pushState({ spread: k }, '', hashFor(k));
    else if (opts.replace) history.replaceState({ spread: k }, '', hashFor(k));
    stopClip(book.spreads[from].v.querySelector('.plate'));
    if (still.matches) { open(k); focusAfter(opts.focus); return; }
    book.busy = true;
    for (const f of book.block.querySelectorAll('.face')) f.setAttribute('inert', '');
    // the faces that will show partway through a riffle are uncovered as the leaves pass
    // one leaf in about three quarters of a second; a riffle fans its leaves a little apart, so that the
    // whole of a long jump takes not much more than a single turn
    const ms = js.length > 1 ? 620 : 760, gap = js.length > 1 ? Math.min(110, 480 / (js.length - 1)) : 0;
    stack(js);
    let left = js.length;
    js.forEach((j, i) => {
      setTimeout(() => {
        if (!book) return;
        const a0 = book.leaves[j].a;
        animate(j, a0, fwd ? 180 : 0, ms * (fwd ? (180 - a0) / 180 : a0 / 180) + 80, ease, () => {
          if (--left) return;
          book.cur = k;
          book.busy = false;
          stack();
          arrive(true);
          focusAfter(opts.focus);
          if (book.queued) { const [qk, qo] = book.queued; book.queued = null; go(qk, qo); }
        });
      }, i * gap);
    });
  }
  const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
  function focusAfter(which) {
    if (!which) return;
    const k = book.cur;
    const target = which === 'next'
      ? book.rectoFace(k).querySelector('.catch.next') || book.versoFace(k).querySelector('.catch.prev')
      : book.versoFace(k).querySelector('.catch.prev') || book.rectoFace(k).querySelector('.catch.next');
    if (target) target.focus({ preventScroll: true });
  }

  // when the book lies open at a spread: show only its two pages to the keyboard and to readers
  // of the screen, say where it is, draw in what is new, and play its clip and its line
  function arrive(turned) {
    const k = book.cur, s = book.spreads[k];
    markThumb(k);
    document.title = k ? `${s.name} · ${TITLE}` : TITLE;
    visibility();
    edges();
    const live = document.getElementById('turned');
    if (live && turned) live.textContent = `${UI.folio || 'Folio'} ${ROMAN[k]}: ${s.name}`;
    for (const a of document.querySelectorAll('.langs a')) {
      a.setAttribute('href', a.getAttribute('href').split('#')[0] + (k ? `#${s.id}` : ''));
    }
    if (!book.seenSpreads.has(k)) {
      book.seenSpreads.add(k);
      setTimeout(() => { if (book && book.cur === k) { ink(s.v); ink(s.r); } }, turned ? 60 : 250);
    }
    const plate = s.v.querySelector('.plate[data-clip]');
    if (plate && turned) setTimeout(() => { if (book && book.cur === k) playClip(plate); }, 500);
    if (organOn() && turned) {
      const score = s.r.querySelector('.score');
      if (score) setTimeout(() => { if (book && book.cur === k) playStaff(score); }, 350);
    }
  }

  // lift a corner a little under the pointer, as a hand would
  function peek(j, a) {
    if (!book || book.busy || book.drag || still.matches || j < 0 || j >= book.N) return;
    const L = book.leaves[j];
    if ((a < 90) !== (L.a < 90)) return;
    stack([j]);
    animate(j, L.a, a, 220, easeOut, () => { if (!book.busy && !book.drag && L.a === a && (a === 0 || a === 180)) stack(); });
  }

  function onLink(e) {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const k = id === 'opening' ? 0 : id === 'works' ? 1 : book.spreads.findIndex((s) => s.id === id);
    if (k < 0) return;
    e.preventDefault();
    go(k, { push: true });
  }

  function bindTurning() {
    const { stage, block } = book;
    // keys: the arrows, Page Up and Down, Home and End
    book.onKey = (e) => {
      if (!book || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target;
      if (t.closest && t.closest('input, textarea, select, [contenteditable]')) return;
      if ((e.key === 'f' || e.key === 'F') && canFull) { e.preventDefault(); toggleFull(); return; }
      // (keys pressed while a leaf is turning count on from where the book is going)
      const k = book.queued ? book.queued[0] : book.busy ? book.target : book.cur;
      const keys = { ArrowRight: k + 1, ArrowDown: k + 1, PageDown: k + 1, ArrowLeft: k - 1, ArrowUp: k - 1, PageUp: k - 1, Home: 0, End: book.N };
      if (e.key === ' ' && !(t.closest && t.closest('a, button, [role="button"]'))) { e.preventDefault(); go(e.shiftKey ? k - 1 : k + 1, { replace: true }); return; }
      if (!(e.key in keys)) return;
      e.preventDefault();
      go(keys[e.key], { replace: true });
    };
    document.addEventListener('keydown', book.onKey);

    // the wheel or a trackpad: one turn to a gesture, however long its momentum runs on
    let acc = 0, quietAt = 0, spent = false;
    stage.addEventListener('wheel', (e) => {
      if (e.ctrlKey) return;            // pinch to zoom is the reader's own
      e.preventDefault();
      const now = performance.now();
      if (now - quietAt > 260) { acc = 0; spent = false; }
      quietAt = now;
      if (spent || book.busy) return;
      acc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(acc) > 60) { spent = true; go(book.cur + Math.sign(acc), { replace: true }); }
    }, { passive: false });

    // a hand on the page: the leaf's edge follows the pointer across the spread
    block.addEventListener('dragstart', (e) => e.preventDefault());
    block.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || book.busy || still.matches) return;
      if (e.target.closest('a, button:not(.corner), video, input, [role="button"]')) return;
      const r = block.getBoundingClientRect();
      book.press = { x0: e.clientX, y0: e.clientY, id: e.pointerId, left: r.left, width: r.width, right: e.clientX > r.left + r.width / 2 };
    });
    block.addEventListener('pointermove', (e) => {
      const p = book.press;
      if (!p && e.pointerType === 'mouse') {
        // a hand over the outer margins, where a reader takes hold of a leaf to turn it
        const r = block.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 2 * parseFloat(book.bk.style.getPropertyValue('--pw'));
        const mo = parseFloat(book.bk.style.getPropertyValue('--mo')), pw = parseFloat(book.bk.style.getPropertyValue('--pw'));
        const k = book.cur, edge = (x < mo && k > 0) || (x > 2 * pw - mo && k < book.N);
        block.classList.toggle('grab', edge && !book.busy && !still.matches && !e.target.closest('a, button, [role="button"], video'));
      }
      if (!p || p.id !== e.pointerId) return;
      const dx = e.clientX - p.x0, dy = e.clientY - p.y0;
      if (!book.drag) {
        if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
        const k = book.cur;
        let j = null;
        if (p.right && dx < 0 && k < book.N) j = k;
        else if (!p.right && dx > 0 && k > 0) j = k - 1;
        if (j === null) { book.press = null; return; }
        book.drag = { j, fwd: j === k, last: [[performance.now(), e.clientX]] };
        block.classList.add('dragging');
        stack([j]);
        try { block.setPointerCapture(e.pointerId); } catch (err) {}
        Organ.stop();
      }
      const d = book.drag;
      const x = (e.clientX - p.left) / p.width * 2;   // 0 at the left edge, 1 at the gutter, 2 at the right edge
      const a = Math.acos(Math.max(-1, Math.min(1, x - 1))) * 180 / Math.PI;
      setAngle(d.j, a);
      d.last.push([performance.now(), e.clientX]);
      if (d.last.length > 5) d.last.shift();
    });
    const release = (e) => {
      const p = book && book.press;
      if (!p || p.id !== e.pointerId) return;
      book.press = null;
      const d = book.drag;
      if (!d) return;
      book.drag = null;
      block.classList.remove('dragging');
      const [[t1, x1]] = d.last, [t2, x2] = d.last[d.last.length - 1];
      const v = (x2 - x1) / Math.max(1, t2 - t1);       // px per ms; leftward is negative
      const a = book.leaves[d.j].a;
      const complete = d.fwd ? (a > 90 || v < -0.45) : (a < 90 || v > 0.45);
      const to = d.fwd ? (complete ? 180 : 0) : (complete ? 0 : 180);
      book.busy = true;
      animate(d.j, a, to, 140 + 420 * Math.abs(to - a) / 180, easeOut, () => {
        book.busy = false;
        if (complete) {
          book.cur = d.fwd ? d.j + 1 : d.j;
          history.replaceState({ spread: book.cur }, '', hashFor(book.cur));
          stack();
          arrive(true);
        } else stack();
      });
    };
    block.addEventListener('pointerleave', () => block.classList.remove('grab'));
    block.addEventListener('pointerup', release);
    block.addEventListener('pointercancel', release);
  }

  window.addEventListener('popstate', () => { if (book) go(spreadFromHash()); });
  window.addEventListener('hashchange', () => { if (book) go(spreadFromHash()); });

  // ---- the organ stop ----
  const organBtn = document.querySelector('.organ');
  const organOn = () => organBtn && organBtn.getAttribute('aria-pressed') === 'true';
  if (organBtn && Organ.ok) {
    if (store.get('organ') === '1') organBtn.setAttribute('aria-pressed', 'true');
    organBtn.addEventListener('click', () => {
      const on = !organOn();
      organBtn.setAttribute('aria-pressed', String(on));
      store.set('organ', on ? '1' : '0');
      if (on && book) { const score = book.spreads[book.cur].r.querySelector('.score'); if (score) playStaff(score); }
      else Organ.stop();
    });
  }

  // ---- reading full screen: the browser's own bars go, and the book takes the whole screen ----
  const fsBtn = document.querySelector('.fs');
  const canFull = !!(document.fullscreenEnabled && root.requestFullscreen);
  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else root.requestFullscreen().catch(() => {});
  }
  if (fsBtn && canFull) fsBtn.addEventListener('click', toggleFull);

  // ---- bind the book, or keep the page, as the window allows ----
  // Every page must hold its text above its foot margin. Where one cannot (the reader's zoom has made the
  // type too large for the window), the book is laid aside for the leaves, and is not bound again until
  // the window grows or the zoom changes. What a page holds is known only once its type has come.
  let tooFull = null;
  const typeIn = () => !document.fonts || document.fonts.status === 'loaded';
  const holds = () => book.spreads.every((s) => s.v.scrollHeight <= s.v.clientHeight + 1 && s.r.scrollHeight <= s.r.clientHeight + 1);
  function check() {
    if (!book || !typeIn() || holds()) return;
    tooFull = { w: window.innerWidth, h: window.innerHeight, f: book.f };
    unbuild();
  }
  function decide() {
    const g = geometry();
    const crowded = tooFull && tooFull.f === g.f && window.innerWidth < tooFull.w + 40 && window.innerHeight < tooFull.h + 16;
    const want = !printing && main && wideEnough.matches && g.ok && !crowded;
    if (want && !book) { build(); if (organBtn && Organ.ok) organBtn.hidden = false; if (fsBtn && canFull) fsBtn.hidden = false; }
    else if (!want && book) unbuild();
    else if (book) layout();
    if (book) { book.f = g.f; check(); }
  }
  if (main && main.querySelector('.folio')) {
    decide();
    if (!book) { scrollScribe(); slimThumbs(); leavesOn(); hintThumbs(); }
    let raf = 0;
    window.addEventListener('resize', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(decide); });
    window.addEventListener('beforeprint', () => { printing = true; unbuild(); });
    window.addEventListener('afterprint', () => { printing = false; decide(); });
    // the type's own metrics decide what a page holds, so the contents are fitted again once it has come
    if (document.fonts) document.fonts.ready.then(() => { if (book) { fitWithin(); check(); } });
  }
  // the page was kept from sight while the book was bound (see the script at the head of src/page.html):
  // show it, once its type has come, so that the book does not reflow before the reader's eyes, or after
  // a moment at most
  const shown = () => root.classList.remove('binding');
  if (book && !typeIn()) Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 600))]).then(() => { if (book) { fitWithin(); check(); } shown(); });
  else shown();

  // ---------------------------------------------------------------------------------------------
  // Light. The gold catches a light that follows the pointer: the burnished gold of the opening
  // initial (a real thirteenth-century one, so the light is laid over it in site.css) and the gilding
  // of S.D.G. (an SVG gradient moved under the pointer); after dark the pointer carries the
  // candle (src/evening.js); by day the book's shadow falls away from the sun's side of the sky.
  const hour = new Date().getHours() + new Date().getMinutes() / 60;
  root.style.setProperty('--sun', Math.max(-1, Math.min(1, (hour - 13) / 6)).toFixed(2));
  const lamps = ['sdg-lamp']
    .map((id) => { const g = document.getElementById(id); return g && { g, svg: g.ownerSVGElement }; })
    .filter(Boolean);
  const initial = document.querySelector('.initial');
  let px = -1, py = -1, lightFrame = 0;
  function light() {
    lightFrame = 0;
    root.style.setProperty('--lx', `${px}px`);
    root.style.setProperty('--ly', `${py}px`);
    if (initial) {
      const r = initial.getBoundingClientRect();
      initial.style.setProperty('--gx', `${((px - r.left) / r.width * 100).toFixed(1)}%`);
      initial.style.setProperty('--gy', `${((py - r.top) / r.height * 100).toFixed(1)}%`);
    }
    for (const { g, svg } of lamps) {
      const r = svg.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > window.innerHeight) continue;
      const m = svg.getScreenCTM();
      if (!m) continue;
      const pt = new DOMPoint(px, py).matrixTransform(m.inverse());
      g.setAttribute('cx', pt.x.toFixed(1));
      g.setAttribute('cy', pt.y.toFixed(1));
    }
  }
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    px = e.clientX; py = e.clientY;
    if (!lightFrame) lightFrame = requestAnimationFrame(light);
  }, { passive: true });
})();
