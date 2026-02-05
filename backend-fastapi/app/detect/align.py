from __future__ import annotations
from dataclasses import dataclass
from typing import List, Tuple


@dataclass
class CharSpan:
    start: int
    end: int


@dataclass
class WordSpan:
    w_start: int
    w_end: int  # inclusive


def build_text_and_word_char_ranges(
    words: List[str],
) -> tuple[str, List[tuple[int, int]]]:
    """
    words를 공백으로 join한 문자열과,
    각 word가 차지하는 char 범위 [(s,e)] (e는 exclusive)를 반환
    """
    parts = []
    ranges = []
    cursor = 0
    for i, w in enumerate(words):
        if i > 0:
            parts.append(" ")
            cursor += 1
        s = cursor
        parts.append(w)
        cursor += len(w)
        e = cursor
        ranges.append((s, e))
    return "".join(parts), ranges


def charspan_to_wordspan(
    span: CharSpan, word_ranges: List[tuple[int, int]]
) -> WordSpan | None:
    """
    char span이 겹치는 단어 인덱스 범위를 찾음
    """
    hits = []
    for i, (s, e) in enumerate(word_ranges):
        # overlap?
        if not (span.end <= s or span.start >= e):
            hits.append(i)
    if not hits:
        return None
    return WordSpan(w_start=hits[0], w_end=hits[-1])
