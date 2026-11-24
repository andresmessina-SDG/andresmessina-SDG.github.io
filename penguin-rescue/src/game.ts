// The adventure itself: building each chapter's pop-up board, walking, the orca, and the story.
import * as THREE from 'three';
import { tween, wait, easeOutBack, easeInOut, easeOut, easeIn, linear, type Ease } from './tween';
import * as A from './art';
import { makeCutout, standee, paperMat, tileGeometry, rand, pick, canvasTex } from './paper';
import { LEVELS, type LevelDef } from './levels';
import type { Sound } from './audio';
import type { UI, Speaker, Line } from './ui';

export type Cell = [number, number];
const COLS = 12;
const ROWS = 8;
export const toWorld = (x: number, z: number, y = 0) => new THREE.Vector3(x - 5.5, y, z - 3.5);
const key = (c: Cell) => `${c[0]},${c[1]}`;
const same = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];
const manhattan = (a: Cell, b: Cell) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const WALK = new Set(['.', 'P', 'L', 'S', 'F', 'D', 'o']);
const DIRS: Cell[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const SURFACE = -0.3;
const DEEP = -1.35;

interface Pop {
  delay: number;
  dur: number;
  ease: Ease;
  set: (k: number) => void;
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
  actors: Map<string, THREE.Group>;
  actorCell: Map<string, Cell>;
  idlers: { obj: THREE.Object3D; phase: number; kind: 'waddle' | 'bob' | 'wave' | 'float' }[];
  rings: Map<string, THREE.Mesh>;
  ringMat: THREE.MeshBasicMaterial;
  shadows: THREE.Object3D[];
}

const ITEMS: Record<string, { id: string; name: string; art: () => HTMLCanvasElement; h: number }> = {
  L: { id: 'lantern', name: 'the paper lantern', art: A.lantern, h: 0.6 },
  S: { id: 'boat', name: 'the paper boat', art: A.boat, h: 0.5 },
  F: { id: 'fish', name: 'the bucket of fish', art: A.bucket, h: 0.55 },
};
const ITEM_ORDER = ['lantern', 'boat', 'fish'];
const ITEM_NAMES: Record<string, string> = { lantern: 'a lantern', boat: 'a boat', fish: 'some fish' };

function listNames(ids: string[]) {
  const n = ids.map((i) => ITEM_NAMES[i]);
  return n.length < 2 ? n.join('') : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1];
}

