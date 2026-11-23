#!/usr/bin/env python3
"""Build the site: python3 tools/build.py

Reads src/strings/<lang>.toml and the templates in src/, and writes
index.html (English), es/index.html (Spanish), 404.html (both) and
sitemap.xml at the repository root. Run it after any change in src/
or assets/, then commit what it writes.
"""
import hashlib
import html
import json
import re
import tomllib
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
BASE = "https://andresmessina-sdg.github.io/"
LANGS = ["en", "es"]
NAMES = {"en": "English", "es": "Español"}
# Works whose own sites have no sitemap, listed in ours so search engines find them.
EXTRA_SITEMAP = [
    "scriptura/", "scriptura/es/", "scriptura/ru/",
    "revelation-explainer/",
    "the-pilgrims-road/",
    "Worldviews-in-Motion/",
]


def esc(s: str) -> str:
    return html.escape(s, quote=True)


def render(template: str, values: dict) -> str:
    """{{{key}}} inserts raw HTML, {{key}} inserts escaped text."""
    def raw(m):
        return values[m.group(1)]

    def text(m):
        return esc(values[m.group(1)])

    out = re.sub(r"\{\{\{(\w+)\}\}\}", raw, template)
    out = re.sub(r"\{\{(\w+)\}\}", text, out)
    leftover = re.findall(r"\{\{\{?\w+\}?\}\}", out)
    assert not leftover, f"unfilled placeholders: {leftover}"
    return out


# Ties: a number is kept on the line of the word it counts ("11 stations", "2 Corinthians"), a book of
# Scripture on the line of its chapter and verse ("Psalm 119:105"), and a catalogue on the line of its
# number ("BWV 302"), so that no line begins with a figure cut from its word.
TIES = [
    (re.compile(r"(?<=\d) (?=[^\W\d_])"), "\u00a0"),
    (re.compile(r"(?<=[^\W\d_]) (?=\d+[:.,]\d)"), "\u00a0"),
    (re.compile(r"(?<=[A-Z][A-Z]) (?=\d)"), "\u00a0"),
]
UNTIED = {"layout", "href", "path", "lang", "locale", "id", "clip", "plate", "title_lang", "within_at", "description", "title"}


def tie(value, key: str = ""):
    """The strings of a page, with their ties made (see TIES)."""
    if key in UNTIED:
        return value
    if isinstance(value, str):
        for pattern, nbsp in TIES:
            value = pattern.sub(nbsp, value)
        return value
    if isinstance(value, list):
        return [tie(v, key) for v in value]
    if isinstance(value, dict):
        return {k: tie(v, k) for k, v in value.items()}
    return value


def roman(n: int) -> str:
    out = ""
    for value, letters in [(1000, "M"), (900, "CM"), (500, "D"), (400, "CD"), (100, "C"), (90, "XC"),
                           (50, "L"), (40, "XL"), (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]:
        while n >= value:
            out, n = out + letters, n - value
    return out


def indent(block: str, n: int) -> str:
    pad = " " * n
    return "\n".join(pad + line if line.strip() else line for line in block.splitlines())


ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"]


def chorale(k: int) -> str:
    """Line k of the chorale (1 to 7), engraved by tools/engrave.py. After the last line's double bar
    stands Fine., as Bach wrote it at the end of his scores, before his S.D.Gl."""
    svg = unplayed((SRC / "chorale" / f"{k}.svg").read_text(encoding="utf-8").rstrip())
    w0 = re.search(r'viewBox="0 0 ([\d.]+)', svg)[1]
    svg = svg.replace('<svg class="score-notes"', f'<svg class="score-notes" data-line="{k}" style="--vbw: {w0}"', 1)   # its place in the strophe, for site.js; its width, for site.css
    if k == 7:
        m = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)" width="[\d.]+"', svg)
        w, h = float(m[1]), m[2]
        wide = w + 34
        svg = svg.replace(m[0], f'viewBox="0 0 {wide:.1f} {h}" width="{wide:.1f}"', 1)
        svg = svg.replace("\n</svg>", f'\n  <text class="score-fine" x="{w + 7:.1f}" y="29.5" fill="var(--ink)">Fine.</text>\n</svg>', 1)
    return svg


def unplayed(svg: str) -> str:
    """A staff as it is read: tools/engrave.py also writes the notes for playing (data-play), which the
    page does not play."""
    return re.sub(r" data-play='[^']*'", "", svg)


