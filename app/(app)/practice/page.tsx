import { toTopicGroups, totalTemplates } from "@/components/topic-groups";
import { getTopicOffers } from "@/lib/content/load";

import { TopicPicker } from "./topic-picker";

/**
 * Themenauswahl. Die Liste kommt aus `content/topics.yaml` — dieselbe Quelle,
 * gegen die auch die Templates geprüft werden. Damit gibt es keine zweite
 * Liste, die auseinanderlaufen kann.
 *
 * Themen ohne Aufgaben werden gar nicht erst angeboten.
 */
export default function PracticePage() {
  const offers = getTopicOffers();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Was möchtest du üben?
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Wähle ein ganzes Gebiet oder ein einzelnes Thema. Du bekommst so lange neue
          Aufgaben, wie du magst.
        </p>
      </div>
      <TopicPicker groups={toTopicGroups(offers)} total={totalTemplates(offers)} />
    </div>
  );
}
