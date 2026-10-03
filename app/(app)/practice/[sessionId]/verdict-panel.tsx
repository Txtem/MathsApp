import { expectedDisplay } from "@/components/expected-answer";
import { MathText } from "@/components/MathText";
import { type ClosedVerdict, verdictLook } from "@/components/question-controls";
import type { GiveUpResponse, NextQuestionResponse } from "@/lib/api/contracts";

/**
 * Die geschlossene Aufgabe: Frage, eigene Antwort, Urteil, Musterlösung,
 * Lösungsweg — beantwortet oder aufgegeben.
 *
 * Frage und eigene Antwort bleiben stehen (M2e C-3). Vorher verschwand die
 * Aufgabe in dem Moment, in dem der Lösungsweg erschien — und ein Lösungsweg
 * ohne die Aufgabe daneben ist schwer nachzuvollziehen. Aus demselben Grund
 * bleiben die genutzten Tipps sichtbar.
 */

const TONE = {
  right: {
    box: "rounded-lg border border-emerald-300 bg-emerald-50 px-5 py-4 dark:border-emerald-900 dark:bg-emerald-950",
    text: "font-medium text-emerald-900 dark:text-emerald-100",
  },
  wrong: {
    box: "rounded-lg border border-red-300 bg-red-50 px-5 py-4 dark:border-red-900 dark:bg-red-950",
    text: "font-medium text-red-900 dark:text-red-100",
  },
  gave_up: {
    box: "rounded-lg border border-zinc-300 bg-zinc-50 px-5 py-4 dark:border-zinc-700 dark:bg-zinc-900",
    text: "font-medium text-zinc-900 dark:text-zinc-100",
  },
} as const;

export function VerdictPanel({
  question,
  givenAnswer,
  verdict,
  solution,
  openedHints,
  onNext,
}: {
  question: NextQuestionResponse;
  /** `null` nach dem Aufgeben — dann gab es keine abschließende Antwort. */
  givenAnswer: string | null;
  verdict: ClosedVerdict;
  /** Dieselben drei Felder aus beiden Wegen: Antwort- und Aufgeben-Route. */
  solution: GiveUpResponse;
  openedHints: readonly string[];
  onNext: () => void;
}) {
  const expected = expectedDisplay(solution.expectedAnswer, solution.expectedRounded);
  const look = verdictLook(verdict, expected.primary);
  const correct = verdict.kind === "answered" && verdict.isCorrect;

  return (
    <div className="flex flex-col gap-4">
      <div className="text-2xl leading-relaxed text-zinc-900 dark:text-zinc-50">
        <MathText text={question.questionText} />
      </div>

      {givenAnswer !== null ? (
        <p className="text-sm text-zinc-500">
          Deine Antwort:{" "}
          <span className="font-mono text-zinc-900 dark:text-zinc-50">{givenAnswer}</span>
        </p>
      ) : null}

      {openedHints.length > 0 ? (
        <ol className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
          {openedHints.map((hint, index) => (
            <li key={index}>
              <span className="font-medium">Tipp {index + 1}: </span>
              <MathText text={hint} />
            </li>
          ))}
        </ol>
      ) : null}

      <div role="status" className={TONE[look.tone].box}>
        <p className={TONE[look.tone].text}>{look.headline}</p>

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

        {solution.solutionText ? (
          <div className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
            <MathText text={solution.solutionText} />
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
