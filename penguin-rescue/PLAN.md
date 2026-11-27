# The Penguin Rescue: design plan

A living document. We add to it as we decide things, and keep a log of what was decided and why
at the bottom. Nothing here is built yet unless it says so.

**Status:** building section 2. Book One (five chapters) is finished and live. Undo (2.1), mid-chapter saves (2.2), the scrapbook (2.3), chapter select (2.4), the camera lean (2.5) and the `?playtest` counters (2.6) are built; the playtest questions in 2.6 still need a real player.

---

## 1. What the game is for

Before adding anything, it helps to say what the game is trying to be, so every idea can be
checked against it.

**The feeling we want:** a cozy bedtime storybook that you play. It's warm and kind, with small
puzzles. You finish a chapter feeling clever and fond of the characters, never stressed or
punished.

**Who plays it:**
- **Little readers** (about 5–8), often with a grown-up beside them. They need short text, big
  targets, no fail states that feel like failing, and Gentle mode.
- **Grown-ups and older kids** who enjoy small turn-based puzzles. They need puzzles with a real
  "aha", optional harder goals, and no padding.

**Design pillars.** Every new feature should serve at least one of these and break none:

1. **It's a pop-up book.** The page, paper and folds are the world. Mechanics should feel like
   paper mechanisms, not video-game systems pasted on.
2. **Readable at a glance.** Turn-based means nothing should surprise you. Anything that will
   change next turn is shown beforehand, like Grimfin's glowing squares are now.
3. **Kind failure.** Mistakes cost a moment, never progress. Nobody loses more than one move
   by accident.
4. **Few verbs, many interactions.** Walk, push, talk and a few items. New chapters add new
   *situations* for those verbs rather than new buttons.
5. **Character first.** Every puzzle belongs to someone with a reason to want it solved.

---

## 2. Improving the game we already have

These help Book One now and are groundwork for Book Two. They're ordered by how much they'd
improve the experience for the effort.

### 2.1 Undo (high value, small effort) — built
Right now a mistake near Grimfin means a catch and a walk back from a checkpoint, and there's
no undo at all. In a turn-based puzzle game, undo is the single biggest kindness. It turns
"I failed" into "let me try that again".

- An **⟲ Undo** button (and the Z key) steps back one move: your position, Grimfin, blocks,
  items and stars. Hold it to rewind further.
- Being caught still plays its funny scene, then offers "⟲ Undo that hop" next to
  "Back to the flag".
- It's possible because every turn is a small, known state change. We'd snapshot the state
  each turn.
- It makes Book Two's one-way mechanics (cracking ice, spreading frost) fair without a solver
  having to forbid every trap.

### 2.2 Save in the middle of a chapter — built
Saves only happen at the start of a chapter, so closing the tab mid-chapter loses progress.
Kids play in short bursts, often 10–15 minutes.
- Autosave after each completed side quest and each checkpoint, and when the page is hidden.
- Continue resumes at the last of those points.
- *As built:* it saves after every move (and when the page is hidden) by recording the moves and
  answers made since the chapter began. Continue rebuilds the chapter and replays them instantly
  and silently, so you resume exactly where you stopped, story scenes included. New chapters
  and mechanics get this for free, as long as their rules don't use randomness.
