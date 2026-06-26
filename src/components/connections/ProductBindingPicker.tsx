// BYO-P1b: Combobox for picking a bindable resource and attaching it to a
// specific product. Mirrors BindingPicker but calls upsertProductBinding.

import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown, Loader2 } from "lucide-react";
import { toast } from "@/lib/notify";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { listBindableResources } from "@/lib/connections.functions";
import { upsertProductBinding } from "@/lib/connectors/product-binding.functions";

export function ProductBindingPicker({
  connectionId,
  productId,
  resourceKind,
  kindLabel,
}: {
  connectionId: string;
  productId: string;
  resourceKind: string;
  kindLabel: string;
}) {
  const qc = useQueryClient();
  const fList = useServerFn(listBindableResources);
  const fUpsert = useServerFn(upsertProductBinding);

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
        data: {
          connectionId,
          productId,
          resourceKind,
          resourceId: item.id,
          resourceLabel: item.label,
        },
      }),
    onSuccess: (_d, item) => {
      toast.success(`Bound ${kindLabel.toLowerCase()} ${item.label} to this product`);
      setOpen(false);
      setQuery("");
      qc.invalidateQueries({ queryKey: ["product-bindings"] });
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
          Bind a {kindLabel.toLowerCase()}...
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={`Search ${kindLabel.toLowerCase()}s...`}
          />
          <CommandList>
            {q.isFetching && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading...
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
