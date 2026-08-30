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
| Mathe-Rendering | KaTeX (`katex.renderToString`, kein `react-katex`) | Schneller als MathJax, reicht für Formelsatz |
| Content | YAML über das `yaml`-Paket (YAML 1.2) | Templates sind Content, kein Code |
| Skripte | `tsx` | `npm run content:check` ohne Build-Schritt |
| Ausdrucks-Parsing | eigener Parser in `lib/engine/expr` (exakte Brüche, leerer Scope) | Für den Antwortvergleich; siehe `DECISIONS.md`, D-01 und D-06 |
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
│   ├── (marketing)/page.tsx            # Landing
│   ├── (app)/
│   │   ├── layout.tsx
│   │   └── practice/
│   │       ├── page.tsx                # Themenauswahl aus dem Themenbaum
│   │       ├── topic-picker.tsx        # Client: startet die Session
│   │       └── [sessionId]/
│   │           ├── page.tsx            # prüft die Session, rendert den Loop
│   │           ├── practice-loop.tsx   # Client: Aufgabe → Antwort → Urteil
│   │           └── verdict-panel.tsx
│   └── api/
│       ├── session/route.ts            # POST: Session starten
│       ├── session/[id]/next/route.ts  # POST: nächste Aufgabe
│       ├── attempt/[id]/answer/route.ts# POST: Antwort bewerten
│       ├── attempt/[id]/transcribe/route.ts  # M4
│       └── attempt/[id]/review/route.ts      # M4, streamt
│
├── components/
│   ├── MathText.tsx                    # KaTeX-Rendering nach der Interpolation
│   ├── split-math.ts                   # trennt Text von $…$ und $$…$$
│   └── answer-format.ts                # Formathinweis je answer_type
│
├── content/
│   ├── topics.yaml                     # Themenbaum, einzige Quelle gültiger Topics
│   └── templates/
│       ├── _README.md                  # Kurzdoku für Template-Autoren
│       ├── arithmetik/*.yaml
│       ├── kombinatorik/*.yaml
│       └── wahrscheinlichkeit/*.yaml
│
├── lib/
│   ├── engine/                         # REIN. Kein I/O. Kein React.
│   │   ├── compute/
│   │   │   ├── registry.ts             # compute_ref -> Eintrag (Whitelist)
│   │   │   ├── arithmetik.ts
│   │   │   ├── kombinatorik.ts
│   │   │   └── wahrscheinlichkeit.ts
│   │   ├── expr/                       # Ausdruckskern, von grade UND constraints genutzt
│   │   │   ├── rational.ts             # exakte Brüche auf BigInt
│   │   │   ├── numeric.ts              # Wertetyp exact | inexact
│   │   │   ├── bigmath.ts              # factorial, binomial, permutations
│   │   │   ├── tokenize.ts
│   │   │   ├── parse.ts                # feste Grammatik, kein eval
│   │   │   └── evaluate.ts             # expliziter Scope + Funktions-Whitelist
│   │   ├── generate/
│   │   │   ├── rng.ts                  # seeded PRNG (mulberry32)
│   │   │   ├── sample.ts               # Parameter würfeln
│   │   │   └── constraints.ts          # Constraint-Auswertung
│   │   ├── render/interpolate.ts       # {{n}} -> Wert, strikt
│   │   ├── grade/                      # normalize.ts, compare.ts, index.ts
│   │   ├── instantiate.ts              # Orchestrierung: Template -> Instanz
│   │   ├── errors.ts
│   │   └── types.ts
│   │
│   ├── content/                        # Content-Pipeline, siehe Abschnitt 5b
│   │   ├── schema.ts                   # Zod: Template und Themenbaum
│   │   ├── checks.ts                   # die statischen Prüfungen
│   │   ├── read.ts                     # YAML lesen + validieren + prüfen
│   │   ├── load.ts                     # server-only, Cache, App-Zugang
│   │   └── __fixtures__/               # ein Negativ-Fall pro Prüfung
│   │
│   ├── api/                            # Request- und Response-Verträge (Zod)
│   ├── auth/current-user.ts            # getCurrentUserId(), einzige Nutzerquelle
│   ├── selection/next-template.ts      # Welches Template als Nächstes?
│   ├── llm/                            # ab M3
│   └── db/
│       ├── client.ts                   # Prisma-Singleton, server-only
│       └── dev-user.ts                 # nur von lib/auth/current-user.ts benutzt
│
├── scripts/check-templates.ts          # npm run content:check
├── prisma/schema.prisma
└── SPEC.md
```

**Regel:** Alles unter `lib/engine` importiert nichts aus `app/`, `lib/db`, `lib/content`
oder `lib/llm`. Templates werden der Engine übergeben, nicht von ihr geladen. Diese
Abhängigkeitsrichtung ist die wichtigste Struktureigenschaft des Projekts.

---

## 4. Datenmodell (Prisma)

Der Block gibt `prisma/schema.prisma` wieder. Nicht implementiert sind bisher nur
`User.createdAt` und `TopicMastery` — beides kommt in M2a.

```prisma
model User {
  id               String   @id @default(cuid())
  email            String   @unique
  createdAt        DateTime @default(now())
  practiceSessions PracticeSession[]
  attempts         Attempt[]
  masteries        TopicMastery[]
}

// Heißt PracticeSession, nicht Session: Der Prisma-Adapter von Auth.js belegt
// den Namen `Session` fest. Siehe DECISIONS.md, D-17. Die HTTP-Routen bleiben
// unter /api/session und /practice/[sessionId] — ein URL-Pfad ist kein Modellname.
model PracticeSession {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  topicFilter String?          // z.B. "kombinatorik" oder "kombinatorik.permutation"
  startedAt   DateTime @default(now())
  endedAt     DateTime?
  attempts    Attempt[]
}

model Attempt {
  id                String   @id @default(cuid())
  practiceSessionId String
  practiceSession   PracticeSession @relation(fields: [practiceSessionId], references: [id])

  // Reproduzierbarkeit
  templateId      String
  templateVersion Int
  seed            String
  params          Json             // gewürfelte, konkrete Werte
  questionText    String           // gerendert, so wie angezeigt

  // Beim Anlegen denormalisiert, siehe DECISIONS.md, D-18
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  topic           String
  difficulty      Int

  // Lösung — NIE an den Client, solange status = OPEN
  expectedAnswer  Json
  answerType      String

  // Nutzereingabe
  userAnswer      String?
  imageUrl        String?          // M4
  transcript      String?          // M4

  // Urteil
  status          String   @default("OPEN")   // OPEN | ANSWERED | SKIPPED
  isCorrect       Boolean?
  reviewVerdict   Json?            // M4: LLM-Schritturteil
  durationMs      Int?

  createdAt       DateTime @default(now())
  answeredAt      DateTime?

  @@index([practiceSessionId])
  @@index([userId, topic, answeredAt])   // trägt die gleitende Erfolgsquote
}

model TopicMastery {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  topic        String                   // "kombinatorik.permutation"
  attempts     Int      @default(0)     // Gesamtzahl, für die Statistik-Seite
  correct      Int      @default(0)
  lastSeenAt   DateTime?
  dueAt        DateTime?
  intervalDays Float    @default(1)

  @@unique([userId, topic])
}
```

`Attempt.status` ist ein `String` mit Default `"OPEN"`, kein Prisma-`enum`: Für SQLite
kennt Prisma keine Enum-Typen. Die gültigen Werte erzwingt Zod an den Grenzen
(`lib/api/contracts.ts`), nicht die Datenbank. Dasselbe gilt für `answerType`.

`expectedAnswer` liegt bewusst in der DB und nicht nur im Speicher: Der Nutzer soll die
Seite neu laden können, ohne dass die Aufgabe kaputtgeht.

---

## 5. Template-Format

Templates beschreiben **Wertebereiche**, nicht Werte.

```yaml
# content/templates/kombinatorik/permutation_reihe.yaml
id: aufg_00003
version: 1
topic: kombinatorik.permutation
difficulty: 1
target_time_seconds: 60

compute_ref: kombinatorik.permutation.factorial
answer_type: integer

param_spec:
  n:
    type: int
    min: 4
    max: 9

constraints:
  - "result <= 400000"      # nach der Berechnung geprüft

question_text: |
  Auf wie viele Arten können {{n}} Personen in einer Reihe angeordnet werden?

solution_text: |
  Permutation ohne Wiederholung von {{n}} Elementen:
  $${{n}}! = {{result}}$$

tags: [permutation, ohne_wiederholung]
```

### Platzhalter-Syntax: doppelte geschweifte Klammern

Platzhalter sind **`{{name}}`**, nicht `{name}`, wobei `name` gegen `^[a-z][a-z0-9_]*$`
passt. Grund: Aufgabentexte enthalten LaTeX, und LaTeX benutzt einfache geschweifte
Klammern als Argumentklammern — `\frac{1}{2}` würde von einem strikten Interpolator als
zwei unbekannte Platzhalter gelesen. Siehe `DECISIONS.md`, D-05.

- Ersetzt wird ausschließlich `{{name}}`. Einfache Klammern werden nie angefasst.
- Ein Platzhalter ohne Wert wirft `TemplateRenderError`. Nicht still stehenlassen.
- Nach der Interpolation darf kein `{{` mehr im Ergebnis vorkommen. Das ist eine
  Assertion, kein Vorschlag — sie fängt auch `{{ n }}` und `{{N}}`.

### Zod-Schema (`lib/content/schema.ts`)

```ts
const SEGMENT = /^[a-z][a-z0-9_]*$/;
const DOTTED  = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;

const ParamSpec = z.discriminatedUnion("type", [
  z.object({ type: z.literal("int"),    min: z.number().int(), max: z.number().int() }),
  z.object({ type: z.literal("choice"), values: z.array(z.union([z.string(), z.number(), z.boolean()])).min(2) }),
  z.object({ type: z.literal("const"),  value: z.union([z.string(), z.number(), z.boolean()]) }),
]);

export const TemplateSchema = z.object({
  id: z.string().regex(/^aufg_\d{5}$/),
  version: z.number().int().positive(),
  topic: z.string().regex(DOTTED),
  difficulty: z.number().int().min(1).max(5),
  target_time_seconds: z.number().int().positive(),
  compute_ref: z.string().regex(DOTTED),
  answer_type: z.enum(["integer", "numeric", "fraction", "choice"]),
  round_to: z.number().int().min(0).max(10).optional(),   // nur bei numeric
  param_spec: z.record(z.string().regex(SEGMENT), ParamSpec),
  constraints: z.array(z.string()).default([]),
  question_text: z.string().trim().min(1),
  solution_text: z.string().trim().optional(),
  tags: z.array(z.string()).default([]),
});
```

Einen `float`-Parametertyp gibt es nicht. Er wurde nie gebraucht, und zufällige
Kommazahlen als Aufgabenparameter erzeugen fast immer unschöne Ergebnisse. Falls er später
nötig wird: als neue Entscheidung aufnehmen.

`question_text` und `solution_text` werden getrimmt — YAML-Blockskalare (`|`) hängen sonst
einen Zeilenumbruch an, der in der Aufgabe landet.

### Statische Prüfungen beim Laden

Alles harte Fehler. Der Ladevorgang bricht ab, `npm run content:check` schlägt fehl.
Implementiert in `lib/content/checks.ts`, jede mit einem Negativ-Fixture belegt:

1. `compute_ref` existiert in der Registry.
2. Jeder `{{x}}`-Platzhalter in `question_text` ist ein Key aus `param_spec`.
3. Jeder `{{x}}` in `solution_text` ist ein Key aus `param_spec` **oder** `result`.
4. Jeder Key aus `param_spec` kommt im `question_text` vor **oder** hat `type: const`.
   Ungenutzte Zufallsparameter sind ein Template-Bug.
5. Das Zod-Input-Schema der Compute-Funktion akzeptiert genau die `param_spec`-Keys.
   Die Registry-Schemata sind `strictObject`, deshalb fällt auch ein überzähliger
   Parameter auf, nicht nur ein fehlender.
6. `id` ist repoweit eindeutig.
7. `topic` ist ein Blatt aus `content/topics.yaml`.
8. `round_to` ist nur bei `answer_type: numeric` gesetzt.
9. In `constraints` kommen nur Namen aus `param_spec` plus `result` vor. Ein Constraint,
   das gar kein Vergleich ist, wird als eigener Befund (`invalid_constraint`) gemeldet.

### Versionierung

`Attempt` speichert `templateVersion`. Deshalb:

- Änderung an `param_spec`, `compute_ref`, `constraints` oder an der **Bedeutung** von
  `question_text` ⇒ `version` erhöhen.
- Reine Tippfehlerkorrektur ohne Bedeutungsänderung ⇒ keine Erhöhung.

Beim Bewerten wird der Lösungstext nur gerendert, wenn die gespeicherte Version noch der
aktuellen entspricht — ein Text zu einer anderen Version wäre schlechter als gar keiner.

---

## 5a. Themenbaum

`content/topics.yaml` ist die einzige Quelle gültiger Topic-Pfade und liefert gleichzeitig
die Beschriftungen für die Themenauswahl-Seite. Damit gibt es keine zweite Liste, die
auseinanderlaufen kann. Siehe `DECISIONS.md`, D-08.

```yaml
arithmetik:
  label: Grundrechenarten
  children:
    grundrechenarten:
      label: Addition und Subtraktion

kombinatorik:
  label: Kombinatorik
  children:
    permutation:
      label: Permutationen
    variation:
      label: Variationen (geordnete Auswahl)
    kombination:
      label: Kombinationen (ungeordnete Auswahl)
    verteilung:
      label: Verteilungen (Stars and Bars)

wahrscheinlichkeit:
  label: Wahrscheinlichkeitsrechnung
  children:
    hypergeometrisch:
      label: Hypergeometrische Verteilung
```

Ein Template zeigt immer auf ein **Blatt** (`kombinatorik.permutation`, nicht
`kombinatorik`). Ein Session-`topicFilter` darf dagegen auf jeder Ebene stehen und umfasst
dann alle Blätter darunter.

---

## 5b. Content-Pipeline

| Modul | Aufgabe |
|---|---|
| `lib/content/schema.ts` | Zod-Schemata für Template und Themenbaum, Hilfsfunktionen für Blätter und Beschriftungen |
| `lib/content/checks.ts` | die statischen Prüfungen aus Abschnitt 5, als Liste von Befunden statt als Ausnahme |
| `lib/content/read.ts` | YAML lesen, validieren, prüfen. Wirft `ContentError` mit allen Befunden |
| `lib/content/load.ts` | `import "server-only"`, Cache im Modul-Scope, einziger Zugang aus `app/` |
| `scripts/check-templates.ts` | lädt alles, Exit-Code ≠ 0 bei Befunden |

```json
"scripts": {
  "content:check": "tsx scripts/check-templates.ts",
  "pretest": "npm run content:check"
}
```

`read.ts` trägt bewusst **kein** `server-only`: Skript und Tests brauchen es, und
`server-only` wirft außerhalb einer React-Server-Umgebung. Den Schutz für die Anwendung
übernimmt `load.ts`. Siehe `DECISIONS.md`, D-12.

**Deployment:** Next.js bündelt `content/` nicht automatisch mit — der Ordner steht in
`next.config.ts` unter `outputFileTracingIncludes`. Lokal fällt das nie auf, weil dort das
ganze Repo liegt.

---

## 6. Engine: Template → Instanz

```ts
// lib/engine/instantiate.ts — gekürzt, der echte Code steht in der Datei
export function instantiate(tpl: Template, seed: string): Instance {
  if (!isComputeRef(tpl.compute_ref)) {
    throw new UnknownComputeRefError(tpl.id, tpl.compute_ref);
  }
  const entry = registry[tpl.compute_ref];

  // Constraints, die `result` nennen, sind vor dem Rechnen nicht entscheidbar
  // und werden im ersten Durchgang übersprungen.
  const beforeCompute = tpl.constraints.filter(
    (constraint) => !constraintVariables(constraint).has(RESULT_KEY),
  );

  const rng = makeRng(seed);

  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {   // MAX_TRIES = 50
    const params = sampleParams(tpl.param_spec, rng);
    if (!checkConstraints(beforeCompute, params)) continue;

    // Ein Eintrag validiert selbst: `run` prüft gegen sein Zod-Schema und
    // rechnet nur bei Erfolg. `undefined` ist ein verworfener Wurf, kein Fehler.
    const result = entry.run(params);
    if (result === undefined) continue;

    if (!checkConstraints(tpl.constraints, { ...params, [RESULT_KEY]: result })) continue;

    return {
      templateId: tpl.id,
      templateVersion: tpl.version,
      seed,
      params,
      questionText: interpolate(tpl.question_text, params),
      expectedAnswer: toStorageString(result),
      answerType: tpl.answer_type,
    };
  }

  throw new TemplateUnsatisfiableError(tpl.id, MAX_TRIES);
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
// lib/engine/compute/registry.ts — zwei von zwölf Einträgen
export const registry = {
  /** Permutationen ohne Wiederholung: n! */
  "kombinatorik.permutation.factorial": defineCompute({
    input: Single,                         // z.strictObject({ n: int, 0..N_MAX })
    compute: ({ n }) => Q.fromBigInt(factorial(BigInt(n))),
  }),

  /** Kombinationen ohne Wiederholung: C(n, k) */
  "kombinatorik.kombination.ohne_wdh": defineCompute({
    input: PairOrdered,                    // Pair.refine((v) => v.k <= v.n, ...)
    compute: ({ n, k }) => Q.fromBigInt(binomial(BigInt(n), BigInt(k))),
  }),
} as const satisfies Record<string, AnyComputeEntry>;
```

Die Eingabeschemata sind `strictObject`: Ein Template mit einem Parameter zu viel fällt
beim `content:check` auf, statt still ignoriert zu werden.

Ergebnisse sind `Rational`, nicht `number` — sonst verlierst du bei `20!` still Präzision,
und ab der hypergeometrischen Verteilung sind die Werte ohnehin Brüche.

Ein Registry-Eintrag validiert selbst: `entry.run(params)` prüft gegen das Zod-Schema und
rechnet nur bei Erfolg, sonst `undefined`. `instantiate` behandelt das als verworfenen
Wurf. Der Grund für diese Signatur steht in `DECISIONS.md`, D-14.

### Vorhandene Compute-Funktionen

| `compute_ref` | Formel | Rückgabe |
|---|---|---|
| `arithmetik.add` | `a + b` | ganzzahlig |
| `arithmetik.subtract` | `a - b` | ganzzahlig |
| `kombinatorik.permutation.factorial` | `n!` | ganzzahlig |
| `kombinatorik.permutation.multiset` | `n! / (k₁!·…·k₄!)`, zwei bis vier Gruppen | ganzzahlig |
| `kombinatorik.variation.ohne_wdh` | `n! / (n−k)!` | ganzzahlig |
| `kombinatorik.variation.mit_wdh` | `n^k` | ganzzahlig |
| `kombinatorik.kombination.ohne_wdh` | `C(n,k)` | ganzzahlig |
| `kombinatorik.kombination.mit_wdh` | `C(n+k−1, k)` | ganzzahlig |
| `kombinatorik.verteilung.nichtnegativ` | `C(n+k−1, k−1)` | ganzzahlig |
| `kombinatorik.teilmengen.anzahl` | `2^n` | ganzzahlig |
| `wahrscheinlichkeit.hypergeometrisch.genau` | `C(K,k)·C(N−K, n−k) / C(N,n)` | `Rational` |
| `wahrscheinlichkeit.hypergeometrisch.mindestens_eins` | `1 − C(N−K, n) / C(N,n)` | `Rational` |

Beziehungen zwischen Parametern (`k <= n`, `K <= N`, `n <= N`, `n − k <= N − K`) stehen als
`refine` im Zod-Schema des Eintrags, nicht im Rechenteil. Jede Funktion braucht Tests mit
`n = 0`, `k = 0`, `k = n`, `k > n` und einem großen `n`, bei dem `number` überliefe.

---

## 7. Bewertung

Zweistufig: **normalisieren**, dann **vergleichen**. Pro `answer_type` eigene
Implementierung. Nie ein direkter Stringvergleich.

### Wertetyp: exakte Rationalzahlen

```ts
// lib/engine/expr/rational.ts
export interface Rational { readonly num: bigint; readonly den: bigint }  // den > 0, gekürzt
```

Der Ausdruckskern rechnet mit gekürzten Brüchen. Damit gilt:

- `integer` ist der Fall `den === 1n`.
- `fraction` fällt ohne Zusatzarbeit ab.
- `numeric` vergleicht exakt statt mit Toleranz.
- Dezimaleingaben werden verlustfrei überführt: `2.5` → `5/2`, `0.0177` → `177/10000`.
- Float taucht nur bei `sqrt` auf einer Nicht-Quadratzahl auf und ist im Wertetyp als
  `inexact` markiert — niemand kann versehentlich eine Bewertung darauf stützen.

Begründung in `DECISIONS.md`, D-06.

### Signatur

```ts
export function grade(
  userInput: string,
  expected: Rational | string,      // Speicherform "41" bzw. "3/8" ist erlaubt
  type: AnswerType,
  options?: { roundTo?: number },
): GradeResult
```

| Typ | Normalisierung | Vergleich |
|---|---|---|
| `integer` | Leerzeichen und Tausendertrenner weg; Ausdrücke wie `5!`, `combinations(10,3)`, `5*4*3` auswerten | exakt, `den === 1n` gefordert |
| `numeric` | wie oben; Komma je nach Kontext Dezimal- oder Argumenttrenner (D-10) | ohne `round_to`: exakt. Mit `round_to: k`: beide Seiten kaufmännisch auf k Stellen runden, dann exakt |
| `fraction` | `a/b` auswerten, kürzen | Wertgleichheit auf gekürzten Brüchen (D-11) |
| `choice` | Rand weg, Groß-/Kleinschreibung egal | ID-Vergleich |

`set`, `tuple` und `text` sind **nicht** implementiert und werfen
`UnsupportedAnswerTypeError`. Regel: kein Normalizer ohne Template, das ihn benutzt
(`DECISIONS.md`, D-07).

**Prozentangaben sind nicht zugelassen.** Templates fragen entweder nach dem Bruch oder
nach dem auf `round_to` Stellen gerundeten Dezimalwert, und der `question_text` sagt das
ausdrücklich. Sonst ist `1.77` gegen `0.0177` nicht entscheidbar (`DECISIONS.md`, D-09).

Auswertung von Nutzerausdrücken mit **leerem Scope** (keine Variablen, keine
Funktionsdefinitionen). Nur Whitelist an Funktionen: `factorial`, `combinations`,
`permutations`, `sqrt`, `abs`, Grundrechenarten. Bei Parse-Fehler:
`{ ok: false, reason: "unparseable" }` — das ist *nicht* dasselbe wie „falsch", soll dem
Nutzer anders angezeigt werden und lässt den Attempt offen (`DECISIONS.md`, D-04).

Der eigene Parser statt `mathjs` ist in `DECISIONS.md`, D-01 begründet.

Dieses Modul hat eine Tabellen-Testsuite mit mindestens 40 Fällen pro Typ.

---

## 7a. Formelsatz mit KaTeX

- Mathematik in `question_text` und `solution_text` steht zwischen `$…$` (inline) oder
  `$$…$$` (abgesetzt).
- Gerendert wird **nach** der Interpolation.
- `components/split-math.ts` trennt Text von Formel, `components/MathText.tsx` ruft für die
  Formelteile `katex.renderToString` auf. Kein `react-katex` — die Funktion aus dem
  `katex`-Paket reicht und läuft in Server- wie Client-Komponenten.
- `katex/dist/katex.min.css` wird einmal in `app/globals.css` importiert.
- KaTeX-Optionen: `throwOnError: false`, `trust: false`. Ein kaputter Ausdruck wird rot
  dargestellt, statt die Seite zu zerlegen.
- Unter dem Eingabefeld steht ein Formathinweis je `answer_type`
  (`components/answer-format.ts`), bei `numeric` mit der Stellenzahl aus `round_to`.

---

## 8. API-Verträge

Route Handlers für alles, was streamt oder LLM aufruft. Server Actions für simple Mutationen.

### Nutzerermittlung

`lib/auth/current-user.ts`:

```ts
export async function getCurrentUserId(): Promise<string>
```

**Jede** Route und jede Server Component, die einen Nutzer braucht, ruft diese Funktion —
nie direkt den Dev-User aus `lib/db/dev-user.ts`. In M2a gibt sie den Dummy-User zurück
und legt ihn an, falls er fehlt; in M2b liest sie die Auth.js-Session und wirft bei
fehlender Anmeldung. Weil sie die einzige Stelle ist, an der die Frage beantwortet wird,
ist der Umbau in M2b ein Funktionsrumpf und keine Wanderung durch die Routen.

Die Regel ist getestet: `lib/auth/current-user.test.ts` liest den Quelltext unter `app/`,
`lib/`, `components/` und `scripts/` und schlägt fehl, sobald eine andere Datei
`lib/db/dev-user` importiert.

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
  roundTo?: number,           // nur bei numeric, für den Formathinweis
}
```
**Enthält niemals `expectedAnswer`.** Das ist der wichtigste Vertrag im ganzen System.

