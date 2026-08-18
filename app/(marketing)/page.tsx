import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center gap-6 px-6 py-24">
      <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Mathe üben, so oft du willst
      </h1>
      <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
        Jede Aufgabe entsteht neu aus einer Vorlage mit zufälligen Zahlen. Die Lösung wird
        berechnet, nicht geraten — und sie bleibt so lange auf dem Server, bis du geantwortet
        hast.
      </p>
      <div>
        <Link
          href="/practice"
          className="inline-flex rounded-lg bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Üben starten
        </Link>
      </div>
      <p className="text-sm text-zinc-500">
        Aktueller Stand: M0 — Addition und Subtraktion. Kombinatorik folgt in M1.
      </p>
    </div>
  );
}
