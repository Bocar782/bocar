"""
Bande-son originale de la pub Tavyra : musique + sound design, synthétisés
ici (aucun sample externe), calés au frame près sur src/timing.json.

120 BPM (1 temps = 15 frames à 30 fps), la mineur -> résolution en do majeur.
Sortie : public/audio/soundtrack.wav (48 kHz, stéréo, 24 bits via ffmpeg loudnorm).
"""
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parent.parent
TM = json.loads((ROOT / "src/timing.json").read_text())
SR = 48000
FPS = TM["fps"]
DUR = TM["total"] / FPS + 0.6
N = int(DUR * SR)
BEAT = 60 / TM["bpm"]
rng = np.random.default_rng(42)

L = np.zeros(N)
R = np.zeros(N)


def fr(frame):
    return frame / FPS


def scene(name):
    return TM["scenes"][name][0]


def note(n):
    """Nom de note -> fréquence (ex. 'A3')."""
    names = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    name, octave = n[:-1], int(n[-1])
    midi = 12 * (octave + 1) + names[name]
    return 440 * 2 ** ((midi - 69) / 12)


def add(sig, t0, gain=1.0, pan=0.0, buf=None):
    """Ajoute un signal mono (ou stéréo (2, n)) à partir de t0 secondes."""
    i0 = int(t0 * SR)
    if i0 >= N:
        return
    if sig.ndim == 1:
        n = min(len(sig), N - i0)
        lg = np.cos((pan + 1) * np.pi / 4)
        rg = np.sin((pan + 1) * np.pi / 4)
        (buf or (L, R))[0][i0 : i0 + n] += sig[:n] * gain * lg * 1.414
        (buf or (L, R))[1][i0 : i0 + n] += sig[:n] * gain * rg * 1.414
    else:
        n = min(sig.shape[1], N - i0)
        (buf or (L, R))[0][i0 : i0 + n] += sig[0, :n] * gain
        (buf or (L, R))[1][i0 : i0 + n] += sig[1, :n] * gain


def t_arr(d):
    return np.arange(int(d * SR)) / SR


def env_adsr(n, a, d, s, r, total):
    t = np.arange(n) / SR
    e = np.ones(n) * s
    e[t < a] = t[t < a] / max(a, 1e-4)
    m = (t >= a) & (t < a + d)
    e[m] = 1 - (1 - s) * (t[m] - a) / max(d, 1e-4)
    rel = t > total - r
    e[rel] *= np.clip((total - t[rel]) / max(r, 1e-4), 0, 1)
    return e


def lp(x, fc, order=2):
    sos = signal.butter(order, min(fc, SR / 2 - 100) / (SR / 2), "low", output="sos")
    return signal.sosfilt(sos, x)


def hp(x, fc, order=2):
    sos = signal.butter(order, fc / (SR / 2), "high", output="sos")
    return signal.sosfilt(sos, x)


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo / (SR / 2), min(hi, SR / 2 - 100) / (SR / 2)], "band", output="sos")
    return signal.sosfilt(sos, x)


def sweep_lp(x, f0, f1, block=256, curve=2.0):
    """Passe-bas dont la coupure glisse de f0 à f1 (exponentiel)."""
    out = np.zeros_like(x)
    zi = None
    nb = int(np.ceil(len(x) / block))
    for b in range(nb):
        p = (b / max(nb - 1, 1)) ** curve
        fc = f0 * (f1 / f0) ** p
        sos = signal.butter(2, min(fc, SR / 2 - 200) / (SR / 2), "low", output="sos")
        if zi is None:
            zi = signal.sosfilt_zi(sos) * 0
        seg = x[b * block : (b + 1) * block]
        y, zi = signal.sosfilt(sos, seg, zi=zi)
        out[b * block : b * block + len(seg)] = y
    return out


def saw(freq, d, phase=None):
    t = t_arr(d)
    ph = (freq * t + (rng.random() if phase is None else phase)) % 1.0
    return 2 * ph - 1


