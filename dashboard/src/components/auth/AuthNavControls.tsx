"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

export default function AuthNavControls() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => Boolean(getSupabasePublicConfig()));
  const [signOutError, setSignOutError] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active) {
        setEmail(data.user?.email ?? null);
        setLoading(false);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setEmail(session?.user.email ?? null);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    const supabase = createClient();
    if (!supabase) return;
    setSigningOut(true);
    setSignOutError("");
    const { error } = await supabase.auth.signOut();
    setSigningOut(false);
    if (error) {
      setSignOutError("We could not sign you out. Please try again.");
      return;
    }
    setEmail(null);
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.12em]">
      {loading ? (
        <span className="text-secondary" aria-label="Checking sign-in status">Account…</span>
      ) : email ? (
        <>
          <Link href="/account" className="nav-link max-w-36 truncate text-secondary transition-colors hover:text-foreground" title={email}>
            Account
          </Link>
          <button type="button" onClick={signOut} disabled={signingOut} className="nav-link text-secondary transition-colors hover:text-foreground disabled:opacity-60">
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </>
      ) : (
        <>
          <Link href="/sign-in" className="nav-link text-secondary transition-colors hover:text-foreground">Sign in</Link>
          <Link href="/create-account" className="nav-link rounded border border-card-border px-2.5 py-1 text-foreground/80 transition-colors hover:border-accent-red/60 hover:text-foreground">Create account</Link>
        </>
      )}
      {signOutError && <span role="status" className="text-[10px] normal-case tracking-normal text-accent-red">{signOutError}</span>}
    </div>
  );
}
