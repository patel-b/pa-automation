import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PA Automation Center",
  description:
    "Demo MVP: extract patient + insurance details and auto-fill prior authorization forms for human review.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-gray-200 bg-white">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
              <a href="/" className="flex items-baseline gap-1.5 text-2xl font-extrabold tracking-tight">
                <span className="text-[#f47a3e]">pa</span>
                <span className="text-[#e0006d]">automation center</span>
              </a>
              <div className="flex items-center gap-5 text-xs font-medium text-gray-500">
                <span className="hidden sm:inline">Help</span>
                <span className="hidden sm:inline">Privacy &amp; Terms</span>
                <span className="rounded-full bg-[#fdeef5] px-3 py-1 font-semibold text-[#a1004f]">
                  Demo · Synthetic data only
                </span>
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
