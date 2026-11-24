// All character, prop and scenery art, drawn as layered cut paper in canvas.
// These are stand-ins for painted or generated textures: each returns a canvas.
import { makeCanvas, ctx2d, mulberry } from './paper';
import { tr } from './i18n';

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/** Each paper layer casts a small shadow on the one beneath it. */
function layer(g: G, fn: () => void, depth = 1) {
  g.save();
  g.shadowColor = 'rgba(45,28,12,0.34)';
  g.shadowBlur = 3.5 * depth;
  g.shadowOffsetX = 1.2 * depth;
  g.shadowOffsetY = 2.2 * depth;
  fn();
  g.restore();
}
function ell(g: G, x: number, y: number, rx: number, ry: number, rot: number, fill: string) {
  g.fillStyle = fill;
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, TAU);
  g.fill();
}
const circ = (g: G, x: number, y: number, r: number, fill: string) => ell(g, x, y, r, r, 0, fill);
function poly(g: G, pts: number[], fill: string) {
  g.fillStyle = fill;
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  g.fill();
}
function fold(g: G, x1: number, y1: number, x2: number, y2: number, a = 0.18) {
  g.strokeStyle = `rgba(90,70,50,${a})`;
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}

export interface PenguinOpts {
  scarf: string;
  bow?: string;
  beanie?: string;
  tuft?: boolean;
  sad?: boolean;
}

export function penguin(o: PenguinOpts) {
  const c = makeCanvas(240, 310);
  const g = ctx2d(c);
  const navy = '#24344a', cream = '#fbf5e6', orange = '#f0962c';
  layer(g, () => {
    ell(g, 92, 290, 27, 12, 0, orange);
    ell(g, 148, 290, 27, 12, 0, orange);
  });
  layer(g, () => {
    ell(g, 47, 190, 20, 60, 0.38, '#1c2a3b');
    ell(g, 193, 190, 20, 60, -0.38, '#1c2a3b');
  });
  layer(g, () => ell(g, 120, 178, 80, 108, 0, navy), 1.5);
  if (o.tuft) {
    layer(g, () => poly(g, [112, 76, 106, 52, 120, 68, 128, 46, 132, 74], navy));
  }
  layer(g, () => ell(g, 120, 206, 56, 78, 0, cream));
  layer(g, () => {
    g.fillStyle = cream;
    g.beginPath();
    g.arc(99, 116, 31, 0, TAU);
    g.moveTo(172, 116);
    g.arc(141, 116, 31, 0, TAU);
    g.fill();
  });
  circ(g, 84, 132, 9, 'rgba(240,130,130,0.55)');
  circ(g, 156, 132, 9, 'rgba(240,130,130,0.55)');
  for (const ex of [101, 139]) {
    circ(g, ex, 112, 8, '#141a22');
    circ(g, ex + 2.5, 109, 2.8, '#ffffff');
  }
  if (o.sad) {
    g.strokeStyle = '#141a22';
    g.lineWidth = 3.5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(88, 96); g.lineTo(108, 100);
    g.moveTo(152, 96); g.lineTo(132, 100);
    g.stroke();
  }
  layer(g, () => poly(g, [107, 124, 133, 124, 120, 142], orange));
  layer(g, () => {
    g.fillStyle = o.scarf;
    g.beginPath();
    g.roundRect(54, 148, 132, 22, 11);
    g.fill();
    poly(g, [146, 160, 170, 162, 176, 214, 156, 216], o.scarf);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 4; i++) g.fillRect(70 + i * 30, 150, 10, 18);
  });
  if (o.bow) {
    layer(g, () => {
      poly(g, [150, 74, 182, 58, 178, 92], o.bow!);
      poly(g, [150, 74, 128, 52, 132, 88], o.bow!);
      circ(g, 152, 74, 8, o.bow!);
    });
  }
  if (o.beanie) {
    layer(g, () => {
      g.fillStyle = o.beanie!;
      g.beginPath();
      g.ellipse(120, 84, 58, 36, 0, Math.PI, TAU);
      g.fill();
      g.fillStyle = '#f4ead4';
      g.beginPath();
      g.roundRect(60, 78, 120, 16, 8);
      g.fill();
      circ(g, 120, 44, 14, '#f4ead4');
    });
  }
  return c;
}

