---
paths:
  - "lib/engine/**"
  - "lib/content/**"
  - "content/templates/**"
---

<!-- Zielpfad im Repo: .claude/rules/engine.md -->

# Engine & Templates

Diese Regeln gelten nur für den deterministischen Kern. Das ausführliche Format
(Template-Schema, Registry-Signaturen, Grading-Tabelle) steht in `SPEC.md`,
Abschnitte 5 bis 7.

## Reinheit

`lib/engine` hat keine Seiteneffekte und kein I/O. Kein Prisma, kein `fetch`,
kein `fs`, kein React, kein `process.env`. Alles, was die Engine braucht, kommt
als Argument herein. Das ist die Voraussetzung dafür, dass sie vollständig ohne
Mocks testbar bleibt.

## Template-Instanziierung

- Templates beschreiben **Wertebereiche** (`param_spec`), keine festen Werte.
  Konkrete Werte gehören zur Instanz, zusammen mit dem Seed.
- Der Generator arbeitet mit Rejection Sampling gegen das `constraints`-Array,
  maximal 50 Versuche. Danach `TemplateUnsatisfiableError` werfen — nicht still
  eine kaputte Aufgabe zurückgeben.
- Constraints werden **nicht** mit `eval` ausgewertet, sondern über den Parser in
  `lib/engine/expr/` mit explizit übergebenem Scope (Grammatik `<expr> <op> <expr>`).
- Ein Constraint mit unbekanntem Namen oder kaputter Syntax wirft `TemplateConfigError`.
  Niemals still `false` liefern — sonst sieht der Bug wie ein unerfüllbares Template aus.
- Constraints werden zweimal geprüft: einmal auf den Parametern, einmal nach der
  Berechnung inklusive `result` (für Grenzen wie `result <= 1000000`).

## Beim Laden von Templates hart fehlschlagen

Der Build bricht ab, wenn eines davon verletzt ist:

- `compute_ref` existiert nicht in der Registry.
- Ein Platzhalter `{{x}}` in `question_text` hat keine Entsprechung in `param_spec`.
- Ein Parameter aus `param_spec` taucht nirgends im `question_text` auf und ist
  nicht als `type: const` markiert. Ungenutzte Zufallsparameter sind ein Bug.
- Das Zod-Input-Schema der Compute-Funktion passt nicht zu den `param_spec`-Keys.
- Die `id` ist schon vergeben, `topic` ist kein Blatt aus `content/topics.yaml`,
  `round_to` steht bei einem anderen `answer_type` als `numeric`, oder ein Constraint
  nennt einen unbekannten Namen.

Jede dieser Prüfungen hat ein Negativ-Fixture unter `lib/content/__fixtures__/`. Neue
Prüfung ⇒ neues Fixture, sonst weiß niemand, ob sie je anschlägt.

Platzhalter sind `{{name}}` (D-05). Einfache Klammern gehören LaTeX und werden nie
angefasst.

## Bewertung

Immer zweistufig: erst normalisieren, dann vergleichen. Nie direkter String-Vergleich.

- Nutzerausdrücke über `lib/engine/expr/` mit **leerem Scope**, Whitelist an Funktionen
  (`factorial`, `combinations`, `permutations`, `sqrt`, `abs`, Grundrechenarten).
  **Kein `mathjs`** — siehe `DECISIONS.md`, D-01: float64 macht den Vergleich ab `21!`
  still falsch. Gerechnet wird mit exakten Brüchen (`Rational`, D-06); `inexact` entsteht
  nur bei `sqrt` und darf keine Bewertung tragen.
- `120`, `5!` und `5*4*3*2*1` müssen als dieselbe Antwort gelten.
- Ein Parse-Fehler ist **nicht** dasselbe wie „falsch": `{ ok: false, reason: "unparseable" }`
  zurückgeben, damit die UI anders reagieren kann.
- Normalisierung ist pro `answer_type` verschieden. Bei `integer` bleibt `,` der
  Argumenttrenner (`combinations(10,3)`); die Regel `,` → `.` gehört laut SPEC-Tabelle
  ausschließlich zu `numeric`.

## Tests

Jede Änderung hier braucht Tests im selben Commit. Für Compute-Funktionen eine
Tabellensuite mit Randfällen, für Templates den 200-Seed-Durchlauf. Wenn du eine
Funktion nicht sinnvoll testen kannst, ist die Signatur falsch geschnitten.
