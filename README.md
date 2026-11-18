# andresmessina-sdg.github.io

The home page of Andres Messina's works on Scripture and the church:
Scriptura, Worldviews in Motion, A History of the Christian Church,
The Pilgrim's Road and Revelation: The Illuminated Codex, in the order of
the story of redemption, from the Word to the new creation.

Live at <https://andresmessina-sdg.github.io/>, in English and at
[`/es/`](https://andresmessina-sdg.github.io/es/) in Spanish.

The page is a book of hours, signed the way Bach signed his scores: *J.J.*
(*Jesu, juva*, "Jesus, help") at the head and *S.D.G.* (*Soli Deo Gloria*)
at the end.

## The book and the page

`index.html` is one document, read in order, made of seven folios: the
opening (the maker, his name spelled out beside a real historiated initial A,
and a calendar with the day's verse and the contents),
one for each work, and the colophon with the signature. Each folio has a
left page (`.page-v`) and a right page (`.page-r`).

On a screen wide and tall enough (a window from about 1024 by 768),
`assets/site.js` binds those pages into a book lying open across the whole
window: a spread to each folio. Its measures come from the window, by rules
set out at `geometry()` in `assets/site.js` and at the head of the book's
styles in `assets/site.css`: the zoom grows as the square root of the
window's height; the pages fill the window, shaped anywhere from a book of
hours' 2:3 to a squarish 0.88; the text is a 36th of the page's width, so a
line holds about 66 to 70 characters, and every other size is a step of a
minor third from it, never less than 15px on the screen, the small
capitals never less than 13.5 and a work's contents 15; the margins widen from the gutter outward and
from the head down, as a manuscript's do. The reader's own zoom (Ctrl +) is
kept: the type is set as it would be at their 100% and grows with the zoom,
and where the pages can no longer hold it the book is laid aside for the
leaves on the desk (below); a page that would otherwise spill sets its
smaller text a size smaller first. F, or the button above the book, reads it
full screen. A leaf turning bows as paper does, its outer part leading as it lifts and trailing as it falls (`bend()` in `assets/site.js`). Its leaves turn by the arrow keys, Page Up and Down, Home and End,
the wheel or a trackpad, a hand dragging a page, its corners, or the
catchword at its foot; a thumb index of vellum tabs down its left edge
turns straight to any folio; each spread has its own address
(`/#worldviews`). Turning a page keeps the address in step without adding to
the history, so that Back leaves the book in one press; a jump by the
contents, the thumb index or a link is a step that Back retraces.

The pages are set as a modern book is, in the old materials: one family,
EB Garamond, its labels in the face's own small capitals with lining
figures; one accent, red, for what can be pressed; no ruling, initials or
paragraph marks. The left page of each work carries a label (*No. 2 ·
Animated watercolor*), the title, what the work is, and its picture, which
plays its clip as the book opens to it, with the verse beneath it as its
caption. The right page sets what the work holds as a numbered table, each
part's name and, at the right, its task or its years: in one column, or two
where the list is long, or run on as an index where even two will not go
(`fitWithin()` in `assets/site.js` tries each); where a work gives each part
an address (the church history's ages, the codex's questions, the
worldviews' paintings), each opens its own. Beneath it, the work's
particulars in a row (`details` in the strings) and the way in. The window's title names the open folio.
At the foot of every right page is a line of Bach's chorale, its words put
plainly into English or Spanish beside it where the staff leaves room, and
a word that it can be pressed to be heard; with the organ
music drawn out (top right), each line sounds, in his four parts, as the
book opens to it, so that the whole book plays the whole strophe. The last
line ends, as Bach ended his scores, with *Fine.* and his S.D.G.

The book is made as books were: its paper the real parchment of
`assets/book/` quietened to a fine warm white (`tools/paper.py`); edged red under gold; a
headband of red and gold silk at the head and tail of the spine; the lower
outer corners a shade darker where readers' thumbs turn them; and a
colophon that says what it is set in and when it was bound. The build ties
each number to its word and each book of Scripture to its chapter and
verse, so that no line begins with a figure cut off from them.

On a phone, or a narrow or short window, the same document is read down the
page, a folio to a leaf, as the church history's eras are: each leaf holds
still at its foot for a moment's scrolling, then the next rises over it and
the one beneath dims. Each work's line of the chorale is at the foot of its
leaf, and the thumb index is folded to slim spines of calf at the left
edge, drawn out by a touch, and drawn out for a moment once a visit as the
page opens, so that it is known for what it is. On a window wide but too
short for the book (a laptop whose screen is scaled up, from 1000px wide),
the leaves lie on the oak desk instead: each a sheet with the desk at either
side and its two pages side by side as in the book, under the same lettered
tabs of vellum as the book's, the type the book's at the reader's zoom. Without JavaScript, and on paper, it is simply
one long page. Nothing moves for readers who ask for stillness: the book
still binds, and its leaves turn at once; the leaves still lie one over
another, but without the shade.

## What is where

| Path | What it is |
|---|---|
| `src/strings/en.toml`, `src/strings/es.toml` | Every word on the page, and the five works, each with the verse set beneath its miniature. Edit these to change the text or add a work; a sixth work would need a line of the chorale of its own (see `tools/engrave.py`). |
| `src/head.html`, `src/page.html`, `src/404.html` | The page templates. |
| `src/verses.toml`, `src/kalendar.js` | The kalendar on the first right page: today's date as a book of hours sets it, in red on the Lord's Day and the feasts the Reformed churches kept (Christmas, Good Friday, Easter, Ascension, Pentecost, Reformation Day), and the verse for the day, one for each day in turn (KJV and Reina-Valera 1960), chosen in the reader's browser by their own calendar. The first is the one the page is built with. |
| `src/evening.js` | Evening light: after sunset where the reader is, guessed from the browser's time zone alone, the vellum warms as if by candlelight. Add `?evening` to the address to see it at any hour. Inlined into the head of each page by `tools/build.py`. |
| `assets/book/` | The book's real materials, each a photograph or scan of a real thing: the opening initial A (a 13th-century Bible initial on burnished gold), the gilded ivy in the margins (from a 15th-century Book of Hours), the parchment, the leather boards, the oak desk, the gold of S.D.G. and the fleuron. `SOURCES.md` there gives each one's source and licence; `tools/real-assets.py` prepares them from the originals. |
| `assets/site.css`, `assets/site.js` | Styles, the book, and the little that moves: the light on the gold, which follows the pointer; staves engraved and S.D.G. written by a quill, as they scroll into view or as the book opens to them; the leaf turning between English and Spanish; the organ. Nothing moves for readers who ask for stillness. |
| `src/chorale/1.svg` to `7.svg` | Bach's four-part setting of Luther's *Ein feste Burg ist unser Gott*, BWV 302, a line to each folio: the soprano engraved with its words, and all four voices as data for the organ. Engraved by `tools/engrave.py` from the music21 edition of the Bach chorales, with note shapes from [Bravura](https://github.com/steinbergmedia/bravura) (SIL Open Font License). |
| `src/bach.svg` | B-A-C-H, Bach's name in notes, under the colophon; engraved by `tools/engrave.py`. |
| `src/sdg.svg` | S.D.G. as paths with the pen strokes that write it, gilded with the real gold in `assets/book/gold.webp`; drawn by `tools/quill.py` from the page's own EB Garamond. |
| `assets/works/` | The plate beside each work, at 1200 and 640 pixels wide. The river, the Revelation guide (question 20), The Pilgrim's Road and Worldviews in Motion (Christian theism, at Redemption) were captured from the sites themselves at double resolution; Scriptura's is its own screenshot of the Greek interlinear. To change one, replace both sizes and keep the 16:9 shape. Beside them, `<id>.mp4` is the short silent clip that plays over a plate while a pointer rests on it (fetched only then, and never on touch screens), recorded from each work's own site by `tools/record-clips.js`. Scriptura has no clip, since its plate is a desktop app. |
| `assets/fonts/` | EB Garamond, its headings in the face’s own small capitals (the Latin cut keeps `smcp`, `c2sc`, lining and tabular figures), served from this site under the SIL Open Font License. The page loads nothing from any other site. The roman Cyrillic is served cut to the letters the pages set (`-used`, 3 KB, for «Русский»), cut by `tools/build.py` from the full face beside it whenever fontTools is installed. |
| `index.html`, `es/index.html`, `404.html`, `sitemap.xml` | Built by `tools/build.py`. Don't edit by hand. |
| `tools/paper.py` | Makes the book's paper, `assets/book/paper.webp`, from the real parchment: the same skin, quieter and lighter. |
| `tools/check.js` | Checks the built site in a real browser: errors and missing files, the layout at each size, pages that spill or text that collides, the book bound before it is seen, zoom, Back, names for screen readers, the weight of a first visit, and print. |
| `robots.txt` | Governs the whole `andresmessina-sdg.github.io` host, project sites included, so it lists every sitemap on it. |
| `favicon.ico`, `apple-touch-icon.png`, `assets/icon-192.png`, `assets/og-*.png` | Icons and share images, drawn by `tools/render-images.js` from the real initial, parchment and gold. |

## Build

After changing anything in `src/` or `assets/`:

```bash
python3 tools/build.py
```

Then check it (needs Node with Playwright and Chromium; with axe-core
installed it also runs an accessibility scan). It prints each check and
exits non-zero if any fails; name checks to run only those
(`node tools/check.js zoom back`):

```bash
node tools/check.js
```

After changing the initial or the share-image wording (needs Node with
Playwright and Chromium, and Pillow):

```bash
node tools/render-images.js && python3 tools/make-favicon.py
```

To re-engrave the music (needs fontTools and music21; Bravura is downloaded on first run):

```bash
python3 tools/engrave.py && python3 tools/build.py
```

To re-record the plates' clips (needs Node with Playwright and Chromium, and ffmpeg, with
each work's repository cloned beside this one, under `../andresmessina-sdg/`; the
Worldviews painting is slow to draw without a graphics card, so allow about ten minutes):

```bash
node tools/record-clips.js
```

To redraw the signature (needs fontTools and brotli):

```bash
python3 tools/quill.py && python3 tools/build.py
```

Commit what they write. GitHub Pages serves the repository as it is.

## Keep clear of these folder names

This site sits at the root of the host, above each project site. A folder
here named `scriptura`, `church-history`, `revelation-explainer`,
`the-pilgrims-road`, `Worldviews-in-Motion` or `scriptura-flatpak` would hide that project.
