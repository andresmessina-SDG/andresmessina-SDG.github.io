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
| `leather.webp` | The worn calf of a 120-year-old family Bible's cover, for the boards | Photograph by Pink Sherbet Photography, [via Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Free_vintage_antique_leather_book_cover_texture_for_layers_(2981931138).jpg), resized | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) |
| `oak.webp` | Oak planks, for the desk; darkened | Poly Haven, [Oak wood planks](https://polyhaven.com/a/oak_wood_planks) (Rico Cilliers, Charlotte Baglioni, Dimitrios Savva and others), via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Oak_wood_planks_diff_8k_(PNG).png) | CC0 |
| `fleuron.webp` | A printer's ornament from the Kilmarnock edition of Burns's poems, 1786, its paper taken out | Photograph by Rosser1954, [via Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Fleuron_from_1786_Robert_Burns_Kilmarnock_Edition.jpg), cropped and cleaned | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

The share images (`assets/og-*.png`) and the icons are drawn by
`tools/render-images.js` from the same initial, parchment and gold.

To redraw these files from the originals (needs Pillow and numpy), download the
originals above into one folder under the names `tools/real-assets.py` expects,
and run:

```bash
python3 tools/real-assets.py path/to/originals
```