def gloss(k: int, t: dict) -> str:
    """Beside each staff, its words put plainly into the page's language."""
    return f'\n<p class="score-gloss"><span class="score-say">{esc(t["chorale_gloss"][k - 1])}</span></p>'


def creds(lines: list) -> str:
    """The degree, its school and the rest, a line each: *...* is set in italic (the Latin of an honour),
    and "~" is a space that never breaks (no "Southern | Seminary")."""
    out = []
    for i, line in enumerate(lines):
        html = kept(line) if "·" in line else esc(line)
        html = re.sub(r"\*([^*]+)\*", r"<i>\1</i>", html).replace("~", "\u00a0")
        out.append(f'<span class="cred-line">{html}</span>')
    return " ".join(out)


def kept(line: str) -> str:
    """A line of short items between middle dots, each kept whole on its line (no "Native Spanish |
    & English"); an item too long to be sure of fitting a phone's line is left to break."""
    return "\u00a0· ".join(f'<span class="kept">{esc(x)}</span>' if len(x) <= 28 else esc(x)
                      for x in (x.strip() for x in line.split("·")))


def works_html(t: dict) -> str:
    """Each work is a folio: on the left page its title, its miniature and a verse beneath it; on the right
    its text and its line of the chorale."""
    items = []
    for i, w in enumerate(t["works"]):
        colour = "blue" if i % 2 == 0 else "red"
        if w.get("layout") == "modern":
            items.append(modern_work(t, w, i, colour))
            continue
        facts = "".join(f"<span>{esc(f)}</span>" for f in w["facts"])
        title_lang = f' lang="{w["title_lang"]}"' if "title_lang" in w else ""
        clip = f' data-clip="/assets/works/{w["clip"]}.mp4"' if "clip" in w else ""
        links = "\n".join(f'      <a href="{esc(l["href"])}">{esc(l["label"])}</a>' for l in w["links"])
        items.append(f"""<article class="folio work {colour}" id="{w["id"]}" data-name="{esc(w["name"])}"{title_lang}>
  <div class="page page-v {colour}">
    <h2{title_lang}><a href="{esc(w["href"])}"><span class="versal">{esc(w["versal"])}</span>{esc(w["rest"])}</a></h2>
    <p class="kind">{esc(w["kind"])}</p>
    <a class="plate" href="{esc(w["href"])}"{clip}><img src="/assets/works/{w["plate"]}-1200.webp" srcset="/assets/works/{w["plate"]}-640.webp 640w, /assets/works/{w["plate"]}-1200.webp 1200w" sizes="(min-width: 1000px) 640px, (min-width: 640px) 37rem, calc(100vw - 90px)" width="1200" height="675" alt="{esc(w["plate_alt"])}" loading="lazy" decoding="async"></a>
    <blockquote class="epigraph">
      <p>{lord(w["epigraph"])}</p>
      <cite>{esc(w["epigraph_ref"])}</cite>
    </blockquote>
  </div>
  <div class="page page-r {colour}">
    <p class="what">{esc(w["what"])}</p>
    <div class="within">
      <h3 class="rubric">{esc(t["within"])}</h3>
      <p>{within_html(w["within"], w.get("within_at", ""), w.get("within_ids"))}</p>
    </div>
    <p class="facts">{facts}</p>
    <p class="go">
{links}
    </p>
    <div class="score">
{indent(chorale(i + 2) + gloss(i + 2, t), 6)}
    </div>
  </div>
</article>""")
    return indent("\n\n".join(items), 4)


