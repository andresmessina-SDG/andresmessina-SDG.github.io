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
opening (the maker, and a kalendar with the day's verse and the contents),
one for each work, and the colophon with the signature. Each folio has a
left page (`.page-v`) and a right page (`.page-r`).

On a screen wide and tall enough (a window from about 1280 by 720),
`assets/site.js` binds those pages into a book lying open on the desk: a
spread to each folio, laid out at one size (pages of 520 by 720) and zoomed
to fit. Its leaves turn by the arrow keys, Page Up and Down, Home and End,
the wheel or a trackpad, a hand dragging a page, its corners, or the
catchword at its foot; the ribbon opens the contents; each spread has its
own address (`/#worldviews`), and Back turns back. The left page of each
work carries its miniature, which plays its clip as the book opens to it.
At the foot of every right page is a line of Bach's chorale; with the organ
stop drawn out (top right), each line sounds, in his four parts, as the
book opens to it, so that the whole book plays the whole strophe.

On a phone, a narrow or short window, without JavaScript, and on paper, the
same document is one leaf of vellum read down the page, with each work's
line of the chorale beneath it. Nothing moves for readers who ask for
stillness: the book still binds, and its leaves turn at once.

## What is where

| Path | What it is |
|---|---|
| `src/strings/en.toml`, `src/strings/es.toml` | Every word on the page, and the five works, each with the verse set beneath its miniature. Edit these to change the text or add a work; a sixth work would need a line of the chorale of its own (see `tools/engrave.py`). |
| `src/head.html`, `src/page.html`, `src/404.html` | The page templates. |
| `src/verses.toml`, `src/kalendar.js` | The kalendar on the first right page: today's date as a book of hours sets it, in red on the Lord's Day and the feasts the Reformed churches kept (Christmas, Good Friday, Easter, Ascension, Pentecost, Reformation Day), and the verse for the day, one for each day in turn (KJV and Reina-Valera 1960), chosen in the reader's browser by their own calendar. The first is the one the page is built with. |
| `src/evening.js` | Evening light: after sunset where the reader is, guessed from the browser's time zone alone, the vellum warms as if by candlelight. Add `?evening` to the address to see it at any hour. Inlined into the head of each page by `tools/build.py`. |
| `src/initial.svg`, `src/tail.svg` | The gilded initial A and the ivy that trails from it. |
| `assets/site.css`, `assets/site.js` | Styles, the book, and the little that moves: the light on the gold, which follows the pointer; versals washed with colour, staves engraved and S.D.G. written by a quill and sealed, as they scroll into view or as the book opens to them; the leaf turning between English and Spanish; the organ. Nothing moves for readers who ask for stillness. |
| `src/chorale/1.svg` to `7.svg` | Bach's four-part setting of Luther's *Ein feste Burg ist unser Gott*, BWV 302, a line to each folio: the soprano engraved with its words, and all four voices as data for the organ. Engraved by `tools/engrave.py` from the music21 edition of the Bach chorales, with note shapes from [Bravura](https://github.com/steinbergmedia/bravura) (SIL Open Font License). |
| `src/bach.svg` | B-A-C-H, Bach's name in notes, under the colophon; engraved by `tools/engrave.py`. |
| `src/sdg.svg`, `src/seal.svg` | The gilded S.D.G. as paths with the pen strokes that write it, and the wax seal beside it; drawn by `tools/quill.py` from the page's own EB Garamond. |
| `assets/works/` | The plate beside each work, at 1200 and 640 pixels wide. The river, the Revelation guide (question 20), The Pilgrim's Road and Worldviews in Motion (Christian theism, at Redemption) were captured from the sites themselves at double resolution; Scriptura's is its own screenshot of the Greek interlinear. To change one, replace both sizes and keep the 16:9 shape. Beside them, `<id>.mp4` is the short silent clip that plays over a plate while a pointer rests on it (fetched only then, and never on touch screens), recorded from each work's own site by `tools/record-clips.js`. Scriptura has no clip, since its plate is a desktop app. |
| `assets/fonts/` | EB Garamond and IM Fell English SC, served from this site under the SIL Open Font License. The page loads nothing from any other site. |
| `index.html`, `es/index.html`, `404.html`, `sitemap.xml` | Built by `tools/build.py`. Don't edit by hand. |
| `robots.txt` | Governs the whole `andresmessina-sdg.github.io` host, project sites included, so it lists every sitemap on it. |
| `favicon.ico`, `apple-touch-icon.png`, `assets/icon-192.png`, `assets/og-*.png` | Icons and share images, drawn by `tools/render-images.js`. |

## Build

After changing anything in `src/` or `assets/`:

```bash
python3 tools/build.py
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

To redraw the signature or the seal (needs fontTools and brotli):

```bash
python3 tools/quill.py && python3 tools/build.py
```

Commit what they write. GitHub Pages serves the repository as it is.

## Keep clear of these folder names

This site sits at the root of the host, above each project site. A folder
here named `scriptura`, `church-history`, `revelation-explainer`,
`the-pilgrims-road`, `Worldviews-in-Motion` or `scriptura-flatpak` would hide that project.
