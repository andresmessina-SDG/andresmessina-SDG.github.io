import * as THREE from 'three';
import { Book } from './book';
import { Post } from './fx';
import { Sound } from './audio';
import { UI } from './ui';
import { Game, type Progress, type Mid } from './game';
import { LEVELS, BOOK } from './levels';
import { tween, updateTweens, easeInOut } from './tween';
import { Snow } from './weather';
import { loadModel } from './paper';
import { recordPage, loadScrapbook } from './scrapbook';
import { lang, tr, t, touch, applyDom, setLang, onLang, type Lang } from './i18n';

const params = new URLSearchParams(location.search);
// Phones and small tablets get a lighter renderer; it steps down further on its own if frames drop.
const mobile = touch || Math.min(screen.width, screen.height) < 600;
const adaptive = params.get('quality') !== 'high';
let maxDpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
// Book Two has its own title card and ending.
if (BOOK === 2) {
  const relabel = (sel: string, k: string) => ((document.querySelector(sel) as HTMLElement).dataset.i18n = k);
  relabel('#title .kicker', 'kicker2');
  relabel('#title h1', 'title2');
  relabel('#title [data-i18n="blurb"]', 'blurb2');
  relabel('#otherBook', 'toBook1');
  relabel('#end .kicker', 'endKicker2');
  relabel('#end h1', 'end2');
  relabel('#end [data-i18n="endText"]', 'endText2');
}
applyDom();

const canvas = document.getElementById('scene') as HTMLCanvasElement;
// The image goes through post-processing render targets, so canvas antialiasing would only cost memory.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#1d140e');

const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 200);
const camDir = new THREE.Vector3(0, 0.74, 0.67).normalize();
const camTarget = new THREE.Vector3(0, 0.2, -0.6);
// Two framings: the whole open book, and a closer view that follows the hero.
let wideDist = 40;
let followDist = 22;
let camDist = 40;
// How far the follow view may slide before it would show the table past the book's edges.
let clampX = 6.5, clampZ0 = -3.2, clampZ1 = 3.6;
let tanV = 0.27, tanH = 0.4;
const look = new THREE.Vector3().copy(camTarget);

// Lighting: a warm lamp over the table, a soft bounce, and (at night) cool moonlight.
const hemi = new THREE.HemisphereLight(0xe7eeff, 0x8a6446, 0.55);
scene.add(hemi);
const lamp = new THREE.SpotLight(0xffc98a, 5.2, 0, 0.5, 0.8, 0);
lamp.position.set(-11, 28, 15);
lamp.target.position.set(0.5, 0, -0.5);
lamp.castShadow = true;
lamp.shadow.mapSize.setScalar(mobile ? 2048 : 4096);
lamp.shadow.camera.near = 15;
lamp.shadow.camera.far = 60;
lamp.shadow.bias = -0.0004;
lamp.shadow.normalBias = 0.02;
lamp.shadow.radius = 4;
scene.add(lamp, lamp.target);

const DAY = { hemiSky: new THREE.Color(0xe7eeff), hemiGround: new THREE.Color(0x8a6446), hemi: 0.55, lamp: 5.2, lampColor: new THREE.Color(0xffc98a), lampPos: new THREE.Vector3(-11, 28, 15), bg: new THREE.Color('#1d140e') };
const NIGHT = { hemiSky: new THREE.Color(0x5a70b0), hemiGround: new THREE.Color(0x24180f), hemi: 0.42, lamp: 2.6, lampColor: new THREE.Color(0x9db2ff), lampPos: new THREE.Vector3(9, 27, 17), bg: new THREE.Color('#0b0b12') };
let night = 0;
function setNight(k: number) {
  night = k;
  hemi.color.copy(DAY.hemiSky).lerp(NIGHT.hemiSky, k);
  hemi.groundColor.copy(DAY.hemiGround).lerp(NIGHT.hemiGround, k);
  hemi.intensity = DAY.hemi + (NIGHT.hemi - DAY.hemi) * k;
  lamp.intensity = DAY.lamp + (NIGHT.lamp - DAY.lamp) * k;
  lamp.color.copy(DAY.lampColor).lerp(NIGHT.lampColor, k);
  lamp.position.copy(DAY.lampPos).lerp(NIGHT.lampPos, k);
  (scene.background as THREE.Color).copy(DAY.bg).lerp(NIGHT.bg, k);
  snow.setNight(k);
}

