// Chapter maps, 24 columns by 14 rows; the spine runs between columns 11 and 12.
//   .  snow            ~  water          o  ice floe (walkable)
//   #  rock / iceberg  ^  snow hill      =  raised snowbank
//   Y  snowy pine      I  igloo          K  ice block (push it)
//   A  Pip             B  Pebble         T  Tuck in his cage
//   U  Auntie Puffin   Q  Bobble the seal pup
//   S  paper boat      b  Bobble's ball  *  paper star
//   D  dock            E  moored boat    H  fishing hole
//   P  where you start

export type Cell = [number, number];

export interface LevelDef {
  title: string;
  night: boolean;
  map: string[];
  /** Where Pip and Pebble wait when you reach the dock. */
  dockFriends?: [Cell, Cell];
  /** Grimfin swims each lane [row, fromCol, toCol] in turn, diving for two turns between. */
  orca?: { lanes: [number, number, number][]; start: number };
  finale?: { orcaRise: Cell; boatTo: Cell; spots: Cell[] };
}

export const LEVELS: LevelDef[] = [
  {
    title: 'Chapter One · The Snowy Shore',
    night: false,
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
    night: true,
    map: [
      '~~~~~~~~~~~~~~~~~~~~~~~~',
      '~^..~~~~~~~~~~~~~~~~..^~',
      '~A..~~~~~~~~~~~~~~~~#..~',
      '~...~~~~~~~~~~~~~~~~...~',
      '~B..~~~~~~~~~~~~~~~~.#.~',
      '~...oooooo~~~~~~~~~~...~',
      '~..Po~~~~oo..~~~~~~~...~',
      '~...~~~~~~~..o~~~~oo.T.~',
      '~...~~~~~~~H~oooooo~.#.~',
      '~E.Q~~~~~~~~~~~~~~~~...~',
      '~...H~~~~~~~~~~~~~~~...~',
      '~.^.~~~~~~~~~~~~~~~~.^.~',
      '~...~~~~~~~~~~~~~~~~#..~',
      '~~~~~~~~~~~~~~~~~~~~~~~~',
    ],
    orca: { lanes: [[4, 4, 10], [9, 19, 12]], start: 12 },
    finale: { orcaRise: [19, 6], boatTo: [19, 9], spots: [[20, 6], [20, 8], [22, 6], [22, 8], [20, 5]] },
  },
];