/** The hero: a small explorer in a red parka. */
export function hero() {
  const c = makeCanvas(220, 300);
  const g = ctx2d(c);
  const parka = '#d24d2b', fur = '#f2e4c6', skin = '#f1c49c';
  layer(g, () => {
    ell(g, 86, 286, 25, 12, 0, '#4a2e1f');
    ell(g, 134, 286, 25, 12, 0, '#4a2e1f');
  });
  layer(g, () => {
    g.fillStyle = '#2d3a55';
    g.fillRect(74, 236, 22, 50);
    g.fillRect(124, 236, 22, 50);
  });
  layer(g, () => {
    poly(g, [40, 180, 30, 222, 58, 224, 66, 176], parka);
    poly(g, [180, 180, 190, 222, 162, 224, 154, 176], parka);
    circ(g, 42, 226, 14, '#6b3b23');
    circ(g, 178, 226, 14, '#6b3b23');
  });
  layer(g, () => {
    g.fillStyle = parka;
    g.beginPath();
    g.moveTo(68, 140);
    g.lineTo(152, 140);
    g.quadraticCurveTo(176, 200, 180, 250);
    g.lineTo(40, 250);
    g.quadraticCurveTo(44, 200, 68, 140);
    g.fill();
  }, 1.4);
  layer(g, () => {
    g.fillStyle = fur;
    g.fillRect(40, 238, 140, 14);
  });
  fold(g, 110, 150, 110, 238, 0.3);
  for (let i = 0; i < 3; i++) {
    g.fillStyle = '#f2e4c6';
    g.fillRect(114, 166 + i * 22, 12, 6);
  }
  layer(g, () => circ(g, 110, 100, 62, parka), 1.4);
  layer(g, () => {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      circ(g, 110 + Math.cos(a) * 44, 102 + Math.sin(a) * 44, 11, fur);
    }
    circ(g, 110, 102, 44, fur);
  });
  layer(g, () => circ(g, 110, 104, 35, skin));
  circ(g, 97, 100, 4.5, '#2a1d15');
  circ(g, 123, 100, 4.5, '#2a1d15');
  circ(g, 90, 114, 7, 'rgba(230,110,100,0.45)');
  circ(g, 130, 114, 7, 'rgba(230,110,100,0.45)');
  g.strokeStyle = '#2a1d15';
  g.lineWidth = 2.5;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(110, 110, 9, 0.2 * Math.PI, 0.8 * Math.PI);
  g.stroke();
  return c;
}

/** Grimfin: an orca in a pirate's tricorn, facing right. */
export function orca() {
  const c = makeCanvas(580, 320);
  const g = ctx2d(c);
  const black = '#161a22';
  layer(g, () => {
    g.fillStyle = black;
    g.beginPath();
    g.moveTo(118, 172);
    g.quadraticCurveTo(80, 120, 26, 92);
    g.quadraticCurveTo(70, 140, 96, 170);
    g.quadraticCurveTo(66, 210, 30, 250);
    g.quadraticCurveTo(84, 226, 124, 182);
    g.fill();
  });
  layer(g, () => {
    g.fillStyle = black;
    g.beginPath();
    g.moveTo(262, 104);
    g.quadraticCurveTo(286, 60, 318, 22);
    g.quadraticCurveTo(326, 70, 352, 98);
    g.fill();
  });
  layer(g, () => {
    g.fillStyle = black;
    g.beginPath();
    g.moveTo(104, 172);
    g.bezierCurveTo(170, 116, 310, 92, 430, 112);
    g.bezierCurveTo(510, 126, 556, 168, 546, 198);
    g.bezierCurveTo(532, 236, 440, 256, 340, 254);
    g.bezierCurveTo(232, 252, 150, 216, 104, 172);
    g.fill();
  }, 1.6);
  ell(g, 330, 118, 44, 10, -0.05, 'rgba(120,128,140,0.6)');
  layer(g, () => {
    g.fillStyle = '#f3efe4';
    g.beginPath();
    g.moveTo(236, 244);
    g.bezierCurveTo(330, 212, 450, 206, 534, 210);
    g.bezierCurveTo(516, 238, 430, 258, 336, 254);
    g.closePath();
    g.fill();
  });
  layer(g, () => ell(g, 422, 150, 34, 14, -0.25, '#f3efe4'));
  layer(g, () => ell(g, 330, 232, 46, 16, 0.6, black));
  // teeth and grin
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 6; i++) poly(g, [478 + i * 9, 202, 486 + i * 9, 202, 482 + i * 9, 212], '#ffffff');
  g.strokeStyle = '#000';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(470, 201);
  g.quadraticCurveTo(510, 206, 540, 196);
  g.stroke();
  // eye, angry brow
  circ(g, 466, 170, 9, '#ffffff');
  circ(g, 468, 171, 5, '#c42b2e');
  g.strokeStyle = '#ffffff';
  g.lineWidth = 5;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(448, 150);
  g.lineTo(482, 160);
  g.stroke();
  // tricorn hat
  layer(g, () => {
    g.fillStyle = '#20202a';
    g.beginPath();
    g.moveTo(398, 126);
    g.quadraticCurveTo(410, 64, 452, 58);
    g.quadraticCurveTo(494, 64, 510, 132);
    g.quadraticCurveTo(454, 108, 398, 126);
    g.fill();
    g.strokeStyle = '#d9a441';
    g.lineWidth = 4;
    g.stroke();
    circ(g, 454, 94, 10, '#f3efe4');
    g.strokeStyle = '#f3efe4';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(440, 108); g.lineTo(468, 116);
    g.moveTo(468, 106); g.lineTo(440, 116);
    g.stroke();
  }, 1.3);
  return c;
}

