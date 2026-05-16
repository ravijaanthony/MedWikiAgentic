import { useCallback } from "react";
import OnboardingWizard from "../components/onboarding/OnboardingWizard";

export default function OnboardingPage() {
  const handlePatientCreated = useCallback(() => {
    /* roster removed from immersive flow; consult step loads patient from URL */
  }, []);

  return <OnboardingWizard onPatientCreated={handlePatientCreated} />;
}
