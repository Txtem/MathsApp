import type { Template } from "@/lib/engine/types";

import { candidateWeights, chooseTopic, successRate, targetDifficulty, type TopicStats } from "./scoring";

/**
 * Welches Template kommt als Nächstes? (SPEC.md Abschnitt 10)
 *
 * Der Weg: Kandidaten nach Topic-Filter → schwächstes bzw. fälligstes Thema
 * wählen → innerhalb des Themas gewichtet nach Schwierigkeit ziehen, das
 * Gewicht zuletzt gestellter Templates dabei abwerten.
 *
 * Die Abwertung ersetzt den harten Ausschluss der letzten drei Templates
 * (D-24). Gegen dieselbe Aufgabe zweimal in einer Sitzung hilft sie nicht —
 * das tut die Sperre auf den Fragetext in `next-question.ts`.
 *
 * Rein: Statistiken und Zufall kommen als Parameter herein. Die DB-Schicht
 * darüber steht in `lib/db/topic-stats.ts` und `lib/db/session-history.ts`.
 */

export interface SelectionInput {
  /** Präfix, z.B. "arithmetik" oder "arithmetik.addition". */
  readonly topicFilter?: string | null;
  /** Stand je Kandidaten-Topic. Themen ohne Eintrag gelten als unerprobt. */
  readonly stats?: readonly TopicStats[];
  /** Zuletzt gestellte Template-IDs dieser PracticeSession, jüngste zuerst. */
  readonly recentTemplateIds?: readonly string[];
  /** Die Uhr der Anfrage. Pflicht, nicht optional — siehe D-20. */
  readonly now: Date;
}

export function matchesTopic(topic: string, filter: string | null | undefined): boolean {
  if (!filter) return true;
  return topic === filter || topic.startsWith(`${filter}.`);
}

/**
 * Ein Thema ohne Statistik ist ein unerprobtes Thema: keine Versuche, nie
 * gestellt, fällig. So braucht die DB-Schicht für neue Themen keinen Eintrag
 * zu erfinden.
 */
function emptyStats(topic: string): TopicStats {
  return { topic, recentCorrect: 0, recentAnswered: 0, dueAt: null, lastSeenAt: null };
}

export function selectTemplate(
  templates: readonly Template[],
  input: SelectionInput,
  random: () => number,
): Template | undefined {
  const candidates = templates.filter((template) => matchesTopic(template.topic, input.topicFilter));
  if (candidates.length === 0) return undefined;

  const byTopic = new Map(input.stats?.map((entry) => [entry.topic, entry]));

  // Nur Themen, die überhaupt Aufgaben haben — die Reihenfolge folgt den
  // Templates, damit die Auswahl bei Gleichstand vorhersagbar bleibt.
  const topics = [...new Set(candidates.map((template) => template.topic))].map(
    (topic) => byTopic.get(topic) ?? emptyStats(topic),
  );

  const chosen = chooseTopic(topics, input.now);
  if (chosen === undefined) return undefined;

  const target = targetDifficulty(successRate(chosen));
  const inTopic = candidates.filter((template) => template.topic === chosen.topic);
  const recent = input.recentTemplateIds ?? [];

  // Kein Kandidat wird ausgeschlossen: Beide Faktoren sind größer als null, es
  // bleibt also immer etwas zu ziehen. Genau deshalb gibt es hier keinen
  // Sonderfall mehr für „alles gesperrt".
  //
  // Ohne `factors`-Argument: Die Anwendung nimmt immer die gemessenen Werte aus
  // `RECENCY_FACTORS`. Wer andere durchprobieren will, ruft `candidateWeights`
  // direkt — dafür gibt es kein Feld in `SelectionInput`.
  return weightedPick(inTopic, candidateWeights(inTopic, target, recent), random);
}

/**
 * Gewichtetes Ziehen. `random()` liefert [0, 1); der Wert wird auf die Summe
 * der Gewichte gestreckt und der erste Eintrag genommen, der sie überschreitet.
 *
 * Exportiert, weil es die einzige Stelle mit Zufall ist und eigene Tests hat.
 */
export function weightedPick<T>(
  items: readonly T[],
  weights: readonly number[],
  random: () => number,
): T | undefined {
  if (items.length === 0) return undefined;

  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return items[0];

  let threshold = random() * total;
  for (let i = 0; i < items.length; i++) {
    threshold -= weights[i];
    if (threshold < 0) return items[i];
  }

  // Nur erreichbar, wenn `random()` durch Rundung genau die Summe trifft.
  return items[items.length - 1];
}
