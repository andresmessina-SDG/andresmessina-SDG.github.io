// Cut-paper terrain: instead of square tiles, each page half gets stacked paper sheets
// (water, a shadowed rim, snow, and raised snowbanks) with hand-cut, wobbly coastlines.
import * as THREE from 'three';
import { makeCanvas, ctx2d, mulberry, paperCanvas } from './paper';

export const LAND_Y = 0.065;
const PX = 80; // texture pixels per cell
const LO = 8; // field pixels per cell

const isLand = (ch: string) => !'~oHD'.includes(ch);
const isBank = (ch: string) => ch === '=';

interface Field {
  w: number;
  h: number;
  d: Float32Array;
}

function blur(f: Field, r: number) {
  const { w, h } = f;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += f.d[y * w + Math.min(w - 1, Math.max(0, x + k))];
      tmp[y * w + x] = s / n;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x];
      out[y * w + x] = s / n;
    }
  }
  f.d = out;
}

function makeField(grid: string[][], test: (ch: string) => boolean): Field {
  const rows = grid.length, cols = grid[0].length;
  const w = cols * LO, h = rows * LO;
  const d = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d[y * w + x] = test(grid[Math.floor(y / LO)][Math.floor(x / LO)]) ? 1 : 0;
  const f = { w, h, d };
  blur(f, 3);
  blur(f, 3);
  return f;
}

function sample(f: Field, u: number, v: number) {
  u = Math.min(f.w - 1.001, Math.max(0, u - 0.5));
  v = Math.min(f.h - 1.001, Math.max(0, v - 0.5));
  const x = Math.floor(u), y = Math.floor(v), fx = u - x, fy = v - y;
  const i = y * f.w + x;
  const a = f.d[i], b = f.d[i + 1], c = f.d[i + f.w], d = f.d[i + f.w + 1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

function valueNoise(seed: number) {
  const r = mulberry(seed);
  const N = 128;
  const lat = new Float32Array(N * N);
  for (let i = 0; i < lat.length; i++) lat[i] = r() * 2 - 1;
  const sm = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = sm(x - xi), fy = sm(y - yi);
    const x0 = ((xi % N) + N) % N, y0 = ((yi % N) + N) % N, x1 = (x0 + 1) % N, y1 = (y0 + 1) % N;
    const a = lat[y0 * N + x0], b = lat[y0 * N + x1], c = lat[y1 * N + x0], d = lat[y1 * N + x1];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  };
}

const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function maskCanvas(W: number, H: number, alpha: Uint8ClampedArray) {
  const c = makeCanvas(W, H);
  const img = ctx2d(c).createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    img.data[i * 4 + 3] = alpha[i];
  }
  ctx2d(c).putImageData(img, 0, 0);
  return c;
}

/** Paint a paper layer: base colour, details, paper grain, then cut to the mask. */
function paperLayer(W: number, H: number, color: string, mask: HTMLCanvasElement, grain: HTMLCanvasElement, details?: (g: CanvasRenderingContext2D) => void) {
  const c = makeCanvas(W, H);
  const g = ctx2d(c);
  g.fillStyle = color;
  g.fillRect(0, 0, W, H);
  details?.(g);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = g.createPattern(grain, 'repeat')!;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(mask, 0, 0);
  g.globalCompositeOperation = 'source-over';
  return c;
}

