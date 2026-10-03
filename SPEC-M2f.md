# SPEC-M2f — Zweiter Versuch, Tipps, Aufgeben

> Arbeitsanweisung. Wird nach Abschluss in `SPEC.md` eingearbeitet und gelöscht.
> Vor dem Löschen prüfen, was ausschließlich hier steht (Abschluss-Checkliste in
> `CLAUDE.md`).
>
> Herkunft: Beobachtungen 4 und 5 aus `BEOBACHTUNGEN.md`, Entwurf in `IDEEN.md`
> Abschnitt „Versuche, Tipps und Aufgeben", Ablauf festgelegt von Peter und Joshua.
>
> Name: M2f, nicht M3. M3 bleibt die LLM-Einkleidung aus der ursprünglichen Planung.

---

## A. Der Ablauf, wie er festgelegt ist

1. Eine Aufgabe wird gestellt. Darunter ein Knopf **„Tipp"**, jederzeit benutzbar.
   Jeder Klick öffnet den nächsten Tipp; geöffnete Tipps bleiben sichtbar.
2. Eine **lesbare, falsche** Antwort im ersten Versuch öffnet **automatisch** den zweiten
   Versuch. Keine Lösung, kein Lösungsweg — nur die Mitteilung, dass es nicht stimmt.
3. Eine **unlesbare** Antwort verbraucht keinen Versuch (D-04 gilt unverändert).
4. Sind **alle** Tipps geöffnet, erscheint **„Lösung zeigen"**. Das ist das Aufgeben.
5. Eine richtige Antwort, gleich in welchem Versuch, schließt die Aufgabe als richtig.
6. Eine falsche Antwort im **zweiten** Versuch schließt die Aufgabe als falsch und zeigt
   die Lösung — ohne dass vorher alle Tipps geöffnet sein müssen. *(Empfehlung,
   siehe Abschnitt B, Entscheidung 2.)*

Daraus ergeben sich vier Ausgänge, die die Statistik als Kreisdiagramm zeigt:
**Aufgegeben, Falsch, Richtig (1. Versuch), Richtig (2. Versuch)** — beide Richtig-
Varianten grün und getrennt. Die Zahl genutzter Tipps steht außerhalb des Diagramms,
je Ausgang.

---

## B. Drei Entscheidungen

Die Empfehlungen gelten, solange der Prompt sie nicht ausdrücklich ändert.

**Entscheidung 1 — Was zählt für die Steuerung als Erfolg?**
Empfehlung: **Richtig im ersten Versuch und ohne geöffneten Tipp.** Alles andere zählt
für die Auswahl als Misserfolg.

Begründung: Die Erfolgsquote steuert Score und Zielschwierigkeit zugleich (`SPEC.md`
Abschnitt 10). Zählt der zweite Versuch oder ein Versuch mit Tipp als Erfolg, geht die
Quote eines schwachen Themas gegen 1,0 — es käme seltener und mit Schwierigkeit 4. Mit
jederzeit verfügbaren Tipps ließe sich jedes Thema per Klick auf „gekonnt" stellen.

Die **Anzeige** bleibt davon unberührt: Dort ist richtig richtig (`IDEEN.md`).

**Entscheidung 2 — Nach der zweiten falschen Antwort.**
Empfehlung: Aufgabe als falsch schließen, Lösung zeigen. Zwei Fehlversuche reichen; der
Zwang, danach noch alle Tipps zu öffnen, wäre Schikane ohne Lerngewinn.

**Entscheidung 3 — Templates ohne Tipps.**
Empfehlung: Ein Template ohne Tipps ist zulässig. „Alle Tipps geöffnet" ist dann sofort
erfüllt, „Lösung zeigen" steht von Anfang an da. Tipps werden zunächst nur für drei
Templates geschrieben (Abschnitt F).

---

## C. Datenmodell

`Attempt` bekommt:

| Feld | Typ | Bedeutung |
|---|---|---|
| `tries` | `Int @default(0)` | Bewertete Versuche: 0, 1 oder 2. Unlesbare zählen nicht. |
| `hintsUsed` | `Int @default(0)` | Wie viele Tipps geöffnet wurden. |
| `firstAnswer` | `String?` | Die falsche erste Antwort, falls es einen zweiten Versuch gab. |
| `firstDurationMs` | `Int?` | Zeit bis zur ersten bewerteten Antwort. |

`firstAnswer` ist kein Zierrat: Die falsche erste Antwort ist die wertvollste Information
darüber, **welcher** Fehler gemacht wurde. Ohne das Feld wäre sie verloren, sobald der
zweite Versuch sitzt.

`SKIPPED` wird zum ersten Mal benutzt — es bedeutet ab jetzt „aufgegeben".

**Migration:** Bestehende `ANSWERED`-Attempts bekommen `tries = 1`, alle bekommen
`hintsUsed = 0`. Sie wurden im alten Ablauf mit genau einem Versuch und ohne Tipps
beantwortet; das ist die wahre Beschreibung, keine Annahme.

**Kein Feld `outcome`.** Der Ausgang wird aus `status`, `isCorrect` und `tries`
abgeleitet, in **einer** reinen Funktion:

