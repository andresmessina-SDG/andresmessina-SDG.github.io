// The adventure itself: building each chapter's pop-up board, walking, quests, the orca, and the story.
import * as THREE from 'three';
import { tween, wait, easeOutBack, easeInOut, easeOut, easeIn, linear, type Ease } from './tween';
import * as A from './art';
import { makeCutout, standee, paperMat, tileGeometry, rand, pick, canvasTex } from './paper';
import { LEVELS, type LevelDef, type Cell } from './levels';
import { buildTerrain, LAND_Y } from './terrain';
import type { Sound } from './audio';
import type { UI, Speaker, Line, Quest } from './ui';

export type { Cell };
export const COLS = LEVELS[0].map[0].length;
export const ROWS = LEVELS[0].map.length;
export const toWorld = (x: number, z: number, y = 0) => new THREE.Vector3(x - (COLS - 1) / 2, y, z - (ROWS - 1) / 2);
const key = (c: Cell) => `${c[0]},${c[1]}`;
const same = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];
const manhattan = (a: Cell, b: Cell) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const WALK = new Set(['.', 'P', 'S', 'D', 'o', '*', 'b']);
const DIRS: Cell[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const SURFACE = -0.3;
const DEEP = -1.35;
const FISH_TURNS = 6;
const BACK_Z = -ROWS / 2 - 0.2;
export const STAR_TOTAL = LEVELS.reduce((n, l) => n + l.map.join('').split('*').length - 1, 0);

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
  idlers: { obj: THREE.Object3D; phase: number; kind: 'waddle' | 'bob' | 'wave' | 'float' | 'spin' | 'sway' }[];
  rings: Map<string, THREE.Mesh>;
  ringMat: THREE.MeshBasicMaterial;
  shadows: THREE.Object3D[];
}

export class Game {
  level: Level | null = null;
  player = new THREE.Group();
  private hopper = new THREE.Group();
  private facing = new THREE.Group();
  private lanternLight = new THREE.PointLight(0xffa955, 0, 0, 1.7);
  private marker: THREE.Mesh;
  private markerMat: THREE.MeshBasicMaterial;
  pos: Cell = [0, 0];
  inv = new Set<string>();
  fish = 0;
  stars = 0;
  private talked = false;
  private puffinMet = false;
  puffinHelped = false;
  private yarnFound = false;
  private bobbleMet = false;
  bobbleHelped = false;
  private bobbleSplashUsed = false;
  private tuckFree = false;
  busy = true;
  walking = false;
  private pending: { cell: Cell; act?: string } | null = null;
  private orca = { path: [] as (Cell | null)[], i: 0, pos: null as Cell | null, distracted: 0, laneStarts: [] as number[] };
  shake = 0;
  /** 0..1: how far the camera tilts up toward the scenery flats (used in the finale). */
  camLift = 0;
  /** When true the camera pulls back to show the whole spread. */
  camWide = true;
  private lanternPower = 1;
  private finish: (() => void) | null = null;
  private ray = new THREE.Raycaster();
  private icons: Record<string, string>;
  private art: Record<string, HTMLCanvasElement>;
  private S: Record<string, Speaker>;
  private chat = 0;

