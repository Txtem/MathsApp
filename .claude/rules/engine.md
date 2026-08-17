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
- Constraints werden **nicht** mit `eval` ausgewertet. Entweder der Mini-Parser für
  `<expr> <op> <expr>` oder `mathjs.evaluate` mit explizit übergebenem Scope.
- Constraints werden zweimal geprüft: einmal auf den Parametern, einmal nach der
  Berechnung inklusive `result` (für Grenzen wie `result <= 1000000`).

## Beim Laden von Templates hart fehlschlagen

Der Build bricht ab, wenn eines davon verletzt ist:

- `compute_ref` existiert nicht in der Registry.
- Ein Platzhalter `{x}` in `question_text` hat keine Entsprechung in `param_spec`.
- Ein Parameter aus `param_spec` taucht nirgends im `question_text` auf und ist
  nicht als `type: const` markiert. Ungenutzte Zufallsparameter sind ein Bug.
- Das Zod-Input-Schema der Compute-Funktion passt nicht zu den `param_spec`-Keys.

## Bewertung

Immer zweistufig: erst normalisieren, dann vergleichen. Nie direkter String-Vergleich.

- Nutzerausdrücke über `mathjs.parse` + `evaluate` mit **leerem Scope**, Whitelist an
  Funktionen (`factorial`, `combinations`, `permutations`, `sqrt`, `abs`, Grundrechenarten).
- `120`, `5!` und `5*4*3*2*1` müssen als dieselbe Antwort gelten.
- Ein Parse-Fehler ist **nicht** dasselbe wie „falsch": `{ ok: false, reason: "unparseable" }`
  zurückgeben, damit die UI anders reagieren kann.

## Tests

Jede Änderung hier braucht Tests im selben Commit. Für Compute-Funktionen eine
Tabellensuite mit Randfällen, für Templates den 200-Seed-Durchlauf. Wenn du eine
Funktion nicht sinnvoll testen kannst, ist die Signatur falsch geschnitten.
