# Mathe-Lern-App — Architektur- & Implementierungsspezifikation

> Übergabedokument für Claude Code. Diese Datei gehört ins Repo-Root (oder als `CLAUDE.md`).
> Sie ist normativ: Bei Konflikt zwischen diesem Dokument und einer Ad-hoc-Anweisung im Chat
> gilt dieses Dokument, bis es explizit geändert wird.

---

## 0. Was gebaut wird

Eine Web-App zum Üben von Mathematik (Start: Kombinatorik, Oberstufenniveau).
Der Kern ist ein **Aufgabengenerator**: Aus versionierten Templates werden durch
zufällige, aber validierte Parameter beliebig viele Aufgabeninstanzen erzeugt.
Die richtige Lösung wird **immer deterministisch berechnet**, nie von einem LLM.

Der Nutzer wählt einen Themenschwerpunkt, bekommt Aufgaben, gibt eine Lösung ein
und erhält ein Urteil. In späteren Stufen kommt ein Foto des Rechenwegs dazu, das
transkribiert und von einem LLM auf Folgefehler geprüft wird.

---

## 1. Invarianten (nicht verhandelbar)

Diese Regeln gelten in jeder Phase. Verstöße sind Bugs, keine Trade-offs.

1. **Determinismus vor LLM.** Jede Zahl, die über richtig/falsch entscheidet, kommt
   aus reinem TypeScript-Code, nie aus einem Modellaufruf.
2. **Die Lösung verlässt den Server nicht**, solange die Aufgabe offen ist. Nicht im
   JSON, nicht in einem Kommentar, nicht in einem Hash, aus dem sie rückrechenbar wäre.
3. **Jede Instanz ist reproduzierbar.** Seed + Template-ID + Template-Version werden
   persistiert. Gleiche Eingabe ⇒ gleiche Aufgabe.
4. **Templates sind Content, kein Code.** Sie liegen als YAML im Repo, werden gegen ein
   Zod-Schema validiert und sind ohne Deploy-Logikänderung erweiterbar.
5. **LLM-Ausgaben passieren nie ungeprüft.** Jeder Modellaufruf hat ein deterministisches
   Validierungs-Gate dahinter und einen Fallback, wenn das Gate fehlschlägt.
6. **Kein `eval`, kein dynamischer Import aus Content.** `compute_ref` ist ein Schlüssel
   in einer statischen Registry — eine Whitelist, kein Codepfad.
7. **Die Engine ist frei von I/O.** Kein DB-, Netz- oder Dateizugriff in `lib/engine`.
   Das macht sie vollständig unit-testbar.

---

## 2. Tech-Stack

| Bereich | Wahl | Begründung |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript strict | Eine Runtime für UI + API |
| DB | SQLite (lokale Datei via Prisma) | Relationale Daten, kein Grund für NoSQL; kein Server-Setup für die Entwicklung |
| ORM | Prisma | Typsicheres Schema, Migrationen |
| Validierung | Zod | Contracts an allen Grenzen (API, Content, LLM-Output) |
| Styling | Tailwind CSS | — |
| Mathe-Rendering | KaTeX (`react-katex`) | Schneller als MathJax, reicht für Formelsatz |
| Ausdrucks-Parsing | eigener Parser in `lib/engine/expr` (BigInt-exakt, leerer Scope) | Für den Antwortvergleich; siehe Entscheidung E-01 in Abschnitt 7 |
| Tests | Vitest | Engine-Unit-Tests sind Pflicht |
| LLM | `@anthropic-ai/sdk` | Erst ab Meilenstein M3 relevant |
| Auth | Auth.js (Credentials + optional GitHub) | Erst ab M2 |

**SQLite-Konsequenz:** Prisma kennt für SQLite keine `enum`-Typen. `AttemptStatus` aus
Abschnitt 4 wird deshalb als `String` mit Default `"OPEN"` modelliert; die erlaubten Werte
werden über Zod erzwungen. Bei einem späteren Umstieg auf PostgreSQL wird daraus ein echtes Enum.

**Explizit kein Python.** Der Compute-Layer ist TypeScript. Große Zahlen über `BigInt`.
Falls später echte Termäquivalenz (Analysis, Algebra) gebraucht wird, kommt ein separater
Service — das ist dann eine bewusste Entscheidung, keine Altlast.

---

## 3. Verzeichnisstruktur