def modern_work(t: dict, w: dict, i: int, colour: str) -> str:
    """A work set as a modern book sets it (a prototype, on the work whose strings ask for it): on the
    left page a label, the title (plain, without an initial), what the work is, its picture and the verse beneath as a caption; on
    the right its parts as a numbered table, its particulars, the way in and its line of the chorale."""
    title_lang = f' lang="{w["title_lang"]}"' if "title_lang" in w else ""
    clip = f' data-clip="/assets/works/{w["clip"]}.mp4"' if "clip" in w else ""
    links = "\n".join(f'      <a href="{esc(l["href"])}">{esc(l["label"])}</a>' for l in w["links"])
    rows = []
    ids, at = w.get("within_ids"), w.get("within_at", "")
    for k, item in enumerate(w["within"]):
        item = re.sub(r"^[IVXLC]+ ", "", item)                        # the table numbers its rows itself
        # a part's name, and on the right what it is (a station's task) or when (an age's years)
        m = (re.match(r"(.+), ((?:de )?\d[\d–]*(?:–today| a hoy)?)$", item) or re.match(r"(.+?): (.+)$", item)
             or re.match(r"(.+)()$", item))
        first = m[1].replace(" ", "\u00a0", 1) if len(m[1].split(" ")) > 2 else m[1]   # no first word alone at a line end
        name = re.sub(r"(?<=\w)-(?=\w)", "-\u2060", esc(first))
        if ids:
            name = f'<a href="{esc(at.format(ids[k]))}">{name}</a>'
        what = f'<span class="st-what">{esc(m[2])}</span>' if m[2] else ""
        rows.append(f'        <li><span class="st-n" aria-hidden="true">{k + 1:02d}</span><span class="st-name">{name}</span>{what}</li>')
    # (a value of several, such as the languages, keeps each whole, so a narrow page can set them one to a line)
    dd = lambda v: '<span class="dd-sep"> · </span>'.join(f'<span class="dd-item">{esc(x)}</span>' for x in v.split(" · ")) if " · " in v else esc(v)
    details = "\n".join(f'      <div><dt>{esc(k)}</dt><dd>{dd(v)}</dd></div>' for k, v in w["details"])
    hid = f'{w["id"]}-parts'
    return f"""<article class="folio work {colour} modern" id="{w["id"]}" data-name="{esc(w["name"])}"{title_lang}>
  <div class="page page-v {colour} modern">
    <p class="kicker"><span class="kicker-n">{esc(t["number"])}\u00a0{i + 1}</span> <span class="kind">{esc(w["kind"])}</span></p>
    <h2{title_lang}><a href="{esc(w["href"])}">{esc(w["versal"])}{esc(w["rest"])}</a></h2>
    <p class="what">{esc(w["what"])}</p>
    <figure class="plate-fig">
      <a class="plate" href="{esc(w["href"])}"{clip}><img src="/assets/works/{w["plate"]}-1200.webp" srcset="/assets/works/{w["plate"]}-640.webp 640w, /assets/works/{w["plate"]}-1200.webp 1200w" sizes="(min-width: 1000px) 640px, (min-width: 640px) 37rem, calc(100vw - 90px)" width="1200" height="675" alt="{esc(w["plate_alt"])}" loading="lazy" decoding="async"></a>
      <figcaption class="epigraph"><p>{lord(w["epigraph"])}</p> <cite>{esc(w["epigraph_ref"])}</cite></figcaption>
    </figure>
  </div>
  <div class="page page-r {colour} modern">
    <div class="parts">
      <h3 id="{hid}">{esc(w["within_title"])}</h3>
      <ol aria-labelledby="{hid}" style="--rows:{-(-len(rows) // 2)}">
{chr(10).join(rows)}
      </ol>
    </div>
    <dl class="details">
{details}
    </dl>
    <p class="go">
{links}
    </p>
    <div class="score">
{indent(chorale(i + 2) + gloss(i + 2, t), 6)}
    </div>
  </div>
</article>"""


def within_html(items: list, at: str = "", ids: list | None = None) -> str:
    """What a work holds, run on as a manuscript runs its text on: each item after a paragraph mark,
    the marks red and blue in turn, and no item broken from its mark. An item numbered in roman
    numerals (the ages of the church) has its numeral for its mark, coloured the same way. Where the
    work gives each item an address of its own (within_at, with {} for the item's id), the item
    opens it."""
    assert not ids or len(ids) == len(items), "within_ids must name every item"
    out = []
    for k, item in enumerate(items):
        colour = "r" if k % 2 == 0 else "b"
        num = re.match(r"([IVXLC]+) (.+)$", item)
        if num:
            mark = f'<span class="pil num {colour}">{num[1]}</span>'
            item = num[2]
        else:
            mark = f'<span class="pil {colour}" aria-hidden="true">¶</span>'
        # an item's first word is never left alone at the end of a line (¶ Is | Satan ruling the world?)
        item = item.replace(" ", "\u00a0", 1) if len(item.split(" ")) > 2 else item
        # an age's years are set apart from its name, quieter
        when = re.match(r"(.+), ((?:de )?\d[\d–]*(?:–today| a hoy)?)$", item)
        if when:
            text = f'{esc(when[1])}<span class="when"><span class="sep">, </span>{esc(when[2])}</span>'
        else:
            text = esc(item)
        # and a compound is never broken at its own hyphen (Neo-|paganism): a word joiner holds it
        text = re.sub(r"(?<=\w)-(?=\w)", "-\u2060", text)
        if ids:
            text = f'<a href="{esc(at.format(ids[k]))}">{text}</a>'
        out.append(f'<span class="it">{mark}\u00a0{text}</span>')
    return " ".join(out)


