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
  the seal pup's ball (he promises to splash Grimfin once).
- **Chapter Two, The Glittering Glacier.** Slick ice: once you start sliding
  you don't stop until you bump into a rock, a snowbank or a snowy patch. Each
  click or tap is one slide, so crossing is a puzzle (eight slides at best; a
  solver checked that you can never get stuck). Side quests: Grandpa Walrus's
  spectacles slid out onto the ice (he gives you a sardine), and Mama Fox's
  three kits are hiding behind snowdrifts with their tails poking out (they
  help out at the party).
- **Chapter Three, Grimfin's Cove.** Night. Cross the bay in two legs, resting
  on the island halfway, and free Tuck. Grimfin swims one stroke for every hop
  you take and looks ahead through his spyglass (the glowing squares show
  where he will look next). If he spots you, a "!" pops up and he charges
  next turn unless you get out of sight: behind a little sea iceberg, onto
  land, or out of his view. Red rings mark where he can reach. Tossing a fish
  in a fishing hole keeps him busy for six hops.
- **Chapter Four, The Way Home.** Sail the paper boat through Grimfin's fog.
  The lantern clears the fog around you. Wake three sleepy lighthouses: each
  one clears the fog for good and keeps Grimfin away from its light. With all
  three awake, the harbour gate opens. Collect floating fish crates on the way.
  Raise the lantern and the shadows of everyone you helped tower over Grimfin,
  then morning comes.
- **Chapter Five, The Welcome-Home Party.** Find the scattered paper bunting
  (one piece needs an ice-block bridge, unless the fox kits sniffed it out for
  you) and hang it up. Then Tuck spots Grimfin watching the party through his
  spyglass, all alone. Invite him from the dock. Side quests: snowberries for
  Auntie Puffin's cake, and Tuck's present, hidden in one of three snowmen.

**The journal.** The to-do card in the corner shows what to do on this page,
with portraits and progress dots for side quests. Click it (or press J) for
the journal: a Story page with every chapter so far, and a Side quests page
with who asked, what for, the reward, and a DONE or MISSED stamp. A paper
card pops up when you start or finish a side quest.

**The lantern:** press L (or the lantern button) to cover it. Grimfin can then
only spot you up close, but glowing stars at night only appear in uncovered
lantern light. **Gentle mode** on the title screen gives younger players a
kinder Grimfin: he sees one cell less, and always shouts before he grabs.

Controls: click or tap to walk, sail, talk or push; hovering shows where a click goes;
arrow keys or WASD to step; Space to continue dialogue or wait a turn; L to cover the
lantern; F to toss a fish; Z to undo; J for the journal; M to mute. In the Grimfin chapters, round buttons in the
bottom-right corner do the same: wait a turn, cover the lantern, toss a fish.

**Undo.** In chapters with something to get wrong (Grimfin, the glacier ice, ice
blocks to push), the ⟲ button or Z takes back one move: where you stand, Grimfin,
the ice blocks and your fish. Hold it to keep rewinding. A slide across the ice
counts as one move, and a catch by Grimfin can be undone too. Undo can't reach back
past finding something (an item, a star, a crate), a conversation, or an ice block
sinking into a stepping-stone.

**Phones and tablets.** Tap to walk, and tap anywhere to read on. The to-do list
folds down to the next step (tap it to see everything). The top-right button
goes fullscreen and, on a phone, holds the book sideways (iPhone Safari has no
fullscreen for pages; use Share, Add to Home Screen instead). Touch devices get a
lighter renderer, and on any device the picture steps down on its own (fewer
pixels, then no glow) if the frame rate stays under 45. Add `?quality=high` to the
address to turn that off.

**Saving.** The game saves itself at the start of every chapter after the first (items,
fish, paper stars, who you helped, Gentle mode), in this browser only. The title
card then offers Continue, which opens the book at that chapter, or Start over,
which clears the save. Finishing the book clears it too.

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

Almost everything is generated at runtime. The exception is the cast: each
character is a layered pop-up model made in Blender (see "The cast" below).

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

## The cast (Blender)

The characters are pop-up figures in a pen-and-watercolour storybook style:
stacked layers of cut card with ink outlines and hatching, on a white die-cut
backing, drawn on real-animal proportions. They never turn in 3D. Like the
other stand-ups, they slide across the page facing the reader.

| File | What it does |
|---|---|
| `models/popup.py` | The drawing kit: cut card with a paper core, watercolour wash, nib-weight pen lines and hatching |
| `models/cast.py` | Every character, plus preview renders (`models/cast/`) and `cast.blend` |
| `models/bake.py` | Bakes each character's paper look into one texture on a single simplified mesh, and writes `models/baked/<name>.glb` |

To rebuild the models, run these from `penguin-rescue/`:

```
blender -b -P models/cast.py    # previews and cast.blend (optional)
blender -b -P models/bake.py    # the game models; add "-- tuck pip" to bake only some
```

`main.ts` loads every file in `models/baked/` and passes it to `Game`. Each
model replaces the flat cutout of the art with the same name (`grimfin.glb`
replaces `orca`). Through `makeCutout()`, every cutout of that art becomes the
model. Any model that fails to load keeps its flat cutout. Previews, `.blend`
files and texture PNGs are generated, so they aren't committed.

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
