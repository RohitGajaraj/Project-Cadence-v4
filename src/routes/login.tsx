import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DotPattern } from "@/components/ui/dot-pattern";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign in · Cadence" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  async function signInEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoadingEmail(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoadingEmail(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    navigate({ to: "/" });
  }

  async function signInGoogle() {
    setLoadingGoogle(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      setLoadingGoogle(false);
      return toast.error(result.error.message ?? "Google sign-in failed");
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-40 animate-aurora">
        <div className="absolute inset-0 neural-gradient" />
      </div>
      <DotPattern
        className={cn(
          "-z-10 opacity-40",
          "[mask-image:radial-gradient(ellipse_at_center,white,transparent_75%)]",
        )}
      />
      <div className="w-full max-w-md p-8 rounded-2xl border hairline bg-card/70 backdrop-blur-xl space-y-6">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 rounded-xl overflow-hidden ring-glow-violet relative">
            <div className="absolute inset-0 neural-gradient" />
          </div>
          <h1 className="mt-4 font-display text-2xl tracking-tight">Welcome to Cadence</h1>
          <p className="text-xs text-muted-foreground mt-1">The AI-native product operating system</p>
        </div>

        <Button type="button" variant="outline" className="w-full" onClick={signInGoogle} disabled={loadingGoogle}>
          {loadingGoogle ? <Loader2 className="h-4 w-4 animate-spin" /> : <><GoogleIcon /> Continue with Google</>}
        </Button>

        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <div className="flex-1 h-px bg-border" /> or email <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={signInEmail} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs">Password</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <Button type="submit" className="w-full" disabled={loadingEmail}>
            {loadingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4 mr-1.5" /> Sign in</>}
          </Button>
        </form>

        <div className="text-xs text-center text-muted-foreground">
          New here? <Link to="/signup" className="text-foreground underline-offset-4 hover:underline">Create an account</Link>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4.2-5.5 4.2-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.3 14.7 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"/>
    </svg>
  );
}