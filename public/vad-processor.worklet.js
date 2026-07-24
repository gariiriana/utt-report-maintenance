// ═══════════════════════════════════════════════════════════════════════════════
// VAD (Voice Activity Detection) AudioWorklet Processor
// Runs in a separate audio thread for low-latency voice detection.
// ═══════════════════════════════════════════════════════════════════════════════

class VadProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.speechThreshold = 0.015;    // RMS threshold for speech detection
    this.silenceThreshold = 0.008;   // RMS threshold for silence
    this.speechFrames = 0;           // Consecutive speech frames
    this.silenceFrames = 0;          // Consecutive silence frames
    this.speechStartFrames = 4;      // ~100ms at 128 samples/frame (48kHz)
    this.silenceEndFrames = 20;      // ~500ms of silence to end speech
    this.isSpeaking = false;
    this.isActive = true;

    // Receive control messages from main thread
    this.port.onmessage = (event) => {
      if (event.data.type === 'set_active') {
        this.isActive = event.data.value;
        if (!this.isActive) {
          this.isSpeaking = false;
          this.speechFrames = 0;
          this.silenceFrames = 0;
        }
      } else if (event.data.type === 'set_threshold') {
        this.speechThreshold = event.data.speech || this.speechThreshold;
        this.silenceThreshold = event.data.silence || this.silenceThreshold;
      }
    };
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || !this.isActive) return true;

    const channelData = input[0];

    // Calculate RMS (Root Mean Square) energy
    let sum = 0;
    for (let i = 0; i < channelData.length; i++) {
      sum += channelData[i] * channelData[i];
    }
    const rms = Math.sqrt(sum / channelData.length);

    // Send audio level for visualizer (normalized 0-1)
    const normalizedLevel = Math.min(1, rms / 0.1);
    this.port.postMessage({
      type: 'audio_level',
      level: normalizedLevel,
    });

    // Voice Activity Detection
    if (rms > this.speechThreshold) {
      this.speechFrames++;
      this.silenceFrames = 0;

      if (!this.isSpeaking && this.speechFrames >= this.speechStartFrames) {
        this.isSpeaking = true;
        this.port.postMessage({ type: 'speech_start' });
      }
    } else if (rms < this.silenceThreshold) {
      this.silenceFrames++;
      this.speechFrames = 0;

      if (this.isSpeaking && this.silenceFrames >= this.silenceEndFrames) {
        this.isSpeaking = false;
        this.port.postMessage({ type: 'speech_end' });
      }
    }

    // Convert Float32 to Int16 PCM for streaming
    const pcm16 = new Int16Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      const s = Math.max(-1, Math.min(1, channelData[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Send PCM audio data
    this.port.postMessage(
      { type: 'audio_data', pcm: pcm16.buffer },
      [pcm16.buffer]
    );

    return true;
  }
}

registerProcessor('vad-processor', VadProcessor);
