"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { CreateSessionResponseSchema } from "@/lib/api/contracts";

export interface TopicOption {
  readonly label: string;
  /** `null` heißt: alle Themen. */
  readonly topic: string | null;
}

/**
 * Startet eine Session und springt in den Aufgaben-Loop.
 *
 * Bewusst über `POST /api/session` und nicht über eine Server Action: Der
 * restliche Flow (`/next`, `/answer`) läuft über Route Handler, und die
 * Projektregeln verbieten das Mischen innerhalb eines Flows.
 */
export function TopicPicker({ options }: { options: readonly TopicOption[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(option: TopicOption) {
    setPending(option.label);
    setError(null);
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(option.topic ? { topicFilter: option.topic } : {}),
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

  return (
    <div className="flex flex-col gap-3">
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          onClick={() => void start(option)}
          disabled={pending !== null}
          className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-5 py-4 text-left text-zinc-900 transition hover:border-zinc-400 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:border-zinc-600"
        >
          <span className="font-medium">{option.label}</span>
          <span className="text-sm text-zinc-500">
            {pending === option.label ? "startet …" : "üben"}
          </span>
        </button>
      ))}

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Session konnte nicht gestartet werden: {error}
        </p>
      ) : null}
    </div>
  );
}
