import { MathText } from "@/components/MathText";
import { questionControls, type QuestionState } from "@/components/question-controls";

/**
 * Tipps und „Lösung zeigen" unter einer offenen Aufgabe.
 *
 * Geöffnete Tipps bleiben sichtbar, der Knopf öffnet den nächsten. „Lösung
 * zeigen" erscheint erst nach dem letzten Tipp — was sichtbar ist, entscheidet
 * `questionControls`; durchgesetzt wird die Regel vom Server.
 */
export function HintBox({
  state,
  busy,
  onHint,
  onGiveUp,
}: {
  state: QuestionState;
  busy: boolean;
  onHint: () => void;
  onGiveUp: () => void;
}) {
  const controls = questionControls(state);

  return (
    <div className="flex flex-col gap-3">
      {state.openedHints.length > 0 ? (
        <ol className="flex flex-col gap-2">
          {state.openedHints.map((hint, index) => (
            <li
              key={index}
              className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100"
            >
              <span className="font-medium">Tipp {index + 1}: </span>
              <MathText text={hint} />
            </li>
          ))}
        </ol>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {controls.hintButton ? (
          <button
            type="button"
            onClick={onHint}
            disabled={busy}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {controls.hintButton}
          </button>
        ) : null}

        {controls.showGiveUp ? (
          <button
            type="button"
            onClick={onGiveUp}
            disabled={busy}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Lösung zeigen
          </button>
        ) : null}
      </div>
    </div>
  );
}
