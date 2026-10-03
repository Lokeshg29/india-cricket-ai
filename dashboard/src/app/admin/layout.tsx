import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "INDIA CRICKET AI Admin — read-only platform status",
  description: "Read-only internal view: system health, data quality, model status, training, drift and prediction status per cricket format.",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
