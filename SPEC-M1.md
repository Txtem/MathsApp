# SPEC-M1 — Änderungen an `SPEC.md` für Meilenstein M1

> Arbeitsanweisung. Diese Datei wird in `SPEC.md` eingearbeitet und danach gelöscht.
> Wo „ersetze" steht, ersetze den ganzen genannten Abschnitt. Wo „ergänze" steht, hänge an.

---

## A. Vorab: drei Annahmen prüfen

Bevor du irgendetwas änderst, prüfe im Code und melde Abweichungen:

1. Nutzt `lib/engine/render/interpolate.ts` einfache geschweifte Klammern (`{n}`)?
2. Kennt `lib/engine/expr/numeric.ts` bereits einen exakten Bruchtyp, oder rechnet es
   nur mit `BigInt` plus Float-Rückfall?
3. Ist `integer` der einzige implementierte `answer_type` in `lib/engine/grade/`?

Wenn eine Annahme nicht stimmt, sag Bescheid, bevor du den entsprechenden Teil umsetzt.

---

## B. Ersetze Abschnitt 5, Unterpunkt „Platzhalter"

### Platzhalter-Syntax: doppelte geschweifte Klammern

Platzhalter in `question_text` und `solution_text` sind **`{{name}}`**, nicht `{name}`.

Grund: Ab M1 enthalten Aufgabentexte LaTeX, und LaTeX benutzt einfache geschweifte
Klammern als Argumentklammern. `\frac{1}{2}` würde von einem strikten Interpolator als
zwei unbekannte Platzhalter gelesen. Mit doppelten Klammern bleibt LaTeX unberührt:

```
\binom{{n}}{{k}} = \frac{{{n}}!}{{{k}}!({{n}}-{{k}})!}
```

Regeln für `interpolate`:

- Ersetzt wird ausschließlich `{{name}}`, wobei `name` gegen `^[a-z][a-z0-9_]*$` passt.
- Ein `{{name}}`, dessen `name` weder in `params` noch (in `solution_text`) `result` ist,
  wirft `TemplateRenderError`. Nicht still stehenlassen.
- Einfache Klammern werden nie angefasst.
- Nach der Interpolation darf im Ergebnis kein `{{` mehr vorkommen. Das ist eine Assertion,
  kein Vorschlag.

**Migration:** Die beiden Dev-Templates aus M0 werden mit umgestellt (siehe Abschnitt E).

---

## C. Ersetze Abschnitt 5 (Template-Format) vollständig

Templates beschreiben **Wertebereiche**, nicht Werte.

