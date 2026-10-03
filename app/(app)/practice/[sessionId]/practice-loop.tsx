"use client";

import { useCallback, useEffect, useState } from "react";

import { answerFormatHint } from "@/components/answer-format";
import {
  type ClosedVerdict,
  questionControls,
  type QuestionState,
  RETRY_NOTICE,
  withHint,
} from "@/components/question-controls";
import {
  AnswerResponseSchema,
  type GiveUpResponse,
  GiveUpResponseSchema,
  HintResponseSchema,
  type NextQuestionResponse,
  NextQuestionResponseSchema,
} from "@/lib/api/contracts";

import { QuestionForm } from "./question-form";
import { VerdictPanel } from "./verdict-panel";

/**
 * Der Aufgaben-Loop: Aufgabe holen, Antwort schicken (bei der ersten falschen
 * ein zweiter Versuch), Tipps öffnen, notfalls aufgeben, Urteil zeigen.
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
      readonly hints: QuestionState;
      readonly startedAt: number;
    }
  | {
      readonly kind: "verdict";
      /** Frage und eigene Antwort bleiben sichtbar, siehe M2e C-3. */
      readonly question: NextQuestionResponse;
      readonly givenAnswer: string | null;
      readonly verdict: ClosedVerdict;
      readonly solution: GiveUpResponse;
      readonly openedHints: readonly string[];
    }
  | { readonly kind: "empty" }
  | { readonly kind: "error"; readonly message: string };

interface Stats {
  readonly answered: number;
  readonly correct: number;
}

function failed(cause: unknown): Phase {
  return { kind: "error", message: cause instanceof Error ? cause.message : "Unbekannt" };
}

export function PracticeLoop({ sessionId }: { sessionId: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [answer, setAnswer] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
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
      const question = parsed.data;

      setAnswer("");
      setNotice(null);
      // Bewusst so, kein Fehler: Liefert der Server nach einem Neuladen eine
      // schon begonnene Aufgabe erneut aus (D-33), misst die
      // Stoppuhr nur ab dem Neuladen. Die Zeit davor kennt der Browser nicht
      // mehr, und der Server misst keine Dauer. `durationMs` fällt dann zu kurz
      // aus — hinnehmbar, weil Neuladen mitten in einer Aufgabe selten ist.
      setPhase({
        kind: "question",
        question,
        hints: {
          hintsTotal: question.hintsTotal,
          openedHints: question.openedHints,
          firstTryWrong: question.firstTryWrong,
        },
        startedAt: Date.now(),
      });
    } catch (cause) {
      setPhase(failed(cause));
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
    setNotice(null);
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
        // einmal getippt werden, ohne einen Versuch zu verbrauchen (D-04).
        setNotice(
          `Das konnte ich nicht lesen. ${answerFormatHint(phase.question.answerType, phase.question.roundTo)}`,
        );
        return;
      }

      if ("retry" in parsed.data) {
        // Erste falsche Antwort: Die Aufgabe bleibt offen, die Lösung kennt
        // diese Komponente weiterhin nicht. Die Antwort bleibt im Feld stehen,
        // damit ein Tippfehler korrigiert werden kann. Die Stoppuhr läuft
        // weiter — die Dauer beim Schließen ist die bis zur letzten Antwort.
        setNotice(RETRY_NOTICE);
        setPhase({ ...phase, hints: { ...phase.hints, firstTryWrong: true } });
        return;
      }

      const { isCorrect, ...solution } = parsed.data;
      setStats((current) => ({
        answered: current.answered + 1,
        correct: current.correct + (isCorrect ? 1 : 0),
      }));
      setPhase({
        kind: "verdict",
        question: phase.question,
        givenAnswer: answer,
        verdict: { kind: "answered", isCorrect, secondTry: phase.hints.firstTryWrong },
        solution,
        openedHints: phase.hints.openedHints,
      });
    } catch (cause) {
      setPhase(failed(cause));
    } finally {
      setBusy(false);
    }
  }

  async function requestHint(): Promise<void> {
    if (phase.kind !== "question" || busy) return;

    setBusy(true);
    try {
      const response = await fetch(`/api/attempt/${phase.question.attemptId}/hint`, {
        method: "POST",
      });
      // 409: alle offen oder ein zweiter Klick war schneller — kein Fehler.
      if (response.status === 409) return;
      if (!response.ok) throw new Error(`Server antwortete mit ${response.status}`);

      const parsed = HintResponseSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error("Unerwartete Antwort des Servers");

      const { hint, index } = parsed.data;
      setPhase((current) =>
        current.kind === "question"
          ? { ...current, hints: withHint(current.hints, hint, index) }
          : current,
      );
    } catch (cause) {
      setPhase(failed(cause));
    } finally {
      setBusy(false);
    }
  }

  async function giveUp(): Promise<void> {
    if (phase.kind !== "question" || busy) return;
    if (!questionControls(phase.hints).showGiveUp) return;

    setBusy(true);
    try {
      const response = await fetch(`/api/attempt/${phase.question.attemptId}/give-up`, {
        method: "POST",
      });
      if (response.status === 409) {
        // Der Server sieht noch ungeöffnete Tipps — er hat das letzte Wort.
        setNotice("Erst alle Tipps öffnen, dann die Lösung.");
        return;
      }
      if (!response.ok) throw new Error(`Server antwortete mit ${response.status}`);

      const parsed = GiveUpResponseSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error("Unerwartete Antwort des Servers");

      setStats((current) => ({ ...current, answered: current.answered + 1 }));
      setPhase({
        kind: "verdict",
        question: phase.question,
        givenAnswer: null,
        verdict: { kind: "gave_up" },
        solution: parsed.data,
        openedHints: phase.hints.openedHints,
      });
    } catch (cause) {
      setPhase(failed(cause));
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
        <QuestionForm
          question={phase.question}
          hints={phase.hints}
          answer={answer}
          notice={notice}
          busy={busy}
          onAnswer={setAnswer}
          onSubmit={(event) => void submit(event)}
          onHint={() => void requestHint()}
          onGiveUp={() => void giveUp()}
        />
      ) : null}

      {phase.kind === "verdict" ? (
        <VerdictPanel
          question={phase.question}
          givenAnswer={phase.givenAnswer}
          verdict={phase.verdict}
          solution={phase.solution}
          openedHints={phase.openedHints}
          onNext={restart}
        />
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
