import { useCallback, useEffect, useRef, useState } from "react";
import {
  createEnhancedRecordingPipeline,
  getRecorderOptions,
  getSpeechCaptureConstraints,
} from "../utils/audioEnhancement";

export type RecorderStatus = "idle" | "recording" | "paused" | "stopped";

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "";
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function useAudioRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [durationSec, setDurationSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const rawStreamRef = useRef<MediaStream | null>(null);
  const pipelineCleanupRef = useRef<(() => void) | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef("");
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const accumulatedMsRef = useRef(0);

  const releaseAudioResources = useCallback(() => {
    pipelineCleanupRef.current?.();
    pipelineCleanupRef.current = null;
    rawStreamRef.current?.getTracks().forEach((t) => t.stop());
    rawStreamRef.current = null;
    setAnalyserNode(null);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    startedAtRef.current = Date.now();
    timerRef.current = window.setInterval(() => {
      const elapsed = accumulatedMsRef.current + (Date.now() - startedAtRef.current);
      setDurationSec(Math.floor(elapsed / 1000));
    }, 250);
  }, [clearTimer]);

  useEffect(() => {
    return () => {
      clearTimer();
      releaseAudioResources();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          /* ignore */
        }
      }
    };
  }, [clearTimer, releaseAudioResources]);

  const start = useCallback(async () => {
    setError(null);
    setRecordedBlob(null);
    chunksRef.current = [];
    accumulatedMsRef.current = 0;
    setDurationSec(0);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Your browser does not support microphone recording.");
      return;
    }

    try {
      const rawStream = await navigator.mediaDevices.getUserMedia({
        audio: getSpeechCaptureConstraints(),
      });
      rawStreamRef.current = rawStream;

      const pipeline = await createEnhancedRecordingPipeline(rawStream);
      const recordingStream = pipeline?.recordingStream ?? rawStream;

      if (pipeline) {
        pipelineCleanupRef.current = pipeline.disconnect;
        setAnalyserNode(pipeline.analyser);
      } else {
        setAnalyserNode(null);
      }

      const mimeType = pickMimeType();
      mimeTypeRef.current = mimeType;
      const recorder = new MediaRecorder(recordingStream, getRecorderOptions(mimeType));

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        clearTimer();
        releaseAudioResources();
        const blob = new Blob(chunksRef.current, {
          type: mimeTypeRef.current || recorder.mimeType || "audio/webm",
        });
        setRecordedBlob(blob);
        setStatus("stopped");
      };

      recorder.onerror = () => {
        setError("Recording failed. Please try again.");
        setStatus("idle");
        clearTimer();
        releaseAudioResources();
      };

      recorder.start(250);
      setStatus("recording");
      startTimer();
    } catch (err) {
      const denied =
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");
      setError(
        denied
          ? "Microphone access was denied. Allow microphone permission in your browser settings."
          : "Could not access the microphone."
      );
      setStatus("idle");
      releaseAudioResources();
    }
  }, [clearTimer, releaseAudioResources, startTimer]);

  const pause = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    if (typeof recorder.pause !== "function") {
      setError("Pause is not supported in this browser.");
      return;
    }
    recorder.pause();
    accumulatedMsRef.current += Date.now() - startedAtRef.current;
    clearTimer();
    setStatus("paused");
  }, [clearTimer]);

  const resume = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    recorder.resume();
    startTimer();
    setStatus("recording");
  }, [startTimer]);

  const stop = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    if (recorder.state === "recording") {
      accumulatedMsRef.current += Date.now() - startedAtRef.current;
    }
    clearTimer();
    recorder.stop();
  }, [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    releaseAudioResources();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    accumulatedMsRef.current = 0;
    setDurationSec(0);
    setRecordedBlob(null);
    setStatus("idle");
    setError(null);
  }, [clearTimer, releaseAudioResources]);

  return {
    status,
    durationSec,
    durationLabel: formatDuration(durationSec),
    error,
    recordedBlob,
    analyser: analyserNode,
    start,
    pause,
    resume,
    stop,
    reset,
    canPause: typeof MediaRecorder !== "undefined" && "pause" in MediaRecorder.prototype,
  };
}