function tex(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export interface Terrain {
  /** One hinge per page half: index 0 is the left page, 1 the right. Rotate z to fold. */
  halves: THREE.Group[];
}

export function buildTerrain(grid: string[][], night: boolean, seed: number): Terrain {
  const rows = grid.length, cols = grid[0].length;
  const halfCols = cols / 2;
  const W = halfCols * PX, H = rows * PX;
  const land = makeField(grid, isLand);
  const bank = makeField(grid, isBank);
  const n1 = valueNoise(seed), n2 = valueNoise(seed + 7);
  const grain = paperCanvas(256, seed + 3, 250);
  const pal = night
    ? { snow: '#c4d0e6', rim: '#6c80a6', bank: '#d2dcee', deep: '#1d406e', shallow: '#3f6ca4' }
    : { snow: '#f6f8fa', rim: '#b4c3d4', bank: '#ffffff', deep: '#4a8ac2', shallow: '#93c6ea' };
  const deep = hex(pal.deep), shallow = hex(pal.shallow);
  const halves: THREE.Group[] = [];

  for (let h = 0; h < 2; h++) {
    const N = W * H;
    const landA = new Uint8ClampedArray(N), rimA = new Uint8ClampedArray(N);
    const bankA = new Uint8ClampedArray(N), bankRimA = new Uint8ClampedArray(N);
    const waterC = makeCanvas(W, H);
    const wimg = ctx2d(waterC).createImageData(W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const X = x + h * W;
        const u = (X * LO) / PX, v = (y * LO) / PX;
        const nz = n1(X / 40, y / 40) * 0.075 + n2(X / 9, y / 9) * 0.03;
        const f = sample(land, u, v) + nz;
        const i = y * W + x;
        if (f > 0.5) landA[i] = 255;
        if (f > 0.4) rimA[i] = 255;
        const bf = sample(bank, u, v) + nz * 0.8;
        if (bf > 0.5) bankA[i] = 255;
        if (bf > 0.4) bankRimA[i] = 255;
        // water: lighter shallows hugging the coast, a little mottling
        const t = Math.min(1, Math.max(0, (0.42 - f) / 0.32));
        const m = n2(X / 60, y / 60) * 10;
        wimg.data[i * 4] = shallow[0] + (deep[0] - shallow[0]) * t + m;
        wimg.data[i * 4 + 1] = shallow[1] + (deep[1] - shallow[1]) * t + m;
        wimg.data[i * 4 + 2] = shallow[2] + (deep[2] - shallow[2]) * t + m;
        wimg.data[i * 4 + 3] = 255;
      }
    }
    const wg = ctx2d(waterC);
    wg.putImageData(wimg, 0, 0);
    // painted wave strokes
    const r = mulberry(seed * 13 + h);
    wg.lineCap = 'round';
    for (let k = 0; k < 220; k++) {
      const x = r() * W, y = r() * H, len = 14 + r() * 30;
      wg.strokeStyle = `rgba(255,255,255,${0.08 + r() * 0.12})`;
      wg.lineWidth = 1.5 + r() * 1.5;
      wg.beginPath();
      wg.moveTo(x, y);
      wg.quadraticCurveTo(x + len / 2, y - 6, x + len, y);
      wg.stroke();
    }
    wg.globalCompositeOperation = 'multiply';
    wg.fillStyle = wg.createPattern(grain, 'repeat')!;
    wg.fillRect(0, 0, W, H);
    wg.globalCompositeOperation = 'source-over';

    const landMask = maskCanvas(W, H, landA);
    const snowDetails = (g: CanvasRenderingContext2D) => {
      const rr = mulberry(seed * 7 + h);
      // soft drifts and specks
      for (let k = 0; k < 160; k++) {
        const x = rr() * W, y = rr() * H, len = 20 + rr() * 50;
        g.strokeStyle = night ? `rgba(90,110,160,${0.12 + rr() * 0.12})` : `rgba(140,170,205,${0.18 + rr() * 0.16})`;
        g.lineWidth = 2 + rr() * 2;
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + len / 2, y - 10 - rr() * 8, x + len, y);
        g.stroke();
      }
      for (let k = 0; k < 260; k++) {
        g.fillStyle = `rgba(90,95,110,${0.15 + rr() * 0.25})`;
        g.beginPath();
        g.arc(rr() * W, rr() * H, 0.8 + rr() * 1.8, 0, Math.PI * 2);
        g.fill();
      }
      // faint printed corner ticks so the walking grid can be read
      g.strokeStyle = night ? 'rgba(40,55,90,0.16)' : 'rgba(120,110,90,0.16)';
      g.lineWidth = 1.5;
      for (let cy = 1; cy < rows; cy++) {
        for (let cx = 0; cx <= halfCols; cx++) {
          const px = cx * PX, py = cy * PX;
          g.beginPath();
          g.moveTo(px - 5, py); g.lineTo(px + 5, py);
          g.moveTo(px, py - 5); g.lineTo(px, py + 5);
          g.stroke();
        }
      }
    };
    const layers: { canvas: HTMLCanvasElement; y: number; opaque?: boolean }[] = [
      { canvas: waterC, y: 0.012, opaque: true },
      { canvas: paperLayer(W, H, pal.rim, maskCanvas(W, H, rimA), grain), y: 0.04 },
      { canvas: paperLayer(W, H, pal.snow, landMask, grain, snowDetails), y: LAND_Y },
    ];
    if (bankA.some((a) => a)) {
      const bankRim = paperLayer(W, H, pal.rim, maskCanvas(W, H, bankRimA), grain);
      const bankTop = paperLayer(W, H, pal.bank, maskCanvas(W, H, bankA), grain);
      layers.push({ canvas: bankRim, y: 0.14 }, { canvas: bankTop, y: 0.165 }, { canvas: bankRim, y: 0.24 }, { canvas: bankTop, y: 0.265 });
    }

    const side = h === 0 ? -1 : 1;
    const hinge = new THREE.Group();
    const geo = new THREE.PlaneGeometry(halfCols, rows);
    geo.rotateX(-Math.PI / 2);
    for (const L of layers) {
      const m = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          map: tex(L.canvas),
          alphaTest: L.opaque ? 0 : 0.5,
          roughness: 0.92,
        }),
      );
      m.position.set((side * halfCols) / 2, L.y, 0);
      m.receiveShadow = true;
      m.castShadow = !L.opaque;
      hinge.add(m);
    }
    halves.push(hinge);
  }
  return { halves };
}
