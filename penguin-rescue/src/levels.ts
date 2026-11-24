// Chapter maps, 24 columns by 14 rows; the spine runs between columns 11 and 12.
//   .  snow / land     ~  water          o  ice floe (walkable)
//   #  rock / iceberg  ^  snow hill      =  raised snowbank
//   Y  snowy pine      I  igloo          K  ice block (push it)
//   v  sea iceberg: blocks the way and hides you from Grimfin
//   A  Pip             B  Pebble         T  Tuck in his cage
//   U  Auntie Puffin   Q  Bobble the seal pup
//   S  paper boat      b  Bobble's ball  *  paper star     %  paper star on a floe
//   D  dock            E  moored boat    H  fishing hole
//   L  sleepy lighthouse (chapter three)  c  floating fish crate
//   g  harbour gate    G  home harbour
//   P  where you start
import type { Cell, Lane } from './rules';

export type { Cell };

export interface LevelDef {
  title: string;
  titleRu: string;
  night: boolean;
  /** 'walk' on land and floes, or 'sail' the paper boat across open water. */
  mode: 'walk' | 'sail';
  /** Characters drawn as water rather than land. */
  water: string;
  map: string[];
  /** Where Pip and Pebble wait when you reach the dock. */
  dockFriends?: [Cell, Cell];
  /** Grimfin swims each lane in turn, diving for two turns between. */
  orca?: { lanes: Lane[]; start: number };
  /** Dry places a catch sends you back to; the farthest one you've passed is used. */
  checkpoints?: Cell[];
  finale?: { orcaRise: Cell; boatTo: Cell; spots: Cell[] };
}

export const LEVELS: LevelDef[] = [
  {
    title: 'Chapter One · The Snowy Shore',
    titleRu: 'Глава первая · Снежный берег',
    night: false,
    mode: 'walk',
    water: '~oHDv%',
    map: [
      '~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~*.....Y.==..^^...Y*.~~',
      '~.~~~~~..Q==.......Y..~~',
      '~.~~b~~.*.....A..B..#.~~',
      '~.~~~~~.I.==..........~~',
      '~...........==..#..U..~~',
      '~*...K....Y.....^^....~~',
      '~..#....^^.....#......D~',
      '~~~~...#.......Y.*..#.~~',
      '~~~~.K...==.........^*~~',
      '~~~~....*==...Y.......~~',
      '~~S~.......P.....#..*.~~',
      '~~~~..^^.......~~~..Y.~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~',
    ],
    dockFriends: [[21, 6], [21, 8]],
  },
  {
    title: "Chapter Two · Grimfin's Cove",
    titleRu: 'Глава вторая · Бухта Гримфина',
    night: true,
    mode: 'walk',
    water: '~oHDv%',
    map: [
      '~~~~~~~~~~~~~~~~~~~~~~~~',
      '~^..~~~~~~~~~~~~~~~~..^~',
      '~A..~~~~~~~~~~~~~~~~#..~',
      '~...~~~~~~~~~~~~~~~~...~',
      '~B..~~~~~~~~~~~~~~~~.#.~',
      '~...%voooo~~~~~~~~~~...~',
      '~..Pooo~~oo..~~~~~~~...~',
      '~...~~~~~~~..oo~~ooo.T.~',
      '~...~~~~~~~H~~oooov%.#.~',
      '~E.Q~~~~~~~~~~~~~~~~...~',
      '~...H~~~~~~~~~~~~~~~...~',
      '~.^.~~~~~~~~~~~~~~~~.^.~',
      '~...~~~~~~~~~~~~~~~~#..~',
      '~~~~~~~~~~~~~~~~~~~~~~~~',
    ],
    orca: { lanes: [{ from: [4, 4], to: [10, 4] }, { from: [19, 9], to: [12, 9] }], start: 12 },
    checkpoints: [[3, 6], [11, 6]],
    finale: { orcaRise: [19, 6], boatTo: [19, 9], spots: [[20, 6], [20, 8], [22, 6], [22, 8], [20, 5]] },
  },
  {
    title: 'Chapter Three · The Way Home',
    titleRu: 'Глава третья · Дорога домой',
    night: true,
    mode: 'sail',
    water: '~vc*gGP',
    map: [
      '~~~~~~~~~~~~~~~~~~~~....',
      '~~~~~~~~~~~~~~~~~~~~.Y..',
      '~~*~~.Y.~~~~~~~~~~c~....',
      '~~~~~#.L~~~~~v~~~~~~.#..',
      '~~~~~~~~~~~~~~~~~~~~....',
      '~~~~~~~~~~~~~~~~~~v~.Y..',
      '~~~~~~~~~~~.L.~~~~~~..U.',
      '~~P~~~~~~~~#.Y~~~~~~g~G.',
      '~~~~~~~~~~~~~~~~~~~~..Y.',
      '~~~~v~~~~~~~~~~~~~~~#...',
      '~~~~~~~~~~~v~~~~.L.*....',
      '~~~~~~~~c~~~~~~~Y.#~.Y..',
      '~~~c~~~~~~~~~*~~~~~~....',
      '~~~~~~~~~~~~~~~~~~~~....',
    ],
    orca: { lanes: [{ from: [9, 1], to: [9, 12] }, { from: [15, 12], to: [15, 1] }], start: 3 },
    finale: { orcaRise: [19, 8], boatTo: [22, 7], spots: [[21, 6], [21, 8], [23, 7], [20, 8], [23, 8], [20, 6]] },
  },
];