```
.
├── app/
│   ├── (marketing)/
│   │   └── page.tsx                    # Landing
│   ├── (app)/
│   │   ├── layout.tsx
│   │   ├── practice/
│   │   │   ├── page.tsx                # Themenauswahl
│   │   │   └── [sessionId]/page.tsx    # Aufgaben-Loop
│   │   └── stats/page.tsx              # Fortschritt pro Topic
│   └── api/
│       ├── session/route.ts            # POST: Session starten
│       ├── session/[id]/next/route.ts  # POST: nächste Aufgabe
│       ├── attempt/[id]/answer/route.ts# POST: Antwort bewerten
│       ├── attempt/[id]/transcribe/route.ts  # M4
│       └── attempt/[id]/review/route.ts      # M4, streamt
│
├── content/
│   └── templates/
│       ├── kombinatorik/
│       │   ├── permutation-ohne-wdh.yaml
│       │   ├── kombination-ohne-wdh.yaml
│       │   └── stars-and-bars.yaml
│       └── _schema.md                  # Kurzdoku des Template-Formats
│
├── lib/
│   ├── engine/                         # REIN. Kein I/O. Kein React.
│   │   ├── compute/
│   │   │   ├── registry.ts             # compute_ref -> Funktion (Whitelist)
│   │   │   ├── kombinatorik.ts
│   │   │   └── arithmetik.ts
│   │   ├── expr/                       # Ausdrucks-Kern, von grade UND constraints genutzt
│   │   │   ├── bigmath.ts              # factorial, binomial, permutations (BigInt)
│   │   │   ├── numeric.ts              # Zahlwert: exakt in BigInt, float nur als Rückfall
│   │   │   ├── tokenize.ts
│   │   │   ├── parse.ts                # feste Grammatik, kein eval
│   │   │   └── evaluate.ts             # expliziter Scope + Funktions-Whitelist
│   │   ├── generate/
│   │   │   ├── rng.ts                  # seeded PRNG (mulberry32 o.ä.)
│   │   │   ├── sample.ts               # Parameter würfeln
│   │   │   └── constraints.ts          # Constraint-Auswertung
│   │   ├── errors.ts                   # TemplateUnsatisfiableError, ExpressionError, …
│   │   ├── render/
│   │   │   └── interpolate.ts          # {n} -> Wert, strikt
│   │   ├── grade/
│   │   │   ├── normalize.ts            # pro answer_type
│   │   │   ├── compare.ts
│   │   │   └── index.ts
│   │   ├── instantiate.ts              # Orchestrierung: Template -> Instanz
│   │   └── types.ts
│   │
│   ├── content/
│   │   ├── schema.ts                   # Zod-Schema der Templates
│   │   └── load.ts                     # YAML lesen + validieren (build-time)
│   │
│   ├── selection/
│   │   └── next-template.ts            # Welches Topic/Template als Nächstes?
│   │
│   ├── llm/                            # ab M3
│   │   ├── client.ts
│   │   ├── prompts/
│   │   └── gates/                      # Validierung der Modellausgaben
│   │
│   └── db/
│       └── client.ts                   # Prisma-Singleton
│
├── prisma/
│   └── schema.prisma
└── SPEC.md
```

**Regel:** Alles unter `lib/engine` importiert nichts aus `app/`, `lib/db` oder `lib/llm`.
Diese Abhängigkeitsrichtung ist die wichtigste Struktureigenschaft des Projekts.

---

## 4. Datenmodell (Prisma)

```prisma
model User {
  id          String   @id @default(cuid())
  email       String   @unique
  createdAt   DateTime @default(now())
  sessions    Session[]
  masteries   TopicMastery[]
}

model Session {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  topicFilter String?          // z.B. "kombinatorik" oder "kombinatorik.permutation"
  startedAt   DateTime @default(now())
  endedAt     DateTime?
  attempts    Attempt[]
}

model Attempt {
  id              String   @id @default(cuid())
  sessionId       String
  session         Session  @relation(fields: [sessionId], references: [id])

  // Reproduzierbarkeit
  templateId      String
  templateVersion Int
  seed            String
  params          Json             // gewürfelte, konkrete Werte
  questionText    String           // gerendert, so wie angezeigt

  // Lösung — NIE an den Client, solange status = OPEN
  expectedAnswer  Json
  answerType      String

  // Nutzereingabe
  userAnswer      String?
  imageUrl        String?          // M4
  transcript      String?          // M4

  // Urteil
  status          AttemptStatus @default(OPEN)
  isCorrect       Boolean?
  reviewVerdict   Json?            // M4: LLM-Schritturteil
  durationMs      Int?

  createdAt       DateTime @default(now())
  answeredAt      DateTime?

  @@index([sessionId])
}

enum AttemptStatus { OPEN ANSWERED SKIPPED }

model TopicMastery {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  topic        String                   // "kombinatorik.permutation"
  attempts     Int      @default(0)
  correct      Int      @default(0)
  lastSeenAt   DateTime?
  dueAt        DateTime?
  intervalDays Float    @default(1)

  @@unique([userId, topic])
}
```