```yaml
# content/templates/kombinatorik/permutation_ohne_wdh.yaml
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
  - "result <= 1000000"

question_text: |
  Auf wie viele Arten können {{n}} Personen in einer Reihe angeordnet werden?

solution_text: |
  Permutation ohne Wiederholung von {{n}} Elementen:
  $${{n}}! = {{result}}$$

tags: [permutation, ohne_wiederholung]
```

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
  question_text: z.string(),
  solution_text: z.string().optional(),
  tags: z.array(z.string()).default([]),
});
```

Der `float`-Parametertyp aus der Ursprungsfassung entfällt. Er wurde nie gebraucht, und
zufällige Kommazahlen als Aufgabenparameter erzeugen fast immer unschöne Ergebnisse.
Falls er später doch nötig wird: als neue Entscheidung aufnehmen.

### Statische Prüfungen beim Laden

Alle harte Fehler. Der Ladevorgang bricht ab, `npm run content:check` schlägt fehl:

1. `compute_ref` existiert in der Registry.
2. Jeder `{{x}}`-Platzhalter in `question_text` ist ein Key aus `param_spec`.
3. Jeder `{{x}}` in `solution_text` ist ein Key aus `param_spec` **oder** `result`.
4. Jeder Key aus `param_spec` kommt im `question_text` vor **oder** hat `type: const`.
   Ungenutzte Zufallsparameter sind ein Template-Bug.
5. Das Zod-Input-Schema der Compute-Funktion akzeptiert genau die `param_spec`-Keys.
6. **`id` ist repoweit eindeutig.** Zwei Templates mit derselben ID sind ein harter Fehler.
7. **`topic` ist ein Blatt aus `content/topics.yaml`.** Kein freies Textfeld mehr.
8. `round_to` ist nur bei `answer_type: numeric` gesetzt.
9. In `constraints` kommen nur Namen aus `param_spec` plus `result` vor.

### Versionierung

`Attempt` speichert `templateVersion`. Deshalb:

- Änderung an `param_spec`, `compute_ref`, `constraints` oder an der **Bedeutung** von
  `question_text` ⇒ `version` erhöhen.
- Reine Tippfehlerkorrektur ohne Bedeutungsänderung ⇒ keine Erhöhung.

---

## D. Neuer Abschnitt 5a — Themenbaum

Neue Datei `content/topics.yaml`. Sie ist die einzige Quelle gültiger Topic-Pfade und
liefert gleichzeitig die Beschriftungen für die Themenauswahl-Seite.

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

Ein Template darf nur auf ein **Blatt** zeigen (`kombinatorik.permutation`, nicht
`kombinatorik`). Ein Session-`topicFilter` darf dagegen auf jeder Ebene stehen und
umfasst dann alle Blätter darunter.

---

## E. Neuer Abschnitt 5b — Content-Pipeline

```
content/
├── topics.yaml
└── templates/
    ├── _README.md                       # Kurzdoku für dich selbst
    ├── arithmetik/
    │   ├── addition.yaml                # aus dev-templates.ts migriert
    │   └── subtraktion.yaml
    ├── kombinatorik/
    │   └── *.yaml
    └── wahrscheinlichkeit/
        └── *.yaml
