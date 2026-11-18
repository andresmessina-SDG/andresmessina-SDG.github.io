#!/usr/bin/env python3
"""The organ's pipes: python3 tools/organ-assets.py SRC_DIR

From the pipe organ in VSCO 2: Community Edition (Versilian Studios; sampled by Simon Dalzell of Ivy
Audio; CC0), its manual open stop (Keys/Organ/Loud/Rode_Man3Open_NN.wav in SRC_DIR, sample NN sounding
MIDI note 23 + NN, one every minor third). For each note the chorale needs, from a tone and a half
below its lowest to its highest (and an octave lower, for the 16' under the bass), this writes
assets/organ/NN.mp3: the pipe's speech and its sustain (HEAD seconds), a little silence, and then the
pipe's release into the room where it was recorded (TAIL seconds), which is the book's only reverb.
site.js plays the first part for as long as a note is held and then the release. Needs numpy and ffmpeg.
"""
import json, subprocess, sys, wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "organ"
HEAD, GAP, TAIL = 2.2, 0.25, 1.2


def load(f):
    w = wave.open(str(f)); sr = w.getframerate()
    a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).reshape(-1, w.getnchannels()).astype(np.float32) / 32768
    return a, sr


def main(src):
    src = Path(src)
    chorale = [json.loads(__import__("re").search(r"data-play='([^']+)'", p.read_text())[1]) for p in sorted((ROOT / "src" / "chorale").glob("*.svg"))]
    notes = [e[2] for d in chorale for e in d["events"]]
    lo, hi = min(notes), max(notes)
    want = sorted({n for n in range(1, 62, 3) if lo - 12 - 2 <= 23 + n <= hi + 2})
    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for n in want:
        a, sr = load(src / f"Rode_Man3Open_{n:02d}.wav")
        mono = a.mean(axis=1)
        env = np.sqrt(np.convolve(mono ** 2, np.ones(441) / 441, "same"))
        start = max(0, int(np.argmax(env > env.max() * 0.003)) - int(sr * 0.004))
        sus = np.median(env[int(sr * 2):int(sr * 8)])
        # where the key was let go: the sound (over a tenth of a second) falls 10 dB below its sustain and
        # stays down; the release is taken from a little before, while the pipe still speaks
        slow = np.sqrt(np.convolve(mono ** 2, np.ones(sr // 10) / (sr // 10), "same"))
        down = np.flatnonzero(slow[int(sr * 6):] < sus * 0.32)
        assert len(down), f"no release found in pipe {n}"
        drop = int(sr * 6) + int(down[0])
        full = np.flatnonzero(env[:drop] > sus * 0.85)                       # the pipe's last moment at full voice
        off = int(full[-1]) + int(sr * 0.04)
        head = a[start:start + int(sr * HEAD)]
        tail = a[off - int(sr * 0.05):off - int(sr * 0.05) + int(sr * TAIL)]
        fade = np.linspace(1, 0, int(sr * 0.25))[:, None]
        tail[-len(fade):] *= fade
        x = np.concatenate([head, np.zeros((int(sr * GAP), a.shape[1]), np.float32), tail])
        x = x / max(1e-6, sus) * 0.12                                       # every pipe at one level of sustain
        tmp = OUT / f"{n:02d}.wav"
        with wave.open(str(tmp), "wb") as w:
            w.setnchannels(a.shape[1]); w.setsampwidth(2); w.setframerate(sr)
            w.writeframes((x.clip(-1, 1) * 32767).astype(np.int16).tobytes())
        mp3 = OUT / f"{n:02d}.mp3"
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(tmp), "-ac", "2", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "56k", "-joint_stereo", "1", str(mp3)], check=True)
        tmp.unlink()
        total += mp3.stat().st_size
        print(f"wrote assets/organ/{n:02d}.mp3  midi {23 + n}  {mp3.stat().st_size // 1024} KB")
    (OUT / "pipes.json").write_text(json.dumps({"base": 23, "pipes": want, "head": HEAD, "gap": GAP, "tail": TAIL}) + "\n")
    print(f"{len(want)} pipes, {total // 1024} KB")


if __name__ == "__main__":
    main(sys.argv[1])
