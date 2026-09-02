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
  /**
   * Falsche Antworten unter `SNAP_SHARE` der Zielzeit. `null` heißt: zu wenige,
   * um etwas zu zeigen — siehe `SNAP_MIN_COUNT`.
   */
  readonly snapAnswers: number | null;
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
  readonly time: MedianTime;
}

/**
 * Die Medianzeit, relativ zur Zielzeit. `1.3` heißt: das 1,3-Fache dessen, was
 * die Aufgaben vorgesehen haben.
 */
export interface MedianTime {
  /** `null` heißt: weniger als `TIME_MIN_SAMPLES` richtige Antworten. */
  readonly relative: number | null;
  /** Wie viele richtige Antworten eingeflossen sind. */
  readonly counted: number;
  /** Wie viele als unterbrochen ausgeschlossen wurden. */
  readonly interrupted: number;
}

/** Eine beantwortete Aufgabe, so weit die Statistik sie braucht. */
export interface AnsweredDuration {
  readonly topic: string;
  readonly durationMs: number;
  /** Zielzeit des Templates. `null`, wenn es das Template nicht mehr gibt. */
  readonly targetMs: number | null;
  readonly isCorrect: boolean;
}

/**
 * Unter so vielen richtigen Antworten wird keine Zeit angezeigt. Dasselbe
 * Prinzip wie bei der Erfolgsquote: Ein Median aus zwei Werten ist keine
 * Aussage.
 */
export const TIME_MIN_SAMPLES = 5;

/**
 * Ab dem Zehnfachen der Zielzeit gilt eine Aufgabe als unterbrochen — jemand
 * hat den Tab offen liegen lassen. Solche Werte fließen nicht in den Median
 * ein, werden aber gezählt und ausgewiesen, statt still zu verschwinden.
 */
export const INTERRUPTED_FACTOR = 10;

/**
 * Unter diesem Anteil der Zielzeit gilt eine falsche Antwort als auffällig
 * schnell. Gemessen wird die Zeit, nicht die Absicht — wer ein Verfahren sicher,
 * aber falsch anwendet, ist genauso schnell wie jemand, der rät.
 */
export const SNAP_SHARE = 0.2;

/** So viele braucht es, bevor die Zahl etwas aussagt. */
export const SNAP_MIN_COUNT = 3;

function rate(correct: number, attempts: number): number | null {
  return attempts === 0 ? null : correct / attempts;
}

export function toStatsGroups(
  groups: readonly TopicGroupChoice[],
  totals: ReadonlyMap<string, TopicTotals>,
  recent: ReadonlyMap<string, TopicStats>,
  answered: readonly AnsweredDuration[],
  now: Date,
): readonly StatsGroup[] {
  const snapsByTopic = countSnaps(answered);

  return groups.map((group) => ({
    topic: group.topic,
    label: group.label,
    rows: group.leaves.map((leaf) => {
      const total = totals.get(leaf.topic);
      const window = recent.get(leaf.topic);
      const snaps = snapsByTopic.get(leaf.topic) ?? 0;

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
        snapAnswers: snaps >= SNAP_MIN_COUNT ? snaps : null,
      } satisfies StatsRow;
    }),
  }));
}

/** Nur Aufgaben, deren Template es noch gibt — sonst fehlt die Zielzeit. */
function withTarget(
  answered: readonly AnsweredDuration[],
): readonly (AnsweredDuration & { readonly targetMs: number })[] {
  return answered.filter(
    (entry): entry is AnsweredDuration & { targetMs: number } => entry.targetMs !== null,
  );
}

/**
 * Falsche Antworten je Thema, die deutlich unter der Zielzeit lagen.
 *
 * Die Umkehrung des Einwands gegen die alte Medianzeit: Wer in einem Fünftel
 * der vorgesehenen Zeit falsch antwortet, hat das Verfahren nicht angewandt,
 * sondern etwas anderes getan — geraten, verlesen, oder sicher das Falsche
 * gerechnet. Das ist etwas anderes als eine lange Fehlrechnung und damit eine
 * Information, kein Schlupfloch (D-21).
 */
export function countSnaps(answered: readonly AnsweredDuration[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();

  for (const entry of withTarget(answered)) {
    if (entry.isCorrect) continue;
    if (entry.durationMs >= entry.targetMs * SNAP_SHARE) continue;
    counts.set(entry.topic, (counts.get(entry.topic) ?? 0) + 1);
  }

  return counts;
}

/**
 * Median der Bearbeitungszeit, relativ zur Zielzeit — und nur über **richtige**
 * Antworten.
 *
 * Die alte Fassung nahm alle Attempts und vermischte damit zwei Größen: Bei
 * einer falschen Antwort misst die Dauer, wie lange jemand gebraucht hat, um
 * sich zu irren. Wer schnell falsch antwortet, verbesserte damit seine
 * Medianzeit. Das ist kein Missbrauchsproblem — es gibt keinen Gegner —,
 * sondern ein Definitionsproblem, und deshalb wurde die Definition geändert
 * statt ein Schalter gebaut (D-21).
 *
 * Relativ und nicht in Sekunden, weil absolute Zeiten über Aufgabentypen hinweg
 * nichts vergleichen: 40 Sekunden sind bei einer Kopfrechenaufgabe viel und bei
 * einer hypergeometrischen Verteilung wenig.
 */
export function medianTime(answered: readonly AnsweredDuration[]): MedianTime {
  const richtige = withTarget(answered).filter((entry) => entry.isCorrect);

  const verhaeltnisse = richtige.map((entry) => entry.durationMs / entry.targetMs);
  const gezaehlt = verhaeltnisse.filter((wert) => wert < INTERRUPTED_FACTOR);
  const unterbrochen = verhaeltnisse.length - gezaehlt.length;

  return {
    relative: gezaehlt.length < TIME_MIN_SAMPLES ? null : median(gezaehlt),
    counted: gezaehlt.length,
    interrupted: unterbrochen,
  };
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
  answered: readonly AnsweredDuration[],
): StatsSummary {
  const attempts = totals.reduce((sum, entry) => sum + entry.attempts, 0);
  const correct = totals.reduce((sum, entry) => sum + entry.correct, 0);

  return {
    attempts,
    correct,
    overallRate: rate(correct, attempts),
    time: medianTime(answered),
  };
}
