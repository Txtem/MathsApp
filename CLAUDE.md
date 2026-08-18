# MathsApp

Web-App zum Üben von Mathematik. Aufgaben entstehen aus versionierten Templates mit
zufälligen, validierten Parametern. Die richtige Lösung wird immer deterministisch
berechnet, nie von einem LLM.

Die vollständige Architektur — Datenmodell, Template-Format, API-Verträge, Meilensteine —
steht in `SPEC.md` im Repo-Root. Lies sie, bevor du an `lib/engine`, `content/templates`,
`prisma/schema.prisma` oder einer API-Route arbeitest. Nicht auswendig raten.

## Aktueller Stand

<!-- Diesen Block bei jedem Meilenstein von Hand aktualisieren. -->

- Meilenstein: **M0 (Skelett)**
- Fertig: Next.js-Scaffold (App Router, TS, Tailwind v4); Prisma 7 + SQLite,
  Modelle `User` (nur id/email), `Session`, `Attempt`, Migration `init`;
  `lib/db/client.ts` (Singleton + better-sqlite3-Adapter); Compute-Registry mit
  `arithmetik.add` / `arithmetik.subtract`; Vitest aufgesetzt.
  Engine-Kern: `lib/engine/expr/` (eigener Tokenizer/Parser/Evaluator auf BigInt,
  Funktions-Whitelist), `generate/` (seeded RNG, Sampling, Constraint-Prüfung),
  `render/interpolate.ts`, `grade/` für `answer_type: integer`,
  `instantiate.ts` mit Rejection Sampling (`MAX_TRIES = 50`);
  zwei Dev-Templates in `lib/content/dev-templates.ts` (Addition, Subtraktion);
  die drei Routen `POST /api/session`, `POST /api/session/[id]/next` und
  `POST /api/attempt/[id]/answer` inkl. Dummy-User (`lib/db/dev-user.ts`),
  Verträgen (`lib/api/contracts.ts`) und M0-Auswahl (`lib/selection/next-template.ts`);
  Oberfläche: Landing unter `app/(marketing)/`, Themenauswahl und Aufgaben-Loop
  unter `app/(app)/practice/` — 338 Tests grün, Loop gegen `npm run dev` durchgespielt
- Offen in M0: keine automatisierten Tests für die React-Komponenten (bräuchte
  jsdom + Testing Library, bewusst noch nicht hinzugefügt)
- Als Nächstes: Rückmeldung einholen, dann M1 (YAML-Loader, Zod-Content-Schema,
  Kombinatorik-Templates, KaTeX, restliche `answer_type`s)

### Lokale Einrichtung

`.env` und die SQLite-Datei sind gitignored und entstehen nicht beim Clone:

