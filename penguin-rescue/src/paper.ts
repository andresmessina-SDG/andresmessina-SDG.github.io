// Procedural paper: fibre textures, die-cut cutouts and paper materials.
import * as THREE from 'three';

export function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rand = mulberry(20261124);
export const pick = <T>(a: T[]) => a[Math.floor(rand() * a.length)];

export function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  return c;
}
export const ctx2d = (c: HTMLCanvasElement) => c.getContext('2d')!;

/** Draw at every wrapped offset so the texture tiles without seams. */
function wrapped(size: number, x: number, y: number, fn: (x: number, y: number) => void) {
  for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) fn(x + dx, y + dy);
}

/** Tileable greyscale paper: cloudy formation, fibres and specks. */
export function paperCanvas(size = 512, seed = 7, base = 244) {
  const r = mulberry(seed);
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  g.fillStyle = `rgb(${base},${base},${base})`;
  g.fillRect(0, 0, size, size);

  for (let i = 0; i < 110; i++) {
    const x = r() * size, y = r() * size, rad = 14 + r() * 70;
    const a = 0.02 + r() * 0.035, dark = r() < 0.6;
    wrapped(size, x, y, (px, py) => {
      const grd = g.createRadialGradient(px, py, 0, px, py, rad);
      grd.addColorStop(0, dark ? `rgba(120,105,90,${a})` : `rgba(255,255,255,${a * 1.5})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    });
  }
  for (let i = 0; i < 1600; i++) {
    const x = r() * size, y = r() * size, len = 3 + r() * 16, ang = r() * Math.PI * 2;
    const bend = (r() - 0.5) * len * 0.8, a = 0.05 + r() * 0.12, dark = r() < 0.7;
    const w = 0.5 + r() * 1.1;
    wrapped(size, x, y, (px, py) => {
      g.strokeStyle = dark ? `rgba(95,80,65,${a})` : `rgba(255,255,255,${a * 1.6})`;
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(px, py);
      const ex = px + Math.cos(ang) * len, ey = py + Math.sin(ang) * len;
      g.quadraticCurveTo((px + ex) / 2 - Math.sin(ang) * bend, (py + ey) / 2 + Math.cos(ang) * bend, ex, ey);
      g.stroke();
    });
  }
  for (let i = 0; i < 380; i++) {
    const x = r() * size, y = r() * size, rr = 0.4 + r() * 1.1, a = 0.08 + r() * 0.2;
    wrapped(size, x, y, (px, py) => {
      g.fillStyle = `rgba(90,75,60,${a})`;
      g.beginPath();
      g.arc(px, py, rr, 0, Math.PI * 2);
      g.fill();
    });
  }
  return c;
}

export function canvasTex(c: HTMLCanvasElement, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

let _paperTex: THREE.Texture | null = null;
export function paperTex() {
  if (!_paperTex) _paperTex = canvasTex(paperCanvas(512, 7, 244), true);
  return _paperTex;
}

let _grain: HTMLCanvasElement | null = null;
function grain() {
  if (!_grain) _grain = paperCanvas(256, 11, 252);
  return _grain;
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();
/** Tinted paper material sharing one fibre texture (also used as a bump map). */
export function paperMat(color: string, rough = 0.95) {
  const k = color + rough;
  let m = matCache.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      map: paperTex(),
      bumpMap: paperTex(),
      bumpScale: 0.9,
      roughness: rough,
      metalness: 0,
    });
    matCache.set(k, m);
  }
  return m;
}

/** A thin box with randomised UVs so neighbouring tiles don't repeat the same fibres. */
export function tileGeometry(w: number, h: number, d: number) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const ou = rand(), ov = rand();
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.5 + ou, uv.getY(i) * 0.5 + ov);
  return geo;
}

function multiplyGrain(c: HTMLCanvasElement) {
  const mask = makeCanvas(c.width, c.height);
  ctx2d(mask).drawImage(c, 0, 0);
  const g = ctx2d(c);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = g.createPattern(grain(), 'repeat')!;
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(mask, 0, 0);
  g.globalCompositeOperation = 'source-over';
}

function dilate(src: HTMLCanvasElement, W: number, H: number, ox: number, oy: number, r: number, color: string) {
  const c = makeCanvas(W, H);
  const g = ctx2d(c);
  const N = 28;
  g.drawImage(src, ox, oy);
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    g.drawImage(src, ox + Math.cos(a) * r, oy + Math.sin(a) * r);
  }
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, W, H);
  return c;
}

/** Give art a white die-cut border, a faint cut edge and paper grain. Returns front and mirrored back. */
export function dieCut(art: HTMLCanvasElement, border = 7) {
  const pad = border + 4;
  const W = art.width + pad * 2, H = art.height + pad * 2;
  const edge = dilate(art, W, H, pad, pad, border + 1.6, 'rgba(110,90,70,0.6)');
  const sil = dilate(art, W, H, pad, pad, border, '#fbf7ee');

  const front = makeCanvas(W, H);
  const fg = ctx2d(front);
  fg.drawImage(edge, 0, 0);
  fg.drawImage(sil, 0, 0);
  fg.drawImage(art, pad, pad);
  multiplyGrain(front);

  const back = makeCanvas(W, H);
  const bg = ctx2d(back);
  bg.translate(W, 0);
  bg.scale(-1, 1);
  bg.drawImage(edge, 0, 0);
  bg.drawImage(sil, 0, 0);
  bg.setTransform(1, 0, 0, 1, 0, 0);
  multiplyGrain(back);
  return { front, back };
}

/**
 * A stand-up paper cutout: front art + plain paper back, pivot at the base centre.
 * Returns a group whose userData.front is the front mesh.
 */
export function makeCutout(art: HTMLCanvasElement, height: number, border = 7) {
  const { front, back } = dieCut(art, border);
  const h = height, w = (h * front.width) / front.height;
  const geo = new THREE.PlaneGeometry(w, h);
  geo.translate(0, h / 2, 0);
  const mf = new THREE.MeshStandardMaterial({
    map: canvasTex(front),
    alphaTest: 0.5,
    roughness: 0.9,
    bumpMap: paperTex(),
    bumpScale: 0.5,
  });
  const mb = new THREE.MeshStandardMaterial({ map: canvasTex(back), alphaTest: 0.5, roughness: 0.95 });
  const fm = new THREE.Mesh(geo, mf);
  const bm = new THREE.Mesh(geo, mb);
  bm.rotation.y = Math.PI;
  bm.position.z = -0.006;
  for (const m of [fm, bm]) {
    m.castShadow = true;
    m.receiveShadow = true;
  }
  const g = new THREE.Group();
  g.add(fm, bm);
  g.userData.front = fm;
  g.userData.w = w;
  g.userData.h = h;
  return g;
}

/** Wraps a cutout in a pivot so the pivot can fold while the inner part idles. */
export function standee(cut: THREE.Group) {
  const pivot = new THREE.Group();
  pivot.add(cut);
  pivot.userData.inner = cut;
  return pivot;
}
