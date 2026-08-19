import { MathText } from "@/components/MathText";
import type { AnswerResponse } from "@/lib/api/contracts";

/** Die geschlossene Aufgabe: Urteil, Musterlösung, Lösungsweg. */
export function VerdictPanel({
  verdict,
  onNext,
}: {
  verdict: Extract<AnswerResponse, { expectedAnswer: string }>;
  onNext: () => void;
}) {
  const correct = verdict.isCorrect;

  return (
    <div className="flex flex-col gap-4">
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
          {correct ? "Richtig." : `Falsch. Richtig wäre ${verdict.expectedAnswer} gewesen.`}
        </p>
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