const book = new Book(scene);
const post = new Post(renderer, scene, camera);
const sound = new Sound();
const ui = new UI(sound);
// Baked pop-up figures (models/bake.py), named after the art they replace. Any that fail to load
// keep their flat cutout.
const modelUrls = import.meta.glob<string>('../models/baked/*.glb', { query: '?url', import: 'default', eager: true });
const ART_NAME: Record<string, string> = { grimfin: 'orca' };
const models: Record<string, THREE.Object3D> = {};
await Promise.all(
  Object.entries(modelUrls).map(async ([path, url]) => {
    const file = path.split('/').pop()!.replace('.glb', '');
    try {
      models[ART_NAME[file] ?? file] = await loadModel(url);
    } catch (e) {
      console.warn(`paper model ${file} unavailable, using its flat cutout`, e);
    }
  }),
);
const game = new Game(scene, camera, sound, ui, models);
const snow = new Snow(scene, mobile ? 360 : 700);
if (mobile) renderer.shadowMap.autoUpdate = false;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  const dpr = maxDpr;
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  post.setSize(w, h, dpr);
  camera.aspect = w / h;
  tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  tanH = tanV * camera.aspect;
  // Wide: the open spread, about 26 wide and 16 deep with the scenery. Follow: about 11 by 6.5 cells,
  // or about 7 cells across on a phone held upright, close enough to see the paper figures well.
  wideDist = Math.max(8.2 / tanV, 13.4 / tanH);
  // A phone held sideways is short, so it gets a closer view (about 9 by 5 cells) too.
  const short = h < 500;
  followDist = Math.max((short ? 2.7 : 3.3) / tanV, (camera.aspect < 1 ? 3.6 : short ? 4.4 : 5.4) / tanH);
  setClamps(followDist);
  camera.updateProjectionMatrix();
}
/** How far the view may slide at distance `dist` before it would show the table past the book's edges. */
function setClamps(dist: number) {
  const visW = dist * tanH, visD = dist * tanV;
  clampX = Math.max(0, 14.1 - visW);
  clampZ0 = -7.8 + visD;
  clampZ1 = 8.2 - visD;
  if (clampZ0 > clampZ1) clampZ0 = clampZ1 = 0.2;
}
// When Grimfin is near, the follow view eases back to show him and his look-out squares too.
const lean = new THREE.Box3();
let leanDist = 22;
window.addEventListener('resize', resize);
resize();

