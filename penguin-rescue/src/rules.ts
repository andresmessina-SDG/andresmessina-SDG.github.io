// Grimfin's rules, kept free of rendering so the game and the map solver share them exactly.

export type Cell = [number, number];
export interface Lane {
  from: Cell;
  to: Cell;
}

export const manhattan = (a: Cell, b: Cell) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
export const same = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];

/** How far a lit lighthouse keeps Grimfin away, in steps. */
export const SAFE_RADIUS = 3;

export interface OrcaPath {
  /** One entry per turn; null means he is under water (diving between lanes). */
  cells: (Cell | null)[];
  /** The way he faces on that turn. */
  heads: Cell[];
  /** Index where each lane begins. */
  starts: number[];
}

/** Each lane is swum cell by cell, then he dives for two turns before the next. */
export function buildPath(lanes: Lane[]): OrcaPath {
  const cells: (Cell | null)[] = [];
  const heads: Cell[] = [];
  const starts: number[] = [];
  for (const { from, to } of lanes) {
    starts.push(cells.length);
    const dx = Math.sign(to[0] - from[0]), dz = Math.sign(to[1] - from[1]);
    const n = Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1]));
    for (let k = 0; k <= n; k++) {
      cells.push([from[0] + dx * k, from[1] + dz * k]);
      heads.push([dx, dz]);
    }
    cells.push(null, null);
    heads.push([dx, dz], [dx, dz]);
  }
  return { cells, heads, starts };
}

/**
 * Grimfin looks ahead through his spyglass: up to `range` cells forward, one cell either side.
 * Anything that blocks sight (land, rocks, sea icebergs) hides what is behind it in that line.
 */
export function sees(orca: Cell, head: Cell, target: Cell, range: number, blocks: (c: Cell) => boolean) {
  const rx = target[0] - orca[0], rz = target[1] - orca[1];
  const along = rx * head[0] + rz * head[1];
  // perpendicular offset: the component across the heading
  const perp = head[0] !== 0 ? rz : rx;
  if (along < 1 || along > range || Math.abs(perp) > 1) return false;
  for (let k = 1; k < along; k++) {
    const c: Cell = head[0] !== 0 ? [orca[0] + head[0] * k, target[1]] : [target[0], orca[1] + head[1] * k];
    if (blocks(c)) return false;
  }
  return true;
}

/** The cells Grimfin can see from where he is, for drawing his spyglass view. */
export function sightCells(orca: Cell, head: Cell, range: number, blocks: (c: Cell) => boolean) {
  const out: Cell[] = [];
  for (let along = 1; along <= range; along++) {
    for (let perp = -1; perp <= 1; perp++) {
      const c: Cell = head[0] !== 0 ? [orca[0] + head[0] * along, orca[1] + perp] : [orca[0] + perp, orca[1] + head[1] * along];
      if (!blocks(c) && sees(orca, head, c, range, blocks)) out.push(c);
    }
  }
  return out;
}

/** Turn toward the target along whichever axis is farther. */
export function faceToward(orca: Cell, target: Cell): Cell {
  const dx = target[0] - orca[0], dz = target[1] - orca[1];
  return Math.abs(dx) >= Math.abs(dz) ? [Math.sign(dx) || 1, 0] : [0, Math.sign(dz) || 1];
}

export interface OrcaState {
  i: number;
  pos: Cell | null;
  head: Cell;
  alert: boolean;
  distracted: number;
}

export interface TurnWorld {
  path: OrcaPath;
  player: Cell;
  /** Can Grimfin get you here (on a floe, or out on open water)? */
  exposed: boolean;
  range: number;
  gentle: boolean;
  blocks: (c: Cell) => boolean;
  /** Is this lane cell too close to a lit lighthouse for him to surface? */
  avoid: (c: Cell) => boolean;
}

export type TurnResult = 'none' | 'moved' | 'spotted' | 'lost' | 'caught' | 'munch' | 'done-munching';

/** Advance Grimfin by one turn. Mutates `o` and says what happened. */
export function orcaStep(o: OrcaState, w: TurnWorld): TurnResult {
  if (o.distracted > 0) {
    o.distracted--;
    if (o.distracted === 0) {
      o.pos = null;
      o.i = farLaneBefore(w.path, w.player);
      return 'done-munching';
    }
    return 'munch';
  }
  if (o.alert && o.pos) {
    // He saw you last turn and charges now, unless you slipped out of view.
    o.alert = false;
    const reach = w.gentle ? 1 : 2;
    if (w.exposed && (sees(o.pos, o.head, w.player, w.range, w.blocks) || manhattan(o.pos, w.player) <= reach)) return 'caught';
    return 'lost';
  }
  o.i = (o.i + 1) % w.path.cells.length;
  const next = w.path.cells[o.i];
  o.pos = next && !w.avoid(next) ? next : null;
  o.head = w.path.heads[o.i];
  if (!o.pos || !w.exposed) return 'moved';
  if (manhattan(o.pos, w.player) <= 1) {
    if (!w.gentle) return 'caught';
    o.alert = true;
    o.head = faceToward(o.pos, w.player);
    return 'spotted';
  }
  if (sees(o.pos, o.head, w.player, w.range, w.blocks)) {
    o.alert = true;
    o.head = faceToward(o.pos, w.player);
    return 'spotted';
  }
  return 'moved';
}

/** After a dive, he comes up at the start of the lane farthest from you (index just before it). */
export function farLaneBefore(path: OrcaPath, player: Cell) {
  let best = path.starts[0], bestD = -1;
  for (const s of path.starts) {
    const d = manhattan(path.cells[s]!, player);
    if (d > bestD) {
      bestD = d;
      best = s;
    }
  }
  return (best - 1 + path.cells.length) % path.cells.length;
}
