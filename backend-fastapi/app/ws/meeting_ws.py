from collections import deque
import math
import traceback
from starlette.websockets import WebSocket, WebSocketDisconnect
from app.core.config import settings
from app.audio.buffer import AudioChunker, AudioFrame
from app.audio.ring import PCM16RingBuffer
from app.stt.whisper_stt import transcribe_pcm16le
from app.detect.rules import detect
from app.audio.redact import pcm16_bleep_regions
from app.detect.align import (
    CharSpan,
    build_text_and_word_char_ranges,
    charspan_to_wordspan,
)


# 간단 규약:
# - 클라이언트는 binary로 PCM16 프레임을 보냄
# - 서버는 json(텍스트 결과) + binary(오디오) 를 번갈아 보냄

FRAME_MS = 20  # 데모 가정: 20ms 프레임이 온다고 치자 (실제는 클라에 맞춰야 함)

def merge_regions(regions, gap=0.1):
    """겹치거나 gap초 이내로 가까운 구간은 합친다."""
    if not regions:
        return []
    regions = sorted(regions, key=lambda x: x[0])
    out = [list(regions[0])]
    for s, e in regions[1:]:
        ps, pe = out[-1]
        if s <= pe + gap:
            out[-1][1] = max(pe, e)
        else:
            out.append([s, e])
    return [(a, b) for a, b in out]


