/**
 * BYO-P1b — Per-product repo binding UI.
 *
 * Shows the product's current repo binding (if any) and lets a workspace member
 * override the workspace-level binding with a product-specific one. The product
 * binding is the most specific tier of the resolution chain:
 *   product binding > workspace binding > user connection > env fallback
 *
 * Used on /sync (per-product section) and in the product Settings drawer.
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Link2, Loader2, Plus, X } from "lucide-react";
import { toast } from "@/lib/notify";
import { CreateRepoModal } from "./CreateRepoModal";
import {
  listConnections,
  listProductBindings,
  addProductBinding,
  removeBinding,
  type BindingRow,
  type ConnectionRow,
} from "@/lib/connections.functions";
import { CONNECTOR_REGISTRY, type ProviderId } from "@/lib/connectors/registry";

type Props = {
  projectId: string;
  workspaceId: string;
  projectName?: string;
};

export function ProductBindingsSection({ projectId, workspaceId, projectName }: Props) {
  const qc = useQueryClient();
  const [picking, setPicking] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fConnections = useServerFn(listConnections);
  const fBindings = useServerFn(listProductBindings);
  const fAdd = useServerFn(addProductBinding);
  const fRemove = useServerFn(removeBinding);

  const qConnections = useQuery({ queryKey: ["connections"], queryFn: () => fConnections() });
  const qBindings = useQuery({
    queryKey: ["product-bindings", projectId],
    queryFn: () => fBindings({ data: { projectId } }),
  });

  const connections = (qConnections.data?.connections ?? []) as ConnectionRow[];
  const bindings = (qBindings.data?.bindings ?? []) as BindingRow[];

  const mAdd = useMutation({
    mutationFn: (args: {
      connectionId: string;
      provider: string;
      resourceKind: string;
      resourceId: string;
      resourceLabel?: string;
    }) =>
      fAdd({
        data: {
          projectId,
          workspaceId,
          connectionId: args.connectionId,
          provider: args.provider,
          resourceKind: args.resourceKind,
          resourceId: args.resourceId,
          resourceLabel: args.resourceLabel,
        },
      }),
    onSuccess: () => {
      toast.success("Product binding saved");
      setPicking(null);
      qc.invalidateQueries({ queryKey: ["product-bindings", projectId] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Bind failed"),
  });

  const mRemove = useMutation({
    mutationFn: (id: string) => fRemove({ data: { id } }),
    onSuccess: () => {
      toast.success("Product binding removed — falling back to workspace binding");
      qc.invalidateQueries({ queryKey: ["product-bindings", projectId] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Unbind failed"),
  });

  const providers = (Object.keys(CONNECTOR_REGISTRY) as ProviderId[])
    .map((id) => CONNECTOR_REGISTRY[id])
    .filter((spec) => spec.resourceTypes.length > 0);

  if (qConnections.isLoading || qBindings.isLoading) return null;

  const hasAnyConnection = connections.length > 0;
  if (!hasAnyConnection) return null;

  return (
    <>
      <div className="rounded-xl border hairline bg-background/60 divide-y divide-border/40">
        <div className="px-4 py-2.5 flex items-center gap-2">
          <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground">
            {projectName ? `${projectName} — repo binding` : "Product repo binding"}
          </span>
          <span className="text-[10px] text-muted-foreground/60 ml-1">
            overrides workspace default
          </span>
        </div>

        {/* Create repo affordance — only when GitHub is connected */}
        {connections.some((c) => c.provider === "github" && c.status === "connected") && (
          <div className="px-4 py-2 flex justify-end">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              <Plus className="h-3 w-3" />
              Create new GitHub repo
            </button>
          </div>
        )}

        {providers.flatMap((spec) =>
          spec.resourceTypes.map((rt) => {
            const binding = bindings.find(
              (b) => b.provider === spec.id && b.resource_kind === rt.kind,
            );
            const connected = connections.filter(
              (c) => c.provider === spec.id && c.status === "connected",
            );
            const pickKey = `${spec.id}:${rt.kind}`;

            return (
              <div key={pickKey} className="px-4 py-2.5 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-foreground font-medium">{rt.label ?? rt.kind}</div>
                  <div className="text-[11px] text-muted-foreground">{spec.label}</div>
                </div>

                {binding ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                    <code className="text-[11px] text-foreground">{binding.resource_id}</code>
                    <button
                      onClick={() => mRemove.mutate(binding.id)}
                      disabled={mRemove.isPending}
                      title="Remove product override (falls back to workspace binding)"
                      className="text-muted-foreground hover:text-destructive disabled:opacity-40"
                    >
                      {mRemove.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                ) : picking === pickKey ? (
                  <div className="flex items-center gap-2">
                    <select
                      className="text-xs border border-border rounded px-2 py-1 bg-background"
                      defaultValue=""
                      onChange={(e) => {
                        const conn = connected.find((c) => c.id === e.target.value);
                        if (!conn) return;
                        mAdd.mutate({
                          connectionId: conn.id,
                          provider: spec.id,
                          resourceKind: rt.kind,
                          resourceId: conn.account_label ?? conn.id,
                          resourceLabel: conn.account_label ?? undefined,
                        });
                      }}
                    >
                      <option value="" disabled>
                        Pick account...
                      </option>
                      {connected.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.account_label ?? c.id.slice(0, 8)}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setPicking(null)}
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      cancel
                    </button>
                  </div>
                ) : connected.length > 0 ? (
                  <button
                    onClick={() => setPicking(pickKey)}
                    className="text-[11px] text-primary hover:underline"
                  >
                    Set product override
                  </button>
                ) : (
                  <span className="text-[11px] text-muted-foreground/50">Not connected</span>
                )}
              </div>
            );
          }),
        )}
      </div>

      <CreateRepoModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        productId={projectId}
        workspaceId={workspaceId}
        productName={projectName}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["product-bindings", projectId] });
        }}
      />
    </>
  );
}
