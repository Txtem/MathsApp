# MathsApp

Zur Orientierung: OVERVIEW.md

Web-App zum Üben von Mathematik. Aufgaben entstehen aus versionierten Templates mit
zufälligen, validierten Parametern. Die richtige Lösung wird immer deterministisch
berechnet, nie von einem LLM.

Die vollständige Architektur — Datenmodell, Template-Format, API-Verträge, Meilensteine —
steht in `SPEC.md` im Repo-Root. Lies sie, bevor du an `lib/engine`, `lib/content`,
`content/`, `prisma/schema.prisma` oder einer API-Route arbeitest. Nicht auswendig raten.

Bewusste Abweichungen von `SPEC.md` mit ihrer Begründung stehen in `DECISIONS.md`.
Lies die Datei, bevor du eine bestehende Lösung umbaust — dort steht meistens, warum
die naheliegende Variante nicht gewählt wurde.

## Aktueller Stand

<!-- Diesen Block bei jedem Meilenstein von Hand aktualisieren. -->

- Meilenstein: **M2b (Auswahl, Zeit und Termine)** abgeschlossen
- M0: Next.js-Scaffold, Prisma 7 + SQLite, Engine-Kern, drei API-Routen, Practice-Loop
- M1: Platzhalter `{{name}}`; exakte Brüche (`lib/engine/expr/rational.ts`); Themenbaum
  `content/topics.yaml`; Content-Pipeline mit neun statischen Prüfungen und
  `npm run content:check`; zwölf Compute-Funktionen; zwölf Templates als YAML;
  Grading für `integer`, `numeric`, `fraction`, `choice` inkl. `round_to`;
  KaTeX über `components/MathText.tsx`
- M2a: Übungsrunde heißt `PracticeSession` (D-17); `Attempt` trägt `userId`, `topic` und
  `difficulty` denormalisiert (D-18); `getCurrentUserId()` als einzige Nutzerquelle;
  `TopicMastery` mit SM-2-light, fortgeschrieben in derselben Transaktion wie der
  Statuswechsel; Auswahl nach Erfolgsquote, Fälligkeit und Schwierigkeit in
  `lib/selection/`; Statistik-Seite unter `/stats`; Entscheidungslogik der
  Antwort-Route in `lib/db/answer-attempt.ts`, damit Invariante 2 getestet ist;
  Datenbanktests gegen eine Wegwerf-SQLite (D-19)
- M2b: eine Uhr pro Anfrage, `now` als Parameter statt `@default(now())` (D-20);
  Termine relativ statt als Datum (D-22); harte Sperre auf die identische Aufgabe,
  weiche Abwertung auf zuletzt gestellte Templates mit gemessenen Faktoren
  (D-24, D-25); Parameterraum je Template in `content:check` mit Warnung unter 20;
  Medianzeit nur über richtige Antworten und relativ zur Zielzeit (D-21) —
  955 Tests grün
- Offen: keine Tests für React-Komponenten (bräuchte jsdom + Testing Library, bewusst
  zurückgestellt); `kombinatorik.permutation` liefert nur sieben verschiedene Aufgaben
  und wiederholt sich ab der achten — das ist M2d
- Als Nächstes: M2d — Content-Tiefe, siehe `SPEC-M2d.md`. Danach M2c (Auth.js):
  ersetzt den Rumpf von `getCurrentUserId()`, dazu Login-Oberfläche und Routenschutz.
  `User.email` muss dafür optional werden.

### Lokale Einrichtung

`.env` und die SQLite-Datei sind gitignored und entstehen nicht beim Clone:

```bash
echo 'DATABASE_URL="file:./dev.db"' > .env
npm install          # baut better-sqlite3 nativ — braucht Python + Build Tools
npx prisma migrate dev
```

Ohne Python/Build Tools bleibt `npm install --ignore-scripts` + `npx prisma generate`:
Die Engine und ihre Tests laufen damit, die Datenbank nicht.

## Befehle

```bash
npm run dev
npm run build
npm run lint
npm run content:check   # validiert alle Templates (läuft als pretest mit)
npx prisma migrate dev --name <name>
npx prisma studio
npx vitest run          # CI-Lauf
npx vitest              # Watch
```

## Harte Regeln

Verstöße sind Bugs, keine Trade-offs.

1. **Determinismus vor LLM.** Jede Zahl, die über richtig/falsch entscheidet, kommt aus
   reinem TypeScript, nie aus einem Modellaufruf.
2. **`expectedAnswer` verlässt den Server nicht**, solange der Attempt `status: OPEN` hat —
   nicht im JSON, nicht als Hash, nicht in einem Kommentar.
3. **Reproduzierbarkeit.** Seed, `templateId` und `templateVersion` werden bei jedem
   Attempt persistiert.
4. **Kein `eval`, kein dynamischer Import aus Content.** `compute_ref` ist ein Schlüssel in
   einer statischen Registry, also eine Whitelist.
5. **`lib/engine` ist rein.** Kein DB-, Netz- oder Dateizugriff, kein React-Import, keine
   Abhängigkeit auf `app/`, `lib/db`, `lib/content` oder `lib/llm`. Templates werden der
   Engine übergeben, nicht von ihr geladen.
6. **Zod an jeder Grenze**: Request-Bodies, YAML-Content, LLM-Ausgaben, `process.env`.
7. **LLM-Ausgaben nie ungeprüft übernehmen.** Jeder Modellaufruf braucht ein
   deterministisches Gate und einen Fallback.
8. **Exakt rechnen.** Der Ausdruckskern arbeitet mit `BigInt` und exakten Brüchen.
   Float ist ausschließlich für irrationale Zwischenwerte zulässig und muss dort im
   Wertetyp als solcher markiert sein.