def supersaw(freq, d, voices=7, detune=0.18, stereo=True):
    t = t_arr(d)
    lch = np.zeros(len(t))
    rch = np.zeros(len(t))
    for v in range(voices):
        off = (v - (voices - 1) / 2) / ((voices - 1) / 2) * detune
        f = freq * 2 ** (off / 12)
        s = 2 * ((f * t + rng.random()) % 1.0) - 1
        pan = (v / (voices - 1)) * 2 - 1 if stereo else 0
        lch += s * np.cos((pan + 1) * np.pi / 4)
        rch += s * np.sin((pan + 1) * np.pi / 4)
    return np.vstack([lch, rch]) / voices


def reverb_ir(seconds=2.6, predelay=0.02, bright=6000):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    decay = np.exp(-t * 6.9 / seconds)
    irs = []
    for _ in range(2):
        noise = rng.standard_normal(n) * decay
        noise = lp(noise, bright)
        noise[: int(predelay * SR)] = 0
        irs.append(noise / np.sqrt(np.sum(noise**2)))
    return irs


IR_BIG = reverb_ir(3.2, 0.03, 5000)
IR_ROOM = reverb_ir(1.1, 0.01, 7000)


def convolve_bus(bl, br, ir, wet):
    wl = signal.fftconvolve(bl, ir[0])[: len(bl)]
    wr = signal.fftconvolve(br, ir[1])[: len(br)]
    return wl * wet, wr * wet


# ---------------------------------------------------------------- bus
MUS = (np.zeros(N), np.zeros(N))  # musique (subit le sidechain)
DRM = (np.zeros(N), np.zeros(N))  # batterie
SFX = (np.zeros(N), np.zeros(N))  # sound design
VERB_SEND = (np.zeros(N), np.zeros(N))


# ---------------------------------------------------------------- instruments
def kick(gain=1.0, length=0.45, tone=48):
    t = t_arr(length)
    f = tone + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 7.5)
    click = hp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 300) * 0.25
    return np.tanh((body + click) * 1.6) * gain


def clap(gain=1.0):
    t = t_arr(0.35)
    n = bp(rng.standard_normal(len(t)), 900, 5000)
    e = np.zeros(len(t))
    for k, d in enumerate([0, 0.011, 0.022]):
        m = t >= d
        e[m] += np.exp(-(t[m] - d) * (90 if k < 2 else 22))
    return n * e * gain * 0.9


def hat(gain=1.0, open_=False):
    t = t_arr(0.25 if open_ else 0.06)
    n = hp(rng.standard_normal(len(t)), 7500, 4)
    return n * np.exp(-t * (16 if open_ else 80)) * gain


def pluck(freq, gain=1.0, length=0.35, cutoff=4200):
    t = t_arr(length)
    s = 0.6 * saw(freq, length) + 0.4 * np.sign(np.sin(2 * np.pi * freq * t))
    e = np.exp(-t * 9)
    s = sweep_lp(s, cutoff, 500, block=128, curve=0.6)
    return s * e * gain


def pad(freqs, d, gain=1.0, cutoff=2600, attack=0.4, release=0.8):
    out = np.zeros((2, int(d * SR)))
    for fq in freqs:
        out += supersaw(fq, d, voices=7, detune=0.16)
    out[0] = lp(out[0], cutoff)
    out[1] = lp(out[1], cutoff)
    e = env_adsr(out.shape[1], attack, 0.3, 0.85, release, d)
    return out * e * gain / max(len(freqs), 1)


def sub(freq, d, gain=1.0):
    t = t_arr(d)
    s = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(4 * np.pi * freq * t)
    e = env_adsr(len(t), 0.005, 0.1, 0.9, 0.05, d)
    return np.tanh(s * 1.3) * e * gain


def boom(gain=1.0, length=2.2):
    t = t_arr(length)
    f = 32 + 70 * np.exp(-t * 6)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    n = lp(rng.standard_normal(len(t)), 900) * np.exp(-t * 9) * 0.5
    return np.tanh((s + n) * 1.8) * gain


def riser(d, gain=1.0, f0=300, f1=9000):
    n = rng.standard_normal(int(d * SR))
    x = sweep_lp(n, f0, f1, curve=1.6)
    x = hp(x, 200)
    e = np.linspace(0, 1, len(x)) ** 2.2
    t = t_arr(d)
    pitch = 110 * 2 ** (t / d * 3)
    tone = np.sin(2 * np.pi * np.cumsum(pitch) / SR) * 0.25
    return (x + tone) * e * gain


