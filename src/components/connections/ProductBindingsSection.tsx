// BYO-P1b: Per-product repo binding UI.
//
// Shows every product (projects row) in the active workspace, with its current
// binding for each provider resource type. Lets the user pick a connection from
// their account-level connections and bind/unbind it per product.
//
// Rendered from the Sync page under "Per-product bindings", only when products
// exist. Follows the same interaction pattern as WorkspaceBindingsSection.

import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Boxes, Loader2 } from "lucide-react";
import { toast } from "@/lib/notify";
import { listConnections, type ConnectionRow } from "@/lib/connections.functions";
import {
  listProducts,
  listProductBindings,
  removeProductBinding,
  type ProductRow,
  type ProductBindingRow,
} from "@/lib/connectors/product-binding.functions";
import { CONNECTOR_REGISTRY, type ProviderId } from "@/lib/connectors/registry";
import { ProductBindingPicker } from "@/components/connections/ProductBindingPicker";

/**
 * Per-product binding section. Visible only when the workspace has at least one
 * product. One row per (product x provider resource type); states are bound /
 * connected-but-unbound (picker) / not connected (settings link).
 */
export function ProductBindingsSection() {
  const qc = useQueryClient();
  const fConnections = useServerFn(listConnections);
  const fProducts = useServerFn(listProducts);
  const fBindings = useServerFn(listProductBindings);
  const fRemove = useServerFn(removeProductBinding);

  const qConnections = useQuery({
    queryKey: ["connections"],
    queryFn: () => fConnections(),
  });
  const qProducts = useQuery({
    queryKey: ["products-for-binding"],
    queryFn: () => fProducts(),
  });
  const qBindings = useQuery({
    queryKey: ["product-bindings"],
    queryFn: () => fBindings(),
  });

  const connections = (qConnections.data?.connections ?? []) as ConnectionRow[];
  const products = (qProducts.data?.products ?? []) as ProductRow[];
  const bindings = (qBindings.data?.bindings ?? []) as ProductBindingRow[];

  const mUnbind = useMutation({
    mutationFn: (id: string) => fRemove({ data: { id } }),
    onSuccess: () => {
      toast.success("Binding removed");
      qc.invalidateQueries({ queryKey: ["product-bindings"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Unbind failed"),
  });

  const providers = (Object.keys(CONNECTOR_REGISTRY) as ProviderId[])
    .map((id) => CONNECTOR_REGISTRY[id])
    .filter((spec) => spec.resourceTypes.length > 0 && spec.userFacing !== false);

  const isLoading = qConnections.isLoading || qProducts.isLoading || qBindings.isLoading;

  // Only render when there are products to bind.
  if (!isLoading && products.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="flex items-center gap-2 mb-1">
        <Boxes className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-display text-sm tracking-tight uppercase text-muted-foreground">
          Per-product bindings
        </h2>
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        Override the workspace-level binding for a specific product. Each product can point to its
        own repo, team, or other resource.
      </p>

      {isLoading && (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading...
        </div>
      )}

      {!isLoading && (
        <div className="space-y-4">
          {products.map((product) => (
            <div key={product.id} className="rounded-xl border hairline bg-background/60">
              <div className="px-4 py-2 border-b border-border/40">
                <span className="text-xs font-medium text-foreground/80">{product.name}</span>
              </div>
              <div className="divide-y divide-border/40">
                {providers.flatMap((spec) =>
                  spec.resourceTypes.map((rt) => {
                    const binding = bindings.find(
                      (b) =>
                        b.product_id === product.id &&
                        b.provider === spec.id &&
                        b.resource_kind === rt.kind,
                    );
                    const connection =
                      connections.find((c) => c.provider === spec.id && c.status === "connected") ??
                      connections.find((c) => c.provider === spec.id);

                    return (
                      <div
                        key={`${product.id}:${spec.id}:${rt.kind}`}
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
                                {rt.label}: {binding.resource_label ?? binding.resource_id} ·
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
                                {rt.label}: {binding.resource_label ?? binding.resource_id} · via{" "}
                                {binding.account_label ?? spec.label}
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
                            <ProductBindingPicker
                              connectionId={connection.id}
                              productId={product.id}
                              resourceKind={rt.kind}
                              kindLabel={rt.label}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Connect {spec.label} in{" "}
                              <a
                                href="/settings?section=connections"
                                className="underline underline-offset-2 hover:text-foreground"
                              >
                                Settings
                              </a>{" "}
                              first
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }),
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
