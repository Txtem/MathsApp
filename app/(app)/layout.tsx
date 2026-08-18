import Link from "next/link";
import type { ReactNode } from "react";

/** Rahmen für alles hinter der Landingpage. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            MathsApp
          </Link>
          <Link
            href="/practice"
            className="text-sm text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
          >
            Themenauswahl
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
