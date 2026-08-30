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

`import "server-only"` ganz oben in jedem Modul unter `lib/db` und `lib/llm`, das sich
seine Umgebung selbst holt — den Prisma-Singleton, `process.env`, das Dateisystem.
Der Prisma-Client ist ein Singleton (Dev-HMR erzeugt sonst Connection-Leaks), und er
trägt das `server-only`.

Module, die ihren Client als Parameter bekommen, tragen es **nicht** — sonst wären sie
nicht testbar, weil `server-only` unter Vitest wirft. Das betrifft `lib/db/attempts.ts`,
`lib/db/answer-attempt.ts` und `lib/db/topic-stats.ts`. Begründung in D-12 und D-19.

## Routen sind Adapter

Eine Route liest den Request, ermittelt den Nutzer über `getCurrentUserId()` und bildet
ein Ergebnis auf Statuscodes ab. Die Entscheidungen selbst — was die Antwort enthält, ob
ein Attempt geschlossen wird — stehen in einem Modul unter `lib/`, das seine Umgebung als
Parameter bekommt. Eine Route lässt sich nicht importieren und wäre sonst ungetestet.

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

Muss eine Migration zusätzlich **Daten** anfassen — Bestandszeilen umschreiben, eine neue
Pflichtspalte füllen —, entsteht sie über `--create-only`; das SQL wird ergänzt, bevor sie
zum ersten Mal läuft. Eine Migration, die schon gelaufen ist, wird nicht mehr angefasst.

Zeitstempel setzt der Anwendungscode, nicht die Datenbank: kein `@default(now())`, kein
`DEFAULT CURRENT_TIMESTAMP`. Siehe D-20.
