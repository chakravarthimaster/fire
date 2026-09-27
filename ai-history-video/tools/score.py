#!/usr/bin/env python3
"""Synthesize the soundtrack of The Thinking Machine.

Everything here is generated from raw waveforms with numpy/scipy: the score
(pads, strings, choir, felt piano, music box, pulses, drums, impacts), the
sound design (typewriters, teletypes, chess pieces, Go stones, wind, frost,
risers...) and the final mix with the narration.

Inputs:  build/timeline.json   (scene timing, narration placement, sound cues)
         build/vo/*.wav        (narration clips from tools/narrate.py)
Outputs: build/mix.wav         (48 kHz stereo, peak-limited)
         build/subtitles.srt   (narration subtitles)
"""
import json
import os
import sys

import numpy as np
import soundfile as sf
from scipy import signal
from scipy.ndimage import maximum_filter1d, minimum_filter1d

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "build")
SR = 48000
RNG = np.random.default_rng(1956)


# ---------------------------------------------------------------- basics
def ns(sec):
    return max(1, int(round(sec * SR)))


def tv(n):
    return np.arange(n) / SR


def mtof(m):
    return 440.0 * 2.0 ** ((np.asarray(m, dtype=float) - 69.0) / 12.0)


def noise(n, rng=None):
    return (rng or RNG).standard_normal(n)


def _sos(kind, fc, order):
    nyq = SR / 2
    if kind == "band":
        lo, hi = fc
        return signal.butter(order, [max(15, lo) / nyq, min(hi, nyq * 0.95) / nyq], btype="band", output="sos")
    return signal.butter(order, min(max(fc, 15), nyq * 0.95) / nyq, btype=kind, output="sos")


def lpf(x, fc, order=2):
    return signal.sosfilt(_sos("low", fc, order), x, axis=-1)


def hpf(x, fc, order=2):
    return signal.sosfilt(_sos("high", fc, order), x, axis=-1)


def bpf(x, lo, hi, order=2):
    return signal.sosfilt(_sos("band", (lo, hi), order), x, axis=-1)


def reson(x, f0, q):
    b, a = signal.iirpeak(min(f0, SR * 0.45) / (SR / 2), q)
    return signal.lfilter(b, a, x, axis=-1)