```

Neue Module:

- `lib/content/schema.ts` — Zod-Schemata (Template, Topics).
- `lib/content/checks.ts` — die neun statischen Prüfungen aus Abschnitt C.
- `lib/content/load.ts` — liest YAML mit dem `yaml`-Package, validiert, prüft, cacht das
  Ergebnis im Modul-Scope. `import "server-only"`. Kein Zugriff aus `lib/engine`.
- `scripts/check-templates.ts` — lädt alles und beendet mit Exit-Code ≠ 0 bei Fehlern.

`package.json`:

```json
"scripts": {
  "content:check": "tsx scripts/check-templates.ts",
  "pretest": "npm run content:check"
}
```

**`lib/content/dev-templates.ts` wird gelöscht**, sobald die beiden Templates als YAML
vorliegen und der Loop damit läuft.

**Deployment-Hinweis:** Next.js bündelt den `content/`-Ordner nicht automatisch mit.
Trage ihn in `next.config.ts` unter `outputFileTracingIncludes` ein, sonst fehlen die
Templates im Produktions-Build. Das fällt lokal nie auf.

---

## F. Ersetze Abschnitt 7 (Bewertung)

### Wertetyp: exakte Rationalzahlen

`lib/engine/expr/` rechnet ab M1 mit exakten Brüchen statt nur mit ganzen Zahlen.

```ts
// lib/engine/expr/rational.ts
export type Rational = { num: bigint; den: bigint };   // den > 0, immer gekürzt
```

Begründung: Ab der hypergeometrischen Verteilung sind Ergebnisse Brüche. In `float64`
gerechnet wäre der Vergleich wieder ungenau — genau der Grund, aus dem `mathjs`
verworfen wurde (E-01). Mit `Rational` gilt:

- `integer` ist der Fall `den === 1n`.
- `fraction` fällt ohne Zusatzarbeit ab, weil gekürzt wird.
- `numeric` vergleicht exakt, nicht mit Toleranz.
- Float taucht nur bei `sqrt` auf und wird im Wertetyp ausdrücklich als
  „nicht mehr exakt" markiert. In M1 gibt es kein Template, das dorthin gerät.

Dezimaleingaben werden verlustfrei in `Rational` überführt: `2.5` → `5/2`,
`0.0177` → `177/10000`.

### Normalisieren, dann vergleichen

```ts
export function grade(userInput: string, expected: Rational, type: AnswerType, opts?: { roundTo?: number }): GradeResult
```

| Typ | Normalisierung | Vergleich |
|---|---|---|
| `integer` | Leerzeichen und Tausenderpunkte weg; Ausdrücke wie `5!`, `combinations(10,3)`, `5*4*3` auswerten | exakt, `den === 1n` gefordert |
| `numeric` | wie oben, zusätzlich `,` → `.` als Dezimaltrenner | ohne `round_to`: exakt. Mit `round_to: k`: beide Seiten auf k Nachkommastellen runden, dann exakt |
| `fraction` | `a/b` auswerten, kürzen | Zähler und Nenner exakt |
| `choice` | — | ID-Vergleich |

`set`, `tuple` und `text` werden in M1 **nicht** implementiert. Regel: kein Normalizer
ohne Template, das ihn benutzt.

**Prozentangaben sind in M1 nicht zugelassen.** Templates fragen entweder nach dem Bruch
oder nach dem auf `round_to` Stellen gerundeten Dezimalwert, und der `question_text` sagt
das ausdrücklich. Sonst ist `1.77` gegen `0.0177` nicht entscheidbar.

Auswertung von Nutzereingaben weiterhin mit leerem Scope und der Funktions-Whitelist
(`factorial`, `combinations`, `permutations`, `sqrt`, `abs`, Grundrechenarten).
E-03 (Komma bleibt Argumenttrenner bei `integer`) und E-04 (`unparseable` schließt den
Attempt nicht) gelten unverändert.

---

## G. Ergänze Abschnitt 6 — neue Compute-Funktionen

`lib/engine/compute/kombinatorik.ts` und `lib/engine/compute/wahrscheinlichkeit.ts`:

| `compute_ref` | Formel | Rückgabe |
|---|---|---|
| `kombinatorik.permutation.factorial` | `n!` | ganzzahlig |
| `kombinatorik.permutation.multiset` | `n! / ∏ kᵢ!` | ganzzahlig |
| `kombinatorik.variation.ohne_wdh` | `n! / (n−k)!` | ganzzahlig |
| `kombinatorik.variation.mit_wdh` | `n^k` | ganzzahlig |
| `kombinatorik.kombination.ohne_wdh` | `C(n,k)` | ganzzahlig |
| `kombinatorik.kombination.mit_wdh` | `C(n+k−1, k)` | ganzzahlig |
| `kombinatorik.verteilung.nichtnegativ` | `C(n+k−1, k−1)` | ganzzahlig |
| `kombinatorik.teilmengen.anzahl` | `2^n` | ganzzahlig |
| `wahrscheinlichkeit.hypergeometrisch.genau` | `C(K,k)·C(N−K, n−k) / C(N,n)` | `Rational` |
| `wahrscheinlichkeit.hypergeometrisch.mindestens_eins` | `1 − C(N−K, n) / C(N,n)` | `Rational` |

Jede Funktion hat ein Zod-Input-Schema mit `refine` für die Beziehungen zwischen den
Parametern (`k <= n`, `K <= N`, `n <= N`, `n - k <= N - K`). Die Registry bleibt eine
statische Whitelist.

Tests pro Funktion mit den Randfällen `n = 0`, `k = 0`, `k = n`, `k > n` (muss vom
Zod-Schema abgelehnt werden) und einem großen `n`, bei dem `number` überliefe.

---

## H. Neuer Abschnitt 7a — Formelsatz mit KaTeX

- Mathematik in `question_text` und `solution_text` steht zwischen `$…$` (inline) oder
  `$$…$$` (abgesetzt).
- Gerendert wird **nach** der Interpolation.
- Komponente `components/MathText.tsx`: zerlegt den Text an den Trennzeichen und ruft für
  die Mathe-Teile `katex.renderToString` auf. Kein `react-katex` — die Funktion aus dem
  `katex`-Paket reicht und läuft in Server Components.
- `katex/dist/katex.min.css` wird einmal in `app/globals.css` importiert.
- KaTeX-Optionen: `throwOnError: false`, `trust: false`. Ein kaputter Ausdruck wird rot
  dargestellt statt die Seite zu zerlegen.

---

## I. Ersetze den M1-Absatz in Abschnitt 11

**M1 — Content-Pipeline & Kombinatorik**

Platzhalter-Syntax auf `{{name}}`. Exakte Rationalzahlen im Ausdruckskern. Themenbaum in
`content/topics.yaml`. YAML-Loader mit Zod-Schema und neun statischen Prüfungen,
`npm run content:check` im `pretest`. Zehn Compute-Funktionen für Kombinatorik und
hypergeometrische Verteilung. Zehn Templates als YAML, `dev-templates.ts` gelöscht.
Grading für `integer`, `numeric`, `fraction`, `choice`. KaTeX-Rendering. Themenauswahl
auf Basis des Themenbaums.

Weiterhin **nicht** in M1: Auth, `TopicMastery`, Fortschrittsanzeige, LLM, Fotoupload.
Die Aufgabenauswahl bleibt zufällig innerhalb des Filters; die Mastery-Logik aus
Abschnitt 10 kommt vollständig in M2.

---

## J. Reihenfolge der Umsetzung

Jeder Schritt endet mit grünen Tests und einem Commit. Nach Schritt 3 und nach Schritt 6
stoppen und Rückmeldung einholen.

**Schritt 1 — Platzhalter umstellen.**
`interpolate` auf `{{name}}` umbauen, strikte Prüfung plus Assertion „kein `{{` im
Ergebnis". Dev-Templates anpassen. Tests erweitern: LaTeX mit einfachen Klammern muss
unverändert durchlaufen.

**Schritt 2 — Rationalzahlen.**
`lib/engine/expr/rational.ts` mit Kürzen, Grundrechenarten, Vergleich, Runden und
Dezimal-Parsing. Evaluator und Compute-Registry darauf umstellen. Bestehende Tests
müssen unverändert grün bleiben — falls nicht, ist die Umstellung nicht wertgleich.

**Schritt 3 — Grading erweitern.** `numeric`, `fraction`, `choice` inklusive `round_to`.
Tabellensuite mit mindestens 40 Fällen pro Typ. *→ Hier stoppen.*

**Schritt 4 — Content-Pipeline.**
`topics.yaml`, `schema.ts`, `checks.ts`, `load.ts`, `check-templates.ts`, npm-Skripte,
`next.config.ts`. Die zwei Arithmetik-Templates nach YAML migrieren, `dev-templates.ts`
löschen, Loop gegen `npm run dev` prüfen.
Negativ-Fixtures unter `lib/content/__fixtures__/`: für **jede** der neun Prüfungen ein
Template, das genau daran scheitern muss.

**Schritt 5 — Compute-Funktionen.** Die zehn Funktionen aus Abschnitt G mit Tests.

**Schritt 6 — Templates.** Zehn YAML-Dateien, verteilt über die Blätter des Themenbaums,
`difficulty` 1 bis 4. Property-Test: jedes Template im Repo, 200 Seeds, keine Exception,
alle Constraints erfüllt, kein Platzhalterrest im gerenderten Text. *→ Hier stoppen.*

**Schritt 7 — KaTeX und Oberfläche.**
`MathText`-Komponente, CSS-Import, Themenauswahl aus `topics.yaml`, Eingabefeld mit
Formathinweis je `answer_type` („Ganze Zahl", „Bruch als a/b", „Dezimalzahl, auf 4
Nachkommastellen gerundet").

**Schritt 8 — Abschluss.** `SPEC.md` und `CLAUDE.md` auf den Stand bringen, neue
Entscheidungen in `DECISIONS.md` eintragen, diese Datei löschen.

### Abnahmekriterien für M1

- `npm run content:check` läuft grün, `npm run build` läuft durch.
- Alle Tests grün, jedes Template mit 200 Seeds geprüft.
- Der Practice-Loop funktioniert mit dem Filter `kombinatorik` von Ende zu Ende.
- Eine Aufgabe mit LaTeX im Text wird korrekt gesetzt.
- `lib/content/dev-templates.ts` existiert nicht mehr.