// ------------------------------------------------------------------ input
const ndc = new THREE.Vector2();
let downAt: { x: number; y: number } | null = null;
canvas.addEventListener('pointerdown', (e) => (downAt = { x: e.clientX, y: e.clientY }));
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  game.hover(ndc);
});
canvas.addEventListener('pointerleave', () => game.hover(null));
canvas.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 12) return;
  downAt = null;
  if (ui.open) {
    ui.tapAdvance();
    return;
  }
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  if (e.pointerType !== 'mouse') {
    // no hover on a touch screen: flash the target square instead
    game.hover(ndc);
    window.setTimeout(() => game.hover(null), 450);
  }
  game.click(ndc);
});
const KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0],
};
window.addEventListener('keydown', (e) => {
  if (ui.open) return;
  const d = KEYS[e.key];
  if (d) {
    e.preventDefault();
    game.stepDir(d[0], d[1]);
  } else if (e.key === ' ') {
    e.preventDefault();
    game.waitTurn();
  } else if (e.key === 'j' || e.key === 'J') {
    if (game.level) ui.openJournal();
  } else if (e.key === 'm' || e.key === 'M') {
    toggleMute();
  } else if (e.key === 'l' || e.key === 'L') {
    game.toggleLantern();
  } else if (e.key === 'f' || e.key === 'F') {
    game.useFish();
  } else if (e.key === 'z' || e.key === 'Z') {
    game.undo();
  }
});
const muteBtn = document.getElementById('mute')!;
function toggleMute() {
  sound.setMuted(!sound.muted);
  muteBtn.classList.toggle('off', sound.muted);
  muteBtn.setAttribute('aria-pressed', String(sound.muted));
}
muteBtn.addEventListener('click', toggleMute);
document.querySelector<HTMLElement>('#inv .slot[data-id="fish"]')!.addEventListener('click', () => game.useFish());
const lanternBtn = document.getElementById('lanternBtn')!;
const waitBtn = document.getElementById('waitBtn')!;
const fishBtn = document.getElementById('fishBtn')!;
const undoBtn = document.getElementById('undoBtn')!;
// Undo: hold the button to keep rewinding (holding Z repeats by itself).
let rewind = 0;
const stopRewind = () => window.clearTimeout(rewind);
const rewindFrom = (delay: number) => {
  game.undo();
  rewind = window.setTimeout(() => rewindFrom(170), delay);
};
undoBtn.addEventListener('pointerdown', () => rewindFrom(450));
for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) undoBtn.addEventListener(ev, stopRewind);
// a release anywhere else (or leaving the page) also stops it, so it can't keep rewinding by itself
window.addEventListener('pointerup', stopRewind);
window.addEventListener('blur', stopRewind);
undoBtn.addEventListener('click', (e) => e.detail === 0 && game.undo()); // keyboard Enter/Space on the button
lanternBtn.addEventListener('click', () => game.toggleLantern());
waitBtn.addEventListener('click', () => game.waitTurn());
fishBtn.addEventListener('click', () => game.useFish());
game.onLantern = (covered) => {
  lanternBtn.hidden = false;
  lanternBtn.classList.toggle('off', covered);
  lanternBtn.setAttribute('aria-pressed', String(covered));
};
// Buttons only appear when they can do something: waiting and fish matter only near Grimfin.
let shownTurnBtns = '';
function syncActions() {
  const L = game.level;
  const turns = !!(L?.def.orca && L.ready);
  const state = `${turns}${game.fish}${game.undoable}${game.canUndo}`;
  if (state === shownTurnBtns) return;
  shownTurnBtns = state;
  waitBtn.hidden = !turns;
  fishBtn.hidden = !turns || game.fish <= 0;
  fishBtn.querySelector('b')!.textContent = String(game.fish);
  undoBtn.hidden = !game.undoable;
  undoBtn.classList.toggle('off', !game.canUndo);
}

// The to-do list folds down to what's next: tap it to see everything. Phones start folded.
// The tracker shows what's next on this page; tapping it opens the whole journal.
// Phones show only the main goal in the tracker, to keep the page clear.
const objective = document.getElementById('objective')!;
if (window.innerWidth < 600 || window.innerHeight < 500) objective.classList.add('mini');
objective.addEventListener('click', () => ui.openJournal());
ui.journalSource = () => game.journal();
ui.label = t;

