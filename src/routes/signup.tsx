import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DotPattern } from "@/components/ui/dot-pattern";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/signup")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  component: SignupPage,
  head: () => ({ meta: [{ title: "Create account · Cadence" }] }),
});

function SignupPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("AI Product Manager");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  async function signup(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName.trim(), display_name: fullName.trim().split(" ")[0], role },
      },
    });
    if (error) { setLoading(false); return toast.error(error.message); }
    // Auto-confirm is on; session should be present. Upsert profile.
    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        full_name: fullName.trim(),
        display_name: fullName.trim().split(" ")[0],
        role,
        onboarded: true,
      });
    }
    setLoading(false);
    toast.success("Account created");
    navigate({ to: "/" });
  }

  async function signupGoogle() {
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
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground relative overflow-hidden p-4">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-40 animate-aurora">
        <div className="absolute inset-0 neural-gradient" />
      </div>
      <DotPattern
        className={cn(
          "-z-10 opacity-40",
          "[mask-image:radial-gradient(ellipse_at_center,white,transparent_75%)]",
        )}
      />
      <div className="w-full max-w-md p-8 rounded-2xl border hairline bg-card/70 backdrop-blur-xl space-y-5">
        <div className="text-center">
          <h1 className="font-display text-2xl tracking-tight">Create your workspace</h1>
          <p className="text-xs text-muted-foreground mt-1">Cadence is built for AI Product Managers.</p>
        </div>

        <Button type="button" variant="outline" className="w-full" onClick={signupGoogle} disabled={loadingGoogle}>
          {loadingGoogle ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continue with Google</>}
        </Button>

        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <div className="flex-1 h-px bg-border" /> or <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={signup} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs">Full name</Label>
            <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ada Lovelace" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role" className="text-xs">Role</Label>
            <Input id="role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="AI Product Manager" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs">Password</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4 mr-1.5" /> Create account</>}
          </Button>
        </form>

        <div className="text-xs text-center text-muted-foreground">
          Already have an account? <Link to="/login" className="text-foreground underline-offset-4 hover:underline">Sign in</Link>
        </div>
      </div>
    </div>
  );
}