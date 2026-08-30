import Link from "next/link";

import {
  type AnsweredDuration,
  type StatsGroup,
  type StatsRow,
  type StatsSummary,
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
  const userId = await getCurrentUserId();

  const groups = toTopicGroups(getTopicOffers());
  const topics = groups.flatMap((group) => group.leaves.map((leaf) => leaf.topic));

  const [totals, recent, durations] = await Promise.all([
    loadTopicTotals(prisma, userId),
    loadTopicStats(prisma, userId, topics),
    loadAnsweredDurations(prisma, userId),
  ]);

  const now = new Date();
  const rows = toStatsGroups(
    groups,
    new Map(totals.map((entry) => [entry.topic, entry])),
    new Map(recent.map((entry) => [entry.topic, entry])),
    now,
  );

  // Die Zielzeit steht im Template, nicht am Attempt. Fehlt das Template,
  // fällt die Aufgabe aus dem Zeitvergleich.
  const answered: AnsweredDuration[] = durations.map((entry) => {
    const target = getTemplate(entry.templateId)?.target_time_seconds;
    return { durationMs: entry.durationMs, targetMs: target === undefined ? null : target * 1000 };
  });

  const summary = toSummary(totals, answered);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Dein Fortschritt
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Je Thema die Zahl der Versuche, die Quote insgesamt und die über die letzten zehn
          Aufgaben. „Fällig“ heißt: Das Thema steht wieder an.
        </p>
      </div>

      <Summary summary={summary} />

      {rows.map((group) => (
        <Group key={group.topic} group={group} />
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
      <Stat label="Zeit (Median)" value={formatDurationComparison(summary)} />
    </dl>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 bg-white px-5 py-4 dark:bg-zinc-900">
      <dt className="text-xs font-semibold uppercase tracking-widest text-zinc-500">{label}</dt>
      <dd className="text-lg text-zinc-900 tabular-nums dark:text-zinc-50">{value}</dd>
    </div>
  );
}

function Group({ group }: { group: StatsGroup }) {
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
            <Numbers row={row} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Numbers({ row }: { row: StatsRow }) {
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
      <Due row={row} />
    </span>
  );
}

function Due({ row }: { row: StatsRow }) {
  if (row.isDue) {
    return <span className="font-medium text-zinc-900 dark:text-zinc-50">fällig</span>;
  }
  return <span>{row.dueAt === null ? "—" : formatDate(row.dueAt)}</span>;
}

function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)} %`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatSeconds(ms: number): string {
  return `${Math.round(ms / 1000)} s`;
}

/** „42 s von 60 s" — gemessen gegen die Zielzeit derselben Aufgaben. */
function formatDurationComparison(summary: StatsSummary): string {
  if (summary.medianDurationMs === null) return "—";
  if (summary.medianTargetMs === null) return formatSeconds(summary.medianDurationMs);
  return `${formatSeconds(summary.medianDurationMs)} von ${formatSeconds(summary.medianTargetMs)}`;
}