```ts
type Outcome = "gave_up" | "wrong" | "right_first" | "right_second";
function classifyOutcome(a: { status; isCorrect; tries }): Outcome | null  // null = offen
function countsAsSuccess(a: { status; isCorrect; tries; hintsUsed }): boolean
```

Beide Funktionen sind die **einzige** Stelle, an der diese Fragen beantwortet werden. Die
Statistik benutzt `classifyOutcome`, die Steuerung (`advanceMastery` und die gleitende
Quote) benutzt `countsAsSuccess`. Ein Test sichert ab, dass beide Abnehmer wirklich diese
Funktionen aufrufen und nicht nachbauen — Konvention zu Extraktionen, siehe R-3.

---

## D. Server-Verhalten

### D-1 Beantworten (`POST /api/attempt/[id]/answer`)

| Lage | Ergebnis | Attempt danach | Lösung in der Response? |
|---|---|---|---|
| unlesbar | `parseError: "unparseable"` | `OPEN`, `tries` unverändert | **nein** |
| richtig, `tries` war 0 | richtig | `ANSWERED` | ja |
| falsch, `tries` war 0 | `retry: true` | **`OPEN`**, `tries = 1`, `firstAnswer`/`firstDurationMs` gesetzt | **nein** |
| richtig, `tries` war 1 | richtig | `ANSWERED`, `tries = 2` | ja |
| falsch, `tries` war 1 | falsch | `ANSWERED`, `tries = 2` | ja |

**Die dritte Zeile ist die heikelste Änderung des Meilensteins.** Heute schließt jede
lesbare Antwort den Attempt. Ab jetzt bleibt er nach der ersten falschen Antwort offen,
und Invariante 2 verlangt, dass dann **nichts** aus `expectedAnswer`, `solutionText` oder
`expectedRounded` in die Response gelangt. Der Antworttyp für diesen Fall steht als
Konstante da, wie heute `UNPARSEABLE`, damit sichtbar bleibt, was er nicht enthält.

Der Übergang von `tries = 0` auf `tries = 1` ist atomar wie der Statuswechsel heute:
`updateMany` mit `status: "OPEN", tries: 0` in der Bedingung. Zwei gleichzeitige erste
Antworten dürfen nicht beide als „erster Versuch" gelten.

`durationMs` beim Schließen ist die Zeit bis zur **letzten** bewerteten Antwort.

### D-2 Tipp (`POST /api/attempt/[id]/hint`) — neu

- Nur für `OPEN`-Attempts des eigenen Nutzers.
- Liefert den Tipp mit Index `hintsUsed` und erhöht `hintsUsed` atomar
  (`updateMany` mit dem alten Wert in der Bedingung).
- Sind alle geöffnet: 409, nichts ändert sich.
- Response: `{ hint: string, index: number, total: number }`.

Beim Neuladen der Seite müssen bereits geöffnete Tipps wieder erscheinen, ohne
`hintsUsed` zu erhöhen — die Seite liefert die Tipps `0 … hintsUsed−1` mit.

### D-3 Aufgeben (`POST /api/attempt/[id]/give-up`) — neu

- Nur für `OPEN`-Attempts des eigenen Nutzers.
- **Abgelehnt mit 409, solange `hintsUsed < Anzahl der Tipps`.** Die Regel „erst alle
  Tipps" setzt der Server durch, nicht die Oberfläche.
- Setzt `status = "SKIPPED"` und `answeredAt`, liefert Lösung und Lösungsweg.
- **Schreibt den Fortschritt fort**, als Misserfolg. Sonst wäre Aufgeben ein Ausgang aus
  der Statistik: Wer merkt, dass er es nicht kann, gibt auf, und das Thema gilt als
  gekonnt.

### D-4 Steuerung

`closeAttempt` und das Aufgeben übergeben an `advanceMastery` nicht mehr `isCorrect`,
sondern `countsAsSuccess(...)`. Die gleitende Quote der letzten zehn in
`lib/db/topic-stats.ts` zählt über **geschlossene** Attempts (`ANSWERED` und `SKIPPED`)
mit derselben Funktion.

---

## E. Templates

### E-1 Feld `hints`

```yaml
hints:
  - "Kommt es auf die Reihenfolge an? Und darf ein Element mehrfach vorkommen?"
  - "Es werden {{k}} der {{n}} Plätze vergeben, und jeder Platz geht an eine andere Person."
  - "Für Platz 1 gibt es {{n}} Möglichkeiten, für Platz 2 noch {{n}} − 1, …"
```

Optional, geordnet, vom Allgemeinen zum Konkreten: erst das Erkennen des Aufgabentyps,
dann der Ansatz, dann der erste Rechenschritt. Ein Tipp verrät **nie** das Ergebnis.

### E-2 Prüfungen beim Laden

- In einem Tipp sind nur Platzhalter aus `param_spec` erlaubt — **nicht** `result` und
  **nicht** die `displayKeys` der Compute-Funktion. Anzeigewerte sind Zwischenergebnisse
  der Lösung (`n_minus_1` beim runden Tisch); im Tipp verrieten sie zu viel.