def thumbs_html(t: dict) -> str:
    """The thumb index: a tab for each folio, as a Bible's thumb index has one for each book."""
    rows = [("opening", t["opening_name"], t["opening_name"], None)]
    rows += [(w["id"], w["short"], w["name"], w.get("title_lang")) for w in t["works"]]
    rows.append(("colophon", t["colophon_name"], t["colophon_name"], None))
    out = []
    for i, (wid, short, name, tl) in enumerate(rows):
        lang = f' lang="{tl}"' if tl and short == name else ""
        out.append(f'<a class="thumb" href="#{wid}" style="--k:{i}" title="{esc(name)}" aria-label="{esc(name)}"><span{lang}>{esc(short)}</span></a>')
    return indent("\n".join(out), 6)


def contents_html(t: dict) -> str:
    """The works, and the colophon, with the folio each opens on."""
    rows = [(w["id"], w["versal"], w["rest"], w.get("title_lang")) for w in t["works"]]
    rows.append(("colophon", t["colophon_name"][0], t["colophon_name"][1:], None))
    out = []
    for i, (wid, v, rest, tl) in enumerate(rows):
        lang = f' lang="{tl}"' if tl else ""
        colour = "blue" if i % 2 == 0 else "red"
        out.append(f'<li class="{colour}"><a href="#{wid}"{lang}><span class="c-name">{esc(v)}{esc(rest)}</span>'
                   f'<span class="c-dots" aria-hidden="true"></span><span class="c-fol" aria-hidden="true">{ROMAN[i + 1]}</span></a></li>')
    return indent("\n".join(out), 12)


def lord(text: str) -> str:
    """The KJV's LORD, set as it is printed: a capital and small capitals."""
    return esc(text).replace("LORD", '<span class="lord">Lord</span>')


FEASTS = ["lords_day", "christmas", "good_friday", "easter", "ascension", "pentecost", "reformation"]


def kalendar_js(verses: list, t: dict) -> str:
    """src/kalendar.js, given the verses, the feasts' names and the language."""
    lang = t["lang"]
    v = json.dumps([[x[lang], x[f"{lang}_ref"]] for x in verses], ensure_ascii=False, separators=(",", ":"))
    f = json.dumps({k: t[k] for k in FEASTS}, ensure_ascii=False, separators=(",", ":"))
    body = (SRC / "kalendar.js").read_text(encoding="utf-8")
    body = "\n".join(line for line in body.splitlines() if not line.lstrip().startswith("//"))
    js = f"(()=>{{const V={v},F={f},L={json.dumps(lang)};\n{body}\n}})()"
    return js.replace("</", "<\\/")


def ui_json(t: dict) -> str:
    """The words site.js needs for the book's own controls, kept with the page's other words."""
    keys = ["contents", "turn_next", "turn_prev", "folio", "show_all", "opening_name", "colophon_name", "thumbs_label"]
    return esc(json.dumps({k: t[k] for k in keys}, ensure_ascii=False, separators=(",", ":")))


def langs_nav(t: dict) -> str:
    parts = []
    for lang in LANGS:
        href = "/" if lang == "en" else f"/{lang}/"
        current = ' aria-current="page"' if lang == t["lang"] else ""
        parts.append(f'<a href="{href}" hreflang="{lang}" lang="{lang}"{current}>{NAMES[lang]}</a>')
    return f'<nav class="langs" aria-label="{esc(t["langs_label"])}">' + '<span aria-hidden="true">·</span>'.join(parts) + "</nav>"


