// F-CONN Phase 1 — GitHub App provider (server-only).
// App JWT (RS256 via WebCrypto), installation token minting (cached ~50min),
// connect-state HMAC helpers for the install callback, the ConnectorAdapter,
// and resolveGitHub — the one entry point every GitHub call site uses.

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { base64ToBytes, base64UrlToBytes, bytesToBase64Url } from "../crypto.server";
import { resolveProviderAuth, type ResolvedAuth } from "../resolve.server";
import type { ConnectorAdapter, ResourceItem, ValidateResult } from "./types.server";

const GH_API = "https://api.github.com";
const GH_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "circuit-connectors",
} as const;

const NOT_CONNECTED_ERROR =
  "GitHub is not connected. Connect it in Settings → Connected accounts, then bind a repo on Connectors.";

// ---- repo normalization (centralized; same shape as outcome/discovery.functions.ts) ----

/** Normalize 'https://github.com/owner/name.git' / 'git@…' / 'owner/name/' → 'owner/name', else null. */
export function normalizeGithubRepo(rawRepo: string): string | null {
  const repo = rawRepo
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/^git@github\.com:/i, "")
    .replace(/\.git$/i, "")
    .replace(/\/+$/, "");
  return /^[\w.-]+\/[\w.-]+$/.test(repo) ? repo : null;
}

// ---- App JWT ----

async function importAppKey(): Promise<CryptoKey> {
  const raw = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!raw) {
    throw new Error("GITHUB_APP_PRIVATE_KEY is not set — GitHub App connect is setup pending.");
  }
  // Secrets pasted as single lines often carry literal \n escapes.
  const pem = raw.replace(/\\n/g, "\n").trim();
  if (pem.includes("RSA PRIVATE KEY")) {
    throw new Error(
      "GITHUB_APP_PRIVATE_KEY is PKCS#1 (BEGIN RSA PRIVATE KEY); WebCrypto needs PKCS#8. Convert with: openssl pkcs8 -topk8 -nocrypt -in app.pem",
    );
  }
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  return crypto.subtle.importKey(
    "pkcs8",
    base64ToBytes(body),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function b64urlJson(obj: Record<string, unknown>): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(obj)));
}

/** Short-lived RS256 app JWT for /app/* endpoints. */
export async function appJwt(): Promise<string> {
  const appId = process.env.GITHUB_APP_ID;
  if (!appId) {
    throw new Error("GITHUB_APP_ID is not set — GitHub App connect is setup pending.");
  }
  const key = await importAppKey();
  const now = Math.floor(Date.now() / 1000);
  const signingInput = `${b64urlJson({ alg: "RS256", typ: "JWT" })}.${b64urlJson({
    iat: now - 60,
    exp: now + 540,
    iss: appId,
  })}`;
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${bytesToBase64Url(new Uint8Array(sig))}`;
}

// ---- Installation tokens (GitHub tokens live 1h; cache ~50min) ----

const installTokenCache = new Map<string, { token: string; expiresAt: number }>();

export async function mintInstallationToken(installationId: string): Promise<string> {
  const cached = installTokenCache.get(installationId);
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  const jwt = await appJwt();
  const res = await fetch(`${GH_API}/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: { ...GH_HEADERS, Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) {
    throw new Error(
      `GitHub installation token mint failed (${res.status}): ${(await res.text()).slice(0, 200)}`,
    );
  }
  const body = (await res.json()) as { token?: string };
  if (!body.token) throw new Error("GitHub installation token response missing token");
  installTokenCache.set(installationId, {
    token: body.token,
    expiresAt: Date.now() + 50 * 60 * 1000,
  });
  return body.token;
}

