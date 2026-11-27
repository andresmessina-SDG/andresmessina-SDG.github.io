// Procedural paper sounds and a music-box score, all synthesised with Web Audio.

type Note = number | null;

const DAY: { mel: Note[]; bass: number[]; step: number; base: number } = {
  // 3/4, eight bars, in C major pentatonic
  mel: [7, null, 4, 5, 4, 2, 0, null, 2, 4, null, null, 7, null, 9, 7, 4, 2, 4, 2, 0, 2, null, null],
  bass: [0, -3, -7, -5, 0, -3, -7, -5],
  step: 0.3,
  base: 523.25,
};
const NIGHT: typeof DAY = {
  mel: [0, null, 3, 5, 3, 0, -2, null, 0, 3, null, null, 7, null, 5, 3, 0, -2, 0, null, null, null, null, null],
  bass: [0, -4, 3, -5, 0, -4, -2, -5],
  step: 0.42,
  base: 440,
};

const hz = (base: number, semis: number) => base * Math.pow(2, semis / 12);

export class Sound {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private wind!: GainNode;
  private water!: GainNode;
  private rain!: GainNode;
  private raining = false;
  private noise!: AudioBuffer;
  private nextT = 0;
  private stepI = 0;
  private score = DAY;
  muted = false;

  start() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.connect(ctx.destination);
    this.master = this.gain(this.muted ? 0 : 0.9, comp);
    this.sfx = this.gain(0.9, this.master);
    this.music = this.gain(0.16, this.master);

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.wind = this.ambient(420, 0.6, 0.09, 0.07);
    this.water = this.ambient(380, 1.4, 0.23, 0);
    this.rain = this.ambient(2600, 0.7, 0.07, this.raining ? 0.05 : 0);
    this.nextT = ctx.currentTime + 0.4;
    setInterval(() => this.schedule(), 60);
  }

  private gain(v: number, to: AudioNode) {
    const g = this.ctx!.createGain();
    g.gain.value = v;
    g.connect(to);
    return g;
  }

  private ambient(freq: number, q: number, lfoHz: number, level: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const out = this.gain(level, this.master);
    const mod = ctx.createGain();
    mod.gain.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = lfoHz;
    const depth = ctx.createGain();
    depth.gain.value = 0.4;
    lfo.connect(depth).connect(mod.gain);
    src.connect(f).connect(mod).connect(out);
    src.start();
    lfo.start();
    return out;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  setNight(night: boolean) {
    this.score = night ? NIGHT : DAY;
    this.stepI = 0;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.wind.gain.setTargetAtTime(night ? 0.05 : 0.07, t, 1);
    this.water.gain.setTargetAtTime(night ? 0.12 : 0.0, t, 1);
  }

  private schedule() {
    const ctx = this.ctx!;
    while (this.nextT < ctx.currentTime + 0.25) {
      const s = this.score;
      const i = this.stepI % s.mel.length;
      const n = s.mel[i];
      if (n !== null) this.box(hz(s.base, n), this.nextT, 0.5);
      if (i % 3 === 0) {
        const root = s.bass[Math.floor(i / 3) % s.bass.length];
        this.box(hz(s.base, root - 24), this.nextT, 0.45);
        this.box(hz(s.base, root - 12 + 7), this.nextT + s.step, 0.18);
        this.box(hz(s.base, root - 12 + (s === NIGHT ? 3 : 4)), this.nextT + s.step * 2, 0.18);
      }
      this.nextT += s.step;
      this.stepI++;
    }
  }

  /** One music-box tine: fundamental plus a quickly fading high partial. */
  private box(f: number, t: number, vol: number, out?: AudioNode) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    g.connect(out ?? this.music);
    const o1 = ctx.createOscillator();
    o1.frequency.value = f;
    o1.connect(g);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(vol * 0.35, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    g2.connect(out ?? this.music);
    const o2 = ctx.createOscillator();
    o2.frequency.value = f * 4.07;
    o2.connect(g2);
    for (const o of [o1, o2]) {
      o.start(t);
      o.stop(t + 1.7);
    }
  }

  private burst(t: number, opts: { type: BiquadFilterType; f: number; q?: number; vol: number; dur: number; f2?: number }) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = opts.type;
    f.frequency.setValueAtTime(opts.f, t);
    if (opts.f2) f.frequency.exponentialRampToValueAtTime(opts.f2, t + opts.dur);
    f.Q.value = opts.q ?? 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(opts.vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t + opts.dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t, Math.random() * 1.5);
    src.stop(t + opts.dur + 0.05);
  }

  private tone(t: number, type: OscillatorType, f1: number, f2: number, vol: number, dur: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private get now() {
    return this.ctx ? this.ctx.currentTime : -1;
  }

  /** Crinkling paper: a cloud of tiny band-passed grains. */
  rustle(amount = 1) {
    const t = this.now;
    if (t < 0) return;
    const n = Math.round(10 * amount);
    for (let i = 0; i < n; i++) {
      this.burst(t + Math.random() * 0.25 * amount, {
        type: 'bandpass', f: 1800 + Math.random() * 3800, q: 1.2, vol: 0.12 + Math.random() * 0.18, dur: 0.015 + Math.random() * 0.04,
      });
    }
  }

  /** A crease snapping flat, with a soft card thump. */
  fold(vol = 1) {
    const t = this.now;
    if (t < 0) return;
    this.burst(t, { type: 'highpass', f: 1800, vol: 0.22 * vol, dur: 0.05 });
    this.tone(t, 'sine', 150, 55, 0.25 * vol, 0.12);
  }

  pageTurn() {
    const t = this.now;
    if (t < 0) return;
    this.burst(t, { type: 'bandpass', f: 500, f2: 2600, q: 0.6, vol: 0.35, dur: 0.75 });
    this.rustle(1.4);
    setTimeout(() => this.fold(0.8), 650);
  }

  step(snow = true) {
    const t = this.now;
    if (t < 0) return;
    this.burst(t, { type: 'lowpass', f: 700 + Math.random() * 500, vol: 0.28, dur: 0.07 });
    if (snow) for (let i = 0; i < 4; i++) this.burst(t + Math.random() * 0.05, { type: 'highpass', f: 3500, vol: 0.05, dur: 0.02 });
  }

  chime(notes = [0, 4, 7, 12]) {
    const t = this.now;
    if (t < 0) return;
    notes.forEach((n, i) => this.box(hz(784, n), t + i * 0.09, 0.4, this.sfx));
  }

  blip(pitch: number) {
    const t = this.now;
    if (t < 0) return;
    if (pitch < 200) {
      this.tone(t, 'sawtooth', pitch * (0.9 + Math.random() * 0.2), pitch * 0.8, 0.07, 0.09);
    } else {
      this.tone(t, 'triangle', pitch * (0.92 + Math.random() * 0.16), pitch * 1.05, 0.06, 0.05);
    }
  }

  growl() {
    const t = this.now;
    if (t < 0) return;
    const ctx = this.ctx!;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 380;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.45, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    f.connect(g).connect(this.sfx);
    for (const fr of [55, 58.5, 82]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(fr, t);
      o.frequency.linearRampToValueAtTime(fr * 0.8, t + 1.1);
      o.connect(f);
      o.start(t);
      o.stop(t + 1.2);
    }
  }

  splash(vol = 1) {
    const t = this.now;
    if (t < 0) return;
    this.burst(t, { type: 'lowpass', f: 4000, f2: 300, vol: 0.5 * vol, dur: 0.6 });
    for (let i = 0; i < 6; i++) this.tone(t + 0.1 + Math.random() * 0.4, 'sine', 400 + Math.random() * 300, 900 + Math.random() * 500, 0.05 * vol, 0.06);
  }

  flare() {
    const t = this.now;
    if (t < 0) return;
    [0, 4, 7, 11, 14, 19].forEach((n, i) => this.box(hz(523.25, n), t + i * 0.07, 0.35, this.sfx));
    this.burst(t, { type: 'bandpass', f: 800, f2: 6000, q: 0.5, vol: 0.25, dur: 1.2 });
  }

  bump() {
    const t = this.now;
    if (t < 0) return;
    this.tone(t, 'sine', 180, 120, 0.15, 0.1);
  }
  /** Ice giving way: a few sharp snaps. */
  crack(vol = 1) {
    const t = this.now;
    if (t < 0) return;
    for (let i = 0; i < 3; i++) this.burst(t + i * 0.045, { type: 'highpass', f: 2600 + i * 700, q: 1.2, vol: 0.32 * vol, dur: 0.06 });
  }
  /** Spring rain: a soft hiss that comes and goes. */
  setRain(on: boolean) {
    this.raining = on;
    if (this.ctx) this.rain.gain.setTargetAtTime(on ? 0.05 : 0, this.ctx.currentTime, 1.5);
  }
}
