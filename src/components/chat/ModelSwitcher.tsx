import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, KeyRound, Sparkles } from "lucide-react";
import { MODELS, AUTO_MODEL, modelsByProvider, type Model } from "@/lib/ai/models";
import { listApiKeys } from "@/lib/byokeys.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Friendly provider header label; falls back to a title-cased id for any provider. */
function providerLabel(provider: string): string {
  const known: Record<string, string> = {
    google: "Google",
    openai: "OpenAI",
    anthropic: "Anthropic",
    deepseek: "DeepSeek",
    xai: "xAI",
    moonshot: "Moonshot",
    qwen: "Qwen",
    minimax: "MiniMax",
    mistral: "Mistral",
    groq: "Groq",
    openrouter: "OpenRouter",
    together: "Together",
    ollama: "Ollama",
  };
  return known[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1);
}

/**
 * ChatGPT-style compact model picker, now open-ended + capability-aware.
 *   - "Auto" routes each message to the model best at the task (capability routing).
 *   - The full catalog is listed grouped by provider; a built-in (gateway-live) model is
 *     always selectable; an adapter-ready model lights up when you hold a key for its provider.
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

  const groups = modelsByProvider(MODELS);
  const current = MODELS.find((m) => m.id === value);
  const label = value === AUTO_MODEL ? "Auto" : (current?.label ?? value);

  function select(id: string) {
    onChange(id);
    setOpen(false);
  }

  const ready = (m: Model) => m.live || keyProviders.has(m.provider);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Switch model"
          className="mono-label inline-flex max-w-[220px] items-center gap-1 text-ink-faint transition hover:text-ink-muted"
          style={{ fontSize: 9.5, padding: "6px 4px" }}
        >
          <span className="truncate normal-case tracking-normal">{label}</span>
          <ChevronDown size={11} className="shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" sideOffset={8} className="w-80 p-1.5">
        <div className="max-h-96 overflow-y-auto scrollbar-thin">
          {/* Auto / capability routing — the recommended default. */}
          <button
            type="button"
            onClick={() => select(AUTO_MODEL)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-secondary/60"
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="text-xs text-foreground">Auto</div>
              <div className="truncate text-[10px] text-muted-foreground">
                Best model per task, optimized automatically.
              </div>
            </div>
            {value === AUTO_MODEL && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
          </button>

          {groups.map(({ provider, models }) => (
            <div key={provider}>
              <div className="mt-1 border-t hairline px-2 pb-1 pt-2 text-[10px] uppercase tracking-wider text-muted-foreground/60">
                {providerLabel(provider)}
              </div>
              {models.map((m) => {
                if (ready(m)) {
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
                          {!m.live && (
                            <span title="Uses your API key" className="inline-flex">
                              <KeyRound className="h-2.5 w-2.5 text-muted-foreground/70" />
                            </span>
                          )}
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
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
