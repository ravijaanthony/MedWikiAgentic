import { Link } from "react-router-dom";
import type { Patient } from "../../api/client";

type Props = {
  patients: Patient[];
};

export default function PatientRoster({ patients }: Props) {
  return (
    <aside className="lg:sticky lg:top-24 lg:self-start" aria-labelledby="roster-heading">
      <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-card backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 id="roster-heading" className="text-base font-semibold text-slate-900">
            Your patients
          </h2>
          <span className="rounded-full bg-clinical-50 px-2.5 py-0.5 text-xs font-semibold text-clinical-800">
            {patients.length}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">Profiles power safety checks during consultations.</p>

        <ul className="mt-4 max-h-[min(28rem,60vh)] space-y-3 overflow-y-auto pr-1">
          {patients.map((p) => (
            <li
              key={p.patient_id}
              className="group rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:border-clinical-200 hover:bg-white hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{p.display_name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">ID {p.patient_id.slice(0, 8)}…</p>
                </div>
                <span className="shrink-0 rounded-md bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">
                  {p.linguistic_signature}
                </span>
              </div>

              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex gap-2">
                  <dt className="shrink-0 text-slate-400">Allergies</dt>
                  <dd className="text-slate-700">{p.allergies.length ? p.allergies.join(", ") : "None recorded"}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="shrink-0 text-slate-400">Meds</dt>
                  <dd className="truncate text-slate-700">
                    {p.current_meds.length ? p.current_meds.join(", ") : "None recorded"}
                  </dd>
                </div>
              </dl>

              <Link
                to={`/consult?patient=${p.patient_id}`}
                className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-clinical-200 bg-white py-2 text-sm font-semibold text-clinical-800 transition-colors group-hover:border-clinical-300 group-hover:bg-clinical-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-clinical-100"
              >
                Start consultation
                <span aria-hidden>→</span>
              </Link>
            </li>
          ))}
        </ul>

        {!patients.length && (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center">
            <p className="text-sm font-medium text-slate-600">No patients yet</p>
            <p className="mt-1 text-xs text-slate-400">
              Complete onboarding to add a profile. A demo patient may appear when the API starts.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