### `POST /api/attempt/[id]/answer`
```ts
Request:  { answer: string, durationMs: number }
Response:
  | { isCorrect: false, parseError: "unparseable" }        // Aufgabe bleibt OPEN
  | { isCorrect: boolean,
      expectedAnswer: string,   // JETZT erlaubt — Aufgabe ist geschlossen
      solutionText?: string,
      masteryDelta?: { topic: string, newRate: number } }  // ab M2
```
Server prüft: Attempt gehört zum eingeloggten User **und** `status === "OPEN"`.
Der Statuswechsel auf `ANSWERED` passiert in derselben Anweisung wie die Prüfung
(`updateMany` mit `status: "OPEN"` in der Bedingung), damit zwei gleichzeitige Absenden
nicht beide bewertet werden. Ein zweiter Aufruf wird mit 409 abgelehnt.

Eine nicht lesbare Eingabe lässt den Attempt offen und gibt weder `expectedAnswer` noch
`solutionText` zurück (`DECISIONS.md`, D-04). Bei `answer_type: numeric` mit
`round_to` wird die Stellenzahl aus dem Template an `grade` durchgereicht.

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

**M0 — Skelett** ✅
Next.js + Prisma + SQLite aufgesetzt. Zwei hartcodierte Templates (Addition, Subtraktion).
Compute-Registry mit zwei Funktionen. Eine Practice-Seite: Aufgabe anzeigen, Antwort eingeben,
richtig/falsch zurückgeben. Kein Auth (Dummy-User-ID). Ziel: der Loop läuft Ende zu Ende.

