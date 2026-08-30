# MathsApp

Eine Web-App zum Üben von Mathematik auf Oberstufenniveau, mit Kombinatorik und
Wahrscheinlichkeitsrechnung als Anfang. Kein Aufgabenkatalog, sondern ein Generator:
Aus versionierten Templates entstehen durch zufällige, validierte Parameter beliebig
viele Aufgabeninstanzen. Die richtige Lösung wird dabei immer deterministisch in
TypeScript berechnet, nie von einem Sprachmodell — ein LLM darf später einen Text
umformulieren oder eine Handschrift lesen, aber nie entscheiden, ob eine Antwort
richtig ist.

## Lokale Einrichtung

`.env` und die SQLite-Datei sind gitignored und entstehen nicht beim Clone:

```bash
echo 'DATABASE_URL="file:./dev.db"' > .env
npm install          # baut better-sqlite3 nativ — braucht Python + Build Tools
npx prisma migrate dev
npm run dev          # http://localhost:3000
```

Ohne Python und Build Tools bleibt `npm install --ignore-scripts` plus
`npx prisma generate`: Die Engine und ihre Tests laufen damit, die Datenbank nicht.

## Befehle

```bash
npm run dev
npm run build
npm run lint
npm run content:check   # validiert alle Templates (läuft als pretest mit)
npx vitest run          # CI-Lauf
npx vitest              # Watch
npx prisma migrate dev --name <name>
npx prisma studio
```

## Dokumentation

| Datei | Inhalt |
|---|---|
| [`OVERVIEW.md`](OVERVIEW.md) | Orientierung: worum es geht, wo das Projekt steht, welche Datei welche Autorität hat. Zuerst lesen. |
| [`SPEC.md`](SPEC.md) | **Normativ.** Architektur, Datenmodell, Template-Format, API-Verträge, Meilensteine. |
| [`DECISIONS.md`](DECISIONS.md) | Warum die naheliegende Variante *nicht* gewählt wurde. Vor jedem Umbau lesen. |
| [`CLAUDE.md`](CLAUDE.md) | Arbeitsregeln für Claude Code, aktueller Stand, Stack-Fallen. |

Bei einem Widerspruch zwischen den Dokumenten gilt `SPEC.md`.
