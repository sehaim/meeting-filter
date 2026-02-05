from rapidfuzz import fuzz
import re
from dataclasses import dataclass
from typing import List


@dataclass
class Finding:
    label: str
    start: int
    end: int
    confidence: float = 1.0


RRN = re.compile(r"\b\d{6}-\d{7}\b")
EMAIL = re.compile(r"\b[\w\.-]+@[\w\.-]+\.\w+\b")
PHONE = re.compile(r"\b01[016789]-\d{3,4}-\d{4}\b")
CARD = re.compile(r"\b(?:\d[ -]*?){13,16}\b")

BANNED_WORDS = ["sk", "에스케이", "오백억", "500억"]

SHORT_LATIN_BANNED = {
    "SK": re.compile(r"(?i)\bS\s*K\b"),  # "sk" / "s k" 둘 다 1번만 매칭
}


def _normalize_korean_text(s: str) -> str:
    # 공백/구두점 제거 + 대문자 통일(영문)
    # (너무 공격적으로 바꾸면 start/end 매핑이 어려워지니 "최소 정규화"만)
    out = []
    for ch in s:
        # 공백류 제거
        if ch.isspace():
            continue
        # 간단한 구두점 제거
        if ch in "-_.,:;()[]{}\"'`~!@#$%^&*+=|\\/<>?":
            continue
        out.append(ch)
    return "".join(out).upper()


def _find_fuzzy_banned_spans(
    text: str,
    banned_words: List[str],
    threshold: int = 85,
    max_window_extra: int = 2,
) -> List[Finding]:
    """
    text에서 banned_words와 비슷한 구간을 찾아 Finding으로 반환.
    - threshold: 0~100 유사도 기준
    - max_window_extra: 길이 흔들림 허용(예: '대외비'(3) vs '대회비'(3) / '테레비'(3))
    """
    findings: List[Finding] = []

    # 원문 기준으로 start/end를 유지하려면, 여기서는 원문 text를 그대로 슬라이딩한다.
    # 대신 비교할 때만 normalize한다.
    text_len = len(text)

    # 금칙어도 비교용 normalize
    banned_norm = [(w, _normalize_korean_text(w)) for w in banned_words]

    for original_w, w_norm in banned_norm:
        L = len(original_w)

        # 길이 L 주변으로만 윈도우 탐색(너무 넓히면 오탐 증가)
        for win_len in range(max(1, L - max_window_extra), L + max_window_extra + 1):
            if win_len > text_len:
                continue

            for i in range(0, text_len - win_len + 1):
                chunk = text[i : i + win_len]
                chunk_norm = _normalize_korean_text(chunk)
                if not chunk_norm:
                    continue

                score = fuzz.ratio(chunk_norm, w_norm)
                if score >= threshold:
                    findings.append(
                        Finding(
                            label="BANNED_WORD_FUZZY",
                            start=i,
                            end=i + win_len,
                            confidence=min(0.99, score / 100.0),
                        )
                    )

    # 같은 위치에 여러 개 잡힐 수 있으니, 겹치는 건 가장 높은 confidence만 남기기
    findings.sort(key=lambda f: (f.start, -(f.end - f.start), -f.confidence))

    merged: List[Finding] = []
    for f in findings:
        if not merged:
            merged.append(f)
            continue
        prev = merged[-1]
        # overlap이면 더 높은 confidence/더 긴 span을 우선
        if f.start <= prev.end:
            if (f.confidence, f.end - f.start) > (
                prev.confidence,
                prev.end - prev.start,
            ):
                merged[-1] = f
        else:
            merged.append(f)

    return merged


def detect(text: str) -> List[Finding]:
    findings: List[Finding] = []

    for m in RRN.finditer(text):
        findings.append(Finding("RRN", m.start(), m.end()))
    for m in EMAIL.finditer(text):
        findings.append(Finding("EMAIL", m.start(), m.end()))
    for m in PHONE.finditer(text):
        findings.append(Finding("PHONE", m.start(), m.end()))
    for m in CARD.finditer(text):
        findings.append(Finding("CARD_LIKE", m.start(), m.end(), 0.7))

    # 금칙어: 짧은 영문(공백 포함) 우선 처리 (예: "sk", "s k")
    for key, pat in SHORT_LATIN_BANNED.items():
        for m in pat.finditer(text):
            findings.append(Finding("BANNED_WORD", m.start(), m.end(), 0.99))

    # 금칙어: 정확 일치(반복 출현까지) - 짧은 영문은 위에서 처리했으니 제외
    for w in BANNED_WORDS:
        if w.isascii() and len(w) <= 3:
            continue

        start = 0
        while True:
            idx = text.find(w, start)
            if idx == -1:
                break
            findings.append(Finding("BANNED_WORD", idx, idx + len(w), 0.95))
            start = idx + 1

    # 금칙어: 퍼지 매칭(예: 대외비 -> 대회비/데레비/테레비 등)
    # 데모 기준: 오탐을 줄이려면 threshold를 88~92로 올려도 됨
    has_exact_banned = any(f.label == "BANNED_WORD" for f in findings)

    if not has_exact_banned:
        findings.extend(_find_fuzzy_banned_spans(text, BANNED_WORDS, threshold=92))

    return findings