async def handle_meeting_ws(ws: WebSocket):
    await ws.accept()

    chunker = AudioChunker(chunk_ms=settings.CHUNK_MS)
    ring = PCM16RingBuffer(sample_rate=settings.SAMPLE_RATE, max_ms=settings.STT_WINDOW_MS)

    # --- server-side holdback(고정 지연) 설정 ---
    holdback_ms = settings.BUFFER_MS  # .env: BUFFER_MS=2000
    holdback_sec = holdback_ms / 1000.0

    # CHUNK_MS=200이면 K=10 (2초 / 0.2초)
    K = max(1, math.ceil(holdback_ms / settings.CHUNK_MS))

    emit_q = deque()

    # ✅ 전체 스트림에서 지금까지 송출한 샘플 수(PCM16 sample)
    emitted_samples = 0

    # ✅ "삐를 언제까지 유지할지" (전체 스트림 기준 abs sample index)
    bleep_until_abs_sample = 0

    # ✅ 삐 유지 히스테리시스(탐지 흔들림 방지용 꼬리)
    BLEEP_TAIL_MS = 200  # 200ms 정도 추천(데모용 안정성↑)

    try:
        while True:
            data = await ws.receive_bytes()  # PCM16 frame bytes
            chunker.push(AudioFrame(data=data, ms=FRAME_MS))

            chunk = chunker.pop_chunk_if_ready()
            if chunk is None:
                continue

            pcm_chunk, used_ms = chunk

            # 0) 입력 청크를 링버퍼 + 출력대기큐에 저장
            ring.push(pcm_chunk, used_ms)
            emit_q.append((pcm_chunk, used_ms))

            # 아직 holdback만큼 쌓이지 않았으면 "아무것도 내보내지 않음"
            if len(emit_q) <= K:
                continue

            # 1) STT는 최근 윈도우로
            pcm_window = ring.dump()
            window_ms = ring.total_ms
            window_sec = window_ms / 1000.0

            res = transcribe_pcm16le(pcm_window, sample_rate=settings.SAMPLE_RATE)
            text = res.text if res.text else ""
            words = res.words or []

            # 단어 기반 join 텍스트 만들기
            word_tokens = [w.word for w in words]
            joined_text, word_char_ranges = build_text_and_word_char_ranges(word_tokens)

            # 2) 금칙어 탐지
            findings = detect(joined_text)

            # 3) 내보낼 청크(가장 오래된 것)
            emit_pcm, emit_used_ms = emit_q.popleft()
            emit_chunk_sec = emit_used_ms / 1000.0

            # emit_pcm의 길이(샘플)
            emit_len_samples = len(emit_pcm) // 2

            # 4) emit 청크의 윈도우 내 위치
            emit_end_in_window = window_sec - holdback_sec
            emit_start_in_window = emit_end_in_window - emit_chunk_sec

            # warmup: 원음 송출 + 누적
            if emit_start_in_window < 0:
                await ws.send_json(
                    {
                        "ms": emit_used_ms,
                        "raw_text": "",
                        "safe_text": "",
                        "findings": [],
                        "regions_emit": [],
                        "note": "warming up",
                    }
                )
                await ws.send_bytes(emit_pcm)
                emitted_samples += emit_len_samples
                continue

            # 5) findings -> emit chunk 기준 regions 변환
            regions_emit = []

            PRE_PAD = 0
            POST_PAD = 0

            if words and findings:
                for f in findings:
                    ws_span = charspan_to_wordspan(CharSpan(f.start, f.end), word_char_ranges)
                    if ws_span is None:
                        continue

                    if not (0 <= ws_span.w_start < len(words)) or not (0 <= ws_span.w_end < len(words)):
                        continue
                    if ws_span.w_start > ws_span.w_end:
                        continue

                    if f.label == "BANNED_WORD_FUZZY":
                        ws_span.w_start = max(0, ws_span.w_start - 1)
                        ws_span.w_end = min(len(words) - 1, ws_span.w_end + 1)

                    w0 = words[ws_span.w_start]
                    w1 = words[ws_span.w_end]

                    rs, re = float(w0.start), float(w1.end)

                    overlap_s = max(rs, emit_start_in_window)
                    overlap_e = min(re, emit_end_in_window)

                    if overlap_e > overlap_s:
                        t0 = overlap_s - emit_start_in_window
                        t1 = overlap_e - emit_start_in_window

                        t0 = max(0.0, t0 - PRE_PAD)
                        t1 = min(emit_chunk_sec, t1 + POST_PAD)

                        regions_emit.append((t0, t1))

            # 5-1) 한 chunk 안에서 region merge
            regions_emit = merge_regions(regions_emit, gap=0.25)

            # ✅✅✅ 5-2) "삐 유지 상태" 업데이트 / 적용 (여기가 핵심)
            chunk_start_sample = emitted_samples  # 이 emit 청크의 abs 시작 sample

            # (A) 이번 chunk에서 탐지된 regions가 있으면, 그 끝을 abs sample로 환산해 bleep_until 늘림
            if regions_emit:
                # regions 끝 중 최대
                max_t1 = max(t1 for _, t1 in regions_emit)
                end_abs = chunk_start_sample + int(max_t1 * settings.SAMPLE_RATE)

                # tail(히스테리시스) 추가
                end_abs += int((BLEEP_TAIL_MS / 1000.0) * settings.SAMPLE_RATE)

                if end_abs > bleep_until_abs_sample:
                    bleep_until_abs_sample = end_abs

            # (B) 이전 chunk에서 이어져야 하는 삐가 현재 chunk에 걸쳐 있으면, regions에 carry-in 추가
            if bleep_until_abs_sample > chunk_start_sample:
                carry_end_samples = min(emit_len_samples, bleep_until_abs_sample - chunk_start_sample)
                carry_end_sec = carry_end_samples / settings.SAMPLE_RATE
                # chunk 처음부터 carry_end까지는 무조건 삐
                regions_emit.append((0.0, carry_end_sec))

            # (C) 최종 merge + (원하면) "한 단어면 한 번"을 위해 chunk 내 region을 1개로 강제
            regions_emit = merge_regions(regions_emit, gap=0.25)
            if regions_emit:
                # ✅ 데모 목적: chunk 내에서는 1개로 뭉개버리기(삐가 여러 번 끊기는 느낌 방지)
                t0 = min(s for s, _ in regions_emit)
                t1 = max(e for _, e in regions_emit)
                regions_emit = [(t0, t1)]

            # 6) 오디오 마스킹
            out_pcm = pcm16_bleep_regions(
                emit_pcm,
                settings.SAMPLE_RATE,
                regions_emit,
                chunk_start_sample=chunk_start_sample,  # redact.py가 이 인자 받도록 수정되어 있어야 함
            )

            safe_text = "[REDACTED]" if regions_emit else joined_text

            # 7) 전송
            await ws.send_json(
                {
                    "ms": emit_used_ms,
                    "raw_text": text,
                    "safe_text": safe_text,
                    "findings": [f.__dict__ for f in findings],
                    "regions_emit": [{"t0": r[0], "t1": r[1]} for r in regions_emit],
                    "holdback_ms": holdback_ms,
                    "queue_len": len(emit_q),
                    "bleep_until_abs_sample": int(bleep_until_abs_sample),
                    "chunk_start_sample": int(chunk_start_sample),
                }
            )
            await ws.send_bytes(out_pcm)

            # ✅ 송출 후 누적
            emitted_samples += emit_len_samples

    except WebSocketDisconnect as e:
        print("[WS] disconnected:", e.code, getattr(e, "reason", ""))
        return
    except Exception as e:
        print("[WS] exception:", repr(e))
        traceback.print_exc()
        try:
            await ws.close(code=1011)
        except RuntimeError:
            pass