`expectedAnswer` liegt bewusst in der DB und nicht nur im Speicher: Der Nutzer soll die
Seite neu laden können, ohne dass die Aufgabe kaputtgeht.

---

## 5. Template-Format

Templates beschreiben **Wertebereiche**, nicht Werte. Das ist die zentrale Korrektur
gegenüber dem ursprünglichen Entwurf.

```yaml
# content/templates/kombinatorik/permutation-ohne-wdh.yaml
id: aufg_00089
version: 1
topic: kombinatorik.permutation
difficulty: 1
target_time_seconds: 60

compute_ref: kombinatorik.permutation.permute
answer_type: numeric

param_spec:
  n:
    type: int
    min: 3
    max: 9
  ordered:
    type: const
    value: true
  with_repetition:
    type: const
    value: false

constraints:
  - "n >= 3"
  - "result <= 1000000"      # nach der Berechnung geprüft

question_text: |
  Auf wie viele Arten können {n} Personen an einem runden Tisch Platz nehmen?

solution_text: |
  Es handelt sich um eine Permutation ohne Wiederholung von {n} Elementen:
  {n}! = {result}

tags: [permutation, ohne-wiederholung]
```

Zod-Schema in `lib/content/schema.ts`:

```ts
const ParamSpec = z.discriminatedUnion("type", [
  z.object({ type: z.literal("int"),   min: z.number().int(), max: z.number().int() }),
  z.object({ type: z.literal("float"), min: z.number(), max: z.number(), decimals: z.number().int().default(2) }),
  z.object({ type: z.literal("choice"), values: z.array(z.union([z.string(), z.number(), z.boolean()])) }),
  z.object({ type: z.literal("const"), value: z.union([z.string(), z.number(), z.boolean()]) }),
]);

export const TemplateSchema = z.object({
  id: z.string().regex(/^aufg_\d{5}$/),
  version: z.number().int().positive(),
  topic: z.string().regex(/^[a-z]+(\.[a-z-]+)*$/),
  difficulty: z.number().int().min(1).max(5),
  target_time_seconds: z.number().int().positive(),
  compute_ref: z.string(),
  answer_type: z.enum(["numeric", "integer", "fraction", "set", "tuple", "text", "choice"]),
  param_spec: z.record(ParamSpec),
  constraints: z.array(z.string()).default([]),
  question_text: z.string(),
  solution_text: z.string().optional(),
  tags: z.array(z.string()).default([]),
});
```

Zusätzlich beim Laden prüfen (harte Fehler, Build bricht ab):

- `compute_ref` existiert in der Registry.
- Jeder Platzhalter `{x}` in `question_text` existiert in `param_spec` (oder ist `{result}` in `solution_text`).
- Umgekehrt: Jeder Parameter aus `param_spec` wird im `question_text` verwendet **oder** ist als
  `const` markiert. Ungenutzte Zufallsparameter sind ein Template-Bug.
- Das Input-Zod-Schema der Compute-Funktion akzeptiert die `param_spec`-Keys.

---

## 6. Engine: Template → Instanz

```ts
// lib/engine/instantiate.ts
export function instantiate(tpl: Template, seed: string): Instance {
  const rng = makeRng(seed);

  for (let i = 0; i < MAX_TRIES; i++) {     // MAX_TRIES = 50
    const params = sampleParams(tpl.param_spec, rng);
    if (!checkConstraints(tpl.constraints, params)) continue;

    const entry = registry[tpl.compute_ref];
    const parsed = entry.input.safeParse(params);
    if (!parsed.success) continue;

    const result = entry.compute(parsed.data);
    if (!checkConstraints(tpl.constraints, { ...params, result })) continue;

    return {
      templateId: tpl.id,
      templateVersion: tpl.version,
      seed,
      params,
      questionText: interpolate(tpl.question_text, params),
      expectedAnswer: result,
      answerType: tpl.answer_type,
    };
  }
  throw new TemplateUnsatisfiableError(tpl.id);
}
```

