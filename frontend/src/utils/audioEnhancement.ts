/**
 * Lightweight browser-native speech enhancement for live recording.
 * Mic → high-pass (rumble) → compressor (level speech) → MediaStream for MediaRecorder.
 * Visualization taps the same processed chain so the waveform matches what is saved.
 */

export type EnhancedAudioPipeline = {
  audioContext: AudioContext;
  /** Stream to pass to MediaRecorder (processed). */
  recordingStream: MediaStream;
  /** Analyser on the processed signal for the waveform UI. */
  analyser: AnalyserNode;
  disconnect: () => void;
};

const HIGH_PASS_HZ = 90;
const COMPRESSOR = {
  threshold: -26,
  knee: 10,
  ratio: 3,
  attack: 0.003,
  release: 0.2,
} as const;

/** Constraints tuned for speech in noisy environments (browser may ignore unsupported fields). */
export function getSpeechCaptureConstraints(): MediaTrackConstraints {
  return {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: { ideal: 1 },
    sampleRate: { ideal: 48000 },
    sampleSize: { ideal: 16 },
    // Speech-oriented hint where supported (Chrome); ignored safely elsewhere.
    ...(typeof window !== "undefined"
      ? { voiceIsolation: true } as MediaTrackConstraints
      : {}),
  };
}

function getAudioContextClass(): typeof AudioContext | null {
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
    null
  );
}

/**
 * Builds a processed recording graph from a raw getUserMedia stream.
 */
export async function createEnhancedRecordingPipeline(
  rawStream: MediaStream
): Promise<EnhancedAudioPipeline | null> {
  const AudioCtx = getAudioContextClass();
  if (!AudioCtx) return null;

  const audioContext = new AudioCtx();
  await audioContext.resume().catch(() => {});

  const source = audioContext.createMediaStreamSource(rawStream);

  const highPass = audioContext.createBiquadFilter();
  highPass.type = "highpass";
  highPass.frequency.value = HIGH_PASS_HZ;
  highPass.Q.value = 0.75;

  const compressor = audioContext.createDynamicsCompressor();
  compressor.threshold.value = COMPRESSOR.threshold;
  compressor.knee.value = COMPRESSOR.knee;
  compressor.ratio.value = COMPRESSOR.ratio;
  compressor.attack.value = COMPRESSOR.attack;
  compressor.release.value = COMPRESSOR.release;

  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.72;
  analyser.minDecibels = -85;
  analyser.maxDecibels = -10;

  const destination = audioContext.createMediaStreamDestination();

  source.connect(highPass);
  highPass.connect(compressor);
  compressor.connect(analyser);
  analyser.connect(destination);

  const recordingStream = destination.stream;

  const disconnect = () => {
    try {
      source.disconnect();
      highPass.disconnect();
      compressor.disconnect();
      analyser.disconnect();
    } catch {
      /* already disconnected */
    }
    recordingStream.getTracks().forEach((t) => t.stop());
    void audioContext.close().catch(() => {});
  };

  return { audioContext, recordingStream, analyser, disconnect };
}

/** Prefer higher Opus bitrate for clearer speech in WebM. */
export function getRecorderOptions(mimeType: string): MediaRecorderOptions {
  const options: MediaRecorderOptions = {};
  if (mimeType) options.mimeType = mimeType;
  if (typeof MediaRecorder !== "undefined") {
    try {
      const withBitrate = { ...options, audioBitsPerSecond: 128000 };
      if (!mimeType || MediaRecorder.isTypeSupported(mimeType)) {
        return withBitrate;
      }
    } catch {
      /* ignore */
    }
  }
  return options;
}
