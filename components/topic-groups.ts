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
  /**
   * Die Themen unter diesem Oberthema. Auch ein einzelnes wird aufgeführt: Ein
   * Oberthema, unter dem nichts steht, sieht sonst aus, als fehlte etwas.
   */
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
      return {
        label: offer.label,
        topic: offer.path,
        templateCount: offer.templateCount,
        leaves: leavesOf(offer).filter((leaf) => leaf.templateCount > 0),
      };
    });
}

/** Gesamtzahl über alle Oberthemen, für den „Alle Themen"-Knopf. */
export function totalTemplates(offers: readonly TopicOffer[]): number {
  return offers.reduce((sum, offer) => sum + offer.templateCount, 0);
}
