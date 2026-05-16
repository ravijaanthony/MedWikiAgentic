/** Mirrors backend validation thresholds */
export const MIN_RECORDING_SECONDS = 1;
export const MIN_AUDIO_BYTES = 2048;

export function isRecordingLongEnough(durationSec: number): boolean {
  return durationSec >= MIN_RECORDING_SECONDS;
}

export function isAudioBlobSubstantial(blob: Blob): boolean {
  return blob.size >= MIN_AUDIO_BYTES;
}

export function canTranscribeRecording(blob: Blob, durationSec: number): boolean {
  return isRecordingLongEnough(durationSec) && isAudioBlobSubstantial(blob);
}
