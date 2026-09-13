#!/usr/bin/env python3
"""
Builds the music bed and the sound design for the V2 ad.

Python rather than another scripts/*.mjs because this is signal processing and
the rest of the repo's build scripts are not; standard library only, so it runs
anywhere `python3` does with nothing installed.

Everything here is synthesised from oscillators and noise. That is not a
preference, it is the licence: an ad that will run as paid media cannot carry a
track whose commercial terms nobody has read, and the cheapest way to be certain
is to own every sample in it. It also means the bed is exactly on the grid the
picture is cut to - 120bpm, 30fps, fifteen frames to the beat - rather than
nearly on it.

    python3 scripts/build_ad_audio.py

Writes public/ad/music-bed.wav and public/ad/sfx/*.wav.
"""

import math
import os
import struct
import wave

SR = 44100
BPM = 120.0
SPB = 60.0 / BPM            # seconds per beat: 0.5
TOTAL_BEATS = 35            # 17.5s, the length of the composition
TOTAL = TOTAL_BEATS * SPB

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AD_DIR = os.path.join(HERE, "public", "ad")
SFX_DIR = os.path.join(AD_DIR, "sfx")


# ---------------------------------------------------------------- primitives

def buf(seconds):
    return [0.0] * int(SR * seconds)


def add(dst, src, at_seconds, gain=1.0):
    """Mix src into dst at a time offset, clipping at the end of dst."""
    start = int(at_seconds * SR)
    n = min(len(src), len(dst) - start)
    for i in range(max(0, -start), n):
        dst[start + i] += src[i] * gain


def env(n, attack, decay, sustain=0.0, release=None, curve=2.0):
    """
    A sampled ADSR, with a real sustain plateau.

    The plateau is the part that matters and the part the first version of this
    function did not have: it went straight from decay into release, so the
    release length alone decided when a note ended. A seventeen-second pad
    written with a "long" release therefore faded to silence two thirds of the
    way through the track, which is precisely the hole it had been added to fill.
    Release is now measured back from the end of the note, which is what every
    synthesiser means by it.
    """
    release = release if release is not None else max(1, n - attack - decay)
    release = min(release, max(1, n - attack - decay))
    hold_until = n - release
    out = [0.0] * n
    for i in range(n):
        if i < attack:
            v = (i / attack) if attack else 1.0
        elif i < attack + decay:
            t = (i - attack) / decay if decay else 1.0
            v = 1.0 + (sustain - 1.0) * (t ** (1 / curve))
        elif i < hold_until:
            v = sustain
        else:
            t = (i - hold_until) / release if release else 1.0
            v = sustain * max(0.0, 1.0 - t) ** curve
        out[i] = v
    return out


def sine(freq, seconds, phase=0.0):
    n = int(SR * seconds)
    return [math.sin(2 * math.pi * freq * (i / SR) + phase) for i in range(n)]


def sweep(f0, f1, seconds, curve=3.0):
    """Pitch sweep. The kick, the risers and the snap are all this."""
    n = int(SR * seconds)
    out = [0.0] * n
    phase = 0.0
    for i in range(n):
        t = i / n
        f = f1 + (f0 - f1) * ((1.0 - t) ** curve)
        phase += 2 * math.pi * f / SR
        out[i] = math.sin(phase)
    return out


_seed = [12345]


def noise(seconds):
    """Deterministic white noise - a fixed seed keeps renders reproducible."""
    n = int(SR * seconds)
    out = [0.0] * n
    s = _seed[0]
    for i in range(n):
        s = (1103515245 * s + 12345) & 0x7FFFFFFF
        out[i] = (s / 0x3FFFFFFF) - 1.0
    _seed[0] = s
    return out


def lowpass(sig, cutoff):
    """One-pole. Enough to turn noise into air and a saw into a pluck."""
    a = math.exp(-2 * math.pi * cutoff / SR)
    out = [0.0] * len(sig)
    y = 0.0
    for i, x in enumerate(sig):
        y = (1 - a) * x + a * y
        out[i] = y
    return out


def highpass(sig, cutoff):
    lp = lowpass(sig, cutoff)
    return [x - y for x, y in zip(sig, lp)]


def apply_env(sig, e):
    return [s * e[i] for i, s in enumerate(sig[: len(e)])]


def saw(freq, seconds):
    n = int(SR * seconds)
    out = [0.0] * n
    for i in range(n):
        t = (freq * i / SR) % 1.0
        out[i] = 2.0 * t - 1.0
    return out


# ---------------------------------------------------------------- instruments

