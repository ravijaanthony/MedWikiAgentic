import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPatient, type Patient } from "../../api/client";
import ImmersiveShell from "../layout/ImmersiveShell";
import { LINGUISTIC_OPTIONS, ONBOARDING_STEPS, type OnboardingStepId } from "./constants";
import GenderSelector from "./GenderSelector";
import OnboardingProgress from "./OnboardingProgress";
import TagInput from "./TagInput";
import {
  EMPTY_ONBOARDING_FORM,
  formatGenderLabel,
  parseListField,
  type OnboardingFormState,
} from "./types";

type Props = {
  onPatientCreated: (patient: Patient) => void;
};

export default function OnboardingWizard({ onPatientCreated }: Props) {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<OnboardingFormState>(EMPTY_ONBOARDING_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [createdPatient, setCreatedPatient] = useState<Patient | null>(null);

  const step = ONBOARDING_STEPS[stepIndex];
  const stepId = step.id;
  const panelRef = useRef<HTMLFormElement>(null);
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === ONBOARDING_STEPS.length - 1;

  const updateForm = useCallback((patch: Partial<OnboardingFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setFieldError(null);
  }, []);

  useEffect(() => {
    const heading = panelRef.current?.querySelector<HTMLElement>("[data-step-focus]");
    heading?.focus();
  }, [stepIndex]);

  useEffect(() => {
    if (!createdPatient) return;
    const timer = window.setTimeout(() => {
      navigate(`/consult?patient=${createdPatient.patient_id}`, {
        state: { fromOnboarding: true, patientName: createdPatient.display_name },
        replace: true,
      });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [createdPatient, navigate]);

  function validateCurrentStep(): boolean {
    setFieldError(null);
    switch (stepId) {
      case "welcome":
        return true;
      case "identity": {
        if (!form.display_name.trim()) {
          setFieldError("Please enter your name to continue.");
          return false;
        }
        return true;
      }
      case "demographics": {
        if (form.age) {
          const age = parseInt(form.age, 10);
          if (Number.isNaN(age) || age < 0 || age > 150) {
            setFieldError("Enter a valid age between 0 and 150, or leave blank.");
            return false;
          }
        }
        return true;
      }
      default:
        return true;
    }
  }

  function goNext() {
    if (!validateCurrentStep()) return;
    setError(null);
    setStepIndex((i) => Math.min(i + 1, ONBOARDING_STEPS.length - 1));
  }

  function goBack() {
    setFieldError(null);
    setError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function handleSubmit() {
    if (!validateCurrentStep()) return;
    setLoading(true);
    setError(null);
    try {
      const patient = await createPatient({
        display_name: form.display_name.trim(),
        allergies: parseListField(form.allergies),
        current_meds: parseListField(form.current_meds),
        demographics: {
          age: form.age ? parseInt(form.age, 10) : null,
          sex: form.sex || null,
        },
        linguistic_signature: form.linguistic_signature,
      });
      setCreatedPatient(patient);
      onPatientCreated(patient);
    } catch {
      setError("Could not create patient. Is the API running on port 8000?");
    } finally {
      setLoading(false);
    }
  }

  if (createdPatient) {
    return (
      <ImmersiveShell>
        <TransitionScreen patientName={createdPatient.display_name} />
      </ImmersiveShell>
    );
  }

  const stepLabel = `${stepIndex + 1} / ${ONBOARDING_STEPS.length}`;

  return (
    <ImmersiveShell
      trailing={
        <span className="text-sm font-medium tabular-nums text-slate-500">{stepLabel}</span>
      }
    >
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
        <OnboardingProgress currentStepId={stepId} className="w-full" variant="minimal" />

        <form
          ref={panelRef}
          className="flex flex-1 flex-col pt-8 sm:pt-12"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (isLast) void handleSubmit();
            else goNext();
          }}
        >
          <div
            key={stepId}
            className="immersive-step-enter flex flex-1 flex-col justify-center"
            role="group"
            aria-labelledby="step-title"
          >
            <StepContent
              stepId={stepId}
              form={form}
              updateForm={updateForm}
              fieldError={fieldError}
            />
          </div>

          {(fieldError || error) && (
            <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {fieldError || error}
            </p>
          )}

          <nav
            className="immersive-nav-bar flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between"
            aria-label="Onboarding navigation"
          >
            <div>
              {!isFirst ? (
                <button type="button" className="btn-ghost w-full sm:w-auto" onClick={goBack}>
                  Back
                </button>
              ) : (
                <Link to="/consult" className="btn-ghost w-full text-center sm:w-auto">
                  I&apos;m already set up
                </Link>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {(stepId === "allergies" || stepId === "medications") && !isLast && (
                <button type="button" className="btn-ghost w-full sm:w-auto" onClick={goNext}>
                  Skip
                </button>
              )}

              {stepId === "welcome" && (
                <button type="submit" className="btn-primary-lg">
                  Get started
                </button>
              )}

              {stepId !== "welcome" && !isLast && (
                <button type="submit" className="btn-primary-lg">
                  Continue
                </button>
              )}

              {isLast && (
                <button type="submit" className="btn-primary-lg" disabled={loading}>
                  {loading ? "Saving your profile…" : "Continue to your consultation"}
                </button>
              )}
            </div>
          </nav>
        </form>
      </div>
    </ImmersiveShell>
  );
}

function TransitionScreen({ patientName }: { patientName: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center animate-fade-in">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-clinical-100 text-2xl text-clinical-700">
        ✓
      </div>
      <h2 className="mt-6 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        You&apos;re all set
      </h2>
      <p className="mt-3 max-w-sm text-lg text-slate-600">
        Taking you to your consultation, <span className="font-semibold text-slate-800">{patientName}</span>…
      </p>
      <div className="mt-8 h-1 w-48 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full w-full origin-left animate-pulse rounded-full bg-clinical-600" />
      </div>
    </div>
  );
}

function StepContent({
  stepId,
  form,
  updateForm,
  fieldError,
}: {
  stepId: OnboardingStepId;
  form: OnboardingFormState;
  updateForm: (patch: Partial<OnboardingFormState>) => void;
  fieldError: string | null;
}) {
  switch (stepId) {
    case "welcome":
      return (
        <StepShell
          title="Welcome to MedWiki"
          subtitle="We'll ask a few quick questions—one at a time—so we can keep you safe and speak to you in a way that feels natural."
        >
          <ul className="mt-8 space-y-4 text-base text-slate-600">
            {[
              "Your name and basics",
              "Allergies and medications",
              "How you like to communicate",
            ].map((item, i) => (
              <li key={item} className="flex items-center gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-clinical-100 text-sm font-semibold text-clinical-800">
                  {i + 1}
                </span>
                {item}
              </li>
            ))}
          </ul>
        </StepShell>
      );

    case "identity":
      return (
        <StepShell
          title="What should we call you?"
          subtitle="This is the name you'll see on your profile and visit summaries."
        >
          <label htmlFor="display_name" className="sr-only">
            Your name
          </label>
          <input
            id="display_name"
            data-step-focus
            tabIndex={-1}
            autoFocus
            className="input-field-lg mt-8 text-center sm:text-left"
            placeholder="e.g. Alex Tan, Sarah Lee"
            value={form.display_name}
            onChange={(e) => updateForm({ display_name: e.target.value })}
            aria-invalid={!!fieldError}
          />
        </StepShell>
      );

    case "demographics":
      return (
        <StepShell
          title="Tell us a little about you"
          subtitle="Optional—you can skip anything you'd rather not share right now."
        >
          <div className="mt-8 space-y-6">
            <div>
              <label htmlFor="age" className="block text-sm font-semibold text-slate-700">
                How old are you?
              </label>
              <input
                id="age"
                data-step-focus
                tabIndex={-1}
                type="number"
                min={0}
                max={150}
                inputMode="numeric"
                className="input-field mt-2"
                placeholder="Your age"
                value={form.age}
                onChange={(e) => updateForm({ age: e.target.value })}
              />
            </div>
            <GenderSelector value={form.sex} onChange={(sex) => updateForm({ sex })} />
          </div>
        </StepShell>
      );

    case "allergies":
      return (
        <StepShell
          title="Do you have any allergies?"
          subtitle="We'll gently alert your care team if something prescribed might not be right for you—we never block treatment on our own."
        >
          <div className="mt-8" data-step-focus tabIndex={-1}>
            <TagInput
              label=""
              hint="Press Enter to add each allergy."
              placeholder="e.g. penicillin"
              value={form.allergies}
              onChange={(allergies) => updateForm({ allergies })}
              suggestions={["penicillin", "peanuts", "shellfish", "latex"]}
            />
          </div>
        </StepShell>
      );

    case "medications":
      return (
        <StepShell
          title="Are you taking any medications?"
          subtitle="Include the dose if you know it—this helps us check for interactions with anything new."
        >
          <div className="mt-8" data-step-focus tabIndex={-1}>
            <TagInput
              label=""
              hint="Press Enter to add each medication."
              placeholder="e.g. Metformin 500mg"
              value={form.current_meds}
              onChange={(current_meds) => updateForm({ current_meds })}
              suggestions={["Metformin 500mg", "Panadol", "Aspirin 100mg"]}
            />
          </div>
        </StepShell>
      );

    case "communication":
      return (
        <StepShell
          title="How do you usually communicate?"
          subtitle="We'll match this style in summaries and instructions written for you."
        >
          <fieldset className="mt-8 space-y-3" data-step-focus tabIndex={-1}>
            <legend className="sr-only">Preferred communication style</legend>
            {LINGUISTIC_OPTIONS.map((opt) => {
              const selected = form.linguistic_signature === opt.value;
              return (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-start gap-4 rounded-2xl border-2 p-4 transition-all ${
                    selected ? "option-card-selected border-clinical-600" : "option-card border-transparent"
                  }`}
                >
                  <input
                    type="radio"
                    name="linguistic_signature"
                    className="sr-only"
                    checked={selected}
                    onChange={() => updateForm({ linguistic_signature: opt.value })}
                  />
                  <span>
                    <span className="block text-base font-semibold text-slate-900">{opt.label}</span>
                    <span className="mt-0.5 block text-sm text-slate-500">{opt.description}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>
        </StepShell>
      );

    case "review":
      return (
        <StepShell
          title="Does everything look right?"
          subtitle="You can go back to change any answer before we save your profile."
        >
          <dl className="mt-8 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-card">
            <ReviewRow label="Name" value={form.display_name || "—"} />
            <ReviewRow
              label="About you"
              value={
                [
                  form.age && `${form.age} years old`,
                  form.sex ? formatGenderLabel(form.sex) : "",
                ]
                  .filter(Boolean)
                  .join(" · ") || "Not provided"
              }
            />
            <ReviewRow
              label="Allergies"
              value={parseListField(form.allergies).join(", ") || "None"}
            />
            <ReviewRow
              label="Medications"
              value={parseListField(form.current_meds).join(", ") || "None"}
            />
            <ReviewRow label="Communication" value={form.linguistic_signature} />
          </dl>
        </StepShell>
      );

    default:
      return null;
  }
}

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1
        id="step-title"
        data-step-focus
        tabIndex={-1}
        className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl sm:leading-tight"
      >
        {title}
      </h1>
      <p className="mt-3 max-w-lg text-lg leading-relaxed text-slate-600">{subtitle}</p>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-5 py-4 sm:flex-row sm:gap-6">
      <dt className="shrink-0 text-sm font-medium text-slate-500 sm:w-32">{label}</dt>
      <dd className="text-base font-medium text-slate-900">{value}</dd>
    </div>
  );
}

