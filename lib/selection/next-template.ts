import type { Template } from "@/lib/engine/types";

/**
 * Welches Template kommt als Nächstes?
 *
 * M0-Fassung: Topic-Filter anwenden, die zuletzt gestellten Templates meiden,
 * aus dem Rest gleichverteilt ziehen. Die Bewertung nach Erfolgsquote und
 * Fälligkeit (SPEC.md Abschnitt 10) braucht `TopicMastery` und kommt mit M2 —
 * sie ersetzt genau diese Funktion, deshalb steht sie allein hinter dieser Signatur.
 *
 * Rein: Der Zufall kommt als Funktion herein, damit die Auswahl testbar bleibt.
 */

export interface SelectionOptions {
  /** Präfix, z.B. "arithmetik" oder "arithmetik.addition". */
  readonly topicFilter?: string | null;
  /** Zuletzt gestellte Template-IDs, jüngste zuerst. */
  readonly recentTemplateIds?: readonly string[];
  /** Wie viele davon ausgeschlossen werden. SPEC nennt 3. */
  readonly avoidCount?: number;
}

export function matchesTopic(topic: string, filter: string | null | undefined): boolean {
  if (!filter) return true;
  return topic === filter || topic.startsWith(`${filter}.`);
}

export function selectTemplate(
  templates: readonly Template[],
  options: SelectionOptions,
  random: () => number,
): Template | undefined {
  const candidates = templates.filter((template) => matchesTopic(template.topic, options.topicFilter));
  if (candidates.length === 0) return undefined;

  const avoid = new Set((options.recentTemplateIds ?? []).slice(0, options.avoidCount ?? 3));
  const fresh = candidates.filter((template) => !avoid.has(template.id));

  // Wenn der Filter weniger Templates hergibt, als vermieden werden sollen,
  // ist Wiederholung besser als keine Aufgabe.
  const pool = fresh.length > 0 ? fresh : candidates;
  return pool[Math.floor(random() * pool.length)];
}
