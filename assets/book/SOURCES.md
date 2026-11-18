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
| `fleuron.webp` | A printer's ornament from the Kilmarnock edition of Burns's poems, 1786, its paper taken out | Photograph by Rosser1954, [via Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Fleuron_from_1786_Robert_Burns_Kilmarnock_Edition.jpg), cropped and cleaned | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

The share images (`assets/og-*.png`) and the icons are drawn by
`tools/render-images.js` from the same initial, parchment and gold.

To redraw these files from the originals (needs Pillow and numpy), download the
originals above into one folder under the names `tools/real-assets.py` expects,
and run:

```bash
python3 tools/real-assets.py path/to/originals
```

## The organ and the words

| File | What it is | Source | Licence |
|---|---|---|---|
| `assets/organ/*.mp3` | Eighteen pipes of the open stop of a real pipe organ, a minor third apart, each its speech and sustain and then its release into the room it was recorded in, which is the only reverb (made by `tools/organ-assets.py`) | VSCO 2: Community Edition, Versilian Studios; organ sampled by Simon Dalzell of Ivy Audio ([VSCO 2 CE](https://github.com/sgossner/VSCO-2-CE), `Keys/Organ/Loud/Rode_Man3Open_*`) | CC0 |
| The words beside the staves | Luther's *Ein feste Burg ist unser Gott* in English as Frederick H. Hedge made it (1853), and in Spanish as Juan Bautista Cabrera made it (19th century), each written to be sung to this tune | | Public domain |