export function lantern() {
  const c = makeCanvas(140, 210);
  const g = ctx2d(c);
  g.strokeStyle = '#3b2a1e';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(70, 40, 20, Math.PI, TAU);
  g.stroke();
  layer(g, () => {
    g.fillStyle = '#3b2a1e';
    g.fillRect(44, 40, 52, 14);
    g.fillRect(48, 166, 44, 12);
  });
  layer(g, () => ell(g, 70, 110, 52, 60, 0, '#e2562f'), 1.4);
  const grd = g.createRadialGradient(70, 112, 4, 70, 112, 50);
  grd.addColorStop(0, 'rgba(255,240,170,1)');
  grd.addColorStop(0.5, 'rgba(255,190,90,0.75)');
  grd.addColorStop(1, 'rgba(255,150,60,0)');
  g.fillStyle = grd;
  g.beginPath();
  g.ellipse(70, 110, 50, 58, 0, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(120,40,20,0.45)';
  g.lineWidth = 2;
  for (const k of [-0.6, -0.25, 0.25, 0.6]) {
    g.beginPath();
    g.ellipse(70, 110, Math.abs(k) * 52, 60, 0, k < 0 ? Math.PI / 2 : -Math.PI / 2, k < 0 ? Math.PI * 1.5 : Math.PI / 2);
    g.stroke();
  }
  poly(g, [64, 178, 76, 178, 74, 204, 66, 204], '#c9a23f');
  return c;
}

export function boat() {
  const c = makeCanvas(270, 180);
  const g = ctx2d(c);
  layer(g, () => {
    poly(g, [134, 8, 70, 104, 198, 104], '#efe6d1');
    poly(g, [134, 8, 134, 104, 198, 104], '#e0d4bb');
  });
  layer(g, () => {
    poly(g, [14, 100, 256, 100, 212, 164, 58, 164], '#f7f0e0');
    poly(g, [135, 100, 256, 100, 212, 164, 135, 164], '#e8dec8');
  }, 1.4);
  g.fillStyle = '#c8413b';
  poly(g, [34, 116, 244, 116, 238, 126, 40, 126], '#c8413b');
  fold(g, 135, 100, 135, 164, 0.3);
  fold(g, 134, 8, 134, 104, 0.25);
  return c;
}

export function bucket() {
  const c = makeCanvas(190, 200);
  const g = ctx2d(c);
  layer(g, () => {
    poly(g, [60, 74, 46, 22, 78, 34, 82, 70], '#7d93a8');
    poly(g, [104, 70, 98, 12, 128, 30, 120, 72], '#94a9bc');
    poly(g, [128, 76, 150, 30, 160, 58, 140, 82], '#7d93a8');
  });
  g.strokeStyle = '#5a4a3a';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(95, 84, 62, Math.PI * 1.05, Math.PI * 1.95);
  g.stroke();
  layer(g, () => {
    poly(g, [28, 80, 162, 80, 146, 190, 44, 190], '#3f7db3');
    g.fillStyle = '#6fa3d1';
    g.fillRect(24, 74, 142, 14);
    g.fillStyle = 'rgba(255,255,255,0.3)';
    g.fillRect(36, 130, 120, 10);
  }, 1.4);
  return c;
}

export function fish() {
  const c = makeCanvas(150, 80);
  const g = ctx2d(c);
  layer(g, () => {
    poly(g, [18, 18, 44, 40, 18, 62], '#7d93a8');
    ell(g, 86, 40, 52, 24, 0, '#94a9bc');
  });
  circ(g, 118, 34, 5, '#1b222c');
  return c;
}

export function rock(seed: number) {
  const r = mulberry(seed);
  const c = makeCanvas(210, 170);
  const g = ctx2d(c);
  const pts: number[] = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (i / n) * Math.PI;
    const rad = 80 + r() * 22;
    pts.push(105 + Math.cos(a) * rad * 1.1, 165 + Math.sin(a) * rad * (0.95 + r() * 0.3));
  }
  layer(g, () => poly(g, pts, '#878a92'), 1.4);
  for (let i = 0; i < 4; i++) {
    const x = 30 + r() * 140, y = 70 + r() * 70;
    poly(g, [x, y, x + 30 + r() * 20, y + 10, x + 10, y + 40], i % 2 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)');
  }
  layer(g, () => {
    const top = pts.slice(6, 14);
    poly(g, [...top, top[top.length - 2], top[top.length - 1] + 16, top[0], top[1] + 20], '#f5f7fa');
  });
  return c;
}