```bash
echo 'DATABASE_URL="file:./prisma/dev.db"' > .env
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
   Abhängigkeit auf `app/`, `lib/db` oder `lib/llm`.
6. **Zod an jeder Grenze**: Request-Bodies, YAML-Content, LLM-Ausgaben, `process.env`.
7. **LLM-Ausgaben nie ungeprüft übernehmen.** Jeder Modellaufruf braucht ein
   deterministisches Gate und einen Fallback.

## Stack-Eigenheiten

Diese weichen von den Defaults ab, die du sonst annehmen würdest:

- **Tailwind v4.** Konfiguration läuft über `@theme` in `app/globals.css`.
  Lege **keine** `tailwind.config.ts` an.
- **Kein `src/`-Verzeichnis.** `@/*` zeigt auf das Repo-Root.
- **YAML über das `yaml`-Package (YAML 1.2)**, nicht `js-yaml`. Sonst wird `ordered: no`
  zu `false` statt zum String.
- **Rechenergebnisse als `string` über `BigInt`**, nie als `number`. Ab `21!` ist `number`
  still ungenau.
- **`tsconfig.json` steht auf `target: ES2020`** (create-next-app liefert ES2017). Darunter
  verbietet TypeScript `0n`-Literale, und ohne die schreibt sich die Engine nicht lesbar.
- **Kein `mathjs`.** Ausdrücke laufen über den eigenen Parser in `lib/engine/expr/`,
  siehe Entscheidung E-01 unten.
- **SQLite statt PostgreSQL** (Abweichung von der Ursprungsfassung der SPEC).
  Prisma kennt für SQLite keine `enum`-Typen: `Attempt.status` ist ein `String`
  mit Default `"OPEN"`, gültige Werte `OPEN | ANSWERED | SKIPPED`, erzwungen über Zod.
- **Prisma 7.** Konfiguration liegt in `prisma.config.ts`, nicht mehr im Schema; `.env`
  wird nur über `import "dotenv/config"` dort geladen.
- **Prisma-Client importieren aus `@/lib/generated/prisma/client`**, nie aus
  `@prisma/client`. Der Client wird generiert, ist gitignored und entsteht über das
  `postinstall`-Skript nach jedem `npm install` neu.
- **Prisma 7 braucht einen Driver Adapter.** Für SQLite ist das
  `@prisma/adapter-better-sqlite3` (Treiber: `better-sqlite3`). Der Adapter wird im
  `PrismaClient`-Konstruktor übergeben, siehe `lib/db/client.ts`.
- **`Attempt.status` und `Attempt.answerType` sind `String`**, keine Enums. Erlaubte Werte
  (`OPEN | ANSWERED | SKIPPED` bzw. die `answer_type`-Liste aus SPEC.md Abschnitt 5)
  werden über Zod geprüft, nicht von der Datenbank.

## Getroffene Entscheidungen

Abweichungen von `SPEC.md`, die bewusst so gewählt wurden. Nicht ohne Rückfrage
zurückdrehen — die Gründe stehen dabei, weil sie sonst in der nächsten Session fehlen.

**E-01 — Eigener Ausdrucksparser statt `mathjs`** (2026-08-19, M0)
`SPEC.md` Abschnitt 7 nannte ursprünglich `mathjs.parse` + `evaluate`. Umgesetzt ist
stattdessen `lib/engine/expr/` (Tokenizer, rekursiver Abstiegsparser, Evaluator).
Grund: `mathjs` rechnet in float64, damit wäre der Vergleich ab `21!` still falsch — das
bricht die BigInt-Regel und Invariante 1. Zusätzlich hätten die `MathNode`-Typen `as`-Casts
erzwungen. Alle inhaltlichen Vorgaben bleiben erfüllt: kein `eval`, feste Grammatik,
Funktions-Whitelist (`factorial`, `combinations`, `permutations`, `sqrt`, `abs`,
Grundrechenarten), leerer Scope bei Nutzereingaben, `unparseable` ≠ falsch.
Derselbe Parser trägt auch die Constraint-Auswertung. Für `numeric`/`fraction` in M1 darf
`mathjs` zusätzlich dazukommen — als neue Entscheidung, nicht als Rückbau von `expr/`.

**E-02 — `tsconfig.json`: `target` von ES2017 auf ES2020** (2026-08-19, M0)
Unterhalb ES2020 lehnt TypeScript `0n`-Literale ab. Da die gesamte Engine auf `BigInt`
rechnet, wäre die Alternative `BigInt(0)` an hunderten Stellen. Next.js 16 kompiliert
ohnehin moderner; das Feld wirkt nur auf die Typprüfung.

**E-03 — Bei `answer_type: integer` bleibt `,` der Argumenttrenner** (2026-08-19, M0)
`combinations(10,3)` ist eine gültige Antwort, deshalb wird das Komma dort nicht zum
Dezimalpunkt. Die Grading-Tabelle in `SPEC.md` Abschnitt 7 ordnet die Regel `,` → `.`
ohnehin nur `numeric` zu. Folge: `2,5` gilt bei einer Ganzzahlfrage als „nicht lesbar",
nicht als „falsch" — was näher an der Wahrheit ist. `1,000` bleibt Tausendertrennung.

**E-04 — Eine unlesbare Antwort schließt den Attempt nicht** (2026-08-19, M0)
`SPEC.md` Abschnitt 8 lässt offen, was bei `parseError: "unparseable"` mit dem Attempt
passiert. Umgesetzt: Der Attempt bleibt `OPEN`, die Response enthält **kein**
`expectedAnswer` und keinen `solutionText`, der Nutzer darf es noch einmal eingeben.
Grund: Alles andere bräche Invariante 2 — die Lösung darf einen offenen Attempt nicht
verlassen — oder würde jemanden für einen Tippfehler die Aufgabe kosten. Ein Parse-Fehler
ist ausdrücklich nicht „falsch", genau deshalb gibt es das Feld.

## Konventionen

- TypeScript strict. Kein `any`, kein `as` außer bei nachweislich sicherem Narrowing.
- Neue Compute-Funktion ⇒ Unit-Tests im selben Commit, inklusive `n = 0`, `k = n`,
  `k > n`, großes `n`.
- Neues Template ⇒ Test, der 200 Seeds instanziiert und alle Constraints prüft.
- `import "server-only"` in allem unter `lib/db` und `lib/llm`.
- Dateien unter 300 Zeilen. Vorher aufteilen.
- Kleine, thematische Commits. Ein Meilenstein ist kein Commit.
- Am Ende eines Meilensteins stoppen und Rückmeldung einholen, nicht durchziehen.
- Bei Konflikt zwischen einer Chat-Anweisung und `SPEC.md`: nachfragen, nicht still
  vom Dokument abweichen.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
