import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { listBindableResources, upsertBinding } from "@/lib/connections.functions";

/**
 * Combobox that binds one provider resource (repo, team, database, …) to the
 * current workspace. Opens → searches the connection's bindable resources
 * (300ms debounce, server-side filter) → pick → upsertBinding → toast.
 */
export function BindingPicker({
  connectionId,
  resourceKind,
  kindLabel,
}: {
  connectionId: string;
  resourceKind: string;
  kindLabel: string;
}) {
  const qc = useQueryClient();
  const fList = useServerFn(listBindableResources);
  const fUpsert = useServerFn(upsertBinding);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const q = useQuery({
    queryKey: ["bindable-resources", connectionId, resourceKind, debounced],
    queryFn: () =>
      fList({
        data: { connectionId, resourceKind, q: debounced.trim() || undefined },
      }),
    enabled: open,
  });
  const items = (q.data?.items ?? []) as { id: string; label: string }[];

  const mBind = useMutation({
    mutationFn: (item: { id: string; label: string }) =>
      fUpsert({
        data: { connectionId, resourceKind, resourceId: item.id, resourceLabel: item.label },
      }),
    onSuccess: (_d, item) => {
      toast.success(`Bound ${resourceKind} ${item.label} to this workspace`);
      setOpen(false);
      setQuery("");
      qc.invalidateQueries({ queryKey: ["workspace-bindings"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Binding failed"),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border hairline px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {mBind.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ChevronsUpDown className="h-3 w-3" />
          )}
          Bind a {kindLabel.toLowerCase()}…
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={`Search ${kindLabel.toLowerCase()}s…`}
          />
          <CommandList>
            {q.isFetching && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading…
              </div>
            )}
            {q.isError && (
              <div className="px-3 py-2 text-xs text-amber-400">
                {q.error instanceof Error ? q.error.message : "Could not list resources"}
              </div>
            )}
            {!q.isFetching && !q.isError && (
              <CommandEmpty>No {kindLabel.toLowerCase()}s found.</CommandEmpty>
            )}
            <CommandGroup>
              {items.map((it) => (
                <CommandItem
                  key={it.id}
                  value={it.id}
                  disabled={mBind.isPending}
                  onSelect={() => mBind.mutate(it)}
                >
                  {it.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