// Fullscreen, where the browser allows it (not on iPhone, which instead offers Add to Home Screen).
type FsDoc = Document & { webkitFullscreenEnabled?: boolean; webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
const fsDoc = document as FsDoc;
const fsBtn = document.getElementById('fs')!;
const fsActive = () => !!(fsDoc.fullscreenElement ?? fsDoc.webkitFullscreenElement);
fsBtn.hidden = !(fsDoc.fullscreenEnabled || fsDoc.webkitFullscreenEnabled);
fsBtn.addEventListener('click', async () => {
  try {
    if (fsActive()) {
      await (fsDoc.exitFullscreen ? fsDoc.exitFullscreen() : fsDoc.webkitExitFullscreen?.());
      return;
    }
    const el = document.documentElement as FsEl;
    await (el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen?.());
    // The open book is wide: on a phone, hold it sideways while in fullscreen.
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    if (touch) await orientation.lock?.('landscape').catch(() => {});
  } catch {
    /* refused, e.g. not from a tap: nothing to do */
  }
});
const syncFs = () => {
  fsBtn.classList.toggle('on', fsActive());
  fsBtn.setAttribute('aria-pressed', String(fsActive()));
};
document.addEventListener('fullscreenchange', syncFs);
document.addEventListener('webkitfullscreenchange', syncFs);

// Pause the music box when the page is hidden (a phone locked, or another tab).
document.addEventListener('visibilitychange', () => {
  perfT = perfN = 0;
  if (document.hidden) game.save();
  if (!sound.ctx) return;
  if (document.hidden) sound.ctx.suspend();
  else sound.ctx.resume();
});

// Language: picked on the title card, remembered for next time.
document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) =>
  b.addEventListener('click', () => {
    if (b.dataset.lang !== lang) setLang(b.dataset.lang as Lang);
  }),
);
onLang(() => book.refreshCover());