**M1 — Content-Pipeline & Kombinatorik** ✅
Platzhalter-Syntax `{{name}}`. Exakte Rationalzahlen im Ausdruckskern. Themenbaum in
`content/topics.yaml`. YAML-Loader mit Zod-Schema und den statischen Prüfungen,
`npm run content:check` im `pretest`. Zwölf Compute-Funktionen inklusive Kombinatorik und
hypergeometrischer Verteilung. Zwölf Templates als YAML, `dev-templates.ts` gelöscht.
Grading für `integer`, `numeric`, `fraction`, `choice`. KaTeX-Rendering. Themenauswahl auf
Basis des Themenbaums.

Nicht in M1: Auth, `TopicMastery`, Fortschrittsanzeige, LLM, Fotoupload. Die
Aufgabenauswahl bleibt zufällig innerhalb des Filters; die Mastery-Logik aus Abschnitt 10
kommt vollständig in M2.

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
  (`n = 0`, `k = 0`, `k = n`, `k > n`, große `n`).
- Jedes neue Template wird vom Property-Test automatisch erfasst: 200 Seeds, keine
  Ausnahme, alle Constraints erfüllt, kein Platzhalterrest im gerenderten Text.
- Jede neue statische Content-Prüfung braucht ein Negativ-Fixture, das genau daran scheitert.
- Kein Normalizer ohne Template, das ihn benutzt.
- Keine Secrets in Client Components. `import "server-only"` in `lib/db`, `lib/content/load.ts`
  und `lib/llm`.
- Bewusste Abweichungen von diesem Dokument gehören als neuer Eintrag nach `DECISIONS.md`.
- Commits klein und thematisch. Ein Meilenstein ist kein Commit.
- Bevor du eine Datei über 300 Zeilen schreibst: aufteilen.
- Wenn eine Anforderung aus diesem Dokument im Konflikt mit einer Chat-Anweisung steht,
  frag nach, statt still das Dokument zu brechen.

### Arbeitsweise

Ein Meilenstein wird in kleinen Schritten abgearbeitet; jeder Schritt endet mit grünen
Tests (`npm run content:check` läuft als `pretest` mit) und einem thematischen Commit.
Am Ende eines Meilensteins stoppen und Rückmeldung einholen, nicht durchziehen.
