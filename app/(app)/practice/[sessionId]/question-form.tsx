import { answerFormatHint } from "@/components/answer-format";
import { MathText } from "@/components/MathText";
import { questionControls, type QuestionState } from "@/components/question-controls";
import type { NextQuestionResponse } from "@/lib/api/contracts";

import { HintBox } from "./hint-box";

/**
 * Die offene Aufgabe: Frage, Eingabe, Meldungen, darunter Tipps und
 * „Lösung zeigen". Im zweiten Versuch steht das neben der Beschriftung.
 */
export function QuestionForm({
  question,
  hints,
  answer,
  notice,
  busy,
  onAnswer,
  onSubmit,
  onHint,
  onGiveUp,
}: {
  question: NextQuestionResponse;
  hints: QuestionState;
  answer: string;
  notice: string | null;
  busy: boolean;
  onAnswer: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onHint: () => void;
  onGiveUp: () => void;
}) {
  const { attemptLine } = questionControls(hints);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <p className="text-sm text-zinc-500">
        {question.topic} · Schwierigkeit {question.difficulty} · Richtzeit{" "}
        {question.targetTimeSeconds} s
      </p>

      <div className="text-2xl leading-relaxed text-zinc-900 dark:text-zinc-50">
        <MathText text={question.questionText} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="answer" className="text-sm text-zinc-600 dark:text-zinc-400">
          Deine Antwort
          {attemptLine ? (
            <span className="ml-2 font-medium text-amber-700 dark:text-amber-400">
              · {attemptLine}
            </span>
          ) : null}
        </label>
        <input
          id="answer"
          value={answer}
          onChange={(event) => onAnswer(event.target.value)}
          autoFocus
          autoComplete="off"
          maxLength={200}
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 font-mono text-lg text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-300"
        />
        <p className="text-sm text-zinc-500">
          {answerFormatHint(question.answerType, question.roundTo)}
        </p>
        {notice ? (
          <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">
            {notice}
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

      <HintBox state={hints} busy={busy} onHint={onHint} onGiveUp={onGiveUp} />
    </form>
  );
}