def whoosh(d=0.45, gain=1.0, up=True):
    n = rng.standard_normal(int(d * SR))
    x = sweep_lp(n, 400 if up else 7000, 7000 if up else 400, curve=1.0)
    x = hp(x, 250)
    t = np.linspace(0, 1, len(x))
    e = np.sin(np.pi * t) ** 1.5
    return x * e * gain


def reverse_suck(d=0.8, gain=1.0):
    n = rng.standard_normal(int(d * SR))
    x = signal.fftconvolve(n * np.exp(-np.arange(len(n)) / SR * 6), IR_BIG[0])[: len(n)]
    x = x[::-1]
    x = hp(lp(x, 6000), 300)
    return x / (np.max(np.abs(x)) + 1e-9) * gain


def tick(freq=2400, gain=1.0):
    t = t_arr(0.04)
    s = np.sin(2 * np.pi * freq * t) * np.exp(-t * 160)
    n = hp(rng.standard_normal(len(t)), 4000) * np.exp(-t * 400) * 0.4
    return (s + n) * gain


def ui_click(gain=1.0):
    t = t_arr(0.06)
    s = np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 140) + np.sin(2 * np.pi * 900 * t) * np.exp(-t * 90) * 0.6
    n = bp(rng.standard_normal(len(t)), 2000, 9000) * np.exp(-t * 500) * 0.5
    return (s + n) * gain


def key_tap(gain=1.0):
    t = t_arr(0.03)
    n = bp(rng.standard_normal(len(t)), 1800 + rng.random() * 1500, 9000) * np.exp(-t * 350)
    return n * gain


def pop(freq=900, gain=1.0):
    t = t_arr(0.12)
    f = freq * (1 + 0.8 * np.exp(-t * 60))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 32) * gain


def chime(freqs, gain=1.0, length=1.6, spread=0.035):
    out = np.zeros((2, int(length * SR)))
    for i, fq in enumerate(freqs):
        t = t_arr(length - i * spread)
        s = (np.sin(2 * np.pi * fq * t) + 0.3 * np.sin(2 * np.pi * fq * 2.76 * t) * np.exp(-t * 6)) * np.exp(-t * 3.2)
        pan = (i / max(len(freqs) - 1, 1)) * 1.2 - 0.6
        i0 = int(i * spread * SR)
        out[0, i0 : i0 + len(s)] += s * np.cos((pan + 1) * np.pi / 4)
        out[1, i0 : i0 + len(s)] += s * np.sin((pan + 1) * np.pi / 4)
    return out * gain / len(freqs) * 1.6


# ---------------------------------------------------------------- 1. HOOK
H = TM["hook"]
add(lp(supersaw(note("A1"), 3.2, detune=0.08)[0], 300) * env_adsr(int(3.2 * SR), 1.0, 0.2, 1, 0.4, 3.2), 0, 0.35, 0, MUS)
add(sub(note("A1"), 3.0, 0.25), 0, 1, 0, MUS)


def count_at(f):
    t = min(1, max(0, f / H["countEnd"]))
    return round(3 + 44 * (1 - (1 - t) ** 2))


prev = 0
for f in range(0, H["countEnd"] + 1):
    c = count_at(f)
    if c != prev:
        for k in range(c - prev):
            jitter = k * 0.009
            add(tick(1500 + c * 30, 0.32), fr(f) + jitter, 1, rng.uniform(-0.7, 0.7), SFX)
            add(pop(500 + c * 18, 0.18), fr(f) + jitter, 1, rng.uniform(-0.8, 0.8), SFX)
        prev = c
land = fr(H["countEnd"])
add(kick(1.0, 0.7, 40), land, 0.9, 0, DRM)
add(boom(0.5, 1.4), land, 1, 0, SFX)
add(pad([note("A2"), note("C3"), note("D#3")], 0.9, 0.5, 1400, 0.005, 0.5), land, 1, 0, MUS)
add(whoosh(0.35, 0.35, up=False), fr(H["line1"] - 8), 1, -0.3, SFX)
add(boom(0.8, 2.0), fr(H["line2"]), 1, 0, SFX)
add(pad([note("A2"), note("E3"), note("A3"), note("C4")], 1.0, 0.55, 2200, 0.005, 0.7), fr(H["line2"]), 1, 0, MUS)
add(kick(0.9, 0.6, 38), fr(H["line2"]), 0.8, 0, DRM)

