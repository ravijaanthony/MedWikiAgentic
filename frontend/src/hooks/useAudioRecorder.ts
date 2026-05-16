import { useCallback, useEffect, useRef, useState } from "react";

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
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef("");
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const accumulatedMsRef = useRef(0);

  const teardownAnalyser = useCallback(() => {
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    analyserRef.current = null;
    setAnalyserNode(null);
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  const stopTracks = useCallback(() => {
    teardownAnalyser();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, [teardownAnalyser]);

  const attachAnalyser = useCallback(async (stream: MediaStream) => {
    teardownAnalyser();
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const audioContext = new AudioCtx();
    await audioContext.resume().catch(() => {});

    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.78;
    analyser.minDecibels = -85;
    analyser.maxDecibels = -10;
    source.connect(analyser);

    audioContextRef.current = audioContext;
    sourceRef.current = source;
    analyserRef.current = analyser;
    setAnalyserNode(analyser);
  }, [teardownAnalyser]);

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
      stopTracks();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          /* ignore */
        }
      }
    };
  }, [clearTimer, stopTracks]);

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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      await attachAnalyser(stream);
      const mimeType = pickMimeType();
      mimeTypeRef.current = mimeType;
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        clearTimer();
        stopTracks();
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
        stopTracks();
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
      stopTracks();
    }
  }, [attachAnalyser, clearTimer, startTimer, stopTracks]);

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
    stopTracks();
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
  }, [clearTimer, stopTracks]);

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