- *Rule for new code:* game logic must never read anything that only the render loop updates
  (such as an object's `visible`), because a replay runs between frames. The night stars broke
  this once: whether a star could be picked up was read off the picture; now it's `starShowing()`.
- A save made while a question is waiting replays up to that question and then asks it for
  real, instead of answering it.

### 2.3 Give paper stars a purpose — built (scrapbook and snapshots; no unlocks yet)
Stars are only counted. A collectible that unlocks nothing is easy to ignore.
- **A sticker scrapbook** in the journal. Each chapter has a page, and stars and finished side
  quests fill in stickers and little scenes. It suits the paper theme and gives a reason to
  explore.
- At the end of each chapter, a **"snapshot" moment**: the friends pose, a paper photo is
  taken and pasted into the scrapbook. It's a natural pause and a reward.
- Maybe later: stars unlock outfits (a hat, a scarf colour) or a bonus page.

### 2.4 Chapter select — built
After finishing the book, let players replay any chapter from the scrapbook, with that
chapter's stars and quests shown. This helps with missed side quests, which the end card
already lists.

### 2.5 Camera that leans toward danger — built
The closer camera makes the figures lovely but hides some of Grimfin's look-out squares. When
a threat is near (or, in Book Two, a tide or gust is about to hit), the camera eases
back and over to show both you and the threat. The rest of the time it stays close.
- *As built:* `Game.threats` lists Grimfin and his look-out squares while one of them is within
  4½ squares of the penguin (it lets go past 5½, so it doesn't flicker), or while he has spotted
  you. The camera frames them all with the penguin, never further out than the whole spread.
  It is camera-only, so it can't change what happens in a turn. Book Two's tides and gusts can
  add their own points to the same list.

### 2.6 Things to check by playtesting (unconfirmed)
These are guesses until someone, ideally a child, plays:
- Are any dialogue scenes too long before you get control back? (Rule of thumb: no more than
  4–5 lines in a row, about 15 words each, for little readers.)
- Do players notice the journal and side quests without being told twice?
- Is the cove too hard without Gentle mode, or the fog too long?
- On a phone, are the buttons and figures big enough with the new camera?

A light way to learn this: a hidden `?playtest` mode that counts moves, undos, catches and time
per chapter and shows them at the end. It stays on the device and sends nothing.
- *As built:* `?playtest` counts moves (steps and waits), undos, catches and minutes in each
  chapter (minutes survive Continue). A card at each chapter's end lists every chapter played
  that way, newest first; the log is `penguin-rescue-playtest` in localStorage.

---

## 3. Book Two: A Year on the Page

### 3.1 The idea
Book One ends happily ("The End", and Grimfin has a scarf). Book Two is a new book with its own
cover, picked on the title screen.

**Story:** in the last snow of winter, Tuck wonders out loud what the shore looks like the rest
of the year, since penguins in their book have only ever seen it white. The friends decide to
find out. They travel through spring, summer, autumn and the first frost, and come home for
winter. Grimfin, now a friend, comes too: he's clumsy at being nice and keeps getting better.

**The big idea: the book's own paper mechanisms are the mechanics.** Real pop-up books have:
- **pull-tabs**, which slide something across the page
- **flaps** you lift to see what's under them
- **wheels** (volvelles), which turn to change a picture
- **fold-outs**, which open to make the page bigger
- **pop-ups** that stand up as the page opens

Each season's weather is shown as one of these. That's more memorable and more "us" than
generic weather effects, and it gives each mechanic a visible control the player can read.

### 3.2 A gentle theme for each season
Each chapter quietly carries one idea, shown through what the characters do and never spelled
out as a moral:
- **Spring:** patience. Things grow in their own time, and you can't hurry the thaw.
- **Summer:** generosity. Sharing what you have, like the long day and the shade.
- **Autumn:** goodbyes. Helping someone go even though you'll miss them, like the geese.
- **First Frost:** wonder. Stopping to look at something beautiful.
- **Winter:** home and welcome. Everyone you helped all year comes back, including Grimfin,
  who once wasn't welcome anywhere. Being forgiven and belonging is the heart of his story.

### 3.3 How each chapter is built
Every chapter follows the same shape, so it feels familiar while the content changes:

1. **Arrive (calm):** a short scene, a wide view of the new season, and a friend to greet.
2. **Learn (safe):** the new mechanic shown somewhere it can't hurt you, with one obvious use.
3. **Explore (the hub):** an open area with side quests and stars, where you use the
   mechanic freely.
4. **Test:** a puzzle stretch where the mechanic matters and is combined with an older verb.
5. **Twist:** one surprising use of the mechanic: the "aha".
6. **Celebrate:** a set piece, the snapshot and the page turn.

Pacing across the book alternates harder and gentler chapters, so the tension doesn't keep
climbing: Spring (medium), Summer (relaxed), Autumn (harder), Frost (medium), Winter (a
celebration finale with a light challenge).

### 3.4 The chapters

Each mechanic is checked against the pillars: is it shown beforehand, can it be undone, does it
reuse an existing verb, and does it look like paper?

#### Chapter Six · Spring · The Great Thaw
- **Look and weather:** rain showers on tissue-paper puddles, melting snow showing green felt
  grass, first flowers popping up. Rain comes and goes. Soft, damp light.
- **Paper mechanism: pull-tab streams.** Meltwater streams are pull-tabs across the page.
  Push a snow block into a stream to dam it, and the tab slides back to show dry stones
  downstream.
- **Mechanic: cracking ice.** Thin, cracked ice holds for one step, then breaks into water.
  This is the first "your path changes behind you" puzzle. With undo it's fair.
- **Reuses:** pushing blocks (dams), Book One's floe hopping.
- **Twist:** a dam you built upstream drains a pond that was blocking you, so the order you
  build dams in matters.
- **Friends and side quests:** Mama Eider, whose eggs rolled away down the thaw (find 3
  hidden under flaps); a hare who lost its burrow under the melt.
- **Grimfin:** hums under the ice and politely cracks a path when you ask, once.
- **Risk:** cracking ice is unforgiving. Undo (2.1) is required before this chapter.

#### Chapter Seven · Summer · Midnight-Sun Beach
- **Look and weather:** the sun never sets (a warm, low gold light all chapter), now and then
  a soft sea mist. Corrugated-card sand, shells, tide pools.
- **Paper mechanism: the tide wheel.** A wheel in the corner of the page turns one notch each
  turn. Where the arrow points shows low, rising, high or falling tide, so you always know
  what's next.
- **Mechanic: tides.** Sandbars and pools appear and disappear with the tide. At high tide,
  ice blocks float and can be pushed across water. At low tide you walk the seabed.
- **Reuses:** pushing blocks (floating them), sailing the paper boat (high tide only).
- **Twist:** wait on purpose. Some places can only be reached by standing still while the
  tide turns. It teaches waiting as a move, which the game already has but rarely needs.
- **Friends and side quests:** a hermit crab who needs a bigger shell (a trade chain); build
  a sandcastle with flags for the bunting from Book One.
- **Grimfin:** gives rides across the deep at high tide. The relaxed chapter: lots of
  exploring, little danger.

#### Chapter Eight · Autumn · The Blustery Bluffs
- **Look and weather:** falling paper leaves, orange and red tissue trees, geese overhead.
  Gusty: the leaves show which way the wind blows.
- **Paper mechanism: the windsock pop-up.** A windsock stands up on the page and swings to
  show the next gust's direction. Pips count down the turns until it blows.
- **Mechanic: gusts.** When a gust blows, you and anything loose (leaf piles, blocks, the
  boat) slide one cell downwind, unless you're sheltered behind a rock or tree. Sheltered
  cells get a small leaf marker.
- **Reuses:** sliding (glacier rules for how far things move), pushing blocks.
- **Twist:** ride a gust on purpose to cross a gap you can't walk. The wind stops being a
  nuisance and becomes a tool.
- **Friends and side quests:** a gosling who missed the flock and must reach the cliff top
  before they leave (gentle time pressure, counted in turns, with undo); a ptarmigan's
  scattered berries.
- **Theme moment:** saying goodbye to the geese as they fly south.
- **Risk:** being pushed is the most surprising mechanic. The countdown has to be very clear,
  and Gentle mode makes gusts weaker (half as often, or only pushing objects).

#### Chapter Nine · First Frost · Northern Lights
- **Look and weather:** night with the aurora rippling across the sky in coloured tissue,
  frost creeping over the page as white paper lace.
- **Paper mechanism: the frost flap.** Frost spreads as lace-paper overlays unfold one ring
  at a time. The next ring to freeze is shown as a faint outline.
- **Mechanic: spreading frost.** Each turn the pond freezes a little more in a set pattern.
  New ice is slippery (glacier sliding), so paths open and change as you go.
- **Reuses:** glacier sliding, the lantern (frost doesn't spread into lantern light, which
  gives the lantern a new job).
- **Twist:** use the lantern to keep a channel open while the rest freezes, so the boat can
  get through.
- **Friends and side quests:** a lemming family to help dig out before the snow; an owl who
  names the aurora's colours and asks you to find a lost star chart.
- **Theme moment:** everyone stops to watch the lights. A quiet scene with no puzzle.

#### Chapter Ten · Winter · The Blizzard Homecoming
- **Look and weather:** heavy snow, a whiteout, then a clear starry sky for the finale.
- **Paper mechanism: the fold-out.** The page folds out wider as you push through the
  blizzard. The finale opens the biggest pop-up spread in the game: the winter festival.
- **Mechanic: the whiteout.** You can only see a few cells around you, using the fog reveal
  the sailing chapter already has. Marker bells ring from the right direction, so you can
  hear the way. Every friend from the year helps on the path (ducks quack, the crab clacks).
- **Kept light on purpose:** whiteout plus the closer camera could be frustrating, so this
  chapter is short, well guided, and mostly a celebration.
- **Finale:** a winter festival where everyone from both books comes. Grimfin is the guest
  of honour. The year's snapshots hang on a string as a scrapbook spread.

### 3.5 Alternatives we considered (keep for later)
- Spring: deep mud that takes two turns to wade through.
- Summer: a kite that lets you glide over one gap.
- Autumn: leaf piles you can hide in (similar to Book One's hiding, so less new).
- Winter: snow drifts that build up and must be dug (adds a verb; maybe in Gentle mode only).
- A mischievous skua bird who steals items, as a light trouble-maker if Book Two needs a
  "villain".

---

## 4. Technical plan (what needs building)

1. **Undo and mid-chapter saves** (section 2): snapshot game state each turn.
2. **Seasons system:** each chapter sets a season, which controls:
   - ground materials: felt grass, corrugated sand, mud, leaf litter, snow
   - background, light colour and scenery
   - outfits: raincoat, sun hat, scarf
3. **Weather particles:** `weather.ts` grows from snow only to rain, leaves, mist,
   fireflies and blizzard, plus a wind direction. New ambient sounds: rain, waves, wind,
   bells.
4. **World turns:** one shared step after each move runs the tide, wind, frost and so on,
   just as Grimfin's turn runs now. The rules live in `rules.ts` so the solver can use them.
5. **Forecasts:** every timed mechanic shows next turn's change (the tide wheel, windsock,
   frost outline) using shape and pattern as well as colour, for colour-blind players.
6. **Solver checks:** each map is checked by a script to prove it can be finished and has no
   traps that undo can't fix, like the glacier.
7. **New characters in Blender:** eiders, hare, crab, geese, ptarmigan, lemmings, owl, and the
   seasonal outfits, using `models/cast.py` and `bake.py`.
8. **Book choice:** a second cover on the title screen, saves per book, and the scrapbook.
9. **Translation and phones:** Russian for everything, and testing on phones.

**Build order:**
1. Undo, mid-chapter saves and camera lean. These improve Book One right away.
2. Scrapbook and snapshots, so Book Two's rewards have somewhere to go.
3. Seasons system plus Spring, as a complete trial chapter to play and adjust.
4. Summer, Autumn, Frost, Winter, each checked and merged on its own.

---

## 5. Open questions

1. Book Two with its own cover, or more chapters in Book One? *(Recommended: Book Two.)*
2. Keep all five mechanics, or swap any for the alternatives in 3.5?
3. Is Grimfin a friend throughout Book Two, or is there a new gentle trouble-maker (the skua)?
4. Should we build the Book One improvements (undo, saves, scrapbook) first? *(Recommended.)*
5. What do stars unlock: only scrapbook stickers, or outfits too?
6. Are there real young players who could playtest Spring once it's ready?

---

## 6. Decision log

| Date | Decision | Why |
|---|---|---|
| 2026-11-26 | Stay in planning; keep this document as the plan of record | Asked to plan before building |
| 2026-11-26 | Book Two travels through the seasons, with weather-based mechanics | Asked for chapters in different seasons with different weather and mechanics |
| 2026-11-26 | Build the Book One improvements first, starting with undo | Agreed; Spring's cracking ice depends on undo |
| 2026-11-26 | Chapter select lives in the scrapbook on the title card; a replay is its own visit (`?replay=`) and never touches the story save | Keeps the story save simple; replays add stickers and photos only |
| 2026-11-26 | A replayed chapter starts with the usual kit and the friends helped in *earlier* chapters | That chapter's own quests start fresh, so they can be done again |
| 2026-11-26 | The scrapbook is stored apart from the save and keeps the best ever (stars, quests) and the latest photo | Survives Start over and the end of the book, so replaying a chapter can still add stickers |
| 2026-11-26 | No star unlocks (outfits) yet | Open question 5 is still undecided |
| 2026-11-26 | Mid-chapter saves replay recorded moves instead of saving every story flag | Exact resume anywhere, no restore code per scene, and Book Two's mechanics are covered automatically. Rule: game logic must stay deterministic (randomness only for looks) |
| 2026-11-26 | Undo covers moves only: position, Grimfin, ice blocks, fish. It stops at finding things, conversations and sunk blocks | Collecting is never a mistake, and taking back story scenes or new floes would be fragile; caught-then-undo is the case that matters |
