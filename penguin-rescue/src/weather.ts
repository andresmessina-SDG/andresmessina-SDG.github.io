// Falling paper snowflakes (or, in spring, raindrops) that drift around wherever the camera is looking.
import * as THREE from 'three';
import { makeCanvas, ctx2d } from './paper';

function flakeTexture() {
  const c = makeCanvas(64, 64);
  const g = ctx2d(c);
  g.fillStyle = '#ffffff';
  g.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, r = i % 2 ? 14 : 30;
    const x = 32 + Math.cos(a) * r, y = 32 + Math.sin(a) * r;
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.closePath();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A raindrop: a thin streak, drawn the same small size near and far so it reads as falling rain. */
function dropTexture() {
  const c = makeCanvas(64, 64);
  const g = ctx2d(c);
  const grd = g.createLinearGradient(0, 4, 0, 60);
  grd.addColorStop(0, 'rgba(255,255,255,0.15)');
  grd.addColorStop(1, 'rgba(255,255,255,1)');
  g.strokeStyle = grd;
  g.lineWidth = 12;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(35, 6);
  g.lineTo(30, 58);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Snow {
  points: THREE.Points;
  private pos: Float32Array;
  private seed: Float32Array;
  private mat: THREE.PointsMaterial;
  private readonly box = new THREE.Vector3(26, 7, 18);
  private flake: THREE.Texture;
  private drop: THREE.Texture | null = null;
  private rain = false;
  private night = 0;

  constructor(scene: THREE.Scene, count = 700) {
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(count * 3);
    this.seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.pos[i * 3] = (Math.random() - 0.5) * this.box.x;
      this.pos[i * 3 + 1] = Math.random() * this.box.y;
      this.pos[i * 3 + 2] = (Math.random() - 0.5) * this.box.z;
      this.seed[i] = Math.random() * 100;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.PointsMaterial({
      size: 0.11,
      map: (this.flake = flakeTexture()),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      alphaTest: 0.2,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  setNight(k: number) {
    this.night = k;
    if (this.rain) this.mat.color.set('#dbeaf8');
    else this.mat.color.setRGB(1 - 0.25 * k, 1 - 0.15 * k, 1);
    this.mat.opacity = 0.9 - 0.35 * k;
  }

  /** Spring rain instead of snow. */
  setRain(on: boolean) {
    this.rain = on;
    this.mat.map = on ? (this.drop ??= dropTexture()) : this.flake;
    // raindrops keep one size on screen (in pixels); snowflakes shrink with distance
    this.mat.sizeAttenuation = !on;
    this.mat.size = on ? 14 : 0.11;
    // a streak fades in from its top, so keep its faint end rather than cutting it off
    this.mat.alphaTest = on ? 0.02 : 0.2;
    this.mat.needsUpdate = true;
    this.setNight(this.night);
  }

  update(dt: number, t: number, center: THREE.Vector3) {
    const { x: bx, y: by, z: bz } = this.box;
    // showers come and go
    if (this.rain) this.mat.opacity = 0.6 * Math.min(1, Math.max(0.15, 0.6 + Math.sin(t * 0.21) * 0.7));
    const fall = this.rain ? 9 : 1;
    for (let i = 0; i < this.seed.length; i++) {
      const s = this.seed[i];
      let x = this.pos[i * 3] + Math.sin(t * 0.7 + s) * 0.12 * dt;
      let y = this.pos[i * 3 + 1] - (0.35 + (s % 1) * 0.3) * dt * fall;
      let z = this.pos[i * 3 + 2] + Math.cos(t * 0.5 + s) * 0.08 * dt;
      if (y < 0) y += by;
      // keep flakes in a box that travels with the camera target
      if (x - center.x > bx / 2) x -= bx;
      if (x - center.x < -bx / 2) x += bx;
      if (z - center.z > bz / 2) z -= bz;
      if (z - center.z < -bz / 2) z += bz;
      this.pos[i * 3] = x;
      this.pos[i * 3 + 1] = y;
      this.pos[i * 3 + 2] = z;
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}