export function iceberg(seed: number) {
  const r = mulberry(seed);
  const c = makeCanvas(230, 280);
  const g = ctx2d(c);
  const pts = [10, 275];
  const peaks = 4;
  for (let i = 1; i < peaks * 2; i++) {
    const x = 10 + (i / (peaks * 2)) * 210;
    const y = i % 2 ? 30 + r() * 90 : 120 + r() * 60;
    pts.push(x, y);
  }
  pts.push(220, 275);
  layer(g, () => poly(g, pts, '#e7f2fb'), 1.5);
  for (let i = 2; i < pts.length - 2; i += 2) {
    if ((i / 2) % 2 === 1) poly(g, [pts[i], pts[i + 1], pts[i + 2], pts[i + 3], pts[i] + 10, 275], 'rgba(120,170,215,0.32)');
  }
  return c;
}

export function igloo() {
  const c = makeCanvas(280, 180);
  const g = ctx2d(c);
  layer(g, () => {
    g.fillStyle = '#f4f8fb';
    g.beginPath();
    g.ellipse(140, 176, 128, 160, 0, Math.PI, TAU);
    g.fill();
  }, 1.5);
  g.strokeStyle = 'rgba(110,150,190,0.45)';
  g.lineWidth = 2;
  for (const y of [146, 112, 78, 46]) {
    const w = 128 * Math.sqrt(1 - Math.pow((176 - y) / 160, 2));
    g.beginPath();
    g.moveTo(140 - w, y);
    g.lineTo(140 + w, y);
    g.stroke();
    for (let x = 140 - w + 28; x < 140 + w; x += 40) {
      g.beginPath();
      g.moveTo(x + ((y / 34) % 2) * 20, y);
      g.lineTo(x + ((y / 34) % 2) * 20, y + 32);
      g.stroke();
    }
  }
  layer(g, () => {
    g.fillStyle = '#2d4f7a';
    g.beginPath();
    g.ellipse(176, 178, 34, 52, 0, Math.PI, TAU);
    g.fill();
  });
  return c;
}

export function cage() {
  const c = makeCanvas(220, 250);
  const g = ctx2d(c);
  const wood = '#7a5232';
  layer(g, () => {
    g.fillStyle = wood;
    g.fillRect(8, 20, 204, 18);
    g.fillRect(8, 222, 204, 22);
    for (let i = 0; i < 6; i++) g.fillRect(14 + i * 38, 30, 10, 196);
  }, 1.3);
  layer(g, () => {
    circ(g, 30, 140, 12, '#d8b56b');
    g.strokeStyle = '#d8b56b';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(24, 150); g.lineTo(14, 176);
    g.moveTo(36, 150); g.lineTo(42, 178);
    g.stroke();
  });
  return c;
}

export function post() {
  const c = makeCanvas(60, 190);
  const g = ctx2d(c);
  layer(g, () => {
    g.fillStyle = '#7a5232';
    g.fillRect(16, 10, 28, 178);
    g.fillStyle = '#d8b56b';
    g.fillRect(12, 40, 36, 8);
    g.fillRect(12, 56, 36, 8);
  });
  return c;
}

export function sun() {
  const c = makeCanvas(240, 240);
  const g = ctx2d(c);
  layer(g, () => {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      poly(g, [120 + Math.cos(a - 0.14) * 70, 120 + Math.sin(a - 0.14) * 70, 120 + Math.cos(a) * 112, 120 + Math.sin(a) * 112, 120 + Math.cos(a + 0.14) * 70, 120 + Math.sin(a + 0.14) * 70], '#f2b441');
    }
  });
  layer(g, () => circ(g, 120, 120, 72, '#f7cf5c'), 1.4);
  circ(g, 98, 112, 6, '#7a4a1e');
  circ(g, 142, 112, 6, '#7a4a1e');
  g.strokeStyle = '#7a4a1e';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(120, 128, 20, 0.15 * Math.PI, 0.85 * Math.PI);
  g.stroke();
  return c;
}

