/**
 * BYO-P1c — Managed repo creation modal.
 *
 * Creates a GitHub repo in the user's own account (or an explicit org) using
 * their existing GitHub connection. Repo lands in the user's personal namespace
 * by default — never in a Cadence-owned org (BYO means it's theirs).
 *
 * On success, the repo is auto-bound as a product-level binding for the current
 * product, and an onSuccess callback fires so the parent can refresh bindings.
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Github, Lock, Unlock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/notify";
import { createRepoForProduct } from "@/lib/connectors/product-binding.functions";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId?: string;
  workspaceId?: string;
  productName?: string;
  onSuccess?: (owner: string, repo: string) => void;
};

export function CreateRepoModal({
  open,
  onOpenChange,
  productId,
  workspaceId,
  productName,
  onSuccess,
}: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState(() => slugify(productName ?? "my-product"));
  const [org, setOrg] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);

  const fCreate = useServerFn(createRepoForProduct);

  const mutation = useMutation({
    mutationFn: () =>
      fCreate({
        data: {
          name,
          isPrivate,
          org: org.trim() || undefined,
          description: description.trim() || undefined,
          productId,
          workspaceId,
        },
      }),
    onSuccess: (res) => {
      toast.success(`Repo ${res.repo.owner}/${res.repo.repo} created`);
      qc.invalidateQueries({ queryKey: ["product-bindings"] });
      onOpenChange(false);
      onSuccess?.(res.repo.owner, res.repo.repo);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Repo creation failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="h-4 w-4" />
            Create a GitHub repo
          </DialogTitle>
          <DialogDescription>
            Creates a new repo in your GitHub account and binds it to this product automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label htmlFor="repo-name" className="text-xs font-medium">
              Repo name
            </Label>
            <Input
              id="repo-name"
              value={name}
              onChange={(e) => setName(slugify(e.target.value))}
              placeholder="my-product"
              className="mt-1 font-mono text-sm"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Letters, numbers, hyphens, dots, and underscores only.
            </p>
          </div>

          <div>
            <Label htmlFor="repo-org" className="text-xs font-medium">
              Organization{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="repo-org"
              value={org}
              onChange={(e) => setOrg(e.target.value)}
              placeholder="your-org"
              className="mt-1 font-mono text-sm"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Leave blank to create in your personal account.
            </p>
          </div>

          <div>
            <Label htmlFor="repo-desc" className="text-xs font-medium">
              Description{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="repo-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description"
              className="mt-1 text-sm"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsPrivate((p) => !p)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full text-left"
          >
            {isPrivate ? (
              <Lock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            ) : (
              <Unlock className="h-3.5 w-3.5 shrink-0" />
            )}
            {isPrivate ? "Private repo" : "Public repo"}
            <span className="text-[11px] ml-auto text-muted-foreground/50">click to toggle</span>
          </button>
        </div>

        <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-border/40">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => mutation.mutate()}
            disabled={!name || mutation.isPending}
          >
            {mutation.isPending ? "Creating..." : "Create repo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
