import type { Metadata } from "next";
import Script from "next/script";
import "flag-icons/css/flag-icons.min.css";
import "./globals.css";

const themeInitialization = `try {
  const storedTheme = window.localStorage.getItem("india-cricket-theme");
  document.documentElement.dataset.theme = storedTheme === "dark" ? "dark" : "light";
} catch {
  document.documentElement.dataset.theme = "light";
}`;

export const metadata: Metadata = {
  title: "INDIA CRICKET ANALYTICS",
  description:
    "Match analytics and model estimates for the Indian men’s cricket team across Test, ODI and T20I. Data provenance is labelled as demo, historical, or live.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <Script id="india-cricket-theme-init" strategy="beforeInteractive">
          {themeInitialization}
        </Script>
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
