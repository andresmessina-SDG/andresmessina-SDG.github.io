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
// The glacier (chapter two) and the party (chapter five):
//   _  slick ice: you slide until you bump into something     +  paper star on the ice
//   W  Grandpa Walrus  F  Mama Fox       k  a fox kit hiding behind a snowdrift
//   e  the walrus's spectacles (on the ice)                   X  the far side of the glacier
//   t  Tuck, free      n  a piece of party bunting            r  a snowberry bush
//   m  a snowman
import type { Cell, Lane } from './rules';

export type { Cell };

export type ChapterId = 'shore' | 'glacier' | 'cove' | 'fog' | 'party';

export interface LevelDef {
  id: ChapterId;
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
  /** The party: where Grimfin watches from, and where everyone gathers at the end. */
  party?: { orcaWatch: Cell; orcaDock: Cell; garland: Cell; cake: Cell; gather: Cell[] };
}

export const LEVELS: LevelDef[] = [
  {
    id: 'shore',
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
    id: 'glacier',
    title: 'Chapter Two · The Glittering Glacier',
    titleRu: 'Глава вторая · Сверкающий ледник',
    night: false,
    mode: 'walk',
    water: '~oHDv%',
    map: [
      '~~~~~~~~~~~~~~~~~~~~~~~~',
      '~Y..+______=___________~',
      '~.F.__Y___#=______Y__..~',
      '~....#________*___#=_.Y~',
      '~^.._______=___.k____..~',
      '~...______==_Y_=_#_#_.k~',
      '~...______#=_______#...~',
      '~P..__#____=_##_____..X~',
      '~...__=______#______...~',
      '~.W.____.__=Y___#_e__..~',
      '~Y..______#=______Y__..~',
      '~..._______=_#__#___.Y.~',
      '~^kY~~~~_____##____+~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~',
    ],
    dockFriends: [[22, 6], [22, 8]],
  },
  {
    id: 'cove',
    title: "Chapter Three · Grimfin's Cove",
    titleRu: 'Глава третья · Бухта Гримфина',
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
    id: 'fog',
    title: 'Chapter Four · The Way Home',
    titleRu: 'Глава четвёртая · Дорога домой',
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
  {
    id: 'party',
    title: 'Chapter Five · The Welcome-Home Party',
    titleRu: 'Глава пятая · Праздник в честь возвращения',
    night: false,
    mode: 'walk',
    water: '~oHDv%',
    map: [
      '~~~~~~~~~~~~~~~~~~~~~~~~',
      '~n.Y..r..^^..m....Y.n.~~',
      '~..........Y.....I....~~',
      '~..F............U....*~~',
      '~*...Y................~~',
      '~.........B........W..~~',
      '~.m.....A...t..#.....Y~~',
      '~..K................r.~~',
      '~.................~~~~~~',
      '~~~~~~~Q.........D~~~~~~',
      '~~~n~~~....P....m.~~~~~~',
      '~~~~~~~.......r...~~~~~~',
      '~~~~~~#...*..Y....~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~',
    ],
    party: {
      orcaWatch: [20, 11],
      orcaDock: [18, 9],
      garland: [10, 3],
      cake: [11, 7],
      gather: [[16, 8], [15, 9], [15, 8], [14, 9], [16, 7], [14, 8], [13, 9], [15, 7], [13, 8], [12, 9]],
    },
  },
];
