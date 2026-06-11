import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, KeyRound } from "lucide-react";
import { MODELS } from "@/lib/ai/models";
import { listApiKeys } from "@/lib/byokeys.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * ChatGPT-style compact model picker. Built-in models route via the gateway;
 * BYO models light up when the user has a key for that provider.
 */
export function ModelSwitcher({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const fKeys = useServerFn(listApiKeys);
  const keys = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => fKeys(),
    staleTime: 60_000,
    retry: false,
  });
  const keyProviders = new Set((keys.data?.keys ?? []).map((k) => k.provider));

  const builtIn = MODELS.filter((m) => m.live);
  const byo = MODELS.filter((m) => !m.live);
  const current = MODELS.find((m) => m.id === value);

  function select(id: string) {
    onChange(id);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Switch model"
          className="inline-flex max-w-[220px] items-center gap-1.5 rounded-lg border hairline bg-background/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors duration-150 hover:bg-secondary/60 hover:text-foreground"
        >
          <span className="truncate">{current?.label ?? value}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" sideOffset={8} className="w-80 p-1.5">
        <div className="max-h-80 overflow-y-auto scrollbar-thin">
          <div className="px-2 pb-1 pt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/60">
            Built-in
          </div>
          {builtIn.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => select(m.id)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-secondary/60"
            >
              <div className="min-w-0 flex-1">
                <div className="text-xs text-foreground">{m.label}</div>
                <div className="truncate text-[10px] text-muted-foreground">{m.desc}</div>
              </div>
              {value === m.id && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
            </button>
          ))}

          <div className="mt-1 border-t hairline px-2 pb-1 pt-2 text-[10px] uppercase tracking-wider text-muted-foreground/60">
            Your keys
          </div>
          {byo.map((m) => {
            const hasKey = keyProviders.has(m.provider);
            if (hasKey) {
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => select(m.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-secondary/60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs text-foreground">
                      {m.label}
                      <span title="Uses your API key" className="inline-flex">
                        <KeyRound className="h-2.5 w-2.5 text-muted-foreground/70" />
                      </span>
                    </div>
                    <div className="truncate text-[10px] text-muted-foreground">{m.desc}</div>
                  </div>
                  {value === m.id && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              );
            }
            return (
              <div
                key={m.id}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left"
              >
                <div className="min-w-0 flex-1 opacity-50">
                  <div className="text-xs text-foreground">{m.label}</div>
                  <div className="truncate text-[10px] text-muted-foreground">{m.desc}</div>
                </div>
                <Link
                  to="/settings"
                  search={{ section: "ai" }}
                  onClick={() => setOpen(false)}
                  className="shrink-0 rounded-md border hairline px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors duration-150 hover:bg-secondary/60 hover:text-foreground"
                >
                  Add key
                </Link>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