export function moon() {
  const c = makeCanvas(220, 220);
  const g = ctx2d(c);
  const tmp = makeCanvas(220, 220);
  const t = ctx2d(tmp);
  circ(t, 110, 110, 90, '#f6e7b0');
  t.globalCompositeOperation = 'destination-out';
  circ(t, 160, 84, 80, '#000');
  layer(g, () => g.drawImage(tmp, 0, 0), 1.4);
  circ(g, 60, 120, 5, '#8a7440');
  return c;
}

export function star() {
  const c = makeCanvas(70, 70);
  const g = ctx2d(c);
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * TAU, r = i % 2 ? 13 : 32;
    pts.push(35 + Math.cos(a) * r, 35 + Math.sin(a) * r);
  }
  layer(g, () => poly(g, pts, '#f6e39a'));
  return c;
}

export function cloud() {
  const c = makeCanvas(280, 130);
  const g = ctx2d(c);
  layer(g, () => {
    g.fillStyle = '#ffffff';
    g.beginPath();
    for (const [x, y, r] of [[70, 82, 44], [128, 62, 56], [190, 78, 46], [232, 96, 30], [36, 102, 26]]) {
      g.moveTo(x + r, y);
      g.arc(x, y, r, 0, TAU);
    }
    g.rect(36, 90, 200, 36);
    g.fill();
  }, 1.4);
  return c;
}

function ridge(w: number, h: number, seed: number, peaks: number, fill: string, cap: string | null, minY: number) {
  const r = mulberry(seed);
  const c = makeCanvas(w, h);
  const g = ctx2d(c);
  const pts = [0, h];
  const tops: [number, number][] = [];
  for (let i = 0; i <= peaks * 2; i++) {
    const x = (i / (peaks * 2)) * w;
    const y = i % 2 ? minY + r() * (h * 0.35) : h * 0.55 + r() * h * 0.25;
    pts.push(x, y);
    if (i % 2) tops.push([x, y]);
  }
  pts.push(w, h);
  layer(g, () => poly(g, pts, fill), 2);
  if (cap) {
    for (let i = 2; i < pts.length - 2; i += 4) {
      const [x0, y0, x1, y1, x2, y2] = [pts[i], pts[i + 1], pts[i + 2], pts[i + 3], pts[i + 4], pts[i + 5]];
      if (x2 === undefined) break;
      const k = 0.3;
      poly(g, [x1, y1, x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, x1 + (x2 - x1) * k * 0.5, y1 + (y2 - y1) * k + 10, x1, y1 + 22, x1 + (x0 - x1) * k * 0.5, y1 + (y0 - y1) * k + 8, x1 + (x0 - x1) * k, y1 + (y0 - y1) * k], cap);
    }
  }
  return c;
}

export const mountainsBack = () => ridge(1300, 340, 5, 6, '#a9bcd3', '#eef3f9', 20);
export const mountainsFront = () => ridge(1300, 260, 9, 8, '#d7e3ef', '#ffffff', 40);
export const cliff = () => ridge(800, 420, 3, 4, '#5b74a0', '#9fb4d6', 20);

export function wave(night: boolean) {
  const c = makeCanvas(260, 70);
  const g = ctx2d(c);
  layer(g, () => {
    g.fillStyle = night ? '#3b679b' : '#87bde4';
    g.beginPath();
    g.moveTo(0, 70);
    g.lineTo(0, 40);
    for (let x = 0; x <= 260; x += 65) {
      g.quadraticCurveTo(x + 16, 4, x + 32, 30);
      g.quadraticCurveTo(x + 48, 52, x + 65, 34);
    }
    g.lineTo(260, 70);
    g.fill();
  });
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = 3;
  g.beginPath();
  for (let x = 0; x < 260; x += 65) {
    g.moveTo(x + 10, 30);
    g.quadraticCurveTo(x + 18, 14, x + 30, 24);
  }
  g.stroke();
  return c;
}

export function flag() {
  const c = makeCanvas(80, 150);
  const g = ctx2d(c);
  layer(g, () => {
    g.fillStyle = '#6b4a2e';
    g.fillRect(12, 10, 7, 138);
    poly(g, [19, 12, 74, 32, 19, 54], '#d9443a');
  });
  const f = fish();
  g.drawImage(f, 22, 22, 40, 20);
  return c;
}