# ---------------------------------------------------------------- 2. PROBLÈME
P = TM["problem"]
p0 = fr(scene("problem"))
p_end = fr(scene("problem") + P["collapse"]) + 0.9
# Pulsation tendue en doubles-croches (basse filtrée), horloge en croches.
t = p0
while t < p_end - 0.05:
    k = int(round((t - p0) / (BEAT / 4)))
    fq = note("A1") if (k // 8) % 2 == 0 else note("A#1")
    add(pluck(fq, 0.5, 0.18, 900), t, 1, 0, MUS)
    if k % 2 == 0:
        add(tick(3800 if k % 4 == 0 else 3000, 0.12), t, 1, 0.4 if k % 4 else -0.4, SFX)
    t += BEAT / 4
add(pad([note("A2"), note("D#3"), note("G3")], p_end - p0, 0.32, 900, 1.2, 0.3), p0, 1, 0, MUS)
for b in P["beats"]:
    add(kick(0.9, 0.5, 42), fr(scene("problem") + b), 0.75, 0, DRM)
    add(whoosh(0.3, 0.25), fr(scene("problem") + b) - 0.12, 1, rng.uniform(-0.5, 0.5), SFX)
col = fr(scene("problem") + P["collapse"])
add(riser(col - p0 - 1.2 + 0.9, 0.42), p0 + 1.2, 1, 0, SFX)
add(reverse_suck(0.95, 0.75), col - 0.05, 1, 0, SFX)

# ---------------------------------------------------------------- 3. RÉVÉLATION
RV = TM["reveal"]
r0 = fr(scene("reveal"))
add(boom(1.0, 3.0), r0, 1, 0, SFX)
add(kick(1.0, 0.9, 36), r0, 1, 0, DRM)
crash = hp(rng.standard_normal(int(2.5 * SR)), 4000) * np.exp(-t_arr(2.5) * 2.2)
add(crash, r0, 0.22, 0, SFX)
add(pad([note("F2"), note("C3"), note("E3"), note("A3"), note("C4")], 3.2, 0.75, 3000, 0.02, 0.6), r0, 1, 0, MUS)
add(sub(note("F1"), 3.0, 0.35), r0, 1, 0, MUS)
add(chime([note("E6"), note("A6"), note("C7"), note("E7")], 0.55, 2.0), fr(scene("reveal") + RV["sparkle"]), 1, 0, SFX)
add(whoosh(0.5, 0.3), fr(scene("reveal") + RV["wordmark"]) - 0.1, 1, 0.2, SFX)
# arpège qui s'éveille
arp = ["A4", "C5", "E5", "A5"]
t = r0 + BEAT
i = 0
while t < fr(scene("demo")) - 0.01:
    add(pluck(note(arp[i % 4]), 0.16 + 0.1 * (t - r0) / 3, 0.3, 2500 + 900 * (t - r0)), t, 1, 0.3 if i % 2 else -0.3, MUS)
    t += BEAT / 2
    i += 1
add(whoosh(0.9, 0.35), fr(scene("reveal") + RV["exit"]) - 0.1, 1, -0.4, SFX)
add(riser(1.2, 0.3, 500, 10000), fr(scene("demo")) - 1.2, 1, 0, SFX)
# roulement de caisse claire avant le drop
for k in range(8):
    add(clap(0.15 + 0.05 * k), fr(scene("demo")) - 1.0 + k * BEAT / 4, 1, 0, DRM)

# ---------------------------------------------------------------- 4-5. GROOVE (démo + immersion)
g0 = fr(scene("demo"))
g1 = fr(scene("desire"))
CHORDS = [
    ("A", ["A3", "C4", "E4", "G4"], ["A4", "C5", "E5", "G5"]),
    ("F", ["F3", "A3", "C4", "E4"], ["F4", "A4", "C5", "E5"]),
    ("C", ["C3", "E3", "G3", "B3"], ["C5", "E5", "G5", "B5"]),
    ("G", ["G3", "B3", "D4", "F#4"], ["G4", "B4", "D5", "F#5"]),
]
ROOTS = {"A": "A1", "F": "F1", "C": "C2", "G": "G1"}
KICKS = []
bar = 0
t = g0
while t < g1 - 0.01:
    name, voicing, arpn = CHORDS[bar % 4]
    bar_d = 4 * BEAT
    intensity = 0.75 if t < fr(scene("immersion")) else 1.0
    add(pad([note(n) for n in voicing], bar_d + 0.3, 0.42 * intensity, 2400 + 600 * intensity, 0.05, 0.3), t, 1, 0, MUS)
    for b in range(4):
        tb = t + b * BEAT
        KICKS.append(tb)
        add(kick(0.95), tb, 0.85, 0, DRM)
        add(hat(0.22, True), tb + BEAT / 2, 1, 0.25, DRM)
        add(hat(0.12), tb + BEAT / 4, 1, -0.3, DRM)
        add(hat(0.12), tb + 3 * BEAT / 4, 1, -0.3, DRM)
        if b % 2 == 1:
            add(clap(0.5), tb, 1, 0, DRM)
        # basse : croches sur la fondamentale, octave en contretemps
        root = note(ROOTS[name])
        add(sub(root, BEAT / 2 - 0.02, 0.5), tb, 1, 0, MUS)
        add(lp(saw(root * 2, BEAT / 2 - 0.02), 700) * np.exp(-t_arr(BEAT / 2 - 0.02) * 6) * 0.3, tb + BEAT / 2, 1, 0, MUS)
    # arpège en doubles-croches
    pattern = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 3, 2, 1, 2]
    for k in range(16):
        tk = t + k * BEAT / 4
        add(pluck(note(arpn[pattern[k]]), 0.16 * intensity, 0.25, 3000 + 1500 * intensity), tk, 1, 0.45 if k % 2 else -0.45, MUS)
    if intensity > 0.9:
        # contre-chant aigu pendant l'immersion
        mel = {"A": ["E5", "G5"], "F": ["C6", "A5"], "C": ["G5", "E5"], "G": ["D6", "B5"]}[name]
        for k, n in enumerate(mel):
            add(pluck(note(n) * 1.0, 0.13, 0.9, 6000), t + k * 2 * BEAT + BEAT, 1, 0, MUS)
    t += bar_d
    bar += 1

