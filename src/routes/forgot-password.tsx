import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DotPattern } from "@/components/ui/dot-pattern";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/forgot-password")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  component: ForgotPasswordPage,
  head: () => ({ meta: [{ title: "Reset password · Cadence" }] }),
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function sendResetLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success("Check your email for the reset link");
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
          <h1 className="font-display text-2xl tracking-tight">Reset your password</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Enter your email and we’ll send you a link to choose a new password.
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              If an account exists for <strong className="text-foreground">{email}</strong>, you’ll
              receive a reset link shortly.
            </p>
            <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
              Send again
            </Button>
          </div>
        ) : (
          <form onSubmit={sendResetLink} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
            </Button>
          </form>
        )}

        <div className="text-xs text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
