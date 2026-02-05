from __future__ import annotations
from dataclasses import dataclass
from typing import List, Optional

import numpy as np
from faster_whisper import WhisperModel

MODEL_NAME = "small"  # 느리면 "tiny"로 바꿔봐

_model: WhisperModel | None = None


def get_model() -> WhisperModel:
    global _model
    if _model is None:
        _model = WhisperModel(
            MODEL_NAME,
            device="cpu",
            compute_type="int8",
        )
    return _model


@dataclass
class WordTS:
    word: str
    start: float  # seconds
    end: float  # seconds


@dataclass
class STTResult:
    text: str
    words: List[WordTS]
    language: Optional[str] = None


def pcm16le_bytes_to_float32(pcm: bytes) -> np.ndarray:
    audio_i16 = np.frombuffer(pcm, dtype=np.int16)
    return audio_i16.astype(np.float32) / 32768.0


def transcribe_pcm16le(pcm: bytes, sample_rate: int = 16000) -> STTResult:
    model = get_model()
    audio = pcm16le_bytes_to_float32(pcm)

    segments, info = model.transcribe(
        audio,
        language="ko",
        vad_filter=False,
        beam_size=3,
        word_timestamps=True,
    )

    text_parts: List[str] = []
    all_words: List[WordTS] = []

    for seg in segments:
        if seg.text:
            text_parts.append(seg.text.strip())
        if getattr(seg, "words", None):
            for w in seg.words:
                if w.word:
                    all_words.append(
                        WordTS(
                            word=w.word.strip(), start=float(w.start), end=float(w.end)
                        )
                    )

    return STTResult(
        text=" ".join(text_parts).strip(),
        words=all_words,
        language=getattr(info, "language", None),
    )
