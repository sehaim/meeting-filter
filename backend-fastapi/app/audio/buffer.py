from collections import deque
from dataclasses import dataclass


@dataclass
class AudioFrame:
    data: bytes  # PCM16 little-endian
    ms: int  # frame duration in ms


class AudioChunker:
    """
    프레임이 계속 들어오면 CHUNK_MS 단위로 묶어서 뽑아줌
    """

    def __init__(self, chunk_ms: int):
        self.chunk_ms = chunk_ms
        self.q: deque[AudioFrame] = deque()
        self.acc_ms = 0

    def push(self, frame: AudioFrame) -> None:
        self.q.append(frame)
        self.acc_ms += frame.ms

    def pop_chunk_if_ready(self):
        if self.acc_ms < self.chunk_ms:
            return None

        target = self.chunk_ms
        out = bytearray()
        used_ms = 0

        while self.q and used_ms < target:
            f = self.q[0]
            out.extend(f.data)
            used_ms += f.ms
            self.q.popleft()

        self.acc_ms -= used_ms
        return bytes(out), used_ms