def kick(seconds=0.34):
    body = sweep(155, 47, seconds, curve=4.5)
    e = env(len(body), int(SR * 0.001), int(SR * 0.10), 0.30, int(SR * 0.22), 2.4)
    body = apply_env(body, e)
    click = apply_env(noise(0.006), env(int(SR * 0.006), 1, int(SR * 0.004), 0.0, 1, 1.5))
    out = list(body)
    add(out, highpass(click, 1800), 0.0, 0.5)
    return out


def sub(freq, seconds):
    s = sine(freq, seconds)
    # A touch of the octave keeps it audible on a phone speaker, which cannot
    # reproduce the fundamental at all.
    s2 = sine(freq * 2, seconds)
    mixed = [a * 0.78 + b * 0.30 for a, b in zip(s, s2)]
    e = env(len(mixed), int(SR * 0.012), int(SR * seconds * 0.35), 0.62, int(SR * seconds * 0.5), 1.8)
    return apply_env(mixed, e)


def hat(seconds=0.05, bright=7200, level=1.0):
    n = highpass(noise(seconds), bright)
    e = env(len(n), int(SR * 0.0008), int(SR * seconds * 0.45), 0.0, 1, 2.6)
    return [x * level for x in apply_env(n, e)]


def pluck(freq, seconds=0.26):
    s = saw(freq, seconds)
    s = lowpass(s, freq * 4.2)
    e = env(len(s), int(SR * 0.004), int(SR * seconds * 0.55), 0.12, int(SR * seconds * 0.4), 2.2)
    return apply_env(s, e)


def pad(freqs, seconds, level=0.5):
    out = buf(seconds)
    for f in freqs:
        s = sine(f, seconds)
        add(out, s, 0.0, level / len(freqs))
    e = env(len(out), int(SR * 0.22), int(SR * seconds * 0.3), 0.75, int(SR * seconds * 0.45), 1.4)
    return apply_env(out, e)


def riser(seconds=1.0):
    n = lowpass(noise(seconds), 2600)
    out = [0.0] * len(n)
    for i, x in enumerate(n):
        t = i / len(n)
        out[i] = x * (t ** 2.2)
    tone = sweep(220, 900, seconds, curve=0.6)
    for i in range(len(out)):
        t = i / len(out)
        out[i] += tone[i] * 0.22 * (t ** 2.6)
    return out


def boom(seconds=1.1, f0=110, f1=38, level=1.0):
    b = sweep(f0, f1, seconds, curve=5.0)
    e = env(len(b), int(SR * 0.002), int(SR * 0.18), 0.34, int(SR * seconds * 0.7), 2.2)
    return [x * level for x in apply_env(b, e)]


# ---------------------------------------------------------------- the bed

# F major-ish, bright and warm rather than dramatic. Frequencies in Hz.
F2, C3, D3, F3, G3, A3, C4, D4, F4 = 87.31, 130.81, 146.83, 174.61, 196.00, 220.00, 261.63, 293.66, 349.23


def beat_time(b):
    return b * SPB


