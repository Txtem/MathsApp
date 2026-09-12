import { expectedDisplay } from "@/components/expected-answer";
import { MathText } from "@/components/MathText";
import type { AnswerResponse, NextQuestionResponse } from "@/lib/api/contracts";

/**
 * Die geschlossene Aufgabe: Frage, eigene Antwort, Urteil, Musterlösung,
 * Lösungsweg.
 *
 * Frage und eigene Antwort bleiben stehen (M2e C-3). Vorher verschwand die
 * Aufgabe in dem Moment, in dem der Lösungsweg erschien — und ein Lösungsweg
 * ohne die Aufgabe daneben ist schwer nachzuvollziehen.
 */
export function VerdictPanel({
  question,
  givenAnswer,
  verdict,
  onNext,
}: {
  question: NextQuestionResponse;
  givenAnswer: string;
  verdict: Extract<AnswerResponse, { expectedAnswer: string }>;
  onNext: () => void;
}) {
  const correct = verdict.isCorrect;
  const expected = expectedDisplay(verdict.expectedAnswer, verdict.expectedRounded);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-2xl leading-relaxed text-zinc-900 dark:text-zinc-50">
        <MathText text={question.questionText} />
      </div>

      <p className="text-sm text-zinc-500">
        Deine Antwort:{" "}
        <span className="font-mono text-zinc-900 dark:text-zinc-50">{givenAnswer}</span>
      </p>

      <div
        role="status"
        className={
          correct
            ? "rounded-lg border border-emerald-300 bg-emerald-50 px-5 py-4 dark:border-emerald-900 dark:bg-emerald-950"
            : "rounded-lg border border-red-300 bg-red-50 px-5 py-4 dark:border-red-900 dark:bg-red-950"
        }
      >
        <p
          className={
            correct
              ? "font-medium text-emerald-900 dark:text-emerald-100"
              : "font-medium text-red-900 dark:text-red-100"
          }
        >
          {correct ? "Richtig." : `Falsch. Richtig wäre ${expected.primary} gewesen.`}
        </p>

        {/*
          Die gefragte und die exakte Form nebeneinander, sobald sie sich
          unterscheiden — auch bei richtiger Antwort. Genau dort entstand der
          Zweifel: gefragt war eine gerundete Dezimalzahl, angezeigt wurde ein
          Bruch. Siehe M2e C-2.
        */}
        {expected.exact !== null ? (
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            {correct ? "Erwartet war " : "Gefragt war "}
            <span className="font-mono">{expected.primary}</span>, exakt{" "}
            <span className="font-mono">{expected.exact}</span>.
          </p>
        ) : null}

        {verdict.solutionText ? (
          <div className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
            <MathText text={verdict.solutionText} />
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onNext}
        autoFocus
        className="self-start rounded-lg bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Nächste Aufgabe
      </button>
    </div>
  );
}
