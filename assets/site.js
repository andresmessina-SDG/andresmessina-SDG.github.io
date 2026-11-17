// The little that moves on this page. Nothing here is needed to read it, and nothing
// moves for readers who ask for stillness; the music sounds only when it is asked for.
(() => {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');

  // One sweep of light across the gold leaf of the initial, once the letter is set,
  // and again when a pointer rests on it.
  const sweep = document.getElementById('sweep');
  const initial = document.querySelector('.initial');
  if (sweep && initial && sweep.beginElement) {
    const shine = () => { if (!still.matches) { try { sweep.beginElement(); } catch (e) {} } };
    const ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    ready.then(() => setTimeout(shine, 350));
    initial.addEventListener('mouseenter', shine);
  }

  // The scribe at work: whatever is still below the fold is ruled, painted, laid
  // and signed as it comes into view. What is already in view is left as it is.
  const parts = document.querySelectorAll('.score, hr.staff, .work, .signature');
  if (!still.matches && 'IntersectionObserver' in window && parts.length) {
    const fold = window.innerHeight * 0.9;
    const seen = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target;
        seen.unobserve(el);
        el.classList.replace('pending', 'inked');
        if (el.classList.contains('signature')) sign(el);
      }
    }, { rootMargin: '0px 0px -12% 0px' });
    for (const el of parts) {
      if (el.getBoundingClientRect().top < fold) continue;
      el.classList.add('pending');
      seen.observe(el);
    }
  }

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

  // B-A-C-H: his name in German note names, B flat, A, C, B natural, played on a small
  // organ in a resonant room, each note lit as it sounds.
  const play = document.querySelector('.motif-play');
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!play || !Ctx) return;
  play.hidden = false;
  const notes = play.querySelectorAll('.motif .n');
  const letters = play.querySelectorAll('.motif-letters text');
  const MOTIF = [466.16, 440.0, 523.25, 493.88];
  let ctx, out, organ, busy = false;

  function room() {
    ctx = new Ctx();
    // a church acoustic: decaying noise as the impulse response of a stone room
    const len = Math.floor(ctx.sampleRate * 3.2);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    const verb = ctx.createConvolver();
    verb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.42;
    const dry = ctx.createGain(); dry.gain.value = 0.75;
    out = ctx.createGain(); out.gain.value = 0.32;
    out.connect(dry).connect(ctx.destination);
    out.connect(verb).connect(wet).connect(ctx.destination);
    // a principal chorus: the fundamental, its octave, twelfth and fifteenth
    const real = new Float32Array(9), imag = new Float32Array(9);
    [0, 1, 0.55, 0.3, 0.34, 0.07, 0.14, 0, 0.1].forEach((v, i) => { imag[i] = v; });
    organ = ctx.createPeriodicWave(real, imag);
  }

  function pipe(freq, at, len) {
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(1, at + 0.05);
    env.gain.setValueAtTime(1, at + len);
    env.gain.exponentialRampToValueAtTime(0.0001, at + len + 0.3);
    env.connect(out);
    for (const [f, g] of [[freq, 1], [freq / 2, 0.35]]) {
      const o = ctx.createOscillator();
      o.setPeriodicWave(organ);
      o.frequency.value = f;
      const v = ctx.createGain(); v.gain.value = g;
      o.connect(v).connect(env);
      o.start(at); o.stop(at + len + 0.35);
    }
    // the breath of air as the pipe speaks
    const n = ctx.createBufferSource();
    const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.08), ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    n.buffer = b;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq * 4; bp.Q.value = 3;
    const ng = ctx.createGain(); ng.gain.value = 0.12;
    n.connect(bp).connect(ng).connect(out);
    n.start(at);
  }

  play.addEventListener('click', () => {
    if (busy) return;
    if (!ctx) room();
    if (ctx.state === 'suspended') ctx.resume();
    busy = true;
    play.classList.add('playing');
    const beat = 0.6, start = ctx.currentTime + 0.06;
    MOTIF.forEach((f, i) => {
      const last = i === MOTIF.length - 1;
      pipe(f, start + i * beat, last ? 1.5 : beat - 0.04);
      setTimeout(() => {
        notes.forEach((el, k) => el.classList.toggle('lit', k === i));
        letters.forEach((el, k) => el.classList.toggle('lit', k === i));
      }, (0.06 + i * beat) * 1000);
    });
    setTimeout(() => {
      notes.forEach((el) => el.classList.remove('lit'));
      letters.forEach((el) => el.classList.remove('lit'));
      play.classList.remove('playing');
      busy = false;
    }, (0.06 + 3 * beat + 1.6) * 1000);
  });
})();
