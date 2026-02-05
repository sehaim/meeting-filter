import numpy as np
from typing import List, Tuple


def pcm16_silence(pcm: bytes) -> bytes:
    return b"\x00" * len(pcm)


def pcm16_bleep_full(pcm: bytes, sample_rate: int, freq_hz: float = 1000.0) -> bytes:
    samples = len(pcm) // 2
    t = np.arange(samples) / sample_rate
    tone = 0.2 * np.sin(2 * np.pi * freq_hz * t)
    audio = np.int16(tone * 32767)
    return audio.tobytes()


def pcm16_bleep_regions(
    pcm: bytes,
    sample_rate: int,
    regions: List[Tuple[float, float]],
    freq_hz: float = 1000.0,
    chunk_start_sample: int = 0,  # 🔽 추가
) -> bytes:
    if not regions:
        return pcm

    audio = np.frombuffer(pcm, dtype=np.int16).copy()
    n = audio.shape[0]

    for t0, t1 in regions:
        s = max(0, int(t0 * sample_rate))
        e = min(n, int(t1 * sample_rate))
        if e <= s:
            continue

        # 🔽 핵심: 절대 샘플 인덱스로 위상 연속
        abs_idx = chunk_start_sample + np.arange(s, e)
        tone = 0.2 * np.sin(2 * np.pi * freq_hz * (abs_idx / sample_rate))
        audio[s:e] = np.int16(tone * 32767)

    return audio.tobytes()