// ------------------------------------------------------------------ loop
const focusV = new THREE.Vector3();
const want = new THREE.Vector3();
let last = 0;
let frameNo = 0;
// Adaptive quality: if the frame rate stays low, render fewer pixels, then drop the glow.
let perfT = 0, perfN = 0, perfSince = 4;
function checkPerf(raw: number, t: number) {
  if (!adaptive || raw > 1 || t < perfSince) return;
  perfT += raw;
  perfN++;
  if (perfT < 2) return;
  const fps = perfN / perfT;
  perfT = perfN = 0;
  if (fps >= 45) return;
  if (maxDpr > 1) maxDpr = Math.max(1, maxDpr - 0.25);
  else if (post.bloom.enabled) post.bloom.enabled = false;
  else if (maxDpr > 0.75) maxDpr = 0.75;
  else return;
  resize();
  perfSince = t + 1.5;
}
function frame(now: number) {
  updateTweens(now);
  const t = now / 1000;
  const raw = last ? t - last : 0.016;
  const dt = Math.min(0.05, raw);
  last = t;
  checkPerf(raw, t);
  playtestTick(raw, t);
  syncActions();
  // On phones the shadows are redrawn every other frame: the paper hardly moves between them.
  if (!renderer.shadowMap.autoUpdate && frameNo++ % 2 === 0) renderer.shadowMap.needsUpdate = true;
  game.update(t);
  if (game.dawn > 0) setNight(1 - game.dawn);

  const p = game.focusPoint;
  const follow = game.player.visible && !game.camWide;
  if (follow) {
    const threats = game.threats;
    let at = p, need = followDist;
    if (threats.length) {
      lean.makeEmpty().expandByPoint(p);
      for (const q of threats) lean.expandByPoint(q);
      lean.expandByScalar(1.5);
      at = lean.getCenter(want);
      need = Math.min(wideDist, Math.max(followDist, (lean.max.x - lean.min.x) / 2 / tanH, (lean.max.z - lean.min.z) / 2 / tanV));
    }
    leanDist += (need - leanDist) * (1 - Math.pow(0.25, dt));
    setClamps(leanDist);
    // keep the view on the book: don't drift past its edges
    want.set(THREE.MathUtils.clamp(at.x, -clampX, clampX), 0.2, THREE.MathUtils.clamp(at.z, clampZ0, clampZ1));
  } else {
    leanDist = followDist;
    want.copy(camTarget);
  }
  want.y += game.camLift * 2.2;
  want.z -= game.camLift * 3.2;
  const ease = 1 - Math.pow(0.04, dt);
  look.lerp(want, ease);
  camDist += ((follow ? leanDist : wideDist) - camDist) * ease;
  camera.position.copy(look).addScaledVector(camDir, camDist);
  camera.position.x += Math.sin(t * 0.21) * 0.12;
  if (game.shake > 0.005) {
    camera.position.x += (Math.random() - 0.5) * game.shake;
    camera.position.y += (Math.random() - 0.5) * game.shake;
  }
  camera.lookAt(look);

  focusV.copy(p).setY(p.y + 0.4).project(camera);
  const focusY = (follow ? (focusV.y + 1) / 2 : 0.48) * (1 - game.camLift) + 0.68 * game.camLift;
  post.focus += (Math.min(0.75, Math.max(0.25, focusY)) - post.focus) * 0.06;
  snow.update(dt, t, look);

  post.render(t, night);
  if (photoWanted) {
    // read the picture now, while this frame is still on the canvas
    const take = photoWanted;
    photoWanted = null;
    take(shrink(canvas));
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ------------------------------------------------------------------ saving
// The game saves itself in this browser only: at the start of every chapter after the first, and
// after every move, as the list of moves made since the chapter began (Continue replays them).
// each book keeps its own saved game
const SAVE_KEY = BOOK === 2 ? 'penguin-rescue-save-2' : 'penguin-rescue-save';
/** A fingerprint of a chapter's map: moves saved on a different map can't be replayed. */
const mapHash = (i: number) => [...LEVELS[i].map.join('')].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
const MOVE_KEYS = new Set(['s', 'n', 'w', 'i', 'c', 'f', 'l', 'u', 'g']);
function validMid(m: Mid | undefined, chapter: number): Mid | undefined {
  if (!m || !Array.isArray(m.moves) || !Array.isArray(m.answers) || m.map !== mapHash(chapter) || m.moves.length > 20000) return undefined;
  const ok = m.moves.every((x) => x && typeof x === 'object' && Object.keys(x).every((k) => MOVE_KEYS.has(k))) &&
    m.answers.every((a) => Number.isInteger(a) && a >= 0 && a < 4);
  return ok ? { moves: m.moves, answers: m.answers, map: m.map } : undefined;
}
const ITEMS = new Set(['lantern', 'boat', 'yarn', 'ball', 'fish', 'specs', 'present']);
function loadProgress(): Progress | null {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null') as (Omit<Progress, 'v'> & { v: number }) | null;
    if (!raw) return null;
    // Saves from the three-chapter book: its chapters two and three are now three and four.
    const p = (raw.v === 1 ? { ...raw, v: 2, chapter: raw.chapter + 1, walrus: false, foxes: false, crates: 0 } : raw) as Progress;
    const ok = p.v === 2 && Number.isInteger(p.chapter) && p.chapter >= 0 && p.chapter < LEVELS.length &&
      Array.isArray(p.inv) && p.inv.every((x) => ITEMS.has(x)) && Number.isInteger(p.fish) && p.fish >= 0 && p.fish < 50 &&
      Number.isInteger(p.stars) && p.stars >= 0 && p.stars <= game.stats.starTotal;
    if (!ok) return null;
    const mid = validMid(p.mid, p.chapter);
    // the first chapter is only worth continuing partway through
    if (p.chapter === 0 && !mid) return null;
    const crates = Number.isInteger(p.crates) ? Math.max(0, Math.min(3, p.crates)) : 0;
    return {
      ...p, puffin: !!p.puffin, bobble: !!p.bobble, splashUsed: !!p.splashUsed, gentle: !!p.gentle, covered: !!p.covered,
      walrus: !!p.walrus, foxes: !!p.foxes, crates, mid,
    };
  } catch {
    return null;
  }
}
function saveProgress(p: Progress | null) {
  try {
    if (p) localStorage.setItem(SAVE_KEY, JSON.stringify(p));
    else localStorage.removeItem(SAVE_KEY);
  } catch {
    /* storage blocked (private browsing): the game simply won't remember */
  }
}
const saved = loadProgress();
const startBtn = document.getElementById('start')!;
const contBtn = document.getElementById('continue')!;
const gentleBox = document.getElementById('gentle') as HTMLInputElement;
const scrapBtn = document.getElementById('scrapbook')!;
// Playing one chapter again from the scrapbook (?replay=<chapter id>): the story save is left alone.
const replayAt = LEVELS.findIndex((l) => l.id === params.get('replay'));
if (replayAt >= 0) {
  delete startBtn.dataset.i18n;
  const label = () => (startBtn.textContent = `▶ ${t('playPage')}: ${tr(LEVELS[replayAt].title, LEVELS[replayAt].titleRu)}`);
  label();
  onLang(label);
  const back = document.getElementById('back')!;
  back.hidden = false;
  back.addEventListener('click', leaveReplay);
} else if (LEVELS.some((l) => loadScrapbook()[l.id]?.photo)) {
  // the scrapbook can be opened from the title card once a chapter has its photo
  scrapBtn.hidden = false;
  scrapBtn.addEventListener('click', () => ui.openJournal('book', true));
}
// The other book: Book Two from Book One's title card, and back again.
const otherBook = document.getElementById('otherBook')!;
otherBook.hidden = replayAt >= 0;
otherBook.addEventListener('click', () => {
  const q = new URLSearchParams(location.search);
  q.delete('replay');
  if (BOOK === 2) q.delete('book');
  else q.set('book', '2');
  q.set('lang', lang);
  location.search = q.toString();
});
/** From a chapter played again, back to the title card for the whole book. */
function leaveReplay() {
  const q = new URLSearchParams(location.search);
  q.delete('replay');
  location.search = q.toString();
}
ui.onPlay = (i) => {
  const q = new URLSearchParams(location.search);
  q.set('replay', LEVELS[i].id);
  q.set('lang', lang);
  location.search = q.toString();
};
if (saved && replayAt < 0) {
  // With a saved game, Continue is the main button and starting again is the quieter one.
  contBtn.hidden = false;
  startBtn.dataset.i18n = 'startOver';
  startBtn.classList.add('alt');
  // Gentle mode as last chosen, which may have changed partway through the chapter
  const g = saved.mid?.moves.filter((m) => 'g' in m).pop();
  gentleBox.checked = g && 'g' in g ? g.g : saved.gentle;
  const label = () => {
    const def = LEVELS[saved.chapter];
    document.getElementById('contChapter')!.textContent = tr(def.title, def.titleRu);
  };
  label();
  onLang(label);
  applyDom();
}

// ------------------------------------------------------------------ the scrapbook snapshot
let photoWanted: ((url: string) => void) | null = null;
const takePhoto = () => new Promise<string>((r) => (photoWanted = r));
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A small 16:10 JPEG of the view, cropped from the middle. */
function shrink(src: HTMLCanvasElement) {
  const W = 400, H = 250;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  let sw = src.width, sh = src.height;
  if (sw / sh > W / H) sw = sh * (W / H);
  else sh = sw / (W / H);
  c.getContext('2d')!.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, W, H);
  return c.toDataURL('image/jpeg', 0.75);
}

