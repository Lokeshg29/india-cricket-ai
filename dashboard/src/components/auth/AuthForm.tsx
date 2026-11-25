"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

type Mode = "sign-in" | "create-account";
type FieldName = "email" | "password";
type FormNotice = { type: "error" | "success"; text: string } | null;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readableAuthError(code?: string, message?: string) {
  if (code === "email_not_confirmed") return "Confirm your email address before signing in.";
  if (code === "weak_password") return "Choose a stronger password and try again.";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") {
    return "Too many attempts. Wait a little and try again.";
  }
  if (message?.toLowerCase().includes("invalid login credentials")) {
    return "The email or password is incorrect.";
  }
  if (message?.toLowerCase().includes("password should be at least")) {
    return "Your password does not meet the minimum length requirement.";
  }
  return "Authentication could not be completed. Check your details and try again.";
}

export default function AuthForm({ mode, initialNotice }: { mode: Mode; initialNotice?: string }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [notice, setNotice] = useState<FormNotice>(initialNotice ? { type: "error", text: initialNotice } : null);
  const [submitting, setSubmitting] = useState(false);
  const configured = Boolean(getSupabasePublicConfig());
  const isSignIn = mode === "sign-in";

  function clearFieldError(field: FieldName) {
    setErrors((current) => ({ ...current, [field]: undefined }));
    setNotice(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const nextErrors: Partial<Record<FieldName, string>> = {};

    if (!email) nextErrors.email = "Enter your email address.";
    else if (!EMAIL_PATTERN.test(email)) nextErrors.email = "Enter a valid email address.";
    if (!password) nextErrors.password = "Enter your password.";
    setErrors(nextErrors);
    setNotice(null);
    if (Object.keys(nextErrors).length > 0) return;

    const supabase = createClient();
    if (!supabase) {
      setNotice({ type: "error", text: "Authentication is not configured. Add NEXT_PUBLIC_SUPABASE_URL and a public Supabase key to dashboard/.env.local, then restart the dashboard." });
      return;
    }

    setSubmitting(true);
    try {
      if (isSignIn) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setNotice({ type: "error", text: readableAuthError(error.code, error.message) });
          return;
        }
        setNotice({ type: "success", text: "Signed in successfully. Opening your account…" });
        router.replace("/account");
        router.refresh();
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/account`,
        },
      });
      if (error) {
        setNotice({ type: "error", text: readableAuthError(error.code, error.message) });
        return;
      }
      if (data.session) {
        setNotice({ type: "success", text: "Account created. Opening your account…" });
        router.replace("/account");
        router.refresh();
      } else {
        setNotice({ type: "success", text: "Account request received. Check your email for a confirmation link before signing in." });
      }
    } catch {
      setNotice({ type: "error", text: "The authentication service could not be reached. Check your connection and try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-card w-full max-w-[440px] rounded-2xl border border-card-border p-6 shadow-xl sm:p-8">
      <div className="mb-7">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">India · International Cricket</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {isSignIn ? "Sign in" : "Create account"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-secondary">
          {isSignIn ? "Access your India Cricket AI account." : "Create an account for India Cricket AI."}
        </p>
      </div>

      {!configured && (
        <p role="status" className="mb-5 rounded-lg border border-saffron/30 bg-saffron/5 px-3 py-2.5 text-xs leading-relaxed text-foreground">
          Authentication needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) in dashboard/.env.local.
        </p>
      )}

      <form noValidate onSubmit={handleSubmit} className="space-y-5" aria-busy={submitting}>
        <div>
          <label htmlFor={`${mode}-email`} className="mb-2 block text-sm font-medium text-foreground">
            Email address <span className="text-accent-red" aria-hidden="true">*</span>
          </label>
          <input
            id={`${mode}-email`} name="email" type="email" autoComplete="email" inputMode="email" required aria-required="true"
            aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? `${mode}-email-error` : undefined}
            onChange={() => clearFieldError("email")}
            className="auth-input w-full rounded-lg border border-card-border bg-background px-3.5 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
            placeholder="you@example.com"
          />
          {errors.email && <p id={`${mode}-email-error`} className="mt-2 text-xs text-accent-red" role="alert">{errors.email}</p>}
        </div>

        <div>
          <label htmlFor={`${mode}-password`} className="mb-2 block text-sm font-medium text-foreground">
            Password <span className="text-accent-red" aria-hidden="true">*</span>
          </label>
          <div className="relative">
            <input
              id={`${mode}-password`} name="password" type={showPassword ? "text" : "password"}
              autoComplete={isSignIn ? "current-password" : "new-password"} required aria-required="true"
              aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? `${mode}-password-error` : undefined}
              onChange={() => clearFieldError("password")}
              className="auth-input w-full rounded-lg border border-card-border bg-background px-3.5 py-3 pr-16 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
              placeholder="Enter your password"
            />
            <button type="button" onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 rounded-r-lg px-3 text-xs font-medium text-secondary transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {errors.password && <p id={`${mode}-password-error`} className="mt-2 text-xs text-accent-red" role="alert">{errors.password}</p>}
        </div>

        <button type="submit" disabled={submitting || !configured}
          className="auth-submit min-h-11 w-full rounded-lg bg-accent px-4 py-3 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-background shadow-sm transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? "Please wait…" : isSignIn ? "Sign in" : "Create account"}
        </button>

        {notice && <p role={notice.type === "error" ? "alert" : "status"} aria-live="polite" className={`rounded-lg border px-3 py-2.5 text-xs leading-relaxed ${notice.type === "error" ? "border-accent-red/25 bg-accent-red/5 text-accent-red" : "border-accent/25 bg-accent/5 text-foreground"}`}>{notice.text}</p>}
      </form>

      <p className="mt-5 text-xs leading-relaxed text-secondary">
        Your password is sent directly to Supabase Auth over HTTPS. This site does not save your password in browser storage.
      </p>

      <div className="mt-6 border-t border-card-border pt-5 text-center text-sm text-secondary">
        {isSignIn ? (
          <>New to India Cricket AI?{" "}<Link href="/create-account" className="font-semibold text-accent transition-colors hover:text-accent-hover">Create account</Link></>
        ) : (
          <>Already have an account?{" "}<Link href="/sign-in" className="font-semibold text-accent transition-colors hover:text-accent-hover">Sign in</Link></>
        )}
      </div>
    </div>
  );
}
