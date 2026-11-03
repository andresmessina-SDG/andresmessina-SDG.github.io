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


def indent(block: str, n: int) -> str:
    pad = " " * n
    return "\n".join(pad + line if line.strip() else line for line in block.splitlines())


def works_html(t: dict) -> str:
    items = []
    for i, w in enumerate(t["works"]):
        colour = "blue" if i % 2 == 0 else "red"
        facts = "".join(f"<span>{esc(f)}</span>" for f in w["facts"])
        title_lang = f' lang="{w["title_lang"]}"' if "title_lang" in w else ""
        links = "\n".join(f'    <a href="{esc(l["href"])}">{esc(l["label"])}</a>' for l in w["links"])
        items.append(f"""<li class="work {colour}">
  <h3{title_lang}><a href="{esc(w["href"])}"><span class="versal">{esc(w["versal"])}</span>{esc(w["rest"])}</a></h3>
  <p class="kind">{esc(w["kind"])}</p>
  <p class="what">{esc(w["what"])}</p>
  <p class="facts">{facts}</p>
  <p class="go">
{links}
  </p>
</li>""")
    sep = '\n<li class="sep" aria-hidden="true"><hr class="staff"></li>\n'
    return indent(sep.join(items), 6)


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


def version() -> str:
    h = hashlib.sha256()
    for p in sorted((ROOT / "assets").glob("site.*")):
        h.update(p.read_bytes())
    return h.hexdigest()[:10]


def main() -> None:
    strings = {lang: tomllib.loads((SRC / "strings" / f"{lang}.toml").read_text(encoding="utf-8")) for lang in LANGS}
    head = (SRC / "head.html").read_text(encoding="utf-8")
    page = (SRC / "page.html").read_text(encoding="utf-8")
    notfound = (SRC / "404.html").read_text(encoding="utf-8")
    initial = indent((SRC / "initial.svg").read_text(encoding="utf-8").rstrip(), 8)
    tail = indent((SRC / "tail.svg").read_text(encoding="utf-8").rstrip(), 8)
    score_open = indent((SRC / "score-open.svg").read_text(encoding="utf-8").rstrip(), 6)
    score_close = indent((SRC / "score-close.svg").read_text(encoding="utf-8").rstrip(), 6)
    v = version()

    for lang, t in strings.items():
        url = BASE + t["path"]
        values = {**{k: v_ for k, v_ in t.items() if isinstance(v_, str)},
                  "page_title": t["title"], "v": v,
                  "head_links": head_links(t, url, strings),
                  "langs": langs_nav(t), "initial": initial, "tail": tail,
                  "score_open": score_open, "score_close": score_close,
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
              "head_links": '<meta name="robots" content="noindex">',
              "nf_works": nf_works,
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


if __name__ == "__main__":
    main()
