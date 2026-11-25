import type { Metadata } from "next";
import AuthPageShell from "@/components/auth/AuthPageShell";

export const metadata: Metadata = {
  title: "Create account | India Cricket AI",
  description: "Create account screen for India Cricket AI.",
};

export default function CreateAccountPage() {
  return <AuthPageShell mode="create-account" />;
}