D = TM["demo"]
d0 = scene("demo")
# frappe au clavier
for f in range(D["typeStart"], D["typeEnd"]):
    add(key_tap(0.22), fr(d0 + f) + rng.uniform(0, 0.02), 1, rng.uniform(-0.2, 0.2), SFX)
    if rng.random() < 0.25:
        add(key_tap(0.15), fr(d0 + f) + 0.017, 1, rng.uniform(-0.2, 0.2), SFX)
for c in [D["click1"], D["click2"], D["click3"]]:
    add(ui_click(0.5), fr(d0 + c), 1, 0.1, SFX)
add(tick(2600, 0.12), fr(d0 + D["hover"]), 1, -0.2, SFX)
for w in [D["diagIn"], D["planIn"], D["genIn"]]:
    add(whoosh(0.4, 0.28), fr(d0 + w) - 0.08, 1, rng.uniform(-0.4, 0.4), SFX)
# étapes de génération : blips montants
stage_notes = ["A5", "C6", "D6", "E6", "G6", "A6", "C7", "D7"]
for k in range(8):
    fstage = D["genIn"] + 4 + (D["ready"] - 2 - D["genIn"] - 4) * k / 7.99
    add(pop(note(stage_notes[k]), 0.16), fr(d0 + fstage), 1, (k / 7) - 0.5, SFX)
add(chime([note("A5"), note("C6"), note("E6"), note("A6")], 0.5, 1.4), fr(d0 + D["ready"]), 1, 0, SFX)
add(whoosh(0.5, 0.4), fr(scene("immersion")) - 0.25, 1, 0, SFX)
add(crash, fr(scene("immersion")), 0.12, 0, SFX)

IM = TM["immersion"]
i0 = scene("immersion")
for s in IM["shots"][1:]:
    add(whoosh(0.4, 0.26), fr(i0 + s - 7), 1, rng.uniform(-0.4, 0.4), SFX)
