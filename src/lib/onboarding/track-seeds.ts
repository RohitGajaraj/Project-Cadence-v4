/**
 * Track seeds — per-persona sample data for onboarding
 *
 * Each track provides:
 * - A starter project (product/problem domain)
 * - Realistic signals (market feedback, user feedback, research)
 * - Seeded opportunities (derived ideas ready to prioritize)
 *
 * The first opportunity is always something worth running WEDGE on —
 * a feature idea or strategy question that benefits from red-teaming.
 */

export type OnboardingTrack = "solo" | "founding" | "tech";

export interface TrackSeed {
  track: OnboardingTrack;
  projectName: string;
  projectDescription: string;
  signals: Array<{
    title: string;
    content: string;
    source: string; // e.g., "user_interview", "analytics", "competitor"
  }>;
  opportunities: Array<{
    title: string; // Feature idea or strategic question
    problem: string; // Why does this matter?
    target_user?: string;
    impact: number; // 1-10
    confidence: number; // 1-10
    ease: number; // 1-10
  }>;
}

/**
 * SOLO PM TRACK
 *
 * Persona: Individual contributor managing their own product/side project.
 * Pain: Staying organized, prioritizing across signals, making decisions alone.
 * First-win: Running a teardown on a feature idea to validate direction.
 */
export const soloTrack: TrackSeed = {
  track: "solo",
  projectName: "Mobile App Roadmap",
  projectDescription: "A consumer app with a growing user base, needing strategic prioritization",
  signals: [
    {
      title: "Users asking for offline mode",
      content:
        "Multiple support tickets and App Store reviews requesting offline access to core features. Users frequently on flights or areas with poor connectivity.",
      source: "user_feedback",
    },
    {
      title: "90% of sign-ups drop after day 1",
      content:
        "Cohort analysis shows new users aren't completing the core onboarding flow. Heatmap shows drop-off at profile setup step.",
      source: "analytics",
    },
    {
      title: "Competitor just launched push notifications",
      content:
        "Competing app released a notification feature that's getting mentioned in reviews. Our users expect the same.",
      source: "competitive_research",
    },
    {
      title: "Premium tier at 8% conversion",
      content:
        "Only 8 out of 100 free users upgrade. Team thinks a lower price point might help, but no data yet.",
      source: "business_metrics",
    },
  ],
  opportunities: [
    {
      title: "Launch push notifications for engagement",
      problem:
        "Users want to stay engaged with the app. Competitors have notifications. This could improve retention.",
      target_user: "Active users (who open the app 3+ times/week)",
      impact: 8,
      confidence: 6,
      ease: 7,
    },
    {
      title: "Redesign onboarding to reduce day-1 drop-off",
      problem:
        "90% of sign-ups abandon before completing profile. This is our biggest leak. Redesigning could cut drop-off by 40%.",
      target_user: "New users",
      impact: 9,
      confidence: 8,
      ease: 6,
    },
    {
      title: "Add offline mode for core features",
      problem:
        "Users on flights or trains can't use the app. This is a genuine blocker for some segments. Offline mode would unlock them.",
      target_user: "Frequent travelers, power users",
      impact: 6,
      confidence: 7,
      ease: 4,
    },
    {
      title: "Test $4.99/month tier (vs. $9.99)",
      problem:
        "8% conversion at $9.99 is leaving money on the table. A lower price with higher volume could increase ARPU.",
      target_user: "Price-sensitive users",
      impact: 7,
      confidence: 4,
      ease: 8,
    },
  ],
};

/**
 * FOUNDING PM TRACK
 *
 * Persona: Early-stage founder wearing the PM hat in a small startup.
 * Pain: Resource-constrained, need to say "no" a lot, need alignment with founders/investors.
 * First-win: Red-teaming the core product idea before engineering locks in direction.
 */
