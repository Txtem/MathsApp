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
  Modelle `User` (nur id/email), `Session`, `Attempt`, Migration `init` angewendet;
  `lib/db/client.ts` (Singleton + better-sqlite3-Adapter); Compute-Registry mit
  `arithmetik.add` / `arithmetik.subtract`; Vitest aufgesetzt
- Als Nächstes: `lib/engine/instantiate.ts` und `lib/engine/grade/` in der minimalen
  Form (`answer_type: integer`), dann die zwei Dev-Templates

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