export class Game {
  level: Level | null = null;
  player = new THREE.Group();
  private hopper = new THREE.Group();
  private facing = new THREE.Group();
  private lanternLight = new THREE.PointLight(0xffa955, 0, 0, 1.7);
  pos: Cell = [0, 0];
  inv = new Set<string>();
  private talked = false;
  private tuckFree = false;
  busy = true;
  walking = false;
  private pending: { cell: Cell; act?: string } | null = null;
  private orca = { path: [] as (Cell | null)[], i: 0, pos: null as Cell | null, distracted: 0 };
  shake = 0;
  /** 0..1: how far the camera tilts up toward the scenery flats (used in the finale). */
  camLift = 0;
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
      hero: A.hero(),
      orca: A.orca(),
    };
    this.S = {
      nar: { name: '', voice: 520 },
      pip: { name: 'Pip', portrait: this.art.pip.toDataURL(), voice: 700 },
      pebble: { name: 'Pebble', portrait: this.art.pebble.toDataURL(), voice: 860 },
      tuck: { name: 'Tuck', portrait: this.art.tuck.toDataURL(), voice: 620 },
      grim: { name: 'Grimfin', portrait: this.art.orca.toDataURL(), voice: 80 },
    };
    this.icons = { lantern: A.lantern().toDataURL(), boat: A.boat().toDataURL(), fish: A.bucket().toDataURL() };
    ui.setInventory(this.icons, this.inv);

    this.facing.add(makeCutout(this.art.hero, 0.95));
    this.hopper.add(this.facing);
    this.player.add(this.hopper);
    this.lanternLight.position.set(0.26, 0.5, 0.2);
    this.facing.add(this.lanternLight);
    this.player.visible = false;
    scene.add(this.player);
  }

  /** World-space point the camera and tilt-shift should follow. */
  get focusPoint() {
    return this.player.position;
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
    const pv = this.stand(L, art, h, toWorld(c[0], c[1], 0.09), delay);
    const cut = pv.userData.inner as THREE.Group;
    pv.userData.act = id;
    L.actors.set(id, pv);
    L.actorCell.set(id, c);
    L.pick.push(cut.userData.front);
    if (idle) L.idlers.push({ obj: cut, phase: rand() * 6, kind: idle });
    return pv;
  }

  private tent(L: Level, c: Cell, color: string, delay: number) {
    const w = 0.78, len = 0.6, d = 0.78;
    const theta = Math.acos(w / 2 / len);
    const mat = paperMat(color);
    const mk = (sign: number) => {
      const geo = new THREE.PlaneGeometry(len, d);
      geo.rotateX(-Math.PI / 2);
      geo.translate((sign * len) / 2, 0, 0);
      const m = new THREE.Mesh(geo, mat.clone());
      (m.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
      m.castShadow = m.receiveShadow = true;
      m.position.x = -sign * (w / 2);
      return m;
    };
    const a = mk(1), b = mk(-1);
    const g = new THREE.Group();
    g.add(a, b);
    g.position.copy(toWorld(c[0], c[1], 0.09));
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
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, height, 6), paperMat('#7a5a3a'));
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

  private build(index: number): Level {
    const def = LEVELS[index];
    const night = def.night;
    const root = new THREE.Group();
    this.scene.add(root);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff5a3c, transparent: true, opacity: 0.8, depthWrite: false });
    const L: Level = {
      index, def, root, grid: def.map.map((r) => r.split('')), start: [1, 1], pops: [], pick: [],
      items: new Map(), actors: new Map(), actorCell: new Map(), idlers: [], rings: new Map(), ringMat, shadows: [],
    };
    const snow = night ? ['#bfcde3', '#b8c8e0', '#c6d1e6'] : ['#f6f7f8', '#edf2f7', '#f7f4ec'];
    const water = night ? ['#23497a', '#1f4371', '#295382'] : ['#5a9ad0', '#5293cb', '#64a3d6'];
    const wood = new THREE.MeshStandardMaterial({ map: canvasTex(A.planks()), roughness: 0.85 });
    const tileDelay = (x: number, z: number) => (Math.abs(x - 5.5) - 0.5) * 110 + z * 18;

    for (let z = 0; z < ROWS; z++) {
      for (let x = 0; x < COLS; x++) {
        const ch = L.grid[z][x];
        const c: Cell = [x, z];
        const p = toWorld(x, z);
        const wet = ch === '~' || ch === 'o' || ch === 'H';
        const thick = wet ? 0.03 : 0.09;
        const mat = ch === 'D' ? wood : paperMat(pick(wet ? water : snow));
        const mesh = new THREE.Mesh(tileGeometry(0.97, thick, 0.97), mat);
        const side = p.x < 0 ? -1 : 1;
        mesh.position.set(side * 0.5, thick / 2, 0);
        mesh.rotation.y = (rand() - 0.5) * 0.03;
        mesh.receiveShadow = true;
        mesh.castShadow = !wet;
        mesh.userData.cell = c;
        const hinge = new THREE.Group();
        hinge.position.set(p.x - side * 0.5, 0, p.z);
        hinge.add(mesh);
        root.add(hinge);
        L.pick.push(mesh);
        const d = tileDelay(x, z);
        this.addPop(L, d, 520, easeInOut, (k) => {
          hinge.rotation.z = side * Math.PI * (1 - k);
        });
        const later = d + 380;
        const jitter = () => new THREE.Vector3((rand() - 0.5) * 0.12, 0, (rand() - 0.5) * 0.12);

        switch (ch) {
          case '~': {
            if (rand() < 0.6) {
              const pv = this.stand(L, A.wave(night), 0.3, p.clone().add(new THREE.Vector3((rand() - 0.5) * 0.3, 0.02, 0.3)), later, 3);
              L.idlers.push({ obj: pv.userData.inner, phase: rand() * 6, kind: 'wave' });
            }
            break;
          }
          case 'o': {
            const shape = new THREE.Shape();
            const n = 8;
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
            fg.position.copy(p).setY(0.03);
            fg.add(floe);
            const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.33, 28).rotateX(-Math.PI / 2), ringMat);
            ring.position.y = 0.095;
            ring.visible = false;
            fg.add(ring);
            L.rings.set(key(c), ring);
            root.add(fg);
            L.pick.push(floe);
            this.addScale(L, fg, later);
            L.idlers.push({ obj: floe, phase: rand() * 6, kind: 'float' });
            break;
          }
          case 'H': {
            const ice = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.44, 20).rotateX(-Math.PI / 2), paperMat('#e8f1fa'));
            ice.position.copy(p).setY(0.04);
            ice.receiveShadow = true;
            ice.userData.act = 'hole';
            root.add(ice);
            L.pick.push(ice);
            this.addScale(L, ice, later);
            const flag = this.stand(L, A.flag(), 0.5, p.clone().add(new THREE.Vector3(0.3, 0.03, -0.25)), later + 80, 4);
            flag.userData.act = 'hole';
            L.pick.push((flag.userData.inner as THREE.Group).userData.front);
            L.actors.set('hole', flag);
            L.actorCell.set('hole', c);
            break;
          }
          case '#': {
            const art = night ? A.iceberg(x * 31 + z) : A.rock(x * 17 + z);
            const pv = this.stand(L, art, night ? 1.25 : 0.85, p.clone().add(jitter()).setY(0.09), later);
            pv.userData.cell = c;
            L.pick.push((pv.userData.inner as THREE.Group).userData.front);
            break;
          }
          case '^':
            this.tent(L, c, night ? '#d3deef' : '#ffffff', later);
            break;
          case 'I': {
            const pv = this.stand(L, A.igloo(), 0.95, p.clone().setY(0.09), later);
            pv.userData.cell = c;
            L.pick.push((pv.userData.inner as THREE.Group).userData.front);
            break;
          }
          case 'A':
            this.actor(L, 'pip', this.art.pip, 0.82, c, later, 'waddle');
            break;
          case 'B':
            this.actor(L, 'pebble', this.art.pebble, 0.78, c, later, 'waddle');
            break;
          case 'T': {
            const pv = this.actor(L, 'tuck', this.art.tuckSad, 0.78, c, later, 'waddle');
            const happy = makeCutout(this.art.tuck, 0.78);
            happy.visible = false;
            pv.add(happy);
            pv.userData.faces = [pv.userData.inner, happy];
            L.pick.push(happy.userData.front);
            const cage = this.stand(L, A.cage(), 0.95, toWorld(x, z, 0.09).add(new THREE.Vector3(0, 0, 0.24)), later + 120);
            cage.userData.act = 'tuck';
            L.pick.push((cage.userData.inner as THREE.Group).userData.front);
            L.actors.set('cage', cage);
            break;
          }
          case 'E':
            this.actor(L, 'boat', A.boat(), 0.62, c, later, null);
            break;
          case 'L':
          case 'S':
          case 'F': {
            const it = ITEMS[ch];
            const pv = this.stand(L, it.art(), it.h, p.clone().setY(0.09), later);
            L.items.set(key(c), { id: it.id, name: it.name, obj: pv });
            L.idlers.push({ obj: pv.userData.inner, phase: rand() * 6, kind: 'bob' });
            break;
          }
          case 'D':
            this.stand(L, A.post(), 0.55, p.clone().add(new THREE.Vector3(0.36, 0.09, -0.36)), later);
            break;
          case 'P':
            L.start = c;
            break;
        }
      }
    }

    // scenery flats along the back edge of the spread
    if (!night) {
      this.stand(L, A.mountainsBack(), 2.5, new THREE.Vector3(0, 0, -4.5), 900, 5);
      this.stand(L, A.mountainsFront(), 1.6, new THREE.Vector3(0.4, 0, -4.32), 1020, 5);
      this.onStick(L, A.sun(), 1.1, -4.3, -4.15, 2.7, 1150);
      this.onStick(L, A.cloud(), 0.55, 1.6, -4.2, 2.6, 1250);
      this.onStick(L, A.cloud(), 0.45, 4.3, -4.25, 3.0, 1320);
    } else {
      const cliff = this.stand(L, A.cliff(), 3.2, new THREE.Vector3(3.15, 0, -4.5), 900, 5);
      this.onStick(L, A.moon(), 1.0, -4.2, -4.2, 2.8, 1100);
      const stars: [number, number, number][] = [[-2.6, 3.1, 0.32], [-0.8, 2.6, 0.26], [0.9, 3.3, 0.3], [-5.2, 2.0, 0.22]];
      stars.forEach(([sx, sy, sh], i) => this.onStick(L, A.star(), sh, sx, -4.3, sy, 1150 + i * 70));
      const sils: [HTMLCanvasElement, number][] = [[this.art.pip, -2.2], [this.art.hero, -0.6], [this.art.tuck, 0.9], [this.art.pebble, 2.3]];
      for (const [art, sx] of sils) {
        const sil = A.silhouette(art);
        const h = 2.3, w = (h * sil.width) / sil.height;
        const geo = new THREE.PlaneGeometry(w, h);
        geo.translate(0, h / 2, 0);
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: canvasTex(sil), transparent: true, opacity: 0.62, depthWrite: false }));
        const g = new THREE.Group();
        g.add(m);
        g.position.set(sx, 0.35, 0.05);
        g.scale.setScalar(0.001);
        cliff.add(g);
        L.shadows.push(g);
      }
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
    for (const b of beats) wait(b * 160).then(() => this.sound.fold(0.45));
    this.sound.rustle(1.5);
    return wait(end + 60);
  }

  private fold(L: Level) {
    const maxD = Math.max(...L.pops.map((p) => p.delay));
    let end = 0;
    const beats = new Set<number>();
    for (const p of L.pops) {
      const d = (maxD - p.delay) * 0.45;
      tween(p.dur * 0.6, (k) => p.set(1 - k), easeIn, d);
      end = Math.max(end, d + p.dur * 0.6);
      beats.add(Math.round((d + p.dur * 0.6) / 200));
    }
    for (const b of beats) wait(b * 200).then(() => this.sound.fold(0.4));
    return wait(end + 60);
  }

  // ---------------------------------------------------------------- chapters

  async playChapter(i: number) {
    if (this.level) this.scene.remove(this.level.root);
    const L = this.build(i);
    this.level = L;
    this.pos = [...L.start];
    this.player.position.copy(toWorld(L.start[0], L.start[1], 0.09));
    this.player.visible = true;
    this.addUp(L, this.player, 520);
    this.ui.banner(L.def.title);
    this.ui.setObjective('');
    await this.unfold(L);
    if (i === 0) await this.introOne();
    else await this.introTwo();
    this.updateObjective();
    this.busy = false;
    await new Promise<void>((r) => (this.finish = r));
    this.busy = true;
    this.ui.setObjective('');
  }

  async closeChapter() {
    const L = this.level;
    if (!L) return;
    const orca = L.actors.get('orca');
    if (orca) orca.visible = false;
    this.hideRings();
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
    const { nar, pip, pebble } = this.S;
    this.initOrca();
    this.sound.growl();
    this.shake = 0.25;
    await this.orcaRise(this.orca.pos!);
    this.updateRings();
    await this.ui.say([
      [nar, 'Night fell across the page. Out on the dark water, something with a very tall fin was circling.'],
      [pebble, 'There! Tuck is on that iceberg, all the way across!'],
      [pip, "Hop from floe to floe, but never onto a floe with a red ring. That's where Grimfin will be next!"],
      [pebble, "If he's too close, toss a fish into the fishing hole by the little flag. Grimfin can never resist a fish."],
      [nar, 'Every hop you take, Grimfin swims one stroke. Click where you stand, or press Space, to wait a turn.'],
    ]);
  }

  private updateObjective() {
    const L = this.level;
    if (!L) return;
    if (L.index === 0) {
      if (!this.talked) return this.ui.setObjective('Talk to the penguins');
      const missing = ITEM_ORDER.filter((i) => !this.inv.has(i));
      if (missing.length) return this.ui.setObjective(`Find ${listNames(missing)} · ${3 - missing.length}/3`);
      return this.ui.setObjective('All packed! Head to the dock on the right edge →');
    }
    if (this.tuckFree) return this.ui.setObjective('');
    if (this.orca.distracted > 0) return this.ui.setObjective(`Grimfin is munching… ${this.orca.distracted} turns left`);
    return this.ui.setObjective('Cross the ice floes and free Tuck. Avoid the red rings!');
  }

  // ---------------------------------------------------------------- input

  click(ndc: THREE.Vector2) {
    const L = this.level;
    if (this.busy || this.ui.open || !L) return;
    this.ray.setFromCamera(ndc, this.camera);
    for (const h of this.ray.intersectObjects(L.pick, false)) {
      let o: THREE.Object3D | null = h.object;
      while (o && o.userData.act === undefined && o.userData.cell === undefined) o = o.parent;
      if (!o || !o.visible) continue;
      if (o.userData.act) return this.go(L.actorCell.get(o.userData.act)!, o.userData.act);
      return this.go(o.userData.cell as Cell);
    }
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

  private walkable(c: Cell) {
    const L = this.level!;
    if (c[0] < 0 || c[1] < 0 || c[0] >= COLS || c[1] >= ROWS) return false;
    return WALK.has(L.grid[c[1]][c[0]]);
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
    return ch === 'o' ? 0.11 : ch === '~' || ch === 'H' ? 0.03 : 0.09;
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
    const it = L.items.get(key(this.pos));
    if (it) this.pickup(it);
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

  private pickup(it: { id: string; name: string; obj: THREE.Group }) {
    const L = this.level!;
    L.items.delete(key(this.pos));
    L.grid[this.pos[1]][this.pos[0]] = '.';
    this.inv.add(it.id);
    this.ui.setInventory(this.icons, this.inv);
    this.sound.chime();
    this.ui.toast(`You found ${it.name}!`);
    const obj = it.obj;
    tween(520, (k) => {
      obj.position.y = 0.09 + k * 0.9;
      obj.scale.setScalar(Math.max(0.001, 1 - k));
      obj.rotation.y = k * Math.PI * 2;
    }, easeIn).then(() => L.root.remove(obj));
    if (it.id === 'lantern') {
      const cut = makeCutout(A.lantern(), 0.32, 5);
      cut.position.set(0.3, 0.22, 0.05);
      this.facing.add(cut);
    }
    this.updateObjective();
  }

  private interact(act: string) {
    switch (act) {
      case 'pip':
      case 'pebble':
        return this.talk(act);
      case 'tuck':
        return this.tuckFree ? this.ui.say([[this.S.tuck, 'Thank you, thank you!']]) : this.finale();
      case 'hole':
        return this.tossFish();
      case 'boat':
        return this.ui.say([[this.S.pebble, "That's our boat. Once Tuck is free, we'll paddle over and fetch you both!"]]);
    }
  }

  private async hopActor(id: string, c: Cell) {
    const L = this.level!;
    const pv = L.actors.get(id)!;
    const from = pv.position.clone();
    const to = toWorld(c[0], c[1], 0.09);
    const hops = Math.max(1, Math.round(from.distanceTo(to) / 0.8));
    for (let h = 0; h < hops; h++) {
      const a = from.clone().lerp(to, h / hops), b = from.clone().lerp(to, (h + 1) / hops);
      this.sound.step();
      await tween(200, (k) => {
        pv.position.lerpVectors(a, b, k);
        pv.position.y += Math.sin(Math.PI * k) * 0.2;
      }, linear);
    }
    L.actorCell.set(id, c);
  }

  // ---------------------------------------------------------------- chapter one

  private async talk(who: string) {
    const { pip, pebble } = this.S;
    const L = this.level!;
    if (L.index === 1) {
      const lines: Line[][] = [
        [[pip, 'Watch the red rings. Grimfin always swims to the next one.']],
        [[pebble, 'The fishing hole is just below me, by the flag. One fish keeps him busy for a dozen hops!']],
        [[pip, 'Be brave! Tuck is counting on you.']],
      ];
      return this.ui.say(lines[this.chat++ % lines.length]);
    }
    if (!this.talked) {
      this.talked = true;
      await this.ui.say([
        [pip, 'Oh! A visitor! Please, you have to help us!'],
        [pebble, 'Grimfin the orca snatched our friend Tuck and carried him off to his cove!'],
        [pip, "It's dark out there, and Grimfin is fierce. You'll need a lantern to see by,"],
        [pebble, '...a paper boat to sail across,'],
        [pip, '...and fish! Grimfin can never, ever resist a fish.'],
        [pebble, "Find all three, then meet us at the dock and we'll set sail!"],
      ]);
      this.updateObjective();
      return;
    }
    const missing = ITEM_ORDER.filter((i) => !this.inv.has(i));
    const hints: Record<string, Line> = {
      lantern: [pip, 'I saw a lantern glowing near the top of the page, between the rocks and the hills.'],
      boat: [pebble, 'I folded a paper boat and left it on the shore, past the igloo at the bottom left.'],
      fish: [pip, "The fish bucket is down by the rocks on the right. Don't eat them all!"],
    };
    if (!missing.length) return this.ui.say([[who === 'pip' ? pip : pebble, 'You found everything! To the dock on the right!']]);
    return this.ui.say([[who === 'pip' ? pip : pebble, `Still looking for ${listNames(missing)}?`], hints[missing[0]]]);
  }

  private async atDock() {
    const { nar, pip, pebble } = this.S;
    if (!this.talked) {
      await this.ui.say([[nar, 'The little dock creaks over the cold water. Perhaps those penguins know where you are headed.']]);
      return;
    }
    const missing = ITEM_ORDER.filter((i) => !this.inv.has(i));
    if (missing.length) {
      await this.ui.say([[pip, `Not yet! We still need ${listNames(missing)}.`]]);
      return;
    }
    this.busy = true;
    await Promise.all([this.hopActor('pip', [10, 3]), this.hopActor('pebble', [10, 5])]);
    const choice = await this.ui.ask(pebble, "Lantern, boat and fish, all packed! Shall we set sail for Grimfin's Cove?", ['Set sail!', 'Not yet']);
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
    const path: (Cell | null)[] = [];
    for (let x = 3; x <= 8; x++) path.push([x, 2]);
    path.push(null, null);
    for (let x = 8; x >= 3; x--) path.push([x, 5]);
    path.push(null, null);
    this.orca = { path, i: 4, pos: path[4], distracted: 0 };
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

  private async orcaTurn(): Promise<boolean> {
    const o = this.orca;
    if (o.distracted > 0) {
      o.distracted--;
      if (o.distracted === 0) {
        await this.orcaDive();
        o.pos = null;
        o.i = 7;
        this.ui.toast('Grimfin finished his fish… and he is still hungry.');
      } else {
        this.orcaInner.rotation.z = o.distracted % 2 ? 0.07 : -0.07;
        this.sound.blip(120);
      }
      this.updateRings();
      this.updateObjective();
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
    if (o.distracted > 0 || this.tuckFree) return;
    const next = o.path[(o.i + 1) % o.path.length];
    if (!next) return;
    for (const [k, ring] of L.rings) {
      const [x, z] = k.split(',').map(Number);
      if (manhattan([x, z], next) <= 1) ring.visible = true;
    }
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
    const s = this.level!.start;
    this.pos = [...s];
    this.player.position.copy(toWorld(s[0], s[1], 0.09));
    pv.position.copy(from);
    inner.rotation.z = 0;
    await tween(360, (k) => this.player.scale.setScalar(Math.max(0.001, k)), easeOutBack);
    await this.ui.say([[grim, pick([
      'HAR! Off my floes, little paper thing!',
      'Splash! Back to the shore with you!',
      'Nobody sneaks past Grimfin! HAR HAR HAR!',
    ])]]);
    await this.orcaDive();
    this.orca.pos = null;
    this.orca.i = 6;
    this.updateRings();
    this.updateObjective();
    this.busy = false;
  }

  private async tossFish() {
    this.busy = true;
    const L = this.level!;
    const hole = L.actorCell.get('hole')!;
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
    if (o.pos && o.distracted === 0) await this.orcaDive();
    const fresh = o.distracted === 0;
    o.distracted = 12;
    o.pos = hole;
    if (fresh) {
      await this.orcaRise(hole);
      this.orcaInner.scale.x = 1;
    }
    this.ui.toast('Munch munch munch… Grimfin is busy!');
    this.updateRings();
    this.updateObjective();
    this.busy = false;
  }

  // ---------------------------------------------------------------- finale

  private async finale() {
    this.busy = true;
    this.tuckFree = true;
    this.hideRings();
    this.updateObjective();
    const L = this.level!;
    const { nar, pip, pebble, tuck, grim } = this.S;
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
    await this.orcaRise([8, 2]);
    this.orcaInner.scale.x = 1;
    o.pos = [8, 2];
    await this.ui.say([
      [grim, 'HAR! Leaving so soon?'],
      [grim, "Nobody leaves Grimfin's cove. Not you, and not your squeaky little friend!"],
    ]);
    await this.ui.ask(nar, 'Grimfin rears up out of the black water. The lantern flickers in your mittens…', ['Raise the lantern high!']);

    this.sound.flare();
    this.shake = 0.3;
    tween(700, (k) => {
      this.hopper.position.y = k * 0.35;
      this.lanternPower = 1 + k * 5;
    }, easeOut);
    tween(900, (k) => (this.camLift = k), easeInOut);
    L.shadows.forEach((s, i) => tween(1000, (k) => s.scale.setScalar(Math.max(0.001, k)), easeOutBack, 300 + i * 160));
    await wait(1700);
    await this.ui.say([
      [grim, 'W-w-what?! A GIANT penguin army?!'],
      [grim, 'I just remembered I have to be fierce somewhere else. Very far away. Goodbye!'],
    ]);
    const pv = this.orcaPv, inner = this.orcaInner;
    const z0 = pv.position.z;
    this.sound.splash();
    inner.scale.x = -1;
    await tween(1000, (k) => {
      pv.position.z = z0 - k * 1.5;
      pv.position.x -= 0.02;
      inner.position.y = SURFACE + (DEEP - SURFACE) * k;
    }, easeIn);
    pv.visible = false;
    o.pos = null;
    await tween(900, (k) => {
      this.hopper.position.y = 0.35 * (1 - k);
      this.lanternPower = 6 - 5 * k;
      L.shadows.forEach((s) => s.scale.setScalar(Math.max(0.001, 1 - k)));
      this.camLift = 1 - k;
    }, easeInOut);

    // Pip and Pebble paddle over
    const boat = L.actors.get('boat')!;
    const bc = L.actorCell.get('boat')!;
    await Promise.all([this.hopActor('pip', bc), this.hopActor('pebble', bc)]);
    const pipPv = L.actors.get('pip')!, pebPv = L.actors.get('pebble')!;
    const b0 = boat.position.clone();
    const b1 = toWorld(8, 4, 0.03);
    this.sound.rustle(1);
    await tween(2400, (k) => {
      boat.position.lerpVectors(b0, b1, k);
      boat.position.y += Math.abs(Math.sin(k * Math.PI * 5)) * 0.05;
      pipPv.position.copy(boat.position).add(new THREE.Vector3(-0.18, 0.12, 0.02));
      pebPv.position.copy(boat.position).add(new THREE.Vector3(0.18, 0.12, 0.04));
    }, easeInOut);
    const spots = ([[9, 4], [9, 2], [10, 2], [9, 3], [9, 1]] as Cell[]).filter((c) => !same(c, this.pos));
    await Promise.all([this.hopActor('pip', spots[0]), this.hopActor('pebble', spots[1])]);

    await this.ui.say([
      [pip, 'TUCK!'],
      [pebble, 'We knew you could do it!'],
      [tuck, 'Thank you, friend. You were braver than a whole army of penguins.'],
      [pip, '...even a GIANT one.'],
    ]);
    this.sound.chime([0, 4, 7, 12, 7, 12, 16, 19]);
    const jumpers = [pipPv, pebPv, tuckPv, this.player];
    for (let j = 0; j < 3; j++) {
      await Promise.all(jumpers.map((pvj, i) => {
        const y0 = pvj.position.y;
        return tween(300, (k) => (pvj.position.y = y0 + Math.sin(Math.PI * k) * 0.25), linear, i * 60);
      }));
    }
    await this.ui.say([[nar, 'And so, with a lantern held high and three paper penguins at your side, you sailed home across the folded sea.']]);
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
      }
    }
    const flicker = 1 + Math.sin(t * 13) * 0.04 + Math.sin(t * 7.3) * 0.05;
    const base = this.inv.has('lantern') ? (L.def.night ? 2.6 : 0.6) : 0;
    this.lanternLight.intensity = base * this.lanternPower * flicker;
    const orca = L.actors.get('orca');
    if (orca) orca.position.y = Math.sin(t * 1.6) * 0.03;
    L.ringMat.opacity = 0.55 + 0.3 * Math.sin(t * 6);
    this.shake *= 0.9;
  }
}