def build_music():
    """
    Structure follows the picture, act by act. The marks are beats, and they are
    the same beats the cuts are on:
      0   hook          sparse, immediate pulse - no intro to scroll past
      5   interrupt     one stab, then a bar with a hole in it
      8   upload        hats and the pluck motif arrive; momentum
      13  compare       build, riser into the reveal
      17  reveal        full, and the biggest hit of the track at beat 20
      23  human         pull everything out; let the payoff breathe
      28  cta           clean resolution, no new ideas, ends on a held chord
    """
    m = buf(TOTAL + 1.5)

    # --- Kick. Four to the floor from beat 8, half time before that.
    for b in range(TOTAL_BEATS):
        if b < 5:
            if b % 2 == 0:
                add(m, kick(), beat_time(b), 0.72)
        elif b < 8:
            if b == 5:
                add(m, kick(), beat_time(b), 0.95)
            # beats 6-7 are the hole after "Check first."
        elif b < 23:
            add(m, kick(), beat_time(b), 0.92)
        elif b < 28:
            if b % 2 == 0:
                add(m, kick(), beat_time(b), 0.62)
        else:
            if b % 4 == 0:
                add(m, kick(), beat_time(b), 0.70)

    # --- Sub. One note per bar, following the progression.
    progression = [
        (0, F2, 2.0), (2, F2, 1.5), (5, C3, 1.0),
        (8, F2, 2.0), (10, D3, 2.0), (12, C3, 1.0),
        (13, F2, 2.0), (15, G3 / 2, 1.0),
        (17, F2, 3.0), (20, C3, 1.5), (22, D3, 0.5),
        (23, F2, 2.5), (26, D3, 1.0),
        (28, F2, 2.0), (30, C3, 2.0), (32, F2, 3.0),
    ]
    for b, f, beats in progression:
        level = 0.34 if b < 8 else (0.46 if b < 23 else 0.30)
        add(m, sub(f, beats * SPB), beat_time(b), level)

    # --- Hats. Eighth notes once the ad has momentum.
    for b in range(8, 23):
        add(m, hat(0.045, 7600), beat_time(b), 0.20)
        add(m, hat(0.032, 9000), beat_time(b) + SPB / 2, 0.12)
    for b in range(28, TOTAL_BEATS):
        add(m, hat(0.040, 7200), beat_time(b), 0.11)

    # --- Pluck motif. The hook of the track; enters with the product.
    motif = [F4, C4, D4, A3, C4, F4, A3, G3]
    for i, b in enumerate(range(8, 16)):
        add(m, pluck(motif[i % len(motif)], 0.28), beat_time(b), 0.26)
        if b >= 11:
            add(m, pluck(motif[(i + 2) % len(motif)] * 0.5, 0.2), beat_time(b) + SPB / 2, 0.13)

    # Reveal: the motif returns an octave up, thinner, over the big moment.
    for i, b in enumerate(range(20, 23)):
        add(m, pluck(motif[i % len(motif)], 0.3), beat_time(b) + SPB / 2, 0.20)

    # --- Glue. A quiet sustained bed under the entire track.
    #
    # Without it the bar-to-bar gaps between kicks fall to actual silence, and a
    # track with holes in it reads as unfinished rather than as sparse. It sits
    # low enough to be inaudible as a part and is the reason the thing feels
    # continuous.
    add(m, pad([F3, C4], TOTAL), 0.0, 0.11)

    # --- Pads. Warmth under the product half.
    add(m, pad([F3, A3, C4], 5.0), beat_time(8), 0.30)
    add(m, pad([F3, C4, F4], 3.2), beat_time(17), 0.40)
    add(m, pad([F3, A3, C4, F4], 3.6), beat_time(28), 0.34)

    # --- Riser into the reveal. Ends exactly on beat 17.
    add(m, riser(1.5), beat_time(17) - 1.5, 0.30)

    # --- The two accents that matter.
    # Beat 19: the price snaps to 87.
    add(m, boom(0.8, 130, 52, 0.55), beat_time(19), 0.8)
    # Beat 20: the saving. The loudest single thing in the track.
    add(m, boom(1.5, 150, 36, 1.0), beat_time(20), 0.72)
    add(m, apply_env(highpass(noise(0.28), 3200), env(int(SR * 0.28), 2, int(SR * 0.05), 0.2, int(SR * 0.2), 2.0)), beat_time(20), 0.34)

    # --- Final chord, allowed to ring past the last frame and then faded.
    add(m, pad([F3, A3, C4, F4], 2.2), beat_time(32), 0.46)

    return m


# ---------------------------------------------------------------- sound design

