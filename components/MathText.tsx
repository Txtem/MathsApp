import katex from "katex";

import { splitMath } from "./split-math";

/**
 * Setzt einen Aufgabentext mit Formeln.
 *
 * `katex.renderToString` statt `react-katex`: Die Funktion aus dem
 * `katex`-Paket reicht, läuft ohne zusätzliche Abhängigkeit und funktioniert in
 * Server- wie Client-Komponenten.
 *
 * `throwOnError: false` zeigt einen kaputten Ausdruck rot an, statt die Seite
 * zu zerlegen. `trust: false` verbietet KaTeX-Befehle wie `\href` oder
 * `\includegraphics` — der HTML-Output ist damit unbedenklich, und die Eingabe
 * stammt ohnehin aus dem eigenen Content, nie von Nutzern.
 */
export function MathText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {splitMath(text).map((segment, index) =>
        segment.kind === "text" ? (
          <span key={index} className="whitespace-pre-wrap">
            {segment.value}
          </span>
        ) : (
          <span
            key={index}
            className={segment.display ? "my-2 block overflow-x-auto" : "inline-block"}
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(segment.value, {
                displayMode: segment.display,
                throwOnError: false,
                trust: false,
                strict: "ignore",
              }),
            }}
          />
        ),
      )}
    </span>
  );
}
