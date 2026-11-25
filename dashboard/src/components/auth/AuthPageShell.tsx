import Link from "next/link";
import Nav from "@/components/Nav";
import AuthForm from "./AuthForm";

export default function AuthPageShell({ mode, initialNotice }: { mode: "sign-in" | "create-account"; initialNotice?: string }) {
  return (
    <main className="auth-page flex min-h-screen flex-col">
      <Nav compact />
      <section className="auth-shell relative isolate flex flex-1 items-center justify-center overflow-hidden px-4 py-10 sm:py-14">
        <div className="auth-grid absolute inset-0" aria-hidden="true" />
        <div className="auth-glow auth-glow--blue absolute" aria-hidden="true" />
        <div className="auth-glow auth-glow--red absolute" aria-hidden="true" />
        <div className="relative z-10 flex w-full flex-col items-center">
          <AuthForm mode={mode} initialNotice={initialNotice} />
          <Link href="/" className="mt-6 inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-sm text-secondary transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <span aria-hidden="true">←</span> Back to dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
