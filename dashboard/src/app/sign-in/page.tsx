import type { Metadata } from "next";
import AuthPageShell from "@/components/auth/AuthPageShell";

export const metadata: Metadata = {
  title: "Sign in | India Cricket AI",
  description: "Sign in screen for India Cricket AI.",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ auth?: string }> }) {
  const { auth } = await searchParams;
  const initialNotice = auth === "confirmation-failed"
    ? "Email confirmation could not be completed. Request a new confirmation email and try again."
    : undefined;
  return <AuthPageShell mode="sign-in" initialNotice={initialNotice} />;
}
