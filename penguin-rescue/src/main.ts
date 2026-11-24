import * as THREE from 'three';
import { Book } from './book';
import { Post } from './fx';
import { Sound } from './audio';
import { UI } from './ui';
import { Game } from './game';
import { LEVELS } from './levels';
import { tween, updateTweens, easeInOut } from './tween';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#1d140e');

const camera = new THREE.PerspectiveCamera(28, 1, 0.5, 120);
const camDir = new THREE.Vector3(0, 0.7, 0.71).normalize();
const camTarget = new THREE.Vector3(0, 0.2, -0.25);
let camDist = 22;

// Lighting: a warm lamp over the table, a soft bounce, and (at night) cool moonlight.
const hemi = new THREE.HemisphereLight(0xe7eeff, 0x8a6446, 0.55);
scene.add(hemi);
const lamp = new THREE.SpotLight(0xffc98a, 5.2, 0, 0.42, 0.85, 0);
lamp.position.set(-6, 15, 8);
lamp.target.position.set(0.5, 0, 0);
lamp.castShadow = true;
lamp.shadow.mapSize.set(2048, 2048);
lamp.shadow.camera.near = 6;
lamp.shadow.camera.far = 40;
lamp.shadow.bias = -0.0004;
lamp.shadow.normalBias = 0.02;
lamp.shadow.radius = 4;
scene.add(lamp, lamp.target);

const DAY = { hemiSky: new THREE.Color(0xe7eeff), hemiGround: new THREE.Color(0x8a6446), hemi: 0.55, lamp: 5.2, lampColor: new THREE.Color(0xffc98a), lampPos: new THREE.Vector3(-6, 15, 8), bg: new THREE.Color('#1d140e') };
const NIGHT = { hemiSky: new THREE.Color(0x5a70b0), hemiGround: new THREE.Color(0x24180f), hemi: 0.42, lamp: 2.6, lampColor: new THREE.Color(0x9db2ff), lampPos: new THREE.Vector3(5, 14, 9), bg: new THREE.Color('#0b0b12') };
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
}

const book = new Book(scene);
const post = new Post(renderer, scene, camera);
const sound = new Sound();
const ui = new UI(sound);
const game = new Game(scene, camera, sound, ui);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  post.setSize(w, h, dpr);
  camera.aspect = w / h;
  // Fit the open spread (about 13.4 wide, 11 deep with the scenery) in view.
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const tanH = tanV * camera.aspect;
  camDist = Math.max(4.7 / tanV, 6.85 / tanH);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ------------------------------------------------------------------ input
const ndc = new THREE.Vector2();
let downAt: { x: number; y: number } | null = null;
canvas.addEventListener('pointerdown', (e) => (downAt = { x: e.clientX, y: e.clientY }));
canvas.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 12) return;
  downAt = null;
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
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
  } else if (e.key === 'm' || e.key === 'M') {
    toggleMute();
  }
});
const muteBtn = document.getElementById('mute')!;
function toggleMute() {
  sound.setMuted(!sound.muted);
  muteBtn.classList.toggle('off', sound.muted);
  muteBtn.setAttribute('aria-pressed', String(sound.muted));
}
muteBtn.addEventListener('click', toggleMute);

// ------------------------------------------------------------------ loop
const focusV = new THREE.Vector3();
const look = new THREE.Vector3();
function frame(now: number) {
  updateTweens(now);
  const t = now / 1000;
  game.update(t);

  const p = game.focusPoint;
  const follow = game.player.visible ? 1 : 0;
  look.set(camTarget.x + p.x * 0.12 * follow, camTarget.y + game.camLift * 1.4, camTarget.z + p.z * 0.08 * follow - game.camLift * 2.2);
  camera.position.copy(look).addScaledVector(camDir, camDist);
  camera.position.x += Math.sin(t * 0.21) * 0.12;
  if (game.shake > 0.005) {
    camera.position.x += (Math.random() - 0.5) * game.shake;
    camera.position.y += (Math.random() - 0.5) * game.shake;
  }
  camera.lookAt(look);

  focusV.copy(p).setY(p.y + 0.4).project(camera);
  const want = (follow ? (focusV.y + 1) / 2 : 0.48) * (1 - game.camLift) + 0.68 * game.camLift;
  post.focus += (Math.min(0.75, Math.max(0.25, want)) - post.focus) * 0.06;

  post.render(t, night);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ------------------------------------------------------------------ story
async function run() {
  const title = document.getElementById('title')!;
  await new Promise<void>((r) => document.getElementById('start')!.addEventListener('click', () => r(), { once: true }));
  sound.start();
  title.classList.add('gone');
  sound.rustle(1.2);
  await book.open();
  document.getElementById('hud')!.hidden = false;
  for (let i = 0; i < LEVELS.length; i++) {
    if (i > 0) {
      await game.closeChapter();
      sound.pageTurn();
      sound.setNight(LEVELS[i].night);
      const from = night, to = LEVELS[i].night ? 1 : 0;
      tween(1600, (k) => setNight(from + (to - from) * k), easeInOut);
      await book.turnPage();
    }
    await game.playChapter(i);
  }
  await game.closeChapter();
  document.getElementById('hud')!.hidden = true;
  sound.rustle(1.2);
  tween(1400, (k) => setNight(1 - k), easeInOut);
  await book.close();
  sound.fold();
  document.getElementById('end')!.hidden = false;
}
document.getElementById('again')!.addEventListener('click', () => location.reload());
setNight(0);
run();

// Debug hook for automated screenshots: ?debug exposes the game on window.
if (new URLSearchParams(location.search).has('debug')) {
  (window as unknown as Record<string, unknown>).__game = { game, book, ui, sound };
}
