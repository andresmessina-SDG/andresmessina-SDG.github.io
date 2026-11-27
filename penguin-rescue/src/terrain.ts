// Cut-paper terrain: instead of square tiles, each page half gets stacked paper sheets
// (water, a shadowed rim, snow, and raised snowbanks) with hand-cut, wobbly coastlines.
import * as THREE from 'three';
import { makeCanvas, ctx2d, mulberry, paperCanvas } from './paper';
import type { Season } from './levels';

export const LAND_Y = 0.065;
const PX = 80; // texture pixels per cell
const LO = 8; // field pixels per cell

const isBank = (ch: string) => ch === '=';
/** Slick glacier ice (and things lying on it): you slide across it. */
export const ICE = '_+e';
const isIce = (ch: string) => ICE.includes(ch);

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

export function buildTerrain(grid: string[][], night: boolean, seed: number, water = '~oHDv%', season: Season = 'winter'): Terrain {
  const spring = season === 'spring', summer = season === 'summer';
  const isLand = (ch: string) => !water.includes(ch);
  const rows = grid.length, cols = grid[0].length;
  const halfCols = cols / 2;
  const W = halfCols * PX, H = rows * PX;
  const land = makeField(grid, isLand);
  const bank = makeField(grid, isBank);
  const hasIce = grid.some((r) => r.some(isIce));
  const ice = hasIce ? makeField(grid, isIce) : null;
  const n1 = valueNoise(seed), n2 = valueNoise(seed + 7);
  const grain = paperCanvas(256, seed + 3, 250);
  const pal = night
    ? { snow: '#c4d0e6', rim: '#6c80a6', bank: '#d2dcee', deep: '#1d406e', shallow: '#3f6ca4' }
    : spring
      ? { snow: '#a3c67a', rim: '#8c7754', bank: '#ffffff', deep: '#3f7dab', shallow: '#8dc4d4' }
      : summer
        ? { snow: '#ead39c', rim: '#bf9a5c', bank: '#f3e2b8', deep: '#2f7db5', shallow: '#86d1df' }
        : { snow: '#eef3f8', rim: '#adbdd0', bank: '#ffffff', deep: '#4a8ac2', shallow: '#93c6ea' };
  const deep = hex(pal.deep), shallow = hex(pal.shallow);
  const halves: THREE.Group[] = [];

  for (let h = 0; h < 2; h++) {
    const N = W * H;
    const landA = new Uint8ClampedArray(N), rimA = new Uint8ClampedArray(N);
    // snowbanks are cut as a stack of nested contours, like layered card
    const TIERS = [0.4, 0.55, 0.7, 0.84];
    const tierA = TIERS.map(() => new Uint8ClampedArray(N));
    const iceA = new Uint8ClampedArray(N);
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
        for (let t = 0; t < TIERS.length; t++) if (bf > TIERS[t]) tierA[t][i] = 255;
        if (ice && sample(ice, u, v) + nz * 0.5 > 0.5) iceA[i] = 255;
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
      if (summer) {
        // corrugated card: soft parallel ridges across the sand, with a few grains and specks of shell
        g.lineCap = 'round';
        for (let y = -W; y < H + W; y += 11) {
          g.strokeStyle = `rgba(180,140,80,${0.12 + rr() * 0.06})`;
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(0, y);
          g.lineTo(W, y + W * 0.35);
          g.stroke();
        }
        for (let k = 0; k < 360; k++) {
          g.fillStyle = rr() < 0.5 ? `rgba(150,110,60,${0.15 + rr() * 0.2})` : `rgba(255,250,235,${0.4 + rr() * 0.3})`;
          g.beginPath();
          g.arc(rr() * W, rr() * H, 0.8 + rr() * 1.8, 0, Math.PI * 2);
          g.fill();
        }
      } else if (spring) {
        // green felt coming through. The last snow lingers in the shade behind rocks, trees and drifts:
        // soft white patches with a cool blue edge, so they read as snow under the warm lamp.
        for (let z = 0; z < rows; z++) {
          for (let x = h * halfCols; x < (h + 1) * halfCols; x++) {
            if (!'#Y^I'.includes(grid[z][x]) || rr() < 0.35) continue;
            const cx = (x - h * halfCols + 0.5 + (rr() - 0.5) * 0.4) * PX, cy = (z - 0.15 + (rr() - 0.5) * 0.3) * PX;
            const blob = (grow: number) => {
              g.beginPath();
              for (let j = 0; j < 10; j++) {
                const a = (j / 10) * Math.PI * 2, rad = (0.34 + rr() * 0.12) * PX + grow;
                const px = cx + Math.cos(a) * rad * 1.35, py = cy + Math.sin(a) * rad * 0.8;
                if (j) g.lineTo(px, py);
                else g.moveTo(px, py);
              }
              g.closePath();
              g.fill();
            };
            g.save();
            g.shadowColor = 'rgba(120,150,190,0.55)';
            g.shadowBlur = 14;
            g.fillStyle = 'rgba(214,228,242,0.9)';
            blob(6);
            g.restore();
            g.fillStyle = '#fbfdff';
            blob(0);
          }
        }
        g.lineCap = 'round';
        for (let k = 0; k < 420; k++) {
          const x = rr() * W, y = rr() * H;
          g.strokeStyle = `rgba(${60 + rr() * 30},${110 + rr() * 30},${50 + rr() * 20},${0.35 + rr() * 0.3})`;
          g.lineWidth = 1.5 + rr() * 1.5;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + (rr() - 0.5) * 6, y - 6 - rr() * 6);
          g.stroke();
        }
        for (let k = 0; k < 300; k++) {
          g.fillStyle = `rgba(70,90,50,${0.12 + rr() * 0.2})`;
          g.beginPath();
          g.arc(rr() * W, rr() * H, 0.8 + rr() * 1.6, 0, Math.PI * 2);
          g.fill();
        }
      } else {
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
    const layers: { canvas: HTMLCanvasElement; y: number; opaque?: boolean; rough?: number }[] = [
      { canvas: waterC, y: 0.012, opaque: true },
      { canvas: paperLayer(W, H, pal.rim, maskCanvas(W, H, rimA), grain), y: 0.04 },
      { canvas: paperLayer(W, H, pal.snow, landMask, grain, snowDetails), y: LAND_Y },
    ];
    if (ice) {
      const iceDetails = (g: CanvasRenderingContext2D) => {
        const rr = mulberry(seed * 5 + h);
        // shine streaks and hairline cracks: it looks slippery
        g.lineCap = 'round';
        for (let k = 0; k < 140; k++) {
          const x = rr() * W, y = rr() * H, len = 18 + rr() * 40;
          g.strokeStyle = `rgba(255,255,255,${0.45 + rr() * 0.4})`;
          g.lineWidth = 2 + rr() * 3;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + len, y - len * 0.45);
          g.stroke();
        }
        g.strokeStyle = 'rgba(70,120,170,0.35)';
        g.lineWidth = 1.4;
        for (let k = 0; k < 40; k++) {
          let x = rr() * W, y = rr() * H;
          g.beginPath();
          g.moveTo(x, y);
          for (let j = 0; j < 4; j++) {
            x += (rr() - 0.5) * 40;
            y += (rr() - 0.5) * 40;
            g.lineTo(x, y);
          }
          g.stroke();
        }
      };
      layers.push({ canvas: paperLayer(W, H, night ? '#6f9cd0' : '#8cc2ec', maskCanvas(W, H, iceA), grain, iceDetails), y: LAND_Y + 0.006, rough: 0.32 });
    }
    if (tierA[0].some((a) => a)) {
      const tones = night ? ['#7d90b4', '#9cadcc', '#b7c5de', '#d6e0f0'] : ['#a9bccf', '#c6d4e2', '#e0e8f1', '#ffffff'];
      tierA.forEach((a, t) => layers.push({ canvas: paperLayer(W, H, tones[t], maskCanvas(W, H, a), grain), y: 0.13 + t * 0.11 }));
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
          roughness: L.rough ?? 0.92,
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

/**
 * A hand-cut mask around the cells where `test` is true, `px` pixels per cell, over the whole board:
 * the same blurred-and-wobbled edge as the coastlines. `cut` above 0.5 sits inside the cells' edge.
 */
export function cellMask(cols: number, rows: number, test: (x: number, z: number) => boolean, px: number, seed: number, cut = 0.5) {
  const grid = Array.from({ length: rows }, (_, z) => Array.from({ length: cols }, (_, x) => (test(x, z) ? '1' : '0')));
  const f = makeField(grid, (ch) => ch === '1');
  const n1 = valueNoise(seed), n2 = valueNoise(seed + 7);
  const W = cols * px, H = rows * px;
  const alpha = new Uint8ClampedArray(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = sample(f, (x * LO) / px, (y * LO) / px) + n1(x / (px / 2), y / (px / 2)) * 0.075 + n2(x / (px / 8), y / (px / 8)) * 0.03;
      if (v > cut) alpha[y * W + x] = 255;
    }
  }
  return { W, H, alpha };
}
