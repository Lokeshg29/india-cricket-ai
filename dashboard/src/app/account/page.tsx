import Link from "next/link";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await createClient();
  if (!supabase) {
    return (
      <main className="min-h-screen">
        <Nav compact />
        <section className="mx-auto max-w-xl px-4 py-16 text-center">
          <h1 className="text-3xl font-semibold text-foreground">Account unavailable</h1>
          <p className="mt-3 text-sm text-secondary">Configure the public Supabase URL and anon or publishable key to use account access.</p>
          <Link href="/" className="mt-6 inline-flex text-sm text-accent hover:underline">Back to dashboard</Link>
        </section>
      </main>
    );
  }

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/sign-in");

  return (
    <main className="min-h-screen">
      <Nav compact />
      <section className="mx-auto max-w-2xl px-4 py-14 sm:py-20">
        <div className="auth-card rounded-2xl border border-card-border p-6 shadow-xl sm:p-9">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">India · International Cricket</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">Your account</h1>
          <p className="mt-3 text-sm leading-relaxed text-secondary">You are signed in as <span className="font-medium text-foreground">{user.email}</span>.</p>
          <p className="mt-5 text-xs leading-relaxed text-secondary">Match browsing remains available to everyone. Signing in does not change prediction or history data access.</p>
          <Link href="/" className="mt-7 inline-flex min-h-10 items-center rounded-lg border border-card-border px-4 text-sm text-foreground transition-colors hover:border-accent">Back to dashboard</Link>
        </div>
      </section>
    </main>
  );
}
