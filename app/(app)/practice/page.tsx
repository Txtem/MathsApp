import { devTemplates } from "@/lib/content/dev-templates";

import { type TopicOption, TopicPicker } from "./topic-picker";

/** "arithmetik.addition" → "Addition" */
function label(topic: string): string {
  const leaf = topic.split(".").at(-1) ?? topic;
  return leaf.charAt(0).toUpperCase() + leaf.slice(1);
}

/**
 * Themenauswahl. Die Liste entsteht aus den vorhandenen Templates — in M1
 * kommen die Topics aus dem YAML-Content, die Seite bleibt gleich.
 */
export default function PracticePage() {
  const topics = [...new Set(devTemplates.map((template) => template.topic))].sort();
  const options: readonly TopicOption[] = [
    { label: "Alle Themen", topic: null },
    ...topics.map((topic) => ({ label: label(topic), topic })),
  ];

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
      <TopicPicker options={options} />
    </div>
  );
}
