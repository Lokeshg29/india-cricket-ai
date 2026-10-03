import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "INDIA CRICKET ANALYTICS — Admin",
  description:
    "Read-only internal view: system health, data quality, model status, training, drift and prediction status per cricket format.",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
