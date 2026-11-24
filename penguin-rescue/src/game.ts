// The adventure itself: building each chapter's pop-up board, walking and sailing, quests, Grimfin, and the story.
import * as THREE from 'three';
import { tween, wait, easeOutBack, easeInOut, easeOut, easeIn, linear, type Ease } from './tween';
import * as A from './art';
import { makeCutout, standee, paperMat, tileGeometry, rand, pick, canvasTex, makeCanvas, ctx2d, paperCanvas } from './paper';
import { LEVELS, type LevelDef, type Cell } from './levels';
import { buildTerrain, LAND_Y } from './terrain';
import {
  buildPath, orcaStep, sightCells, farLaneBefore, manhattan, same, SAFE_RADIUS,
  type OrcaPath, type OrcaState, type TurnWorld,
} from './rules';
import type { Sound } from './audio';
import type { UI, Speaker, Line, Quest } from './ui';
import { tr, touch, hops, fishes } from './i18n';

export type { Cell };
export const COLS = LEVELS[0].map[0].length;
export const ROWS = LEVELS[0].map.length;
export const toWorld = (x: number, z: number, y = 0) => new THREE.Vector3(x - (COLS - 1) / 2, y, z - (ROWS - 1) / 2);
const key = (c: Cell) => `${c[0]},${c[1]}`;
const WALK = new Set(['.', 'P', 'S', 'D', 'o', '*', 'b', '%']);
const SAIL = new Set(['~', 'c', '*', 'G', 'P']);
const DIRS: Cell[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const SURFACE = -0.3;
const DEEP = -1.35;
const FISH_TURNS = 6;
const BACK_Z = -ROWS / 2 - 0.2;
const FOG_PX = 40;
// Art used over and over (hearts, speech bubbles) is drawn once.
const artCache = new Map<string, HTMLCanvasElement>();
const cachedArt = (k: string, make: () => HTMLCanvasElement) => artCache.get(k) ?? artCache.set(k, make()).get(k)!;

/** A speaker whose name follows the chosen language. */
const sp = (en: string, ru: string, art: HTMLCanvasElement, voice: number): Speaker => ({
  get name() {
    return tr(en, ru);
  },
  portrait: art.toDataURL(),
  voice,
});

export const STAR_TOTAL = LEVELS.reduce((n, l) => n + (l.map.join('').match(/[*%]/g) ?? []).length, 0);

interface Pop {
  delay: number;
  dur: number;
  ease: Ease;
  set: (k: number) => void;
}

interface Block {
  id: string;
  cell: Cell;
  origin: Cell;
  obj: THREE.Group;
  /** The item this block is meant to reach, so a fresh block appears if it sinks in the wrong place. */
  goal: string;
}

interface Level {
  index: number;
  def: LevelDef;
  root: THREE.Group;
  grid: string[][];
  start: Cell;
  pops: Pop[];
  pick: THREE.Object3D[];
  items: Map<string, { id: string; name: string; obj: THREE.Group }>;
  stars: Map<string, THREE.Group>;
  actors: Map<string, THREE.Group>;
  actorCell: Map<string, Cell>;
  blocks: Map<string, Block>;
  beacons: Map<string, { cell: Cell; pv: THREE.Group; lit: boolean; light: THREE.PointLight }>;
  idlers: { obj: THREE.Object3D; phase: number; kind: 'waddle' | 'bob' | 'wave' | 'float' | 'spin' | 'sway' | 'drift' }[];
  rings: Map<string, THREE.Mesh>;
  ringMat: THREE.MeshBasicMaterial;
  shadows: THREE.Object3D[];
  fog: { ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture } | null;
  bigLight: THREE.PointLight | null;
  /** True once the page has finished unfolding. */
  ready: boolean;
}

export class Game {
  level: Level | null = null;
  player = new THREE.Group();
  private hopper = new THREE.Group();
  private facing = new THREE.Group();
  private boatRig = new THREE.Group();
  private lanternLight = new THREE.PointLight(0xffa955, 0, 0, 1.7);
  private marker: THREE.Mesh;
  private markerMat: THREE.MeshBasicMaterial;
  private gaze: THREE.Mesh[] = [];
  private gazeMat: THREE.MeshBasicMaterial;
  private prints: { mesh: THREE.Mesh; born: number }[] = [];
  private printMat: THREE.MeshBasicMaterial;
  private follower: THREE.Group | null = null;
  pos: Cell = [0, 0];
  inv = new Set<string>();
  fish = 0;
  stars = 0;
  crates = 0;
  gentle = false;
  lanternCovered = false;
  private talked = false;
  private puffinMet = false;
  puffinHelped = false;
  private yarnFound = false;
  private bobbleMet = false;
  bobbleHelped = false;
  private bobbleSplashUsed = false;
  private tuckFree = false;
  private gateOpen = false;
  private checkpoint: Cell | null = null;
  busy = true;
  walking = false;
  private pending: { cell: Cell; act?: string } | null = null;
  private opath: OrcaPath = { cells: [], heads: [], starts: [] };
  private orca: OrcaState = { i: 0, pos: null, head: [1, 0], alert: false, distracted: 0 };
  shake = 0;
  /** 0..1: how far the camera tilts up toward the scenery flats (used in the finale). */
  camLift = 0;
  /** When true the camera pulls back to show the whole spread. */
  camWide = true;
  /** 0..1: morning arriving at the very end. */
  dawn = 0;
  private lanternPower = 1;
  private finish: (() => void) | null = null;
  private ray = new THREE.Raycaster();
  private icons: Record<string, string>;
  private art: Record<string, HTMLCanvasElement>;
  private S: Record<string, Speaker>;
  private chat = 0;
  private now = 0;
  /** Called when the lantern is covered or uncovered, so the HUD button can follow. */
  onLantern: (covered: boolean) => void = () => {};

  constructor(private scene: THREE.Scene, private camera: THREE.Camera, private sound: Sound, private ui: UI) {
    this.art = {
      pip: A.penguin({ scarf: '#c8413b', tuft: true }),
      pebble: A.penguin({ scarf: '#2f8f83', bow: '#e58fb0' }),
      tuck: A.penguin({ scarf: '#e2b13c', beanie: '#3f6fb0' }),
      tuckSad: A.penguin({ scarf: '#e2b13c', beanie: '#3f6fb0', sad: true }),
      puffin: A.puffin(),
      bobble: A.seal(),
      hero: A.hero(),
      orca: A.orcaSpyglass(),
      lighthouse: A.lighthouse(true),
    };
    this.S = {
      nar: { name: '', voice: 520 },
      pip: sp('Pip', 'Пип', this.art.pip, 700),
      pebble: sp('Pebble', 'Галька', this.art.pebble, 860),
      tuck: sp('Tuck', 'Тук', this.art.tuck, 620),
      puffin: sp('Auntie Puffin', 'Тётушка Тупик', this.art.puffin, 560),
      bobble: sp('Bobble', 'Бобл', this.art.bobble, 960),
      grim: sp('Grimfin', 'Гримфин', this.art.orca, 80),
      light: sp('Lighthouse', 'Маяк', this.art.lighthouse, 420),
    };
    this.icons = {
      lantern: A.lantern().toDataURL(),
      boat: A.boat().toDataURL(),
      yarn: A.yarn().toDataURL(),
      ball: A.ball().toDataURL(),
      fish: A.bucket().toDataURL(),
    };
    this.refreshInventory();

    this.facing.add(makeCutout(this.art.hero, 0.95));
    this.hopper.add(this.facing);
    this.player.add(this.hopper);
    this.lanternLight.position.set(0.26, 0.5, 0.2);
    this.facing.add(this.lanternLight);
    // The boat you sail in chapter three, with friends aboard.
    const hull = makeCutout(A.boat(), 0.6, 5);
    hull.position.set(0, -0.02, 0.12);
    const pipRide = makeCutout(this.art.pip, 0.42, 5);
    pipRide.position.set(-0.32, 0.12, 0.04);
    const pebRide = makeCutout(this.art.pebble, 0.4, 5);
    pebRide.position.set(0.34, 0.12, 0.04);
    const tuckRide = makeCutout(this.art.tuck, 0.36, 5);
    tuckRide.position.set(0.14, 0.18, -0.06);
    this.boatRig.add(hull, pipRide, pebRide, tuckRide);
    this.boatRig.visible = false;
    this.player.add(this.boatRig);
    this.player.visible = false;
    scene.add(this.player);

    // A paper-square cursor showing where a click will lead.
    this.markerMat = new THREE.MeshBasicMaterial({ color: 0xfff3d0, transparent: true, opacity: 0.75, depthWrite: false });
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.52, 0.62, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2), this.markerMat);
    this.marker.visible = false;
    this.marker.renderOrder = 6;
    scene.add(this.marker);

    // Grimfin's spyglass view: soft squares of moonlight on the water.
    const gc = makeCanvas(64, 64);
    const gg = ctx2d(gc);
    const grd = gg.createRadialGradient(32, 32, 6, 32, 32, 34);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)');
    grd.addColorStop(1, 'rgba(255,255,255,0.15)');
    gg.fillStyle = grd;
    gg.beginPath();
    gg.roundRect(4, 4, 56, 56, 14);
    gg.fill();
    this.gazeMat = new THREE.MeshBasicMaterial({ map: canvasTex(gc), color: 0xffe58a, transparent: true, opacity: 0.4, depthWrite: false });
    const gGeo = new THREE.PlaneGeometry(0.86, 0.86).rotateX(-Math.PI / 2);
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(gGeo, this.gazeMat);
      m.visible = false;
      m.renderOrder = 5;
      scene.add(m);
      this.gaze.push(m);
    }

    // Little footprints left in the snow.
    this.printMat = new THREE.MeshBasicMaterial({ map: canvasTex(A.footprint()), transparent: true, depthWrite: false });
  }

  /** World-space point the camera and tilt-shift should follow. */
  get focusPoint() {
    return this.player.position;
  }

  get stats() {
    return { stars: this.stars, starTotal: STAR_TOTAL, puffin: this.puffinHelped, bobble: this.bobbleHelped };
  }

  private get sail() {
    return this.level?.def.mode === 'sail';
  }

  private get sightRange() {
    return Math.max(1, (this.lanternCovered ? 2 : 4) - (this.gentle ? 1 : 0));
  }

  toggleLantern() {
    if (!this.inv.has('lantern') || !this.level) return;
    this.lanternCovered = !this.lanternCovered;
    this.sound.rustle(0.4);
    this.ui.toast(this.lanternCovered
      ? tr('Lantern covered: Grimfin can only spot you up close, but glowing stars stay hidden.', 'Фонарик прикрыт: Гримфин заметит тебя только вблизи, но светящиеся звёздочки не видны.')
      : tr('Lantern uncovered: you see more, and so does Grimfin.', 'Фонарик открыт: тебе видно дальше, и Гримфину тоже.'));
    this.onLantern(this.lanternCovered);
    this.updateGaze();
    if (this.sail) this.revealAround(this.pos);
    this.refreshQuests();
  }

  // ---------------------------------------------------------------- cute effects

  /** A little burst of paper hearts. */
  hearts(at: THREE.Vector3, n = 7) {
    const colors = ['#f06a8a', '#f58aa6', '#ff9e7a', '#e2557a'];
    for (let i = 0; i < n; i++) {
      const color = colors[i % colors.length];
      const h = makeCutout(cachedArt('heart' + color, () => A.heart(color)), 0.18 + rand() * 0.1, 3);
      h.position.copy(at).add(new THREE.Vector3((rand() - 0.5) * 0.5, 0.5 + rand() * 0.3, 0.1));
      h.scale.setScalar(0.001);
      this.scene.add(h);
      const x0 = h.position.x, y0 = h.position.y, ph = rand() * 6;
      tween(1500 + rand() * 500, (k) => {
        h.position.y = y0 + k * 1.3;
        h.position.x = x0 + Math.sin(k * 7 + ph) * 0.12;
        h.scale.setScalar(Math.max(0.001, k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85));
      }, linear, i * 70).then(() => this.scene.remove(h));
    }
  }

  private popBubble(art: HTMLCanvasElement, at: THREE.Vector3) {
    const b = makeCutout(art, 0.5, 3);
    b.position.copy(at);
    b.scale.setScalar(0.001);
    this.scene.add(b);
    tween(300, (k) => b.scale.setScalar(Math.max(0.001, k)), easeOutBack)
      .then(() => wait(900))
      .then(() => tween(200, (k) => b.scale.setScalar(Math.max(0.001, 1 - k)), easeIn))
      .then(() => this.scene.remove(b));
  }

  private footprint(c: Cell) {
    const L = this.level!;
    if (L.def.night || L.def.mode !== 'walk' || L.grid[c[1]][c[0]] === 'o') return;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28).rotateX(-Math.PI / 2), this.printMat.clone());
    m.position.copy(toWorld(c[0], c[1], LAND_Y + 0.004));
    m.rotation.y = (rand() - 0.5) * 0.5;
    L.root.add(m);
    this.prints.push({ mesh: m, born: this.now });
    if (this.prints.length > 40) {
      const old = this.prints.shift()!;
      old.mesh.parent?.remove(old.mesh);
    }
  }

  // ---------------------------------------------------------------- building

  private addPop(L: Level, delay: number, dur: number, ease: Ease, set: (k: number) => void) {
    set(0);
    L.pops.push({ delay, dur, ease, set });
  }

  /** Stand-ups fold up from flat on the page about their base. */
  private addUp(L: Level, obj: THREE.Object3D, delay: number) {
    this.addPop(L, delay, 560, easeOutBack, (k) => {
      obj.visible = k > 0.02;
      obj.rotation.x = (-Math.PI / 2) * (1 - k);
    });
  }

  private addScale(L: Level, obj: THREE.Object3D, delay: number) {
    this.addPop(L, delay, 420, easeOutBack, (k) => {
      obj.visible = k > 0.02;
      obj.scale.setScalar(Math.max(0.001, k));
    });
  }

  private stand(L: Level, art: HTMLCanvasElement, h: number, p: THREE.Vector3, delay: number, border = 7) {
    const cut = makeCutout(art, h, border);
    const pv = standee(cut);
    pv.position.copy(p);
    L.root.add(pv);
    this.addUp(L, pv, delay);
    return pv;
  }

  private actor(L: Level, id: string, art: HTMLCanvasElement, h: number, c: Cell, delay: number, idle: 'waddle' | 'bob' | null) {
    const pv = this.stand(L, art, h, toWorld(c[0], c[1], LAND_Y), delay);
    const cut = pv.userData.inner as THREE.Group;
    pv.userData.act = id;
    L.actors.set(id, pv);
    L.actorCell.set(id, c);
    L.pick.push(cut.userData.front);
    if (idle) L.idlers.push({ obj: cut, phase: rand() * 6, kind: idle });
    return pv;
  }

  /** A blocking stand-up (rock, tree, iceberg): clicking it walks you next to it. */
  private obstacle(L: Level, art: HTMLCanvasElement, h: number, c: Cell, delay: number, y = LAND_Y, idle?: 'sway' | 'float') {
    const p = toWorld(c[0], c[1], y).add(new THREE.Vector3((rand() - 0.5) * 0.12, 0, (rand() - 0.5) * 0.12));
    const pv = this.stand(L, art, h, p, delay);
    pv.userData.cell = c;
    L.pick.push((pv.userData.inner as THREE.Group).userData.front);
    if (idle) L.idlers.push({ obj: pv.userData.inner, phase: rand() * 6, kind: idle });
    return pv;
  }

  private tent(L: Level, c: Cell, color: string, delay: number) {
    const w = 0.78, len = 0.6, d = 0.78;
    const theta = Math.acos(w / 2 / len);
    const mat = paperMat(color).clone();
    mat.side = THREE.DoubleSide;
    const mk = (sign: number) => {
      const geo = new THREE.PlaneGeometry(len, d);
      geo.rotateX(-Math.PI / 2);
      geo.translate((sign * len) / 2, 0, 0);
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = m.receiveShadow = true;
      m.position.x = -sign * (w / 2);
      return m;
    };
    const a = mk(1), b = mk(-1);
    const g = new THREE.Group();
    g.add(a, b);
    g.position.copy(toWorld(c[0], c[1], LAND_Y));
    g.userData.cell = c;
    L.root.add(g);
    L.pick.push(a, b);
    this.addPop(L, delay, 600, easeOutBack, (k) => {
      g.visible = k > 0.02;
      a.rotation.z = theta * k;
      b.rotation.z = -theta * k;
    });
  }

  private onStick(L: Level, art: HTMLCanvasElement, h: number, x: number, z: number, height: number, delay: number) {
    const pv = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, height, 6), paperMat('#7a5a3a'));
    stick.position.y = height / 2;
    stick.castShadow = true;
    const cut = makeCutout(art, h, 5);
    cut.position.y = height - h * 0.5;
    pv.add(stick, cut);
    pv.position.set(x, 0, z);
    L.root.add(pv);
    this.addUp(L, pv, delay);
    L.idlers.push({ obj: cut, phase: rand() * 6, kind: 'wave' });
    return pv;
  }

  private makeFloe(L: Level, c: Cell) {
    const night = L.def.night;
    const shape = new THREE.Shape();
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, r = 0.36 + rand() * 0.08;
      if (i) shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    const floe = new THREE.Mesh(geo, paperMat(night ? '#d6e2f2' : '#f4f9fd'));
    floe.castShadow = floe.receiveShadow = true;
    floe.userData.cell = c;
    const fg = new THREE.Group();
    fg.position.copy(toWorld(c[0], c[1], 0.03));
    fg.add(floe);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.33, 28).rotateX(-Math.PI / 2), L.ringMat);
    ring.position.y = 0.095;
    ring.visible = false;
    fg.add(ring);
    L.rings.set(key(c), ring);
    L.root.add(fg);
    L.pick.push(floe);
    L.idlers.push({ obj: floe, phase: rand() * 6, kind: 'float' });
    return fg;
  }

  private makeBlock(L: Level, id: string, c: Cell) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(tileGeometry(0.74, 0.56, 0.74), paperMat('#d4e9f7'));
    m.position.y = 0.28;
    m.rotation.y = (rand() - 0.5) * 0.1;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    g.position.copy(toWorld(c[0], c[1], LAND_Y));
    g.userData.act = id;
    L.root.add(g);
    L.pick.push(m);
    L.actorCell.set(id, c);
    L.grid[c[1]][c[0]] = 'K';
    return g;
  }

  private makeFog(L: Level) {
    const W = COLS * FOG_PX, H = ROWS * FOG_PX;
    const c = makeCanvas(W, H);
    const g = ctx2d(c);
    g.fillStyle = 'rgba(178,190,224,0.96)';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(235,240,255,0.16)';
    g.lineCap = 'round';
    for (let i = 0; i < 90; i++) {
      const x = rand() * W, y = rand() * H, r = 20 + rand() * 50;
      g.lineWidth = 3 + rand() * 4;
      g.beginPath();
      g.arc(x, y, r, rand() * 6, rand() * 6 + 2.5);
      g.stroke();
    }
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = g.createPattern(paperCanvas(256, 77, 248), 'repeat')!;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    const tex = canvasTex(c);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(COLS, ROWS).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    );
    mesh.position.y = 0.55;
    mesh.renderOrder = 4;
    L.root.add(mesh);
    const mat = mesh.material as THREE.MeshBasicMaterial;
    this.addPop(L, 1600, 900, easeInOut, (k) => {
      mat.opacity = k;
      mesh.visible = k > 0.01;
    });
    L.fog = { ctx: g, tex };
    // drowsy fog clouds drifting above it all
    for (let i = 0; i < 5; i++) {
      const cloud = makeCutout(A.fogCloud(), 0.7 + rand() * 0.3, 4);
      cloud.position.set(-10 + i * 5 + rand() * 2, 0.9 + rand() * 0.5, -5 + rand() * 9);
      L.root.add(cloud);
      L.idlers.push({ obj: cloud, phase: rand() * 6, kind: 'drift' });
      this.addScale(L, cloud, 1800 + i * 120);
    }
  }

  /** Clear the vellum fog in a soft circle. */
  private reveal(c: Cell, radius: number) {
    const fog = this.level?.fog;
    if (!fog) return;
    const x = (c[0] + 0.5) * FOG_PX, y = (c[1] + 0.5) * FOG_PX, R = radius * FOG_PX;
    const g = fog.ctx;
    g.globalCompositeOperation = 'destination-out';
    const grd = g.createRadialGradient(x, y, R * 0.45, x, y, R);
    grd.addColorStop(0, 'rgba(0,0,0,1)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(x - R, y - R, R * 2, R * 2);
    g.globalCompositeOperation = 'source-over';
    fog.tex.needsUpdate = true;
  }

  private revealAround(c: Cell) {
    this.reveal(c, this.lanternCovered ? 1.6 : 2.7);
  }

  private build(index: number): Level {
    const def = LEVELS[index];
    const night = def.night;
    const last = index === LEVELS.length - 1;
    const root = new THREE.Group();
    this.scene.add(root);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff5a3c, transparent: true, opacity: 0.8, depthWrite: false });
    const L: Level = {
      index, def, root, grid: def.map.map((r) => r.split('')), start: [1, 1], pops: [], pick: [], items: new Map(),
      stars: new Map(), actors: new Map(), actorCell: new Map(), blocks: new Map(), beacons: new Map(), idlers: [],
      rings: new Map(), ringMat, shadows: [], fog: null, bigLight: null, ready: false,
    };
    // Friends you never helped don't turn up later.
    L.grid.forEach((r) => r.forEach((ch, x) => {
      if (ch === 'Q' && index > 0 && !this.bobbleHelped) r[x] = '.';
      if (ch === 'U' && index > 0 && !this.puffinHelped) r[x] = '.';
    }));

    // The board: two page halves of cut paper that fold out from the spine.
    const terrain = buildTerrain(L.grid, night, index * 101 + 5, def.water);
    terrain.halves.forEach((hinge, h) => {
      const side = h === 0 ? -1 : 1;
      root.add(hinge);
      this.addPop(L, h * 120, 900, easeInOut, (k) => (hinge.rotation.z = side * Math.PI * (1 - k)));
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(COLS, ROWS).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ visible: false }));
    board.position.y = LAND_Y;
    board.userData.board = true;
    root.add(board);
    L.pick.push(board);

    const delayOf = (x: number, z: number) => 850 + Math.abs(x - (COLS - 1) / 2) * 55 + z * 14;
    let blockN = 0;
    for (let z = 0; z < ROWS; z++) {
      for (let x = 0; x < COLS; x++) {
        const ch = L.grid[z][x];
        const c: Cell = [x, z];
        const p = toWorld(x, z);
        const later = delayOf(x, z);
        switch (ch) {
          case '~': {
            const edge = x === 0 || z === 0 || x === COLS - 1 || z === ROWS - 1;
            if (rand() < (edge ? 0.25 : 0.3)) {
              const pv = this.stand(L, A.wave(night), 0.28, p.clone().add(new THREE.Vector3((rand() - 0.5) * 0.3, 0.012, 0.3)), later, 3);
              L.idlers.push({ obj: pv.userData.inner, phase: rand() * 6, kind: 'wave' });
            }
            break;
          }
          case 'o':
            this.addScale(L, this.makeFloe(L, c), later);
            break;
          case '%': {
            this.addScale(L, this.makeFloe(L, c), later);
            const pv = this.stand(L, A.star(), 0.46, p.clone().setY(0.14), later + 60, 4);
            L.stars.set(key(c), pv);
            L.idlers.push({ obj: pv.userData.inner, phase: rand() * 6, kind: 'spin' });
            break;
          }
          case 'v':
            this.obstacle(L, A.seaIceberg(x * 13 + z * 7), 0.95, c, later, 0.02, 'float');
            break;
          case 'H': {
            const id = `hole:${key(c)}`;
            const ice = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.44, 20).rotateX(-Math.PI / 2), paperMat('#e8f1fa'));
            ice.position.copy(p).setY(0.04);
            ice.receiveShadow = true;
            ice.userData.act = id;
            root.add(ice);
            L.pick.push(ice);
            this.addScale(L, ice, later);
            const flag = this.stand(L, A.flag(), 0.5, p.clone().add(new THREE.Vector3(0.3, 0.03, -0.25)), later + 80, 4);
            flag.userData.act = id;
            L.pick.push((flag.userData.inner as THREE.Group).userData.front);
            L.actorCell.set(id, c);
            break;
          }
          case '#':
            this.obstacle(L, night ? A.iceberg(x * 31 + z) : A.rock(x * 17 + z), night ? 1.25 : 0.85, c, later);
            break;
          case 'Y':
            this.obstacle(L, A.pine(x * 7 + z * 3), 1.5 + rand() * 0.3, c, later, LAND_Y, 'sway');
            break;
          case '^':
            this.tent(L, c, night ? '#d3deef' : '#ffffff', later);
            break;
          case 'I':
            this.actor(L, 'igloo', A.igloo(), 0.95, c, later, null);
            break;
          case 'K': {
            const id = `block:${blockN++}`;
            const b = this.makeBlock(L, id, c);
            L.blocks.set(id, { id, cell: c, origin: c, obj: b, goal: '' });
            this.addScale(L, b, later);
            break;
          }
          case 'A':
            this.actor(L, 'pip', this.art.pip, 0.82, c, later, 'waddle');
            break;
          case 'B':
            this.actor(L, 'pebble', this.art.pebble, 0.78, c, later, 'waddle');
            break;
          case 'U':
            this.actor(L, 'puffin', this.art.puffin, 0.78, c, later, 'waddle');
            break;
          case 'Q':
            this.actor(L, 'bobble', this.art.bobble, 0.6, c, later, 'waddle');
            break;
          case 'T': {
            const pv = this.actor(L, 'tuck', this.art.tuckSad, 0.78, c, later, 'waddle');
            const happy = makeCutout(this.art.tuck, 0.78);
            happy.visible = false;
            pv.add(happy);
            pv.userData.faces = [pv.userData.inner, happy];
            L.pick.push(happy.userData.front);
            const cage = this.stand(L, A.cage(), 0.95, toWorld(x, z, LAND_Y).add(new THREE.Vector3(0, 0, 0.24)), later + 120);
            cage.userData.act = 'tuck';
            L.pick.push((cage.userData.inner as THREE.Group).userData.front);
            L.actors.set('cage', cage);
            break;
          }
          case 'L': {
            const id = `beacon:${key(c)}`;
            const pv = this.actor(L, id, A.lighthouse(false), 1.35, c, later, null);
            const awake = makeCutout(A.lighthouse(true), 1.35);
            awake.visible = false;
            pv.add(awake);
            pv.userData.faces = [pv.userData.inner, awake];
            L.pick.push(awake.userData.front);
            const light = new THREE.PointLight(0xffd27a, 0, 0, 1.6);
            light.position.set(0, 1.15, 0.3);
            pv.add(light);
            L.beacons.set(id, { cell: c, pv, lit: false, light });
            break;
          }
          case 'g': {
            const gate = this.obstacle(L, A.cage(), 0.9, c, later, 0.02);
            L.actors.set('gate', gate);
            break;
          }
          case 'G': {
            const deck = new THREE.Mesh(tileGeometry(0.98, 0.06, 0.9), new THREE.MeshStandardMaterial({ map: canvasTex(A.planks()), roughness: 0.85 }));
            deck.position.copy(p).setY(0.03);
            deck.castShadow = deck.receiveShadow = true;
            root.add(deck);
            this.addScale(L, deck, later);
            this.stand(L, A.flag(), 0.7, p.clone().add(new THREE.Vector3(0.36, 0.06, -0.34)), later + 60, 4);
            break;
          }
          case 'E':
            this.actor(L, 'boat', A.boat(), 0.62, c, later, null);
            break;
          case 'S':
          case 'b': {
            const boat = ch === 'S';
            const pv = this.stand(L, boat ? A.boat() : A.ball(), boat ? 0.5 : 0.34, p.clone().setY(LAND_Y), later);
            L.items.set(key(c), boat ? { id: 'boat', name: tr('the paper boat', 'бумажный кораблик'), obj: pv } : { id: 'ball', name: tr("Bobble's ball", 'мячик Бобла'), obj: pv });
            L.idlers.push({ obj: pv.userData.inner, phase: rand() * 6, kind: 'bob' });
            break;
          }
          case 'c': {
            const pv = this.stand(L, A.crate(), 0.42, p.clone().setY(0.02), later, 4);
            L.items.set(key(c), { id: 'crate', name: 'a crate of fish', obj: pv });
            L.idlers.push({ obj: pv.userData.inner, phase: rand() * 6, kind: 'float' });
            break;
          }
          case '*': {
            const pv = this.stand(L, A.star(), 0.46, p.clone().setY(def.mode === 'sail' ? 0.06 : LAND_Y + 0.03), later, 4);
            L.stars.set(key(c), pv);
            L.idlers.push({ obj: pv.userData.inner, phase: rand() * 6, kind: 'spin' });
            break;
          }
          case 'D': {
            const deck = new THREE.Mesh(tileGeometry(0.98, 0.06, 0.8), new THREE.MeshStandardMaterial({ map: canvasTex(A.planks()), roughness: 0.85 }));
            deck.position.copy(p).setY(0.05);
            deck.castShadow = deck.receiveShadow = true;
            root.add(deck);
            this.addScale(L, deck, later);
            this.stand(L, A.post(), 0.55, p.clone().add(new THREE.Vector3(0.36, 0.08, -0.32)), later + 60);
            break;
          }
          case 'P':
            L.start = c;
            break;
        }
      }
    }

    // Each ice block is there to reach whichever item it is nearest to.
    for (const b of L.blocks.values()) {
      let best = Infinity;
      for (const [k, it] of L.items) {
        const [ix, iz] = k.split(',').map(Number);
        const d = manhattan([ix, iz], b.cell);
        if (d < best) {
          best = d;
          b.goal = it.id;
        }
      }
    }

    // scenery flats along the back edge of the spread
    if (!night) {
      this.stand(L, A.ridgeBack(5), 2.6, new THREE.Vector3(-6, 0, BACK_Z - 0.15), 1300, 5);
      this.stand(L, A.ridgeBack(11), 2.9, new THREE.Vector3(6.2, 0, BACK_Z - 0.15), 1380, 5);
      this.stand(L, A.ridgeFront(9), 1.7, new THREE.Vector3(-5, 0, BACK_Z + 0.05), 1450, 5);
      this.stand(L, A.ridgeFront(14), 1.6, new THREE.Vector3(5.6, 0, BACK_Z + 0.05), 1520, 5);
      this.onStick(L, A.sun(), 1.4, -9.5, BACK_Z + 0.3, 3.4, 1600);
      this.onStick(L, A.cloud(), 0.7, -2.5, BACK_Z + 0.25, 3.2, 1660);
      this.onStick(L, A.cloud(), 0.6, 3.5, BACK_Z + 0.2, 3.7, 1720);
      this.onStick(L, A.cloud(), 0.5, 9.5, BACK_Z + 0.25, 3.0, 1780);
    } else {
      const cliff = this.stand(L, A.cliffWide(), 3.8, new THREE.Vector3(6.3, 0, BACK_Z - 0.1), 1300, 5);
      this.onStick(L, A.moon(), 1.3, -8.6, BACK_Z + 0.3, 3.5, 1450);
      const stars: [number, number, number][] = [[-10.5, 2.4, 0.3], [-6.2, 3.8, 0.34], [-3.8, 2.9, 0.26], [-1.2, 3.6, 0.32], [1.2, 2.6, 0.24]];
      stars.forEach(([sx, sy, sh], i) => this.onStick(L, A.star(), sh, sx, BACK_Z + 0.2, sy, 1500 + i * 70));
      if (last) {
        // the great harbour lighthouse on the cliff, dark until the very end
        const big = this.stand(L, A.lighthouse(false), 3.2, new THREE.Vector3(10.2, 0, BACK_Z + 0.2), 1400, 6);
        const bigAwake = makeCutout(A.lighthouse(true), 3.2, 6);
        bigAwake.visible = false;
        big.add(bigAwake);
        big.userData.faces = [big.userData.inner, bigAwake];
        L.actors.set('bigLighthouse', big);
        L.bigLight = new THREE.PointLight(0xffd27a, 0, 0, 1.4);
        L.bigLight.position.set(0, 2.7, 0.6);
        big.add(L.bigLight);
        // The shadow army: everyone you helped stands behind you in the finale.
        const army = [this.art.pip, this.art.hero, this.art.tuck, this.art.pebble];
        if (this.puffinHelped) army.push(this.art.puffin);
        if (this.bobbleHelped) army.push(this.art.bobble);
        const span = 6.6;
        army.forEach((art, i) => {
          const sil = A.silhouette(art);
          const h = art === this.art.bobble ? 1.9 : 2.7, w = (h * sil.width) / sil.height;
          const geo = new THREE.PlaneGeometry(w, h);
          geo.translate(0, h / 2, 0);
          const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: canvasTex(sil), transparent: true, opacity: 0.62, depthWrite: false }));
          const g = new THREE.Group();
          g.add(m);
          g.position.set(-span / 2 - 0.6 + (span * i) / (army.length - 1), 0.35, 0.05);
          g.scale.setScalar(0.001);
          cliff.add(g);
          L.shadows.push(g);
        });
      }
    }
    if (def.orca) {
      const orca = standee(makeCutout(this.art.orca, 1.0));
      (orca.userData.inner as THREE.Group).position.y = DEEP;
      orca.visible = false;
      root.add(orca);
      L.actors.set('orca', orca);
    }
    if (def.mode === 'sail') this.makeFog(L);
    return L;
  }

  private unfold(L: Level) {
    let end = 0;
    const beats = new Set<number>();
    for (const p of L.pops) {
      tween(p.dur, p.set, p.ease, p.delay);
      end = Math.max(end, p.delay + p.dur);
      beats.add(Math.round((p.delay + p.dur * 0.6) / 160));
    }
    for (const b of beats) wait(b * 160).then(() => this.sound.fold(0.4));
    this.sound.pageTurn();
    return wait(end + 60);
  }

  private fold(L: Level) {
    const maxD = Math.max(...L.pops.map((p) => p.delay));
    let end = 0;
    const beats = new Set<number>();
    for (const p of L.pops) {
      const d = (maxD - p.delay) * 0.4;
      tween(p.dur * 0.6, (k) => p.set(1 - k), easeIn, d);
      end = Math.max(end, d + p.dur * 0.6);
      beats.add(Math.round((d + p.dur * 0.6) / 200));
    }
    for (const b of beats) wait(b * 200).then(() => this.sound.fold(0.35));
    return wait(end + 60);
  }

  // ---------------------------------------------------------------- chapters

  async playChapter(i: number) {
    if (this.level) this.scene.remove(this.level.root);
    this.camWide = true;
    const L = this.build(i);
    this.level = L;
    this.pos = [...L.start];
    this.checkpoint = null;
    this.prints = [];
    const sail = L.def.mode === 'sail';
    this.boatRig.visible = sail;
    this.facing.position.y = sail ? 0.12 : 0;
    this.player.position.copy(toWorld(L.start[0], L.start[1], this.cellY(L.start)));
    this.player.visible = true;
    this.addUp(L, this.player, 1100);
    if (sail && this.bobbleHelped) {
      const f = standee(makeCutout(this.art.bobble, 0.42, 5));
      f.position.copy(toWorld(L.start[0] - 1, L.start[1], 0.02));
      L.root.add(f);
      this.addUp(L, f, 1150);
      this.follower = f;
    } else {
      this.follower = null;
    }
    this.ui.banner(tr(L.def.title, L.def.titleRu));
    this.ui.setQuests([]);
    await this.unfold(L);
    L.ready = true;
    this.camWide = false;
    await wait(700);
    if (i === 0) await this.introOne();
    else if (i === 1) await this.introTwo();
    else await this.introThree();
    this.refreshQuests();
    this.busy = false;
    await new Promise<void>((r) => (this.finish = r));
    this.busy = true;
    this.marker.visible = false;
    this.hideGaze();
    this.ui.setQuests([]);
  }

  async closeChapter() {
    const L = this.level;
    if (!L) return;
    this.camWide = true;
    const orca = L.actors.get('orca');
    if (orca) orca.visible = false;
    this.hideRings();
    this.hideGaze();
    L.ready = false;
    await wait(500);
    await this.fold(L);
    this.player.visible = false;
    this.scene.remove(L.root);
  }

  private async introOne() {
    const { nar } = this.S;
    await this.ui.say([
      [nar, tr('Once upon a fold, on a snowy shore at the very edge of the page...', 'Давным-давно, на снежном берегу у самого краешка страницы...')],
      [nar, tr('two penguins were waiting for someone brave. Click or tap the snow to walk over and say hello.', '...два пингвина ждали кого-нибудь смелого. Нажми на снег, чтобы подойти и поздороваться.')],
    ]);
  }

  private async riseGrimfin() {
    this.initOrca();
    this.sound.growl();
    this.shake = 0.25;
    const L = this.level!;
    const at = this.orca.pos ?? L.def.orca!.lanes[0].from;
    await this.orcaRise(at);
    this.orca.pos = at;
    this.faceOrca();
    this.updateGaze();
  }

  private async introTwo() {
    const { nar, pip, pebble, bobble } = this.S;
    await this.riseGrimfin();
    const lines: Line[] = [
      [nar, tr('Night fell across the page. Out on the dark water, something with a very tall fin, and a very small spyglass, was circling.', 'На страницу опустилась ночь. В тёмной воде кружил кто-то с очень высоким плавником и очень маленькой подзорной трубой.')],
      [pebble, tr("There! Tuck is on that iceberg, all the way across. Rest on the little island halfway; Grimfin can't reach you on land.", 'Вон там! Тук на том айсберге, на другом краю. Передохни на островке посередине: на суше Гримфин тебя не достанет.')],
      [pip, tr('See the glowy squares? That is where Grimfin will look next. If he spots you, he shouts and charges next turn, so hop out of sight quick!', 'Видишь светящиеся квадратики? Туда Гримфин посмотрит в следующий ход. Если он тебя заметит, то закричит и на следующем ходу бросится в атаку, так что скорее прячься!')],
      [pebble, tr('Little icebergs block his spyglass. Hide behind them! And the red rings show where he can reach.', 'Маленькие айсберги закрывают ему обзор. Прячься за ними! А красные кольца показывают, куда он может дотянуться.')],
      [pip, touch
        ? tr('Tap the 🏮 button to cover your lantern. He can only spot you up close then, but you will miss the glowing stars.',
          'Нажми кнопку 🏮, чтобы прикрыть фонарик. Тогда он заметит тебя только вблизи, зато светящиеся звёздочки будет не видно.')
        : tr('Press L, or the 🏮 button, to cover your lantern. He can only spot you up close then, but you will miss the glowing stars.',
          'Нажми L или кнопку 🏮, чтобы прикрыть фонарик. Тогда он заметит тебя только вблизи, зато светящиеся звёздочки будет не видно.')],
      this.fish
        ? [pebble, tr(`You have ${this.fish} fish. Toss one in a fishing hole, by the little flags, and Grimfin will munch for ${FISH_TURNS} hops.`,
          `У тебя ${fishes(this.fish)}. Брось одну в лунку у флажка, и Гримфин будет жевать целых ${hops(FISH_TURNS)}.`)]
        : [pebble, tr("We haven't got any fish, so you'll have to time your hops. You can do it!", 'Рыбы у нас нет, так что придётся прыгать в нужный момент. У тебя получится!')],
    ];
    if (this.bobbleHelped) lines.push([bobble, tr("And if Grimfin gets you, I'll splash him right in the eye! Once, anyway.", 'А если Гримфин тебя поймает, я плесну ему прямо в глаз! Ну, один разок.')]);
    lines.push([nar, touch
      ? tr('Every hop you take, Grimfin swims one stroke. Tap where you stand, or the ⏳ button, to wait a turn.',
        'С каждым твоим прыжком Гримфин делает один гребок. Чтобы пропустить ход, нажми на себя или на кнопку ⏳.')
      : tr('Every hop you take, Grimfin swims one stroke. Click where you stand, press Space or the ⏳ button to wait a turn.',
        'С каждым твоим прыжком Гримфин делает один гребок. Чтобы пропустить ход, нажми на себя, на пробел или на кнопку ⏳.')]);
    await this.ui.say(lines);
  }

  private async introThree() {
    const { nar, pip, pebble, tuck, bobble } = this.S;
    this.revealAround(this.pos);
    await this.riseGrimfin();
    const lines: Line[] = [
      [nar, tr('The little paper boat slipped into a thick, sleepy fog. Somewhere ahead was home.', 'Бумажный кораблик скользнул в густой сонный туман. Где-то впереди был дом.')],
      [tuck, tr('I can hardly see my own flippers!', 'Я даже своих ласт не вижу!')],
      [pip, tr('Look, lighthouses! But they have all dozed off. Sail up beside each one and wake it with the lantern.', 'Смотрите, маяки! Только они все задремали. Подплыви к каждому и разбуди его фонариком.')],
      [pebble, tr("When all three are awake, the harbour gate will open. And Grimfin won't come anywhere near a lighthouse that's shining.", 'Когда проснутся все три, ворота гавани откроются. А к светящемуся маяку Гримфин и близко не подплывёт.')],
    ];
    lines.push([pip, this.fish
      ? tr(`No fishing holes out here, but you can toss a fish overboard with the 🐟 button${touch ? '' : ' or F'}. Grimfin will munch for ${FISH_TURNS} hops.`,
        `Лунок тут нет, но рыбку можно бросить за борт кнопкой 🐟${touch ? '' : ' или клавишей F'}. Гримфин будет жевать целых ${hops(FISH_TURNS)}.`)
      : tr(`Look out for floating crates of fish. Toss one overboard with the 🐟 button${touch ? '' : ' or F'} and Grimfin will stop to munch.`,
        `Ищи плавучие ящики с рыбой. Брось рыбку за борт кнопкой 🐟${touch ? '' : ' или клавишей F'}, и Гримфин остановится пожевать.`)]);
    if (this.bobbleHelped) lines.push([bobble, tr("I'll swim right behind you. Paddle paddle!", 'Я поплыву прямо за вами. Шлёп-шлёп!')]);
    lines.push([nar, tr('Grimfin hunts the fog the same way as before: watch for his glowing spyglass squares.', 'Гримфин охотится в тумане так же, как раньше: следи за светящимися квадратиками его подзорной трубы.')]);
    await this.ui.say(lines);
  }

  private refreshQuests() {
    const L = this.level;
    if (!L) return;
    const q: Quest[] = [];
    if (L.index === 0) {
      if (!this.talked) q.push({ text: tr('Say hello to the two penguins', 'Поздоровайся с двумя пингвинами') });
      else {
        q.push({ text: tr('Rescue the paper boat from the little island', 'Спаси бумажный кораблик с островка'), done: this.inv.has('boat') });
        if (this.puffinMet || this.yarnFound) {
          const text = this.puffinHelped
            ? tr("Return Auntie Puffin's yarn", 'Верни пряжу тётушке Тупик')
            : this.yarnFound
              ? tr('Bring the red yarn back to Auntie Puffin', 'Отнеси красную пряжу тётушке Тупик')
              : tr("Find Auntie Puffin's yarn in the dark igloo", 'Найди пряжу тётушки Тупик в тёмном иглу');
          q.push({ text, done: this.puffinHelped, optional: true });
        }
        if (this.bobbleMet || this.inv.has('ball')) {
          const text = this.bobbleHelped
            ? tr("Fetch Bobble's ball", 'Достань мячик Бобла')
            : this.inv.has('ball')
              ? tr('Give Bobble back his ball', 'Верни Боблу его мячик')
              : tr("Fetch Bobble's ball from the pond island", 'Достань мячик Бобла с островка в пруду');
          q.push({ text, done: this.bobbleHelped, optional: true });
        }
        if (this.inv.has('boat')) q.push({ text: tr('Meet Pip and Pebble at the dock →', 'Встреться с Пипом и Галькой у причала →') });
      }
    } else if (L.def.mode === 'walk') {
      q.push({ text: tr('Cross the ice floes and free Tuck', 'Перейди по льдинам и освободи Тука'), done: this.tuckFree });
      if (!this.tuckFree) q.push(this.orcaQuest());
      if (this.bobbleHelped && !this.tuckFree) q.push({ text: tr('Bobble will splash Grimfin once', 'Бобл один раз обрызгает Гримфина'), done: this.bobbleSplashUsed, optional: true });
    } else {
      const lit = [...L.beacons.values()].filter((b) => b.lit).length;
      q.push({ text: tr(`Wake the sleepy lighthouses · ${lit}/${L.beacons.size}`, `Разбуди сонные маяки · ${lit}/${L.beacons.size}`), done: lit === L.beacons.size });
      if (this.gateOpen) q.push({ text: tr('Sail into the home harbour →', 'Плыви в родную гавань →') });
      q.push(this.orcaQuest());
      q.push({ text: tr(`Fish crates found · ${this.crates}/3`, `Ящики с рыбой · ${this.crates}/3`), done: this.crates === 3, optional: true });
      if (this.bobbleHelped) q.push({ text: tr('Bobble will splash Grimfin once', 'Бобл один раз обрызгает Гримфина'), done: this.bobbleSplashUsed, optional: true });
    }
    q.push({ text: tr(`Paper stars ${this.stars}/${STAR_TOTAL}`, `Бумажные звёздочки ${this.stars}/${STAR_TOTAL}`), done: this.stars === STAR_TOTAL, optional: true });
    this.ui.setQuests(q);
  }

  private orcaQuest(): Quest {
    if (this.orca.distracted > 0) return { text: tr(`Grimfin is munching: ${hops(this.orca.distracted)} left`, `Гримфин жуёт: осталось ${hops(this.orca.distracted)}`) };
    if (this.orca.alert) return { text: tr('Grimfin spotted you! Get out of sight NOW', 'Гримфин тебя заметил! Скорее прячься!') };
    return { text: this.lanternCovered ? tr('Lantern covered: Grimfin only sees you up close', 'Фонарик прикрыт: Гримфин видит тебя только вблизи') : tr('Keep out of the glowy squares and red rings', 'Не заходи в светящиеся квадратики и красные кольца') };
  }

  private refreshInventory() {
    this.ui.setInventory(this.icons, this.inv, { fish: this.fish });
  }

  private give(id: string, message: string) {
    this.inv.add(id);
    this.refreshInventory();
    this.sound.chime();
    this.ui.toast(message);
    if (id === 'lantern') {
      const cut = makeCutout(A.lantern(), 0.32, 5);
      cut.position.set(0.3, 0.22, 0.05);
      this.facing.add(cut);
      this.onLantern(this.lanternCovered);
    }
    this.refreshQuests();
  }

  // ---------------------------------------------------------------- input

  /** Resolve a screen point to a board target. */
  private target(ndc: THREE.Vector2): { cell: Cell; act?: string } | null {
    const L = this.level;
    if (!L) return null;
    this.ray.setFromCamera(ndc, this.camera);
    for (const h of this.ray.intersectObjects(L.pick, false)) {
      if (h.object.userData.board) {
        const c: Cell = [Math.round(h.point.x + (COLS - 1) / 2), Math.round(h.point.z + (ROWS - 1) / 2)];
        if (!this.inBounds(c)) continue;
        for (const [id, ac] of L.actorCell) if (same(ac, c) && id !== 'orca') return { cell: c, act: id };
        return { cell: c };
      }
      let o: THREE.Object3D | null = h.object;
      while (o && o.userData.act === undefined && o.userData.cell === undefined) o = o.parent;
      if (!o || !o.visible) continue;
      if (o.userData.act) {
        const c = L.actorCell.get(o.userData.act);
        if (c) return { cell: c, act: o.userData.act };
        continue;
      }
      return { cell: o.userData.cell as Cell };
    }
    return null;
  }

  click(ndc: THREE.Vector2) {
    if (this.busy || this.ui.open || !this.level) return;
    const t = this.target(ndc);
    if (t) this.go(t.cell, t.act);
  }

  /** Mouse hover: show where a click would go, dimmed if it can't be reached. */
  hover(ndc: THREE.Vector2 | null) {
    if (!ndc || this.busy || this.ui.open || !this.level) {
      this.marker.visible = false;
      return;
    }
    const t = this.target(ndc);
    if (!t) {
      this.marker.visible = false;
      return;
    }
    let ok: boolean;
    if (t.act) ok = true;
    else if (same(t.cell, this.pos)) ok = !!this.level.def.orca;
    else ok = this.walkable(t.cell) && !!this.path(this.pos, [t.cell]);
    this.markerMat.color.set(t.act ? 0xffc94a : ok ? 0xfff3d0 : 0x6d6d78);
    this.marker.position.copy(toWorld(t.cell[0], t.cell[1], (this.sail ? 0.57 : this.cellY(t.cell)) + 0.012));
    this.marker.visible = true;
  }

  stepDir(dx: number, dz: number) {
    const L = this.level;
    if (this.busy || this.walking || this.ui.open || !L) return;
    const t: Cell = [this.pos[0] + dx, this.pos[1] + dz];
    for (const [id, c] of L.actorCell) if (same(c, t) && id !== 'orca') return this.go(t, id);
    if (this.walkable(t)) return this.go(t);
    if (dx) this.facing.scale.x = dx;
    this.sound.bump();
  }

  waitTurn() {
    if (this.busy || this.walking || this.ui.open || !this.level) return;
    this.go(this.pos);
  }

  private go(cell: Cell, act?: string) {
    if (this.walking) {
      this.pending = { cell, act };
      return;
    }
    this.walk(cell, act);
  }

  private inBounds(c: Cell) {
    return c[0] >= 0 && c[1] >= 0 && c[0] < COLS && c[1] < ROWS;
  }

  private walkable(c: Cell) {
    if (!this.inBounds(c)) return false;
    const ch = this.level!.grid[c[1]][c[0]];
    if (this.sail) return SAIL.has(ch) || (ch === 'g' && this.gateOpen);
    return WALK.has(ch);
  }

  private path(from: Cell, goals: Cell[]): Cell[] | null {
    const gs = new Set(goals.map(key));
    if (gs.has(key(from))) return [];
    const prev = new Map<string, Cell | null>([[key(from), null]]);
    const q: Cell[] = [from];
    while (q.length) {
      const c = q.shift()!;
      for (const d of DIRS) {
        const n: Cell = [c[0] + d[0], c[1] + d[1]];
        const k = key(n);
        if (prev.has(k) || !this.walkable(n)) continue;
        prev.set(k, c);
        if (gs.has(k)) {
          const out: Cell[] = [n];
          let p = c;
          while (!same(p, from)) {
            out.unshift(p);
            p = prev.get(key(p))!;
          }
          return out;
        }
        q.push(n);
      }
    }
    return null;
  }

  private async walk(target: Cell, act?: string) {
    this.walking = true;
    try {
      for (;;) {
        if (!act && same(target, this.pos)) {
          await this.passTurn();
          return;
        }
        const goals = act || !this.walkable(target)
          ? DIRS.map((d): Cell => [target[0] + d[0], target[1] + d[1]]).filter((c) => this.walkable(c))
          : [target];
        const path = this.path(this.pos, goals);
        if (!path) {
          this.sound.bump();
          if (act?.startsWith('block')) this.ui.toast(tr("You can't reach that side of the ice block.", 'К этой стороне ледяного блока не подойти.'));
          return;
        }
        let redirected = false;
        for (const s of path) {
          await this.step(s);
          if (await this.afterStep()) {
            this.pending = null;
            return;
          }
          if (this.pending) {
            target = this.pending.cell;
            act = this.pending.act;
            this.pending = null;
            redirected = true;
            break;
          }
        }
        if (redirected) continue;
        if (act) {
          this.face(target);
          await this.interact(act);
        }
        return;
      }
    } finally {
      this.walking = false;
    }
  }

  private cellY(c: Cell) {
    const ch = this.level!.grid[c[1]][c[0]];
    if (ch === 'o' || ch === '%') return 0.11;
    if (this.level!.def.water.includes(ch)) return 0.02;
    if (ch === '=') return 0.5;
    return LAND_Y;
  }

  private face(c: Cell) {
    if (c[0] !== this.pos[0]) this.facing.scale.x = c[0] > this.pos[0] ? 1 : -1;
  }

  private async step(c: Cell) {
    const from = this.player.position.clone();
    const to = toWorld(c[0], c[1], this.cellY(c));
    const old = this.pos;
    this.face(c);
    if (this.sail) this.sound.rustle(0.25);
    else this.sound.step(this.level!.grid[c[1]][c[0]] !== 'o');
    this.footprint(old);
    this.pos = c;
    const lean = -this.facing.scale.x;
    if (this.follower) {
      const f = this.follower, f0 = f.position.clone(), f1 = toWorld(old[0], old[1], 0.02);
      tween(260, (k) => {
        f.position.lerpVectors(f0, f1, k);
        f.position.y = 0.02 + Math.sin(Math.PI * k) * 0.12;
      }, linear);
    }
    await tween(this.sail ? 240 : 210, (k) => {
      this.player.position.lerpVectors(from, to, k);
      this.hopper.position.y = Math.sin(Math.PI * k) * (this.sail ? 0.06 : 0.2);
      this.hopper.rotation.z = Math.sin(Math.PI * k) * 0.09 * lean;
    }, linear);
    if (this.sail) this.revealAround(c);
  }

  /** Returns true when the step ended in an event that should stop walking. */
  private async afterStep() {
    const L = this.level!;
    const k = key(this.pos);
    const it = L.items.get(k);
    if (it) this.pickup(it);
    const star = L.stars.get(k);
    if (star && star.visible) this.collectStar(star);
    const ch = L.grid[this.pos[1]][this.pos[0]];
    if (L.index === 0 && ch === 'D') {
      await this.atDock();
      return true;
    }
    if (ch === 'G') {
      await this.finale();
      return true;
    }
    if (L.def.orca) return this.orcaTurn();
    return false;
  }

  private async passTurn() {
    if (!this.level?.def.orca) return;
    if (this.sail) this.sound.rustle(0.2);
    else this.sound.step(false);
    await tween(160, (k) => (this.hopper.position.y = Math.sin(Math.PI * k) * 0.06), linear);
    await this.orcaTurn();
  }

  private flyAway(obj: THREE.Object3D) {
    const L = this.level!;
    const y0 = obj.position.y;
    tween(520, (k) => {
      obj.position.y = y0 + k * 0.9;
      obj.scale.setScalar(Math.max(0.001, 1 - k));
      obj.rotation.y = k * Math.PI * 2;
    }, easeIn).then(() => L.root.remove(obj));
  }

  private pickup(it: { id: string; name: string; obj: THREE.Group }) {
    const L = this.level!;
    L.items.delete(key(this.pos));
    L.grid[this.pos[1]][this.pos[0]] = this.sail ? '~' : '.';
    this.flyAway(it.obj);
    if (it.id === 'crate') {
      this.crates++;
      this.fish++;
      this.inv.add('fish');
      this.refreshInventory();
      this.sound.chime([0, 4, 7]);
      this.ui.toast(tr(`A floating crate of Auntie Puffin's fish! +1 fish (${this.fish})`, `Плавучий ящик с рыбой тётушки Тупик! +1 рыбка (${this.fish})`));
      this.refreshQuests();
      return;
    }
    this.give(it.id, tr(`You found ${it.name}!`, `Находка: ${it.name}!`));
  }

  private collectStar(obj: THREE.Group) {
    const L = this.level!;
    L.stars.delete(key(this.pos));
    const ch = L.grid[this.pos[1]][this.pos[0]];
    L.grid[this.pos[1]][this.pos[0]] = ch === '%' ? 'o' : this.sail ? '~' : '.';
    this.stars++;
    this.flyAway(obj);
    this.sound.chime([7, 12, 16]);
    this.hearts(this.player.position, 3);
    this.ui.toast(this.stars === STAR_TOTAL
      ? tr(`All ${STAR_TOTAL} paper stars! What a sharp eye.`, `Все ${STAR_TOTAL} бумажных звёздочек! Вот это зоркость!`)
      : tr(`A paper star! ${this.stars}/${STAR_TOTAL}`, `Бумажная звёздочка! ${this.stars}/${STAR_TOTAL}`));
    this.refreshQuests();
  }

  private interact(act: string) {
    if (act.startsWith('block')) return this.pushBlock(act);
    if (act.startsWith('hole')) return this.tossFish(this.level!.actorCell.get(act)!);
    if (act.startsWith('beacon')) return this.wakeLighthouse(act);
    switch (act) {
      case 'pip':
      case 'pebble':
        return this.talk(act);
      case 'puffin':
        return this.talkPuffin();
      case 'bobble':
        return this.talkBobble();
      case 'igloo':
        return this.searchIgloo();
      case 'tuck':
        return this.tuckFree ? this.ui.say([[this.S.tuck, tr('Thank you, thank you!', 'Спасибо, спасибо!')]]) : this.freeTuck();
      case 'boat':
        return this.ui.say([[this.S.pebble, tr("That's our boat. Once Tuck is free, we'll paddle over and fetch you both!", 'Это наша лодочка. Как только Тук будет на свободе, мы приплывём за вами обоими!')]]);
    }
  }

  private async hopActor(id: string, c: Cell) {
    const L = this.level!;
    const pv = L.actors.get(id)!;
    const from = pv.position.clone();
    const to = toWorld(c[0], c[1], LAND_Y);
    const hops = Math.max(1, Math.round(from.distanceTo(to) / 0.8));
    for (let h = 0; h < hops; h++) {
      const a = from.clone().lerp(to, h / hops), b = from.clone().lerp(to, (h + 1) / hops);
      this.sound.step();
      await tween(180, (k) => {
        pv.position.lerpVectors(a, b, k);
        pv.position.y += Math.sin(Math.PI * k) * 0.2;
      }, linear);
    }
    L.actorCell.set(id, c);
  }

  // ---------------------------------------------------------------- chapter one

  private async talk(who: string) {
    const { pip, pebble } = this.S;
    const me = who === 'pip' ? pip : pebble;
    const L = this.level!;
    if (L.index > 0) {
      const lines: Line[][] = [
        [[pip, tr('Watch the glowy squares: that is where his spyglass is pointing next.', 'Следи за светящимися квадратиками: туда он посмотрит в подзорную трубу в следующий ход.')]],
        [[pebble, this.fish
          ? tr(`One fish keeps him busy for ${FISH_TURNS} hops. Toss it into a fishing hole by a flag!`, `Одна рыбка займёт его на ${hops(FISH_TURNS)}. Брось её в лунку у флажка!`)
          : tr('He dives under for two strokes at the end of each swim. That is your chance!', 'В конце каждого заплыва он ныряет на два гребка. Тут-то и не зевай!')]],
        [[pip, tr('Hide behind the little icebergs. His spyglass cannot see through ice!', 'Прячься за маленькими айсбергами. Сквозь лёд его подзорная труба не видит!')]],
        [[pebble, tr('Be brave! Tuck is counting on you.', 'Смелее! Тук на тебя надеется.')]],
      ];
      return this.ui.say(lines[this.chat++ % lines.length]);
    }
    if (!this.talked) {
      this.talked = true;
      await this.ui.say([
        [pip, tr('Oh! A visitor! Please, you have to help us!', 'Ой! Гость! Пожалуйста, помоги нам!')],
        [pebble, tr('Grimfin the orca snatched our friend Tuck and carried him off to his cove!', 'Гримфин, злая косатка, схватил нашего друга Тука и утащил к себе в бухту!')],
        [pip, tr("It's dark out there. Here, take my lantern.", 'Там темно. Вот, возьми мой фонарик.')],
      ]);
      this.give('lantern', tr('Pip gave you the paper lantern!', 'Пип дал тебе бумажный фонарик!'));
      this.hearts(L.actors.get('pip')!.position, 4);
      await this.ui.say([
        [pebble, tr('We need my paper boat too, but the wind blew it onto the little island in the bottom-left corner.', 'Ещё нам нужен мой бумажный кораблик, но ветер унёс его на островок в левом нижнем углу.')],
        [pip, tr("Ice blocks float, you know. If you shoved one into the water, you'd have a stepping-stone.", 'А ледяные блоки, между прочим, плавают. Столкни один в воду, и получится мостик.')],
        [pebble, tr("And if you find fish, Grimfin can never resist them. Auntie Puffin always has a few, but she looks upset about something.", 'А перед рыбой Гримфин ни за что не устоит. У тётушки Тупик всегда есть парочка, только она чем-то расстроена.')],
        [pip, tr('Little Bobble is moping by the pond, too. Meet us at the dock on the right when you have the boat!', 'И малыш Бобл грустит у пруда. Как достанешь кораблик, приходи к причалу справа!')],
      ]);
      this.refreshQuests();
      return;
    }
    if (!this.inv.has('boat')) {
      return this.ui.say([
        [me, tr('Push an ice block by walking into it. Get one into the water right next to the little island in the bottom-left.', 'Чтобы толкнуть ледяной блок, просто иди на него. Столкни его в воду прямо рядом с островком слева внизу.')],
        [me, tr('If it gets stuck, click it and you can shove it back where it started.', 'Если он застрянет, нажми на него, и его можно будет вернуть на место.')],
      ]);
    }
    if (!this.puffinHelped) return this.ui.say([[me, tr('Have you talked to Auntie Puffin? Fish would make Grimfin much easier to sneak past.', 'Загляни к тётушке Тупик! С рыбой прокрасться мимо Гримфина куда проще.')]]);
    if (!this.bobbleHelped) return this.ui.say([[me, tr("Bobble's ball is stuck on the island in the pond. He's a brave little seal; he might help you one day.", 'Мячик Бобла застрял на островке в пруду. Бобл — смелый маленький тюлень, когда-нибудь он тебе поможет.')]]);
    if (this.stars < 8) return this.ui.say([[me, tr('There are paper stars tucked behind things all over the page. But only if you want to look! The dock is that way.', 'По всей странице спрятаны бумажные звёздочки. Но это если захочешь поискать! Причал вон там.')]]);
    return this.ui.say([[me, tr('You found everything! To the dock!', 'Всё найдено! Вперёд, к причалу!')]]);
  }

  private async talkPuffin() {
    const { puffin, nar } = this.S;
    if (this.level!.index > 0) return this.ui.say([[puffin, tr('Welcome home, dears! Tuck, come here and let me wrap you up.', 'С возвращением, мои дорогие! Тук, иди сюда, я тебя укутаю.')]]);
    if (this.puffinHelped) return this.ui.say([[puffin, tr("Tell Tuck his scarf will be ready by the time he's home.", 'Передай Туку, что к его возвращению шарф будет готов.')]]);
    if (this.yarnFound) {
      await this.ui.say([
        [puffin, tr('My yarn! Oh, bless your mittens.', 'Моя пряжа! Ох, спасибо тебе, золотце.')],
        [puffin, tr('Here, take my fishing bucket. Three of my best fish.', 'Вот, возьми моё ведёрко. Тут три мои лучшие рыбки.')],
        [puffin, tr("Grimfin goes all silly for fish. Toss one into his fishing hole and he'll forget about you for a while.", 'Гримфин от рыбы просто голову теряет. Брось рыбку в лунку, и он ненадолго про тебя забудет.')],
      ]);
      this.inv.delete('yarn');
      this.puffinHelped = true;
      this.fish = 3;
      this.give('fish', tr('Auntie Puffin gave you 3 fish!', 'Тётушка Тупик дала тебе 3 рыбки!'));
      this.hearts(this.level!.actors.get('puffin')!.position);
      return;
    }
    if (!this.puffinMet) {
      this.puffinMet = true;
      await this.ui.say([
        [puffin, tr("Oh, hello, dear. You haven't seen a ball of red yarn, have you?", 'Ох, здравствуй, золотце. Тебе не попадался клубок красной пряжи?')],
        [puffin, tr("I was knitting Tuck a welcome-home scarf and it rolled away into the igloo. It's ever so dark in there.", 'Я вязала Туку шарф к его возвращению, а клубок укатился в иглу. А там так темно!')],
        [puffin, tr("Find it for me and I'll give you my fishing bucket.", 'Найди его, и я отдам тебе своё ведёрко с рыбой.')],
      ]);
      if (!this.inv.has('lantern')) await this.ui.say([[nar, tr('You will need a light to search the igloo.', 'Чтобы обыскать иглу, понадобится свет.')]]);
      this.refreshQuests();
      return;
    }
    return this.ui.say([[puffin, tr('The yarn rolled into the igloo, dear. Take a light with you.', 'Пряжа укатилась в иглу, золотце. Возьми с собой огонёк.')]]);
  }

  private async talkBobble() {
    const { bobble } = this.S;
    if (this.level!.index === 1) return this.ui.say([[bobble, tr("I'm ready! One big splash, saved just for Grimfin.", 'Я готов! Один большой плюх, специально для Гримфина.')]]);
    if (this.bobbleHelped) return this.ui.say([[bobble, tr('Thank you! If that big bully ever bothers you, I will splash him right in the eye!', 'Спасибо! Если этот задира к тебе пристанет, я плесну ему прямо в глаз!')]]);
    if (this.inv.has('ball')) {
      await this.ui.say([
        [bobble, tr('My ball! You got my ball!', 'Мой мячик! Мой мячик вернулся!')],
        [bobble, tr("I can't swim very far yet, but I can splash REALLY hard.", 'Я пока не умею далеко плавать, но плескаться умею ОЧЕНЬ сильно.')],
        [bobble, tr("If Grimfin ever catches you, I'll splash him right in the eye! Once, anyway.", 'Если Гримфин тебя поймает, я плесну ему прямо в глаз! Ну, один разок.')],
      ]);
      this.inv.delete('ball');
      this.bobbleHelped = true;
      this.refreshInventory();
      this.sound.chime([0, 7, 12, 19]);
      this.hearts(this.level!.actors.get('bobble')!.position);
      this.ui.toast(tr('Bobble will come along and save you once from Grimfin!', 'Бобл пойдёт с тобой и один раз спасёт от Гримфина!'));
      this.refreshQuests();
      return;
    }
    if (!this.bobbleMet) {
      this.bobbleMet = true;
      await this.ui.say([
        [bobble, tr('Sniff. My ball bounced onto the little island in the pond.', 'Хнык. Мой мячик ускакал на островок в пруду.')],
        [bobble, tr("I'm too little to swim out there. Could you get it for me?", 'Я слишком маленький, чтобы туда доплыть. Достанешь его мне?')],
      ]);
      this.refreshQuests();
      return;
    }
    return this.ui.say([[bobble, tr("There's an ice block near the pond. Maybe it could be a stepping-stone?", 'Возле пруда есть ледяной блок. Может, из него выйдет мостик?')]]);
  }

  private async searchIgloo() {
    const { nar } = this.S;
    if (!this.inv.has('lantern')) return this.ui.say([[nar, tr("It's pitch dark inside the igloo. You'd need a light to see anything.", 'В иглу темно, хоть глаз выколи. Без света ничего не разглядеть.')]]);
    if (this.yarnFound) return this.ui.say([[nar, tr('Just snow, and a very surprised beetle.', 'Только снег и очень удивлённый жучок.')]]);
    this.busy = true;
    tween(500, (k) => (this.lanternPower = 1 + Math.sin(Math.PI * k) * 3), linear);
    await this.ui.say([[nar, tr('You hold the lantern up to the doorway. Something red glints at the back of the igloo...', 'Ты поднимаешь фонарик у входа. В глубине иглу блестит что-то красное...')]]);
    this.yarnFound = true;
    this.give('yarn', tr('You found a ball of red yarn!', 'Находка: клубок красной пряжи!'));
    if (!this.puffinMet) await this.ui.say([[nar, tr('Somebody must be missing this.', 'Наверное, кто-то его ищет.')]]);
    this.busy = false;
  }

  private async pushBlock(id: string) {
    const L = this.level!;
    const b = L.blocks.get(id);
    if (!b) return;
    const d: Cell = [b.cell[0] - this.pos[0], b.cell[1] - this.pos[1]];
    if (Math.abs(d[0]) + Math.abs(d[1]) !== 1) return;
    const t: Cell = [b.cell[0] + d[0], b.cell[1] + d[1]];
    const ch = this.inBounds(t) ? L.grid[t[1]][t[0]] : '#';
    const occupied = [...L.actorCell.entries()].some(([aid, c]) => aid !== id && same(c, t));
    const intoWater = ch === '~';
    if (occupied || !(ch === '.' || ch === 'P' || intoWater)) {
      this.sound.bump();
      const r = await this.ui.ask(this.S.nar, tr("The ice block won't budge that way. Shove it back to where it started?", 'Туда ледяной блок не сдвинуть. Вернуть его на место?'), [tr('Yes, reset it', 'Да, вернуть'), tr('No', 'Нет')]);
      if (r === 0) await this.resetBlock(b);
      return;
    }
    this.busy = true;
    this.sound.rustle(0.5);
    const from = b.obj.position.clone();
    const to = toWorld(t[0], t[1], LAND_Y);
    const old = b.cell;
    L.grid[old[1]][old[0]] = '.';
    await Promise.all([tween(240, (k) => b.obj.position.lerpVectors(from, to, k), easeInOut), this.step(old)]);
    if (intoWater) {
      this.sound.splash(0.6);
      await tween(420, (k) => {
        b.obj.position.y = LAND_Y - k * 0.5;
        b.obj.scale.y = Math.max(0.001, 1 - k * 0.9);
      }, easeIn);
      L.root.remove(b.obj);
      L.actorCell.delete(id);
      L.blocks.delete(id);
      L.grid[t[1]][t[0]] = 'o';
      const fg = this.makeFloe(L, t);
      fg.scale.setScalar(0.001);
      await tween(380, (k) => fg.scale.setScalar(Math.max(0.001, k)), easeOutBack);
      this.ui.toast(tr('Splash! The ice block makes a stepping-stone.', 'Плюх! Ледяной блок стал мостиком.'));
      const goal = [...L.items.entries()].find(([, v]) => v.id === b.goal);
      if (goal) {
        const [gx, gz] = goal[0].split(',').map(Number);
        if (!this.path(this.pos, [[gx, gz]])) {
          await wait(500);
          const nb = this.makeBlock(L, id, b.origin);
          L.blocks.set(id, { ...b, cell: b.origin, obj: nb });
          nb.scale.setScalar(0.001);
          this.sound.fold();
          tween(380, (k) => nb.scale.setScalar(Math.max(0.001, k)), easeOutBack);
          this.ui.toast(tr('Crack! A fresh block of ice pops up where the first one was.', 'Хрусть! На месте первого блока появился новый.'));
        }
      }
    } else {
      b.cell = t;
      L.grid[t[1]][t[0]] = 'K';
      L.actorCell.set(id, t);
    }
    this.busy = false;
  }

  private async resetBlock(b: Block) {
    const L = this.level!;
    if (same(b.cell, b.origin)) return;
    if (same(this.pos, b.origin)) {
      this.ui.toast(tr('Step off that spot first.', 'Сначала сойди с этого места.'));
      return;
    }
    L.grid[b.cell[1]][b.cell[0]] = '.';
    await tween(260, (k) => b.obj.scale.setScalar(Math.max(0.001, 1 - k)), easeIn);
    b.cell = b.origin;
    b.obj.position.copy(toWorld(b.origin[0], b.origin[1], LAND_Y));
    L.grid[b.origin[1]][b.origin[0]] = 'K';
    L.actorCell.set(b.id, b.origin);
    this.sound.fold();
    await tween(320, (k) => b.obj.scale.setScalar(Math.max(0.001, k)), easeOutBack);
  }

  private async atDock() {
    const { nar, pip, pebble } = this.S;
    const L = this.level!;
    if (!this.talked) {
      await this.ui.say([[nar, tr('The little dock creaks over the cold water. Perhaps those penguins know where you are headed.', 'Маленький причал поскрипывает над холодной водой. Может, те пингвины знают, куда тебе дальше.')]]);
      return;
    }
    if (!this.inv.has('boat')) {
      await this.ui.say([[pip, tr("We can't sail without Pebble's boat! It's on the little island in the bottom-left corner.", 'Без кораблика Гальки нам не уплыть! Он на островке в левом нижнем углу.')]]);
      return;
    }
    this.busy = true;
    const [a, b] = L.def.dockFriends ?? [[this.pos[0] - 1, this.pos[1] - 1], [this.pos[0] - 1, this.pos[1] + 1]];
    await Promise.all([this.hopActor('pip', a), this.hopActor('pebble', b)]);
    const prompt = this.fish
      ? tr(`Lantern, boat and ${this.fish} fish, all packed! Shall we set sail for Grimfin's Cove?`, `Фонарик, кораблик и ${fishes(this.fish)} — всё собрано! Отплываем в бухту Гримфина?`)
      : tr('We have the boat, but no fish for Grimfin. Auntie Puffin might help. Set sail anyway?', 'Кораблик есть, а рыбы для Гримфина нет. Может, тётушка Тупик поможет. Всё равно отплываем?');
    const choice = await this.ui.ask(pebble, prompt, [tr('Set sail!', 'Отплываем!'), tr('Not yet', 'Ещё нет')]);
    if (choice === 0) {
      await this.ui.say([[pip, tr('Hold on to your hood!', 'Держи капюшон!')]]);
      this.finish?.();
    } else {
      this.busy = false;
    }
  }

  // ---------------------------------------------------------------- Grimfin

  private get orcaPv() {
    return this.level!.actors.get('orca')!;
  }
  private get orcaInner() {
    return this.orcaPv.userData.inner as THREE.Group;
  }

  private exposed(c: Cell) {
    const L = this.level!;
    if (this.sail) return !this.inSafeZone(c);
    return 'o%'.includes(L.grid[c[1]][c[0]]);
  }

  private inSafeZone(c: Cell) {
    for (const b of this.level!.beacons.values()) if (b.lit && manhattan(b.cell, c) <= SAFE_RADIUS) return true;
    return false;
  }

  private blocksSight(c: Cell) {
    if (!this.inBounds(c)) return true;
    const L = this.level!;
    const ch = L.def.map[c[1]][c[0]];
    return !L.def.water.includes(ch) || ch === 'v';
  }

  private world(): TurnWorld {
    return {
      path: this.opath,
      player: this.pos,
      exposed: this.exposed(this.pos),
      range: this.sightRange,
      gentle: this.gentle,
      blocks: (c) => this.blocksSight(c),
      avoid: (c) => this.inSafeZone(c),
    };
  }

  private initOrca() {
    const def = this.level!.def.orca!;
    this.opath = buildPath(def.lanes);
    const i = def.start % this.opath.cells.length;
    this.orca = { i, pos: this.opath.cells[i], head: this.opath.heads[i], alert: false, distracted: 0 };
  }

  private faceOrca() {
    if (this.orca.head[0] !== 0) this.orcaInner.scale.x = this.orca.head[0];
  }

  private async orcaDive() {
    const inner = this.orcaInner;
    const y0 = inner.position.y;
    this.sound.splash(0.35);
    await tween(280, (k) => (inner.position.y = y0 + (DEEP - y0) * k), easeIn);
  }

  private async orcaRise(c: Cell) {
    const pv = this.orcaPv, inner = this.orcaInner;
    pv.position.copy(toWorld(c[0], c[1], 0));
    inner.position.y = DEEP;
    inner.rotation.z = 0;
    pv.visible = true;
    this.sound.splash(0.4);
    await tween(360, (k) => (inner.position.y = DEEP + (SURFACE - DEEP) * k), easeOutBack);
  }

  private async orcaSwim(from: Cell, to: Cell) {
    const pv = this.orcaPv;
    const a = toWorld(from[0], from[1]), b = toWorld(to[0], to[1]);
    await tween(200, (k) => {
      pv.position.x = a.x + (b.x - a.x) * k;
      pv.position.z = a.z + (b.z - a.z) * k;
    }, easeInOut);
  }

  private orcaTop() {
    return this.orcaPv.position.clone().add(new THREE.Vector3(0, 1.1, 0.1));
  }

  private async orcaTurn(): Promise<boolean> {
    const o = this.orca;
    const prev = o.pos;
    const wasAlert = o.alert;
    const r = orcaStep(o, this.world());
    switch (r) {
      case 'munch':
        this.orcaInner.rotation.z = o.distracted % 2 ? 0.07 : -0.07;
        this.sound.blip(120);
        break;
      case 'done-munching':
        this.orcaInner.rotation.z = 0;
        await this.orcaDive();
        this.ui.toast(tr('Grimfin finished his fish… and he is still hungry.', 'Гримфин доел рыбку… и всё ещё голоден.'));
        break;
      case 'lost':
        this.popBubble(cachedArt('question', A.question), this.orcaTop());
        this.sound.blip(150);
        this.ui.toast(tr('Grimfin lost sight of you. Phew!', 'Гримфин тебя потерял. Фух!'));
        break;
      case 'caught':
      case 'moved':
      case 'spotted':
        if (!wasAlert) {
          if (!o.pos) {
            if (prev) await this.orcaDive();
          } else if (!prev) await this.orcaRise(o.pos);
          else await this.orcaSwim(prev, o.pos);
        }
        this.faceOrca();
        if (r === 'spotted') {
          this.popBubble(cachedArt('bang', A.bang), this.orcaTop());
          this.sound.growl();
          this.shake = 0.12;
          this.ui.toast(tr('Grimfin spotted you! Hop out of his sight, or he charges next turn!', 'Гримфин тебя заметил! Скорее прячься, или на следующем ходу он бросится!'));
        }
        if (r === 'caught') {
          if (this.bobbleHelped && !this.bobbleSplashUsed) {
            await this.bobbleSave();
            return false;
          }
          await this.caughtSeq();
          return true;
        }
        break;
    }
    this.updateRings();
    this.updateGaze();
    this.refreshQuests();
    return false;
  }

  private hideRings() {
    this.level?.rings.forEach((r) => (r.visible = false));
  }

  private updateRings() {
    const L = this.level!;
    this.hideRings();
    const o = this.orca;
    if (!L.def.orca || o.distracted > 0 || this.tuckFree || o.alert) return;
    const ni = (o.i + 1) % this.opath.cells.length;
    const next = this.opath.cells[ni];
    if (!next || this.inSafeZone(next)) return;
    for (const [k, ring] of L.rings) {
      const [x, z] = k.split(',').map(Number);
      if (manhattan([x, z], next) <= 1) ring.visible = true;
    }
  }

  private hideGaze() {
    this.gaze.forEach((m) => (m.visible = false));
  }

  /** Show where Grimfin's spyglass will point next turn (or, in red, where he is staring now). */
  private updateGaze() {
    this.hideGaze();
    const L = this.level;
    const o = this.orca;
    if (!L?.def.orca || o.distracted > 0 || (L.def.mode === 'walk' && this.tuckFree)) return;
    let from: Cell | null, head: Cell;
    if (o.alert && o.pos) {
      from = o.pos;
      head = o.head;
      this.gazeMat.color.set(0xff8a6a);
    } else {
      const ni = (o.i + 1) % this.opath.cells.length;
      from = this.opath.cells[ni];
      head = this.opath.heads[ni];
      if (from && this.inSafeZone(from)) from = null;
      this.gazeMat.color.set(0xffe58a);
    }
    if (!from) return;
    const cells = sightCells(from, head, this.sightRange, (c) => this.blocksSight(c));
    cells.slice(0, this.gaze.length).forEach((c, i) => {
      const m = this.gaze[i];
      m.position.copy(toWorld(c[0], c[1], this.sail ? 0.58 : this.cellY(c) + 0.016));
      m.visible = true;
    });
  }

  private async bobbleSave() {
    this.busy = true;
    this.bobbleSplashUsed = true;
    const { bobble, grim } = this.S;
    const inner = this.orcaInner;
    this.sound.splash(1);
    this.shake = 0.2;
    await tween(400, (k) => (inner.rotation.z = Math.sin(k * Math.PI * 4) * 0.2), linear);
    await this.ui.say([
      [bobble, tr('Hey, big bully! SPLAAASH!', 'Эй, задира! ПЛЮ-У-УХ!')],
      [grim, tr('Blub! My EYE! Who threw a whole puddle at me?!', 'Буль! Мой ГЛАЗ! Кто швырнул в меня целую лужу?!')],
    ]);
    inner.rotation.z = 0;
    await this.orcaDive();
    this.hearts(this.player.position, 5);
    this.orca.pos = null;
    this.orca.alert = false;
    this.orca.i = farLaneBefore(this.opath, this.pos);
    this.ui.toast(tr("Bobble's splash sent Grimfin under. Keep going!", 'От плюха Бобла Гримфин ушёл под воду. Вперёд!'));
    this.updateRings();
    this.updateGaze();
    this.refreshQuests();
    this.busy = false;
  }

  /** Where a catch sends you: the last dry place or lit lighthouse you passed. */
  private returnPoint(): Cell {
    const L = this.level!;
    if (this.sail) return this.checkpoint ?? L.start;
    const cps = L.def.checkpoints ?? [L.start];
    let best = cps[0];
    for (const c of cps) if (c[0] <= this.pos[0] && c[0] >= best[0]) best = c;
    return best;
  }

  private async caughtSeq() {
    this.busy = true;
    const { grim } = this.S;
    const pv = this.orcaPv, inner = this.orcaInner;
    const from = pv.position.clone();
    const target = this.player.position.clone();
    this.sound.growl();
    if (target.x !== from.x) inner.scale.x = target.x > from.x ? 1 : -1;
    await tween(420, (k) => {
      pv.position.x = from.x + (target.x - from.x) * k * 0.7;
      pv.position.z = from.z + (target.z - from.z) * k * 0.7;
      inner.position.y = SURFACE + Math.sin(Math.PI * k) * 0.75;
      inner.rotation.z = Math.sin(Math.PI * k) * 0.35 * inner.scale.x;
    }, easeInOut);
    this.sound.splash();
    this.shake = 0.3;
    await tween(260, (k) => this.player.scale.setScalar(Math.max(0.001, 1 - k)), easeIn);
    const back = this.returnPoint();
    this.pos = [...back];
    this.player.position.copy(toWorld(back[0], back[1], this.cellY(back)));
    if (this.follower) this.follower.position.copy(toWorld(back[0] - 1, back[1], 0.02));
    pv.position.copy(from);
    inner.rotation.z = 0;
    await tween(360, (k) => this.player.scale.setScalar(Math.max(0.001, k)), easeOutBack);
    await this.ui.say([[grim, pick([
      tr('HAR! Off my floes, little paper thing!', 'ХА! Прочь с моих льдин, бумажная мелюзга!'),
      tr('Splash! Back you go!', 'Плюх! А ну назад!'),
      tr('Nobody sneaks past Grimfin! HAR HAR HAR!', 'Мимо Гримфина никто не проскользнёт! ХА-ХА-ХА!'),
      tr('I spy, with my little spyglass... YOU!', 'Вижу-вижу в подзорную трубу... ТЕБЯ!'),
    ])]]);
    await this.orcaDive();
    this.orca.pos = null;
    this.orca.alert = false;
    this.orca.i = farLaneBefore(this.opath, this.pos);
    this.updateRings();
    this.updateGaze();
    this.refreshQuests();
    this.busy = false;
  }

  /** The fish button (or F): toss into a nearby fishing hole, or overboard when sailing. */
  useFish() {
    const L = this.level;
    if (!L || this.busy || this.walking || this.ui.open) return;
    if (this.fish <= 0) {
      this.ui.toast(tr('Your fish bucket is empty.', 'Ведёрко с рыбой пусто.'));
      return;
    }
    if (!L.def.orca) {
      this.ui.toast(tr('Save your fish for Grimfin!', 'Прибереги рыбу для Гримфина!'));
      return;
    }
    if (!this.sail) {
      for (const [id, c] of L.actorCell) if (id.startsWith('hole') && manhattan(c, this.pos) === 1) return this.go(c, id);
      this.ui.toast(tr('Stand next to a fishing hole (the little flags) to toss a fish.', 'Чтобы бросить рыбку, встань рядом с лункой (у флажка).'));
      return;
    }
    // Overboard: the open water beside the boat, as far from the lighthouses' light as possible.
    const spots = DIRS.map((d): Cell => [this.pos[0] + d[0], this.pos[1] + d[1]])
      .filter((c) => this.inBounds(c) && '~*c'.includes(L.grid[c[1]][c[0]]) && !this.inSafeZone(c));
    if (!spots.length) {
      this.ui.toast(tr("Grimfin won't come this close to a shining lighthouse anyway.", 'Гримфин и так не подплывёт к светящемуся маяку.'));
      return;
    }
    this.walking = true;
    this.tossFish(spots[0]).finally(() => (this.walking = false));
  }

  private async tossFish(hole: Cell) {
    const L = this.level!;
    if (this.fish <= 0) {
      return this.ui.say([[this.S.nar, this.puffinHelped ? tr('Your bucket is empty. Time your hops with the glowy squares instead.', 'Ведёрко пусто. Придётся прыгать, следя за светящимися квадратиками.') : tr("You haven't got any fish. Time your hops with the glowy squares instead.", 'Рыбы у тебя нет. Придётся прыгать, следя за светящимися квадратиками.')]]);
    }
    this.busy = true;
    this.fish--;
    if (!this.fish) this.inv.delete('fish');
    this.refreshInventory();
    this.face(hole);
    const f = makeCutout(A.fish(), 0.2, 4);
    L.root.add(f);
    const a = this.player.position.clone().add(new THREE.Vector3(0, 0.35, 0));
    const b = toWorld(hole[0], hole[1], 0.03);
    this.sound.rustle(0.6);
    await tween(600, (k) => {
      f.position.lerpVectors(a, b, k);
      f.position.y += Math.sin(Math.PI * k) * 0.9;
      f.rotation.z = k * 6;
    }, linear);
    L.root.remove(f);
    this.sound.splash(0.5);
    const o = this.orca;
    const fresh = o.distracted === 0 || !o.pos || !same(o.pos, hole);
    if (o.pos && fresh) await this.orcaDive();
    o.distracted = Math.min(FISH_TURNS * 2, o.distracted + FISH_TURNS);
    o.alert = false;
    o.pos = hole;
    if (fresh) {
      await this.orcaRise(hole);
      this.orcaInner.scale.x = 1;
    }
    this.hearts(b, 3);
    this.ui.toast(fresh ? tr('Munch munch munch… Grimfin is busy!', 'Ням-ням-ням… Гримфин занят!') : tr('Another fish! Grimfin will be busy even longer.', 'Ещё рыбка! Гримфин будет занят ещё дольше.'));
    this.updateRings();
    this.updateGaze();
    this.refreshQuests();
    this.busy = false;
  }

  // ---------------------------------------------------------------- chapter two: Tuck

  private async freeTuck() {
    this.busy = true;
    this.tuckFree = true;
    this.hideRings();
    this.hideGaze();
    this.refreshQuests();
    const L = this.level!;
    const F = L.def.finale!;
    const { nar, pip, pebble, tuck, grim, bobble } = this.S;
    const tuckPv = L.actors.get('tuck')!;
    const cage = L.actors.get('cage')!;
    await this.ui.say([[tuck, tr('You came! You really came!', 'Ты здесь! Ты правда здесь!')], [tuck, tr('Quick, pull the knot on the cage door!', 'Скорее, дёрни узелок на дверце клетки!')]]);
    this.sound.rustle(1.2);
    this.sound.fold();
    await tween(520, (k) => (cage.rotation.x = (-Math.PI / 2) * k), easeIn);
    const [sad, happy] = tuckPv.userData.faces as THREE.Group[];
    sad.visible = false;
    happy.visible = true;
    L.idlers.push({ obj: happy, phase: 0, kind: 'waddle' });
    this.sound.chime([0, 4, 7, 12, 16]);
    this.hearts(tuckPv.position, 9);
    await tween(320, (k) => (happy.position.y = Math.sin(Math.PI * k) * 0.3), linear);
    await this.ui.say([[tuck, tr('Free! Free as a snowflake!', 'Свобода! Я свободен, как снежинка!')]]);

    // Grimfin isn't done yet
    const o = this.orca;
    if (o.pos) await this.orcaDive();
    o.distracted = 0;
    this.sound.growl();
    this.shake = 0.4;
    await this.orcaRise(F.orcaRise);
    this.orcaInner.scale.x = 1;
    o.pos = F.orcaRise;
    this.popBubble(cachedArt('bang', A.bang), this.orcaTop());
    await this.ui.say([
      [grim, tr('HAR! You think you can just sail away?', 'ХА! Думаете, можно просто взять и уплыть?')],
      [grim, tr('My fog bank lies between you and home. Nobody finds their way through it. NOBODY!', 'Между вами и домом лежит мой туман. Сквозь него никто не найдёт дорогу. НИКТО!')],
      [grim, tr('This isn’t over, little paper thing!', 'Это ещё не конец, бумажная мелюзга!')],
    ]);
    await this.orcaDive();
    this.orcaPv.visible = false;
    o.pos = null;

    // Pip and Pebble (and Bobble) paddle over to fetch everyone
    const boat = L.actors.get('boat')!;
    const bc = L.actorCell.get('boat')!;
    const riders = ['pip', 'pebble', ...(this.bobbleHelped ? ['bobble'] : [])];
    await Promise.all(riders.map((r) => this.hopActor(r, bc)));
    const riderPvs = riders.map((r) => L.actors.get(r)!);
    const b0 = boat.position.clone();
    const b1 = toWorld(F.boatTo[0], F.boatTo[1], 0.03);
    this.sound.rustle(1);
    const offsets = [new THREE.Vector3(-0.2, 0.12, 0.02), new THREE.Vector3(0.18, 0.12, 0.04), new THREE.Vector3(0, 0.1, 0.08)];
    await tween(3200, (k) => {
      boat.position.lerpVectors(b0, b1, k);
      boat.position.y += Math.abs(Math.sin(k * Math.PI * 7)) * 0.05;
      riderPvs.forEach((r, i) => r.position.copy(boat.position).add(offsets[i]));
    }, easeInOut);
    const cheer: Line[] = [
      [pip, tr('TUCK!', 'ТУК!')],
      [pebble, tr('We knew you could do it!', 'Мы знали, что у тебя получится!')],
      [tuck, tr('Thank you, friend. Now... how do we get home through all that fog?', 'Спасибо, друг. А теперь... как же мы доберёмся домой сквозь этот туман?')],
    ];
    if (this.bobbleHelped) cheer.push([bobble, tr('With a lantern, silly!', 'С фонариком, глупенький!')]);
    else cheer.push([pip, tr('With a lantern, of course!', 'С фонариком, конечно!')]);
    await this.ui.say(cheer);
    this.hearts(tuckPv.position, 6);
    await this.ui.say([[nar, tr('So everyone squeezed into the little paper boat, and pushed off into the fog.', 'И все уместились в бумажном кораблике и отчалили в туман.')]]);
    this.finish?.();
  }

  // ---------------------------------------------------------------- chapter three: lighthouses

  private async wakeLighthouse(id: string) {
    const L = this.level!;
    const b = L.beacons.get(id)!;
    if (b.lit) return this.ui.say([[this.S.light, tr('All lit and wide awake! Off you go, little boat.', 'Горю и совсем не сплю! Плыви, кораблик.')]]);
    if (this.lanternCovered) {
      return this.ui.say([[this.S.nar, touch
        ? tr('You need to uncover your lantern to wake a lighthouse. Tap the 🏮 button.', 'Чтобы разбудить маяк, открой фонарик. Нажми кнопку 🏮.')
        : tr('You need to uncover your lantern to wake a lighthouse. Press L.', 'Чтобы разбудить маяк, открой фонарик. Нажми L.')]]);
    }
    this.busy = true;
    b.lit = true;
    this.checkpoint = [...this.pos];
    const [sleepy, awake] = b.pv.userData.faces as THREE.Group[];
    this.sound.flare();
    tween(500, (k) => (this.lanternPower = 1 + Math.sin(Math.PI * k) * 4), linear);
    await tween(300, (k) => sleepy.scale.setScalar(Math.max(0.001, 1 - k)), easeIn);
    sleepy.visible = false;
    awake.visible = true;
    awake.scale.setScalar(0.001);
    await tween(420, (k) => awake.scale.setScalar(Math.max(0.001, k)), easeOutBack);
    tween(800, (k) => (b.light.intensity = 3.5 * k), easeOut);
    this.reveal(b.cell, 4.8);
    this.hearts(b.pv.position.clone().add(new THREE.Vector3(0, 0.8, 0)), 6);
    const n = [...L.beacons.values()].filter((x) => x.lit).length;
    const yawns = [
      tr('Mmh? Oh! A light! I was having the loveliest nap.', 'М-м? Ой! Огонёк! Мне снился такой чудесный сон.'),
      tr('Hm-hmm? Is it night already? Shining now, shining!', 'Хм-м? Уже ночь? Свечу-свечу!'),
      tr('*yaaawn* Good morning! Er, good night! I mean: I am ON!', '*зева-а-аю* Доброе утро! То есть спокойной ночи! В общем, я ГОРЮ!'),
    ];
    await this.ui.say([[this.S.light, yawns[(n - 1) % yawns.length]]]);
    if (n === L.beacons.size) {
      this.gateOpen = true;
      const gate = L.actors.get('gate');
      if (gate) await tween(600, (k) => (gate.rotation.x = (-Math.PI / 2) * k), easeIn);
      this.sound.chime([0, 4, 7, 12, 16, 19]);
      this.reveal([21, 7], 3);
      await this.ui.say([[this.S.pip, tr('All three are shining! Listen, the harbour gate is opening! Home is that way →', 'Все три светят! Слышите? Ворота гавани открываются! Дом вон там →')]]);
    } else {
      this.ui.toast(tr(`Lighthouse awake! ${n}/${L.beacons.size}. Grimfin keeps clear of its light.`, `Маяк проснулся! ${n}/${L.beacons.size}. Гримфин держится подальше от его света.`));
    }
    this.updateRings();
    this.updateGaze();
    this.refreshQuests();
    this.busy = false;
  }

  // ---------------------------------------------------------------- finale

  private async finale() {
    this.busy = true;
    this.hideRings();
    this.hideGaze();
    const L = this.level!;
    const F = L.def.finale!;
    const { nar, pip, pebble, tuck, grim, bobble, puffin } = this.S;

    const o = this.orca;
    if (o.pos) await this.orcaDive();
    o.distracted = 0;
    this.sound.growl();
    this.shake = 0.4;
    await this.orcaRise(F.orcaRise);
    this.orcaInner.scale.x = 1;
    o.pos = F.orcaRise;
    this.popBubble(cachedArt('bang', A.bang), this.orcaTop());
    await this.ui.say([
      [grim, tr('HAR! Found your way through my fog, did you?', 'ХА! Нашли дорогу сквозь мой туман, да?')],
      [grim, tr("Well, you're not getting into that harbour. Not while Grimfin is around!", 'Но в гавань вам не попасть. Пока здесь Гримфин — ни за что!')],
    ]);
    await this.ui.ask(nar, tr('Grimfin rears up between you and home. The lantern flickers in your mittens…', 'Гримфин встаёт на дыбы между тобой и домом. Фонарик мерцает в твоих варежках…'), [tr('Raise the lantern high!', 'Поднять фонарик повыше!')]);

    this.lanternCovered = false;
    this.onLantern(false);
    this.sound.flare();
    this.shake = 0.3;
    this.camWide = true;
    const big = L.actors.get('bigLighthouse');
    if (big) {
      const [s, a] = big.userData.faces as THREE.Group[];
      s.visible = false;
      a.visible = true;
    }
    tween(700, (k) => {
      this.hopper.position.y = k * 0.35;
      this.lanternPower = 1 + k * 6;
      if (L.bigLight) L.bigLight.intensity = 6 * k;
    }, easeOut);
    tween(1200, (k) => (this.camLift = k), easeInOut);
    if (L.fog) this.reveal([COLS / 2, ROWS / 2], 30);
    L.shadows.forEach((s, i) => tween(1000, (k) => s.scale.setScalar(Math.max(0.001, k)), easeOutBack, 500 + i * 160));
    await wait(1900 + L.shadows.length * 120);
    const scared: Line[] = [[grim, tr('W-w-what?! A GIANT penguin army?!', 'Ч-ч-что?! ГИГАНТСКАЯ армия пингвинов?!')]];
    if (this.puffinHelped) scared.push([grim, tr('And a GIANT PUFFIN?! With KNITTING NEEDLES?!', 'И ГИГАНТСКИЙ ТУПИК?! Со СПИЦАМИ?!')]);
    if (this.bobbleHelped) scared.push([grim, tr('And a GIANT... wait, is that the little seal? He looks ENORMOUS!', 'И ГИГАНТСКИЙ... погодите, это что, тот малыш-тюлень? Да он ОГРОМНЫЙ!')]);
    scared.push([grim, tr('I just remembered I have to be fierce somewhere else. Very far away. Goodbye!', 'Я тут вспомнил, что мне надо быть грозным где-нибудь в другом месте. Очень далеко. До свидания!')]);
    await this.ui.say(scared);
    const pv = this.orcaPv, inner = this.orcaInner;
    const z0 = pv.position.z;
    this.sound.splash();
    inner.scale.x = -1;
    await tween(1000, (k) => {
      pv.position.z = z0 + k * 2.5;
      inner.position.y = SURFACE + (DEEP - SURFACE) * k;
    }, easeIn);
    pv.visible = false;
    o.pos = null;
    await tween(1000, (k) => {
      this.hopper.position.y = 0.35 * (1 - k);
      this.lanternPower = 7 - 6 * k;
      L.shadows.forEach((s) => s.scale.setScalar(Math.max(0.001, 1 - k)));
      this.camLift = 1 - k;
    }, easeInOut);

    // Morning comes.
    this.sound.chime([0, 4, 7, 11, 12, 16]);
    await tween(3500, (k) => (this.dawn = k), easeInOut);
    this.camWide = false;

    // Everyone hops ashore.
    this.boatRig.children.slice(1).forEach((c) => (c.visible = false));
    const friends: [string, HTMLCanvasElement, number][] = [['pip', this.art.pip, 0.82], ['pebble', this.art.pebble, 0.78], ['tuck', this.art.tuck, 0.78]];
    const spots = F.spots.filter((c) => !same(c, this.pos));
    const ashore: THREE.Group[] = [];
    for (const [i, [id, art, h]] of friends.entries()) {
      const pvF = this.actor(L, id, art, h, this.pos, 0, 'waddle');
      pvF.visible = true;
      pvF.rotation.x = 0;
      pvF.position.copy(this.player.position);
      ashore.push(pvF);
      await this.hopActor(id, spots[i]);
    }
    if (this.follower) {
      const f = this.follower, f0 = f.position.clone(), f1 = toWorld(spots[3][0], spots[3][1], LAND_Y);
      await tween(500, (k) => {
        f.position.lerpVectors(f0, f1, k);
        f.position.y += Math.sin(Math.PI * k) * 0.4;
      }, linear);
      ashore.push(f);
    }
    const lines: Line[] = [
      [pip, tr('HOME!', 'ДОМА!')],
      [tuck, tr('Thank you, friend. You were braver than a whole army of penguins.', 'Спасибо, друг. Ты храбрее целой армии пингвинов.')],
      [pebble, tr('...even a GIANT one.', '...даже ГИГАНТСКОЙ.')],
    ];
    if (this.puffinHelped) {
      lines.push([puffin, tr('Tuck! Come here, dear. I finished your welcome-home scarf!', 'Тук! Иди сюда, дорогой. Я довязала тебе шарф!')]);
      lines.push([tuck, tr('It is the cosiest scarf in the whole book!', 'Это самый уютный шарф во всей книжке!')]);
    }
    if (this.bobbleHelped) lines.push([bobble, tr('Did you see my splash? Did you SEE it?', 'Видели мой плюх? Вы ВИДЕЛИ?')]);
    await this.ui.say(lines);
    const puffinPv = L.actors.get('puffin');
    if (puffinPv) ashore.push(puffinPv);
    this.sound.chime([0, 4, 7, 12, 7, 12, 16, 19]);
    const jumpers = [...ashore, this.player];
    for (let j = 0; j < 3; j++) {
      this.hearts(this.player.position, 4);
      await Promise.all(jumpers.map((pvj, i) => {
        const y0 = pvj.position.y;
        return tween(300, (k) => (pvj.position.y = y0 + Math.sin(Math.PI * k) * 0.25), linear, i * 60);
      }));
    }
    await this.ui.say([[nar, tr('And so, with a lantern held high and your friends at your side, you came home across the folded sea, just as the sun came up.', 'Так, с высоко поднятым фонариком, все друзья вместе вернулись домой по сложенному бумажному морю — как раз когда взошло солнце.')]]);
    this.finish?.();
  }

  // ---------------------------------------------------------------- per frame

  update(t: number) {
    this.now = t;
    const L = this.level;
    if (!L) return;
    for (const i of L.idlers) {
      const s = t + i.phase;
      switch (i.kind) {
        case 'waddle':
          i.obj.rotation.z = Math.sin(s * 2.2) * 0.06;
          break;
        case 'bob':
          i.obj.position.y = 0.04 + Math.sin(s * 2) * 0.04;
          break;
        case 'wave':
          i.obj.position.x = Math.sin(s * 0.9) * 0.07;
          break;
        case 'float':
          i.obj.position.y = Math.sin(s * 1.3) * 0.012;
          i.obj.rotation.y = Math.sin(s * 0.4) * 0.12;
          break;
        case 'spin':
          i.obj.position.y = 0.05 + Math.sin(s * 2.4) * 0.05;
          i.obj.rotation.y = Math.sin(s * 1.1) * 0.6;
          break;
        case 'sway':
          i.obj.rotation.z = Math.sin(s * 0.8) * 0.025;
          break;
        case 'drift':
          i.obj.position.x += 0.003;
          if (i.obj.position.x > 13) i.obj.position.x = -13;
          i.obj.position.y += Math.sin(s * 0.7) * 0.0008;
          break;
      }
    }
    // friends bounce happily when you stand next to them
    for (const id of ['pip', 'pebble', 'puffin', 'bobble']) {
      const pv = L.actors.get(id), c = L.actorCell.get(id);
      if (!pv || !c) continue;
      const inner = pv.userData.inner as THREE.Group;
      inner.position.y = !this.busy && manhattan(c, this.pos) === 1 ? Math.abs(Math.sin(t * 7)) * 0.07 : 0;
    }
    // glowing stars at night only show in uncovered lantern light
    if (L.def.night && L.ready) {
      for (const [k, star] of L.stars) {
        const [x, z] = k.split(',').map(Number);
        star.visible = !this.lanternCovered && manhattan([x, z], this.pos) <= 3;
      }
    }
    // footprints fade
    for (const p of this.prints) {
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - (t - p.born) / 8);
    }
    const flicker = 1 + Math.sin(t * 13) * 0.04 + Math.sin(t * 7.3) * 0.05;
    const base = this.inv.has('lantern') ? (L.def.night ? 2.6 : 0.6) : 0;
    this.lanternLight.intensity = base * this.lanternPower * flicker * (this.lanternCovered ? 0.3 : 1);
    const orca = L.actors.get('orca');
    if (orca) orca.position.y = Math.sin(t * 1.6) * 0.03;
    L.ringMat.opacity = 0.55 + 0.3 * Math.sin(t * 6);
    this.gazeMat.opacity = (this.orca.alert ? 0.5 : 0.32) + 0.12 * Math.sin(t * 5);
    this.markerMat.opacity = 0.55 + 0.2 * Math.sin(t * 4);
    this.shake *= 0.9;
  }
}
