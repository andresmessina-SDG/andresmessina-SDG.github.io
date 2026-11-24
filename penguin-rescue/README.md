# The Penguin Rescue

A small pop-up book adventure in Three.js. Two paper penguins, Pip and Pebble,
ask you to rescue their friend Tuck from Grimfin, an orca in a pirate hat.

Each chapter is a 24 by 14 board across the whole spread, and the camera
follows you around the open book.

- **Chapter One, The Snowy Shore.** An open little world with quests in any
  order. Pip gives you a lantern. Push an ice block into the water to make a
  stepping-stone to the island where the paper boat blew away. Optionally,
  use the lantern to search the dark igloo for Auntie Puffin's yarn (she pays
  you in fish), and build a second ice bridge across the pond to fetch Bobble
  the seal pup's ball (he promises to splash Grimfin once). Eight paper stars
  are hidden around the page.
- **Chapter Two, Grimfin's Cove.** Night. Cross the bay in two legs, resting
  on the island halfway, and free Tuck. Grimfin swims one stroke for every hop
  you take and looks ahead through his spyglass (the glowing squares show
  where he will look next). If he spots you, a "!" pops up and he charges
  next turn unless you get out of sight: behind a little sea iceberg, onto
  land, or out of his view. Red rings mark where he can reach. Tossing a fish
  in a fishing hole keeps him busy for six hops.
- **Chapter Three, The Way Home.** Sail the paper boat through Grimfin's fog.
  The lantern clears the fog around you. Wake three sleepy lighthouses: each
  one clears the fog for good and keeps Grimfin away from its light. With all
  three awake, the harbour gate opens. Collect floating fish crates on the way.
- **Finale.** Raise the lantern and the shadows of everyone you helped tower
  over Grimfin, then morning comes.

**The lantern:** press L (or the lantern button) to cover it. Grimfin can then
only spot you up close, but glowing stars at night only appear in uncovered
lantern light. **Gentle mode** on the title screen gives younger players a
kinder Grimfin: he sees one cell less, and always shouts before he grabs.

Controls: click or tap to walk, sail, talk or push; hovering shows where a click goes;
arrow keys or WASD to step; Space to continue dialogue or wait a turn; L to cover the
lantern; F to toss a fish; M to mute. In the Grimfin chapters, round buttons in the
bottom-right corner do the same: wait a turn, cover the lantern, toss a fish.

**Phones and tablets.** Tap to walk, and tap anywhere to read on. The to-do list
folds down to the next step (tap it to see everything). The top-right button
goes fullscreen and, on a phone, holds the book sideways (iPhone Safari has no
fullscreen for pages; use Share, Add to Home Screen instead). Touch devices get a
lighter renderer, and on any device the picture steps down on its own (fewer
pixels, then no glow) if the frame rate stays under 45. Add `?quality=high` to the
address to turn that off.

**Languages.** English and Russian, picked on the title card and remembered.
The first visit follows the browser's language, and `?lang=ru` or `?lang=en`
forces one. Story text sits beside its translation in the code as
`tr('English', 'Русский')`; the page's labels are in `src/i18n.ts`.

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
| `src/terrain.ts` | The board as cut paper: per-page sheets for water (with shallows), a shadowed rim, snow, and terraced snowbanks, with wobbly hand-cut coastlines that fold out from the spine |
| `src/weather.ts` | Falling paper snowflakes around the camera |
| `src/game.ts` | Board building, pop-up animations, walking, ice blocks, quests, Grimfin's patrol and the story |
| `src/levels.ts` | The three chapter maps as text grids, plus Grimfin's swim lanes, checkpoints and finale positions |
| `src/rules.ts` | Grimfin's rules (swim lanes, spyglass view, spotting, charging, lighthouse safe zones), shared by the game and the map solver |
| `src/audio.ts` | Web Audio: paper rustles, fold snaps, page turns, footsteps, splashes, voices, and a music-box score for day and night |
| `src/fx.ts` | Bloom on the lantern and moon, tilt-shift blur that follows the hero, and a warm grade, vignette and grain |
| `src/ui.ts` | Dialogue, choices, objective label, inventory, toasts |
| `src/i18n.ts` | English and Russian: language choice, the page's labels, and Russian plurals |

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
