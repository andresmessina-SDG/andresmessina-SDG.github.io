// The table, the open book, its covers and the page that turns between chapters.
import * as THREE from 'three';
import { makeCanvas, ctx2d, paperCanvas, canvasTex, paperMat, mulberry } from './paper';
import { tween, easeInOut } from './tween';
import * as A from './art';
import { tr } from './i18n';
import { BOOK } from './levels';

export const PAGE_W = 12.35;
export const PAGE_D = 14.6;
const PAGE_H = 0.24;
const COVER_W = 12.65;
const COVER_D = 14.95;
const COVER_T = 0.08;

function woodCanvas() {
  const r = mulberry(21);
  const c = makeCanvas(1024, 1024);
  const g = ctx2d(c);
  g.fillStyle = '#5a3a22';
  g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 260; i++) {
    const y = r() * 1024;
    g.strokeStyle = `rgba(${r() < 0.5 ? '30,16,8' : '140,95,55'},${0.08 + r() * 0.14})`;
    g.lineWidth = 1 + r() * 4;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 1024; x += 64) g.lineTo(x, y + Math.sin(x / 140 + i) * 6 + (r() - 0.5) * 3);
    g.stroke();
  }
  for (let p = 0; p < 4; p++) {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, p * 256, 1024, 3);
  }
  return c;
}

function pageCanvas(side: -1 | 1, folio: number) {
  const W = 760, H = 898;
  const c = makeCanvas(W, H);
  const g = ctx2d(c);
  g.fillStyle = '#efe4cb';
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'multiply';
  g.drawImage(paperCanvas(512, 31 + folio, 250), 0, 0, W, W);
  g.drawImage(paperCanvas(512, 41 + folio, 250), 0, H - W, W, W);
  g.globalCompositeOperation = 'source-over';
  // gutter shadow toward the spine
  const gx = side < 0 ? W : 0;
  const grd = g.createLinearGradient(gx, 0, gx + side * 90, 0);
  grd.addColorStop(0, 'rgba(90,60,30,0.35)');
  grd.addColorStop(1, 'rgba(90,60,30,0)');
  g.fillStyle = grd;
  g.fillRect(side < 0 ? W - 90 : 0, 0, 90, H);
  // printed frame and folio
  g.strokeStyle = 'rgba(120,70,40,0.45)';
  g.lineWidth = 2;
  g.strokeRect(14, 14, W - 28, H - 28);
  g.fillStyle = 'rgba(120,70,40,0.6)';
  g.font = 'italic 18px Georgia, serif';
  g.textAlign = side < 0 ? 'left' : 'right';
  g.fillText(String(folio), side < 0 ? 22 : W - 22, H - 2);
  return c;
}

function edgeCanvas() {
  const c = makeCanvas(64, 64);
  const g = ctx2d(c);
  g.fillStyle = '#efe4cb';
  g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 2) {
    g.fillStyle = `rgba(120,90,60,${0.1 + Math.random() * 0.15})`;
    g.fillRect(0, y, 64, 1);
  }
  return c;
}

function coverCanvas() {
  const W = 1100, H = 1300;
  const c = makeCanvas(W, H);
  const g = ctx2d(c);
  const two = BOOK === 2;
  g.fillStyle = two ? '#2f5a3c' : '#25395a';
  g.fillRect(0, 0, W, H);
  // cloth weave
  for (let y = 0; y < H; y += 3) {
    g.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.03})`;
    g.fillRect(0, y, W, 1);
  }
  for (let x = 0; x < W; x += 3) {
    g.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.04})`;
    g.fillRect(x, 0, 1, H);
  }
  const gold = '#d8b062';
  g.strokeStyle = gold;
  g.lineWidth = 6;
  g.strokeRect(60, 60, W - 120, H - 120);
  g.lineWidth = 2;
  g.strokeRect(84, 84, W - 168, H - 168);
  g.fillStyle = gold;
  g.textAlign = 'center';
  g.font = 'italic 64px Georgia, serif';
  g.fillText(two ? tr('The Penguin Rescue · Book Two', 'Спасение пингвина · Книга вторая') : tr('A pop-up adventure', 'Книжка-раскладушка'), W / 2, 230);
  g.font = 'bold 128px Georgia, serif';
  g.fillText(two ? tr('A Year', 'Год') : tr('The Penguin', 'Спасение'), W / 2, 390);
  g.fillText(two ? tr('on the Page', 'на странице') : tr('Rescue', 'пингвина'), W / 2, 520);
  const p = two ? A.penguin({ scarf: '#e2b13c', beanie: '#3f6fb0' }) : A.penguin({ scarf: '#c8413b', tuft: true });
  g.drawImage(p, W / 2 - 165, 590, 330, 426);
  if (two) {
    const f = A.flower('#e58fb0', 3);
    g.drawImage(f, W / 2 + 150, 880, 100, 157);
    g.drawImage(A.flower('#f2b441', 8), W / 2 - 250, 900, 88, 138);
  }
  g.font = 'italic 44px Georgia, serif';
  g.fillText(two ? tr('in which the seasons turn', 'в которой сменяются времена года') : tr('in which a lantern is raised', 'в которой поднимают фонарик'), W / 2, 1150);
  return c;
}

