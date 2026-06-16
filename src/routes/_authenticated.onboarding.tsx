import { createFileRoute } from "@tanstack/react-router";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

// Screen 8 (F-DESIGN-EMBER) — first-run onboarding. Full-viewport, no shell;
// the _authenticated gate routes accounts with profiles.onboarded=false here.

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingPage,
  head: () => ({ meta: [{ title: "Get started · Cadence" }] }),
});

function OnboardingPage() {
  return <OnboardingFlow />;
}