- Negativ-Fixture je Regel, nach Konvention.

### E-3 Unabhängige Gegenprobe

Die Platzhalterregel verhindert `{{result}}`, aber nicht, dass jemand die Zahl
ausrechnet und hineinschreibt. Deshalb zusätzlich ein Property-Test über 200 Seeds je
Template: Kein gerenderter Tipp enthält die gerenderte Lösung als Zeichenfolge. Für
Ergebnisse mit weniger als drei Ziffern gibt das Fehlalarme (eine 6 steht auch in
Parametern) — dort wird übersprungen, und das steht im Test.

---

## F. Reihenfolge

Jeder Schritt mit grünen Tests und einem Commit.

**Schritt 0 — Restposten aus M2e.** `aufg_00005` steht im Repo noch auf `version: 1` mit
„Reihenfolgen" im Fragetext; Fassung B („Wie viele verschiedene Anordnungen sind für das
Treppchen möglich?") ist nicht angekommen. Prüfen, ob der Commit existiert und nur nicht
gepusht wurde; sonst anwenden, Version auf 2. `BEOBACHTUNGEN.md` Zeile 2 entsprechend
nachziehen.

**Schritt 1 — Datenmodell.** Migration aus Abschnitt C, `classifyOutcome` und
`countsAsSuccess` als reine Funktionen mit Tests.

**Schritt 2 — Zweiter Versuch.** D-1 umsetzen. Tests gegen die Wegwerf-Datenbank, vor
allem: Nach der ersten falschen Antwort enthält die Response keine Lösung, und eine
Gegenprobe, die das absichtlich bricht, lässt Tests fallen. *→ Hier stoppen.*

**Schritt 3 — Tipps im Template.** Feld, Prüfungen, Fixtures, Gegenprobe aus E-3.

**Schritt 4 — Tipp- und Aufgeben-Route.** D-2, D-3, D-4, mit Tests. Besonders: Aufgeben
vor dem letzten Tipp wird abgelehnt; Aufgeben schreibt den Fortschritt als Misserfolg.

**Schritt 5 — Oberfläche.** Tipp-Knopf, Meldung zum zweiten Versuch, „Lösung zeigen"
nach dem letzten Tipp, geöffnete Tipps nach Neuladen wieder sichtbar. Die
Entscheidungslogik als reine Funktion neben der Komponente, nach dem Muster von
`stats-rows.ts`.

**Schritt 6 — Tipps für drei Templates.** Eines je Schwierigkeit 1, 2 und 4 aus
`kombinatorik`, je drei Tipps. *→ Hier stoppen.* Peter und Joshua üben damit und sagen,
ob Art und Stufung der Tipps passen, bevor die übrigen geschrieben werden.

**Schritt 7 — Statistik.** Kreisdiagramm der vier Ausgänge als handgeschriebenes SVG,
ohne Diagrammbibliothek; die Berechnung der Kreissegmente als reine Funktion mit Tests.
Tipps je Ausgang daneben. Bestehende Zeilen je Thema bleiben.

Zur Zeit auf der Statistik-Seite: Die Medianzeit rechnet weiter über richtige Antworten
(beide Varianten), mit `durationMs` bis zur letzten Antwort. Die Schnellschüsse
(D-21) zählen künftig **erste** Antworten, die falsch und schnell waren — dafür ist
`firstDurationMs` da; sonst verschwände ein geratener erster Versuch, sobald der zweite
sitzt.

**Schritt 8 — Tipps für die übrigen Templates**, nach der Rückmeldung aus Schritt 6.

**Schritt 9 — Abschluss.** `SPEC.md` (Datenmodell, API-Verträge, Abschnitt 10),
`CLAUDE.md`, `OVERVIEW.md`, `IDEEN.md` (der Abschnitt wandert nach „umgesetzt"),
`BEOBACHTUNGEN.md` (4 und 5 erledigt), neue Entscheidungen in `DECISIONS.md`.
Abschluss-Checkliste. Diese Datei löschen.

---

## G. Abnahme

- Nach der ersten falschen Antwort enthält die Response weder `expectedAnswer` noch
  `solutionText` noch `expectedRounded` — getestet, mit Gegenprobe.
- Aufgeben vor dem letzten Tipp wird vom Server abgelehnt, nicht nur von der Oberfläche.
- Aufgeben verändert den Themenfortschritt.
- Ein Versuch, der erst im zweiten Anlauf oder mit Tipp richtig war, senkt die
  Erfolgsquote der Steuerung, erscheint in der Statistik aber grün.
- Kein Tipp enthält das Ergebnis, weder als Platzhalter noch ausgeschrieben.
- Alte Attempts erscheinen in der Statistik korrekt als „Richtig (1. Versuch)" oder
  „Falsch".
- Alle Tests grün, `lint`, `content:check` und `build` sauber.

---

## H. Nicht Teil von M2f

Level und Ränge, Verläufe über die Zeit, neue Themen, neue Compute-Funktionen,
Auth. Alles bleibt in `IDEEN.md` bzw. als M2c geplant.
