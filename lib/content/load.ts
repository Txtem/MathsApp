import "server-only";

import { readContent } from "./read";
import {
  allTopicPaths,
  leafTopics,
  topicLabel,
  type TopicOffer,
  topicOffers,
  type Topics,
  type ValidatedTemplate,
} from "./schema";

export type { TopicOffer } from "./schema";

/**
 * Zugang der Anwendung zum Content. Liest einmal pro Prozess und hält das
 * Ergebnis im Modul-Scope — Templates ändern sich zur Laufzeit nicht.
 *
 * Nur dieses Modul wird aus `app/` importiert; das Lesen selbst steht in
 * `read.ts`, damit Skripte und Tests es ohne `server-only` benutzen können.
 *
 * Der Rückgabetyp ist `ValidatedTemplate` und nicht der Engine-Typ `Template`:
 * Er trägt zusätzlich `round_to`, das die Bewertung braucht. Zuweisbar an
 * `Template` ist er trotzdem, die Engine nimmt ihn unverändert entgegen.
 */

interface Bundle {
  readonly topics: Topics;
  readonly templates: readonly ValidatedTemplate[];
}

let cache: Bundle | undefined;

function bundle(): Bundle {
  if (!cache) {
    const content = readContent();
    cache = { topics: content.topics, templates: content.templates };
  }
  return cache;
}

export function getTemplates(): readonly ValidatedTemplate[] {
  return bundle().templates;
}

export function getTemplate(id: string): ValidatedTemplate | undefined {
  return bundle().templates.find((template) => template.id === id);
}

export function getTopics(): Topics {
  return bundle().topics;
}

/** Alle Pfade, auf die ein Session-Filter zeigen darf — Blätter und Zwischenknoten. */
export function getFilterablePaths(): ReadonlySet<string> {
  return allTopicPaths(bundle().topics);
}

export function getLeafTopics(): ReadonlySet<string> {
  return leafTopics(bundle().topics);
}

export function getTopicLabel(path: string): string | undefined {
  return topicLabel(bundle().topics, path);
}

/** Themen für die Auswahlseite, mit Beschriftung und Aufgabenzahl. */
export function getTopicOffers(): readonly TopicOffer[] {
  const { topics, templates } = bundle();
  return topicOffers(topics, templates);
}
