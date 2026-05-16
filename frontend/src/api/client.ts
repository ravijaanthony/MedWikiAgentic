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
  clinical_note?: { sections: { title: string; content: string; citations: string[] }[] };
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

export async function getMe(): Promise<Patient | null> {
  const res = await api("/me");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load profile");
  return res.json();
}

export async function upsertMe(payload: ProfileUpsertPayload): Promise<Patient> {
  const res = await api("/me", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to save profile");
  return res.json();
}

export async function addMyMedication(medication: string): Promise<Patient> {
  const res = await api("/me/medications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ medication }),
  });
  if (!res.ok) throw new Error("Failed to update medications");
  return res.json();
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
  if (!res.ok) throw new Error("Failed to start consultation");
  return res.json();
}

export async function getConsultation(
  runId: string
): Promise<{ status: string; state: ConsultationState }> {
  const res = await api(`/consultations/${runId}`);
  if (!res.ok) throw new Error("Failed to fetch consultation");
  return res.json();
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
  if (!res.ok) throw new Error("Failed to load consultation history");
  return res.json();
}