/** Plain dark silhouette (for the lantern shadow play). No die-cut border. */
export function silhouette(src: HTMLCanvasElement) {
  const c = makeCanvas(src.width, src.height);
  const g = ctx2d(c);
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#05070d';
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

export function planks() {
  const c = makeCanvas(256, 256);
  const g = ctx2d(c);
  g.fillStyle = '#b07d45';
  g.fillRect(0, 0, 256, 256);
  const r = mulberry(4);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = `rgba(${90 + r() * 40},${55 + r() * 20},25,0.35)`;
    g.fillRect(0, i * 64 + 2, 256, 60);
    g.fillStyle = 'rgba(60,35,15,0.6)';
    g.fillRect(0, i * 64, 256, 3);
    for (let k = 0; k < 6; k++) {
      g.fillStyle = 'rgba(70,40,15,0.25)';
      g.fillRect(r() * 256, i * 64 + 6 + r() * 50, 40 + r() * 80, 1.5);
    }
    circ(g, 20, i * 64 + 32, 3, 'rgba(50,30,10,0.6)');
    circ(g, 236, i * 64 + 32, 3, 'rgba(50,30,10,0.6)');
  }
  return c;
}

/** Auntie Puffin, a knitter. */
export function puffin() {
  const c = makeCanvas(230, 300);
  const g = ctx2d(c);
  layer(g, () => {
    ell(g, 90, 288, 24, 11, 0, '#f07a2a');
    ell(g, 140, 288, 24, 11, 0, '#f07a2a');
  });
  layer(g, () => {
    ell(g, 44, 190, 18, 56, 0.35, '#1d2026');
    ell(g, 186, 190, 18, 56, -0.35, '#1d2026');
  });
  layer(g, () => ell(g, 115, 186, 76, 100, 0, '#22262e'), 1.5);
  layer(g, () => ell(g, 115, 214, 52, 70, 0, '#fbf5e6'));
  layer(g, () => ell(g, 115, 112, 46, 40, 0, '#ece6da'));
  // beak: striped
  layer(g, () => {
    poly(g, [112, 106, 168, 118, 112, 140], '#e8542c');
    poly(g, [112, 106, 128, 109, 128, 137, 112, 140], '#f2c443');
    poly(g, [128, 109, 140, 112, 140, 134, 128, 137], '#3d4652');
  });
  circ(g, 94, 104, 7, '#141a22');
  circ(g, 96, 101, 2.4, '#ffffff');
  g.strokeStyle = '#c0392b';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(84, 96); g.lineTo(90, 92);
  g.stroke();
  circ(g, 82, 124, 8, 'rgba(240,130,130,0.5)');
  // knitting needles and a half-made scarf
  layer(g, () => {
    g.strokeStyle = '#b08850';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(70, 186); g.lineTo(160, 156);
    g.moveTo(74, 160); g.lineTo(162, 188);
    g.stroke();
    poly(g, [96, 172, 136, 172, 132, 236, 100, 236], '#e2b13c');
    g.fillStyle = 'rgba(255,255,255,0.3)';
    for (let y = 182; y < 232; y += 12) g.fillRect(100, y, 32, 4);
  });
  return c;
}

export function yarn() {
  const c = makeCanvas(150, 150);
  const g = ctx2d(c);
  layer(g, () => circ(g, 75, 78, 58, '#c8413b'), 1.4);
  g.strokeStyle = 'rgba(255,220,210,0.55)';
  g.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.ellipse(75, 78, 56, 18 + i * 7, -0.6 + i * 0.25, 0, Math.PI * 2);
    g.stroke();
  }
  g.strokeStyle = '#c8413b';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(120, 112);
  g.quadraticCurveTo(140, 140, 112, 146);
  g.stroke();
  return c;
}

/** A snowy paper pine. */
export function pine(seed: number) {
  const r = mulberry(seed);
  const c = makeCanvas(200, 300);
  const g = ctx2d(c);
  layer(g, () => {
    g.fillStyle = '#6b4a2e';
    g.fillRect(90, 240, 20, 56);
  });
  const greens = ['#2f5d4e', '#356a58', '#2a5446'];
  for (let i = 0; i < 4; i++) {
    const y = 30 + i * 55, w = 46 + i * 22 + r() * 8;
    layer(g, () => {
      poly(g, [100, y - 30, 100 - w, y + 70, 100 + w, y + 70], greens[i % 3]);
      poly(g, [100, y - 30, 100 - w * 0.55, y + 22, 100 - w * 0.2, y + 14, 100, y + 26, 100 + w * 0.3, y + 12, 100 + w * 0.6, y + 24], '#f6f9fb');
    }, 1.3);
  }
  return c;
}