for c in [IM["check1"], IM["check2"]]:
    add(pop(1200, 0.3), fr(i0 + c), 1, 0.2, SFX)
    add(chime([note("E6"), note("B6")], 0.18, 0.6), fr(i0 + c), 1, 0, SFX)
for c in [IM["reveal"], IM["quizPick"], IM["quizNext"]]:
    add(ui_click(0.45), fr(i0 + c), 1, 0.1, SFX)
add(chime([note("C6"), note("E6"), note("G6"), note("C7")], 0.45, 1.4, 0.06), fr(i0 + IM["score"] + 4), 1, 0, SFX)
add(pop(700, 0.3), fr(i0 + IM["userMsg"]), 1, 0.3, SFX)
for k in range(3):
    add(tick(1800, 0.06), fr(i0 + IM["typingStart"]) + k * 0.1, 1, -0.2, SFX)
add(pop(1000, 0.22), fr(i0 + IM["answerStart"]), 1, -0.3, SFX)

# ---------------------------------------------------------------- 6. DÉSIR
DS = TM["desire"]
s0 = fr(scene("desire"))
s1 = fr(scene("cta"))
add(pad([note("F2"), note("A3"), note("C4"), note("E4"), note("A4")], 2.0, 0.6, 4000, 0.02, 0.2), s0, 1, 0, MUS)
add(pad([note("G2"), note("B3"), note("D4"), note("G4"), note("B4")], 2.0, 0.6, 4500, 0.05, 0.1), s0 + 2, 1, 0, MUS)
add(sub(note("F1"), 2.0, 0.5), s0, 1, 0, MUS)
add(sub(note("G1"), 2.0, 0.5), s0 + 2, 1, 0, MUS)
add(crash, s0, 0.18, 0, SFX)
for k, w in enumerate(DS["words"]):
    tw_ = fr(scene("desire") + w)
    add(kick(1.0), tw_, 0.95, 0, DRM)
    add(clap(0.35), tw_, 1, 0, DRM)
    add(whoosh(0.22, 0.22), tw_ - 0.06, 1, -0.5 + k * 0.33, SFX)
t = s0
while t < s0 + 2 - 0.01:
    add(hat(0.18, True), t + BEAT / 2, 1, 0.25, DRM)
    t += BEAT
# montée : caisse claire qui accélère + riser
t = s0 + 2
k = 0
while t < s1 - 0.02:
    add(clap(0.18 + 0.4 * (t - s0 - 2) / 2), t, 1, 0, DRM)
    t += BEAT / 2 if t < s0 + 3 else BEAT / 4
    k += 1
add(riser(2.0, 0.5, 300, 12000), s1 - 2.0, 1, 0, SFX)
for k in range(16):
    add(pluck(note(["A4", "B4", "D5", "G5"][k % 4]) * (1 if k < 8 else 2), 0.14, 0.2, 5000), s0 + 2 + k * BEAT / 4, 1, 0.4 if k % 2 else -0.4, MUS)

# ---------------------------------------------------------------- 7. CTA
CT = TM["cta"]
c0 = fr(scene("cta"))
add(boom(0.85, 2.5), c0, 1, 0, SFX)
add(kick(1.0, 0.9, 36), c0, 1, 0, DRM)
add(pop(800, 0.35), c0, 1, 0, SFX)
add(tick(2200, 0.2), fr(scene("cta") + CT["tab"] + 14), 1, 0, SFX)
add(kick(0.6, 0.5, 44), fr(scene("cta") + CT["line2"]), 0.6, 0, DRM)
add(whoosh(0.6, 0.35), fr(scene("cta") + CT["morph"]) - 0.2, 1, 0, SFX)
add(boom(0.7, 2.6), fr(scene("cta") + CT["morph"]) + 0.45, 1, 0, SFX)
add(crash, fr(scene("cta") + CT["morph"]) + 0.45, 0.16, 0, SFX)
add(chime([note("C6"), note("E6"), note("G6"), note("B6"), note("D7")], 0.6, 2.4, 0.05), fr(scene("cta") + CT["morph"]) + 0.5, 1, 0, SFX)
end_d = DUR - c0
add(pad([note("C3"), note("G3"), note("B3"), note("D4"), note("E4"), note("G4")], end_d, 0.62, 3200, 0.05, 1.6), c0, 1, 0, MUS)
add(sub(note("C2"), end_d - 0.4, 0.4) * np.linspace(1, 0, int((end_d - 0.4) * SR)) ** 0.5, c0, 1, 0, MUS)
add(pop(1100, 0.3), fr(scene("cta") + CT["button"]), 1, 0, SFX)
add(chime([note("G6"), note("C7"), note("E7")], 0.3, 1.2, 0.04), fr(scene("cta") + CT["shimmer"]), 1, 0, SFX)
arp = ["C5", "E5", "G5", "B5", "D6", "B5", "G5", "E5"]
t = fr(scene("cta") + CT["morph"]) + 0.5
k = 0
while t < DUR - 1.0:
    fade = max(0.0, 1 - (t - c0) / end_d)
    add(pluck(note(arp[k % 8]), 0.13 * fade + 0.03, 0.4, 4000), t, 1, 0.4 if k % 2 else -0.4, MUS)
    t += BEAT / 2
    k += 1