Wenn ein Template nach 50 Versuchen keine gültige Instanz liefert, ist das Template
falsch konfiguriert — dann soll es laut scheitern, nicht still eine kaputte Aufgabe liefern.
`instantiate` wird für **jedes** Template im Repo mit 200 Seeds im Test durchlaufen.

Constraint-Auswertung: **kein `eval`.** Ein Mini-Parser für die Grammatik
`<expr> <op> <expr>` mit `op ∈ {<, <=, >, >=, ==, !=}` und `expr` aus Variablen,
Zahlen und `+ - * /`. Mehr wird nicht gebraucht. Umgesetzt in
`lib/engine/generate/constraints.ts` auf demselben Parser wie die Bewertung
(`lib/engine/expr/`, siehe Entscheidung E-01 in Abschnitt 7) — der Scope wird explizit
übergeben. Ein Constraint mit unbekanntem Namen oder kaputter Syntax wirft
`TemplateConfigError`; es darf nicht still als „nicht erfüllt" durchgehen, sonst läuft der
Generator stumm in `TemplateUnsatisfiableError`.

Compute-Registry:

```ts
// lib/engine/compute/registry.ts
export const registry = {
  "kombinatorik.permutation.permute": {
    input: z.object({ n: z.number().int().min(0), ordered: z.boolean(), with_repetition: z.boolean() }),
    compute: ({ n }) => factorial(BigInt(n)).toString(),
  },
  "kombinatorik.kombination.choose": {
    input: z.object({ n: z.number().int().min(0), k: z.number().int().min(0) })
             .refine(v => v.k <= v.n, "k darf nicht größer als n sein"),
    compute: ({ n, k }) => binomial(BigInt(n), BigInt(k)).toString(),
  },
} as const satisfies Record<string, ComputeEntry>;
```

Ergebnisse als String, nicht als `number` — sonst verlierst du bei `20!` still Präzision.

---

## 7. Bewertung

Zweistufig: **normalisieren**, dann **vergleichen**. Pro `answer_type` eigene Implementierung.

```ts
export function grade(userInput: string, expected: unknown, type: AnswerType): GradeResult
```

| Typ | Normalisierung | Vergleich |
|---|---|---|
| `integer` | Leerzeichen/Tausendertrenner weg; `5!` und `5·4·3·2·1` auswerten; wissenschaftliche Notation | exakt über `BigInt` |
| `numeric` | wie oben, zusätzlich `,` → `.` | relative Toleranz 1e-9 |
| `fraction` | `a/b` kürzen | Zähler/Nenner exakt |
| `set` | trennen an `,` / `;`, sortieren, dedupliziert | Mengengleichheit |
| `tuple` | trennen, Reihenfolge behalten | elementweise |
| `choice` | — | ID-Vergleich |

Auswertung von Nutzerausdrücken mit **leerem Scope** (keine Variablen, keine
Funktionsdefinitionen). Nur Whitelist an Funktionen:
`factorial`, `combinations`, `permutations`, `sqrt`, `abs`, Grundrechenarten.
Bei Parse-Fehler: `{ ok: false, reason: "unparseable" }` — das ist *nicht* dasselbe wie
„falsch" und soll dem Nutzer auch anders angezeigt werden.

> **Entscheidung E-01 (2026-08-19, M0): eigener Parser statt `mathjs`.**
> Die ursprüngliche Fassung schrieb hier `mathjs.parse` + `evaluate` vor. Umgesetzt ist
> stattdessen ein eigener Tokenizer/Parser/Evaluator in `lib/engine/expr/`. Grund:
> `mathjs` rechnet in float64 — ab `21!` wäre der Vergleich still falsch, was Invariante 1
> und die BigInt-Regel bricht. Zusätzlich hätten die `MathNode`-Typen `as`-Casts erzwungen.
> Der eigene Parser hält alle inhaltlichen Vorgaben ein: kein `eval`, feste Grammatik,
> Funktions-Whitelist, leerer Scope, exakt über `BigInt`, `unparseable` ≠ falsch.
> Für `numeric` und `fraction` (M1) kann `mathjs` zusätzlich hinzukommen — das ist dann
> eine neue Entscheidung, kein Rückbau von `expr/`.

