export type OnboardingStepId =
  | "welcome"
  | "identity"
  | "demographics"
  | "allergies"
  | "medications"
  | "communication"
  | "review";

export type OnboardingStep = {
  id: OnboardingStepId;
  label: string;
  shortLabel: string;
};

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { id: "welcome", label: "Welcome", shortLabel: "Start" },
  { id: "identity", label: "Your name", shortLabel: "Name" },
  { id: "demographics", label: "About you", shortLabel: "You" },
  { id: "allergies", label: "Allergies", shortLabel: "Allergies" },
  { id: "medications", label: "Medications", shortLabel: "Meds" },
  { id: "communication", label: "Language", shortLabel: "Language" },
  { id: "review", label: "Review", shortLabel: "Review" },
];

export const GENDER_OPTIONS = [
  { value: "M", label: "Male" },
  { value: "F", label: "Female" },
] as const;

export const LINGUISTIC_OPTIONS = [
  {
    value: "Singlish",
    label: "Singlish",
    description: "I mix English with local expressions (e.g. lah, ah)",
  },
  {
    value: "English",
    label: "English",
    description: "I prefer standard English",
  },
  {
    value: "Manglish",
    label: "Manglish",
    description: "I blend English and Malay naturally",
  },
  {
    value: "Taglish",
    label: "Taglish",
    description: "I switch between Tagalog and English",
  },
] as const;
