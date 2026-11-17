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
  // One sweep of light across the gold leaf of the initial, once the letter is set,
  // and again when a pointer rests on it.
  const sweep = document.getElementById('sweep');
  const initial = document.querySelector('.initial');
  const shine = () => { if (!still.matches && sweep && sweep.beginElement) { try { sweep.beginElement(); } catch (e) {} } };
  if (sweep && initial) {
    const ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    ready.then(() => setTimeout(shine, 350));
    initial.addEventListener('mouseenter', shine);
  }

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
  // The book. Each folio of the page is a spread: its .page-v on the left, its .page-r on the right.
  // The pages are bound as leaves turning on the gutter: leaf j carries the right page of spread j
  // on its front and the left page of spread j + 1 on its back; the first left page and the last
  // right page lie on the boards.
  const wideEnough = window.matchMedia('(min-width: 960px) and (min-height: 600px)');
  let book = null, printing = false;

  // The book's measures, from the window (site.css explains each as it uses it). The book fills the
  // window but for a band of 36px above it for the controls and 10px of desk round the rest.
  //  - Zoom: the square root of the window's height over 900, so text grows more slowly than the
  //    window does: about 15px on screen at 720 high, 19 at 900, 21 at 1080, 24 at 1440.
  //  - Pages: as tall as the window allows, and as wide, but no wider than a squarish codex (0.88 of
  //    their height) and no narrower than a book of hours (2:3); never less than 740 by 494 in the
  //    book's own pixels, the room their contents need; where that cannot be had at a zoom of 0.78
  //    or more (text of 13px on screen), the page stays a page.
  //  - Type: the page's width over 36, which sets about 66 to 70 characters a line; from 17 up to 20,
  //    or up to 22 on screens taller than 1080, which are read from further off.
  //  - Margins: inner 6.2% of the width and outer 11% at the least; where a line would run past 31
  //    units the text block stops there, and the width to spare goes one part to the gutter and two
  //    to the outer margin, as the canon of manuscript margins has it; head 7.2% and foot 10% of the
  //    height.
  const TOP = 36, SIDE = 10, FOOT = 10, BOARD = 13, EDGE = 12;
  const MIN_PH = 740, TALLEST = 2 / 3, WIDEST = 0.88, MIN_PW = Math.ceil(MIN_PH * TALLEST);
  function geometry() {
    const aw = window.innerWidth - 2 * SIDE, ah = window.innerHeight - TOP - FOOT;
    let z = Math.min(1.4, Math.max(0.8, Math.sqrt(window.innerHeight / 900)));
    z = Math.min(z, ah / (MIN_PH + 2 * BOARD), aw / (2 * MIN_PW + 2 * BOARD + 2 * EDGE));
    let ph = ah / z - 2 * BOARD;
    let pw = (aw / z - 2 * BOARD - 2 * EDGE) / 2;
    pw = Math.min(pw, ph * WIDEST);
    ph = Math.min(ph, pw / TALLEST);
    const most = Math.min(22, Math.max(20, 20 + (window.innerHeight - 1080) / 180));
    const u = Math.min(most, Math.max(17, pw / 36));
    const block = Math.min(pw * (1 - 0.062 - 0.11), 31 * u);
    const mi = Math.max(pw * 0.062, (pw - block) / 3), mo = pw - block - mi;
    const mt = ph * 0.072, mb = ph * 0.1;
    return { ok: z >= 0.78, z, pw, ph, u, mi, mo, mt, mb, sz: u / 14 };
  }

  function face(page, side, back) {
    const f = el('div', `face ${side}${back ? ' back' : ''}`);
    f.append(el('div', 'shade'), el('div', 'cast'));
    if (page) f.append(page);
    return f;
  }

  function build() {
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
      sheet.append(front, back);
      block.append(sheet);
      leaves.push({ sheet, front, back, a: 0 });
    }
    // which face shows each page: the verso of spread k, and the recto
    const versoFace = (k) => (k === 0 ? fL : leaves[k - 1].back);
    const rectoFace = (k) => (k === N ? fR : leaves[k].front);

    // foliation, catchwords and corners
    spreads.forEach((s, k) => {
      const rf = rectoFace(k), vf = versoFace(k);
      rf.append(el('span', 'folnum', { 'aria-hidden': 'true' }));
      rf.lastChild.textContent = ROMAN[k];
      if (k < N) {
        const c = el('button', 'catch next', { type: 'button', 'aria-label': `${UI.turn_next || 'Next'}: ${spreads[k + 1].name}` });
        c.textContent = spreads[k + 1].name;
        c.addEventListener('click', () => go(k + 1, { push: true, focus: 'next' }));
        const corner = el('button', 'corner next', { type: 'button', tabindex: '-1', 'aria-hidden': 'true' });
        corner.addEventListener('click', () => go(k + 1, { push: true }));
        corner.addEventListener('pointerenter', () => peek(k, 10));
        corner.addEventListener('pointerleave', () => peek(k, 0));
        rf.append(c, corner);
      }
      if (k > 0) {
        const c = el('button', 'catch prev', { type: 'button', 'aria-label': `${UI.turn_prev || 'Back'}: ${spreads[k - 1].name}` });
        c.textContent = spreads[k - 1].name;
        c.addEventListener('click', () => go(k - 1, { push: true, focus: 'prev' }));
        const corner = el('button', 'corner prev', { type: 'button', tabindex: '-1', 'aria-hidden': 'true' });
        corner.addEventListener('click', () => go(k - 1, { push: true }));
        corner.addEventListener('pointerenter', () => peek(k - 1, 170));
        corner.addEventListener('pointerleave', () => peek(k - 1, 180));
        vf.append(c, corner);
      }
    });

    // the ribbon, and the contents it opens
    const ribbon = el('button', 'ribbon', { type: 'button', 'aria-label': UI.contents || 'Contents', title: UI.contents || 'Contents', 'aria-haspopup': 'dialog' });
    const slip = el('div', 'slip', { id: 'slip', role: 'dialog', 'aria-label': UI.contents || 'Contents' });
    const popover = typeof slip.showPopover === 'function';
    if (popover) { slip.setAttribute('popover', ''); ribbon.setAttribute('popovertarget', 'slip'); } else slip.hidden = true;
    const close = el('button', 'slip-close', { type: 'button', 'aria-label': '×' });
    close.textContent = '×';
    const nav = el('nav', 'contents');
    const h = el('h2', 'rubric'); h.textContent = UI.contents || 'Contents';
    const ol = el('ol');
    spreads.forEach((s, k) => {
      const li = el('li', k % 2 ? 'blue' : 'red');
      const a = el('a', '', { href: k ? `#${s.id}` : '#opening' });
      const lang = s.folio.getAttribute('lang');
      if (lang) a.setAttribute('lang', lang);
      const v = el('span', 'c-v'); v.textContent = s.name.charAt(0);
      a.append(v, s.name.slice(1), el('span', 'c-dots', { 'aria-hidden': 'true' }));
      const n = el('span', 'c-fol'); n.textContent = ROMAN[k];
      a.append(n);
      li.append(a);
      ol.append(li);
    });
    nav.append(h, ol);
    slip.append(close, nav);
    const hideSlip = () => { if (popover) { try { slip.hidePopover(); } catch (e) {} } else slip.hidden = true; };
    close.addEventListener('click', hideSlip);
    if (!popover) ribbon.addEventListener('click', () => { slip.hidden = !slip.hidden; });

    bk.append(block, ribbon);
    stage.append(bk, slip);
    main.append(stage);
    root.classList.add('bound');

    book = { stage, bk, block, edgeL, edgeR, fixedL, fixedR, fL, fR, leaves, spreads, N, versoFace, rectoFace,
      cur: 0, busy: false, queued: null, ribbon, slip, hideSlip, seenSpreads: new Set() };

    // the pages not yet opened to are drawn in when they are
    if (!still.matches) {
      spreads.forEach((s) => {
        for (const p of [s.v, s.r]) { mark(p, false); if (p.classList.contains('page-v') && p.querySelector('.versal')) p.classList.add('pending'); }
      });
    }
    // links to a folio turn to it
    bk.addEventListener('click', onLink);
    slip.addEventListener('click', onLink);
    bindTurning();
    layout();
    const start = spreadFromHash();
    open(start);
    history.replaceState({ spread: start }, '', hashFor(start));
  }

  function unbuild() {
    if (!book) return;
    Organ.stop();
    const { spreads, stage } = book;
    const cur = book.cur;
    for (const s of spreads) {
      s.folio.append(s.v, s.r);
    }
    const jj = spreads[0].v.querySelector('.jj');
    if (jj) document.querySelector('.head').prepend(jj);
    stage.remove();
    root.classList.remove('bound');
    unmark();
    document.querySelectorAll('[inert]').forEach((e) => e.removeAttribute('inert'));
    book = null;
    if (organBtn) organBtn.hidden = true;
    if (fsBtn) fsBtn.hidden = true;
    if (cur > 0) spreads[cur].folio.scrollIntoView();
  }

  function layout() {
    if (!book) return;
    const g = geometry();
    const b = book.bk;
    b.style.zoom = g.z;
    for (const k of ['pw', 'ph', 'u', 'mi', 'mo', 'mt', 'mb']) b.style.setProperty(`--${k}`, `${g[k].toFixed(1)}px`);
    b.style.setProperty('--sz', g.sz.toFixed(3));
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

  function setAngle(j, a) {
    const L = book.leaves[j];
    L.a = a;
    L.sheet.style.transform = a ? `rotateY(${-a}deg)` : '';
    const lift = Math.sin(a * Math.PI / 180);
    L.front.querySelector('.shade').style.opacity = a < 90 ? (a / 90) * 0.85 : 0;
    L.back.querySelector('.shade').style.opacity = a > 90 ? ((180 - a) / 90) * 0.85 : 0;
    // the shadow it casts on the page it is leaving, or the one it is coming down on
    const below = j + 1 < book.N ? book.leaves[j + 1].front : book.fR;
    const behind = j > 0 ? book.leaves[j - 1].back : book.fL;
    below.querySelector('.cast').style.opacity = a > 0 && a < 90 ? lift * 0.9 : 0;
    behind.querySelector('.cast').style.opacity = a >= 90 && a < 180 ? lift * 0.9 : 0;
  }
  function stack(active = []) {
    // unturned leaves on the right, the first on top; turned ones on the left, the last on top;
    // a leaf in motion above them all
    book.leaves.forEach((L, j) => {
      L.sheet.style.zIndex = active.includes(j) ? 300 + active.indexOf(j) : (L.a >= 90 ? 100 + j : 100 - j);
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

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  function animate(j, from, to, ms, curve, done) {
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / ms);
      setAngle(j, from + (to - from) * curve(t));
      if (t < 1) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  }

  // turn to spread k: one leaf, or several in a riffle, each a little after the last
  function go(k, opts = {}) {
    if (!book) return;
    k = Math.max(0, Math.min(book.N, k));
    book.hideSlip();
    if (book.busy) { book.queued = [k, opts]; return; }
    if (k === book.cur) return;
    Organ.stop();
    const from = book.cur;
    const fwd = k > from;
    const js = fwd ? range(from, k) : range(k, from).reverse();
    if (opts.push) history.pushState({ spread: k }, '', hashFor(k));
    stopClip(book.spreads[from].v.querySelector('.plate'));
    if (still.matches) { open(k); focusAfter(opts.focus); return; }
    book.busy = true;
    for (const f of book.block.querySelectorAll('.face')) f.setAttribute('inert', '');
    // the faces that will show partway through a riffle are uncovered as the leaves pass
    const ms = js.length > 1 ? 640 : 860, gap = js.length > 1 ? 120 : 0;
    stack(js);
    let left = js.length;
    js.forEach((j, i) => {
      setTimeout(() => {
        const a0 = book.leaves[j].a;
        animate(j, a0, fwd ? 180 : 0, ms * (fwd ? (180 - a0) / 180 : a0 / 180) + 120, ease, () => {
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
      if (book.slip.matches && book.slip.matches(':popover-open')) return;
      if ((e.key === 'f' || e.key === 'F') && canFull) { e.preventDefault(); toggleFull(); return; }
      const k = book.cur;
      const keys = { ArrowRight: k + 1, ArrowDown: k + 1, PageDown: k + 1, ArrowLeft: k - 1, ArrowUp: k - 1, PageUp: k - 1, Home: 0, End: book.N };
      if (e.key === ' ' && !(t.closest && t.closest('a, button, [role="button"]'))) { e.preventDefault(); go(e.shiftKey ? k - 1 : k + 1, { push: true }); return; }
      if (!(e.key in keys)) return;
      e.preventDefault();
      go(keys[e.key], { push: true });
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
      if (Math.abs(acc) > 60) { spent = true; go(book.cur + Math.sign(acc), { push: true }); }
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
          history.pushState({ spread: book.cur }, '', hashFor(book.cur));
          stack();
          arrive(true);
        } else stack();
      });
    };
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
  function decide() {
    const want = !printing && main && wideEnough.matches && geometry().ok;
    if (want && !book) { build(); if (organBtn && Organ.ok) organBtn.hidden = false; if (fsBtn && canFull) fsBtn.hidden = false; }
    else if (!want && book) unbuild();
    else if (book) layout();
  }
  if (main && main.querySelector('.folio')) {
    decide();
    if (!book) scrollScribe();
    let raf = 0;
    window.addEventListener('resize', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(decide); });
    window.addEventListener('beforeprint', () => { printing = true; unbuild(); });
    window.addEventListener('afterprint', () => { printing = false; decide(); });
  }

  // ---------------------------------------------------------------------------------------------
  // Light. The gold catches a light that follows the pointer; after dark the pointer carries the
  // candle (src/evening.js); by day the book's shadow falls away from the sun's side of the sky.
  const hour = new Date().getHours() + new Date().getMinutes() / 60;
  root.style.setProperty('--sun', Math.max(-1, Math.min(1, (hour - 13) / 6)).toFixed(2));
  const lamps = [['lamp', 46], ['sdg-lamp', 520]]
    .map(([id, r]) => { const g = document.getElementById(id); return g && { g, svg: g.ownerSVGElement }; })
    .filter(Boolean);
  let px = -1, py = -1, lightFrame = 0;
  function light() {
    lightFrame = 0;
    root.style.setProperty('--lx', `${px}px`);
    root.style.setProperty('--ly', `${py}px`);
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
