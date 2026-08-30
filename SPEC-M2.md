# SPEC-M2 — Änderungen an `SPEC.md` für Meilenstein M2

> Arbeitsanweisung. Wird in `SPEC.md` eingearbeitet und danach gelöscht.
> „Ersetze" meint den ganzen genannten Abschnitt, „ergänze" meint anhängen.

---

## A. Vorab: vier Befunde, die zuerst geklärt werden

Diese Punkte sind beim Durchsehen der aktuellen Dokumente aufgefallen. Punkt 1 und 2 sind
Entscheidungen, Punkt 3 und 4 sind Korrekturen. Arbeite sie ab, **bevor** du mit dem
Datenmodell weitermachst.

### A-1 — `Session` kollidiert mit Auth.js *(Entscheidung nötig)*

Der Prisma-Adapter von Auth.js definiert ein Modell namens `Session` (Felder
`sessionToken`, `userId`, `expires`). Das Projekt hat bereits ein `Session`-Modell für
eine Übungsrunde. Prisma-Modellnamen sind im Schema eindeutig — beides nebeneinander
geht nicht.

**Umsetzung:** Domänenmodell in `PracticeSession` umbenennen, inklusive Relationsfeldern
(`Attempt.practiceSessionId`, `User.practiceSessions`). Die HTTP-Routen bleiben unter
`/api/session` und `/practice/[sessionId]`, damit die Umbenennung nicht durch die ganze
UI läuft — die Route ist ein URL-Pfad, kein Modellname.

Nimm das als neuen Eintrag `D-17` in `DECISIONS.md` auf.

Falls du beim Einbau von Auth (M2b) feststellst, dass die gewählte Strategie gar keine
Session-Tabelle braucht: Die Umbenennung bleibt trotzdem, weil zwei Bedeutungen von
„Session" im selben Projekt eine Fehlerquelle sind.

### A-2 — Die Auswahl-Logik passt nicht zum Datenmodell *(Entscheidung nötig)*

`SPEC.md` Abschnitt 10 verlangt die Erfolgsquote „über die letzten 10 Versuche".
`TopicMastery` speichert nur kumulative Zähler (`attempts`, `correct`) — daraus lässt
sich keine gleitende Quote rekonstruieren. Zusätzlich kennt `Attempt` sein Topic nicht,
sondern nur `templateId`.

**Umsetzung:**

- `Attempt` bekommt `topic: String` und `difficulty: Int`, beide beim Anlegen aus dem
  Template denormalisiert. Grund: Die Statistik-Seite und die Auswahl fragen nach Topic,
  nicht nach Template; und ein gelöschtes oder umbenanntes Template darf die Historie
  nicht entwerten.
- Die gleitende Erfolgsquote wird aus den letzten zehn beantworteten Attempts eines
  Topics gelesen, nicht aus `TopicMastery`.
- `TopicMastery` behält `attempts`/`correct` als Gesamtzahlen für die Statistik-Seite
  und trägt zusätzlich die Terminplanung (`dueAt`, `intervalDays`).

Nimm das als `D-18` auf.

### A-3 — Veraltete Codebeispiele in `SPEC.md` *(Korrektur)*

- **Abschnitt 4:** Der Prisma-Block zeigt `status AttemptStatus @default(OPEN)` und
  `enum AttemptStatus { OPEN ANSWERED SKIPPED }`, obwohl der Absatz in Abschnitt 2 sagt,
  dass es ein `String` mit Default `"OPEN"` ist. Bring den Block auf den echten Stand
  von `prisma/schema.prisma`.
- **Abschnitt 6:** Das `instantiate`-Beispiel ruft `entry.input.safeParse(params)` und
  `entry.compute(...)` auf. D-14 hat genau das ersetzt: `instantiate` ruft ausschließlich
  `entry.run(params)`. Schreib das Beispiel auf den tatsächlichen Code um.
- **Abschnitt 6:** Das Registry-Beispiel gibt `.toString()` zurück, während der Text
  darunter `Rational` verlangt, und benutzt `compute_ref`s, die es nicht gibt
  (`kombinatorik.permutation.permute`, `kombinatorik.kombination.choose`). Ersetze es
  durch zwei echte Einträge aus `lib/engine/compute/registry.ts`.

Diese Blöcke sind gefährlicher als normale Doku-Drift: `SPEC.md` ist normativ, und ein
Codebeispiel wird als Vorlage gelesen.

### A-4 — `README.md` *(Korrektur)*

Noch das create-next-app-Original. Ersetze es durch: was das Projekt ist (drei Sätze),
lokale Einrichtung (aus `CLAUDE.md` übernehmen), die wichtigsten Befehle, und Verweise
auf `OVERVIEW.md`, `SPEC.md`, `DECISIONS.md`.

---

## B. Aufteilung von M2

M2 aus Abschnitt 11 bündelt vier unabhängige Dinge. Es wird geteilt:

**M2a — Fortschritt und Auswahl.** Datenmodell, Mastery-Fortschreibung, Auswahl-Logik,
Statistik-Seite. Läuft weiterhin auf dem Dummy-User, aber hinter einer Funktion
`getCurrentUserId()`.

**M2b — Auth.js.** Ersetzt ausschließlich die Implementierung von `getCurrentUserId()`
plus Login-Oberfläche und Routenschutz.

**Grund:** Fortschritt und Auswahl sind der Produktwert und vollständig ohne Login
testbar. Auth ist Infrastruktur und gleichzeitig die riskanteste Integration im Projekt
(Next.js 16 + Prisma 7 + Auth.js v5 gleichzeitig). Scheitert M2b, bleibt trotzdem eine
App, die sich an die Schwächen des Übenden anpasst.

Dieses Dokument beschreibt **M2a**. M2b wird geplant, wenn M2a steht.

---

## C. Ersetze Abschnitt 4 (Datenmodell)

Änderungen gegenüber der jetzigen Fassung:

```prisma
model PracticeSession {              // umbenannt von Session, siehe A-1
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  topicFilter String?
  startedAt   DateTime @default(now())
  endedAt     DateTime?
  attempts    Attempt[]
}

model Attempt {
  id                String   @id @default(cuid())
  practiceSessionId String
  practiceSession   PracticeSession @relation(fields: [practiceSessionId], references: [id])

  templateId      String
  templateVersion Int
  seed            String
  params          Json
  questionText    String

  topic           String           // NEU, denormalisiert beim Anlegen
  difficulty      Int              // NEU, denormalisiert beim Anlegen

  expectedAnswer  Json
  answerType      String

  userAnswer      String?
  imageUrl        String?
  transcript      String?

  status          String   @default("OPEN")   // kein Enum, siehe SQLite-Konsequenz
  isCorrect       Boolean?
  reviewVerdict   Json?
  durationMs      Int?

  createdAt       DateTime @default(now())
  answeredAt      DateTime?

  @@index([practiceSessionId])
  @@index([topic, answeredAt])       // NEU, trägt die gleitende Erfolgsquote
}

model TopicMastery {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  topic        String
  attempts     Int      @default(0)      // Gesamtzahl, für die Statistik-Seite
  correct      Int      @default(0)
  lastSeenAt   DateTime?
  dueAt        DateTime?
  intervalDays Float    @default(1)

  @@unique([userId, topic])
}
```

`topic` und `difficulty` auf dem Attempt sind bewusst redundant zum Template. Sie machen
Statistik und Auswahl zu einfachen Abfragen und halten die Historie stabil, wenn ein
Template später verschwindet oder sein Topic wechselt.

Migration: eine neue Migration, kein Editieren der bestehenden. Vorhandene Attempts in
der lokalen `dev.db` dürfen dabei verloren gehen — es sind Testdaten.

---

## D. Ersetze Abschnitt 10 (Aufgabenauswahl)

Alles in `lib/selection/`, weiterhin ohne I/O in `lib/engine`.

### D-1 Kandidaten

Templates, deren `topic` unter dem `topicFilter` der `PracticeSession` liegt. Steht der
Filter auf einem inneren Knoten, zählen alle Blätter darunter.

### D-2 Themenwahl

Pro Kandidaten-Topic:

```
score = (1 - erfolgsquote) * 2 + faelligkeitsbonus
```

- `erfolgsquote`: Anteil korrekter unter den **letzten zehn beantworteten** Attempts des
  Nutzers in diesem Topic. Weniger als drei Attempts ⇒ Topic gilt als unerprobt und
  bekommt `erfolgsquote = 0.5`, damit weder Bevorzugung noch Meidung entsteht.
- `faelligkeitsbonus`: `1`, wenn `TopicMastery.dueAt <= now`, sonst `0`.
  Kein `TopicMastery`-Eintrag ⇒ fällig.

Höchster Score gewinnt. Bei Gleichstand entscheidet der ältere `lastSeenAt`.

### D-3 Templatewahl innerhalb des Topics

Zielschwierigkeit aus der Erfolgsquote:

| Erfolgsquote | Zielschwierigkeit |
|---|---|
| < 0.4 | 1 |
| 0.4 – 0.7 | 2 |
| 0.7 – 0.9 | 3 |
| > 0.9 | 4 |

Gewicht eines Templates: `1 / (1 + |difficulty - zielschwierigkeit|)`. Danach gewichtet
ziehen. Ein Topic ohne Template auf der Zielschwierigkeit fällt so automatisch auf die
nächstliegende zurück, ohne Sonderfall im Code.

### D-4 Wiederholungsvermeidung

Die letzten drei `templateId`s dieser `PracticeSession` ausschließen. Bleibt danach kein
Kandidat übrig, wird die Sperre für diesen Zug ignoriert statt zu scheitern — bei einem
Topic mit nur zwei Templates ist Wiederholung besser als ein Abbruch.

