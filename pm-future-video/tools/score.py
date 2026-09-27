#!/usr/bin/env python3
"""Synthesize the soundtrack of What's Worth Building.

Everything here is generated from raw waveforms with numpy/scipy: the score
(pads, strings, choir, felt piano, music box, bells, plucks, a legato lead,
pulses, drums, impacts), the sound design (data swarms, card flips, a brass
compass, stone slabs, flags, doors, wind...) and the final mix with the
narration. The score lives in E minor and resolves to E major at the end.

Inputs:  build/timeline.json   (scene timing, narration placement, sound cues)
         build/vo/*.wav        (narration clips from tools/narrate.py)
Outputs: build/mix.wav         (48 kHz stereo, peak-limited)
         build/subtitles.srt   (narration subtitles)
         build/chapters.txt    (chapter metadata for the MP4)
"""
import json
import os
import re
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


def shimmer(dur=2.5, density=22, seed=0, notes=(88, 90, 95, 100, 102, 107), vel=1.0):
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
    f0 = float(mtof([76, 78, 83, 88][idx % 4]))
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


def partials(spec, dur, seed=0):
    """Sum of exponentially decaying sine partials: [(freq, amp, decay_s)]."""
    rng = np.random.default_rng(seed)
    n = ns(dur)
    t = tv(n)
    y = sum(a * np.sin(2 * np.pi * f * t + rng.random() * 6) * np.exp(-t / d) for f, a, d in spec)
    na = ns(0.002)
    y[:na] *= np.linspace(0, 1, na)
    return y


def swarm(dur, seed=0):
    """A cloud of tiny digital blips that thickens and climbs: machines at work."""
    rng = np.random.default_rng(seed)
    n = ns(dur + 0.4)
    out = np.zeros((2, n))
    t = 0.0
    while t < dur:
        u = t / dur
        bn = ns(0.008 + rng.random() * 0.02)
        f = (600 + 2400 * u) * (0.7 + rng.random() * 0.9)
        b = np.sin(2 * np.pi * f * tv(bn)) * np.hanning(bn) * (0.4 + 0.6 * rng.random())
        i0 = ns(t)
        seg = pan(b * 0.03 * (0.4 + 0.6 * u), rng.random() * 1.8 - 0.9)
        out[:, i0:i0 + bn] += seg[:, : n - i0]
        t += (0.05 - 0.04 * u) * (0.3 + rng.random())
    ramp = np.minimum(1, tv(n) / dur)
    out += stereo(sweep(noise(n), 800 + 3000 * ramp, "band", 1.2) * 0.02 * ramp ** 2)
    return hpf(out, 400) * env_ar(n, 0.2, 0.3)


def cutoff():
    """Everything stops: a sub thump and a breath of air."""
    n = ns(1.2)
    t = tv(n)
    y = sine(48 * (1 + 0.6 * np.exp(-t / 0.05)), n) * np.exp(-t / 0.25) * 0.9
    y += hpf(noise(n), 4000) * np.exp(-t / 0.02) * 0.15
    return stereo(y * 0.6)


def compass(dur=3.4, seed=0):
    """A brass compass: a bright ring as it appears, then the needle ticking as it swings and settles."""
    n = ns(dur + 2.5)
    out = np.zeros((2, n))
    ring = partials([(1850, 0.5, 0.9), (2710, 0.3, 0.6), (4120, 0.2, 0.35), (5370, 0.1, 0.2)], 2.5, seed)
    out[:, : len(ring)] += stereo(ring * 0.3)
    tt, gap, k = 0.35, 0.07, 0
    while tt < dur - 0.15:
        tick = modal([(3300 + 200 * (k % 2), 30, 0.4), (5200, 40, 0.2)], 0.08, 0.0006, seed + k)
        i0 = ns(tt)
        out[:, i0:i0 + len(tick)] += pan(tick * 0.2 * (1 - 0.5 * tt / dur), 0.15 * np.sin(k))[:, : n - i0]
        tt += gap
        gap *= 1.16
        k += 1
    settle = partials([(2470, 0.5, 1.2), (3710, 0.25, 0.8), (1240, 0.3, 1.5)], 2.5, seed + 99)
    i0 = ns(dur)
    out[:, i0:i0 + len(settle)] += stereo(settle * 0.3)[:, : n - i0]
    return out


