import { supabase } from "../lib/supabase";

const API_BASE = "/api";

export type Patient = {
  patient_id: string;
  display_name: string;
  allergies: string[];
  current_meds: string[];
  demographics: { age: number | null; sex: string | null };
  linguistic_signature: string;
};

export type ResolvedEntity = {
  brand?: string | null;
  generic: string;
  confidence: string;
  verbatim_citation: string;
};

export type ConsultationState = {
  run_id?: string;
  patient_context?: Patient;
  raw_transcript?: string;
  ground_truth_transcript?: string;
  resolved_entities?: ResolvedEntity[];
  valsea_metadata?: { primary_dialect?: string };
  vitals_findings?: CitedInsight[];
  safety_findings?: SafetyFinding[];
  advocate_summary?: {
    summary: string;
    dialect_label: string;
    citations: string[];
    unverified?: boolean;
    source?: "llm" | "heuristic";
  };
  clinical_note?: { sections: { title: string; content: string; citations: string[] }[]; source?: "llm" | "heuristic" };
  integrity_report?: { passed: boolean; issues: { field: string; message: string }[] };
  warnings?: Warning[];
  events?: PipelineEvent[];
};

export type CitedInsight = {
  claim: string;
  verbatim_citation: string;
  confidence: string;
  unverified?: boolean;
};

export type SafetyFinding = CitedInsight & {
  severity: string;
  source: string;
  action: string;
};

export type Warning = {
  code: string;
  message: string;
  severity: string;
  dismissed?: boolean;
};

export type PipelineEvent = {
  node: string;
  status: string;
  message: string;
};

export type ProfileUpsertPayload = {
  display_name: string;
  allergies: string[];
  current_meds: string[];
  age: number | null;
  sex: string | null;
  linguistic_signature: string;
};

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const auth = await authHeaders();
  const headers = new Headers(init.headers || {});
  Object.entries(auth).forEach(([k, v]) => headers.set(k, v as string));
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}

async function unwrap<T>(res: Response, fallback: string): Promise<T> {
  if (res.ok) return (await res.json()) as T;
  let detail: string | undefined;
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") detail = body.detail;
    else if (Array.isArray(body?.detail)) detail = body.detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join("; ");
  } catch {
    // non-JSON body, ignore
  }
  throw new Error(detail ? `${fallback}: ${detail}` : fallback);
}

export async function getMe(): Promise<Patient | null> {
  const res = await api("/me");
  if (res.status === 404) return null;
  return unwrap<Patient>(res, "Failed to load profile");
}

export async function upsertMe(payload: ProfileUpsertPayload): Promise<Patient> {
  const res = await api("/me", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return unwrap<Patient>(res, "Failed to save profile");
}

export async function addMyMedication(medication: string): Promise<Patient> {
  const res = await api("/me/medications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ medication }),
  });
  return unwrap<Patient>(res, "Failed to update medications");
}

export type TranscribeResult = {
  transcript: string;
  metadata: Record<string, unknown>;
  source: "valsea" | "fixture" | string;
  dialect?: string;
};

export async function transcribeAudio(
  audio: File | Blob,
  opts?: {
    filename?: string;
    durationSeconds?: number;
    /** Demo fixture transcript when VALSEA unavailable (upload tab only) */
    allowDemoFallback?: boolean;
  }
): Promise<TranscribeResult> {
  const form = new FormData();
  const file =
    audio instanceof File
      ? audio
      : new File([audio], opts?.filename ?? "recording.webm", {
          type: audio.type || "audio/webm",
        });
  form.append("audio", file);
  if (opts?.durationSeconds != null) {
    form.append("duration_seconds", String(opts.durationSeconds));
  }
  if (opts?.allowDemoFallback) {
    form.append("allow_demo_fallback", "true");
  }

  const res = await api("/transcribe", { method: "POST", body: form });
  return unwrap<TranscribeResult>(res, "Transcription failed");
}

export async function startConsultation(opts: {
  transcriptText?: string;
  useFixture?: boolean;
  audio?: File;
}): Promise<{ run_id: string }> {
  const form = new FormData();
  if (opts.transcriptText) form.append("transcript_text", opts.transcriptText);
  if (opts.useFixture) form.append("use_fixture", "true");
  if (opts.audio) form.append("audio", opts.audio);

  const res = await api("/consultations", { method: "POST", body: form });
  return unwrap<{ run_id: string }>(res, "Failed to start consultation");
}

export async function getConsultation(
  runId: string
): Promise<{ status: string; state: ConsultationState }> {
  const res = await api(`/consultations/${runId}`);
  return unwrap<{ status: string; state: ConsultationState }>(res, "Failed to fetch consultation");
}

export async function subscribeConsultation(
  runId: string,
  onMessage: (payload: unknown) => void
): Promise<() => void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const url = token
    ? `${API_BASE}/consultations/${runId}/events?access_token=${encodeURIComponent(token)}`
    : `${API_BASE}/consultations/${runId}/events`;
  const source = new EventSource(url);

  const handlers = ["event", "node_update", "complete", "heartbeat"] as const;
  handlers.forEach((name) => {
    source.addEventListener(name, (ev) => {
      try {
        onMessage(JSON.parse((ev as MessageEvent).data));
      } catch {
        onMessage((ev as MessageEvent).data);
      }
    });
  });

  return () => source.close();
}

const PROFILE_SYNC_KEY = (runId: string) => `medwiki-profile-sync-handled-${runId}`;

export function isProfileSyncHandled(runId: string): boolean {
  return sessionStorage.getItem(PROFILE_SYNC_KEY(runId)) === "1";
}

export function markProfileSyncHandled(runId: string): void {
  sessionStorage.setItem(PROFILE_SYNC_KEY(runId), "1");
}

export async function acknowledgeWarnings(runId: string, codes: string[]): Promise<void> {
  await api(`/consultations/${runId}/acknowledge-warnings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ warning_codes: codes }),
  });
}

export type ConsultationSummary = {
  run_id: string;
  status: string;
  created_at: string | null;
  completed_at: string | null;
  integrity_passed: boolean | null;
  warning_count: number;
  transcript_preview: string;
};

export async function listMyConsultations(limit = 20): Promise<ConsultationSummary[]> {
  const res = await api(`/me/consultations?limit=${limit}`);
  return unwrap<ConsultationSummary[]>(res, "Failed to load consultation history");
}