Dieses Modul bekommt eine Tabellen-Testsuite mit mindestens 40 Fällen pro Typ.

---

## 8. API-Verträge

Route Handlers für alles, was streamt oder LLM aufruft. Server Actions für simple Mutationen.

### `POST /api/session`
```ts
Request:  { topicFilter?: string }
Response: { sessionId: string }
```

### `POST /api/session/[id]/next`
```ts
Response: {
  attemptId: string,
  questionText: string,       // bereits interpoliert
  answerType: AnswerType,
  targetTimeSeconds: number,
  topic: string,
  difficulty: number,
}
```
**Enthält niemals `expectedAnswer`.** Das ist der wichtigste Vertrag im ganzen System.

### `POST /api/attempt/[id]/answer`
```ts
Request:  { answer: string, durationMs: number }
Response: {
  isCorrect: boolean,
  parseError?: "unparseable",
  expectedAnswer: string,     // JETZT erlaubt — Aufgabe ist geschlossen
  solutionText?: string,
  masteryDelta?: { topic: string, newRate: number },
}
```
Server prüft: Attempt gehört zum eingeloggten User **und** `status === "OPEN"`.
Ein zweiter Aufruf auf denselben Attempt wird abgelehnt.

### `POST /api/attempt/[id]/transcribe` *(M4)*
```ts
Request:  multipart/form-data, Feld "image"
Response: { transcript: string, confidence: "high"|"low" }
```
Bei `confidence: "low"` fordert die UI ein neues Foto an (entspricht dem
„Erkennbar? → Nein"-Zweig im Diagramm). Der Transkript wird dem Nutzer **immer**
zur Bestätigung angezeigt, bevor er in die Bewertung eingeht.

### `POST /api/attempt/[id]/review` *(M4)*
Streamt das Schritturteil. Das LLM bekommt den Transkript und die Aufgabenparameter,
**nicht** die richtige Lösung — es soll unabhängig nachrechnen und Folgefehler finden,
statt auf das Zielergebnis hinzuargumentieren. Erst danach wird sein Urteil mit dem
deterministischen Ergebnis zusammengeführt.

Kombiniertes Gesamturteil:

| deterministisch | LLM-Review | Anzeige |
|---|---|---|
| richtig | Weg schlüssig | Voll korrekt |
| richtig | Weg fehlerhaft | Ergebnis richtig, Weg prüfen — Hinweis anzeigen |
| falsch | Weg bis Schritt k schlüssig | Folgefehler ab Schritt k |
| falsch | Weg unschlüssig | Falsch, Lösungsweg anbieten |

---

## 9. LLM-Einsatz — nur an drei Stellen

1. **Einkleidung des Aufgabentexts (M3, optional).** Input: Template-Text + Parameter.
   Output: umformulierter Text.
   **Gate:** Alle Parameterwerte kommen im Output vor; die Multimenge der Zahlen im Output
   ist identisch zur Multimenge im Template-Text; Länge < 2× Original.
   Bei Gate-Fehler → Template-Text verwenden. Ergebnis wird gecacht (Key: Template-ID + Version + Params),
   damit nicht bei jedem Aufruf neu generiert wird.
2. **Transkription (M4).** Vision-Call, Bild → LaTeX. Output wird dem Nutzer gezeigt.
3. **Schritt-Review (M4).** Siehe oben.

Nicht erlaubt: LLM berechnet die Lösung. LLM entscheidet über richtig/falsch bei
`answer_type: numeric`. LLM würfelt Parameter. LLM beurteilt Plausibilität von Werten.

Alle Prompts liegen als versionierte Dateien in `lib/llm/prompts/`, nicht inline im Code.

---

## 10. Aufgabenauswahl

V1 bewusst simpel, in `lib/selection/next-template.ts`:

1. Kandidaten = Templates im gewählten Topic-Filter.
2. Score pro Topic: `(1 - erfolgsquote) * 2 + faelligkeitsbonus`, wobei
   `erfolgsquote` über die letzten 10 Versuche läuft und `faelligkeitsbonus = 1`,
   wenn `dueAt <= now`.
3. Aus dem höchstbewerteten Topic ein Template ziehen, gewichtet nach `difficulty`
   passend zur Erfolgsquote (hohe Quote → höhere Schwierigkeit).
4. Die letzten 3 gestellten Template-IDs ausschließen (Wiederholungsvermeidung).
5. Intervall nach SM-2-light: richtig → `intervalDays *= 2`, falsch → `intervalDays = 1`.

Kein Elo, kein Bayesian Knowledge Tracing in V1. Das kann später ersetzt werden —
deshalb liegt es hinter einer einzigen Funktion mit klarer Signatur.

---

## 11. Meilensteine

**M0 — Skelett** (entspricht „Prototyp V1" im Entwurf)
Next.js + Prisma + SQLite aufgesetzt. Zwei hartcodierte Templates (Addition, Subtraktion).
Compute-Registry mit zwei Funktionen. Eine Practice-Seite: Aufgabe anzeigen, Antwort eingeben,
richtig/falsch zurückgeben. Kein Auth (Dummy-User-ID). Ziel: der Loop läuft Ende zu Ende.

**M1 — Engine**
Template-Loader mit Zod-Validierung, YAML-Content-Ordner, seeded Parametergenerierung,
Constraint-Auswertung, Grading-Modul mit allen Normalizern. 10 Kombinatorik-Templates
(Permutation mit/ohne Wiederholung, Kombination mit/ohne Wiederholung, Stars and Bars,
hypergeometrische Verteilung). KaTeX-Rendering. Vollständige Vitest-Suite für `lib/engine`.

**M2 — Nutzer & Fortschritt**
Auth.js. Sessions, Attempts, TopicMastery persistiert. Auswahl-Logik. Statistik-Seite
mit Erfolgsquote pro Topic und Zeitverlauf.

**M3 — LLM-Einkleidung**
Anthropic-Client, Prompt-Dateien, Validierungs-Gate, Caching. Feature-Flag `LLM_FLAVOR_ENABLED`,
default aus.

**M4 — Foto & Rechenweg**
Upload (Vercel Blob oder S3), Transkriptions-Endpoint, Bestätigungs-UI, Review-Endpoint
mit Streaming, kombiniertes Gesamturteil.

**Nicht in V1:** Python-Service, Mehrsprachigkeit, Mobile-App, Aufgaben-Editor im Browser,
Klassen-/Lehrerfunktionen, Gamification.

---

## 12. Konventionen für Claude Code

- TypeScript strict. Kein `any`, kein `as` außer bei nachweislich sicheren Narrowings.
- Zod an jeder Grenze: HTTP-Request-Bodies, YAML-Content, LLM-Ausgaben, `process.env`.
- Jede neue Compute-Funktion braucht im selben Commit Unit-Tests inklusive Randfälle
  (`n = 0`, `k = n`, `k > n`, große `n`).
- Jedes neue Template braucht einen Test, der 200 Seeds instanziiert und prüft, dass
  keiner scheitert und alle Ergebnisse innerhalb der Constraints liegen.
- Keine Secrets in Client Components. Alles unter `app/api` und `lib/db` bleibt server-only
  (`import "server-only"` in `lib/db/client.ts`).
- Commits klein und thematisch. Ein Meilenstein ist kein Commit.
- Bevor du eine Datei über 300 Zeilen schreibst: aufteilen.
- Wenn eine Anforderung aus diesem Dokument im Konflikt mit einer Chat-Anweisung steht,
  frag nach, statt still das Dokument zu brechen.

### Erste Aufgabe (M0)

1. `create-next-app` mit TypeScript, Tailwind, App Router, ESLint.
2. Prisma installieren, `schema.prisma` aus Abschnitt 4 anlegen (nur `Attempt` und `Session`,
   `User` mit einer Dummy-Zeile), erste Migration.
3. `lib/engine/compute/registry.ts` mit `arithmetik.add` und `arithmetik.subtract`.
4. `lib/engine/instantiate.ts` und `lib/engine/grade/` in der minimalen Form (`answer_type: integer`).
5. Zwei Templates inline in `lib/content/dev-templates.ts` (YAML-Loader kommt in M1).
6. `POST /api/session/[id]/next` und `POST /api/attempt/[id]/answer`.
7. `app/(app)/practice/[sessionId]/page.tsx` mit dem Aufgaben-Loop.
8. Vitest aufsetzen, Tests für `grade` und die zwei Compute-Funktionen.

Danach stoppen und Rückmeldung einholen, bevor M1 beginnt.
