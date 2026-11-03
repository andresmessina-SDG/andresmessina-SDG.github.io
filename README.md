# andresmessina-sdg.github.io

The home page of Andres Messina's works on Scripture and the church:
Scriptura, A History of the Christian Church, Revelation: The
Illuminated Codex and The Pilgrim's Road.

Live at <https://andresmessina-sdg.github.io/>, in English and at
[`/es/`](https://andresmessina-sdg.github.io/es/) in Spanish.

The page is set like a page of a book of hours and signed the way Bach
signed his scores: *J.J.* (*Jesu, juva*, "Jesus, help") at the head and
*S.D.G.* (*Soli Deo Gloria*) at the end.

## What is where

| Path | What it is |
|---|---|
| `src/strings/en.toml`, `src/strings/es.toml` | Every word on the page, and the four works. Edit these to change the text or add a work. |
| `src/head.html`, `src/page.html`, `src/404.html` | The page templates. |
| `src/initial.svg`, `src/tail.svg` | The gilded initial A and the ivy that trails from it. |
| `assets/site.css`, `assets/site.js` | Styles, and the one glint of light across the gold. |
| `src/score-open.svg`, `src/score-close.svg` | The first and last lines of Bach's *Ein feste Burg ist unser Gott* (BWV 302, soprano), engraved by `tools/engrave.py` with note shapes from [Bravura](https://github.com/steinbergmedia/bravura) (SIL Open Font License). |
| `assets/works/` | The plate beside each work, at 1200 and 640 pixels wide. The river, the Revelation guide (question 20) and The Pilgrim's Road were captured from the sites themselves at double resolution; Scriptura's is its own screenshot of the Greek interlinear. To change one, replace both sizes and keep the 16:9 shape. |
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

Commit what they write. GitHub Pages serves the repository as it is.

## Keep clear of these folder names

This site sits at the root of the host, above each project site. A folder
here named `scriptura`, `church-history`, `revelation-explainer`,
`the-pilgrims-road` or `scriptura-flatpak` would hide that project.
