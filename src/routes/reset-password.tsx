import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Loader2, Eye, EyeOff, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DotPattern } from "@/components/ui/dot-pattern";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reset-password")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "New password · Cadence" }] }),
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [validHash, setValidHash] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    const hasRecovery = hash.includes("type=recovery") || hash.includes("access_token=");
    setValidHash(hasRecovery);
  }, []);

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    setDone(true);
    toast.success("Password updated");
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
          <h1 className="font-display text-2xl tracking-tight">Choose a new password</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Make it strong — you’ll use it to sign in to Cadence.
          </p>
        </div>

        {done ? (
          <div className="text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              Your password has been updated.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Sign in
            </Link>
          </div>
        ) : !validHash ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              This reset link is invalid or has expired.
            </p>
            <Link
              to="/forgot-password"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Request a new link
            </Link>
          </div>
        ) : (
          <form onSubmit={updatePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs">New password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-xs">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Retype your password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
