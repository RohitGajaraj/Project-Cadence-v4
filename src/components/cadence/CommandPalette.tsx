import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Command } from "cmdk";
import {
  Home,
  Bot,
  ListTodo,
  MessageSquare,
  Settings,
  Sparkles,
  Search,
  Telescope,
  BookOpen,
  GraduationCap,
  ShieldAlert,
  Activity,
} from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (to: string) => {
    setOpen(false);
    navigate({ to });
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[80] grid place-items-start pt-[14vh] bg-background/70 backdrop-blur-md animate-in fade-in"
          onClick={() => setOpen(false)}
        >
          <Command
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-2xl border hairline bg-card/95 backdrop-blur-2xl shadow-2xl overflow-hidden"
            label="Command palette"
          >
            <div className="flex items-center gap-2 px-4 border-b hairline">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <Command.Input
                autoFocus
                placeholder="Search Cadence — navigate, ask AI, run agents…"
                className="flex-1 bg-transparent py-3.5 text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="text-[10px] text-muted-foreground border hairline rounded px-1.5 py-0.5">
                ESC
              </kbd>
            </div>
            <Command.List className="max-h-[360px] overflow-y-auto p-2 scrollbar-thin">
              <Command.Empty className="px-3 py-6 text-center text-xs text-muted-foreground">
                No matches. Try "today", "tasks", "chat"…
              </Command.Empty>
              <Command.Group
                heading="Navigate"
                className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground px-2 py-1.5"
              >
                <Item
                  icon={Home}
                  label="Today · Mission Control"
                  hint="G D"
                  onSelect={() => go("/")}
                />
                <Item icon={MessageSquare} label="Chat" hint="G C" onSelect={() => go("/chat")} />
                <Item icon={Bot} label="Agents" hint="G A" onSelect={() => go("/agents")} />
                <Item
                  icon={Telescope}
                  label="Product · signals, opportunities, specs"
                  hint="G I"
                  onSelect={() => go("/product")}
                />
                <Item
                  icon={BookOpen}
                  label="Knowledge · memory, decisions, docs, calendar"
                  hint="G M"
                  onSelect={() => go("/knowledge")}
                />
                <Item
                  icon={GraduationCap}
                  label="Learn · outcomes, support, learnings"
                  onSelect={() => go("/learn")}
                />
                <Item
                  icon={ListTodo}
                  label="Tasks"
                  hint="G T"
                  onSelect={() => go("/product", )}
                />
                <Item
                  icon={Activity}
                  label="Missions · live swarm, agents, missions"
                  onSelect={() => go("/missions")}
                />
                <Item
                  icon={ShieldAlert}
                  label="Govern · controls, approvals, traces, drift"
                  onSelect={() => go("/govern")}
                />
                <Item
                  icon={Settings}
                  label="Settings & profile"
                  hint="G S"
                  onSelect={() => go("/settings")}
                />
              </Command.Group>
              <Command.Group
                heading="Quick actions"
                className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground px-2 py-1.5"
              >
                <Item icon={Sparkles} label="Ask AI anything…" onSelect={() => go("/chat")} />
              </Command.Group>
            </Command.List>
          </Command>
        </div>
      )}
    </>
  );
}

function Item({
  icon: Icon,
  label,
  hint,
  onSelect,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm cursor-pointer aria-selected:bg-secondary aria-selected:text-foreground text-muted-foreground"
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1">{label}</span>
      {hint && (
        <kbd className="text-[10px] text-muted-foreground border hairline rounded px-1.5 py-0.5">
          {hint}
        </kbd>
      )}
    </Command.Item>
  );
}

// Vim-style g-prefix shortcut handler — mount once at app root.
export function GotoShortcuts() {
  const navigate = useNavigate();
  useEffect(() => {
    let waiting = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable)
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!waiting && e.key.toLowerCase() === "g") {
        waiting = true;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => (waiting = false), 800);
        return;
      }
      if (waiting) {
        waiting = false;
        if (timer) clearTimeout(timer);
        const map: Record<string, string> = {
          d: "/",
          c: "/chat",
          a: "/agents",
          t: "/tasks",
          s: "/settings",
          p: "/product",
          k: "/knowledge",
          m: "/knowledge",
          l: "/learn",
          v: "/govern",
        };
        const to = map[e.key.toLowerCase()];
        if (to) {
          e.preventDefault();
          navigate({ to });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);
  return null;
}
