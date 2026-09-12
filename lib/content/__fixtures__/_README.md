# Negativ-Fixtures

Für jede statische Prüfung aus `checks.ts` ein Template, das genau daran
scheitert — und nur daran. Sie sind die Gegenprobe: Eine Prüfung, die nie
anschlägt, ist keine Prüfung.

Diese Dateien liegen bewusst nicht unter `content/`, damit `npm run content:check`
sie nicht einliest.

## Eine Prüfung ohne Fixture

`display_key_collision` — ein Anzeigewert der Compute-Funktion, der wie ein
Parameter heißt — hat keines, und zwar aus einem Grund, nicht aus Nachlässigkeit:
Gegen die heutige Registry lässt sich der Fall nicht bauen. Jeder Eintrag mit
Anzeigewerten hat ein `strictObject` als Eingabeschema; ein Template mit dem
kollidierenden Parameter fiele deshalb schon über Prüfung 5, und das Fixture
meldete zwei Codes statt einem.

Geprüft wird die Regel stattdessen direkt an der reinen Funktion
`collidingDisplayKeys` in `checks.test.ts`. Sobald ein Registry-Eintrag
Anzeigewerte und ein offeneres Schema hat, gehört das Fixture nachgereicht.