def sweep(x, fc, kind="band", q=1.5, block=256):
    """Time-varying second-order filter; fc is a per-sample frequency curve."""
    y = np.zeros_like(x)
    zi = np.zeros(2)
    n = len(x)
    for i in range(0, n, block):
        f = float(np.clip(fc[min(i + block // 2, n - 1)], 30, SR * 0.44))
        if kind == "band":
            b, a = signal.iirpeak(f / (SR / 2), q)
        else:
            b, a = signal.butter(2, f / (SR / 2), "low" if kind == "low" else "high")
        seg, zi = signal.lfilter(b, a, x[i:i + block], zi=zi)
        y[i:i + block] = seg
    return y


def smooth(x, sec):
    a = np.exp(-1.0 / max(1.0, sec * SR))
    return signal.lfilter([1 - a], [1, -a], x)


def pan(x, p):
    th = (np.clip(p, -1, 1) + 1) * np.pi / 4
    return np.stack([x * np.cos(th), x * np.sin(th)])


def stereo(x):
    return x if x.ndim == 2 else np.stack([x, x]) * 0.7071


def env_ar(n, a, r):
    e = np.ones(n)
    na, nr = min(n, ns(a)) if a > 0 else 0, min(n, ns(r)) if r > 0 else 0
    if na:
        e[:na] = np.sin(np.linspace(0, np.pi / 2, na)) ** 2
    if nr:
        e[n - nr:] *= np.cos(np.linspace(0, np.pi / 2, nr)) ** 2
    return e


def env_exp(n, tau, a=0.002):
    e = np.exp(-tv(n) / tau)
    na = min(n, ns(a))
    e[:na] *= np.linspace(0, 1, na)
    return e


# ------------------------------------------------------------ oscillators
def _phase(freq, n, ph0):
    if np.isscalar(freq) or np.ndim(freq) == 0:
        dt = float(freq) / SR
        return (ph0 + np.arange(n) * dt) % 1.0, np.full(n, dt)
    dt = np.asarray(freq, dtype=float) / SR
    return (ph0 + np.cumsum(dt)) % 1.0, dt


def saw(freq, n, ph0=0.0):
    """Band-limited sawtooth (polyBLEP)."""
    ph, dt = _phase(freq, n, ph0)
    y = 2 * ph - 1
    m = ph < dt
    tt = ph[m] / dt[m]
    y[m] -= tt + tt - tt * tt - 1
    m = ph > 1 - dt
    tt = (ph[m] - 1) / dt[m]
    y[m] -= tt * tt + tt + tt + 1
    return y


def sine(freq, n, ph0=0.0):
    ph, _ = _phase(freq, n, ph0)
    return np.sin(2 * np.pi * ph)


# ------------------------------------------------------------ instruments
def pad(midis, dur, attack=1.5, release=2.5, cutoff=1600, detune=0.14, voices=5, vib=0.0, seed=0, order=4):
    n = ns(dur + release)
    rng = np.random.default_rng(seed)
    t = tv(n)
    out = np.zeros((2, n))
    for m in midis:
        f = float(mtof(m))
        for v in range(voices):
            d = (v / (voices - 1)) * 2 - 1 if voices > 1 else 0.0
            fv = f * 2 ** (d * detune / 12)
            if vib:
                fv = fv * (1 + vib * np.sin(2 * np.pi * (4.6 + rng.random()) * t + rng.random() * 6))
            out += pan(saw(fv, n, rng.random()), d * 0.8)
    out = lpf(out, cutoff, order)
    return out * env_ar(n, attack, release) / np.sqrt(len(midis) * voices)


def strings(midis, dur, attack=2.0, release=3.0, cutoff=2400, seed=0):
    return pad(midis, dur, attack, release, cutoff, detune=0.09, voices=4, vib=0.0045, seed=seed)


def choir(midis, dur, attack=2.2, release=3.0, vowel="ah", seed=0):
    base = pad(midis, dur, attack, release, cutoff=6000, detune=0.1, voices=4, vib=0.006, seed=seed, order=2)
    forms = {"ah": [(710, 6, 1.0), (1100, 7, 0.55), (2640, 9, 0.22)], "oo": [(360, 5, 1.0), (820, 6, 0.35), (2450, 9, 0.08)]}[vowel]
    y = sum(g * reson(base, f, q) for f, q, g in forms)
    return y * 1.6 + 0.2 * lpf(base, 500)


def piano(m, vel=0.6, dur=5.0, bright=0.5, seed=None):
    f = float(mtof(m))
    n = ns(dur)
    t = tv(n)
    rng = np.random.default_rng(int(m * 7 + (seed or 0)))
    y = np.zeros(n)
    B = 0.00035
    for k in range(1, 16):
        fk = k * f * np.sqrt(1 + B * k * k)
        if fk > 11000:
            break
        amp = (1.0 / k ** 1.15) * np.exp(-(k - 1) * (0.42 - 0.25 * bright))
        tl = (3.8 if f < 300 else 2.8) / (1 + 0.28 * (k - 1)) * (220 / max(f, 110)) ** 0.35
        ts = 0.28 / (1 + 0.2 * k)
        e = 0.62 * np.exp(-t / tl) + 0.38 * np.exp(-t / ts)
        y += amp * e * (np.sin(2 * np.pi * fk * t + rng.random() * 6) + 0.5 * np.sin(2 * np.pi * fk * 1.0006 * t + rng.random() * 6)) / 1.5
    na = ns(0.004)
    y[:na] *= np.linspace(0, 1, na)
    hn = ns(0.025)
    y[:hn] += lpf(rng.standard_normal(hn) * np.exp(-tv(hn) / 0.005), 1400) * 0.12
    y = lpf(y, 2200 + 4200 * bright * vel)
    y *= env_ar(n, 0, 0.4) * vel
    return pan(y, float(np.clip((m - 64) / 32, -0.55, 0.55)))


def musicbox(m, vel=0.6, dur=3.0):
    f = float(mtof(m))
    n = ns(dur)
    t = tv(n)
    y = np.zeros(n)
    for r, a, d in [(1.0, 1.0, 2.0), (2.756, 0.42, 0.65), (5.404, 0.22, 0.32), (8.933, 0.1, 0.16)]:
        y += a * np.exp(-t / d) * np.sin(2 * np.pi * f * r * t)
    cn = ns(0.004)
    y[:cn] += hpf(noise(cn), 3000) * 0.25
    y *= env_ar(n, 0.001, 0.3)
    return pan(y * vel * 0.5, float(np.clip((m - 72) / 18, -0.5, 0.5)))


def bell(m, vel=0.5, dur=4.0, ratio=3.5, index=2.0, decay=1.6, p=0.0):
    fc = float(mtof(m))
    n = ns(dur)
    t = tv(n)
    ind = index * np.exp(-t / (decay * 0.35))
    y = np.sin(2 * np.pi * fc * t + ind * np.sin(2 * np.pi * fc * ratio * t)) * np.exp(-t / decay)
    y *= env_ar(n, 0.002, 0.2)
    return pan(y * vel * 0.5, p)


def epiano(m, vel=0.5, dur=3.2):
    f = float(mtof(m))
    n = ns(dur)
    t = tv(n)
    ind = 1.6 * vel * np.exp(-t / 0.22)
    y = np.sin(2 * np.pi * f * t + ind * np.sin(2 * np.pi * f * t)) * (0.7 * np.exp(-t / 1.9) + 0.3 * np.exp(-t / 0.35))
    y += 0.12 * vel * np.sin(2 * np.pi * f * 14 * t) * np.exp(-t / 0.04)
    y *= env_ar(n, 0.002, 0.3)
    trem = 0.5 + 0.5 * np.sin(2 * np.pi * 4.3 * t)
    return np.stack([y * (0.65 + 0.35 * trem), y * (1.0 - 0.35 * trem)]) * vel * 0.45


def pluck(m, vel=0.6, dur=0.7, bright=3200, dark=450, decay=0.2, p=0.0):
    f = float(mtof(m))
    n = ns(dur)
    t = tv(n)
    s = saw(f, n) + 0.6 * saw(f * 1.004, n, 0.37)
    k = np.exp(-t / (decay * 0.45))
    y = (lpf(s, bright) * k + lpf(s, dark) * (1 - k)) * np.exp(-t / decay)
    y *= env_ar(n, 0.002, 0.06)
    return pan(y * vel * 0.35, p)


def bass(m, dur, vel=0.7, cutoff=260):
    f = float(mtof(m))
    n = ns(dur + 0.3)
    t = tv(n)
    y = 0.55 * saw(f, n) + 0.8 * np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f / 2 * t)
    y = lpf(y, cutoff, 4) * env_ar(n, 0.01, 0.3)
    return stereo(y * vel * 0.5)


def theremin(events, total, vel=0.5):
    """events: [(t_rel, midi, dur)], portamento between notes."""
    n = ns(total + 1.0)
    t = tv(n)
    curve = np.full(n, float(events[0][1]))
    gate = np.zeros(n)
    for tr, m, d in events:
        i0, i1 = ns(tr), min(n, ns(tr + d))
        curve[i0:] = m
        gate[i0:i1] = 1.0
    curve = smooth(smooth(curve, 0.05), 0.05)
    gate = smooth(smooth(gate, 0.08), 0.12)
    vib = 1 + 0.011 * np.sin(2 * np.pi * 6.1 * t) * smooth(gate, 0.4)
    f = mtof(curve) * vib
    y = sine(f, n) + 0.14 * sine(2 * f, n) + 0.05 * sine(3 * f, n)
    return stereo(y * gate * vel * 0.3)


def kick(vel=1.0):
    n = ns(0.55)
    t = tv(n)
    y = sine(44 + 120 * np.exp(-t / 0.03), n) * np.exp(-t / 0.3)
    cn = ns(0.004)
    y[:cn] += hpf(noise(cn), 1500) * 0.3
    return stereo(y * vel)


def tom(freq=100, vel=1.0, decay=0.45):
    n = ns(1.2)
    t = tv(n)
    y = sine(freq * (1 + 0.7 * np.exp(-t / 0.04)), n) * np.exp(-t / decay)
    y += lpf(noise(n), 900) * np.exp(-t / 0.06) * 0.35
    return stereo(y * vel)


def hat(vel=0.3, open_=False):
    n = ns(0.3 if open_ else 0.09)
    y = hpf(noise(n), 7000, 4) * np.exp(-tv(n) / (0.12 if open_ else 0.018))
    return pan(y * vel, 0.25)


def snare(vel=0.6):
    n = ns(0.35)
    t = tv(n)
    y = bpf(noise(n), 1200, 7000) * np.exp(-t / 0.12) * 0.8 + sine(185, n) * np.exp(-t / 0.05) * 0.6
    return stereo(y * vel)


# ------------------------------------------------------------ sound design
def braam(size=1.0, root=26, cold=False, major=False, seed=0):
    dur = 4.0 + 2.5 * size
    n = ns(dur)
    t = tv(n)
    rng = np.random.default_rng(seed)
    out = np.zeros((2, n))
    notes = [root, root + 12, root + 19, root + 24] + ([root + 28] if major else [])
    for ch in range(2):
        s = np.zeros(n)
        for m in notes:
            for d in (-0.06, 0.07):
                s += saw(float(mtof(m)) * 2 ** (d / 12 + (ch - 0.5) * 0.002), n, rng.random())
        lo = lpf(s, 160, 4)
        hi = lpf(s, 1200 + 1600 * size, 2)
        fe = (1 - np.exp(-t / 0.06)) * np.exp(-t / (0.7 + 0.7 * size))
        y = lo * (1 - fe) + hi * fe
        y = np.tanh(2.0 * y / (np.max(np.abs(y)) + 1e-9) * 2.2)
        out[ch] = y
    amp = env_exp(n, 1.2 + 1.8 * size, 0.015) * env_ar(n, 0, 1.0)
    out *= amp * 0.55
    sub = sine(float(mtof(root)) * (1 + 0.9 * np.exp(-t / 0.07)), n) * np.exp(-t / (1.6 + size))
    out += stereo(sub * 0.9)
    if cold:
        ice = np.zeros(n)
        for f, d in [(2130, 2.4), (3310, 1.9), (4720, 1.5), (6140, 1.2), (7900, 0.9)]:
            ice += np.sin(2 * np.pi * f * t + rng.random() * 6) * np.exp(-t / d) * (0.5 + 0.5 * np.sin(2 * np.pi * (3 + rng.random() * 4) * t))
        out += pan(ice * 0.05, 0.3) + pan(ice * 0.04, -0.3)
    return out * size ** 0.5


def boom(size=1.0):
    n = ns(3.0)
    t = tv(n)
    y = sine(30 + 75 * np.exp(-t / 0.1), n) * np.exp(-t / (0.7 + 0.8 * size))
    y += lpf(noise(n), 280) * np.exp(-t / 0.18) * 0.7
    cn = ns(0.008)
    y[:cn] += hpf(noise(cn), 900) * 0.3
    return stereo(y * size)


def riser(dur, size=1.0, seed=0):
    n = ns(dur)
    t = tv(n)
    u = t / dur
    rng = np.random.default_rng(seed)
    fc = 220 * (7000 / 220) ** (u ** 1.25)
    out = np.zeros((2, n))
    for ch in range(2):
        out[ch] = sweep(rng.standard_normal(n), fc * (1 + 0.04 * ch), "band", 1.3) * u ** 2.4
    tone = lpf(saw(mtof(45 + 26 * u ** 1.4), n) + saw(mtof(45.1 + 26 * u ** 1.4), n, 0.5), 2500) * u ** 3 * 0.35
    out += stereo(tone)
    out *= env_ar(n, 0.05, 0.03)
    return out * size * 0.5


def whoosh(dur=0.9, size=1.0, seed=0):
    n = ns(dur)
    t = tv(n)
    u = t / dur
    rng = np.random.default_rng(seed)
    bell_ = np.sin(np.pi * u) ** 2
    fc = 350 + 3800 * bell_
    L = sweep(rng.standard_normal(n), fc, "band", 1.1) * bell_
    R = sweep(rng.standard_normal(n), fc * 1.07, "band", 1.1) * bell_
    return np.stack([L * (1.2 - u), R * (0.2 + u)]) * size * 0.35


def shimmer(dur=2.5, density=22, seed=0, notes=(86, 88, 93, 95, 98, 100, 105), vel=1.0):
    rng = np.random.default_rng(seed)
    n = ns(dur + 1.2)
    out = np.zeros((2, n))
    for _ in range(int(density * dur)):
        t0 = rng.random() * dur
        m = rng.choice(notes)
        d = 0.25 + rng.random() * 0.6
        gn = ns(d)
        g = np.sin(2 * np.pi * float(mtof(m)) * tv(gn)) * np.hanning(gn) * (0.3 + 0.7 * rng.random())
        i0 = ns(t0)
        seg = pan(g, rng.random() * 1.6 - 0.8)
        out[:, i0:i0 + gn] += seg[:, : n - i0]
    return out * 0.05 * vel


def wind(dur, level=1.0, seed=0):
    n = ns(dur)
    t = tv(n)
    rng = np.random.default_rng(seed)
    out = np.zeros((2, n))
    for ch in range(2):
        brown = signal.lfilter([1], [1, -0.996], rng.standard_normal(n)) * 0.04
        lfo = smooth(np.repeat(rng.random(int(dur * 2) + 2), ns(0.5))[:n], 0.6)
        fc = 280 + 1100 * lfo
        y = sweep(brown, fc, "band", 0.8)
        out[ch] = y * (0.5 + 0.6 * lfo)
    return out * env_ar(n, min(2.0, dur / 3), min(2.5, dur / 3)) * level * 1.4


def key(heavy=0.0, seed=0, kind="type"):
    rng = np.random.default_rng(seed)
    n = ns(0.14)
    t = tv(n)
    exc = rng.standard_normal(n) * np.exp(-t / 0.0025)
    if kind == "type":
        y = reson(exc, 1700 + 500 * rng.random(), 9) * 0.5 + reson(exc, 3600 + 800 * rng.random(), 14) * 0.25
        y += np.sin(2 * np.pi * (140 + 50 * rng.random()) * t) * np.exp(-t / 0.028) * (0.35 + 0.45 * heavy)
        gain = 0.55 + 0.25 * heavy
    elif kind == "teletype":
        y = reson(exc, 2600 + 900 * rng.random(), 12) * 0.5 + reson(exc, 900 + 200 * rng.random(), 7) * 0.3
        gain = 0.42
    elif kind == "soft":
        y = lpf(reson(exc, 1200 + 300 * rng.random(), 5), 3500) * 0.6
        gain = 0.28
    else:  # backspace
        y = lpf(reson(exc, 950 + 150 * rng.random(), 5), 3000) * 0.6
        gain = 0.3
    return pan(y * gain * (0.8 + 0.4 * rng.random()), rng.random() * 0.4 - 0.2)


def modal(freqs_q_amp, dur=0.5, exc_tau=0.002, seed=0, gain=1.0):
    rng = np.random.default_rng(seed)
    n = ns(dur)
    exc = rng.standard_normal(n) * np.exp(-tv(n) / exc_tau)
    return sum(a * reson(exc, f, q) for f, q, a in freqs_q_amp) * gain


def chess(seed=0):
    y = modal([(820, 14, 0.8), (1870, 16, 0.5), (3050, 20, 0.25)], 0.5, 0.003, seed)
    y += np.sin(2 * np.pi * 115 * tv(len(y))) * np.exp(-tv(len(y)) / 0.04) * 0.5
    return pan(y * 0.9, 0.1)


def stone(big=False, seed=0):
    y = modal([(3150, 28, 0.8), (5200, 30, 0.35), (1900, 18, 0.2), (175, 5, 0.45)], 0.6, 0.0012, seed)
    return pan(y * (1.4 if big else 0.7), 0.15 if not big else 0.0)


def relay(seed=0):
    a = modal([(4200, 25, 0.5), (2300, 15, 0.3)], 0.12, 0.001, seed)
    b = modal([(4000, 25, 0.4), (2100, 15, 0.25)], 0.12, 0.001, seed + 1)
    y = np.zeros(ns(0.15))
    y[: len(a)] += a
    y[ns(0.009): ns(0.009) + len(b)] += b[: len(y) - ns(0.009)]
    return pan(y * 0.45, -0.2)


def beep(freqs, each=0.07, vel=0.12, square=False):
    parts = []
    for f in freqs:
        n = ns(each)
        s = sine(f, n)
        if square:
            s = np.tanh(4 * s)
        parts.append(s * env_ar(n, 0.004, 0.02))
    y = np.concatenate(parts)
    return pan(lpf(y, 5000) * vel, 0.2)


def glide(f0, f1, dur=0.14, vel=0.1):
    n = ns(dur)
    f = f0 * (f1 / f0) ** (tv(n) / dur)
    return pan(sine(f, n) * env_ar(n, 0.005, 0.05) * vel, 0.0)


def crack():
    y = modal([(2600, 6, 0.6), (1650, 6, 0.5), (820, 5, 0.4)], 1.2, 0.006, 3)
    n = len(y)
    y += lpf(noise(n), 3000) * np.exp(-tv(n) / 0.05) * 0.4
    y += np.sin(2 * np.pi * 55 * tv(n)) * np.exp(-tv(n) / 0.2) * 0.5
    return stereo(y * 0.8)


def frost(dur, seed=0):
    rng = np.random.default_rng(seed)
    n = ns(dur + 0.5)
    out = np.zeros((2, n))
    for _ in range(int(40 * dur)):
        t0 = rng.random() * dur
        c = modal([(6000 + rng.random() * 4000, 30, 1.0)], 0.08, 0.0005, int(rng.integers(1e6)))
        i0 = ns(t0)
        seg = pan(c * (0.1 + 0.2 * rng.random()), rng.random() * 1.8 - 0.9)
        out[:, i0:i0 + seg.shape[1]] += seg[:, : n - i0]
    for _ in range(4):
        t0 = rng.random() * dur * 0.7
        g = glide(1800 + rng.random() * 1500, 4000 + rng.random() * 3000, 0.9, 0.03)
        i0 = ns(t0)
        out[:, i0:i0 + g.shape[1]] += g[:, : n - i0]
    return out


def ticking(dur, rate=2.0):
    n = ns(dur + 0.3)
    out = np.zeros((2, n))
    k = 0
    while k / rate < dur:
        c = modal([(3100 if k % 2 == 0 else 2350, 22, 0.6), (900, 8, 0.25)], 0.1, 0.0008, k)
        i0 = ns(k / rate)
        seg = pan(c * 0.35, 0.3 if k % 2 == 0 else -0.3)
        out[:, i0:i0 + seg.shape[1]] += seg[:, : n - i0]
        k += 1
    return out * env_ar(n, 0.5, 1.0)


def iris(dur):
    n = ns(dur + 0.3)
    out = np.zeros((2, n))
    t = 0.0
    k = 0
    while t < dur:
        u = t / dur
        c = modal([(2200 + 900 * u, 18, 0.5), (3700 + 900 * u, 22, 0.3)], 0.06, 0.0006, k)
        i0 = ns(t)
        seg = pan(c * 0.3, 0.0)
        out[:, i0:i0 + seg.shape[1]] += seg[:, : n - i0]
        t += 1.0 / (8 + 26 * u)
        k += 1
    groan = lpf(saw(55 + 20 * tv(n) / dur, n), 300) * env_ar(n, 0.2, 0.3) * 0.12
    return out + stereo(groan)


def loom(dur):
    n = ns(dur + 0.5)
    out = np.zeros((2, n))
    k = 0
    while k * 0.36 < dur:
        c = modal([(620, 10, 0.6), (1250, 12, 0.3)], 0.2, 0.002, k)
        i0 = ns(k * 0.36)
        seg = pan(c * 0.3, -0.5 if k % 2 else 0.5)
        out[:, i0:i0 + seg.shape[1]] += seg[:, : n - i0]
        k += 1
    return out * env_ar(n, 0.3, 1.0)


def summer(dur, seed=0):
    rng = np.random.default_rng(seed)
    n = ns(dur)
    out = np.zeros((2, n))
    for _ in range(int(dur * 3)):  # crickets
        t0 = rng.random() * dur
        cn = ns(0.12)
        tt = tv(cn)
        c = np.sin(2 * np.pi * 4600 * tt) * (np.sin(2 * np.pi * 30 * tt) > 0) * np.hanning(cn)
        i0 = ns(t0)
        seg = pan(c * 0.02, rng.random() * 1.6 - 0.8)
        out[:, i0:i0 + cn] += seg[:, : n - i0]
    for _ in range(int(dur / 3)):  # distant birds
        t0 = rng.random() * dur
        bn = ns(0.25)
        tt = tv(bn)
        f = 2500 + 1400 * np.sin(2 * np.pi * (6 + rng.random() * 6) * tt)
        c = sine(f, bn) * np.hanning(bn)
        i0 = ns(t0)
        seg = pan(lpf(c, 5000) * 0.012, rng.random() * 1.6 - 0.8)
        out[:, i0:i0 + bn] += seg[:, : n - i0]
    return out * env_ar(n, 1.5, 2.0)


def hum(dur):
    n = ns(dur)
    t = tv(n)
    y = 0.5 * np.sin(2 * np.pi * 60 * t) + 0.25 * np.sin(2 * np.pi * 120 * t) + 0.12 * np.sin(2 * np.pi * 180 * t)
    y += bpf(noise(n), 200, 900) * 0.05
    return stereo(y * env_ar(n, 1.0, 1.0) * 0.035)


def projector(dur):
    n = ns(dur)
    t = tv(n)
    clicks = np.zeros(n)
    idx = (np.arange(0, dur, 1 / 24) * SR).astype(int)
    clicks[idx[idx < n]] = 1.0
    y = reson(clicks, 1300, 6) * 0.5 + reson(clicks, 3100, 10) * 0.2
    y += bpf(noise(n), 250, 700) * 0.12 * (0.8 + 0.2 * np.sin(2 * np.pi * 24 * t))
    return stereo(y * env_ar(n, 0.6, 0.8) * 0.12)


def pencil(dur, seed=0):
    rng = np.random.default_rng(seed)
    n = ns(dur)
    strokes = smooth(np.abs(np.repeat(rng.standard_normal(int(dur * 14) + 2), ns(1 / 14))[:n]), 0.02)
    y = bpf(rng.standard_normal(n), 2200, 7000) * strokes
    return pan(y * env_ar(n, 0.05, 0.1) * 0.15, 0.2)


def marker(dur):
    n = ns(dur)
    t = tv(n)
    y = bpf(noise(n), 900, 4000) * 0.3 + np.sin(2 * np.pi * (1500 + 100 * np.sin(2 * np.pi * 7 * t)) * t) * 0.05
    return pan(y * env_ar(n, 0.05, 0.15) * 0.25, 0.1)


def thud():
    n = ns(0.6)
    t = tv(n)
    y = np.sin(2 * np.pi * 70 * t) * np.exp(-t / 0.12) + bpf(noise(n), 700, 3500) * np.exp(-t / 0.03) * 0.6
    return stereo(y * 0.7)


def datastream(dur, seed=0):
    rng = np.random.default_rng(seed)
    n = ns(dur + 0.2)
    out = np.zeros((2, n))
    t = 0.0
    while t < dur:
        bn = ns(0.012 + rng.random() * 0.02)
        f = 700 + rng.random() * 2600
        b = np.tanh(3 * np.sin(2 * np.pi * f * tv(bn))) * np.hanning(bn)
        i0 = ns(t)
        seg = pan(b * 0.035, rng.random() * 1.6 - 0.8)
        out[:, i0:i0 + bn] += seg[:, : n - i0]
        t += 0.02 + rng.random() * 0.05
    return hpf(out, 500) * env_ar(n, 0.3, 0.4)


def gpu(dur):
    n = ns(dur)
    t = tv(n)
    rise = np.minimum(1, t / (dur * 0.6))
    y = lpf(saw(100 + 40 * rise, n), 1500) * 0.3 + bpf(noise(n), 300, 1400) * 0.25
    y += np.sin(2 * np.pi * (2000 + 3000 * rise) * t) * 0.02
    return stereo(y * env_ar(n, 0.4, 0.4) * rise * 0.35)


def powerdown():
    n = ns(1.6)
    t = tv(n)
    f = 700 * (40 / 700) ** (t / 1.6)
    y = lpf(saw(f, n), 1800) * np.exp(-t / 0.7) * 0.4 + np.sin(2 * np.pi * 50 * t) * np.exp(-t / 0.25) * 0.5
    return stereo(y * 0.6)


def pop(idx=0):
    n = ns(0.12)
    t = tv(n)
    f0 = 520 * 1.25 ** idx
    y = sine(f0 * (1 + 0.8 * np.exp(-t / 0.01)), n) * np.exp(-t / 0.04)
    return pan(y * 0.22, (idx - 1.5) * 0.3)


def swell(dur):
    n = ns(dur)
    u = tv(n) / dur
    L = hpf(noise(n), 2500) * u ** 3
    R = hpf(noise(n), 2500) * u ** 3
    return np.stack([L, R]) * env_ar(n, 0, 0.05) * 0.12


def dissolve(dur, seed=0):
    rng = np.random.default_rng(seed)
    n = ns(dur + 0.5)
    out = np.zeros((2, n))
    for _ in range(int(160 * dur)):
        t0 = rng.random() * dur
        u = t0 / dur
        gn = ns(0.02 + rng.random() * 0.05)
        g = hpf(rng.standard_normal(gn), 3500) * np.hanning(gn) * (0.3 + 0.7 * rng.random())
        i0 = ns(t0)
        seg = pan(g * 0.035 * np.sin(np.pi * u), -0.9 + 1.8 * u)
        out[:, i0:i0 + gn] += seg[:, : n - i0]
    return out


def spike():
    n = ns(0.12)
    t = tv(n)
    y = sine(300 * (3 ** (t / 0.12)), n) * np.exp(-t / 0.05) * 0.4 + bpf(noise(n), 1000, 3500) * np.exp(-t / 0.02) * 0.3
    return stereo(y * 0.35)


def fold(dur, seed=0):
    rng = np.random.default_rng(seed)
    n = ns(dur + 1.0)
    out = np.zeros((2, n))
    notes = [62, 65, 67, 69, 72, 74, 77, 79, 81, 84]
    k = 0
    t = 0.0
    while t < dur:
        u = t / dur
        m = notes[min(len(notes) - 1, int(u * len(notes) + rng.random() * 2))]
        seg = bell(m + 12, 0.35, 0.8, ratio=2.0, index=1.2, decay=0.4, p=rng.random() * 1.4 - 0.7)
        i0 = ns(t)
        out[:, i0:i0 + seg.shape[1]] += seg[:, : n - i0]
        t += 0.22 - 0.14 * u
        k += 1
    return out * 0.6


# ------------------------------------------------------------------ reverb
def make_ir(dur=3.4, seed=1, pre=0.015, hi_decay=0.12):
    n = ns(dur)
    t = tv(n)
    rng = np.random.default_rng(seed)
    ir = np.zeros((2, n))
    for ch in range(2):
        w = rng.standard_normal(n)
        ir[ch] = lpf(w, 500) * np.exp(-t / (dur * 0.28)) + bpf(w, 500, 3500) * np.exp(-t / (dur * 0.2)) + hpf(w, 3500) * np.exp(-t / (dur * hi_decay))
        for k in range(12):
            d = ns(pre + rng.random() * 0.07)
            ir[ch, d] += rng.standard_normal() * 1.5 * (1 - k / 12)
    ir[:, : ns(pre)] = 0
    ir /= np.sqrt(np.mean(np.sum(ir ** 2, axis=1)))
    return ir


def convolve(x, ir):
    return np.stack([signal.oaconvolve(x[c], ir[c])[: x.shape[1]] for c in range(2)])


# ================================================================== SCORE
CH = {  # pad voicings (mid register) and bass roots
    "Dm": ([50, 53, 57, 62, 64], 38), "Dm7": ([50, 53, 57, 60, 65], 38), "Dsus": ([50, 55, 57, 62, 64], 38),
    "Bb": ([46, 50, 53, 58, 62], 34), "Bbmaj7": ([46, 50, 53, 57, 62], 34),
    "F": ([48, 53, 57, 60, 64], 41), "Fmaj7": ([48, 53, 57, 60, 64], 41),
    "C": ([48, 52, 55, 60, 64], 36), "Csus": ([48, 50, 55, 60, 62], 36),
    "Gm": ([46, 50, 55, 58, 62], 43), "Gm7": ([46, 50, 53, 58, 62], 43),
    "A": ([45, 49, 52, 57, 61], 33), "Asus": ([45, 50, 52, 57, 62], 33), "Am": ([45, 48, 52, 57, 60], 33),
    "Eb": ([46, 51, 55, 58, 63], 39), "D": ([50, 54, 57, 62, 64], 38), "Dadd9": ([50, 54, 57, 62, 64, 69], 38),
    "Bbsus2": ([46, 48, 53, 58, 60], 34),
}
QUESTION = [(0.0, 74, 0.7), (0.55, 69, 0.6), (1.1, 77, 0.7), (1.9, 76, 0.75)]
ANSWER = [(0.0, 74, 0.7), (0.55, 69, 0.6), (1.1, 78, 0.72), (1.9, 81, 0.8)]


class Mix:
    def __init__(self, duration):
        self.dur = duration
        self.n = ns(duration + 8)
        self.b = {k: np.zeros((2, self.n)) for k in ("music", "sfx", "vo", "mverb", "sverb", "room")}
        self.auto = np.ones(self.n)  # extra music gain automation (hush, silence)

    def add(self, bus, sig, t0, gain=1.0, verb=0.0, room=0.0):
        sig = stereo(np.asarray(sig, dtype=float))
        i0 = int(round(t0 * SR))
        if i0 < 0:
            sig = sig[:, -i0:]
            i0 = 0
        i1 = min(self.n, i0 + sig.shape[1])
        if i1 <= i0:
            return
        s = sig[:, : i1 - i0] * gain
        self.b[bus][:, i0:i1] += s
        if verb:
            self.b["mverb" if bus == "music" else "sverb"][:, i0:i1] += s * verb
        if room:
            self.b["room"][:, i0:i1] += s * room

    def music_dip(self, t0, t1, level, fade=0.4):
        i0, i1 = ns(max(0, t0)), ns(t1)
        g = np.ones(self.n)
        g[i0:i1] = level
        self.auto = np.minimum(self.auto, smooth(smooth(g, fade / 2), fade / 2))


class _Scaled:
    """A view of the mix that scales everything added through it."""

    def __init__(self, mix, gain):
        self.mix, self.gain = mix, gain

    def add(self, bus, sig, t0, gain=1.0, verb=0.0, room=0.0):
        self.mix.add(bus, sig, t0, gain * self.gain, verb, room)


class Score:
    def __init__(self, tl, mix):
        self.tl = tl
        self.m = mix
        self.S = {s["id"]: s for s in tl["scenes"]}
        for s in tl["scenes"]:
            s["c"] = {c["key"]: c for c in s["clips"]}

    def at(self, sid, key=None, edge="start", off=0.0):
        s = self.S[sid]
        if key is None:
            return s["start"] + (s["dur"] if edge == "end" else 0) + off
        c = s["c"][key]
        return s["start"] + (c["end"] if edge == "end" else c["start"]) + off

    # --- musical helpers
    def prog(self, t0, t1, chords, gain=0.12, inst="pad", bassg=0.0, cutoff=1500, attack=1.4, release=2.6, verb=0.35, octave=0, seed=0):
        span = (t1 - t0) / len(chords)
        for i, name in enumerate(chords):
            notes, root = CH[name]
            notes = [m + 12 * octave for m in notes]
            ts = t0 + i * span
            if inst == "pad":
                sig = pad(notes, span, attack, release, cutoff, seed=seed + i)
            elif inst == "strings":
                sig = strings(notes, span, attack, release, cutoff, seed=seed + i)
            elif inst == "choir":
                sig = choir([m + 12 for m in notes[1:4]], span, attack, release, seed=seed + i)
            self.m.add("music", sig, ts, gain, verb=verb)
            if bassg:
                self.m.add("music", bass(root, span, 0.8), ts, bassg, verb=0.05)

    def motif(self, t0, notes, vel=0.55, octave=0, gain=1.0, verb=0.6):
        for tr, m, v in notes:
            self.m.add("music", piano(m + 12 * octave, v * vel / 0.6, dur=6.0), t0 + tr, gain * 0.9, verb=verb)

    def arp(self, t0, t1, chords, bpm=120, div=4, gain=0.18, pattern=(0, 1, 2, 3, 2, 1), octave=12, bright=3000, verb=0.25, decay=0.2):
        step = 60 / bpm / (div / 1)
        span = (t1 - t0) / len(chords)
        k = 0
        t = t0
        while t < t1 - 0.05:
            ci = min(len(chords) - 1, int((t - t0) / span))
            notes = CH[chords[ci]][0]
            m = notes[pattern[k % len(pattern)] % len(notes)] + octave
            self.m.add("music", pluck(m, 0.55 + 0.2 * (k % div == 0), 0.6, bright, 420, decay, p=0.35 * np.sin(k * 0.9)), t, gain, verb=verb)
            k += 1
            t += step

    def pulse_bass(self, t0, t1, chords, bpm=120, gain=0.25, div=2):
        step = 60 / bpm / div
        span = (t1 - t0) / len(chords)
        t = t0
        while t < t1 - 0.05:
            ci = min(len(chords) - 1, int((t - t0) / span))
            root = CH[chords[ci]][1]
            self.m.add("music", bass(root, step * 0.8, 0.7, 320), t, gain)
            t += step

    def drums(self, t0, t1, bpm=120, kick_g=0.5, hat_g=0.12, tom_g=0.0, snare_g=0.0):
        beat = 60 / bpm
        t = t0
        k = 0
        while t < t1 - 0.02:
            if k % 2 == 0 or (k % 8 == 7):
                self.m.add("music", kick(1.0), t, kick_g)
            if hat_g:
                self.m.add("music", hat(0.5 + 0.3 * (k % 2)), t + beat / 2, hat_g)
            if tom_g and k % 4 == 3:
                self.m.add("music", tom(92, 1.0), t + beat * 0.5, tom_g, verb=0.3)
            if snare_g and k % 2 == 1:
                self.m.add("music", snare(0.8), t, snare_g, verb=0.2)
            k += 1
            t += beat

    def impact(self, t, size=1.0, cold=False, major=False, root=26):
        self.m.add("music", braam(size, root=root, cold=cold, major=major, seed=int(t * 10)), t, 0.5 * size, verb=0.5)
        self.m.add("sfx", boom(size), t, 0.55, verb=0.4)
        if not cold:
            self.m.add("sfx", shimmer(2.2, 16, int(t)), t + 0.05, 0.7 * size, verb=0.8)

    # --- the score, scene by scene
    def compose(self):
        m, S, at = self.m, self.S, self.at
        # OPENING ------------------------------------------------------
        o = S["opening"]["start"]
        m.add("music", stereo(sine(mtof(26), ns(13)) * env_ar(ns(13), 4, 3) * 0.35 + sine(mtof(38), ns(13)) * env_ar(ns(13), 5, 3) * 0.3), o, 0.22)
        for k in range(8):  # heartbeat
            tb = o + 2.5 + k * 1.15
            m.add("sfx", kick(0.6) * 0.8, tb, 0.2, verb=0.1)
            m.add("sfx", kick(0.4) * 0.6, tb + 0.28, 0.14, verb=0.1)
        m.add("music", pad([62, 69, 76], 11, 5, 3, 900, seed=3), o + 1.5, 0.05, verb=0.6)
        self.prog(o + 12.8, o + 18.3, ["Dm"], 0.07, "strings", cutoff=1800, attack=4.5, release=1.0, verb=0.5)
        self.prog(o + 18.3, o + 23.4, ["Dm"], 0.16, "strings", bassg=0.18, cutoff=2600, attack=0.05, release=3.5, verb=0.5, seed=5)
        self.prog(o + 18.3, o + 23.4, ["Dm"], 0.05, "choir", attack=0.3, release=3.5, verb=0.7, seed=6)
        # DREAM --------------------------------------------------------
        d = S["dream"]["start"]
        de = d + S["dream"]["dur"]
        b2 = at("dream", "b2")
        c = at("dream", "c")
        self.prog(d + 0.2, b2 - 0.2, ["Dm", "Bb", "Dm"], 0.085, "pad", cutoff=1100, attack=2.0, release=2.0, verb=0.45, seed=11)
        for i, tb in enumerate(np.arange(d + 1.0, b2 - 0.5, 0.52)):  # harp-like clockwork plucks
            notes = CH[["Dm", "Bb", "Dm"][min(2, int((tb - d) / ((b2 - d) / 3)))]][0]
            mm = notes[[0, 2, 4, 3, 1, 3][i % 6]] + 12
            m.add("music", pluck(mm, 0.5, 1.0, 2200, 500, 0.35, p=0.4 * np.sin(i)), tb, 0.09, verb=0.4)
        self.prog(b2 - 0.2, c + 0.3, ["Dm"], 0.04, "pad", cutoff=800, attack=1.0, release=1.5, verb=0.5, seed=13)
        self.prog(c - 0.2, de - 0.5, ["F", "C", "Dm", "Bb"], 0.08, "strings", bassg=0.12, cutoff=1900, attack=1.2, release=2.2, verb=0.45, seed=15)
        self.arp(c + 0.2, de - 1.0, ["F", "C", "Dm", "Bb"], bpm=84, div=2, gain=0.07, octave=12, bright=2400, decay=0.4)
        # NEURON (1943) ------------------------------------------------
        n0 = S["neuron"]["start"]
        ne = n0 + S["neuron"]["dur"]
        nb = at("neuron", "b")
        self.prog(n0 + 0.3, nb - 0.2, ["Am", "F", "Dm"], 0.075, "strings", bassg=0.1, cutoff=1500, attack=1.5, release=1.8, verb=0.4, seed=21)
        t = n0 + 1.2
        while t < nb - 0.4:  # electric ostinato
            m.add("music", pluck(45, 0.6, 0.4, 1400, 300, 0.12), t, 0.12, verb=0.15)
            m.add("music", pluck(57, 0.4, 0.4, 1800, 300, 0.1, p=0.3), t + 0.3, 0.08, verb=0.15)
            t += 0.6
        self.prog(nb - 0.1, ne + 0.8, ["F"], 0.1, "strings", cutoff=2600, attack=0.4, release=2.0, verb=0.6, seed=23)
        m.add("sfx", shimmer(2.0, 18, 23), nb, 0.6, verb=0.8)
        # TURING (1950) ------------------------------------------------
        t0 = S["turing"]["start"]
        te = t0 + S["turing"]["dur"]
        self.prog(t0 + 0.2, te + 0.4, ["Gm", "Dm", "Bb", "A"], 0.06, "pad", cutoff=1000, attack=1.5, release=2.0, verb=0.5, seed=31)
        chords = ["Gm", "Dm", "Bb", "A"]
        span = (te - t0) / 4
        for i, tb in enumerate(np.arange(t0 + 0.6, te - 0.3, 0.6)):
            notes = CH[chords[min(3, int((tb - t0) / span))]][0]
            m.add("music", piano(notes[[0, 2, 3, 4, 3, 2][i % 6]] + 12, 0.33, 3.5, 0.3), tb, 0.4, verb=0.5)
        # DARTMOUTH (1956) ---------------------------------------------
        a0 = S["dartmouth"]["start"]
        ae = a0 + S["dartmouth"]["dur"]
        ab = at("dartmouth", "b")
        ac = at("dartmouth", "c")
        ad = at("dartmouth", "d")
        self.prog(a0 + 0.2, ab - 0.2, ["F", "C", "Dm"], 0.07, "pad", cutoff=1400, attack=1.6, release=1.2, verb=0.45, seed=41)
        for i, tb in enumerate(np.arange(a0 + 0.8, ab - 0.4, 0.45)):
            notes = CH[["F", "C", "Dm"][min(2, int((tb - a0) / ((ab - a0) / 3)))]][0]
            m.add("music", piano(notes[[1, 3, 4, 3][i % 4]] + 12, 0.28, 3.0, 0.4), tb, 0.4, verb=0.45)
        self.prog(ab, ac + 0.5, ["Bb"], 0.15, "strings", bassg=0.2, cutoff=3000, attack=0.08, release=2.5, verb=0.55, seed=43)
        self.prog(ab, ac + 0.5, ["Bb"], 0.07, "choir", attack=0.4, release=2.5, verb=0.7, seed=44)
        self.prog(ac + 0.2, ad, ["F", "Dm", "Bb", "C"], 0.08, "strings", bassg=0.1, cutoff=2200, attack=1.0, release=1.5, verb=0.45, seed=45)
        self.arp(ac + 0.4, ad - 0.2, ["F", "Dm", "Bb", "C"], bpm=96, div=2, gain=0.08, octave=12, bright=2600, decay=0.35)
        for i, tb in enumerate(np.arange(ad + 0.1, ae - 0.8, 0.3)):  # playful pizzicato
            mm = [65, 69, 72, 69, 67, 64, 65, 72][i % 8]
            m.add("music", pluck(mm, 0.5, 0.4, 2000, 400, 0.08, p=0.3 * np.sin(i * 1.7)), tb, 0.1, verb=0.3)
        self.prog(ad, ae + 0.5, ["Fmaj7"], 0.05, "pad", cutoff=1200, attack=0.8, release=1.5, verb=0.5, seed=47)
        # PERCEPTRON (1958) --------------------------------------------
        p0 = S["perceptron"]["start"]
        pe = p0 + S["perceptron"]["dur"]
        pb = at("perceptron", "b")
        self.prog(p0 + 0.2, pb - 0.1, ["F", "Bb", "C", "F"], 0.05, "pad", bassg=0.14, cutoff=1300, attack=0.6, release=1.0, verb=0.35, seed=51)
        self.pulse_bass(p0 + 0.9, pb - 0.2, ["F", "Bb", "C", "F"], bpm=104, gain=0.12)
        mel = [(0.0, 72, 0.8), (0.9, 77, 0.8), (1.8, 76, 0.6), (2.4, 74, 0.6), (3.0, 72, 1.1), (4.3, 69, 0.8), (5.2, 74, 0.8), (6.1, 72, 1.2)]
        m.add("music", theremin(mel, 7.5, 0.9), p0 + 0.9, 0.35, verb=0.55)
        m.add("music", braam(0.35, root=29, major=True, seed=5) * 0.7, pb + 0.75, 0.35, verb=0.4)
        self.prog(pb + 0.8, pe + 0.5, ["F", "C"], 0.07, "strings", bassg=0.1, cutoff=2400, attack=0.2, release=1.5, verb=0.45, seed=53)
        # ELIZA (1966) -------------------------------------------------
        e0 = S["eliza"]["start"]
        ee = e0 + S["eliza"]["dur"]
        ech = [[50, 53, 57, 60], [55, 58, 62, 65], [58, 62, 65, 69], [57, 61, 64, 67]]
        span = (ee - e0 - 0.5) / 4
        for i, ch in enumerate(ech):
            for j, mm in enumerate(ch):
                m.add("music", epiano(mm, 0.4, span + 1.5), e0 + 0.3 + i * span + j * 0.03, 0.35, verb=0.35)
            m.add("music", bass(ch[0] - 12, span, 0.6, 200), e0 + 0.3 + i * span, 0.14)
        # WINTER -------------------------------------------------------
        w0 = S["winter"]["start"]
        we = w0 + S["winter"]["dur"]
        wa_end = at("winter", "a", "end")
        wb, wc = at("winter", "b"), at("winter", "c")
        wd1, wd2 = at("winter", "d1"), at("winter", "d2")
        self.prog(w0 + 0.1, wa_end + 0.3, ["F", "C"], 0.05, "strings", bassg=0.1, cutoff=2400, attack=0.5, release=0.15, verb=0.3, seed=61)
        self.arp(w0 + 0.3, wa_end + 0.3, ["F", "C"], bpm=120, div=4, gain=0.06, octave=12, bright=3000, decay=0.15)
        m.add("music", stereo(sine(mtof(26), ns(wd1 - wb + 1)) * env_ar(ns(wd1 - wb + 1), 2, 1.5)), wb - 0.3, 0.2)
        for i, (tt, mm) in enumerate([(0.3, 81), (1.9, 76), (3.3, 74), (5.6, 77), (7.4, 69)]):  # lonely high piano
            m.add("music", piano(mm + 12, 0.35, 5.0, 0.2), wb + tt, 0.38, verb=0.8)
        self.prog(wd1 - 0.1, wd2 + 0.2, ["Fmaj7", "C"], 0.08, "pad", bassg=0.1, cutoff=1500, attack=1.0, release=0.8, verb=0.5, seed=63)
        for i, tb in enumerate(np.arange(wd1 + 0.3, wd2, 0.34)):
            m.add("music", musicbox([72, 76, 79, 81, 79, 76][i % 6], 0.35, 2.0), tb, 0.22, verb=0.5)
        m.add("music", stereo(sine(mtof(26), ns(we - wd2 + 1)) * env_ar(ns(we - wd2 + 1), 0.8, 1.5)), wd2 + 0.8, 0.22)
        m.add("music", pad([62, 65, 69], we - wd2, 1.5, 1.5, 700, seed=65), wd2 + 0.8, 0.05, verb=0.7)
        # BELIEVERS ----------------------------------------------------
        v0 = S["believers"]["start"]
        ve = v0 + S["believers"]["dur"]
        vb, vc = at("believers", "b"), at("believers", "c")
        for k in range(int((vc - v0) / 1.0)):
            tb = v0 + 1.0 + k * 1.0
            m.add("sfx", kick(0.5), tb, 0.18, verb=0.15)
        self.prog(v0 + 0.5, vc, ["Dm", "Bb", "F", "C"], 0.07, "strings", bassg=0.08, cutoff=1400, attack=2.0, release=1.5, verb=0.5, seed=71)
        self.motif(v0 + 1.4, QUESTION, 0.45, octave=-1, gain=0.55)
        self.prog(vc - 0.2, ve + 0.5, ["F", "C", "Dm"], 0.09, "strings", bassg=0.12, cutoff=2400, attack=0.8, release=1.5, verb=0.45, seed=73)
        self.arp(vc, ve, ["F", "C", "Dm"], bpm=100, div=2, gain=0.06, octave=12, bright=2800, decay=0.3)
        # DEEP BLUE (1997) ---------------------------------------------
        b0 = S["deepblue"]["start"]
        be = b0 + S["deepblue"]["dur"]
        bb2 = at("deepblue", "b2")
        seq = [38, 38, 41, 38, 45, 38, 43, 41]
        for k, tb in enumerate(np.arange(b0 + 0.6, bb2 - 0.2, 0.25)):
            m.add("music", bass(seq[k % 8], 0.2, 0.7, 500), tb, 0.12)
            m.add("music", hat(0.35), tb + 0.125, 0.07)
        self.prog(b0 + 0.3, bb2 + 0.2, ["Dm", "Bb", "Gm", "A"], 0.05, "pad", cutoff=1200, attack=1.0, release=0.4, verb=0.4, seed=81)
        m.add("music", stereo(sine(mtof(26), ns(be - bb2 + 1)) * env_ar(ns(be - bb2 + 1), 0.5, 1.5)), bb2, 0.25)
        m.add("music", piano(62, 0.4, 5.0, 0.2), bb2 + 0.6, 0.55, verb=0.8)
        m.add("music", piano(57, 0.35, 5.0, 0.2), bb2 + 2.2, 0.5, verb=0.8)
        # DEEP LEARNING (2012) -----------------------------------------
        l0 = S["deeplearning"]["start"]
        le = l0 + S["deeplearning"]["dur"]
        lb1, lc = at("deeplearning", "b1"), at("deeplearning", "c")
        ld_line, ld = at("deeplearning", "d"), at("deeplearning", "d", "end")
        self.arp(lb1 - 0.2, ld_line - 0.1, ["Dm", "Bb", "F", "C"] * 2, bpm=120, div=4, gain=0.075, octave=12, bright=3000, decay=0.16)
        self.pulse_bass(lb1 - 0.2, ld_line - 0.1, ["Dm", "Bb", "F", "C"] * 2, bpm=120, gain=0.1, div=2)
        self.drums(lc, ld_line - 0.1, bpm=120, kick_g=0.18, hat_g=0.045)
        self.prog(lb1 - 0.2, ld_line - 0.1, ["Dm", "Bb", "F", "C"] * 2, 0.05, "strings", cutoff=2200, attack=0.6, release=0.3, verb=0.4, seed=91)
        m.music_dip(ld_line - 0.2, ld - 0.02, 0.3, 0.3)
        self.prog(ld, le + 0.8, ["Bb", "C"], 0.16, "strings", bassg=0.2, cutoff=3200, attack=0.05, release=2.0, verb=0.5, seed=93)
        self.prog(ld, le + 0.8, ["Bb", "C"], 0.08, "choir", attack=0.3, release=2.0, verb=0.7, seed=94)
        self.drums(ld, le - 0.4, bpm=120, kick_g=0.3, hat_g=0.08, tom_g=0.3)
        # ALPHAGO (2016) -----------------------------------------------
        g0 = S["alphago"]["start"]
        ge = g0 + S["alphago"]["dur"]
        gb, gc = at("alphago", "b"), at("alphago", "c")
        gd1, gd2, gd3 = at("alphago", "d1"), at("alphago", "d2"), at("alphago", "d3")
        self.prog(g0 + 0.2, gb, ["Dm", "Dsus"], 0.06, "pad", bassg=0.1, cutoff=1300, attack=1.0, release=1.0, verb=0.45, seed=101)
        for i, tb in enumerate(np.arange(g0 + 0.8, gb - 0.3, 0.5)):
            m.add("music", pluck([62, 65, 67, 69, 72, 69, 67, 65][i % 8] + 12, 0.45, 0.8, 2000, 400, 0.25, p=0.5 * np.sin(i)), tb, 0.09, verb=0.45)
        m.add("music", pad([81, 86, 88, 93], gc - gb + 1, 1.5, 1.5, 4000, detune=0.2, vib=0.003, seed=103), gb - 0.2, 0.04, verb=0.9)
        m.add("music", stereo(sine(mtof(26), ns(gc - gb + 1)) * env_ar(ns(gc - gb + 1), 1.5, 1.0)), gb - 0.2, 0.2)
        m.music_dip(gc - 0.2, gc + 1.85, 0.08, 0.5)
        m.add("sfx", glide(1800, 3600, 1.6, 0.03), gc + 0.3, 1.0, verb=0.6)
        self.prog(gc + 1.9, gd2 - 0.05, ["Bbsus2", "A"], 0.06, "strings", bassg=0.08, cutoff=1600, attack=0.3, release=0.4, verb=0.6, seed=105)
        self.prog(gd2, ge + 0.8, ["F", "C", "D"], 0.13, "strings", bassg=0.16, cutoff=3000, attack=0.1, release=2.0, verb=0.55, seed=107)
        self.prog(gd2, ge + 0.8, ["F", "C", "D"], 0.07, "choir", attack=0.3, release=2.0, verb=0.7, seed=108)
        # TRANSFORMER (2017) -------------------------------------------
        r0 = S["transformer"]["start"]
        re_ = r0 + S["transformer"]["dur"]
        rb2 = at("transformer", "b2")
        self.prog(r0 + 0.2, re_ + 0.4, ["Gm", "Eb", "Bb", "F"], 0.07, "pad", bassg=0.1, cutoff=1700, attack=1.2, release=1.2, verb=0.5, seed=111)
        for i, tb in enumerate(np.arange(r0 + 1.0, re_ - 0.2, 0.3)):
            ch = CH[["Gm", "Eb", "Bb", "F"][min(3, int((tb - r0) / ((re_ - r0) / 4)))]][0]
            m.add("music", bell(ch[[1, 2, 3, 4, 3, 2][i % 6]] + 24, 0.25, 1.6, ratio=3.0, index=1.2, decay=0.7, p=0.5 * np.sin(i * 0.8)), tb, 0.25, verb=0.6)
        self.arp(rb2 - 0.2, re_, ["F"], bpm=120, div=4, gain=0.07, octave=12, bright=3500, decay=0.14)
        # SCALE --------------------------------------------------------
        s0 = S["scale"]["start"]
        se = s0 + S["scale"]["dur"]
        sa2, sb, sc = at("scale", "a2"), at("scale", "b"), at("scale", "c")
        self.prog(s0 + 0.1, sb - 0.3, ["Dm", "Bb", "F", "C"], 0.065, "strings", bassg=0.11, cutoff=2400, attack=0.6, release=0.8, verb=0.45, seed=121)
        self.arp(s0 + 0.2, sb - 0.3, ["Dm", "Bb", "F", "C"], bpm=120, div=4, gain=0.07, octave=12, bright=3200, decay=0.15)
        self.drums(sa2, sb - 0.3, bpm=120, kick_g=0.2, hat_g=0.06)
        m.music_dip(sb - 0.3, sc - 0.6, 0.9, 0.5)
        self.prog(sb - 0.1, sc - 0.5, ["Fmaj7", "C"], 0.06, "pad", cutoff=1100, attack=1.2, release=1.0, verb=0.5, seed=123)
        for i, tb in enumerate(np.arange(sb + 0.4, sc - 0.9, 0.75)):
            m.add("music", piano([72, 76, 79, 77, 76, 72][i % 6], 0.3, 3.0, 0.3), tb, 0.5, verb=0.5)
        self.prog(sc - 0.45, se + 0.6, ["Bb", "F", "C"], 0.11, "strings", bassg=0.15, cutoff=3000, attack=0.05, release=1.2, verb=0.5, seed=125)
        self.prog(sc - 0.45, se + 0.6, ["Bb", "F", "C"], 0.07, "choir", attack=0.3, release=1.2, verb=0.7, seed=126)
        self.arp(sc - 0.45, se, ["Bb", "F", "C"], bpm=120, div=4, gain=0.1, octave=12, bright=3600, decay=0.15)
        self.drums(sc - 0.45, se - 0.3, bpm=120, kick_g=0.26, hat_g=0.07, tom_g=0.22)
        # PRESENT ------------------------------------------------------
        q0 = S["present"]["start"]
        qe = q0 + S["present"]["dur"]
        qc2 = at("present", "c2")
        prog = ["Dm", "Bb", "F", "C"] * 3
        self.prog(q0, qe, prog, 0.06, "strings", bassg=0.12, cutoff=2600, attack=0.3, release=0.4, verb=0.45, seed=131)
        self.arp(q0, qe - 0.1, prog, bpm=120, div=4, gain=0.055, octave=12, bright=3400, decay=0.14)
        self.pulse_bass(q0, qe - 0.1, prog, bpm=120, gain=0.09, div=2)
        self.drums(q0, qe - 0.2, bpm=120, kick_g=0.22, hat_g=0.05, tom_g=0.18, snare_g=0.06)
        self.prog(qc2, qc2 + 5.0, ["F"], 0.045, "choir", attack=0.4, release=1.5, verb=0.7, seed=133)
        self.prog(qe - 6.0, qe - 0.05, ["Bb", "C"], 0.06, "choir", attack=1.0, release=0.1, verb=0.6, seed=135)
        # EPILOGUE -----------------------------------------------------
        x0 = S["epilogue"]["start"]
        xe = x0 + S["epilogue"]["dur"]
        m.add("music", stereo(sine(mtof(86), ns(3)) * env_exp(ns(3), 0.9, 0.01) * 0.15), x0 + 0.05, 0.5, verb=0.9)
        m.add("music", pad([50, 57, 62], xe - x0 - 2, 3, 3, 700, seed=141), x0 + 2.0, 0.05, verb=0.6)
        # (motifs are cued from the picture, see cues 'motif')
        # FINALE -------------------------------------------------------
        f0 = S["finale"]["start"]
        fe = f0 + S["finale"]["dur"]
        self.prog(f0 + 0.2, fe - 3.5, ["Dadd9", "Bb", "D"], 0.12, "strings", bassg=0.14, cutoff=2600, attack=2.0, release=3.5, verb=0.6, seed=151)
        self.prog(f0 + 0.2, fe - 3.5, ["Dadd9", "Bb", "D"], 0.06, "choir", attack=2.5, release=3.5, verb=0.8, seed=152)
        self.motif(f0 + 2.6, ANSWER, 0.5, gain=0.9)

    # --- picture-synced sound effects
    def cues(self):
        m = self.m
        for i, q in enumerate(self.tl["cues"]):
            t, ty = q["t"], q["type"]
            dur = q.get("dur", 1.0)
            m = _Scaled(self.m, q.get("gain", 1.0))
            if ty == "key":
                m.add("sfx", key(q.get("heavy", 0), i), t, 0.65, room=0.25)
            elif ty == "teletype":
                m.add("sfx", key(0, i, "teletype"), t, 0.8, room=0.2)
            elif ty == "softkey":
                m.add("sfx", key(0, i, "soft"), t, 0.8, room=0.1)
            elif ty == "backspace":
                m.add("sfx", key(0, i, "back"), t, 0.6, room=0.1)
            elif ty == "tick_soft":
                m.add("sfx", key(0, i, "soft"), t, 0.25)
            elif ty == "motif":
                self.motif(t, QUESTION if q.get("variant") == "question" else ANSWER, 0.55, gain=q.get("gain", 1.0))
                if q.get("variant") == "answer":
                    self.prog(t - 0.2, t + 7.5, ["Dadd9"], 0.08, "strings", bassg=0.1, cutoff=2200, attack=2.5, release=3.0, verb=0.6, seed=161)
            elif ty == "impact":
                self.impact(t, q.get("size", 1.0), cold=bool(q.get("cold")))
            elif ty == "boom":
                m.add("sfx", boom(q.get("size", 1.0)), t, 0.5, verb=0.4)
            elif ty == "riser":
                m.add("sfx", riser(dur, 1.0, i), t, 0.6, verb=0.3)
            elif ty == "silence_riser":
                pass  # handled in the score (dip + glide)
            elif ty == "whoosh":
                m.add("sfx", whoosh(dur, 1.0, i), t, 0.7, verb=0.3)
            elif ty == "chess_lift":
                m.add("sfx", whoosh(0.5, 0.6, i), t, 0.4)
            elif ty == "shimmer":
                m.add("sfx", shimmer(dur, 16, i), t, 0.7, verb=0.8)
            elif ty == "swell":
                m.add("sfx", swell(dur), t, 0.6, verb=0.6)
            elif ty == "dissolve":
                m.add("sfx", dissolve(dur, i), t, 1.0, verb=0.5)
            elif ty == "room_tone":
                n = ns(dur)
                m.add("sfx", stereo(lpf(noise(n), 400) * 0.004 * env_ar(n, 1, 1)), t, 1.0)
            elif ty == "ticking":
                m.add("sfx", ticking(dur, q.get("rate", 2.0)), t, 0.38, room=0.3)
            elif ty == "iris":
                m.add("sfx", iris(dur), t, 0.6, verb=0.3)
            elif ty == "musicbox":
                m.add("music", musicbox(q["midi"], 0.6, 3.0), t, 0.34, verb=0.45)
            elif ty == "loom":
                m.add("sfx", loom(dur), t, 0.3, room=0.3)
            elif ty == "projector":
                m.add("sfx", projector(dur), t, 0.7)
            elif ty == "spike":
                m.add("sfx", spike(), t, 0.7, verb=0.3)
            elif ty == "relay":
                m.add("sfx", relay(i), t, 0.8, room=0.2)
            elif ty == "bloom":
                m.add("sfx", swell(1.0), t - 1.0, 0.4, verb=0.5)
            elif ty == "pencil":
                m.add("sfx", pencil(dur, i), t, 0.8)
            elif ty == "summer":
                m.add("sfx", summer(dur, i), t, 1.0, verb=0.2)
            elif ty == "hum":
                m.add("sfx", hum(dur), t, 1.0)
            elif ty == "beep_ok":
                m.add("sfx", beep([1320, 1760]), t, 0.6)
            elif ty == "beep_bad":
                m.add("sfx", beep([233, 220], 0.09, 0.08, square=True), t, 0.6)
            elif ty == "thud":
                m.add("sfx", thud(), t, 0.7, room=0.3)
            elif ty == "marker":
                m.add("sfx", marker(dur), t, 0.7)
            elif ty == "crack":
                m.add("sfx", crack(), t, 0.7, verb=0.5)
            elif ty == "wind":
                m.add("sfx", wind(dur, q.get("level", 1.0), i), t, 0.33)
            elif ty == "frost":
                m.add("sfx", frost(dur, i), t, 0.8, verb=0.6)
            elif ty == "thaw":
                pass  # the score warms up
            elif ty == "blip_up":
                m.add("sfx", glide(500, 1100, 0.18, 0.08), t, 1.0, verb=0.2)
            elif ty == "blip_down":
                m.add("sfx", glide(1100, 480, 0.2, 0.08), t, 1.0, verb=0.2)
            elif ty == "chess":
                m.add("sfx", chess(i), t, 0.9, room=0.3, verb=0.2)
            elif ty == "stone":
                big = bool(q.get("big"))
                m.add("sfx", stone(big, i), t, 0.8 if not big else 1.0, room=0.2, verb=0.9 if big else 0.1)
            elif ty == "datastream":
                m.add("sfx", datastream(dur, i), t, 0.8)
            elif ty == "powerdown":
                m.add("sfx", powerdown(), t, 0.6, verb=0.4)
            elif ty == "gpu":
                m.add("sfx", gpu(dur), t, 0.4)
            elif ty == "cosmos":
                pass  # the score's space pad
            elif ty == "hush":
                pass
            elif ty == "hyperspace":
                m.add("sfx", riser(dur * 0.6, 0.8, i), t, 0.4)
                m.add("sfx", whoosh(dur, 1.0, i + 1), t + dur * 0.4, 0.6)
            elif ty == "pop":
                m.add("sfx", pop(q.get("idx", 0)), t, 0.8, verb=0.2)
            elif ty == "fold":
                m.add("sfx", fold(dur, i), t, 0.5, verb=0.5)
            else:
                print("  (unhandled cue type:", ty, ")")

    def narration(self):
        for s in self.tl["scenes"]:
            for c in s["clips"]:
                x, sr = sf.read(os.path.join(BUILD, "vo", c["file"]))
                if sr != SR:
                    x = signal.resample_poly(x, SR // 1000, sr // 1000)
                # voice chain: gentle high-pass, a touch of presence
                x = hpf(x, 70)
                x = x + 0.25 * bpf(x, 2500, 6000)
                self.m.add("vo", x, c["abs"], 1.0, verb=0.07)


# ================================================================== MIX
def limiter(x, ceiling=0.89, look=0.004, release=0.12):
    peak = np.max(np.abs(x), axis=0)
    need = np.minimum(1.0, ceiling / np.maximum(peak, 1e-9))
    L = ns(look)
    g = minimum_filter1d(need, size=2 * L + 1)
    a = np.exp(-1 / (release * SR))
    g = signal.lfilter([1 - a], [1, -a], g - 1) + 1  # smooth recovery
    g = np.minimum(g, minimum_filter1d(need, size=2 * L + 1))
    return x * g


def lufs(x):
    """Integrated loudness per ITU-R BS.1770-4 (48 kHz K-weighting, gated)."""
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    k = signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=-1), axis=-1)
    blk, hop = ns(0.4), ns(0.1)
    p = np.array([np.sum(np.mean(k[:, i:i + blk] ** 2, axis=1)) for i in range(0, k.shape[1] - blk, hop)])
    l = -0.691 + 10 * np.log10(p + 1e-12)
    p = p[l > -70]
    rel = -0.691 + 10 * np.log10(np.mean(p)) - 10
    p = p[(-0.691 + 10 * np.log10(p)) > rel]
    return -0.691 + 10 * np.log10(np.mean(p))


def subtitles(tl, path):
    def ts(t):
        h, r = divmod(max(0, t), 3600)
        mnt, s = divmod(r, 60)
        return f"{int(h):02d}:{int(mnt):02d}:{int(s):02d},{int(round((s % 1) * 1000)):03d}"

    lines = []
    k = 1
    for s in tl["scenes"]:
        for c in s["clips"]:
            words = c["text"].split()
            chunks, cur = [], ""
            for w in words:
                if len(cur) + len(w) + 1 > 42 and cur:
                    chunks.append(cur)
                    cur = w
                else:
                    cur = (cur + " " + w).strip()
            chunks.append(cur)
            text = "\n".join(chunks[:2]) if len(chunks) <= 2 else "\n".join([" ".join(chunks[: len(chunks) // 2]), " ".join(chunks[len(chunks) // 2:])])
            lines.append(f"{k}\n{ts(c['abs'])} --> {ts(c['abs'] + c['dur'] + 0.25)}\n{text}\n")
            k += 1
    open(path, "w").write("\n".join(lines))


def chapters(tl, path):
    """FFmpeg metadata file with one chapter per scene (titles from story.json)."""
    story = json.load(open(os.path.join(ROOT, "story.json")))
    titles = {sc["id"]: sc.get("chapter", sc["id"]) for sc in story["scenes"]}
    out = [";FFMETADATA1", "title=The Thinking Machine — A History of Artificial Intelligence"]
    for s in tl["scenes"]:
        out += ["[CHAPTER]", "TIMEBASE=1/1000", f"START={int(s['start'] * 1000)}", f"END={int((s['start'] + s['dur']) * 1000)}", f"title={titles[s['id']]}"]
    open(path, "w").write("\n".join(out) + "\n")


def main():
    tl = json.load(open(os.path.join(BUILD, "timeline.json")))
    mix = Mix(tl["duration"])
    sc = Score(tl, mix)
    print("composing score...")
    sc.compose()
    print("placing sound effects...")
    sc.cues()
    print("placing narration...")
    sc.narration()

    b = mix.b
    print("reverb...")
    hall = make_ir(3.6, 1)
    room = make_ir(0.7, 2, pre=0.004, hi_decay=0.25)
    mverb = convolve(b["mverb"], hall) * 0.35
    sverb = convolve(b["sverb"], hall) * 0.35
    rverb = convolve(b["room"], room) * 0.3

    # sidechain: music ducks under the narration
    vo_env = maximum_filter1d(np.max(np.abs(b["vo"]), axis=0), size=ns(0.05))
    vo_env = smooth(np.clip((20 * np.log10(vo_env + 1e-6) + 45) / 20, 0, 1), 0.15)
    # two-band ducking: clear the speech band more than the low end
    music = b["music"] + mverb
    m_lo = lpf(music, 280, 4)
    music = (m_lo * (1 - 0.5 * vo_env) + (music - m_lo) * (1 - 0.8 * vo_env)) * mix.auto
    fx = b["sfx"] + sverb + rverb
    f_lo = lpf(fx, 280, 4)
    fx = f_lo * (1 - 0.3 * vo_env) + (fx - f_lo) * (1 - 0.5 * vo_env)
    out = music + fx + b["vo"]
    out = hpf(out, 28)
    n_end = ns(tl["duration"] + 0.5)
    out = out[:, :n_end]
    fade = ns(1.5)
    out[:, -fade:] *= np.linspace(1, 0, fade)
    target = -16.0  # LUFS, a common level for web video
    ceiling = 10 ** (-1.8 / 20)
    for _ in range(3):
        g = 10 ** ((target - lufs(out)) / 20)
        out = limiter(out * g, ceiling)
    print(f"integrated loudness {lufs(out):.1f} LUFS, sample peak {20 * np.log10(np.max(np.abs(out))):.1f} dBFS")

    sf.write(os.path.join(BUILD, "mix.wav"), out.T.astype(np.float32), SR, subtype="PCM_24")
    # stems for analysis
    win = SR // 10  # windowed RMS of each stem (100 ms), for level analysis
    def wrms(x):
        x = x[:, : (x.shape[1] // win) * win]
        return np.sqrt(np.mean(x.reshape(2, -1, win) ** 2, axis=(0, 2)))
    sb = lambda x: bpf(x[:, :n_end], 300, 4000)
    np.save(os.path.join(BUILD, "stems_rms.npy"), np.stack([
        wrms(music[:, :n_end]), wrms(fx[:, :n_end]), wrms(b["vo"][:, :n_end]),
        wrms(sb(music)), wrms(sb(fx)), wrms(sb(b["vo"])),
    ]).astype(np.float32))
    subtitles(tl, os.path.join(BUILD, "subtitles.srt"))
    chapters(tl, os.path.join(BUILD, "chapters.txt"))
    print("wrote build/mix.wav, build/subtitles.srt and build/chapters.txt")


if __name__ == "__main__":
    sys.exit(main())
