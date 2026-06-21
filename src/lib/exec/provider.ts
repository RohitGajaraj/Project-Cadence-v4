/**
 * SANDBOX (Build / execution spine) — the `ExecProvider` seam.
 *
 * One swappable abstraction for "where a build's checks run, and whether the
 * result clears it to merge / preview". Today there is no Cadence execution
 * sandbox (see `ai/studio-ci.ts`): checks run in the connected repo's GitHub
 * Actions CI, which is the $0 native floor and is ALWAYS available. A paid
 * microVM backend — Cloudflare Sandbox SDK first, with E2B / Vercel one swap
 * away for untrusted code — plugs in behind this same interface once the founder
 * confirms the compute spend (sourcing-map founder call #4). Until then the
 * floor holds and the paid backends are reserved ids that resolve back to the
 * floor, so a misconfiguration can never strand a build with no way to run.
 *
 * The floor reuses `studio-ci.ts`, so an `ExecProvider` verdict and the
 * `studio.pr.merge` gate can never disagree on what "green" means.
 *
 * Doctrine: this is the un-gated prep the sourcing-map authorizes — scaffold the
 * seam + ship the $0 floor; do NOT provision a paid account, add a secret, or
 * turn on metered compute (those are founder-only).
 */
import {
  overallFromChecks,
  mergeReadinessFromCi,
  type CiCheckLite,
  type CiOverall,
} from "@/lib/ai/studio-ci";

// Re-exported so callers building an ExecVerdict have one import surface for the
// seam and the check shape it consumes.
export type { CiCheckLite, CiOverall } from "@/lib/ai/studio-ci";

/** Every execution backend we know about. Only `github-actions` is wired today. */
export type ExecProviderId = "github-actions" | "cloudflare-sandbox" | "e2b" | "vercel";

/** A backend's verdict on one build's checks. */
export interface ExecVerdict {
  provider: ExecProviderId;
  overall: CiOverall;
  /** True when the checks clear this build to merge / preview. */
  mayProceed: boolean;
  reason: string;
}

export interface ExecProvider {
  readonly id: ExecProviderId;
  /** Whether this backend is wired AND permitted to run right now. */
  readonly available: boolean;
  /** Derive a merge / preview verdict from this backend's check results. */
  verdictFromChecks(checks: CiCheckLite[]): ExecVerdict;
}

/**
 * The $0 native floor: the connected repo's GitHub Actions CI. Always available,
 * never metered. Delegates the "what is green" decision to `studio-ci.ts` so the
 * two readers cannot drift.
 */
export const githubActionsProvider: ExecProvider = {
  id: "github-actions",
  available: true,
  verdictFromChecks(checks: CiCheckLite[]): ExecVerdict {
    const overall = overallFromChecks(checks);
    const { allowed, reason } = mergeReadinessFromCi(overall);
    return { provider: "github-actions", overall, mayProceed: allowed, reason };
  },
};

/**
 * Paid microVM backends reserved behind the seam but not yet wired (founder
 * spend gate, sourcing-map call #4). Named here so the resolver and the docs
 * stay the single source of "what can plug in", with nobody hard-coding a
 * provider id elsewhere.
 */
export const RESERVED_PROVIDER_IDS: readonly ExecProviderId[] = [
  "cloudflare-sandbox",
  "e2b",
  "vercel",
];

/** Registry of the backends that are actually wired + selectable today. */
const WIRED_PROVIDERS: readonly ExecProvider[] = [githubActionsProvider];

/**
 * Resolve the active `ExecProvider`. The GitHub Actions $0 floor is the default
 * and currently the only wired, available backend; a `preferred` id that has no
 * live adapter (e.g. a reserved paid backend selected via an `EXEC_PROVIDER`
 * value before its adapter ships) falls back to the floor rather than failing.
 * When a paid adapter lands it is added to {@link WIRED_PROVIDERS} with its
 * `available` gated on the founder's spend confirmation, and this resolver picks
 * it up with no call-site change.
 */
export function resolveExecProvider(preferred?: string | null): ExecProvider {
  const match = preferred
    ? WIRED_PROVIDERS.find((p) => p.id === preferred && p.available)
    : undefined;
  return match ?? githubActionsProvider;
}
