export type OnboardingFormState = {
  display_name: string;
  allergies: string;
  current_meds: string;
  age: string;
  sex: string;
  linguistic_signature: string;
};

export const EMPTY_ONBOARDING_FORM: OnboardingFormState = {
  display_name: "",
  allergies: "",
  current_meds: "",
  age: "",
  sex: "",
  linguistic_signature: "Singlish",
};

export function parseListField(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function formatGenderLabel(sex: string): string {
  if (sex === "M") return "Male";
  if (sex === "F") return "Female";
  return sex;
}
