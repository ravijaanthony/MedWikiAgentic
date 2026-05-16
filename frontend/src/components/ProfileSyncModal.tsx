type Props = {
  drugName: string;
  open: boolean;
  onConfirm: () => void;
  onSkip: () => void;
};

export default function ProfileSyncModal({ drugName, open, onConfirm, onSkip }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-slate-900">Profile sync</h3>
        <p className="mt-2 text-sm text-slate-600">
          I noticed the doctor prescribed <strong>{drugName}</strong>. Add this to the patient&apos;s permanent
          medication list?
        </p>
        <div className="mt-6 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onSkip}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium bg-clinical-700 text-white rounded-lg hover:bg-clinical-900"
          >
            Add to profile
          </button>
        </div>
      </div>
    </div>
  );
}