def structured_data(t: dict, url: str) -> str:
    me = BASE + "#me"
    kinds = {
        "scriptura": {"@type": "SoftwareApplication", "operatingSystem": "Linux",
                      "applicationCategory": "ReferenceApplication",
                      "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}},
        "church-history": {"@type": "WebSite"},
        "revelation": {"@type": "WebSite"},
        "pilgrims-road": {"@type": "LearningResource", "learningResourceType": "game"},
        "worldviews": {"@type": "WebSite"},
    }
    works = []
    for w in t["works"]:
        item = {**kinds[w["id"]], "name": w["name"], "url": w["href"], "description": w["what"],
                "author": {"@id": me}}
        works.append(item)
    graph = [
        {"@type": "Person", "@id": me, "name": "Andres Messina", "url": BASE,
         "image": BASE + "assets/portrait.jpg", "description": t["lede"],
         "jobTitle": t["cred_title"], "knowsLanguage": ["es", "en"],
         "knowsAbout": [s.strip() for s in t["cred_fields"].split("·")],
         "alumniOf": {"@type": "CollegeOrUniversity", "name": "Boyce College", "url": "https://www.boycecollege.com/",
                      "parentOrganization": {"@type": "CollegeOrUniversity",
                                             "name": "The Southern Baptist Theological Seminary", "url": "https://www.sbts.edu/"}},
         "sameAs": ["https://www.linkedin.com/in/andresmessina/", "https://github.com/andresmessina-SDG",
                    "https://ko-fi.com/andresmessina"]},
        {"@type": "WebPage", "@id": url, "url": url, "name": t["title"], "description": t["description"],
         "inLanguage": t["lang"], "author": {"@id": me}, "about": {"@id": me},
         "mainEntity": {"@type": "ItemList", "itemListElement": [
             {"@type": "ListItem", "position": i + 1, "item": w} for i, w in enumerate(works)]}},
    ]
    data = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, separators=(",", ":"))
    data = data.replace("</", "<\\/")
    return f'<script type="application/ld+json">{data}</script>'


def head_links(t: dict, url: str, all_strings: dict) -> str:
    lines = [f'<link rel="canonical" href="{url}">']
    for lang in LANGS:
        lines.append(f'<link rel="alternate" hreflang="{lang}" href="{BASE}{all_strings[lang]["path"]}">')
    lines.append(f'<link rel="alternate" hreflang="x-default" href="{BASE}">')
    image = f"{BASE}assets/og-{t['lang']}.png"
    lines += [
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="Andres Messina">',
        f'<meta property="og:title" content="{esc(t["title"])}">',
        f'<meta property="og:description" content="{esc(t["description"])}">',
        f'<meta property="og:url" content="{url}">',
        f'<meta property="og:locale" content="{t["locale"]}">',
    ]
    for lang in LANGS:
        if lang != t["lang"]:
            lines.append(f'<meta property="og:locale:alternate" content="{all_strings[lang]["locale"]}">')
    lines += [
        f'<meta property="og:image" content="{image}">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        f'<meta property="og:image:alt" content="{esc(t["og_alt"])}">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{esc(t["title"])}">',
        f'<meta name="twitter:description" content="{esc(t["description"])}">',
        f'<meta name="twitter:image" content="{image}">',
        f'<meta name="twitter:image:alt" content="{esc(t["og_alt"])}">',
        structured_data(t, url),
    ]
    return "\n".join(lines)


def cyrillic_cut(pages: list) -> None:
    """EB Garamond's Cyrillic, cut to the letters the pages set: the full cut, kept beside it as the
    source, is 25 KB for the six letters of «Русский». Needs fontTools and brotli (pip install fonttools
    brotli); without them the cut already made is left as it is."""
    used = sorted({c for page in pages for c in page if "\u0400" <= c <= "\u04ff"})
    fonts = ROOT / "assets" / "fonts"
    out = fonts / "eb-garamond-roman-cyrillic-used.woff2"
    try:
        from fontTools import subset
    except ImportError:
        print("fontTools is not installed: the Cyrillic cut is left as it is")
        return
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    font = subset.load_font(str(fonts / "eb-garamond-roman-cyrillic.woff2"), opts)
    font.recalcTimestamp = False
    cut = subset.Subsetter(opts)
    cut.populate(unicodes=[ord(c) for c in used])
    cut.subset(font)
    tmp = out.with_suffix(".tmp")
    subset.save_font(font, str(tmp), opts)
    if out.exists() and out.read_bytes() == tmp.read_bytes():
        tmp.unlink()
    else:
        tmp.replace(out)
        print(f"wrote {out.relative_to(ROOT)} ({''.join(used)}, {out.stat().st_size // 1024} KB)")


def version() -> str:
    h = hashlib.sha256()
    for p in sorted((ROOT / "assets").glob("site.*")):
        h.update(p.read_bytes())
    return h.hexdigest()[:10]


