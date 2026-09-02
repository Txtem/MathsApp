import Link from "next/link";

import { dueLabel } from "@/components/due-label";
import {
  type AnsweredDuration,
  SNAP_SHARE,
  type StatsGroup,
  type StatsRow,
  type StatsSummary,
  TIME_MIN_SAMPLES,
  toStatsGroups,
  toSummary,
} from "@/components/stats-rows";
import { toTopicGroups } from "@/components/topic-groups";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { getTemplate, getTopicOffers } from "@/lib/content/load";
import { prisma } from "@/lib/db/client";
import { loadAnsweredDurations, loadTopicTotals } from "@/lib/db/stats";
import { loadTopicStats } from "@/lib/db/topic-stats";

/**
 * Fortschritt pro Thema (SPEC.md Abschnitt 10a).
 *
 * Server Component: Die Seite liest bei jedem Aufruf frisch aus der Datenbank.
 * `force-dynamic`, damit Next.js sie nicht beim Build vorrendert und einen
 * Stand von damals ausliefert.
 *
 * Gerechnet wird nichts hier — die Umformung steht als reine Funktion in
 * `components/stats-rows.ts` und hat eigene Tests (D-16).
 *
 * Kein Diagramm: Ein Zeitverlauf über zwölf Versuche sieht nach Aussage aus,
 * wo keine ist.
 */
export const dynamic = "force-dynamic";

export default async function StatsPage() {
  // Eine Uhr für die ganze Seite: Fälligkeit und Termine werden gegen denselben
  // Zeitpunkt gerechnet (D-20).
  const now = new Date();
  const userId = await getCurrentUserId(now);

  const groups = toTopicGroups(getTopicOffers());
  const topics = groups.flatMap((group) => group.leaves.map((leaf) => leaf.topic));

  const [totals, recent, durations] = await Promise.all([
    loadTopicTotals(prisma, userId),
    loadTopicStats(prisma, userId, topics),
    loadAnsweredDurations(prisma, userId),
  ]);

  // Die Zielzeit steht im Template, nicht am Attempt. Fehlt das Template,
  // fällt die Aufgabe aus dem Zeitvergleich.
  const answered: AnsweredDuration[] = durations.map((entry) => {
    const target = getTemplate(entry.templateId)?.target_time_seconds;
    return {
      topic: entry.topic,
      durationMs: entry.durationMs,
      targetMs: target === undefined ? null : target * 1000,
      isCorrect: entry.isCorrect,
    };
  });

  const rows = toStatsGroups(
    groups,
    new Map(totals.map((entry) => [entry.topic, entry])),
    new Map(recent.map((entry) => [entry.topic, entry])),
    answered,
    now,
  );

  const summary = toSummary(totals, answered);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Dein Fortschritt
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Je Thema die Zahl der Versuche, die Quote insgesamt und die über die letzten zehn
          Aufgaben. Rechts steht, wann das Thema wieder ansteht — „fällig“ heißt: jetzt.
        </p>
      </div>

      <Summary summary={summary} />

      {rows.map((group) => (
        <Group key={group.topic} group={group} now={now} />
      ))}

      <p className="text-sm text-zinc-500">
        <Link href="/practice" className="underline underline-offset-4">
          Weiter üben
        </Link>
      </p>
    </div>
  );
}

function Summary({ summary }: { summary: StatsSummary }) {
  if (summary.attempts === 0) {
    return (
      <p className="rounded-xl border border-zinc-200 bg-white px-5 py-4 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        Noch keine beantworteten Aufgaben. Die Zahlen füllen sich, sobald du übst.
      </p>
    );
  }

  return (
    <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800">
      <Stat label="Versuche" value={String(summary.attempts)} />
      <Stat label="Quote insgesamt" value={formatRate(summary.overallRate)} />
      <Stat
        label="Medianzeit bei richtigen Antworten"
        value={formatRelative(summary.time.relative)}
        note={timeNote(summary.time)}
      />
    </dl>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1 bg-white px-5 py-4 dark:bg-zinc-900">
      <dt className="text-xs font-semibold uppercase tracking-widest text-zinc-500">{label}</dt>
      <dd className="text-lg text-zinc-900 tabular-nums dark:text-zinc-50">{value}</dd>
      {note ? <dd className="text-xs text-zinc-500">{note}</dd> : null}
    </div>
  );
}

