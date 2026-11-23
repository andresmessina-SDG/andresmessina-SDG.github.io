#!/usr/bin/env python3
"""Makes assets/morning-evening/: Spurgeon's Morning and Evening, a file to each day of the year.

    python3 tools/morning-evening.py path/to/morneve.txt

The text is the Christian Classics Ethereal Library's plain-text edition (public domain):
https://ccel.org/ccel/s/spurgeon/morneve/cache/morneve.txt

Each day's file, MM-DD.json, holds its morning and its evening reading, fetched by the page only when
a reader comes near the letter on the calendar. Each reading is its text of Scripture, the text's
reference, and its paragraphs, a hymn's lines among them kept as a list of its lines. The typewriter's marks are set as a printer would set them: curled
quotation marks and apostrophes, and the em rule for "--".
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "morning-evening"
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September",
          "October", "November", "December"]
DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
HEAD = re.compile(r"^(Morning|Evening), (" + "|".join(MONTHS) + r") (\d{1,2})$")


def typeset(s: str) -> str:
    """Curled quotes, apostrophes and em rules, from the straight marks of the plain text."""
    s = re.sub(r"\s*--\s*", "\u2014", s)
    s = s.replace("...", "\u2026")
    # a double quotation mark opens at the start, after a space, a bracket or a rule, and closes elsewhere
    s = re.sub(r'(^|[\s(\[\u2014])"', "\\1\u201c", s)
    s = s.replace('"', "\u201d")
    # a single mark opens a quotation only where it begins one (after a space, a bracket, a rule or an
    # opening double mark, and before a letter that is not the start of an elision such as 'tis or 'twas);
    # everywhere else it is an apostrophe or a closing mark, which are the same sign
    s = re.sub(r"(^|[\s(\[\u2014\u201c])'(?!(?:[Tt]is|[Tt]was|[Tt]were|[Tt]will|em|mid|neath|gainst)\b)(?=\w)", "\\1\u2018", s)
    s = s.replace("'", "\u2019")
    return s


def unwrap(lines: list, keep: bool = False) -> list:
    """The paragraphs of a block of indented, wrapped lines; with keep, each as the lines it was set in."""
    paras, cur = [], []
    for ln in lines:
        if ln.strip():
            cur.append(ln.strip())
        elif cur:
            paras.append(cur); cur = []
    if cur:
        paras.append(cur)
    return paras if keep else [" ".join(p) for p in paras]


def stanzas(paras: list) -> list:
    """The reading's paragraphs, with the lines of a hymn it quotes gathered into a stanza: the plain text
    sets each line of verse as a paragraph of one line, which prose seldom is, and never two in a row:
    so a run of such lines (two or more) is a stanza, kept as a list of its lines."""
    out, run = [], []
    def close():
        if len(run) >= 2:
            out.append(list(run))
        else:
            out.extend(run)
        run.clear()
    for lines in paras:
        if len(lines) == 1:
            run.append(lines[0])
        else:
            close()
            out.append(" ".join(lines))
    close()
    return out


def parse(text: str) -> dict:
    lines = text.splitlines()
    starts = [(i, HEAD.match(l)) for i, l in enumerate(lines) if HEAD.match(l)]
    readings = {}
    for n, (i, m) in enumerate(starts):
        end = starts[n + 1][0] if n + 1 < len(starts) else len(lines)
        body = lines[i + 1:end]
        rule = next((k for k, l in enumerate(body) if l.strip().startswith("____")), len(body))
        body = [l for l in body[:rule] if not re.match(r"^\s*\[\d+\]Go to (Morning|Evening) Reading\s*$", l, re.I)]
        # the text of Scripture, then its reference, then the reading, each a paragraph of its own
        verse, ref, *paras = unwrap(body, keep=True)
        verse, ref = " ".join(verse), " ".join(ref)
        paras = stanzas(paras)
        assert verse and ref and paras, (m.group(0), verse, ref)
        assert not any(re.search(r"\[\d+\]", str(p)) for p in paras), m.group(0)
        month = MONTHS.index(m[2]) + 1
        key = f"{month:02d}-{int(m[3]):02d}"
        readings.setdefault(key, {})["m" if m[1] == "Morning" else "e"] = {
            "text": typeset(verse), "ref": ref,
            "body": [[typeset(l) for l in p] if isinstance(p, list) else typeset(p) for p in paras]}
    return readings


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    readings = parse(Path(sys.argv[1]).read_text(encoding="utf-8"))
    want = [f"{m + 1:02d}-{d + 1:02d}" for m in range(12) for d in range(DAYS[m])]
    missing = [k for k in want if set(readings.get(k, {})) != {"m", "e"}]
    assert not missing, f"missing readings: {missing}"
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.json"):
        old.unlink()
    for k in want:
        (OUT / f"{k}.json").write_text(json.dumps(readings[k], ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {len(want)} days to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