/** Bobble, a seal pup. */
export function seal() {
  const c = makeCanvas(260, 220);
  const g = ctx2d(c);
  const grey = '#9aa7b4';
  layer(g, () => {
    poly(g, [30, 190, 4, 160, 18, 200, 4, 214, 40, 206], '#7f8c99');
    ell(g, 76, 200, 26, 12, -0.3, '#7f8c99');
  });
  layer(g, () => {
    g.fillStyle = grey;
    g.beginPath();
    g.moveTo(30, 196);
    g.bezierCurveTo(60, 130, 120, 90, 170, 80);
    g.bezierCurveTo(230, 70, 252, 120, 236, 156);
    g.bezierCurveTo(220, 196, 150, 210, 30, 206);
    g.fill();
  }, 1.5);
  ell(g, 120, 186, 70, 18, -0.08, 'rgba(255,255,255,0.35)');
  for (let i = 0; i < 8; i++) circ(g, 70 + i * 18, 150 + (i % 3) * 10, 3.5, 'rgba(90,100,110,0.45)');
  circ(g, 186, 112, 10, '#141a22');
  circ(g, 214, 116, 10, '#141a22');
  circ(g, 189, 108, 3.5, '#fff');
  circ(g, 217, 112, 3.5, '#fff');
  ell(g, 206, 134, 9, 6, 0, '#2a2f38');
  g.strokeStyle = 'rgba(40,45,55,0.6)';
  g.lineWidth = 2;
  g.beginPath();
  for (const s of [-1, 1]) {
    g.moveTo(206 + s * 8, 138); g.lineTo(206 + s * 34, 132);
    g.moveTo(206 + s * 8, 142); g.lineTo(206 + s * 32, 146);
  }
  g.stroke();
  circ(g, 176, 134, 8, 'rgba(240,130,130,0.5)');
  return c;
}

export function ball() {
  const c = makeCanvas(140, 140);
  const g = ctx2d(c);
  layer(g, () => circ(g, 70, 72, 56, '#f4f0e4'), 1.4);
  const cols = ['#d9443a', '#f2b441', '#3f7db3'];
  for (let i = 0; i < 3; i++) {
    g.fillStyle = cols[i];
    g.beginPath();
    g.moveTo(70, 72);
    g.arc(70, 72, 56, -Math.PI / 2 + (i * 2 * Math.PI) / 3, -Math.PI / 2 + (i * 2 * Math.PI) / 3 + Math.PI / 3);
    g.fill();
  }
  circ(g, 70, 72, 9, '#f4f0e4');
  return c;
}

/** Wider ridges so the scenery spans the bigger book. */
export const ridgeBack = (seed: number) => ridge(1300, 340, seed, 6, '#a9bcd3', '#eef3f9', 20);
export const ridgeFront = (seed: number) => ridge(1300, 260, seed, 8, '#d7e3ef', '#ffffff', 40);
export const cliffWide = () => ridge(1300, 460, 3, 6, '#5b74a0', '#9fb4d6', 20);

// ------------------------------------------------------------------ extra-cute bits

/** Grimfin with a little brass spyglass held up to his eye. */
export function orcaSpyglass() {
  const c = orca();
  const g = ctx2d(c);
  layer(g, () => {
    g.save();
    g.translate(470, 168);
    g.rotate(-0.12);
    g.fillStyle = '#c99a3c';
    g.beginPath();
    g.roundRect(-6, -13, 74, 26, 6);
    g.fill();
    g.fillStyle = '#e3bb5c';
    g.fillRect(14, -15, 8, 30);
    g.fillRect(44, -16, 8, 32);
    g.fillStyle = '#8fd0ff';
    g.beginPath();
    g.ellipse(68, 0, 6, 13, 0, 0, TAU);
    g.fill();
    g.restore();
  }, 1.3);
  return c;
}

export function heart(color = '#f06a8a') {
  const c = makeCanvas(90, 84);
  const g = ctx2d(c);
  layer(g, () => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(45, 78);
    g.bezierCurveTo(4, 50, 2, 18, 24, 10);
    g.bezierCurveTo(36, 6, 44, 14, 45, 22);
    g.bezierCurveTo(46, 14, 54, 6, 66, 10);
    g.bezierCurveTo(88, 18, 86, 50, 45, 78);
    g.fill();
  });
  circ(g, 30, 26, 6, 'rgba(255,255,255,0.55)');
  return c;
}

function bubble(text: string, color: string) {
  const c = makeCanvas(110, 120);
  const g = ctx2d(c);
  layer(g, () => {
    g.fillStyle = '#fffaf0';
    g.beginPath();
    g.ellipse(55, 50, 46, 44, 0, 0, TAU);
    g.moveTo(40, 86);
    g.lineTo(34, 116);
    g.lineTo(62, 90);
    g.fill();
  }, 1.4);
  g.fillStyle = color;
  g.font = 'bold 72px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 55, 54);
  return c;
}
export const bang = () => bubble('!', '#d9443a');
export const question = () => bubble('?', '#3f6fb0');

