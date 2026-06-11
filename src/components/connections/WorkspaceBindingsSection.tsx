import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  listConnections,
  listWorkspaceBindings,
  removeBinding,
  type ConnectionRow,
  type WorkspaceBindingRow,
} from "@/lib/connections.functions";
import { CONNECTOR_REGISTRY, type ProviderId } from "@/lib/connectors/registry";
import { BindingPicker } from "@/components/connections/BindingPicker";

/**
 * Workspace bindings — maps account-level connections to this workspace's
 * resources (which repo, team, database the agents act on). Rendered from
 * CONNECTOR_REGISTRY: one row per provider resource type; states are
 * bound (chip) / connected-but-unbound (picker) / not connected (settings link).
 */
export function WorkspaceBindingsSection() {
  const qc = useQueryClient();
  const fConnections = useServerFn(listConnections);
  const fBindings = useServerFn(listWorkspaceBindings);
  const fRemove = useServerFn(removeBinding);

  const qConnections = useQuery({ queryKey: ["connections"], queryFn: () => fConnections() });
  const qBindings = useQuery({
    queryKey: ["workspace-bindings"],
    queryFn: () => fBindings(),
  });
  const connections = (qConnections.data?.connections ?? []) as ConnectionRow[];
  const bindings = (qBindings.data?.bindings ?? []) as WorkspaceBindingRow[];

  const mUnbind = useMutation({
    mutationFn: (id: string) => fRemove({ data: { id } }),
    onSuccess: () => {
      toast.success("Binding removed");
      qc.invalidateQueries({ queryKey: ["workspace-bindings"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Unbind failed"),
  });

  const providers = (Object.keys(CONNECTOR_REGISTRY) as ProviderId[])
    .map((id) => CONNECTOR_REGISTRY[id])
    .filter((spec) => spec.resourceTypes.length > 0);

  const isLoading = qConnections.isLoading || qBindings.isLoading;

  return (
    <section className="mb-10">
      <div className="flex items-center gap-2 mb-1">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-display text-sm tracking-tight uppercase text-muted-foreground">
          Workspace bindings
        </h2>
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        Map your connected accounts to this workspace — which repo, team, or database the agents act
        on.
      </p>
      <div className="rounded-xl border hairline bg-background/60 divide-y divide-border/40">
        {isLoading && (
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading…
          </div>
        )}
        {!isLoading &&
          providers.flatMap((spec) =>
            spec.resourceTypes.map((rt) => {
              const binding = bindings.find(
                (b) => b.provider === spec.id && b.resource_kind === rt.kind,
              );
              const connection =
                connections.find((c) => c.provider === spec.id && c.status === "connected") ??
                connections.find((c) => c.provider === spec.id);

              return (
                <div
                  key={`${spec.id}:${rt.kind}`}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{spec.label}</div>
                    <div className="text-xs text-muted-foreground">{rt.label}</div>
                  </div>
                  <div className="shrink-0">
                    {binding ? (
                      binding.connection_status !== "connected" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-xs text-amber-400">
                          <AlertTriangle className="h-3 w-3" />
                          {binding.resource_kind}: {binding.resource_label ?? binding.resource_id} ·
                          reconnect needed ·
                          <button
                            type="button"
                            disabled={mUnbind.isPending}
                            onClick={() => mUnbind.mutate(binding.id)}
                            className="underline underline-offset-2 hover:text-foreground disabled:opacity-40"
                          >
                            Unbind
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border hairline bg-secondary/40 px-2.5 py-1 text-xs">
                          {binding.resource_kind}: {binding.resource_label ?? binding.resource_id} ·
                          via {binding.account_label ?? spec.label}
                          {binding.owner_display ? ` (${binding.owner_display})` : ""} ·
                          <button
                            type="button"
                            disabled={mUnbind.isPending}
                            onClick={() => mUnbind.mutate(binding.id)}
                            className="text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-40"
                          >
                            Unbind
                          </button>
                        </span>
                      )
                    ) : connection ? (
                      <BindingPicker
                        connectionId={connection.id}
                        resourceKind={rt.kind}
                        kindLabel={rt.label}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Connect {spec.label} in{" "}
                        <Link
                          to="/settings"
                          search={{ section: "connections" }}
                          className="underline underline-offset-2 hover:text-foreground"
                        >
                          Settings → Connected accounts
                        </Link>{" "}
                        first
                      </span>
                    )}
                  </div>
                </div>
              );
            }),
          )}
      </div>
    </section>
  );
}