## Stack-Eigenheiten

Diese weichen von den Defaults ab, die du sonst annehmen würdest:

- **Platzhalter sind `{{name}}`, nicht `{name}`.** Einfache geschweifte Klammern gehören
  LaTeX (`\frac{1}{2}`) und werden von `interpolate` nie angefasst. Siehe D-05.
- **Formelsatz mit KaTeX**, `$…$` inline und `$$…$$` abgesetzt, gerendert **nach** der
  Interpolation über `components/MathText.tsx`. Kein `react-katex`.
- **Kein `mathjs`.** Ausdrücke laufen über den eigenen Parser in `lib/engine/expr/`,
  siehe D-01.
- **Rechenergebnisse als exakte Brüche (`Rational`) über `BigInt`**, nie als `number`.
  Ab `21!` ist `number` still ungenau.
- **Tailwind v4.** Konfiguration über `@theme` in `app/globals.css`.
  Lege **keine** `tailwind.config.ts` an.
- **Kein `src/`-Verzeichnis.** `@/*` zeigt auf das Repo-Root.
- **YAML über das `yaml`-Package (YAML 1.2)**, nicht `js-yaml`. Sonst wird `ordered: no`
  zu `false` statt zum String.
- **`tsconfig.json` steht auf `target: ES2020`** (create-next-app liefert ES2017). Darunter
  verbietet TypeScript `0n`-Literale.
- **SQLite statt PostgreSQL.** Prisma kennt für SQLite keine `enum`-Typen:
  `Attempt.status` und `Attempt.answerType` sind `String`, gültige Werte werden über Zod
  erzwungen, nicht von der Datenbank.
- **Prisma 7.** Konfiguration in `prisma.config.ts`, nicht im Schema; `.env` wird dort
  über `import "dotenv/config"` geladen. Client importieren aus
  `@/lib/generated/prisma/client`, nie aus `@prisma/client` — er ist generiert, gitignored
  und entsteht über `postinstall` neu.
- **Prisma 7 braucht einen Driver Adapter**: `@prisma/adapter-better-sqlite3`, übergeben im
  `PrismaClient`-Konstruktor, siehe `lib/db/client.ts`.
- **`content/` wird von Next.js nicht automatisch gebündelt.** Der Ordner muss in
  `next.config.ts` unter `outputFileTracingIncludes` stehen, sonst fehlen die Templates im
  Produktions-Build. Lokal fällt das nie auf.
- **Keine `DateTime`-Spalte hat `@default(now())`.** Zeitstempel entstehen im
  Anwendungscode aus dem einen `now`, das die Anfrage hereinreicht. Zwei Gründe: Der
  SQLite-Default schreibt ein anderes Textformat als der Adapter (`2026-08-30 18:31:27`
  gegen `…T…+00:00`), und SQLite vergleicht Text — auf einer Spalte, nach der sortiert
  wird. Und was sich die Datenbank selbst holt, ist in keinem Test steuerbar. Siehe D-20.
- **`now: Date` ist ein Pflichtparameter, kein optionales Extra.** Jede Funktion, die
  einen Zeitpunkt braucht, bekommt ihn; `new Date()` steht ausschließlich in einem
  Einstiegspunkt (`route.ts`, `page.tsx`). `lib/db/one-clock.test.ts` erzwingt das über
  den Quelltext.

## Konventionen

- TypeScript strict. Kein `any`, kein `as` außer bei nachweislich sicherem Narrowing.
- Neue Compute-Funktion ⇒ Unit-Tests im selben Commit, inklusive `n = 0`, `k = 0`,
  `k = n`, `k > n` (muss abgelehnt werden), großes `n`.
- Neues Template ⇒ Property-Test mit 200 Seeds: keine Exception, alle Constraints erfüllt,
  kein Platzhalterrest im gerenderten Text.
- Neue statische Content-Prüfung ⇒ Negativ-Fixture, das genau daran scheitert.
- Kein Normalizer ohne Template, das ihn benutzt.
- **Wer eine Funktion extrahiert, damit ein Test sie direkt aufrufen kann, braucht einen
  Test, der zeigt, dass der Anwendungspfad dieselbe Funktion benutzt.** Sonst misst der
  Test toten Code, und die Extraktion ist selbst der Bug. Beleg: Nach dem Herausziehen von
  `candidateWeights` lief die Parametersuche in `distribution.test.ts` nicht mehr durch
  `selectTemplate` — die gemessenen Abwertungsfaktoren hätten für einen Pfad gegolten, den
  die Anwendung nie nimmt. Dieselbe Überlegung wie D-12 und D-19, nur die Kehrseite.
- `import "server-only"` in jedem Modul unter `lib/db`, `lib/content` und `lib/llm`,
  **das sich seine Umgebung selbst holt** — den Prisma-Singleton, `process.env`, das
  Dateisystem. Das sind heute `lib/db/client.ts` und `lib/content/load.ts`.
  Module, die ihre Umgebung als Parameter bekommen, tragen es nicht: Sie sind damit
  ohne laufenden Server testbar, und genau daran hing bis M2a die einzige ungetestete
  Stelle von Invariante 2. Siehe D-12 und D-19.
- Dateien unter 300 Zeilen. Vorher aufteilen.
- Kleine, thematische Commits. Ein Meilenstein ist kein Commit.
- Am Ende eines Meilensteins stoppen und Rückmeldung einholen, nicht durchziehen.
- Bei Konflikt zwischen einer Chat-Anweisung und `SPEC.md`: nachfragen, nicht still
  vom Dokument abweichen. Eine bewusste Abweichung gehört als neuer Eintrag nach
  `DECISIONS.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
