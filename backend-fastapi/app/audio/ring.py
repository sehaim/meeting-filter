from __future__ import annotations
from collections import deque


class PCM16RingBuffer:
    """
    PCM16LE mono 16kHz bytes를 ms 단위로 유지하는 링버퍼
    """

    def __init__(self, sample_rate: int, max_ms: int):
        self.sample_rate = sample_rate
        self.max_ms = max_ms
        self.q = deque()  # list[bytes]
        self.total_ms = 0

    def push(self, pcm: bytes, ms: int):
        self.q.append((pcm, ms))
        self.total_ms += ms
        while self.total_ms > self.max_ms and self.q:
            _, old_ms = self.q.popleft()
            self.total_ms -= old_ms

    def dump(self) -> bytes:
        return b"".join(pcm for pcm, _ in self.q)