# ---------------------------------------------------------------- mixage
# Sidechain : la musique "respire" sur chaque kick du groove.
sc = np.ones(N)
tt = np.arange(N) / SR
for tk in KICKS + [fr(scene("desire") + w) for w in DS["words"]]:
    i = int(tk * SR)
    n = int(0.28 * SR)
    seg = 1 - 0.55 * np.exp(-np.arange(min(n, N - i)) / SR / 0.075)
    sc[i : i + len(seg)] = np.minimum(sc[i : i + len(seg)], seg)

mus_l, mus_r = MUS[0] * sc, MUS[1] * sc
rl, rr = convolve_bus(mus_l, mus_r, IR_BIG, 0.35)
sl, sr = convolve_bus(SFX[0], SFX[1], IR_BIG, 0.22)
dl, dr = convolve_bus(DRM[0], DRM[1], IR_ROOM, 0.12)

L = mus_l * 0.9 + rl + DRM[0] * 0.8 + dl + SFX[0] * 0.95 + sl
R = mus_r * 0.9 + rr + DRM[1] * 0.8 + dr + SFX[1] * 0.95 + sr

# Silence dramatique juste avant la révélation.
gap0, gap1 = fr(scene("reveal")) - 0.11, fr(scene("reveal"))
gm = np.ones(N)
gm[int(gap0 * SR) : int(gap1 * SR)] = np.linspace(1, 0.05, int(gap1 * SR) - int(gap0 * SR))
L *= gm
R *= gm

# Coupe les infra-basses inutiles, léger glue, fondu de fin.
L, R = hp(L, 28), hp(R, 28)
fade = np.ones(N)
fn = int(1.2 * SR)
fade[-fn:] = np.linspace(1, 0, fn) ** 2
L, R = L * fade, R * fade
peak = max(np.max(np.abs(L)), np.max(np.abs(R)))
L, R = L / peak * 0.8, R / peak * 0.8
L, R = np.tanh(L * 1.3) / np.tanh(1.3), np.tanh(R * 1.3) / np.tanh(1.3)

raw = ROOT / "audio/soundtrack_raw.wav"
from scipy.io import wavfile

wavfile.write(raw, SR, (np.vstack([L, R]).T * 32767 * 0.9).astype(np.int16))
out = ROOT / "public/audio/soundtrack.wav"
# Normalisation STATIQUE (gain fixe + limiteur) : préserve les contrastes
# (silence avant la révélation, montée, impacts), contrairement à loudnorm
# en une passe qui compresse dynamiquement.
meas = subprocess.run(
    ["ffmpeg", "-hide_banner", "-i", str(raw), "-af", "ebur128", "-f", "null", "-"],
    capture_output=True, text=True,
).stderr
integrated = float(meas.split("Integrated loudness:")[1].split("I:")[1].split("LUFS")[0])
gain = -14.0 - integrated
subprocess.run(
    ["ffmpeg", "-loglevel", "error", "-y", "-i", str(raw), "-af",
     f"volume={gain:.2f}dB,alimiter=limit=0.85:attack=3:release=60:level=disabled",
     "-ar", "48000", "-c:a", "pcm_s24le", str(out)],
    check=True,
)
print("ok", out, f"{DUR:.2f}s")