export const foundingTrack: TrackSeed = {
  track: "founding",
  projectName: "Startup MVP",
  projectDescription:
    "Your co-founder's startup idea. Pre-launch, raising seed round. Need to nail the core product and story.",
  signals: [
    {
      title: "Investor feedback: 'nice to have, not need to have'",
      content:
        "Three investor conversations this month. Feedback: the problem is real, but your solution feels incremental. Pushing back on why this is defensible.",
      source: "investor_feedback",
    },
    {
      title: "Beta testers love the workflows, not the UX",
      content:
        "10 beta users testing the MVP. They get the value, but half report onboarding takes 20+ minutes. UX debt is real.",
      source: "user_feedback",
    },
    {
      title: "Competitor raised Series A, pivoted to SMB",
      content:
        "A competitor with a similar idea just raised a Series A and repositioned from Consumer to SMB. They're moving faster than expected.",
      source: "competitive_research",
    },
    {
      title: "Tech co-founder wants to rebuild in Rust",
      content:
        "The CTO wants to rebuild the backend in Rust for performance. This is a 3-month effort. Team is split on whether it's worth it now.",
      source: "internal_decision",
    },
  ],
  opportunities: [
    {
      title: "Pivot positioning to SMB (vs. Consumer)",
      problem:
        "Investor feedback suggests Consumer is too crowded. SMB market is underserved. But would mean new GTM narrative and feature priorities.",
      target_user: "SMBs (vs. individuals)",
      impact: 9,
      confidence: 5,
      ease: 5,
    },
    {
      title: "Invest 3 weeks in UX polish before beta wave 2",
      problem:
        "Current beta cohort loves the product but struggles with onboarding. Fixing this could make the next cohort's feedback much stronger.",
      target_user: "New users in wave 2",
      impact: 7,
      confidence: 8,
      ease: 7,
    },
    {
      title: "Build a defensible moat (AI-powered workflows)",
      problem:
        "Investors are asking what makes this hard to copy. An AI layer (smart suggestions, automation) could be harder to replicate than the UI.",
      target_user: "Power users who want automation",
      impact: 8,
      confidence: 4,
      ease: 4,
    },
    {
      title: "Rebuild backend in Rust (performance/scaling)",
      problem:
        "Tech co-founder makes a good case: current stack will bottleneck at scale. But is this a blocker now or premature optimization?",
      target_user: "Future users (at scale)",
      impact: 6,
      confidence: 3,
      ease: 2,
    },
  ],
};

/**
 * TECH FOUNDER TRACK
 *
 * Persona: Technical founder, deep in the code, thinking about architecture and features.
 * Pain: Balancing technical debt with shipping, saying "no" to feature requests, thinking about scale.
 * First-win: Getting red-team feedback on a major technical or feature direction before committing.
 */
export const techTrack: TrackSeed = {
  track: "tech",
  projectName: "Developer Platform",
  projectDescription:
    "A developer-facing product or tool. Technical decisions matter as much as product decisions.",
  signals: [
    {
      title: "API latency hitting 500ms under load",
      content:
        "Load tests show degradation at 1000 req/s. Current architecture isn't scaling horizontally. Affects user experience when platform gets popular.",
      source: "technical_metrics",
    },
    {
      title: "Users asking for SDKs in Python and Go",
      content:
        "GitHub issues + Slack: community is asking for official SDKs beyond JavaScript. This is a high-effort, high-impact request.",
      source: "user_feedback",
    },
    {
      title: "Technical debt in auth system is mounting",
      content:
        "OAuth implementation was hacked together. Now needs custom scopes, multi-org support. Refactoring is painful but getting more painful.",
      source: "internal_engineering",
    },
    {
      title: "Five-figure monthly cloud bill, still growing",
      content:
        "Infrastructure cost is climbing faster than revenue. Need to optimize. Running on overkill infrastructure? Or is the app just inefficient?",
      source: "business_metrics",
    },
  ],
  opportunities: [
    {
      title: "Refactor auth system for multi-org and custom scopes",
      problem:
        "Current auth is a mess. Enterprise customers need custom scopes. Fixing this now prevents 3x rewrites later.",
      target_user: "Enterprise customers, future-you",
      impact: 8,
      confidence: 8,
      ease: 3,
    },
    {
      title: "Rebuild API layer for horizontal scaling",
      problem:
        "Current monolith hits 500ms under load. Async job queue + caching layer would buy us 10x headroom.",
      target_user: "All users (improves experience for power users)",
      impact: 8,
      confidence: 7,
      ease: 4,
    },
    {
      title: "Ship official Python SDK (and eventually Go)",
      problem:
        "JavaScript SDK does 80% of the work. Python/Go are most-requested. Investing here unlocks adoption in data science and DevOps communities.",
      target_user: "Python/Go developers",
      impact: 7,
      confidence: 7,
      ease: 5,
    },
    {
      title: "Audit and optimize cloud spend",
      problem:
        "Monthly bill is growing faster than users. Could be inefficient queries, poor caching, or overkill infrastructure. ROI is high.",
      target_user: "Business (unit economics)",
      impact: 7,
      confidence: 5,
      ease: 8,
    },
  ],
};

/**
 * Get seed data for a track
 */
export function getTrackSeed(track: OnboardingTrack): TrackSeed {
  switch (track) {
    case "solo":
      return soloTrack;
    case "founding":
      return foundingTrack;
    case "tech":
      return techTrack;
    default: {
      const _exhaustive: never = track;
      return _exhaustive;
    }
  }
}

/**
 * Track descriptions for the selector UI
 */
export const trackDescriptions: Record<OnboardingTrack, { label: string; subtitle: string }> = {
  solo: {
    label: "Solo PM",
    subtitle: "Individual contributor managing your own product or side project",
  },
  founding: {
    label: "Founding PM",
    subtitle:
      "Early-stage founder wearing the PM hat, resource-constrained and aligned with investors",
  },
  tech: {
    label: "Tech Founder",
    subtitle: "Technical founder balancing feature work with architecture and technical debt",
  },
};