def main() -> None:
    strings = {lang: tomllib.loads((SRC / "strings" / f"{lang}.toml").read_text(encoding="utf-8")) for lang in LANGS}
    verses = tomllib.loads((SRC / "verses.toml").read_text(encoding="utf-8"))["verses"]
    evening = (SRC / "evening.js").read_text(encoding="utf-8").strip()
    head = (SRC / "head.html").read_text(encoding="utf-8")
    page = (SRC / "page.html").read_text(encoding="utf-8")
    notfound = (SRC / "404.html").read_text(encoding="utf-8")
    motif = indent(unplayed((SRC / "bach.svg").read_text(encoding="utf-8").rstrip()), 10)
    sdg = indent((SRC / "sdg.svg").read_text(encoding="utf-8").rstrip(), 14)
    v = version()

    year = roman(date.today().year)
    strings = {lang: tie(t) for lang, t in strings.items()}
    verses = tie(verses)
    for lang, t in strings.items():
        t["imprint"] = t["imprint"].replace("{year}", year)
        url = BASE + t["path"]
        values = {**{k: v_ for k, v_ in t.items() if isinstance(v_, str)},
                  "page_title": t["title"], "v": v,
                  "cred_fields_html": kept(t["cred_fields"]), "cred_degrees_html": creds(t["cred_degrees"]),
                  "jj_gloss_html": kept(t["jj_gloss"]),
                  "head_links": head_links(t, url, strings),
                  # site.js from the head, fetched first: on a slow line the book waits on it
                  "head_script": f'<script src="/assets/site.js?v={v}" defer fetchpriority="high"></script>\n',
                  "langs": langs_nav(t),
                  "chorale_1": indent(chorale(1) + gloss(1, t), 10), "chorale_7": indent(chorale(7) + gloss(7, t), 10),
                  "motif": motif, "sdg": sdg, "evening": evening,
                  "verse_html": lord(verses[0][lang]), "verse_ref": verses[0][f"{lang}_ref"],
                  "kalendar_js": kalendar_js(verses, t), "ui": ui_json(t),
                  "contents": contents_html(t), "thumbs": thumbs_html(t),
                  "bach_html": re.sub(r"\*([^*]+)\*", r"<i>\1</i>", esc(t["bach"])),
                  "works": works_html(t)}
        out = ROOT / t["path"] / "index.html"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(render(head, values) + render(page, values), encoding="utf-8")
        print("wrote", out.relative_to(ROOT))

    # 404: English first, Spanish beneath. GitHub Pages also serves it for
    # missing pages in project sites that have no 404 of their own.
    en, es = strings["en"], strings["es"]
    nf_works = indent("\n".join(f'<li><a href="{esc(w["href"])}" lang="en">{esc(w["name"])}</a></li>' for w in en["works"]), 6)
    values = {**{k: v_ for k, v_ in en.items() if isinstance(v_, str)},
              "page_title": f'{en["nf_title"]} · Andres Messina', "v": v,
              "description": en["nf_p"],
              "head_links": '<meta name="robots" content="noindex">', "head_script": "",
              "nf_works": nf_works, "jj_gloss_html": kept(en["jj_gloss"]), "evening": evening, "chorale_7": indent(chorale(7), 6), "sdg": indent((SRC / "sdg.svg").read_text(encoding="utf-8").rstrip(), 8),
              "es_nf_h": es["nf_h"], "es_nf_p": es["nf_p"], "es_nf_home": es["nf_home"]}
    (ROOT / "404.html").write_text(render(head, values) + render(notfound, values), encoding="utf-8")
    print("wrote 404.html")

    urls = []
    for lang, t in strings.items():
        alts = "".join(f'\n    <xhtml:link rel="alternate" hreflang="{l}" href="{BASE}{strings[l]["path"]}"/>' for l in LANGS)
        urls.append(f"  <url>\n    <loc>{BASE}{t['path']}</loc>{alts}\n  </url>")
    urls += [f"  <url>\n    <loc>{BASE}{p}</loc>\n  </url>" for p in EXTRA_SITEMAP]
    (ROOT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
        + "\n".join(urls) + "\n</urlset>\n", encoding="utf-8")
    print("wrote sitemap.xml")

    cyrillic_cut([(ROOT / t["path"] / "index.html").read_text(encoding="utf-8") for t in strings.values()]
                 + [(ROOT / "404.html").read_text(encoding="utf-8")])


if __name__ == "__main__":
    main()
