# Negativ-Fixtures

Für jede statische Prüfung aus `checks.ts` ein Template, das genau daran
scheitert — und nur daran. Sie sind die Gegenprobe: Eine Prüfung, die nie
anschlägt, ist keine Prüfung.

Diese Dateien liegen bewusst nicht unter `content/`, damit `npm run content:check`
sie nicht einliest.
