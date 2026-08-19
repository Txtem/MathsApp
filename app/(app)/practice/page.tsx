import { getTopicOffers, type TopicOffer } from "@/lib/content/load";

import { type TopicChoice, TopicPicker } from "./topic-picker";

/**
 * Themenauswahl. Die Liste kommt aus `content/topics.yaml` — dieselbe Quelle,
 * gegen die auch die Templates geprüft werden. Damit gibt es keine zweite
 * Liste, die auseinanderlaufen kann.
 *
 * Themen ohne Aufgaben werden gar nicht erst angeboten.
 */
export default function PracticePage() {
  const offers = getTopicOffers();
  const total = offers.reduce((sum, offer) => sum + offer.templateCount, 0);

  const choices: readonly TopicChoice[] = [
    { label: "Alle Themen", topic: null, templateCount: total, level: 0 },
    ...offers.flatMap(flatten),
  ].filter((choice) => choice.templateCount > 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Was möchtest du üben?
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Du bekommst so lange neue Aufgaben, wie du magst.
        </p>
      </div>
      <TopicPicker choices={choices} />
    </div>
  );
}

function flatten(offer: TopicOffer, level = 1): readonly TopicChoice[] {
  return [
    { label: offer.label, topic: offer.path, templateCount: offer.templateCount, level },
    ...offer.children.flatMap((child) => flatten(child, level + 1)),
  ];
}
