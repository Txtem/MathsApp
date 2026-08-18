"use client";

import { useCallback, useEffect, useState } from "react";

import {
  type AnswerResponse,
  AnswerResponseSchema,
  type NextQuestionResponse,
  NextQuestionResponseSchema,
} from "@/lib/api/contracts";

import { VerdictPanel } from "./verdict-panel";

/**
 * Der Aufgaben-Loop: Aufgabe holen, Antwort schicken, Urteil zeigen, von vorn.
 *
 * Die Lösung kennt diese Komponente erst, wenn der Server sie zusammen mit dem
 * Urteil schickt. Vorher steht sie nirgends im Zustand — es gibt also nichts,
 * was ein Blick in die React DevTools verraten könnte.
 */

type Phase =
  | { readonly kind: "loading" }
  | {
      readonly kind: "question";
      readonly question: NextQuestionResponse;
      readonly startedAt: number;
    }
  | {
      readonly kind: "verdict";
      readonly verdict: Extract<AnswerResponse, { expectedAnswer: string }>;
    }
  | { readonly kind: "empty" }
  | { readonly kind: "error"; readonly message: string };

interface Stats {
  readonly answered: number;
  readonly correct: number;
}

export function PracticeLoop({ sessionId }: { sessionId: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [answer, setAnswer] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<Stats>({ answered: 0, correct: 0 });

  // Setzt selbst keinen Zustand, bevor die Antwort da ist: Der Startzustand ist
  // bereits "loading", und beim Klick schaltet der Handler vorher um. Damit
  // enthält der Effect unten keinen synchronen setState-Aufruf.
  const loadNext = useCallback(async () => {
    try {
      const response = await fetch(`/api/session/${sessionId}/next`, { method: "POST" });
      if (response.status === 422) {
        setPhase({ kind: "empty" });
        return;
      }
      if (!response.ok) throw new Error(`Server antwortete mit ${response.status}`);

      const parsed = NextQuestionResponseSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error("Unerwartete Antwort des Servers");

      setAnswer("");
      setHint(null);
      setPhase({ kind: "question", question: parsed.data, startedAt: Date.now() });
    } catch (cause) {
      setPhase({ kind: "error", message: cause instanceof Error ? cause.message : "Unbekannt" });
    }
  }, [sessionId]);

  useEffect(() => {
    // Die erste Aufgabe wird beim Betreten der Seite geholt. Die Alternative wäre,
    // `POST /next` beim Rendern der Server-Komponente aufzurufen — das legt aber
    // einen Attempt an und darf deshalb nicht in einem GET-Render passieren.
    // Der Zustand wird erst nach der Antwort gesetzt, nicht synchron im Effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadNext();
  }, [loadNext]);

  function restart() {
    setPhase({ kind: "loading" });
    void loadNext();
  }

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (phase.kind !== "question" || busy) return;

    setBusy(true);
    setHint(null);
    try {
      const response = await fetch(`/api/attempt/${phase.question.attemptId}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answer, durationMs: Date.now() - phase.startedAt }),
      });
      if (!response.ok) throw new Error(`Server antwortete mit ${response.status}`);

      const parsed = AnswerResponseSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error("Unerwartete Antwort des Servers");

      if ("parseError" in parsed.data) {
        // Nicht dasselbe wie falsch: Die Aufgabe bleibt offen, es darf noch
        // einmal getippt werden (Entscheidung E-04).
        setHint("Das konnte ich nicht lesen. Erlaubt sind Zahlen und Ausdrücke wie 5! oder 5*4*3.");
        return;
      }

      const verdict = parsed.data;
      setStats((current) => ({
        answered: current.answered + 1,
        correct: current.correct + (verdict.isCorrect ? 1 : 0),
      }));
      setPhase({ kind: "verdict", verdict });
    } catch (cause) {
      setPhase({ kind: "error", message: cause instanceof Error ? cause.message : "Unbekannt" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <ProgressLine stats={stats} />

      {phase.kind === "loading" ? <p className="text-zinc-500">Aufgabe wird geladen …</p> : null}

      {phase.kind === "empty" ? (
        <p className="text-zinc-600 dark:text-zinc-400">
          Für dieses Thema gibt es noch keine Aufgaben.
        </p>
      ) : null}

      {phase.kind === "error" ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-red-600 dark:text-red-400">
            Da ist etwas schiefgegangen: {phase.message}
          </p>
          <button type="button" onClick={restart} className="text-sm underline">
            Noch einmal versuchen
          </button>
        </div>
      ) : null}

      {phase.kind === "question" ? (
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
          <p className="text-sm text-zinc-500">
            {phase.question.topic} · Schwierigkeit {phase.question.difficulty} · Richtzeit{" "}
            {phase.question.targetTimeSeconds} s
          </p>

          <p className="text-2xl text-zinc-900 dark:text-zinc-50">{phase.question.questionText}</p>

          <div className="flex flex-col gap-2">
            <label htmlFor="answer" className="text-sm text-zinc-600 dark:text-zinc-400">
              Deine Antwort
            </label>
            <input
              id="answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              autoFocus
              autoComplete="off"
              maxLength={200}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 font-mono text-lg text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-300"
            />
            {hint ? (
              <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">
                {hint}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={busy || answer.trim() === ""}
            className="self-start rounded-lg bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {busy ? "wird geprüft …" : "Antwort prüfen"}
          </button>
        </form>
      ) : null}

      {phase.kind === "verdict" ? (
        <VerdictPanel verdict={phase.verdict} onNext={restart} />
      ) : null}
    </div>
  );
}

function ProgressLine({ stats }: { stats: Stats }) {
  if (stats.answered === 0) return null;
  return (
    <p className="text-sm text-zinc-500">
      {stats.correct} von {stats.answered} richtig
    </p>
  );
}