/** Probe an installation via the app JWT → account login (org or user the app is installed on). */
export async function getInstallationAccount(
  installationId: string,
): Promise<{ login: string | null }> {
  const jwt = await appJwt();
  const res = await fetch(`${GH_API}/app/installations/${installationId}`, {
    headers: { ...GH_HEADERS, Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) {
    throw new Error(
      `GitHub installation probe failed (${res.status}): ${(await res.text()).slice(0, 200)}`,
    );
  }
  const body = (await res.json()) as { account?: { login?: string } };
  return { login: body.account?.login ?? null };
}

// ---- Connect-state HMAC (used by startGithubAppConnect + the public callback) ----

async function stateHmac(payload: string): Promise<string> {
  const keyB64 = process.env.CONNECTOR_SECRETS_KEY;
  if (!keyB64) {
    throw new Error("CONNECTOR_SECRETS_KEY is not set — cannot sign GitHub connect state.");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(keyB64.trim()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return bytesToBase64Url(new Uint8Array(sig));
}

/** state = base64url(user_id|exp|hmac), 15-minute expiry. */
export async function makeConnectState(userId: string): Promise<string> {
  const exp = Date.now() + 15 * 60 * 1000;
  const mac = await stateHmac(`${userId}|${exp}`);
  return bytesToBase64Url(new TextEncoder().encode(`${userId}|${exp}|${mac}`));
}

/** Returns the user_id when the state is authentic and unexpired, else null. Never throws. */
export async function readConnectState(state: string): Promise<string | null> {
  try {
    const decoded = new TextDecoder().decode(base64UrlToBytes(state));
    const [userId, expRaw, mac] = decoded.split("|");
    if (!userId || !expRaw || !mac) return null;
    const exp = Number(expRaw);
    if (!Number.isFinite(exp) || exp < Date.now()) return null;
    const expected = await stateHmac(`${userId}|${exp}`);
    return mac === expected ? userId : null;
  } catch {
    return null;
  }
}

// ---- ConnectorAdapter ----

function bearerOf(auth: ResolvedAuth): string | null {
  return auth.kind === "gateway" ? null : auth.token;
}

export const githubAdapter: ConnectorAdapter = {
  async validate(auth): Promise<ValidateResult> {
    try {
      if (auth.kind === "github_app") {
        const { login } = await getInstallationAccount(auth.installationId);
        return { ok: true, accountLabel: login };
      }
      const token = bearerOf(auth);
      if (!token) return { ok: false, detail: "unsupported auth kind for github" };
      const res = await fetch(`${GH_API}/user`, {
        headers: { ...GH_HEADERS, Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { ok: false, detail: `GitHub token check failed (${res.status})` };
      const body = (await res.json()) as { login?: string };
      return { ok: true, accountLabel: body.login ?? null };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
  },

  async listResources(auth, kind, opts): Promise<ResourceItem[]> {
    if (kind !== "repo") return [];
    const token = bearerOf(auth);
    if (!token) return [];
    // Installation tokens list the repos the installation can see; PAT/env
    // tokens fall back to the caller's own repos.
    const url =
      auth.kind === "github_app"
        ? `${GH_API}/installation/repositories?per_page=100`
        : `${GH_API}/user/repos?per_page=100&sort=updated`;
    const res = await fetch(url, {
      headers: { ...GH_HEADERS, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(
        `GitHub repo listing failed (${res.status}): ${(await res.text()).slice(0, 200)}`,
      );
    }
    const body = (await res.json()) as
      | { repositories?: { full_name?: string }[] }
      | { full_name?: string }[];
    const repos = Array.isArray(body) ? body : (body.repositories ?? []);
    const q = opts?.q?.toLowerCase();
    return repos
      .map((r) => r.full_name)
      .filter((name): name is string => !!name)
      .filter((name) => !q || name.toLowerCase().includes(q))
      .map((name) => ({ id: name, label: name }));
  },
};

// ---- resolveGitHub — the entry point for every GitHub call site ----

async function actorLabelFor(auth: ResolvedAuth): Promise<string> {
  if (auth.kind === "env") return "env token";
  try {
    const admin = supabaseAdmin as unknown as SupabaseClient;
    const { data } = await admin
      .from("connections")
      .select("account_label")
      .eq("id", auth.connectionRowId)
      .maybeSingle();
    if (data?.account_label) return data.account_label as string;
  } catch {
    /* label is cosmetic — fall through */
  }
  return "Circuit GitHub App";
}

export async function resolveGitHub(args: {
  userId?: string | null;
  workspaceId?: string | null;
  userClient?: SupabaseClient;
}): Promise<{
  token: string;
  repo: string;
  source: "binding" | "user_connection" | "env";
  actorLabel: string;
}> {
  const resolved = await resolveProviderAuth({
    userClient: args.userClient,
    userId: args.userId,
    workspaceId: args.workspaceId,
    provider: "github",
    resourceKind: "repo",
  });
  if (!resolved.auth) throw new Error(NOT_CONNECTED_ERROR);
  const token = bearerOf(resolved.auth);
  if (!token) throw new Error(NOT_CONNECTED_ERROR);

  if (resolved.source === "workspace_binding" && resolved.binding) {
    const repo = normalizeGithubRepo(resolved.binding.resourceId);
    if (!repo) {
      throw new Error(
        `GitHub binding has an invalid repo "${resolved.binding.resourceId}" — expected owner/name. Re-bind the repo on Connectors.`,
      );
    }
    return { token, repo, source: "binding", actorLabel: await actorLabelFor(resolved.auth) };
  }

  const envRepo = process.env.GITHUB_REPO ? normalizeGithubRepo(process.env.GITHUB_REPO) : null;

  if (resolved.source === "user_connection") {
    // Connected account but no workspace binding: only usable when the legacy
    // env still names the repo.
    if (!envRepo) throw new Error(NOT_CONNECTED_ERROR);
    return {
      token,
      repo: envRepo,
      source: "user_connection",
      actorLabel: await actorLabelFor(resolved.auth),
    };
  }

  // env source
  if (!envRepo) throw new Error(NOT_CONNECTED_ERROR);
  return { token, repo: envRepo, source: "env", actorLabel: "env token" };
}