function Group({ group, now }: { group: StatsGroup; now: Date }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="px-5 py-4 text-xs font-semibold uppercase tracking-widest text-zinc-500">
        {group.label}
      </h2>
      <ul className="border-t border-zinc-100 dark:border-zinc-800">
        {group.rows.map((row) => (
          <li
            key={row.topic}
            className="flex items-baseline justify-between gap-4 border-t border-zinc-100 px-5 py-3 first:border-t-0 dark:border-zinc-800"
          >
            <span className="text-zinc-900 dark:text-zinc-50">{row.label}</span>
            <Numbers row={row} now={now} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Numbers({ row, now }: { row: StatsRow; now: Date }) {
  if (row.attempts === 0) {
    return <span className="shrink-0 text-sm text-zinc-500">noch nicht geübt</span>;
  }

  return (
    <span className="flex shrink-0 items-baseline gap-3 text-sm text-zinc-500 tabular-nums">
      <span>
        {row.attempts} {row.attempts === 1 ? "Versuch" : "Versuche"}
      </span>
      <span>{formatRate(row.overallRate)}</span>
      <span title="Quote über die letzten zehn beantworteten Aufgaben">
        zuletzt {formatRate(row.recentRate)}
      </span>
      <Snaps row={row} />
      <Due row={row} now={now} />
    </span>
  );
}

/**
 * Falsche Antworten, die sehr schnell kamen. Erscheint erst, wenn es mehrfach
 * vorkam; einmal ist Zufall (D-21).
 *
 * Beschriftet als „sehr schnell falsch", nicht als „geraten": Gemessen ist die
 * Zeit, nicht die Absicht. Wer ein Verfahren sicher, aber falsch anwendet, ist
 * genauso schnell wie jemand, der rät — die Zahl ist derselbe Hinweis, und die
 * Erklärung dafür gehört dem Übenden, nicht der Seite.
 */
function Snaps({ row }: { row: StatsRow }) {
  if (row.snapAnswers === null) return null;

  return (
    <span
      className="text-amber-700 dark:text-amber-500"
      title={`Falsche Antworten in weniger als ${Math.round(SNAP_SHARE * 100)} % der Zielzeit`}
    >
      {row.snapAnswers}× sehr schnell falsch
    </span>
  );
}

/**
 * Der Termin, relativ ausgesprochen (D-22). Die Worte kommen aus `dueLabel`;
 * hier steht nur, dass ein fälliges Thema hervorgehoben wird.
 */
function Due({ row, now }: { row: StatsRow; now: Date }) {
  const label = dueLabel(row.dueAt, now);

  if (row.isDue) {
    return <span className="font-medium text-zinc-900 dark:text-zinc-50">{label}</span>;
  }
  return <span>{label}</span>;
}

function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)} %`;
}

/**
 * „1,3× Zielzeit". Absolute Sekunden wären über Aufgabentypen hinweg nicht
 * vergleichbar (D-21).
 *
 * Von Hand formatiert statt über `Intl`: Das Ergebnis hängt sonst vom
 * Gebietsschema der Laufzeit ab — dieselbe Überlegung wie bei den Terminen
 * (D-22).
 */
function formatRelative(relative: number | null): string {
  if (relative === null) return "—";
  return `${(Math.round(relative * 10) / 10).toFixed(1).replace(".", ",")}× Zielzeit`;
}

/** Der Zusatz unter der Zahl: warum sie fehlt, oder was ausgelassen wurde. */
function timeNote(time: StatsSummary["time"]): string | undefined {
  if (time.relative === null) {
    return `erst ab ${TIME_MIN_SAMPLES} richtigen Antworten (bisher ${time.counted})`;
  }
  if (time.interrupted > 0) {
    return `${time.interrupted} unterbrochen, nicht gezählt`;
  }
  return undefined;
}
