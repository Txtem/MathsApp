import type { TopicOffer } from "@/lib/content/schema";

/**
 * Formt den Themenbaum für die Auswahlseite um: ein Oberthema mit seinen
 * Blättern, statt einer flachen Liste mit Einrückungsstufen.
 *
 * Die frühere Fassung reihte alle Ebenen untereinander und unterschied sie nur
 * über den Einzug. Damit war weder erkennbar, was ein Oberthema ist, noch wo
 * eines aufhört — bei mehr als zwei Ebenen erst recht nicht.
 */

export interface TopicLeafChoice {
  readonly label: string;
  readonly topic: string;
  readonly templateCount: number;
}

export interface TopicGroupChoice extends TopicLeafChoice {
  /** Die Blätter unter diesem Oberthema. Leer, wenn es nur eines gibt. */
  readonly leaves: readonly TopicLeafChoice[];
}

function leavesOf(offer: TopicOffer): readonly TopicLeafChoice[] {
  if (offer.children.length === 0) {
    return [{ label: offer.label, topic: offer.path, templateCount: offer.templateCount }];
  }
  return offer.children.flatMap((child) => leavesOf(child));
}

export function toTopicGroups(offers: readonly TopicOffer[]): readonly TopicGroupChoice[] {
  return offers
    .filter((offer) => offer.templateCount > 0)
    .map((offer) => {
      const leaves = leavesOf(offer).filter((leaf) => leaf.templateCount > 0);
      return {
        label: offer.label,
        topic: offer.path,
        templateCount: offer.templateCount,
        // Ein einzelnes Blatt unter einem Oberthema sagt dasselbe zweimal —
        // der Knopf für das Oberthema deckt es bereits ab.
        leaves: leaves.length > 1 ? leaves : [],
      };
    });
}

/** Gesamtzahl über alle Oberthemen, für den „Alle Themen"-Knopf. */
export function totalTemplates(offers: readonly TopicOffer[]): number {
  return offers.reduce((sum, offer) => sum + offer.templateCount, 0);
}
