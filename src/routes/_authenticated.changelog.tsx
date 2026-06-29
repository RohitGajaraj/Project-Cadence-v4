// Changelog — BYO-P3 WI4. The in-app, reverse-chronological record of what
// shipped, grouped by product. Entries are materialized from merged studio
// changesets (the studio_changeset_to_changelog trigger + the durable
// publishChangelogEntry path), so a merge surfaces here automatically. Ember
// chrome matches the Build surface (AppShell + SurfaceHeader + bento rows).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, GitPullRequest, History, ScrollText } from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { TopBar } from "@/components/cadence/TopBar";
import { EmptyState, SurfaceHeader } from "@/components/cadence/Primitives";
import { useWorkspace } from "@/hooks/use-workspace";
import { listProjects } from "@/lib/projects.functions";
import { listChangelog, type ChangelogEntry } from "@/lib/changelog.functions";

export const Route = createFileRoute("/_authenticated/changelog")({
  component: ChangelogPage,
  head: () => ({ meta: [{ title: "Changelog · Cadence" }] }),
});

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function groupByProduct(
  entries: ChangelogEntry[],
): Array<{ label: string; entries: ChangelogEntry[] }> {
  const groups = new Map<string, ChangelogEntry[]>();
  for (const e of entries) {
    const label = e.product_name ?? "Unassigned";
    const arr = groups.get(label) ?? [];
    arr.push(e);
    groups.set(label, arr);
  }
  return Array.from(groups.entries()).map(([label, es]) => ({ label, entries: es }));
}

function ChangelogPage() {
  const { activeWorkspace } = useWorkspace();
  const fProjects = useServerFn(listProjects);
  const fChangelog = useServerFn(listChangelog);

  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => fProjects({ data: {} }),
  });
  const changelog = useQuery({
    queryKey: ["changelog", activeWorkspace?.id],
    queryFn: () => fChangelog({ data: { workspaceId: activeWorkspace?.id } }),
  });

  const entries = changelog.data?.entries ?? [];
  const groups = groupByProduct(entries);

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <TopBar crumbs={[activeWorkspace?.name ?? "Workspace", "Changelog"]} />
      <div
        data-screen-label="Changelog"
        style={{ padding: "30px 44px 56px", maxWidth: 980, margin: "0 auto" }}
      >
        <SurfaceHeader
          kicker="Loop · Ship"
          icon={ScrollText}
          title="Changelog"
          sub="What actually shipped, newest first. Each entry is written when a build merges, with its release notes — so the loop's output is visible without leaving Cadence."
        />

        {changelog.isLoading ? (
          <div className="bento" style={{ padding: 24, color: "var(--ink-subtle)", fontSize: 13 }}>
            Loading changelog…
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={History}
            title="Nothing shipped yet"
            body="When a Build session merges a change, its release notes appear here automatically."
            cta="Go to Build"
            onCta={() => {
              window.location.href = "/build";
            }}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {groups.map((group) => (
              <section key={group.label}>
                <div
                  className="mono-label"
                  style={{ marginBottom: 12, color: "var(--ink-subtle)" }}
                >
                  {group.label}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {group.entries.map((e) => (
                    <article key={e.id} className="bento" style={{ padding: 18 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          gap: 12,
                        }}
                      >
                        <h3 className="font-display" style={{ fontSize: 16, fontWeight: 460 }}>
                          {e.title}
                        </h3>
                        <time
                          style={{
                            fontSize: 12,
                            color: "var(--ink-subtle)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {fmtDate(e.published_at)}
                        </time>
                      </div>
                      {e.body ? (
                        <p
                          style={{
                            fontSize: 13,
                            color: "var(--ink-muted)",
                            marginTop: 8,
                            whiteSpace: "pre-wrap",
                            lineHeight: 1.55,
                          }}
                        >
                          {e.body}
                        </p>
                      ) : null}
                      {e.pr_url ? (
                        <a
                          href={e.pr_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-ghost btn-sm"
                          style={{ marginTop: 12, gap: 6 }}
                        >
                          <GitPullRequest size={13} />
                          {e.pr_number ? `PR #${e.pr_number}` : "View PR"}
                          <ExternalLink size={12} />
                        </a>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <div style={{ marginTop: 28, fontSize: 12.5, color: "var(--ink-subtle)" }}>
          <Link to="/impact" style={{ color: "var(--ember)" }}>
            View outcomes →
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