/** The end of a chapter: click, flash, and a photo for the scrapbook flies off to the journal. */
async function snapshot(i: number) {
  const def = LEVELS[i];
  await pause(300);
  const photo = await takePhoto();
  recordPage(def.id, { ...game.pageNow(), photo });
  sound.blip(1500);
  sound.fold(0.8);
  const flash = document.getElementById('flash')!;
  flash.classList.remove('go');
  void flash.offsetWidth; // restart the animation
  flash.classList.add('go');
  const snap = document.getElementById('snap')!;
  snap.querySelector('img')!.src = photo;
  snap.querySelector('p')!.textContent = tr(def.title, def.titleRu);
  snap.className = '';
  snap.hidden = false;
  await pause(30);
  snap.classList.add('show');
  ui.toast(t('snap'));
  await pause(1900);
  snap.classList.add('away');
  sound.rustle(0.4);
  await pause(850);
  snap.hidden = true;
}

// ------------------------------------------------------------------ playtest
// ?playtest: counts moves, undos, catches and time in each chapter and shows them when it ends.
// Everything stays in this browser.
const playtest = params.has('playtest');
const PLAYTEST_KEY = 'penguin-rescue-playtest';
interface PlayRow { chapter: string; when: string; moves: number; undos: number; catches: number; minutes: number; gentle: boolean }
interface PlayLog { chapter: number; ms: number; rows: PlayRow[] }
function loadPlayLog(): PlayLog {
  try {
    const v = JSON.parse(localStorage.getItem(PLAYTEST_KEY) ?? '');
    if (v && Array.isArray(v.rows)) return v;
  } catch { /* none yet */ }
  return { chapter: -1, ms: 0, rows: [] };
}
const playLog = loadPlayLog();
let playSaved = 0;
function savePlayLog() {
  try { localStorage.setItem(PLAYTEST_KEY, JSON.stringify(playLog)); } catch { /* storage full or blocked */ }
}
/** Called every frame: counts the time a chapter is being played. */
function playtestTick(raw: number, t: number) {
  if (!playtest || !game.level?.ready || document.hidden) return;
  playLog.ms += Math.min(raw, 1) * 1000;
  if (t - playSaved > 5) {
    playSaved = t;
    savePlayLog();
  }
}
/** The end of a chapter: add its numbers to the log and show them all until closed. */
async function playtestCard(i: number) {
  const m = game.moves;
  playLog.rows.push({
    chapter: LEVELS[i].id,
    when: new Date().toLocaleString(),
    moves: m.filter((x) => ('s' in x && x.n) || 'w' in x).length,
    undos: m.filter((x) => 'u' in x).length,
    catches: game.catches,
    minutes: Math.round(playLog.ms / 6000) / 10,
    gentle: game.gentle,
  });
  playLog.ms = 0;
  savePlayLog();
  const card = document.getElementById('playtest')!;
  const head = [tr('Chapter', 'Глава'), tr('Moves', 'Ходы'), tr('Undos', 'Отмены'), tr('Caught', 'Поймали'), tr('Minutes', 'Минуты'), tr('Gentle', 'Мягкий')];
  const esc = (v: unknown) => String(v).replace(/[&<>]/g, (c) => `&#${c.charCodeAt(0)};`);
  card.querySelector('table')!.innerHTML = `<tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>` +
    playLog.rows.slice().reverse().map((r) => `<tr title="${esc(r.when)}"><td>${esc(r.chapter)}</td><td>${r.moves}</td><td>${r.undos}</td><td>${r.catches}</td><td>${r.minutes}</td><td>${r.gentle ? '✓' : ''}</td></tr>`).join('');
  card.hidden = false;
  await new Promise<void>((r) => card.querySelector('button')!.addEventListener('click', () => r(), { once: true }));
  card.hidden = true;
}

