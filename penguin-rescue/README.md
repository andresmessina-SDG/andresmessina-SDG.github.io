# The Penguin Rescue

A small pop-up book adventure in Three.js. Two paper penguins, Pip and Pebble,
ask you to rescue their friend Tuck from Grimfin, an orca in a pirate hat.

- **Chapter One, The Snowy Shore.** An open little world with quests in any
  order. Pip gives you a lantern. Push an ice block into the water to make a
  stepping-stone to the island where the paper boat blew away. Optionally,
  use the lantern to search the dark igloo for Auntie Puffin's yarn; she pays
  you in fish. Five paper stars are hidden around the page.
- **Chapter Two, Grimfin's Cove.** Night. Hop across the ice floes to Tuck's
  cage. Grimfin swims one stroke for every hop you take; a red ring marks the
  floes beside where he will be next. Each fish you toss in the fishing hole
  keeps him busy for six hops, or you can time your crossing without any.
- **Finale.** Raise the lantern and the shadows of everyone you helped tower
  over Grimfin. Help Auntie Puffin and she joins the shadow army.

Controls: click or tap to walk, talk or push; hovering shows where a click goes; arrow keys or WASD to step;
Space to continue dialogue or to wait a turn; M to mute.

## Run it

Needs Node 20.19+ or 22.12+.

```bash
cd penguin-rescue
npm install
npm run dev
```

Then open the address Vite prints (http://localhost:5173 by default).

Build for the site:

```bash
npm run build
```

This type-checks and writes the game to `../games/penguin-rescue/`. Once that
folder is on the default branch, GitHub Pages serves it at
`https://andresmessina-sdg.github.io/games/penguin-rescue/`.
`npm run preview` serves the build locally.

Add `?debug` to the URL to expose the game object as `window.__game`, which
the automated play-through uses.

## How it is made

Everything is generated at runtime. There are no image or sound files yet.

| File | What it does |
|---|---|
| `src/paper.ts` | Tileable paper-fibre texture (also the bump map), paper materials, and die-cut stand-ups: art with a white cut border, an edge line, paper grain and a plain mirrored back |
| `src/art.ts` | Every character, prop and scenery flat, drawn as layered cut paper in canvas |
| `src/book.ts` | The table, the hard-cover book that opens and closes, and the page that curls over between chapters |
| `src/game.ts` | Board building, hinged tiles that unfold from the spine, pop-up animations, walking, Grimfin's patrol and the story |
| `src/levels.ts` | The two chapter maps as text grids |
| `src/audio.ts` | Web Audio: paper rustles, fold snaps, page turns, footsteps, splashes, voices, and a music-box score for day and night |
| `src/fx.ts` | Tilt-shift blur that follows the hero, plus a warm grade, vignette and grain |
| `src/ui.ts` | Dialogue, choices, objective label, inventory, toasts |

## Swapping in real assets (Blender and image generation)

The procedural art stands in for the full asset pipeline:

1. **Reference.** Collect photos of real pop-up books and paper dioramas as
   private reference. Don't ship them.
2. **Concept frames and textures.** Generate concept frames for a tilt-shift
   papercraft diorama, plus paper textures and printed details. A paper
   texture replaces `paperCanvas()` in `paper.ts`; character art replaces the
   functions in `art.ts`. `makeCutout()` accepts any canvas or image drawn to
   a canvas, so a PNG with transparency drops straight in.
3. **Blender.** Model hinged tiles with their pivots on the spine-side edge,
   the V-fold hills, and the characters. Bake paper materials, animate the
   folds, and export glTF. Load the files with `GLTFLoader` in `game.ts` in
   place of the meshes made in `build()`. Keep the same pivots, so the
   existing unfold code drives the imported tiles.
4. **Sound.** Recorded paper foley can replace any method in `audio.ts`. Keep
   the method names, and nothing else changes.
