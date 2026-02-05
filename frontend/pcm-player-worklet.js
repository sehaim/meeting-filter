// pcm-player-worklet.js
/* global AudioWorkletProcessor, registerProcessor */

class PcmPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];         // Float32Array 조각들
    this.queued = 0;         // 총 샘플 수
    this.started = false;

    // 시작 버퍼: 최소 1초(원하면 1.5초로 올려)
    this.START_SAMPLES = Math.floor(sampleRate * 1.5);

    this.port.onmessage = (e) => {
      const chunk = e.data; // Float32Array
      if (chunk && chunk.length) {
        this.queue.push(chunk);
        this.queued += chunk.length;
      }
    };
  }

  process(inputs, outputs) {
    const out = outputs[0][0]; // mono
    let i = 0;

    // 시작 전에는 충분히 쌓일 때까지 무음
    if (!this.started) {
      if (this.queued >= this.START_SAMPLES) this.started = true;
      out.fill(0);
      return true;
    }

    while (i < out.length) {
      if (this.queue.length === 0) {
        // 언더런: 무음으로 채움(끊김 대신 잠깐 무음)
        out.fill(0, i);
        break;
      }

      const head = this.queue[0];
      const copyLen = Math.min(head.length, out.length - i);

      out.set(head.subarray(0, copyLen), i);

      if (copyLen === head.length) {
        this.queue.shift();
      } else {
        this.queue[0] = head.subarray(copyLen);
      }

      this.queued -= copyLen;
      i += copyLen;
    }

    return true;
  }
}

registerProcessor("pcm-player", PcmPlayerProcessor);