### D-5 Fortschreibung nach der Antwort

Beim Schließen eines Attempts, in derselben Transaktion wie der Statuswechsel:

- `TopicMastery` upsert: `attempts + 1`, bei richtig `correct + 1`, `lastSeenAt = now`.
- SM-2-light: richtig ⇒ `intervalDays *= 2` (Deckel bei 60), falsch ⇒ `intervalDays = 1`.
- `dueAt = now + intervalDays`.

**Wichtig:** Die Fortschreibung passiert nur, wenn der `updateMany` mit der Bedingung
`status: "OPEN"` tatsächlich eine Zeile getroffen hat. Sonst zählt ein doppeltes Absenden
zweimal. Ein `unparseable` schließt den Attempt nicht (D-04) und schreibt folglich auch
nichts fort.

### D-6 Reinheit

Score-Berechnung, Zielschwierigkeit und gewichtetes Ziehen sind **reine Funktionen** mit
eigenen Tests: Eingabe sind Statistiken und Kandidaten, nicht die Datenbank. Der
DB-Zugriff liegt in einer dünnen Schicht darüber. Das ist dieselbe Trennung wie bei
`components/topic-groups.ts` — und aus demselben Grund, siehe D-16.

Kein Elo, kein Bayesian Knowledge Tracing. Das kann später ersetzt werden, deshalb liegt
alles hinter einer Funktion mit klarer Signatur.

---

## E. Neuer Abschnitt 10a — Statistik-Seite

`app/(app)/stats/page.tsx`, Server Component.

Pro Topic eine Zeile: Beschriftung aus dem Themenbaum, Gesamtzahl der Versuche,
Erfolgsquote gesamt, Erfolgsquote der letzten zehn, `dueAt` als „fällig" oder Datum.
Gruppiert nach Oberthema, in derselben Form wie die Themenauswahl (D-16).

Dazu eine Gesamtzeile: Versuche insgesamt, Quote insgesamt, Median der Bearbeitungszeit
gegen `target_time_seconds`.

Kein Diagramm in M2a. Ein Zeitverlauf braucht mehr Daten, als bisher existieren; eine
Kurve über zwölf Attempts sieht nach Aussage aus, wo keine ist.

---

## F. Ergänze Abschnitt 8 — Nutzerermittlung

Neue Datei `lib/auth/current-user.ts`:

```ts
export async function getCurrentUserId(): Promise<string>
```

In M2a gibt sie den Dev-User zurück (bisher `lib/db/dev-user.ts`). In M2b liest sie die
Auth.js-Session und wirft bei fehlender Anmeldung.

**Jede** Route und jede Server Component, die einen Nutzer braucht, ruft ab sofort diese
Funktion — nie direkt den Dev-User. Das ist der einzige Grund, warum M2b später klein
bleibt.

---

## G. Reihenfolge der Umsetzung

Jeder Schritt endet mit grünen Tests und einem Commit.

**Schritt 1 — Befunde aus Abschnitt A.** Umbenennung `Session` → `PracticeSession` mit
Migration, `topic`/`difficulty` auf `Attempt`, Doku-Korrekturen A-3 und A-4, D-17 und
D-18 in `DECISIONS.md`. Der Practice-Loop muss danach unverändert laufen.

**Schritt 2 — `getCurrentUserId()`.** Einführen, alle bestehenden Aufrufer umstellen,
`dev-user.ts` nur noch von dort aus benutzt.

**Schritt 3 — `TopicMastery`.** Modell, Migration, Fortschreibung beim Schließen eines
Attempts inklusive der Bedingung aus D-5. Tests: doppeltes Absenden zählt einmal,
`unparseable` zählt gar nicht.

**Schritt 4 — Auswahl-Logik.** Die reinen Funktionen aus D-2 bis D-4 mit Tests, dann die
DB-Schicht. `POST /api/session/[id]/next` stellt um. *→ Hier stoppen.*

**Schritt 5 — Statistik-Seite.** Abfragen, Darstellung, Verlinkung aus der Navigation.

**Schritt 6 — Abschluss.** `SPEC.md`, `CLAUDE.md` und `OVERVIEW.md` auf den Stand
bringen, diese Datei löschen.

### Abnahmekriterien für M2a

- Alle Tests grün, `npm run content:check` und `npm run build` laufen durch.
- Ein Topic, in dem man absichtlich falsch antwortet, wird sichtbar häufiger gestellt.
- Ein Topic mit hoher Quote liefert Templates höherer Schwierigkeit.
- Doppeltes Absenden derselben Antwort verändert die Statistik genau einmal.
- Die Statistik-Seite zeigt für jedes Topic mit Aufgaben eine Zeile, auch bei null
  Versuchen.
- `lib/engine` hat weiterhin keinen DB-Zugriff.