/** A striped lighthouse with a face; asleep until you light it. */
export function lighthouse(awake: boolean) {
  const c = makeCanvas(160, 320);
  const g = ctx2d(c);
  layer(g, () => {
    poly(g, [40, 312, 120, 312, 106, 100, 54, 100], '#f4efe4');
    for (const y of [130, 190, 250]) {
      const t = (y - 100) / 212, w0 = 26 + t * 14, t2 = (y + 30 - 100) / 212, w1 = 26 + t2 * 14;
      poly(g, [80 - w0, y, 80 + w0, y, 80 + w1, y + 30, 80 - w1, y + 30], '#d9443a');
    }
  }, 1.5);
  layer(g, () => {
    g.fillStyle = '#3b3a48';
    g.fillRect(46, 88, 68, 14);
    g.fillStyle = awake ? '#ffe58a' : '#8b93a8';
    g.fillRect(56, 50, 48, 40);
    poly(g, [48, 52, 112, 52, 80, 14], '#d9443a');
    circ(g, 80, 12, 6, '#3b3a48');
  });
  if (awake) {
    const grd = g.createRadialGradient(80, 70, 4, 80, 70, 60);
    grd.addColorStop(0, 'rgba(255,240,170,0.9)');
    grd.addColorStop(1, 'rgba(255,220,120,0)');
    g.fillStyle = grd;
    g.fillRect(20, 10, 120, 120);
  }
  // face on the white stripe
  g.strokeStyle = '#2a2433';
  g.fillStyle = '#2a2433';
  g.lineWidth = 3.5;
  g.lineCap = 'round';
  if (awake) {
    circ(g, 68, 172, 5, '#2a2433');
    circ(g, 92, 172, 5, '#2a2433');
    circ(g, 70, 170, 1.8, '#fff');
    circ(g, 94, 170, 1.8, '#fff');
    g.beginPath();
    g.arc(80, 178, 8, 0.15 * Math.PI, 0.85 * Math.PI);
    g.stroke();
  } else {
    g.beginPath();
    g.arc(68, 170, 6, 0.1 * Math.PI, 0.9 * Math.PI);
    g.moveTo(98, 170);
    g.arc(92, 170, 6, 0.1 * Math.PI, 0.9 * Math.PI);
    g.stroke();
    g.font = 'bold 22px Georgia, serif';
    g.fillText('z', 112, 150);
    g.font = 'bold 15px Georgia, serif';
    g.fillText('z', 124, 134);
  }
  circ(g, 60, 182, 6, 'rgba(240,130,130,0.55)');
  circ(g, 100, 182, 6, 'rgba(240,130,130,0.55)');
  return c;
}

/** A drowsy little fog cloud. */
export function fogCloud() {
  const c = cloud();
  const g = ctx2d(c);
  g.strokeStyle = '#6a7390';
  g.lineWidth = 3;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(112, 80, 7, 0.1 * Math.PI, 0.9 * Math.PI);
  g.moveTo(152, 80);
  g.arc(146, 80, 7, 0.1 * Math.PI, 0.9 * Math.PI);
  g.stroke();
  circ(g, 104, 92, 6, 'rgba(240,150,170,0.55)');
  circ(g, 156, 92, 6, 'rgba(240,150,170,0.55)');
  g.beginPath();
  g.arc(130, 96, 4, 0, Math.PI);
  g.stroke();
  return c;
}

/** A floating crate with a fish peeking out. */
export function crate() {
  const c = makeCanvas(170, 160);
  const g = ctx2d(c);
  layer(g, () => {
    poly(g, [104, 40, 140, 14, 150, 30, 118, 52], '#94a9bc');
    circ(g, 132, 26, 4, '#1b222c');
  });
  layer(g, () => {
    g.fillStyle = '#b07d45';
    g.fillRect(16, 44, 138, 104);
    g.fillStyle = 'rgba(70,40,15,0.45)';
    g.fillRect(16, 76, 138, 4);
    g.fillRect(16, 110, 138, 4);
    g.fillStyle = '#8a5d30';
    g.fillRect(16, 44, 14, 104);
    g.fillRect(140, 44, 14, 104);
  }, 1.4);
  g.fillStyle = '#fbf5e6';
  g.font = 'bold 26px Georgia, serif';
  g.textAlign = 'center';
  g.fillText(tr('FISH', 'РЫБА'), 85, 102);
  return c;
}

export function footprint() {
  const c = makeCanvas(64, 64);
  const g = ctx2d(c);
  ell(g, 22, 34, 9, 14, -0.2, 'rgba(90,110,150,0.5)');
  ell(g, 42, 30, 9, 14, 0.2, 'rgba(90,110,150,0.5)');
  return c;
}

export const seaIceberg = (seed: number) => iceberg(seed);
