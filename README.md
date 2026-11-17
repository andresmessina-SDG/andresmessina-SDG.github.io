# andresmessina-sdg.github.io

The home page of Andres Messina's works on Scripture and the church:
Scriptura, A History of the Christian Church, Worldviews in Motion,
Revelation: The Illuminated Codex and The Pilgrim's Road.

Live at <https://andresmessina-sdg.github.io/>, in English and at
[`/es/`](https://andresmessina-sdg.github.io/es/) in Spanish.

The page is set like a page of a book of hours and signed the way Bach
signed his scores: *J.J.* (*Jesu, juva*, "Jesus, help") at the head and
*S.D.G.* (*Soli Deo Gloria*) at the end.

## What is where

| Path | What it is |
|---|---|
| `src/strings/en.toml`, `src/strings/es.toml` | Every word on the page, and the five works. Edit these to change the text or add a work. |
| `src/head.html`, `src/page.html`, `src/404.html` | The page templates. |
| `src/verses.toml` | The verse under the maker's name, one for each day in turn (KJV and Reina-Valera 1960), chosen in the reader's browser by their own calendar. The first is the one the page is built with. |
| `src/evening.js` | Evening light: after sunset where the reader is, guessed from the browser's time zone alone, the vellum warms as if by candlelight. Add `?evening` to the address to see it at any hour. Inlined into the head of each page by `tools/build.py`. |
| `src/initial.svg`, `src/tail.svg` | The gilded initial A and the ivy that trails from it. |
| `assets/site.css`, `assets/site.js` | Styles, and the little that moves: the glint across the gold; the staves ruled, versals painted and plates laid as they scroll into view; S.D.G. written by a quill and sealed; the leaf turning between English and Spanish; and B-A-C-H played on a small organ when asked. Nothing moves for readers who ask for stillness. |
| `src/score-open.svg`, `src/score-close.svg` | The first and last lines of Bach's *Ein feste Burg ist unser Gott* (BWV 302, soprano), engraved by `tools/engrave.py` with note shapes from [Bravura](https://github.com/steinbergmedia/bravura) (SIL Open Font License). |
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

To re-engrave the music (needs fontTools; Bravura is downloaded on first run):

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