export class Book {
  root = new THREE.Group();
  left = new THREE.Group();
  private turner = new THREE.Group();
  private turnGeo: THREE.PlaneGeometry;
  private turnBase: Float32Array;
  private coverTex: THREE.Texture;

  /** Redraw the cover lettering after the language changes. */
  refreshCover() {
    this.coverTex.image = coverCanvas();
    this.coverTex.needsUpdate = true;
  }

  constructor(scene: THREE.Scene) {
    scene.add(this.root);

    const woodTex = canvasTex(woodCanvas(), true);
    woodTex.repeat.set(4, 4);
    const table = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 90),
      new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.75, bumpMap: woodTex, bumpScale: 0.6 }),
    );
    table.rotation.x = -Math.PI / 2;
    table.position.y = -PAGE_H - COVER_T - 0.005;
    table.receiveShadow = true;
    this.root.add(table);

    const cloth = paperMat(BOOK === 2 ? '#355f40' : '#2a3f62', 0.8);
    const edge = new THREE.MeshStandardMaterial({ map: canvasTex(edgeCanvas(), true), roughness: 1 });
    const under = paperMat('#efe4cb');
    const pageL = new THREE.MeshStandardMaterial({ map: canvasTex(pageCanvas(-1, 12)), roughness: 0.95 });
    const pageR = new THREE.MeshStandardMaterial({ map: canvasTex(pageCanvas(1, 13)), roughness: 0.95 });
    const coverTex = canvasTex(coverCanvas());
    this.coverTex = coverTex;
    coverTex.center.set(0.5, 0.5);
    coverTex.rotation = Math.PI;
    const coverArt = new THREE.MeshStandardMaterial({ map: coverTex, roughness: 0.8 });

    const mk = (geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], x: number, y: number) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, 0);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };
    const coverGeo = new THREE.BoxGeometry(COVER_W, COVER_T, COVER_D);
    const pagesGeo = new THREE.BoxGeometry(PAGE_W, PAGE_H, PAGE_D);
    const yCover = -PAGE_H - COVER_T / 2;

    this.root.add(mk(coverGeo, cloth, COVER_W / 2, yCover));
    this.root.add(mk(pagesGeo, [edge, edge, pageR, under, edge, edge], PAGE_W / 2 + 0.02, -PAGE_H / 2));
    this.left.add(mk(coverGeo, [cloth, cloth, cloth, coverArt, cloth, cloth], -COVER_W / 2, yCover));
    this.left.add(mk(pagesGeo, [edge, edge, pageL, under, edge, edge], -PAGE_W / 2 - 0.02, -PAGE_H / 2));
    const spine = mk(new THREE.CylinderGeometry(0.2, 0.2, COVER_D, 16, 1, false, Math.PI, Math.PI), cloth, 0, -PAGE_H - 0.02);
    spine.rotation.x = Math.PI / 2;
    this.root.add(spine);
    this.root.add(this.left);

    this.turnGeo = new THREE.PlaneGeometry(PAGE_W, PAGE_D, 24, 1);
    this.turnGeo.translate(PAGE_W / 2, 0, 0);
    this.turnGeo.rotateX(-Math.PI / 2);
    this.turnBase = Float32Array.from(this.turnGeo.attributes.position.array as Float32Array);
    const turnMat = new THREE.MeshStandardMaterial({ map: pageR.map, side: THREE.DoubleSide, roughness: 0.95 });
    const sheet = new THREE.Mesh(this.turnGeo, turnMat);
    sheet.castShadow = true;
    sheet.receiveShadow = true;
    this.turner.add(sheet);
    this.turner.position.y = 0.015;
    this.turner.visible = false;
    this.root.add(this.turner);

    this.setClosed(1);
  }

  setClosed(k: number) {
    this.left.rotation.z = -Math.PI * k;
  }

  open() {
    return tween(1600, (k) => this.setClosed(1 - k), easeInOut);
  }

  close() {
    return tween(1400, (k) => this.setClosed(k), easeInOut);
  }

  private curl(k: number) {
    const pos = this.turnGeo.attributes.position as THREE.BufferAttribute;
    const lift = Math.sin(Math.PI * k);
    for (let i = 0; i < pos.count; i++) {
      const x = this.turnBase[i * 3];
      const u = x / PAGE_W;
      pos.setY(i, this.turnBase[i * 3 + 1] + Math.sin(u * Math.PI * 0.9) * 0.9 * lift * u);
    }
    pos.needsUpdate = true;
    this.turnGeo.computeVertexNormals();
  }

  async turnPage() {
    this.turner.visible = true;
    await tween(1300, (k) => {
      this.turner.rotation.z = Math.PI * k;
      this.curl(k);
    }, easeInOut);
    this.turner.visible = false;
    this.turner.rotation.z = 0;
  }
}
