---
paths:
  - "app/api/**"
  - "lib/db/**"
  - "lib/llm/**"
  - "prisma/**"
---

<!-- Zielpfad im Repo: .claude/rules/api.md -->

# API, Datenbank, LLM

Die vollständigen Request- und Response-Verträge stehen in `SPEC.md`, Abschnitt 8.
Lies sie, bevor du eine Route anlegst oder änderst.

## Antwort-Leakage

Der wichtigste Vertrag im System: `expectedAnswer` und `solution_text` erscheinen in
**keiner** Response, solange der Attempt `status: OPEN` hat. Auch nicht in einem Feld,
das das Frontend gerade nicht rendert — es steht trotzdem im Network-Tab.

Erst `POST /api/attempt/[id]/answer` darf beides zurückgeben, und nur, nachdem der
Status auf `ANSWERED` gesetzt wurde.

## Autorisierung an jeder Route

Vor jedem Zugriff auf einen `Attempt` prüfen:

1. Der Attempt gehört zur Session des eingeloggten Users.
2. Der Status erlaubt die Operation (ein zweiter Antwortversuch auf denselben
   Attempt wird abgelehnt, nicht neu bewertet).

Keine Route vertraut einer ID aus dem Request-Body ohne diese beiden Prüfungen.

## Route Handlers vs. Server Actions

- **Route Handler** für alles, was streamt oder ein LLM aufruft.
- **Server Action** für einfache Mutationen ohne Streaming.
- Nicht mischen innerhalb eines Flows.

## Server-only

`import "server-only"` ganz oben in jeder Datei unter `lib/db` und `lib/llm`.
Der Prisma-Client ist ein Singleton (Dev-HMR erzeugt sonst Connection-Leaks).

## LLM-Aufrufe

Erlaubt sind genau drei Einsatzorte: Einkleidung des Aufgabentexts, Transkription,
Schritt-Review. Nicht erlaubt: Lösung berechnen, über richtig/falsch entscheiden,
Parameter würfeln, Plausibilität von Werten beurteilen.

- Prompts liegen als versionierte Dateien in `lib/llm/prompts/`, nie inline im Code.
- Jede Ausgabe geht durch ein Gate in `lib/llm/gates/` mit deterministischem Fallback.
- Beim Schritt-Review bekommt das Modell die richtige Lösung **nicht** — es soll
  unabhängig nachrechnen, statt auf das Zielergebnis hinzuargumentieren.

## Migrationen

Schema-Änderungen immer über `npx prisma migrate dev --name <name>`, nie durch
manuelles Editieren einer bestehenden Migration. Migrationsdateien werden committet.
