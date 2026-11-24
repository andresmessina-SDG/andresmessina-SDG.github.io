// Chapter maps, 12 columns by 8 rows; the spine runs between columns 5 and 6.
//   .  snow            ~  water          o  ice floe (walkable)
//   #  rock / iceberg  ^  snow hill      I  igloo
//   A  Pip             B  Pebble         T  Tuck in his cage
//   L  lantern         S  paper boat     F  fish bucket
//   D  dock            E  moored boat    H  fishing hole
//   P  where you start

export interface LevelDef {
  title: string;
  night: boolean;
  map: string[];
}

export const LEVELS: LevelDef[] = [
  {
    title: 'Chapter One · The Snowy Shore',
    night: false,
    map: [
      '~~~~~~~~~~~~',
      '~~#..L..^^.~',
      '~...^....#.~',
      '~.I...A.B..~',
      '~..#.......D',
      '~.^^..#..F.~',
      '~S.....P..^~',
      '~~~~~~~~~~~~',
    ],
  },
  {
    title: "Chapter Two · Grimfin's Cove",
    night: true,
    map: [
      '~~~~~~~~~~~~',
      '~^.~~~~~~.^~',
      '~A.~~~~~~..~',
      '~.Poo~ooo.T~',
      '~B.~ooo~~.#~',
      '~E.~~~~~~#.~',
      '~..H~~~~~..~',
      '~~~~~~~~~~~~',
    ],
  },
];
