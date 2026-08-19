"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { TopicGroupChoice, TopicLeafChoice } from "@/components/topic-groups";
import { CreateSessionResponseSchema } from "@/lib/api/contracts";

/**
 * Startet eine Session und springt in den Aufgaben-Loop.
 *
 * Die Hierarchie steckt in der Anordnung, nicht im Einzug: Ein Oberthema ist
 * eine eigene Karte mit Überschrift, seine Themen stehen als Zeilen darin.
 * Damit ist auf einen Blick klar, was ein Gebiet ist und wo es aufhört.
 *
 * Bewusst über `POST /api/session` und nicht über eine Server Action: Der
 * restliche Flow (`/next`, `/answer`) läuft über Route Handler, und die
 * Projektregeln verbieten das Mischen innerhalb eines Flows.
 */
export function TopicPicker({
  groups,
  total,
}: {
  groups: readonly TopicGroupChoice[];
  total: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(topic: string | null) {
    setPending(topic ?? "alle");
    setError(null);
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(topic ? { topicFilter: topic } : {}),
      });
      if (!response.ok) throw new Error(`Server antwortete mit ${response.status}`);

      const parsed = CreateSessionResponseSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error("Unerwartete Antwort des Servers");

      router.push(`/practice/${parsed.data.sessionId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unbekannter Fehler");
      setPending(null);
    }
  }

  const busy = pending !== null;

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={() => void start(null)}
        disabled={busy}
        className="flex items-center justify-between gap-4 rounded-xl border-2 border-zinc-900 bg-zinc-900 px-5 py-4 text-left text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        <span className="font-medium">Alle Themen</span>
        <Count value={total} pending={pending === "alle"} />
      </button>

      {groups.map((group) => (
        <section
          key={group.topic}
          className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
        >
          <button
            type="button"
            onClick={() => void start(group.topic)}
            disabled={busy}
            className="flex w-full items-center justify-between gap-4 rounded-t-xl px-5 py-4 text-left transition hover:bg-zinc-50 disabled:opacity-50 dark:hover:bg-zinc-800"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              {group.label}
            </span>
            <Count value={group.templateCount} pending={pending === group.topic} />
          </button>

          {group.leaves.length > 0 ? (
            <ul className="border-t border-zinc-100 dark:border-zinc-800">
              {group.leaves.map((leaf) => (
                <li key={leaf.topic}>
                  <LeafButton leaf={leaf} busy={busy} pending={pending} onStart={start} />
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Session konnte nicht gestartet werden: {error}
        </p>
      ) : null}
    </div>
  );
}

function LeafButton({
  leaf,
  busy,
  pending,
  onStart,
}: {
  leaf: TopicLeafChoice;
  busy: boolean;
  pending: string | null;
  onStart: (topic: string) => Promise<void>;
}) {
  return (
    <button
      type="button"
      onClick={() => void onStart(leaf.topic)}
      disabled={busy}
      className="flex w-full items-center justify-between gap-4 border-t border-zinc-100 px-5 py-3 text-left text-zinc-900 transition first:border-t-0 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-800"
    >
      <span>{leaf.label}</span>
      <Count value={leaf.templateCount} pending={pending === leaf.topic} />
    </button>
  );
}

function Count({ value, pending }: { value: number; pending: boolean }) {
  return (
    <span className="shrink-0 text-sm text-zinc-500">
      {pending ? "startet …" : `${value} ${value === 1 ? "Aufgabe" : "Aufgaben"}`}
    </span>
  );
}