  constructor(private scene: THREE.Scene, private camera: THREE.Camera, private sound: Sound, private ui: UI) {
    this.art = {
      pip: A.penguin({ scarf: '#c8413b', tuft: true }),
      pebble: A.penguin({ scarf: '#2f8f83', bow: '#e58fb0' }),
      tuck: A.penguin({ scarf: '#e2b13c', beanie: '#3f6fb0' }),
      tuckSad: A.penguin({ scarf: '#e2b13c', beanie: '#3f6fb0', sad: true }),
      puffin: A.puffin(),
      bobble: A.seal(),
      hero: A.hero(),
      orca: A.orca(),
    };
    this.S = {
      nar: { name: '', voice: 520 },
      pip: { name: 'Pip', portrait: this.art.pip.toDataURL(), voice: 700 },
      pebble: { name: 'Pebble', portrait: this.art.pebble.toDataURL(), voice: 860 },
      tuck: { name: 'Tuck', portrait: this.art.tuck.toDataURL(), voice: 620 },
      puffin: { name: 'Auntie Puffin', portrait: this.art.puffin.toDataURL(), voice: 560 },
      bobble: { name: 'Bobble', portrait: this.art.bobble.toDataURL(), voice: 960 },
      grim: { name: 'Grimfin', portrait: this.art.orca.toDataURL(), voice: 80 },
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
    this.player.visible = false;
    scene.add(this.player);

    // A paper-square cursor showing where a click will lead.
    this.markerMat = new THREE.MeshBasicMaterial({ color: 0xfff3d0, transparent: true, opacity: 0.75, depthWrite: false });
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.52, 0.62, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2), this.markerMat);
    this.marker.visible = false;
    this.marker.renderOrder = 2;
    scene.add(this.marker);
  }

  /** World-space point the camera and tilt-shift should follow. */
  get focusPoint() {
    return this.player.position;
  }

  get stats() {
    return { stars: this.stars, starTotal: STAR_TOTAL, puffin: this.puffinHelped, bobble: this.bobbleHelped };
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
  private obstacle(L: Level, art: HTMLCanvasElement, h: number, c: Cell, delay: number, idle?: 'sway') {
    const p = toWorld(c[0], c[1], LAND_Y).add(new THREE.Vector3((rand() - 0.5) * 0.12, 0, (rand() - 0.5) * 0.12));
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

  private build(index: number): Level {
    const def = LEVELS[index];
    const night = def.night;
    const root = new THREE.Group();
    this.scene.add(root);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff5a3c, transparent: true, opacity: 0.8, depthWrite: false });
    const L: Level = {
      index, def, root, grid: def.map.map((r) => r.split('')), start: [1, 1], pops: [], pick: [], items: new Map(),
      stars: new Map(), actors: new Map(), actorCell: new Map(), blocks: new Map(), idlers: [], rings: new Map(), ringMat, shadows: [],
    };
    // Friends you never met in chapter one don't turn up in chapter two.
    if (!this.bobbleHelped) L.grid.forEach((r) => r.forEach((ch, x) => ch === 'Q' && (r[x] = '.')));

    // The board: two page halves of cut paper that fold out from the spine.
    const terrain = buildTerrain(L.grid, night, index * 101 + 5);
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
            this.obstacle(L, A.pine(x * 7 + z * 3), 1.5 + rand() * 0.3, c, later, 'sway');
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
          case 'E':
            this.actor(L, 'boat', A.boat(), 0.62, c, later, null);
            break;
          case 'S':
          case 'b': {
            const boat = ch === 'S';
            const pv = this.stand(L, boat ? A.boat() : A.ball(), boat ? 0.5 : 0.34, p.clone().setY(LAND_Y), later);
            L.items.set(key(c), boat ? { id: 'boat', name: 'the paper boat', obj: pv } : { id: 'ball', name: "Bobble's ball", obj: pv });
            L.idlers.push({ obj: pv.userData.inner, phase: rand() * 6, kind: 'bob' });
            break;
          }
          case '*': {
            const pv = this.stand(L, A.star(), 0.46, p.clone().setY(LAND_Y + 0.03), later, 4);
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
      // The shadow army: everyone you helped stands behind you in the finale.
      const army = [this.art.pip, this.art.hero, this.art.tuck, this.art.pebble];
      if (this.puffinHelped) army.push(this.art.puffin);
      if (this.bobbleHelped) army.push(this.art.bobble);
      const span = 7.4;
      army.forEach((art, i) => {
        const sil = A.silhouette(art);
        const h = art === this.art.bobble ? 1.9 : 2.7, w = (h * sil.width) / sil.height;
        const geo = new THREE.PlaneGeometry(w, h);
        geo.translate(0, h / 2, 0);
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: canvasTex(sil), transparent: true, opacity: 0.62, depthWrite: false }));
        const g = new THREE.Group();
        g.add(m);
        g.position.set(-span / 2 + (span * i) / (army.length - 1), 0.35, 0.05);
        g.scale.setScalar(0.001);
        cliff.add(g);
        L.shadows.push(g);
      });
      const orca = standee(makeCutout(this.art.orca, 1.0));
      (orca.userData.inner as THREE.Group).position.y = DEEP;
      orca.visible = false;
      root.add(orca);
      L.actors.set('orca', orca);
    }
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
    this.player.position.copy(toWorld(L.start[0], L.start[1], LAND_Y));
    this.player.visible = true;
    this.addUp(L, this.player, 1100);
    this.ui.banner(L.def.title);
    this.ui.setQuests([]);
    await this.unfold(L);
    this.camWide = false;
    await wait(700);
    if (i === 0) await this.introOne();
    else await this.introTwo();
    this.refreshQuests();
    this.busy = false;
    await new Promise<void>((r) => (this.finish = r));
    this.busy = true;
    this.marker.visible = false;
    this.ui.setQuests([]);
  }

  async closeChapter() {
    const L = this.level;
    if (!L) return;
    this.camWide = true;
    const orca = L.actors.get('orca');
    if (orca) orca.visible = false;
    this.hideRings();
    await wait(500);
    await this.fold(L);
    this.player.visible = false;
    this.scene.remove(L.root);
  }

  private async introOne() {
    const { nar } = this.S;
    await this.ui.say([
      [nar, 'Once upon a fold, on a snowy shore at the very edge of the page...'],
      [nar, 'two penguins were waiting for someone brave. Click or tap the snow to walk over and say hello.'],
    ]);
  }

  private async introTwo() {
    const { nar, pip, pebble, bobble } = this.S;
    this.initOrca();
    this.sound.growl();
    this.shake = 0.25;
    await this.orcaRise(this.orca.pos ?? [10, 4]);
    this.updateRings();
    const lines: Line[] = [
      [nar, 'Night fell across the page. Out on the dark water, something with a very tall fin was circling.'],
      [pebble, "There! Tuck is on that iceberg, all the way across. Rest on the little island halfway; Grimfin can't reach you on land."],
      [pip, "Hop from floe to floe, but never onto a floe with a red ring. That's where Grimfin will be next!"],
      this.fish
        ? [pebble, `You have ${this.fish} fish. Toss one in a fishing hole, by the little flags, and Grimfin will munch for ${FISH_TURNS} hops.`]
        : [pebble, "We haven't got any fish, so you'll have to time your hops. You can do it!"],
    ];
    if (this.bobbleHelped) lines.push([bobble, "And if Grimfin gets you, I'll splash him right in the eye! Once, anyway."]);
    lines.push([nar, 'Every hop you take, Grimfin swims one stroke. Click where you stand, or press Space, to wait a turn.']);
    await this.ui.say(lines);
  }

  private refreshQuests() {
    const L = this.level;
    if (!L) return;
    const q: Quest[] = [];
    if (L.index === 0) {
      if (!this.talked) q.push({ text: 'Say hello to the two penguins' });
      else {
        q.push({ text: 'Rescue the paper boat from the little island', done: this.inv.has('boat') });
        if (this.puffinMet || this.yarnFound) {
          const text = this.puffinHelped
            ? "Return Auntie Puffin's yarn"
            : this.yarnFound
              ? 'Bring the red yarn back to Auntie Puffin'
              : "Find Auntie Puffin's yarn in the dark igloo";
          q.push({ text, done: this.puffinHelped, optional: true });
        }
        if (this.bobbleMet || this.inv.has('ball')) {
          const text = this.bobbleHelped
            ? "Fetch Bobble's ball"
            : this.inv.has('ball')
              ? 'Give Bobble back his ball'
              : "Fetch Bobble's ball from the pond island";
          q.push({ text, done: this.bobbleHelped, optional: true });
        }
        if (this.inv.has('boat')) q.push({ text: 'Meet Pip and Pebble at the dock →' });
      }
    } else {
      q.push({ text: 'Cross the ice floes and free Tuck', done: this.tuckFree });
      if (!this.tuckFree) {
        if (this.orca.distracted > 0) q.push({ text: `Grimfin is munching: ${this.orca.distracted} hops left` });
        else q.push({ text: 'Stay off the floes with red rings' });
        if (this.bobbleHelped) q.push({ text: 'Bobble will splash Grimfin once', done: this.bobbleSplashUsed, optional: true });
      }
    }
    q.push({ text: `Paper stars ${this.stars}/${STAR_TOTAL}`, done: this.stars === STAR_TOTAL, optional: true });
    this.ui.setQuests(q);
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
    else if (same(t.cell, this.pos)) ok = this.level.index === 1;
    else ok = this.walkable(t.cell) && !!this.path(this.pos, [t.cell]);
    this.markerMat.color.set(t.act ? 0xffc94a : ok ? 0xfff3d0 : 0x6d6d78);
    this.marker.position.copy(toWorld(t.cell[0], t.cell[1], this.cellY(t.cell) + 0.012));
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
    return this.inBounds(c) && WALK.has(this.level!.grid[c[1]][c[0]]);
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
          if (act?.startsWith('block')) this.ui.toast("You can't reach that side of the ice block.");
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
    if (ch === 'o') return 0.11;
    if (ch === '~' || ch === 'H') return 0.02;
    if (ch === '=') return 0.5;
    return LAND_Y;
  }

  private face(c: Cell) {
    if (c[0] !== this.pos[0]) this.facing.scale.x = c[0] > this.pos[0] ? 1 : -1;
  }

  private async step(c: Cell) {
    const from = this.player.position.clone();
    const to = toWorld(c[0], c[1], this.cellY(c));
    this.face(c);
    this.sound.step(this.level!.grid[c[1]][c[0]] !== 'o');
    this.pos = c;
    const lean = -this.facing.scale.x;
    await tween(210, (k) => {
      this.player.position.lerpVectors(from, to, k);
      this.hopper.position.y = Math.sin(Math.PI * k) * 0.2;
      this.hopper.rotation.z = Math.sin(Math.PI * k) * 0.09 * lean;
    }, linear);
  }

  /** Returns true when the step ended in an event that should stop walking. */
  private async afterStep() {
    const L = this.level!;
    const k = key(this.pos);
    const it = L.items.get(k);
    if (it) this.pickup(it);
    const star = L.stars.get(k);
    if (star) this.collectStar(star);
    if (L.index === 0 && L.grid[this.pos[1]][this.pos[0]] === 'D') {
      await this.atDock();
      return true;
    }
    if (L.index === 1) return this.orcaTurn();
    return false;
  }

  private async passTurn() {
    if (this.level?.index !== 1) return;
    this.sound.step(false);
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
    L.grid[this.pos[1]][this.pos[0]] = '.';
    this.flyAway(it.obj);
    this.give(it.id, `You found ${it.name}!`);
  }

  private collectStar(obj: THREE.Group) {
    const L = this.level!;
    L.stars.delete(key(this.pos));
    L.grid[this.pos[1]][this.pos[0]] = '.';
    this.stars++;
    this.flyAway(obj);
    this.sound.chime([7, 12, 16]);
    this.ui.toast(this.stars === STAR_TOTAL ? `All ${STAR_TOTAL} paper stars! What a sharp eye.` : `A paper star! ${this.stars}/${STAR_TOTAL}`);
    this.refreshQuests();
  }

  private interact(act: string) {
    if (act.startsWith('block')) return this.pushBlock(act);
    if (act.startsWith('hole')) return this.tossFish(this.level!.actorCell.get(act)!);
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
        return this.tuckFree ? this.ui.say([[this.S.tuck, 'Thank you, thank you!']]) : this.finale();
      case 'boat':
        return this.ui.say([[this.S.pebble, "That's our boat. Once Tuck is free, we'll paddle over and fetch you both!"]]);
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
    if (L.index === 1) {
      const lines: Line[][] = [
        [[pip, 'Watch the red rings. Grimfin always swims to the next one.']],
        [[pebble, this.fish ? `There's a fishing hole near the start and another by the little island. One fish keeps him busy for ${FISH_TURNS} hops.` : 'Grimfin dives under for two strokes at the end of each swim. That is your chance!']],
        [[pip, 'Be brave! Tuck is counting on you.']],
      ];
      return this.ui.say(lines[this.chat++ % lines.length]);
    }
    if (!this.talked) {
      this.talked = true;
      await this.ui.say([
        [pip, 'Oh! A visitor! Please, you have to help us!'],
        [pebble, 'Grimfin the orca snatched our friend Tuck and carried him off to his cove!'],
        [pip, "It's dark out there. Here, take my lantern."],
      ]);
      this.give('lantern', 'Pip gave you the paper lantern!');
      await this.ui.say([
        [pebble, 'We need my paper boat too, but the wind blew it onto the little island in the bottom-left corner.'],
        [pip, "Ice blocks float, you know. If you shoved one into the water, you'd have a stepping-stone."],
        [pebble, "And if you find fish, Grimfin can never resist them. Auntie Puffin always has a few, but she looks upset about something."],
        [pip, 'Little Bobble is moping by the pond, too. Meet us at the dock on the right when you have the boat!'],
      ]);
      this.refreshQuests();
      return;
    }
    if (!this.inv.has('boat')) {
      return this.ui.say([
        [me, 'Push an ice block by walking into it. Get one into the water right next to the little island in the bottom-left.'],
        [me, "If it gets stuck, click it and you can shove it back where it started."],
      ]);
    }
    if (!this.puffinHelped) return this.ui.say([[me, 'Have you talked to Auntie Puffin? Fish would make Grimfin much easier to sneak past.']]);
    if (!this.bobbleHelped) return this.ui.say([[me, "Bobble's ball is stuck on the island in the pond. He's a brave little seal; he might help you one day."]]);
    if (this.stars < STAR_TOTAL) return this.ui.say([[me, 'There are paper stars tucked behind things all over the page. But only if you want to look! The dock is that way.']]);
    return this.ui.say([[me, 'You found everything! To the dock!']]);
  }

  private async talkPuffin() {
    const { puffin, nar } = this.S;
    if (this.puffinHelped) return this.ui.say([[puffin, "Tell Tuck his scarf will be ready by the time he's home."]]);
    if (this.yarnFound) {
      await this.ui.say([
        [puffin, 'My yarn! Oh, bless your mittens.'],
        [puffin, 'Here, take my fishing bucket. Three of my best fish.'],
        [puffin, "Grimfin goes all silly for fish. Toss one into his fishing hole and he'll forget about you for a while."],
      ]);
      this.inv.delete('yarn');
      this.puffinHelped = true;
      this.fish = 3;
      this.give('fish', 'Auntie Puffin gave you 3 fish!');
      return;
    }
    if (!this.puffinMet) {
      this.puffinMet = true;
      await this.ui.say([
        [puffin, "Oh, hello, dear. You haven't seen a ball of red yarn, have you?"],
        [puffin, "I was knitting Tuck a welcome-home scarf and it rolled away into the igloo. It's ever so dark in there."],
        [puffin, "Find it for me and I'll give you my fishing bucket."],
      ]);
      if (!this.inv.has('lantern')) await this.ui.say([[nar, 'You will need a light to search the igloo.']]);
      this.refreshQuests();
      return;
    }
    return this.ui.say([[puffin, 'The yarn rolled into the igloo, dear. Take a light with you.']]);
  }

  private async talkBobble() {
    const { bobble } = this.S;
    if (this.level!.index === 1) return this.ui.say([[bobble, "I'm ready! One big splash, saved just for Grimfin."]]);
    if (this.bobbleHelped) return this.ui.say([[bobble, 'Thank you! If that big bully ever bothers you, I will splash him right in the eye!']]);
    if (this.inv.has('ball')) {
      await this.ui.say([
        [bobble, 'My ball! You got my ball!'],
        [bobble, "I can't swim very far yet, but I can splash REALLY hard."],
        [bobble, "If Grimfin ever catches you, I'll splash him right in the eye! Once, anyway."],
      ]);
      this.inv.delete('ball');
      this.bobbleHelped = true;
      this.refreshInventory();
      this.sound.chime([0, 7, 12, 19]);
      this.ui.toast('Bobble will come along and save you once from Grimfin!');
      this.refreshQuests();
      return;
    }
    if (!this.bobbleMet) {
      this.bobbleMet = true;
      await this.ui.say([
        [bobble, 'Sniff. My ball bounced onto the little island in the pond.'],
        [bobble, "I'm too little to swim out there. Could you get it for me?"],
      ]);
      this.refreshQuests();
      return;
    }
    return this.ui.say([[bobble, "There's an ice block near the pond. Maybe it could be a stepping-stone?"]]);
  }

  private async searchIgloo() {
    const { nar } = this.S;
    if (!this.inv.has('lantern')) {
      return this.ui.say([[nar, "It's pitch dark inside the igloo. You'd need a light to see anything."]]);
    }
    if (this.yarnFound) return this.ui.say([[nar, 'Just snow, and a very surprised beetle.']]);
    this.busy = true;
    tween(500, (k) => (this.lanternPower = 1 + Math.sin(Math.PI * k) * 3), linear);
    await this.ui.say([[nar, 'You hold the lantern up to the doorway. Something red glints at the back of the igloo...']]);
    this.yarnFound = true;
    this.give('yarn', 'You found a ball of red yarn!');
    if (!this.puffinMet) await this.ui.say([[nar, 'Somebody must be missing this.']]);
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
      const r = await this.ui.ask(this.S.nar, "The ice block won't budge that way. Shove it back to where it started?", ['Yes, reset it', 'No']);
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
      this.ui.toast('Splash! The ice block makes a stepping-stone.');
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
          this.ui.toast('Crack! A fresh block of ice pops up where the first one was.');
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
      this.ui.toast('Step off that spot first.');
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
      await this.ui.say([[nar, 'The little dock creaks over the cold water. Perhaps those penguins know where you are headed.']]);
      return;
    }
    if (!this.inv.has('boat')) {
      await this.ui.say([[pip, "We can't sail without Pebble's boat! It's on the little island in the bottom-left corner."]]);
      return;
    }
    this.busy = true;
    const [a, b] = L.def.dockFriends ?? [[this.pos[0] - 1, this.pos[1] - 1], [this.pos[0] - 1, this.pos[1] + 1]];
    await Promise.all([this.hopActor('pip', a), this.hopActor('pebble', b)]);
    const prompt = this.fish
      ? `Lantern, boat and ${this.fish} fish, all packed! Shall we set sail for Grimfin's Cove?`
      : "We have the boat, but no fish for Grimfin. Auntie Puffin might help. Set sail anyway?";
    const choice = await this.ui.ask(pebble, prompt, ['Set sail!', 'Not yet']);
    if (choice === 0) {
      await this.ui.say([[pip, 'Hold on to your hood!']]);
      this.finish?.();
    } else {
      this.busy = false;
    }
  }

  // ---------------------------------------------------------------- the orca

  private get orcaPv() {
    return this.level!.actors.get('orca')!;
  }
  private get orcaInner() {
    return this.orcaPv.userData.inner as THREE.Group;
  }

  private initOrca() {
    const def = this.level!.def.orca!;
    const path: (Cell | null)[] = [];
    const laneStarts: number[] = [];
    for (const [row, a, b] of def.lanes) {
      laneStarts.push(path.length);
      const s = a < b ? 1 : -1;
      for (let x = a; x !== b + s; x += s) path.push([x, row]);
      path.push(null, null);
    }
    const i = def.start % path.length;
    this.orca = { path, i, pos: path[i], distracted: 0, laneStarts };
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
    if (to[0] !== from[0]) this.orcaInner.scale.x = to[0] > from[0] ? 1 : -1;
    const a = toWorld(from[0], from[1]), b = toWorld(to[0], to[1]);
    await tween(200, (k) => {
      pv.position.x = a.x + (b.x - a.x) * k;
      pv.position.z = a.z + (b.z - a.z) * k;
    }, easeInOut);
  }

  /** The farthest lane from the player, so Grimfin resurfaces somewhere fair. */
  private farLaneStart() {
    const o = this.orca;
    let best = o.laneStarts[0], bestD = -1;
    for (const s of o.laneStarts) {
      const c = o.path[s]!;
      const d = manhattan(c, this.pos);
      if (d > bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  private async orcaTurn(): Promise<boolean> {
    const o = this.orca;
    if (o.distracted > 0) {
      o.distracted--;
      if (o.distracted === 0) {
        await this.orcaDive();
        o.pos = null;
        o.i = (this.farLaneStart() - 1 + o.path.length) % o.path.length;
        this.ui.toast('Grimfin finished his fish… and he is still hungry.');
      } else {
        this.orcaInner.rotation.z = o.distracted % 2 ? 0.07 : -0.07;
        this.sound.blip(120);
      }
      this.updateRings();
      this.refreshQuests();
      return false;
    }
    const prev = o.pos;
    o.i = (o.i + 1) % o.path.length;
    const next = o.path[o.i];
    if (!next) {
      if (prev) await this.orcaDive();
    } else if (!prev) {
      await this.orcaRise(next);
    } else {
      await this.orcaSwim(prev, next);
    }
    o.pos = next;
    this.updateRings();
    if (this.caught()) {
      if (this.bobbleHelped && !this.bobbleSplashUsed) {
        await this.bobbleSave();
        return false;
      }
      await this.caughtSeq();
      return true;
    }
    return false;
  }

  private caught() {
    const o = this.orca;
    const L = this.level!;
    return L.grid[this.pos[1]][this.pos[0]] === 'o' && o.distracted === 0 && !!o.pos && manhattan(o.pos, this.pos) <= 1;
  }

  private hideRings() {
    this.level?.rings.forEach((r) => (r.visible = false));
  }

  private updateRings() {
    const L = this.level!;
    this.hideRings();
    const o = this.orca;
    if (L.index !== 1 || o.distracted > 0 || this.tuckFree) return;
    const next = o.path[(o.i + 1) % o.path.length];
    if (!next) return;
    for (const [k, ring] of L.rings) {
      const [x, z] = k.split(',').map(Number);
      if (manhattan([x, z], next) <= 1) ring.visible = true;
    }
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
      [bobble, 'Hey, big bully! SPLAAASH!'],
      [grim, 'Blub! My EYE! Who threw a whole puddle at me?!'],
    ]);
    inner.rotation.z = 0;
    await this.orcaDive();
    this.orca.pos = null;
    this.orca.i = (this.farLaneStart() - 1 + this.orca.path.length) % this.orca.path.length;
    this.ui.toast("Bobble's splash sent Grimfin under. Keep going!");
    this.updateRings();
    this.refreshQuests();
    this.busy = false;
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
      pv.position.x = from.x + (target.x - from.x) * k * 0.6;
      pv.position.z = from.z + (target.z - from.z) * k * 0.6;
      inner.position.y = SURFACE + Math.sin(Math.PI * k) * 0.75;
      inner.rotation.z = Math.sin(Math.PI * k) * 0.35 * inner.scale.x;
    }, easeInOut);
    this.sound.splash();
    this.shake = 0.3;
    await tween(260, (k) => this.player.scale.setScalar(Math.max(0.001, 1 - k)), easeIn);
    // Back to the last bit of dry land you stood on: the start, or the island halfway.
    const L = this.level!;
    const back = this.pos[0] > 11 ? ([11, 6] as Cell) : L.start;
    this.pos = [...back];
    this.player.position.copy(toWorld(back[0], back[1], LAND_Y));
    pv.position.copy(from);
    inner.rotation.z = 0;
    await tween(360, (k) => this.player.scale.setScalar(Math.max(0.001, k)), easeOutBack);
    await this.ui.say([[grim, pick([
      'HAR! Off my floes, little paper thing!',
      'Splash! Back to dry land with you!',
      'Nobody sneaks past Grimfin! HAR HAR HAR!',
    ])]]);
    await this.orcaDive();
    this.orca.pos = null;
    this.orca.i = (this.farLaneStart() - 1 + this.orca.path.length) % this.orca.path.length;
    this.updateRings();
    this.refreshQuests();
    this.busy = false;
  }

  private async tossFish(hole: Cell) {
    const L = this.level!;
    if (this.fish <= 0) {
      return this.ui.say([[this.S.nar, this.puffinHelped ? 'Your bucket is empty. Time your hops with the red rings instead.' : "You haven't got any fish. Time your hops with the red rings instead."]]);
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
    o.pos = hole;
    if (fresh) {
      await this.orcaRise(hole);
      this.orcaInner.scale.x = 1;
    }
    this.ui.toast(fresh ? 'Munch munch munch… Grimfin is busy!' : 'Another fish! Grimfin will be busy even longer.');
    this.updateRings();
    this.refreshQuests();
    this.busy = false;
  }

  // ---------------------------------------------------------------- finale

  private async finale() {
    this.busy = true;
    this.tuckFree = true;
    this.hideRings();
    this.refreshQuests();
    const L = this.level!;
    const F = L.def.finale!;
    const { nar, pip, pebble, tuck, grim, bobble } = this.S;
    const tuckPv = L.actors.get('tuck')!;
    const cage = L.actors.get('cage')!;
    await this.ui.say([[tuck, 'You came! You really came!'], [tuck, 'Quick, pull the knot on the cage door!']]);
    this.sound.rustle(1.2);
    this.sound.fold();
    await tween(520, (k) => (cage.rotation.x = (-Math.PI / 2) * k), easeIn);
    const [sad, happy] = tuckPv.userData.faces as THREE.Group[];
    sad.visible = false;
    happy.visible = true;
    L.idlers.push({ obj: happy, phase: 0, kind: 'waddle' });
    this.sound.chime([0, 4, 7, 12, 16]);
    await tween(320, (k) => (happy.position.y = Math.sin(Math.PI * k) * 0.3), linear);
    await this.ui.say([[tuck, 'Free! Free as a snowflake!']]);

    // Grimfin bursts up beside the iceberg
    const o = this.orca;
    if (o.pos) await this.orcaDive();
    o.distracted = 0;
    this.sound.growl();
    this.shake = 0.4;
    await this.orcaRise(F.orcaRise);
    this.orcaInner.scale.x = 1;
    o.pos = F.orcaRise;
    await this.ui.say([
      [grim, 'HAR! Leaving so soon?'],
      [grim, "Nobody leaves Grimfin's cove. Not you, and not your squeaky little friend!"],
    ]);
    await this.ui.ask(nar, 'Grimfin rears up out of the black water. The lantern flickers in your mittens…', ['Raise the lantern high!']);

    this.sound.flare();
    this.shake = 0.3;
    this.camWide = true;
    tween(700, (k) => {
      this.hopper.position.y = k * 0.35;
      this.lanternPower = 1 + k * 6;
    }, easeOut);
    tween(1200, (k) => (this.camLift = k), easeInOut);
    L.shadows.forEach((s, i) => tween(1000, (k) => s.scale.setScalar(Math.max(0.001, k)), easeOutBack, 500 + i * 160));
    await wait(1900 + L.shadows.length * 120);
    const scared: Line[] = [[grim, 'W-w-what?! A GIANT penguin army?!']];
    if (this.puffinHelped) scared.push([grim, 'And a GIANT PUFFIN?! With KNITTING NEEDLES?!']);
    if (this.bobbleHelped) scared.push([grim, 'And a GIANT... wait, is that the little seal? He looks ENORMOUS!']);
    scared.push([grim, 'I just remembered I have to be fierce somewhere else. Very far away. Goodbye!']);
    await this.ui.say(scared);
    const pv = this.orcaPv, inner = this.orcaInner;
    const z0 = pv.position.z;
    this.sound.splash();
    inner.scale.x = -1;
    await tween(1000, (k) => {
      pv.position.z = z0 - k * 1.5;
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
    this.camWide = false;

    // Pip and Pebble (and Bobble) paddle over
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
    const spots = F.spots.filter((c) => !same(c, this.pos));
    await Promise.all(riders.map((r, i) => this.hopActor(r, spots[i])));

    const cheer: Line[] = [
      [pip, 'TUCK!'],
      [pebble, 'We knew you could do it!'],
      [tuck, 'Thank you, friend. You were braver than a whole army of penguins.'],
      [pip, '...even a GIANT one.'],
    ];
    if (this.puffinHelped) cheer.push([pebble, 'And Auntie Puffin is knitting you a welcome-home scarf, Tuck!']);
    if (this.bobbleHelped) cheer.push([bobble, 'Did you see my splash? Did you SEE it?']);
    await this.ui.say(cheer);
    this.sound.chime([0, 4, 7, 12, 7, 12, 16, 19]);
    const jumpers = [...riderPvs, tuckPv, this.player];
    for (let j = 0; j < 3; j++) {
      await Promise.all(jumpers.map((pvj, i) => {
        const y0 = pvj.position.y;
        return tween(300, (k) => (pvj.position.y = y0 + Math.sin(Math.PI * k) * 0.25), linear, i * 60);
      }));
    }
    await this.ui.say([[nar, 'And so, with a lantern held high and your friends at your side, you sailed home across the folded sea.']]);
    this.finish?.();
  }

  // ---------------------------------------------------------------- per frame

  update(t: number) {
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
      }
    }
    const flicker = 1 + Math.sin(t * 13) * 0.04 + Math.sin(t * 7.3) * 0.05;
    const base = this.inv.has('lantern') ? (L.def.night ? 2.6 : 0.6) : 0;
    this.lanternLight.intensity = base * this.lanternPower * flicker;
    const orca = L.actors.get('orca');
    if (orca) orca.position.y = Math.sin(t * 1.6) * 0.03;
    L.ringMat.opacity = 0.55 + 0.3 * Math.sin(t * 6);
    this.markerMat.opacity = 0.55 + 0.2 * Math.sin(t * 4);
    this.shake *= 0.9;
  }
}