// ------------------------------------------------------------------ story
/** What you'd carry into a chapter played again: the usual kit, and the friends your scrapbook says you helped before it. */
function replayStart(i: number): Progress {
  const book = loadScrapbook();
  const done = new Set(LEVELS.slice(0, i).flatMap((l) => book[l.id]?.sides ?? []));
  return {
    v: 2, chapter: i, inv: ['lantern', 'boat'], fish: done.has('yarn') ? 3 : 0, stars: 0,
    puffin: done.has('yarn'), bobble: done.has('ball'), splashUsed: false, gentle: gentleBox.checked, covered: false,
    walrus: done.has('specs'), foxes: done.has('kits'), crates: 0,
  };
}

async function run() {
  const title = document.getElementById('title')!;
  const resume = await new Promise<boolean>((r) => {
    startBtn.addEventListener('click', () => r(false), { once: true });
    contBtn.addEventListener('click', () => r(true), { once: true });
  });
  sound.start();
  let first = 0;
  const one = replayAt >= 0;
  const resuming = resume && saved && !one ? saved : null;
  if (one) {
    first = replayAt;
    if (first > 0) game.restore(replayStart(first));
  } else if (resuming) {
    // the first chapter starts from a fresh game
    if (resuming.chapter > 0) game.restore(resuming);
    first = resuming.chapter;
  } else {
    saveProgress(null);
  }
  // a replayed chapter starts with the Gentle mode it was saved with, and then takes the new choice
  game.gentle = resuming?.mid ? resuming.gentle : gentleBox.checked;
  title.classList.add('gone');
  sound.rustle(1.2);
  if (LEVELS[first].night) {
    sound.setNight(true);
    tween(1600, (k) => setNight(k), easeInOut);
  }
  await book.open();
  document.getElementById('hud')!.hidden = false;
  for (let i = first; i < (one ? first + 1 : LEVELS.length); i++) {
    const continuing = i === first && resuming?.mid ? resuming : null;
    const begin = continuing ? { ...continuing, mid: undefined } : game.snapshot(i);
    if (i > 0 && !continuing && !one) saveProgress(begin);
    if (!one) game.onSave = () => saveProgress({ ...begin, mid: { moves: game.moves, answers: ui.answers, map: mapHash(i) } });
    if (playtest && !(continuing && playLog.chapter === i)) playLog.ms = 0;
    playLog.chapter = i;
    if (i > first) {
      await game.closeChapter();
      sound.pageTurn();
      sound.setNight(LEVELS[i].night);
      const from = night, to = LEVELS[i].night ? 1 : 0;
      tween(1600, (k) => setNight(from + (to - from) * k), easeInOut);
      await book.turnPage(() => sound.fold(0.5));
    }
    const rain = LEVELS[i].season === 'spring';
    snow.setRain(rain);
    sound.setRain(rain);
    await game.playChapter(i, continuing ? { mid: continuing.mid!, gentle: gentleBox.checked } : undefined);
    if (playtest) await playtestCard(i);
    await snapshot(i);
  }
  game.onSave = () => {};
  if (one) {
    // back to the title card, where the scrapbook now has the new photo
    await game.closeChapter();
    document.getElementById('hud')!.hidden = true;
    const fromNight = night;
    tween(1400, (k) => setNight(fromNight * (1 - k)), easeInOut);
    await book.close();
    leaveReplay();
    return;
  }
  saveProgress(null);
  await game.closeChapter();
  document.getElementById('hud')!.hidden = true;
  sound.rustle(1.2);
  // the book closes in daylight, from whatever light the last chapter had
  const fromNight = night;
  tween(1400, (k) => setNight(fromNight * (1 - k)), easeInOut);
  await book.close();
  sound.fold();
  const st = game.stats;
  document.getElementById('stats')!.textContent =
    tr(`Paper stars found: ${st.stars} of ${st.starTotal} · Side quests: ${st.sideDone} of ${st.sideTotal}`,
      `Найдено бумажных звёздочек: ${st.stars} из ${st.starTotal} · Побочные задания: ${st.sideDone} из ${st.sideTotal}`) +
    (st.missed.length
      ? tr(`. Still to do next time: ${st.missed.join(', ')}.`, `. В следующий раз: ${st.missed.join(', ')}.`)
      : tr('. Every single one. Hooray!', '. Все до единого. Ура!'));
  document.getElementById('end')!.hidden = false;
}
document.getElementById('again')!.addEventListener('click', () => location.reload());
setNight(0);
run();

// Debug hook for automated screenshots: ?debug exposes the game on window.
if (params.has('debug')) {
  (window as unknown as Record<string, unknown>).__game = { game, book, ui, sound };
}