def flip(idx=0):
    """A card turning over to the machine side: a crisp flick and a small tone that climbs with each card."""
    n = ns(0.3)
    t = tv(n)
    rng = np.random.default_rng(idx + 7)
    y = bpf(rng.standard_normal(n), 2500, 7000) * np.exp(-t / 0.012) * 0.5
    notes = [64, 67, 71, 74, 76, 79]
    f = float(mtof(notes[idx % 6] + 12 * (idx // 6)))
    y += np.sin(2 * np.pi * f * t) * np.exp(-t / 0.08) * 0.25
    return pan(y * 0.5, -0.6 + 0.4 * (idx % 4))


def flow(dur, seed=0):
    """Work moving through a pipeline: a soft rushing stream with a slow pulse."""
    rng = np.random.default_rng(seed)
    n = ns(dur)
    t = tv(n)
    out = np.stack([bpf(rng.standard_normal(n), 500, 2600) * (0.6 + 0.4 * np.sin(2 * np.pi * 1.2 * t + ch)) for ch in range(2)])
    return out * env_ar(n, 0.8, 1.2) * 0.03


def strike():
    """A marker striking through a word."""
    n = ns(0.4)
    t = tv(n)
    u = t / 0.4
    y = sweep(noise(n), 1200 + 2500 * u, "band", 2.0) * np.sin(np.pi * np.minimum(1, u * 1.2)) * 0.5
    return pan(y * 0.35, 0.1)


def crack_soft(seed=0):
    """A small, glassy crack."""
    y = modal([(3100, 8, 0.5), (1900, 7, 0.4), (5200, 9, 0.2)], 0.4, 0.0015, seed)
    n = len(y)
    y += hpf(noise(n), 2500) * np.exp(-tv(n) / 0.015) * 0.3
    return pan(y * 0.35, 0.2 * np.sin(seed))


def slab(idx=0):
    """A skill layer settling onto the stack: a soft stone thud and a tone that climbs layer by layer."""
    n = ns(2.5)
    t = tv(n)
    y = sine(58 * (1 + 0.5 * np.exp(-t / 0.03)), n) * np.exp(-t / 0.16) * 0.8
    y += lpf(noise(n), 700) * np.exp(-t / 0.05) * 0.35
    notes = [52, 55, 59, 62, 64, 67, 71]
    m = notes[idx % 7] + 12
    y += partials([(float(mtof(m)), 0.25, 0.8), (float(mtof(m + 12)), 0.08, 0.45)], 2.5, idx)
    return stereo(y * 0.5)


def camp(idx=0, soft=False):
    """A flag planted at a camp: a warm bell whose pitch climbs with each stage."""
    m = [64, 67, 71, 76][idx % 4] + 12
    y = bell(m, 0.22 if soft else 0.32, 2.5 if soft else 3.5, ratio=2.0, index=1.4, decay=0.9 if soft else 1.1, p=-0.3 + 0.2 * idx)
    if not soft:
        n = ns(0.5)
        th = sine(90 * (1 + np.exp(-tv(n) / 0.02)), n) * np.exp(-tv(n) / 0.08) * 0.25
        y[:, :n] += stereo(th)
    return y


def door(idx=0, seed=0):
    """A door swinging open onto light: a low wooden creak and an airy bloom."""
    rng = np.random.default_rng(seed + idx)
    n = ns(2.2)
    t = tv(n)
    rate = 40 + 60 * np.minimum(1, t / 0.8)
    ph = np.cumsum(rate / SR)
    imp = (np.diff(np.floor(ph), prepend=0) > 0).astype(float) * (t < 0.9) * (0.5 + 0.5 * rng.random(n))
    creak = reson(imp, 420 + 60 * idx, 12) * 0.5 + reson(imp, 1150, 10) * 0.25
    bloom = sweep(rng.standard_normal(n), 900 + 2500 * np.minimum(1, t / 1.6), "band", 1.4) * np.sin(np.pi * np.minimum(1, t / 2.2)) * 0.15
    return pan((creak * 0.4 + bloom) * 0.5, -0.45 + 0.3 * idx)


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
CH = {  # pad voicings (mid register) and bass roots: an E minor palette that resolves to E major
    "Em": ([52, 55, 59, 64, 67], 40), "Em9": ([52, 55, 59, 62, 66], 40), "Em7": ([52, 55, 59, 62, 67], 40),
    "C": ([48, 52, 55, 60, 64], 36), "Cmaj7": ([48, 52, 55, 59, 64], 36), "Cadd9": ([48, 55, 60, 62, 64], 36),
    "G": ([50, 55, 59, 62, 67], 43), "Gmaj7": ([50, 54, 59, 62, 66], 43),
    "D": ([50, 54, 57, 62, 66], 38), "Dsus": ([50, 55, 57, 62, 64], 38),
    "Am": ([48, 52, 57, 60, 64], 33), "Am7": ([48, 52, 55, 60, 64], 33), "Asus2": ([47, 52, 57, 59, 64], 33),
    "Bm": ([47, 50, 54, 59, 62], 35), "B": ([47, 51, 54, 59, 63], 35), "Bsus": ([47, 52, 54, 59, 64], 35),
    "F": ([48, 53, 57, 60, 65], 41),
    "E": ([52, 56, 59, 64, 68], 40), "Eadd9": ([52, 56, 59, 64, 66, 71], 40),
    "A": ([49, 52, 57, 61, 64], 33), "C#m": ([49, 52, 56, 61, 64], 37),
}
QUESTION = [(0.0, 71, 0.7), (0.55, 67, 0.6), (1.1, 72, 0.7), (1.9, 71, 0.75)]  # B G C B: left hanging
ANSWER = [(0.0, 71, 0.7), (0.55, 68, 0.6), (1.1, 73, 0.72), (1.9, 76, 0.8)]    # B G# C# E: home, in major
JOURNEY = [(0.0, 64, 1.6), (1.75, 67, 0.8), (2.6, 71, 0.8), (3.5, 72, 1.6), (5.25, 71, 0.8), (6.1, 67, 0.8),
           (7.0, 71, 2.4), (9.6, 69, 0.8), (10.5, 66, 1.6), (12.3, 62, 0.8), (13.1, 64, 0.9)]  # over Em C G D
SUMMIT = [(0.0, 74, 1.9), (2.1, 78, 1.0), (3.1, 76, 1.0), (4.2, 79, 1.9), (6.3, 76, 1.0), (7.3, 74, 1.0), (8.4, 71, 2.0)]  # over G D Em C G


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

    def end(self, sid):
        return self.S[sid]["start"] + self.S[sid]["dur"]

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

    def chain(self, t0, items, gain, inst="pad", **kw):
        """Consecutive chords [(name, dur), ...] from t0; returns the segments [(start, end, name)]."""
        segs, t = [], t0
        for i, (name, d) in enumerate(items):
            self.prog(t, t + d, [name], gain, inst, **{**kw, "seed": kw.get("seed", 0) + i})
            segs.append((t, t + d, name))
            t += d
        return segs

    def grid_prog(self, t0, t1, g0, bar, loop, gain, inst="pad", **kw):
        """One chord per bar from `loop` on a grid anchored at g0, clipped to [t0, t1]."""
        k = int(np.floor((t0 - g0) / bar + 1e-6))
        while True:
            s = g0 + k * bar
            if s >= t1 - 1e-6:
                break
            a, b = max(s, t0), min(s + bar, t1)
            if b - a > 0.05:
                self.prog(a, b, [loop[k % len(loop)]], gain, inst, **{**kw, "seed": kw.get("seed", 0) + k})
            k += 1

    @staticmethod
    def steps(t0, t1, g0, step, fn):
        """Call fn(t, j) on a step grid anchored at g0, for every grid time in [t0, t1)."""
        j = int(np.ceil((t0 - g0) / step - 1e-6))
        while True:
            t = g0 + j * step
            if t >= t1 - 1e-6:
                break
            fn(t, j)
            j += 1

    @staticmethod
    def chord_of(t, g0, bar, loop):
        return CH[loop[int(np.floor((t - g0) / bar + 1e-6)) % len(loop)]]

    def motif(self, t0, notes, vel=0.55, octave=0, gain=1.0, verb=0.6, bus="music"):
        for tr, m, v in notes:
            self.m.add(bus, piano(m + 12 * octave, v * vel / 0.6, dur=6.0), t0 + tr, gain * 0.9, verb=verb)

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

    def drums(self, t0, t1, bpm=120, kick_g=0.5, hat_g=0.12, tom_g=0.0, snare_g=0.0):
        beat = 60 / bpm
        t = t0
        k = 0
        while t < t1 - 0.02:
            if kick_g and (k % 2 == 0 or k % 8 == 7):
                self.m.add("music", kick(1.0), t, kick_g)
            if hat_g:
                self.m.add("music", hat(0.5 + 0.3 * (k % 2)), t + beat / 2, hat_g)
            if tom_g and k % 4 == 3:
                self.m.add("music", tom(92, 1.0), t + beat * 0.5, tom_g, verb=0.3)
            if snare_g and k % 2 == 1:
                self.m.add("music", snare(0.8), t, snare_g, verb=0.2)
            k += 1
            t += beat

    def groove(self, t0, t1, g0, bar, loop, bpm, arp_g=0.05, bass_g=0.09, kick_g=0.0, hat_g=0.0, bright=2800, seed=0):
        """A pulse section on a bar grid: sixteenth-note plucks, eighth-note bass, optional kick and hats."""
        beat = 60 / bpm
        pat = (0, 2, 3, 4, 3, 2, 1, 2)

        def pl(t, j):
            notes = self.chord_of(t, g0, bar, loop)[0]
            m = notes[pat[j % 8] % len(notes)] + 12
            self.m.add("music", pluck(m, 0.55 + 0.2 * (j % 4 == 0), 0.5, bright, 420, 0.13, p=0.35 * np.sin(j * 0.9 + seed)), t, arp_g, verb=0.25)

        def bs(t, j):
            self.m.add("music", bass(self.chord_of(t, g0, bar, loop)[1], beat / 2 * 0.8, 0.7, 320), t, bass_g)

        if arp_g:
            self.steps(t0, t1, g0, beat / 4, pl)
        if bass_g:
            self.steps(t0, t1, g0, beat / 2, bs)
        if kick_g or hat_g:
            k0 = g0 + np.ceil((t0 - g0) / beat - 1e-6) * beat
            self.drums(k0, t1, bpm, kick_g=kick_g, hat_g=hat_g)

    def drone(self, t0, dur, gain=0.15, midi=28, attack=2.0, release=1.5):
        n = ns(dur)
        y = sine(mtof(midi), n) * 0.7 + sine(mtof(midi + 12), n) * 0.4
        self.m.add("music", stereo(y * env_ar(n, attack, release)), t0, gain)

    def lead(self, t0, events, gain=0.1, octave=0, cutoff=1900, verb=0.55, seed=0):
        """A legato solo line (bowed strings with a little horn) with portamento: events [(t_rel, midi, dur)]."""
        total = max(tr + d for tr, _, d in events)
        n = ns(total + 1.5)
        t = tv(n)
        curve = np.full(n, float(events[0][1] + 12 * octave))
        gate = np.zeros(n)
        for tr, m, d in events:
            i0, i1 = ns(tr), min(n, ns(tr + d))
            curve[i0:] = m + 12 * octave
            gate[i0:i1] = 1.0
        curve = smooth(smooth(curve, 0.05), 0.05)
        gate = smooth(smooth(gate, 0.1), 0.18)
        vib = 1 + 0.0055 * np.sin(2 * np.pi * 5.3 * t) * smooth(gate, 0.7)
        f = mtof(curve) * vib
        rng = np.random.default_rng(seed)
        y = saw(f, n, rng.random()) + saw(f * 1.0035, n, rng.random()) + 0.6 * saw(f * 0.9968, n, rng.random())
        y = lpf(y, cutoff, 2) * gate
        self.m.add("music", pan(y * 0.16, -0.12), t0, gain, verb=verb)
        self.m.add("music", pan(lpf(y, cutoff * 0.6, 2) * 0.1, 0.25), t0 + 0.012, gain, verb=verb)

    def impact(self, t, size=1.0, cold=False, major=False, root=28):
        self.m.add("music", braam(size, root=root, cold=cold, major=major, seed=int(t * 10)), t, 0.5 * size, verb=0.5)
        self.m.add("sfx", boom(size), t, 0.55, verb=0.4)
        if not cold:
            self.m.add("sfx", shimmer(2.2, 16, int(t)), t + 0.05, 0.7 * size, verb=0.8)

    # --- the score, scene by scene
    def compose(self):
        m, at, end = self.m, self.at, self.end

        # COLD OPEN: machine productivity, a hard cut to silence, the compass, the title
        bar = 60 / 112 * 4
        cut = at("cold_open", off=13.1)
        g0 = cut - 6 * bar
        B = [g0 + k * bar for k in range(7)]
        seq = ["Em", "C", "Em", "C", "Am", "B"]
        self.prog(B[0], B[6], seq, 0.045, "pad", cutoff=1300, attack=0.9, release=0.08, verb=0.3, seed=1)
        self.arp(B[0], B[3], seq[:3], bpm=112, div=4, gain=0.04, octave=12, bright=2600, decay=0.12)
        self.arp(B[3], B[6], seq[3:], bpm=112, div=4, gain=0.06, octave=12, bright=3200, decay=0.12)
        self.groove(B[2], B[6], g0, bar, seq, 112, arp_g=0, bass_g=0.1)
        self.drums(B[4], B[6] - 0.05, bpm=112, kick_g=0.15, hat_g=0.05)
        self.prog(B[5], B[6], ["B"], 0.07, "strings", cutoff=2600, attack=1.9, release=0.05, verb=0.2, seed=3)
        m.music_dip(cut, cut + 3.6, 0.0, 0.06)
        self.motif(at("cold_open", "c", "end", 0.3), QUESTION, 0.45, gain=0.6, bus="sfx")
        comp = at("cold_open", off=17.0)
        title = at("cold_open", off=20.4)
        self.drone(cut + 3.5, title - cut - 3.0, 0.16, attack=2.5, release=0.6)
        self.prog(comp, title, ["Em"], 0.06, "strings", cutoff=1800, attack=3.0, release=0.2, verb=0.5, seed=5)
        self.prog(title, self.end("cold_open"), ["Em9"], 0.15, "strings", bassg=0.18, cutoff=2600, attack=0.04, release=3.5, verb=0.5, seed=7)
        self.prog(title, self.end("cold_open"), ["Em9"], 0.06, "choir", attack=0.3, release=3.5, verb=0.7, seed=8)

        # HORIZONS: a night landscape, three horizons, an unknown timeline
        h0 = at("horizons", off=0.9)
        segs = self.chain(h0, [("Em9", 5.8), ("Cmaj7", 7.2), ("G", 9.4), ("D", 4.9), ("Dsus", 4.9), ("Am", 4.2), ("Em", 5.1), ("C", 3.0), ("D", 3.5)],
                          0.055, "strings", bassg=0.07, cutoff=1700, attack=1.6, release=1.6, verb=0.5, seed=100)
        self.chain(h0, [(n_, b_ - a_) for a_, b_, n_ in segs], 0.03, "pad", cutoff=900, attack=1.6, release=1.6, verb=0.5, seed=120)

        def chord_at(t, segs=segs):
            for a_, b_, n_ in segs:
                if a_ <= t < b_:
                    return CH[n_][0]
            return CH[segs[-1][2]][0]

        def felt(t, j):
            notes = chord_at(t)
            m.add("music", piano(notes[[0, 2, 4, 3][j % 4]] + 12, 0.26 + 0.05 * (j % 4 == 0), 3.5, 0.25), t, 0.36, verb=0.55)
        self.steps(at("horizons", "b", off=-0.1), at("horizons", "e"), at("horizons", "b", off=-0.1), 1.0, felt)
        self.prog(at("horizons", "d", off=-0.1), at("horizons", "e"), ["D", "Dsus"], 0.04, "choir", attack=1.5, release=1.5, verb=0.7, seed=130)
        m.add("sfx", ticking(8.4, 1.0), at("horizons", "e"), 0.3, room=0.3)
        ab = at("absorption", off=0.4)  # the absorption grid starts here; count it in
        for k in range(4):
            m.add("music", kick(0.6), ab - (4 - k) * 60 / 112, 0.06 + 0.02 * k)

        # ABSORPTION: production work flows to the machines
        bar = 60 / 112 * 4
        g0 = ab
        loop = ["Em", "C", "G", "D"]
        stop = g0 + 13 * bar  # the cost curve collapses; the groove stops
        self.grid_prog(g0, stop, g0, bar, loop, 0.04, "pad", cutoff=1400, attack=0.5, release=0.6, verb=0.35, seed=140)
        self.groove(g0, stop, g0, bar, loop, 112, arp_g=0.045, bass_g=0.0, seed=1)
        self.groove(g0 + 2 * bar, stop, g0, bar, loop, 112, arp_g=0.0, bass_g=0.085, kick_g=0.13, hat_g=0.0)
        flips = at("absorption", "c")
        self.drums(g0 + 7 * bar, stop - 0.05, bpm=112, kick_g=0.0, hat_g=0.045)
        self.prog(flips - 1.8, flips + 0.1, ["D"], 0.05, "strings", cutoff=2600, attack=1.6, release=0.3, verb=0.3, seed=150)
        self.grid_prog(g0 + 8 * bar, stop, g0, bar, loop, 0.045, "strings", cutoff=2400, attack=0.4, release=0.6, verb=0.4, seed=160)

        def sparkle(t, j):
            notes = self.chord_of(t, g0, bar, loop)[0]
            m.add("music", bell(notes[[1, 2, 3, 4][j % 4]] + 24, 0.2, 1.0, ratio=3.0, index=1.0, decay=0.4, p=0.5 * np.sin(j)), t, 0.16, verb=0.45)
        self.steps(g0 + 8 * bar, stop, g0, 60 / 112, sparkle)
        self.chain(stop, [("Am", 2 * bar), ("B", at("bottleneck", off=0.45) - stop - 2 * bar)], 0.06, "strings", bassg=0.08, cutoff=2000, attack=1.2, release=0.15, verb=0.45, seed=170)
        self.prog(stop + 2 * bar, at("bottleneck", off=0.45), ["B"], 0.04, "choir", attack=1.8, release=0.1, verb=0.6, seed=175)

        # BOTTLENECK: judgment
        j0 = at("bottleneck", off=0.45)
        self.prog(j0, at("bottleneck", "b"), ["Em"], 0.06, "strings", bassg=0.1, cutoff=2400, attack=0.04, release=2.0, verb=0.55, seed=180)
        g1, bar = at("bottleneck", "b", off=-0.1), 2.5
        loop = ["Am", "Em", "C", "D"]
        c0 = g1 + 3 * bar
        self.grid_prog(g1, c0, g1, bar, loop, 0.045, "pad", cutoff=1300, attack=0.6, release=0.8, verb=0.45, seed=185)

        def heart(t, j):
            notes = self.chord_of(t, g1, bar, loop)[0]
            m.add("music", pluck(notes[[0, 2, 4, 2][j % 4]] + 12, 0.5, 0.6, 2000, 380, 0.22, p=0.3 * np.sin(j)), t, 0.07, verb=0.35)
        self.steps(g1, c0, g1, 60 / 96 / 2, heart)
        self.steps(g1, c0, g1, bar / 2, lambda t, j: m.add("music", bass(self.chord_of(t, g1, bar, loop)[1], bar / 2 * 0.9, 0.6, 240), t, 0.08))
        self.chain(c0, [("Cmaj7", at("bottleneck", "c", off=3.0) - c0), ("G", self.end("bottleneck") + 1.0 - at("bottleneck", "c", off=3.0))],
                   0.075, "strings", bassg=0.09, cutoff=2400, attack=1.0, release=2.2, verb=0.55, seed=190)
        self.prog(at("bottleneck", "c", off=3.0), self.end("bottleneck") + 1.0, ["G"], 0.045, "choir", attack=0.8, release=2.2, verb=0.7, seed=195)

        # AGI: agents act; the product manager orchestrates
        a0 = self.S["agi"]["start"]
        m.add("music", pad(CH["Em9"][0], 3.6, 1.2, 1.2, 1100, seed=200), a0 + 0.2, 0.045, verb=0.5)
        g2, bar = at("agi", "b"), 2.0
        o_start = g2 + 5 * bar
        o_end = at("agi", "d", off=-1.1)
        self.grid_prog(g2, o_start, g2, bar, ["Em", "C", "G", "D"], 0.04, "pad", cutoff=1400, attack=0.4, release=0.5, verb=0.35, seed=205)
        self.groove(g2, o_start, g2, bar, ["Em", "C", "G", "D"], 120, arp_g=0.05, bass_g=0.085, seed=2)
        self.drums(g2 + 2 * bar, o_start, bpm=120, kick_g=0.14, hat_g=0.04)
        loop = ["C", "G", "D", "Em"]
        self.grid_prog(o_start, o_end, o_start, bar, loop, 0.06, "strings", bassg=0.06, cutoff=2600, attack=0.3, release=0.5, verb=0.45, seed=210)
        self.grid_prog(o_start, o_end, o_start, bar, loop, 0.035, "choir", attack=0.5, release=0.5, verb=0.6, seed=220)
        self.groove(o_start, o_end, o_start, bar, loop, 120, arp_g=0.055, bass_g=0.09, kick_g=0.15, hat_g=0.045, bright=3200, seed=3)
        m.add("music", pad(CH["Em9"][0], at("agi", "d", "end") - o_end, 0.5, 1.0, 900, seed=230), o_end, 0.04, verb=0.5)
        outc = at("agi", "d", off=1.6)
        self.prog(outc, self.end("agi") + 1.2, ["G"], 0.12, "strings", bassg=0.14, cutoff=2800, attack=0.05, release=2.0, verb=0.55, seed=235)
        self.prog(outc, self.end("agi") + 1.2, ["G"], 0.05, "choir", attack=0.3, release=2.0, verb=0.7, seed=236)

        # ASI: something vast; then the human questions
        s0 = self.S["asi"]["start"]
        sc = at("asi", "c", off=-0.1)
        dark = self.chain(s0 + 0.2, [("Em", 5.3), ("F", sc - s0 - 5.5)], 0.05, "pad", bassg=0.06, cutoff=900, attack=2.0, release=1.2, verb=0.6, seed=240)
        self.chain(s0 + 0.2, [(n_, b_ - a_) for a_, b_, n_ in dark], 0.045, "choir", attack=2.0, release=1.2, verb=0.7, seed=245)
        self.drone(s0 + 0.2, sc - s0, 0.13, attack=2.0, release=1.2)
        sd = at("asi", "d", off=-0.6)
        human = self.chain(sc, [("Am", (sd - sc) / 4), ("C", (sd - sc) / 4), ("G", (sd - sc) / 4), ("D", (sd - sc) / 4)], 0.045, "pad", bassg=0.05, cutoff=1300, attack=0.8, release=0.8, verb=0.5, seed=250)
        for k, q in enumerate([c for c in self.tl["cues"] if c.get("scene") == "asi" and c["type"] == "pop"]):
            m.add("music", piano([76, 79, 74, 71][k % 4], 0.3, 4.0, 0.25), q["t"] + 0.02, 0.42, verb=0.6)
        self.chain(sd, [("Cmaj7", 3.0), ("G", self.end("asi") + 1.5 - sd - 3.0)], 0.08, "strings", bassg=0.1, cutoff=2400, attack=1.0, release=2.5, verb=0.55, seed=260)
        self.prog(sd + 0.5, self.end("asi") + 1.5, ["G"], 0.045, "choir", attack=1.5, release=2.5, verb=0.7, seed=265)

        # VERDICT: the question, the yes, the old job and the new one
        v0 = self.S["verdict"]["start"]
        yes = at("verdict", "b")
        self.motif(v0 + 0.8, QUESTION, 0.45, gain=0.55)
        self.chain(v0 + 0.4, [("Asus2", 4.2), ("Bsus", yes - v0 - 4.6)], 0.045, "pad", bassg=0.05, cutoff=1100, attack=1.5, release=0.2, verb=0.5, seed=270)
        but = at("verdict", "b", off=1.2)
        self.prog(yes - 0.05, but, ["G"], 0.13, "strings", bassg=0.15, cutoff=3000, attack=0.03, release=1.2, verb=0.55, seed=275)
        self.prog(yes - 0.05, but, ["G"], 0.06, "choir", attack=0.2, release=1.2, verb=0.7, seed=276)
        oldc = at("verdict", "c", off=-0.1)
        m.add("music", pad(CH["Em"][0], oldc - but, 0.6, 0.5, 1000, seed=277), but, 0.045, verb=0.5)
        newc = at("verdict", "d", off=-0.25)
        loop, bar = ["Am", "Em", "C", "B"], 2.4
        self.grid_prog(oldc, newc, oldc, bar, loop, 0.045, "pad", cutoff=1200, attack=0.5, release=0.6, verb=0.45, seed=280)

        def uneasy(t, j):
            notes = self.chord_of(t, oldc, bar, loop)[0]
            m.add("music", pluck(notes[[0, 3, 1, 3][j % 4]] + 12, 0.45, 0.4, 1800, 380, 0.1, p=0.3 * np.sin(j)), t, 0.06, verb=0.3)
        self.steps(oldc, newc, oldc, 0.3, uneasy)
        self.steps(oldc, newc, oldc, bar / 2, lambda t, j: m.add("music", bass(self.chord_of(t, oldc, bar, loop)[1], bar / 2 * 0.9, 0.6, 220), t, 0.08))
        grow = at("verdict", "e", off=-0.3)
        loop = ["C", "G", "D", "Em"]
        self.grid_prog(newc, grow, newc, bar, loop, 0.055, "strings", bassg=0.05, cutoff=2600, attack=0.4, release=0.6, verb=0.45, seed=290)
        self.groove(newc, grow, newc, bar, loop, 100, arp_g=0.05, bass_g=0.085, kick_g=0.13, hat_g=0.04, bright=3000, seed=4)
        self.chain(grow, [("Cmaj7", 3.4), ("D", self.end("verdict") + 0.2 - grow - 3.4)], 0.06, "strings", bassg=0.07, cutoff=2200, attack=1.0, release=0.5, verb=0.55, seed=295)
        for k, mm in enumerate([71, 74, 76]):
            m.add("music", piano(mm, 0.28, 4.0, 0.25), grow + 0.6 + 1.6 * k, 0.4, verb=0.6)

        # STACK: seven layers of skill; each one adds a voice to the band
        st, ste = self.S["stack"]["start"], self.end("stack")
        g0, bar = at("stack", "L1a", off=-0.05), 2.5
        beat = bar / 4
        loop = ["Em", "C", "G", "D"]
        crown = at("stack", "Ca", off=-0.1)
        T = [at("stack", f"L{k}a", off=-0.05) for k in range(1, 8)]

        def q(t):
            return g0 + np.ceil((t - g0) / bar - 1e-6) * bar
        chord = lambda t: self.chord_of(t, g0, bar, loop)
        m.add("music", pad(CH["Em9"][0], g0 - st - 3.0 + 0.5, 2.5, 1.2, 900, seed=300), st + 3.0, 0.045, verb=0.6)
        self.grid_prog(g0, crown, g0, bar, loop, 0.038, "pad", cutoff=1200, attack=0.6, release=1.0, verb=0.45, seed=305)

        def l1(t, j):  # customer obsession: felt piano
            notes = chord(t)[0]
            m.add("music", piano(notes[[0, 2, 3, 4, 3, 2, 1, 2][j % 8]] + 12, 0.27 + 0.06 * (j % 4 == 0), 2.5, 0.3), t, 0.34, verb=0.45)

        def l2(t, j):  # product sense and taste: pizzicato answers
            notes = chord(t)[0]
            m.add("music", pluck(notes[[4, 3, 2, 3][j % 4]] + 12, 0.5, 0.4, 2400, 400, 0.1, p=0.4 * np.sin(j)), t + beat / 2, 0.06, verb=0.3)

        def l3(t, j):  # AI fluency: a fine digital sparkle
            notes = chord(t)[0]
            m.add("music", bell(notes[[0, 1, 2, 3, 4, 3, 2, 1][j % 8]] + 24, 0.18, 0.9, ratio=3.0, index=1.0, decay=0.35, p=0.6 * np.sin(j * 0.7)), t, 0.16, verb=0.4)

        def l4(t, j):  # builder skills: pulse bass
            m.add("music", bass(chord(t)[1], beat / 2 * 0.8, 0.7, 320), t, 0.085)
        self.steps(q(T[0]), crown, g0, beat, l1)
        self.steps(q(T[1]), crown, g0, beat, l2)
        self.steps(q(T[2]), crown, g0, beat / 4, l3)
        self.steps(q(T[3]), crown, g0, beat / 2, l4)
        self.drums(q(T[3]), crown - 0.05, bpm=96, kick_g=0.13, hat_g=0.0)
        self.drums(q(T[4]), crown - 0.05, bpm=96, kick_g=0.0, hat_g=0.042)  # data: hats
        self.grid_prog(q(T[5]), crown, g0, bar, loop, 0.05, "strings", cutoff=2200, attack=0.8, release=0.8, verb=0.45, seed=320)  # domain depth
        self.grid_prog(q(T[6]), crown, g0, bar, loop, 0.035, "choir", attack=1.0, release=1.0, verb=0.6, seed=330)  # leadership and trust
        # the crown: the whole band lands, then warms into E major
        crown_segs = [("Cmaj7", 3.0), ("D", 3.0), ("E", ste + 0.5 - crown - 6.0)]
        self.chain(crown, crown_segs, 0.11, "strings", bassg=0.13, cutoff=3000, attack=0.05, release=2.5, verb=0.55, seed=340)
        self.chain(crown, crown_segs, 0.05, "choir", attack=0.3, release=2.5, verb=0.7, seed=345)
        for k, mm in enumerate([76, 71, 68, 71, 73, 71]):
            m.add("music", piano(mm, 0.26, 4.0, 0.25), at("stack", "Cb", off=0.4) + 1.2 * k, 0.36, verb=0.6)

        # KNOWLEDGE: three rings, orbiting in three-four time
        k0, ke = self.S["knowledge"]["start"], self.end("knowledge")
        g, beat = at("knowledge", "a", off=-0.2), 60 / 84
        bar = 3 * beat
        loop = ["Em", "C", "G", "D"]
        self.grid_prog(k0 + 0.3, ke + 0.3, g, 2 * bar, loop, 0.045, "pad", cutoff=1300, attack=1.0, release=1.2, verb=0.5, seed=400)
        chord = lambda t: self.chord_of(t, g, 2 * bar, loop)

        def orbit(t, j):
            notes = chord(t)[0]
            m.add("music", musicbox(notes[[0, 2, 4, 3, 2, 4][j % 6]] + 24, 0.4, 2.0), t, 0.17, verb=0.5)

        def ring2(t, j):
            notes = chord(t)[0]
            m.add("music", bell(notes[[1, 3, 4][j % 3]] + 24, 0.2, 1.2, ratio=3.0, index=1.0, decay=0.5, p=0.5 * np.sin(j)), t + beat / 2, 0.14, verb=0.5)
        self.steps(at("knowledge", "b", off=-0.2), ke - 0.5, g, beat, orbit)
        self.steps(at("knowledge", "c", off=-0.2), ke - 0.5, g, beat, ring2)
        self.steps(at("knowledge", "b", off=-0.2), ke - 0.5, g, bar, lambda t, j: m.add("music", bass(chord(t)[1], bar * 0.9, 0.6, 220), t, 0.075))
        self.grid_prog(at("knowledge", "d", off=-0.2), ke + 0.3, g, 2 * bar, loop, 0.05, "strings", cutoff=2000, attack=1.0, release=1.5, verb=0.5, seed=410)

        # ROADMAP: a night climb toward sunrise, with a walking pulse and the journey theme
        r0, re_ = self.S["roadmap"]["start"], self.end("roadmap")
        Wt = [at("roadmap", "b", off=-0.6), at("roadmap", "c", off=-0.8), at("roadmap", "d", off=-0.8), at("roadmap", "e", off=-0.8)]
        m.add("music", pad(CH["Em9"][0], Wt[0] - r0 - 2.5, 2.0, 1.2, 1000, seed=500), r0 + 3.0, 0.045, verb=0.6)
        self.drone(r0 + 1.0, Wt[0] - r0 - 0.5, 0.12, attack=3.0, release=1.0)
        plans = [["Em", "C", "G", "D"], ["Em", "C", "G", "D"], ["Am", "Em", "C", "D"]]
        for i, chords in enumerate(plans):
            s0, s1 = Wt[i], Wt[i + 1]
            self.prog(s0, s1, chords, 0.045 + 0.01 * i, "pad", bassg=0.07, cutoff=1300 + 300 * i, attack=0.8, release=1.0, verb=0.45, seed=510 + 10 * i)

            def walk(t, j, i=i):
                m.add("music", tom(62, 0.7 if j % 2 == 0 else 0.4, 0.3), t, (0.1 if j % 2 == 0 else 0.05) + 0.02 * i, verb=0.2)
            self.steps(s0 + 0.6, s1, s0 + 0.6, 0.75, walk)
            if i >= 1:
                self.arp(s0 + 0.6, s1, chords, bpm=80, div=2, gain=0.045 + 0.01 * i, octave=12, bright=2400, decay=0.3)
            if i == 1:
                k = (s1 - s0) / 14.0
                self.lead(s0 + 0.05, [(tr * k, mm, d * k) for tr, mm, d in JOURNEY], gain=0.34, cutoff=1600, seed=11)
            if i == 2:
                self.prog(s0, s1, chords, 0.05, "strings", cutoff=2200, attack=1.0, release=1.0, verb=0.5, seed=540)
        summit = at("roadmap", "e", off=1.6)
        self.prog(Wt[3], summit, ["D"], 0.07, "strings", bassg=0.08, cutoff=2600, attack=2.0, release=0.1, verb=0.45, seed=550)
        self.drums(Wt[3] + 0.6, summit - 0.1, bpm=80, kick_g=0.0, hat_g=0.0, tom_g=0.2)
        top = [("G", 2.1), ("D", 2.1), ("Em", 2.1), ("C", 2.1), ("G", re_ + 1.0 - summit - 8.4)]
        self.chain(summit, top, 0.1, "strings", bassg=0.12, cutoff=3000, attack=0.1, release=2.5, verb=0.55, seed=560)
        self.chain(summit, top, 0.05, "choir", attack=0.4, release=2.5, verb=0.7, seed=570)
        self.lead(summit + 0.05, SUMMIT, gain=0.32, cutoff=1600, seed=12)
        self.drums(summit, summit + 8.4, bpm=80, kick_g=0.16, hat_g=0.03, tom_g=0.18)

        # HABITS: a light daily rhythm that falls away for deep thought
        h0, he = self.S["habits"]["start"], self.end("habits")
        g, bar = at("habits", "a", off=-0.2), 2.4
        loop = ["G", "D", "Em", "C"]
        still = at("habits", "h7", off=0.6)
        self.grid_prog(h0 + 0.2, still, g, bar, loop, 0.045, "pad", cutoff=1400, attack=0.6, release=0.8, verb=0.45, seed=600)

        def pizz(t, j):
            notes = self.chord_of(t, g, bar, loop)[0]
            m.add("music", pluck(notes[[0, 2, 4, 2, 3, 2, 4, 1][j % 8]] + 12, 0.5, 0.4, 2400, 400, 0.1, p=0.4 * np.sin(j)), t, 0.06, verb=0.3)
        self.steps(at("habits", "h1", off=-0.1), still, g, 0.3, pizz)
        self.steps(at("habits", "h1", off=-0.1), still, g, 0.6, lambda t, j: m.add("music", bass(self.chord_of(t, g, bar, loop)[1], 0.5, 0.6, 260), t, 0.08))
        self.prog(still, he + 0.8, ["G"], 0.06, "strings", cutoff=2000, attack=1.5, release=2.0, verb=0.6, seed=610)
        self.prog(at("habits", "h7", "end", -0.2), he + 0.8, ["G"], 0.045, "choir", attack=0.8, release=2.0, verb=0.7, seed=615)

        # BREAKING IN: doors open one by one; the last opens onto E major
        b0, be = self.S["breaking_in"]["start"], self.end("breaking_in")
        D = [at("breaking_in", k, off=-0.1) for k in ("b1", "b2", "b3", "b4")]
        m.add("music", pad(CH["Em9"][0], D[0] - b0, 2.0, 1.0, 1000, seed=620), b0 + 0.3, 0.05, verb=0.6)
        for i, name in enumerate(["Cmaj7", "G", "Dsus"]):
            self.prog(D[i], D[i + 1], [name], 0.05 + 0.008 * i, "pad", bassg=0.05, cutoff=1400, attack=0.6, release=1.2, verb=0.5, seed=630 + i)
            m.add("music", piano(CH[name][0][-1] + 12, 0.33, 4.0, 0.3), D[i] + 0.15, 0.4, verb=0.6)
        self.prog(D[3], be + 0.8, ["Eadd9"], 0.1, "strings", bassg=0.12, cutoff=2600, attack=1.2, release=2.5, verb=0.55, seed=640)
        self.prog(D[3] + 1.0, be + 0.8, ["Eadd9"], 0.05, "choir", attack=1.5, release=2.5, verb=0.7, seed=645)
        self.arp(D[3] + 0.5, be - 0.8, ["Eadd9"], bpm=96, div=2, gain=0.045, octave=12, bright=2600, decay=0.35)

        # EPILOGUE: smarter tools, wiser people; the title in E major
        x0, xe = self.S["epilogue"]["start"], self.end("epilogue")
        xc = at("epilogue", "c")
        title = at("epilogue", "c", "end", 0.15)
        m.add("music", stereo(sine(mtof(88), ns(3)) * env_exp(ns(3), 0.9, 0.01) * 0.15), x0 + 0.05, 0.5, verb=0.9)
        m.add("music", pad([52, 59, 64], xc - x0 + 1.0, 2.5, 2.0, 800, seed=700), x0 + 0.5, 0.05, verb=0.6)
        self.prog(at("epilogue", "b", off=-0.3), xc + 3.2, ["Eadd9"], 0.05, "strings", bassg=0.06, cutoff=2000, attack=2.0, release=1.5, verb=0.6, seed=705)
        self.prog(xc + 3.0, title, ["C#m", "A", "B"], 0.07, "strings", bassg=0.1, cutoff=2400, attack=1.0, release=0.4, verb=0.5, seed=710)
        self.prog(title, xe + 1.0, ["E"], 0.13, "strings", bassg=0.16, cutoff=3000, attack=0.05, release=3.0, verb=0.55, seed=720)
        self.prog(title, xe + 1.0, ["E"], 0.07, "choir", attack=0.3, release=3.0, verb=0.7, seed=721)

        # FINALE: start today
        f0, fe = self.S["finale"]["start"], self.end("finale")
        fin = ["E", "B", "C#m", "A", "E"]
        self.prog(f0 + 0.2, fe - 2.5, fin, 0.1, "strings", bassg=0.12, cutoff=2600, attack=1.5, release=3.0, verb=0.6, seed=800)
        self.prog(f0 + 0.2, fe - 2.5, fin, 0.05, "choir", attack=2.0, release=3.0, verb=0.7, seed=801)
        self.arp(f0 + 0.5, fe - 3.0, fin, bpm=96, div=2, gain=0.04, octave=12, bright=2400, decay=0.35)
        k = (fe - 2.5 - f0 - 0.2) / 5 / 2.1
        self.lead(f0 + 0.25, [(tr * k, mm - 3, d * k) for tr, mm, d in SUMMIT], gain=0.3, cutoff=1500, seed=13)

    # --- picture-synced sound effects
    def cues(self):
        for i, q in enumerate(self.tl["cues"]):
            t, ty = q["t"], q["type"]
            dur = q.get("dur", 1.0)
            m = _Scaled(self.m, q.get("gain", 1.0))
            if ty == "tick_soft":
                m.add("sfx", key(0, i, "soft"), t, 0.25)
            elif ty == "motif":
                self.motif(t, QUESTION if q.get("variant") == "question" else ANSWER, 0.55, gain=q.get("gain", 1.0))
                if q.get("variant") == "answer":
                    self.prog(t - 0.2, t + 5.0, ["Eadd9"], 0.08, "strings", bassg=0.1, cutoff=2200, attack=2.5, release=3.0, verb=0.6, seed=161)
            elif ty == "impact":
                self.impact(t, q.get("size", 1.0), cold=bool(q.get("cold")), major=bool(q.get("major")))
            elif ty == "boom":
                m.add("sfx", boom(q.get("size", 1.0)), t, 0.5, verb=0.4)
            elif ty == "riser":
                m.add("sfx", riser(dur, 1.0, i), t, 0.6, verb=0.3)
            elif ty == "whoosh":
                m.add("sfx", whoosh(dur, q.get("size", 1.0), i), t, 0.7, verb=0.3)
            elif ty == "shimmer":
                m.add("sfx", shimmer(dur, 16, i), t, 0.7, verb=0.8)
            elif ty == "swell":
                m.add("sfx", swell(dur), t, 0.6, verb=0.6)
            elif ty == "hum":
                m.add("sfx", hum(dur), t, 1.0)
            elif ty == "wind":
                m.add("sfx", wind(dur, q.get("level", 1.0), i), t, 0.09)
            elif ty == "datastream":
                m.add("sfx", datastream(dur, i), t, 0.8)
            elif ty == "pop":
                m.add("sfx", pop(q.get("idx", 0)), t, 0.8, verb=0.2)
            elif ty == "swarm":
                m.add("sfx", swarm(dur, i), t, 0.9)
            elif ty == "cutoff":
                m.add("sfx", cutoff(), t, 0.8)
            elif ty == "compass":
                m.add("sfx", compass(dur, i), t, 0.8, verb=0.5)
            elif ty == "flip":
                m.add("sfx", flip(q.get("idx", 0)), t, 0.8, verb=0.2)
            elif ty == "flow":
                m.add("sfx", flow(dur, i), t, 1.0)
            elif ty == "strike":
                m.add("sfx", strike(), t, 0.9)
            elif ty == "crack_soft":
                m.add("sfx", crack_soft(i), t, 0.8, verb=0.3)
            elif ty == "slab":
                m.add("sfx", slab(q.get("idx", 0)), t, 0.45, verb=0.35)
            elif ty == "camp":
                m.add("sfx", camp(q.get("idx", 0), bool(q.get("soft"))), t, 0.45, verb=0.4)
            elif ty == "door":
                m.add("sfx", door(q.get("idx", 0), i), t, 0.8, verb=0.4)
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


def subtitles(tl, path, width=42):
    """Narration subtitles: sentence-aware cues of at most two lines of `width`
    characters, each timed by its share of the clip's characters."""
    def ts(t):
        h, r = divmod(max(0, t), 3600)
        mnt, s = divmod(r, 60)
        return f"{int(h):02d}:{int(mnt):02d}:{int(s):02d},{int(round((s % 1) * 1000)):03d}"

    def wrap(sentence):
        lines, cur = [], ""
        for w in sentence.split():
            if cur and len(cur) + len(w) + 1 > width:
                lines.append(cur)
                cur = w
            else:
                cur = (cur + " " + w).strip()
        return lines + [cur]

    def balance(g):
        """Re-break a two-line cue near its middle so the lines have similar lengths."""
        if len(g) != 2:
            return g
        words = " ".join(g).split()
        best = None
        for i in range(1, len(words)):
            a, b = " ".join(words[:i]), " ".join(words[i:])
            if len(a) <= width and len(b) <= width and (best is None or abs(len(a) - len(b)) < best[0]):
                best = (abs(len(a) - len(b)), [a, b])
        return best[1] if best else g

    cues = []
    for s in tl["scenes"]:
        for c in s["clips"]:
            text = " ".join(c["text"].split())
            groups = []
            for sen in re.split(r"(?<=[.!?:])\s+", text):
                lines = wrap(sen)
                # pair lines into two-line cues, balancing an odd last line
                for i in range(0, len(lines), 2):
                    groups.append(lines[i:i + 2])
            # merge short neighbours (e.g. "Yes." + "But not…") when they fit on two lines
            merged = []
            for g in groups:
                if merged and len(merged[-1]) == 1 and len(g) == 1:
                    merged[-1] = merged[-1] + g
                else:
                    merged.append(g)
            merged = [balance(g) for g in merged]
            total = sum(len(" ".join(g)) + 1 for g in merged)
            t, pos = c["abs"], 0
            for i, g in enumerate(merged):
                n = len(" ".join(g)) + 1
                a0 = t + c["dur"] * pos / total
                pos += n
                a1 = t + c["dur"] * pos / total + (0.25 if i == len(merged) - 1 else 0.0)
                cues.append([a0, a1, "\n".join(g)])
    for i in range(len(cues) - 1):  # no overlaps; at least 0.8 s on screen when there's room
        cues[i][1] = min(max(cues[i][1], cues[i][0] + 0.8), cues[i + 1][0] - 0.02)
    out = [f"{k}\n{ts(a0)} --> {ts(a1)}\n{txt}\n" for k, (a0, a1, txt) in enumerate(cues, 1)]
    open(path, "w").write("\n".join(out))


def chapters(tl, path):
    """FFmpeg metadata file with one chapter per scene (titles from story.json)."""
    story = json.load(open(os.path.join(ROOT, "story.json")))
    titles = {sc["id"]: sc.get("chapter", sc["id"]) for sc in story["scenes"]}
    out = [";FFMETADATA1", "title=What's Worth Building — The Future of Product Management in the Age of AI"]
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
