/**
 * Sub-processor disclosure registry (Data/Privacy, considerations.md).
 *
 * Enterprise security reviews and GDPR Article 28 require a current list of the third parties
 * that process customer data on Cadence's behalf. This module is that list, derived where
 * possible from live configuration so the disclosure cannot drift from reality:
 *
 *   - Infrastructure sub-processors (the gateway, the database, the host) are a curated static
 *     list, since they are not encoded elsewhere in the app.
 *   - AI model providers are derived from the model catalog (`MODELS`): a provider is an ACTIVE
 *     sub-processor only when at least one of its models is `live` (data actually flows to it
 *     today). Adapter-ready providers (`live: false`, BYO-key only) are listed as INACTIVE so a
 *     customer who enables BYO can see who would then receive their prompts; `ollama` is excluded
 *     because it is self-hosted by the customer, so it is never a third-party sub-processor.
 *
 * Pure (no IO), so it is fully unit-tested in subprocessors.test.ts and safe to import on the
 * client (it carries no secrets). The legal-reviewed public copy, exact processing regions, and
 * the DPA links are a founder/legal pass on top of this factual base (see the feature doc).
 */
import { MODELS, type Model } from "@/lib/ai/models";

export type SubProcessorCategory = "ai_gateway" | "ai_model_provider" | "infrastructure";

export type SubProcessor = {
  /** Stable kebab id (for React keys + tests). */
  id: string;
  /** Display name. */
  name: string;
  category: SubProcessorCategory;
  /** What Cadence uses the processor for (plain, one line). */
  purpose: string;
  /** Categories of customer data that flow to the processor. Never empty. */
  dataCategories: string[];
  /**
   * Primary processing jurisdiction, when known and uncontroversial. Left undefined here and
   * filled by the legal pass, so the shipped registry never asserts an unverified residency.
   */
  region?: string;
  /** True when data flows to the processor in the CURRENT configuration. */
  active: boolean;
};

/**
 * The infrastructure that always sits in the request/data path. Curated because it is not
 * encoded elsewhere; kept in declared order for a stable, render-ready list.
 */
const INFRASTRUCTURE_SUBPROCESSORS: readonly SubProcessor[] = [
  {
    id: "lovable",
    name: "Lovable",
    category: "ai_gateway",
    purpose:
      "AI gateway that routes inference to model providers, plus platform hosting and provisioning",
    dataCategories: [
      "Prompts and context sent for inference",
      "Model completions",
      "Application configuration",
    ],
    active: true,
  },
  {
    id: "supabase",
    name: "Supabase",
    category: "infrastructure",
    purpose: "Managed Postgres database, authentication, and file storage",
    dataCategories: [
      "Account and workspace data",
      "Product artifacts",
      "Authentication identifiers",
    ],
    active: true,
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    category: "infrastructure",
    purpose: "Application hosting and edge compute (Workers)",
    dataCategories: ["Request metadata", "Application traffic"],
    active: true,
  },
];

/**
 * Display metadata per model provider. A `null` entry marks a provider that is NOT a third-party
 * sub-processor (self-hosted), so it is omitted from the disclosure entirely.
 */
const PROVIDER_META: Record<Model["provider"], { name: string } | null> = {
  google: { name: "Google (Gemini API)" },
  openai: { name: "OpenAI" },
  anthropic: { name: "Anthropic" },
  deepseek: { name: "DeepSeek" },
  xai: { name: "xAI (Grok)" },
  moonshot: { name: "Moonshot AI (Kimi)" },
  ollama: null, // self-hosted by the customer; never a third-party sub-processor
};

const MODEL_PROVIDER_DATA_CATEGORIES = [
  "Prompts and context sent for inference",
  "Model completions",
];

/**
 * The AI model providers that are sub-processors, derived from the catalog. A provider is ACTIVE
 * when at least one of its models is `live`; otherwise it is listed inactive (adapter-ready, BYO
 * only). Deterministic order: active first, then alphabetical by name. Pure.
 */
export function modelProviderSubprocessors(catalog: readonly Model[] = MODELS): SubProcessor[] {
  const liveProviders = new Set(catalog.filter((m) => m.live).map((m) => m.provider));
  const seen = new Set<Model["provider"]>();
  const out: SubProcessor[] = [];

  for (const m of catalog) {
    if (seen.has(m.provider)) continue;
    seen.add(m.provider);
    const meta = PROVIDER_META[m.provider];
    if (!meta) continue; // self-hosted (e.g. ollama) - not a third-party sub-processor
    out.push({
      id: m.provider,
      name: meta.name,
      category: "ai_model_provider",
      purpose: "Large language model inference",
      dataCategories: [...MODEL_PROVIDER_DATA_CATEGORIES],
      active: liveProviders.has(m.provider),
    });
  }

  return out.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * The full sub-processor disclosure: infrastructure first, then model providers (active first).
 * Includes inactive (adapter-ready) providers for transparency about BYO data flows. Pure.
 */
export function allSubprocessors(catalog: readonly Model[] = MODELS): SubProcessor[] {
  return [...INFRASTRUCTURE_SUBPROCESSORS, ...modelProviderSubprocessors(catalog)];
}

/**
 * Only the sub-processors that receive data in the CURRENT configuration - the honest "who has
 * our data today" disclosure for a trust page or security questionnaire. Pure.
 */
export function activeSubprocessors(catalog: readonly Model[] = MODELS): SubProcessor[] {
  return allSubprocessors(catalog).filter((s) => s.active);
}