def build_sfx():
    """
    Understated on purpose. The brief's instruction - felt more than noticed - is
    a level instruction: every one of these sits at least 12dB under the voice,
    and none of them is longer than the gesture it belongs to.
    """
    out = {}

    # A finger on glass. Almost entirely transient.
    tap = apply_env(highpass(noise(0.035), 2400), env(int(SR * 0.035), 1, int(SR * 0.012), 0.0, 1, 3.0))
    add(tap, apply_env(sine(1400, 0.035), env(int(SR * 0.035), 1, int(SR * 0.02), 0.0, 1, 3.0)), 0.0, 0.25)
    out["tap"] = tap

    # Screenshot: the two-stage snap a phone makes.
    sh = buf(0.22)
    add(sh, apply_env(highpass(noise(0.03), 3000), env(int(SR * 0.03), 1, int(SR * 0.02), 0.0, 1, 3.0)), 0.0, 0.9)
    add(sh, apply_env(highpass(noise(0.05), 1800), env(int(SR * 0.05), 1, int(SR * 0.04), 0.0, 1, 2.4)), 0.055, 0.6)
    out["shutter"] = sh

    # Upload: air moving past, rising.
    sw = lowpass(noise(0.5), 3200)
    sw = [x * ((i / len(sw)) ** 1.6) for i, x in enumerate(sw)]
    e = env(len(sw), int(SR * 0.2), int(SR * 0.12), 0.5, int(SR * 0.18), 2.0)
    out["swoosh"] = apply_env(sw, e)

    # A line of the basket being matched.
    tick = apply_env(sine(2100, 0.045), env(int(SR * 0.045), 1, int(SR * 0.03), 0.0, 1, 3.2))
    add(tick, apply_env(sine(3150, 0.03), env(int(SR * 0.03), 1, int(SR * 0.02), 0.0, 1, 3.2)), 0.0, 0.35)
    out["tick"] = tick

    # The check running: a soft two-tone pulse, quiet enough to sit under speech.
    sc = buf(0.9)
    for i in range(3):
        add(sc, apply_env(sine(760 + i * 90, 0.16), env(int(SR * 0.16), int(SR * 0.01), int(SR * 0.09), 0.0, 1, 2.0)), i * 0.26, 0.5)
    out["scan"] = sc

    # The price changing.
    sn = sweep(900, 420, 0.16, curve=2.0)
    out["snap"] = apply_env(sn, env(len(sn), 1, int(SR * 0.05), 0.25, int(SR * 0.1), 2.2))

    # The 87 landing.
    out["impact-87"] = boom(0.7, 150, 60, 0.8)

    # The saving landing. The strongest accent in the mix.
    i25 = boom(1.3, 170, 42, 1.0)
    add(i25, apply_env(highpass(noise(0.2), 2600), env(int(SR * 0.2), 1, int(SR * 0.06), 0.15, int(SR * 0.13), 2.0)), 0.0, 0.42)
    add(i25, apply_env(sine(523.25, 0.9), env(int(SR * 0.9), int(SR * 0.004), int(SR * 0.3), 0.2, int(SR * 0.5), 1.8)), 0.008, 0.22)
    out["impact-25"] = i25

    # The button.
    bt = buf(0.5)
    add(bt, apply_env(sine(660, 0.2), env(int(SR * 0.2), int(SR * 0.004), int(SR * 0.12), 0.0, 1, 2.4)), 0.0, 0.5)
    add(bt, apply_env(sine(990, 0.28), env(int(SR * 0.28), int(SR * 0.004), int(SR * 0.18), 0.0, 1, 2.2)), 0.06, 0.4)
    out["button"] = bt

    return out


# ---------------------------------------------------------------- output

def compress(sig, threshold=0.28, ratio=3.2, attack_ms=8.0, release_ms=160.0):
    """
    A gentle RMS-follower compressor.

    Needed because one impact fourteen times louder than the bed forces a
    peak-normaliser to turn everything else down, which is exactly how a mix ends
    up with a loud moment and nothing underneath it. Levelling first means the
    accent is the loudest thing by intent rather than by accident.
    """
    at = math.exp(-1.0 / (SR * attack_ms / 1000.0))
    re = math.exp(-1.0 / (SR * release_ms / 1000.0))
    out = [0.0] * len(sig)
    envf = 0.0
    for i, x in enumerate(sig):
        a = abs(x)
        coef = at if a > envf else re
        envf = (1 - coef) * a + coef * envf
        if envf > threshold:
            gain = (threshold + (envf - threshold) / ratio) / envf
        else:
            gain = 1.0
        out[i] = x * gain
    return out


def write_wav(path, samples, peak=0.89, compressed=False):
    """
    Roll off the bottom, level, then normalise and soft-clip.

    Mixed for a phone speaker: nothing below about 60Hz survives one, so the
    bottom goes rather than being left to eat headroom.
    """
    samples = highpass(samples, 32)
    if compressed:
        samples = compress(samples)

    hi = max((abs(s) for s in samples), default=1.0) or 1.0
    g = peak / hi
    out = []
    for s in samples:
        x = s * g
        # tanh-ish soft clip, transparent below the knee
        if x > 0.7:
            x = 0.7 + math.tanh((x - 0.7) * 3) * 0.29
        elif x < -0.7:
            x = -0.7 + math.tanh((x + 0.7) * 3) * 0.29
        out.append(int(max(-1.0, min(1.0, x)) * 32767))

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with wave.open(path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", s) for s in out))
    return len(out) / SR


def main():
    music = build_music()

    # Fade the tail so the bed ends with the picture instead of being cut off.
    end = int(TOTAL * SR)
    fade = int(0.45 * SR)
    for i in range(fade):
        if end - fade + i < len(music):
            music[end - fade + i] *= 1.0 - (i / fade)
    music = music[:end]

    seconds = write_wav(os.path.join(AD_DIR, "music-bed.wav"), music, peak=0.82, compressed=True)
    print(f"music-bed.wav  {seconds:.2f}s")

    for name, sig in build_sfx().items():
        s = write_wav(os.path.join(SFX_DIR, f"{name}.wav"), sig, peak=0.72)
        print(f"sfx/{name}.wav  {s:.3f}s")


if __name__ == "__main__":
    main()
