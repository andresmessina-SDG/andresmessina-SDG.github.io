# The book's materials

Every texture and ornament in the book is a photograph or a scan of a real thing.
`tools/real-assets.py` turns the originals into the files here: it crops and
resizes them, and for the ornaments it takes out the paper they were painted or
printed on, so that they can lie on this page instead.

| File | What it is | Source | Licence |
|---|---|---|---|
| `initial-a.webp`, `initial-a-320.webp` | The opening initial A: a 13th-century initial on burnished gold, cut from an Italian Bible, with a seated prophet (the smaller is the size the page shows it at; the share images are drawn from the larger) | Cleveland Museum of Art, 1954.131.7, via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Italy,_13th_century_-_Historiated_Initial_(A)_Excised_from_a_Bible_-_1954.131.7_-_Cleveland_Museum_of_Art.tif) | CC0 |
| `gold.webp` | A patch of that initial's burnished gold, which gilds S.D.G. | as above | CC0 |
| `vine.webp` | Gilded ivy, painted flowers and hairline stems from the border of a Book of Hours (Use of Metz), France, 15th century, fol. 27r | Cleveland Museum of Art, 1942.1514.27.a, via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Book_of_Hours_(Use_of_Metz)_Fol._27r,_Decorated_Initials.tif) | Public domain |
| `parchment.webp` | The smooth (hair) side of a medieval parchment leaf, made to tile | Membeth, [Pergament.2.jpg](https://commons.wikimedia.org/wiki/File:Pergament.2.jpg) | CC0 |
| `paper.webp` | The book's paper: the parchment above, its grain kept at a little over half and its colour at a quarter, on a warm white (made by `tools/paper.py`) | (derived from the parchment) | CC0 |
| `cloth.webp` | A bookbinding cloth, for the boards: its weave kept, its scuffs and mottling evened out, dyed slate blue (made by `tools/modern-assets.py`) | Poly Haven, [Book Pattern](https://polyhaven.com/a/book_pattern) (Rob Tuytel) | CC0 |
| `desk.webp` | Pale oak veneer, for the table the book lies on (made by `tools/modern-assets.py`) | Poly Haven, [Oak Veneer 03](https://polyhaven.com/a/oak_veneer_03) (Jenelle van Heerden) | CC0 |
| `envelope.webp` | The back of an envelope of 10 May 1843, Fanny Appleton's to Henry Wadsworth Longfellow, its flaps meeting under its seal; cut from the scanner's white, and its black wax seal taken out (filled from clean paper on the same flap) to make way for the red one | Longfellow House–Washington's Headquarters, US National Park Service (archives 1011/002.001-013#003), via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Envelope_for_Fanny_Appleton_to_Henry_Longfellow,_10_May_1843_(30bdb81fdc5b4eeea0d259fb4a3a1209).jpg) (from its 1280px rendering, as `envelope-1843-1280.jpg`) | Public domain |
| `letter.webp` | The page the readings are written on: the right-hand page of Fanny Appleton's letter to Henry Wadsworth Longfellow of 10 May 1843, the letter that came in the envelope above, which she left blank; with its own edges (cut from the scanner's white, and at the fold between its pages), her stationer's emboss at its head, and the two creases it was folded in three by (at 28.6% and 65.3% of its height), along which the letter folds and unfolds | Longfellow House–Washington's Headquarters, US National Park Service, via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Fanny_Appleton_to_Henry_Longfellow,_10_May_1843_(9140d4993b444f27af7414fff80d9384).jpg) (from its 1920px rendering, as `letter-1843-1920.jpg`) | Public domain |
| `seal.webp` | A seal of red sealing wax, unbroken, on a folded letter of 30 June 1846 from the directorate of the Gewerbeverein of the Kingdom of Hanover; cut from its paper, for the envelope on the calendar page | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Gewerbeverein_Koenigreich_Hannover_Direktion_1846_Wachssiegel.jpg), a scan of the original (from Commons' 960px rendering, as `seal-1846-960.jpg`) | Public domain |
| `fleuron.webp` | A printer's ornament from the Kilmarnock edition of Burns's poems, 1786, its paper taken out | Photograph by Rosser1954, [via Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Fleuron_from_1786_Robert_Burns_Kilmarnock_Edition.jpg), cropped and cleaned | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

The share images (`assets/og-*.png`) and the icons are drawn by
`tools/render-images.js` from the same initial, parchment and gold.

To redraw these files from the originals (needs Pillow and numpy), download the
originals above into one folder under the names `tools/real-assets.py` expects,
and run:

```bash
python3 tools/real-assets.py path/to/originals
```

## The words

| File | What it is | Source | Licence |
|---|---|---|---|
| `assets/morning-evening/` | C. H. Spurgeon, *Morning and Evening: Daily Readings* (1865–68), every morning's and evening's reading (made by `tools/morning-evening.py`) | Christian Classics Ethereal Library, [plain text](https://ccel.org/ccel/s/spurgeon/morneve/cache/morneve.txt) | Public domain |
| The words beside the staves | Luther's *Ein feste Burg ist unser Gott* in English as Frederick H. Hedge made it (1853), and in Spanish as Juan Bautista Cabrera made it (19th century), each written to be sung to this tune | | Public domain |
