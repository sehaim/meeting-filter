// processor-worker.js
/* global AudioWorkletProcessor, registerProcessor */

class AudioProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0]; // 1번째 입력 소스
    if (input.length > 0) {
      const channelData = input[0]; // 0번 채널 (모노)
      // 메인 스레드(dashboard.js)로 오디오 데이터 전송
      this.port.postMessage(channelData);
    }
    return true; // 계속 작업 수행
  }
}

registerProcessor('audio-processor', AudioProcessor);