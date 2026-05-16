import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  acknowledgeWarnings,
  addMedication,
  getConsultation,
  isProfileSyncHandled,
  markProfileSyncHandled,
  subscribeConsultation,
  type ConsultationState,
} from "../api/client";
import ProfileSyncModal from "../components/ProfileSyncModal";
import SpecialistTabs from "../components/SpecialistTabs";
import StageStepper from "../components/StageStepper";
import TranscriptPanel from "../components/TranscriptPanel";
import WarningBanner from "../components/WarningBanner";

export default function ResultsPage() {
  const { runId } = useParams<{ runId: string }>();
  const [state, setState] = useState<ConsultationState>({});
  const [status, setStatus] = useState("running");
  const [highlight, setHighlight] = useState<string | null>(null);
  const [showSync, setShowSync] = useState(false);
  const [syncDrug, setSyncDrug] = useState("Amoxicillin");
  const profileSyncShownRef = useRef(false);
  const completedRef = useRef(false);

  const completedNodes = useMemo(() => {
    const nodes = new Set<string>();
    state.events?.forEach((e) => {
      if (e.status === "completed") nodes.add(e.node);
    });
    return nodes;
  }, [state.events]);

  const maybeShowProfileSync = useCallback((consultState: ConsultationState) => {
    if (!runId || profileSyncShownRef.current || isProfileSyncHandled(runId)) return;
    const entities = consultState.resolved_entities || [];
    const prescribed = entities.find((e) => {
      const g = (e.generic || "").toLowerCase();
      return g && !consultState.patient_context?.current_meds?.some((m) => m.toLowerCase().includes(g));
    });
    if (!prescribed) return;
    profileSyncShownRef.current = true;
    setSyncDrug(prescribed.generic || prescribed.brand || "medication");
    setShowSync(true);
  }, [runId]);

  useEffect(() => {
    if (!runId) return;

    completedRef.current = false;
    profileSyncShownRef.current = isProfileSyncHandled(runId);
    let cancelled = false;

    getConsultation(runId)
      .then((data) => {
        if (cancelled) return;
        setStatus(data.status);
        setState(data.state);
        if (data.status === "completed") {
          completedRef.current = true;
          maybeShowProfileSync(data.state);
        }
      })
      .catch(() => {
        /* polling via SSE will retry state */
      });

    const unsub = subscribeConsultation(runId, (raw) => {
      if (cancelled) return;
      const msg = raw as { type?: string; state?: ConsultationState };
      if (msg.type === "node_update" && msg.state && !completedRef.current) {
        setState(msg.state);
        setStatus("running");
      }
      if (msg.type === "complete" && msg.state) {
        completedRef.current = true;
        setState(msg.state);
        setStatus("completed");
        maybeShowProfileSync(msg.state);
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [runId, maybeShowProfileSync]);

  const warnings = state.warnings || [];

  async function handleDismiss(code: string) {
    if (!runId) return;
    await acknowledgeWarnings(runId, [code]);
    setState((s) => ({
      ...s,
      warnings: (s.warnings || []).map((w) => (w.code === code ? { ...w, dismissed: true } : w)),
    }));
  }

  function dismissProfileSync() {
    if (runId) markProfileSyncHandled(runId);
    profileSyncShownRef.current = true;
    setShowSync(false);
  }

  async function handleProfileSync() {
    const pid = state.patient_context?.patient_id;
    if (pid) await addMedication(pid, syncDrug);
    dismissProfileSync();
  }

  const transcript = state.ground_truth_transcript || state.raw_transcript || "";

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-clinical-900">Consultation results</h1>
          <p className="text-sm text-slate-500">
            Run {runId?.slice(0, 8)}… · {status}
            {state.integrity_report && (
              <span className={state.integrity_report.passed ? " text-green-700" : " text-amber-700"}>
                {" "}
                · Integrity {state.integrity_report.passed ? "passed" : "issues"}
              </span>
            )}
          </p>
        </div>
        <StageStepper completedNodes={completedNodes} />
      </header>

      <WarningBanner warnings={warnings} onDismiss={handleDismiss} />

      <div className="grid min-h-[480px] gap-6 lg:grid-cols-2">
        <TranscriptPanel transcript={transcript} highlight={highlight} />
        <SpecialistTabs state={state} onCitationClick={setHighlight} />
      </div>

      <ProfileSyncModal
        drugName={syncDrug}
        open={showSync}
        onConfirm={handleProfileSync}
        onSkip={dismissProfileSync}
      />
    </div>
  );
}
