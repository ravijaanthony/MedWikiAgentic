import { ONBOARDING_STEPS, type OnboardingStepId } from "./constants";

type Props = {
  currentStepId: OnboardingStepId;
  className?: string;
  variant?: "full" | "minimal";
};

export default function OnboardingProgress({
  currentStepId,
  className = "",
  variant = "minimal",
}: Props) {
  const currentIndex = ONBOARDING_STEPS.findIndex((s) => s.id === currentStepId);
  const progressPercent = Math.round(((currentIndex + 1) / ONBOARDING_STEPS.length) * 100);

  return (
    <div className={className} aria-label="Onboarding progress">
      <div
        className="h-1 w-full overflow-hidden rounded-full bg-slate-200/80"
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${progressPercent} percent complete`}
      >
        <div
          className="h-full rounded-full bg-clinical-600 transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {variant === "full" && (
        <ol className="mt-4 hidden gap-2 sm:flex sm:flex-wrap" aria-label="Onboarding steps">
          {ONBOARDING_STEPS.map((step, index) => {
            const done = index < currentIndex;
            const active = index === currentIndex;
            return (
              <li key={step.id}>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                    done
                      ? "text-clinical-700"
                      : active
                        ? "text-slate-900"
                        : "text-slate-400"
                  }`}
                  aria-current={active ? "step" : undefined}
                >
                  {step.shortLabel}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
