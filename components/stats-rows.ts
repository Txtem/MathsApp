import type { TopicGroupChoice } from "@/components/topic-groups";
import type { TopicStats } from "@/lib/selection/scoring";

/**
 * Formt die Zahlen für die Statistik-Seite um. Rein: Eingabe sind Themen und
 * Statistiken, keine Datenbank und keine Uhr — dieselbe Trennung wie bei
 * `topic-groups.ts` und aus demselben Grund (D-16).
 *
 * Die Gruppierung selbst kommt aus `toTopicGroups`, damit Statistik und
 * Themenauswahl nicht zwei Vorstellungen davon haben, was ein Oberthema ist.
 */

/** Gesamtzahlen eines Themas, so wie sie in `TopicMastery` stehen. */
export interface TopicTotals {
  readonly topic: string;
  readonly attempts: number;
  readonly correct: number;
  readonly dueAt: Date | null;
}

export interface StatsRow {
  readonly topic: string;
  readonly label: string;
  readonly attempts: number;
  /** Quote über alle Versuche. `null` heißt: noch keine. */
  readonly overallRate: number | null;
  /** Quote über die letzten zehn beantworteten. `null` heißt: noch keine. */
  readonly recentRate: number | null;
  readonly dueAt: Date | null;
  readonly isDue: boolean;
}

export interface StatsGroup {
  readonly topic: string;
  readonly label: string;
  readonly rows: readonly StatsRow[];
}

export interface StatsSummary {
  readonly attempts: number;
  readonly correct: number;
  readonly overallRate: number | null;
  /** Median der tatsächlichen Bearbeitungszeit. `null` heißt: keine Daten. */
  readonly medianDurationMs: number | null;
  /** Median der Zielzeit derselben Aufgaben, zum Vergleich. */
  readonly medianTargetMs: number | null;
}

/** Eine beantwortete Aufgabe, so weit die Statistik sie braucht. */
export interface AnsweredDuration {
  readonly durationMs: number;
  /** Zielzeit des Templates. `null`, wenn es das Template nicht mehr gibt. */
  readonly targetMs: number | null;
}

function rate(correct: number, attempts: number): number | null {
  return attempts === 0 ? null : correct / attempts;
}

export function toStatsGroups(
  groups: readonly TopicGroupChoice[],
  totals: ReadonlyMap<string, TopicTotals>,
  recent: ReadonlyMap<string, TopicStats>,
  now: Date,
): readonly StatsGroup[] {
  return groups.map((group) => ({
    topic: group.topic,
    label: group.label,
    rows: group.leaves.map((leaf) => {
      const total = totals.get(leaf.topic);
      const window = recent.get(leaf.topic);

      return {
        topic: leaf.topic,
        label: leaf.label,
        attempts: total?.attempts ?? 0,
        overallRate: rate(total?.correct ?? 0, total?.attempts ?? 0),
        // Bewusst **nicht** `successRate` aus der Auswahl: Deren 0.5 für
        // unerprobte Themen ist ein Steuerungswert, keine Messung. Auf einer
        // Statistik-Seite wäre sie schlicht gelogen.
        recentRate: rate(window?.recentCorrect ?? 0, window?.recentAnswered ?? 0),
        dueAt: total?.dueAt ?? null,
        // Ohne Termin ist fällig: ein nie geübtes Thema steht an.
        isDue: total?.dueAt == null || total.dueAt.getTime() <= now.getTime(),
      } satisfies StatsRow;
    }),
  }));
}

/** Median. `null` bei leerer Eingabe; bei gerader Anzahl das Mittel der beiden mittleren. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function toSummary(
  totals: readonly TopicTotals[],
  durations: readonly AnsweredDuration[],
): StatsSummary {
  const attempts = totals.reduce((sum, entry) => sum + entry.attempts, 0);
  const correct = totals.reduce((sum, entry) => sum + entry.correct, 0);

  // Nur Aufgaben, deren Template es noch gibt — sonst stünde die gemessene
  // Zeit gegen eine Zielzeit, die zu einer anderen Aufgabe gehört.
  const vergleichbar = durations.filter((entry) => entry.targetMs !== null);

  return {
    attempts,
    correct,
    overallRate: rate(correct, attempts),
    medianDurationMs: median(vergleichbar.map((entry) => entry.durationMs)),
    medianTargetMs: median(vergleichbar.map((entry) => entry.targetMs as number)),
  };
}
