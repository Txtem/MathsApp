import { type OutcomeSlice, pieSegments } from "@/components/outcome-chart";
import type { Outcome } from "@/lib/selection/outcome";

/**
 * Kreisdiagramm der vier Ausgänge, handgeschriebenes SVG ohne Bibliothek
 * (SPEC.md Abschnitt 10a). Die Geometrie rechnet `pieSegments`, die Zahlen
 * `summarizeOutcomes` — hier wird nur gezeichnet.
 *
 * Beide Richtig-Varianten sind grün, in zwei Abstufungen: Für die Anzeige ist
 * richtig richtig, die Unterscheidung bleibt trotzdem sichtbar (`IDEEN.md`).
 * Die Tipps stehen außerhalb des Kreises, je Ausgang.
 */

const FILL: Readonly<Record<Outcome, string>> = {
  right_first: "fill-emerald-600",
  right_second: "fill-emerald-300",
  wrong: "fill-red-500",
  gave_up: "fill-zinc-400",
};

const SWATCH: Readonly<Record<Outcome, string>> = {
  right_first: "bg-emerald-600",
  right_second: "bg-emerald-300",
  wrong: "bg-red-500",
  gave_up: "bg-zinc-400",
};

const RADIUS = 60;

export function OutcomeChart({ slices }: { slices: readonly OutcomeSlice[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  if (total === 0) return null;

  const segments = pieSegments(
    slices.map((slice) => ({ key: slice.outcome, value: slice.count })),
    RADIUS,
  );

  return (
    <section className="flex flex-wrap items-center gap-8 rounded-xl border border-zinc-200 bg-white px-5 py-5 dark:border-zinc-800 dark:bg-zinc-900">
      <svg
        viewBox={`0 0 ${2 * RADIUS} ${2 * RADIUS}`}
        className="h-32 w-32 shrink-0"
        role="img"
        aria-label="Ausgänge aller Aufgaben"
      >
        {segments.map((segment) => (
          <path
            key={segment.key}
            d={segment.d}
            className={`${FILL[segment.key as Outcome]} stroke-white dark:stroke-zinc-900`}
            strokeWidth={1}
          />
        ))}
      </svg>

      <ul className="flex flex-col gap-2 text-sm">
        {slices.map((slice) => (
          <li key={slice.outcome} className="flex items-baseline gap-3">
            <span className={`inline-block h-3 w-3 shrink-0 rounded-sm ${SWATCH[slice.outcome]}`} />
            <span className="w-40 text-zinc-900 dark:text-zinc-50">{slice.label}</span>
            <span className="w-20 text-zinc-500 tabular-nums">
              {slice.count} · {Math.round(slice.share * 100)} %
            </span>
            <span className="text-zinc-500">{hintNote(slice)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Die Tipps je Ausgang — eine zweite Dimension, keine fünfte Kategorie. */
function hintNote(slice: OutcomeSlice): string {
  if (slice.count === 0) return "";
  if (slice.withHints === 0) return "ohne Tipp";
  const tipps = slice.hintsUsed === 1 ? "1 Tipp" : `${slice.hintsUsed} Tipps`;
  return `${tipps} bei ${slice.withHints} von ${slice.count}`;
}
