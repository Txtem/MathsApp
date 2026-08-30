# SPEC-M2b — Auswahl, Zeit und Termine

> Arbeitsanweisung. Wird in `SPEC.md` eingearbeitet und danach gelöscht.
>
> **Umbenennung:** Was bisher als M2b (Auth.js) geplant war, wird zu **M2c**. Auth ist die
> riskanteste Integration im Projekt und für einen einzelnen Nutzer der geringste Gewinn.
> Die drei Themen hier betreffen dagegen das Kernversprechen der App — dass sie sich an
> die Schwächen des Übenden anpasst und ehrlich sagt, wo er steht.

---

## A. Der Entwurfskonflikt aus 4a

### A-1 Befund

Die Messung in `distribution.test.ts` hat zwei Erklärungen widerlegt und einen dritten
Sachverhalt gezeigt: Der harte Ausschluss der letzten drei `templateId`s aus Abschnitt 10
D-4 arbeitet gegen die Schwierigkeitsgewichtung aus D-3. Der Verlust ist bei **vier**
Templates maximal (100 %, weil genau ein Kandidat übrig bleibt und die Auswahl zu einem
Reihum-Durchlauf wird) und beträgt bei zwanzig Templates immer noch 16 %.

Zusätzlich ist das Verhalten zwischen N=3 und N=4 unstetig: Bei drei Templates greift die
Ausnahme „alles gesperrt, Sperre fällt weg", bei vier nicht. 76 % gegen 100 % — ein Sprung,
den niemand entworfen hat.

Die Ursache ist die Formulierung als **harter Ausschluss** statt als Gewicht. Das ist ein
Fehler in `SPEC.md` Abschnitt 10, nicht in der Umsetzung.

### A-2 Die Sperre trifft das falsche Objekt

Zweiter Befund, unabhängig vom ersten: D-4 sperrt `templateId`. Der Sinn des Generators
ist aber, dass ein Template viele verschiedene Aufgaben hervorbringt — „5 Personen" und
„8 Personen" sind nicht dieselbe Aufgabe.

Was tatsächlich vermieden gehört, ist die **identische Instanz**: gleiches Template,
gleiche Parameter. Die Wiederholung des Verfahrens dagegen ist bestenfalls
abwertungswürdig, nicht verboten.

### A-3 Ersetze Abschnitt 10, Punkt D-4

**Harte Sperre — nur für identische Instanzen.**
Ein Kandidat, der in dieser `PracticeSession` bereits mit exakt denselben Parametern
gestellt wurde, wird ausgeschlossen. Die Prüfung läuft über `(templateId, params)` des
gezogenen Wurfs, also **nach** der Instanziierung. Kollidiert der Wurf, wird mit einem
neuen Seed erneut gezogen, höchstens fünfmal; danach wird die Instanz akzeptiert.
Das ist derselbe Gedanke wie `MAX_TRIES` in `instantiate`: laut scheitern gibt es hier
nicht, weil eine wiederholte Aufgabe besser ist als keine.

**Weiche Abwertung — für zuletzt gestellte Templates.**
Das Gewicht eines Templates aus D-3 wird zusätzlich mit einem Rückschlag multipliziert,
abhängig davon, wie viele Züge seine letzte Verwendung zurückliegt:

| letzte Verwendung | Faktor |
|---|---|
| unmittelbar davor | `f₁` |
| zwei Züge davor | `f₂` |
| drei Züge davor | `f₃` |
| länger her oder nie | 1 |

Die Ausnahme „bleibt kein Kandidat übrig, Sperre fällt weg" entfällt ersatzlos — bei
Gewichten größer null gibt es immer einen Kandidaten. Damit verschwindet auch die
Unstetigkeit zwischen N=3 und N=4.

### A-4 Die Faktoren werden gemessen, nicht geschätzt

`f₁`, `f₂`, `f₃` sind nicht nach Gefühl zu wählen. `distribution.test.ts` kann sie als
Parameter durchfahren. Gesucht ist der Punkt, an dem beides gilt:

- Der Anteil der verlorenen Gewichtung liegt bei N = 4 bis 8 unter 15 %.
- Der Anteil unmittelbarer Wiederholungen desselben Templates liegt bei N ≥ 4 unter 10 %.

Der Startwert für die Suche ist `f₁ = 0.2`, `f₂ = 0.5`, `f₃ = 0.8`. Falls beide Ziele
nicht gleichzeitig erreichbar sind, melde das mit den Messwerten, statt einen
Kompromiss stillschweigend zu wählen.

Das Ergebnis der Suche kommt als Tabelle in `DECISIONS.md`, damit in sechs Monaten
niemand die Zahlen für willkürlich hält und „aufräumt".

### A-5 Was bleibt

Die Content-Tiefe bleibt trotzdem ein echtes Thema: Bei einem einzigen Template in
`kombinatorik.verteilung` kann keine Gewichtung etwas ausrichten. Das ist aber nicht die
Ursache des gemessenen Effekts und gehört deshalb **nicht** in diese Korrektur, sondern
als eigener Punkt in die Meilensteinliste (siehe Abschnitt F).

---

## B. Eine einzige Quelle für „jetzt"

### B-1 Befund

Im Projekt gibt es derzeit mehrere Zeitquellen: `@default(now())` setzt die Datenbank,
`answeredAt` und `dueAt` entstehen im Anwendungscode mit `new Date()`. Zwei Uhren, die
auseinanderlaufen können — und keine davon ist in einem Test steuerbar.

### B-2 Regel

`now` wird als Parameter hereingereicht, nie in einer Funktion geholt.

- Alle reinen Funktionen in `lib/selection/` und der Mastery-Fortschreibung nehmen
  `now: Date` entgegen.
- Die DB-Schichten darüber holen `now` **einmal** pro Anfrage und reichen denselben Wert
  an alle Aufrufe weiter. Ein Statuswechsel und die dazugehörige Terminberechnung tragen
  denselben Zeitstempel, nicht zwei um Millisekunden verschobene.
- `answeredAt` wird aus diesem `now` gesetzt, nicht aus einem zweiten `new Date()`.
- `createdAt` darf bei `@default(now())` bleiben; dass der Anlegezeitpunkt aus der
  Datenbank kommt, ist unschädlich, solange keine Berechnung darauf aufbaut. Prüf, ob das
  stimmt — falls doch, zieh auch `createdAt` in den Anwendungscode.

Das ist dasselbe Muster wie D-12 und D-19: Was eine Funktion sich selbst holt, ist nicht
testbar. Nimm es als `D-20` auf.

### B-3 Terminberechnung

`dueAt = now + intervalDays` wird in **UTC** gerechnet, nicht über lokale Kalendertage.
`intervalDays` ist ein `Float`; die Umrechnung läuft über Millisekunden, nicht über
`setDate()`. Sonst verschiebt eine Zeitumstellung den Termin um eine Stunde und ein
Termin um Mitternacht um einen Tag.

Test: ein Intervall über den Zeitumstellungstermin hinweg ergibt exakt die erwartete
Millisekundendifferenz.

---

## C. Datumsdarstellung — erst diagnostizieren

Es wurden Unstimmigkeiten beobachtet: teils Daten in der Zukunft, teils Werte, die erst
verzögert aktuell werden. Bevor irgendetwas geändert wird, prüf diese Kandidaten und
melde, welche zutreffen:

1. **`dueAt` liegt konstruktionsbedingt in der Zukunft.** Es ist der nächste
   Übungstermin, kein Zeitstempel. Wenn die Statistik-Seite ein nacktes Datum zeigt,
   liest es sich wie ein Fehler. Prüf die Beschriftung: „fällig" bzw. „wieder ab
   <Datum>", nie ein alleinstehendes Datum.
2. **Client-seitiges Caching.** Zeigt `/stats` nach dem Beantworten einer Aufgabe alte
   Werte, wenn man über einen `Link` dorthin navigiert? Falls ja, ist das der Router-Cache
   und nicht die Datenbank. Prüf, ob nach dem Schließen eines Attempts eine Invalidierung
   nötig ist.
3. **Zeitzone bei der Anzeige.** In der Datenbank steht UTC, gerendert wird in lokaler
   Zeit. Ein Zeitstempel kurz vor Mitternacht wechselt dabei den Kalendertag. Prüf
   außerdem, ob Server- und Client-Rendering dasselbe Ergebnis liefern — sonst gibt es
   eine Hydration-Abweichung, die sich als „springt beim Laden" zeigt.
4. **Zwei Uhren.** Siehe Abschnitt B — das kann derselbe Befund aus einer anderen
   Richtung sein.
5. **Speicherformat.** Wie legt der `better-sqlite3`-Adapter `DateTime` ab, und geht
   dabei Genauigkeit oder Zeitzoneninformation verloren? Ein Test, der einen Wert
   schreibt und zurückliest, klärt das in fünf Minuten.

Für jeden bestätigten Punkt ein Test, der ihn festhält. Für jeden widerlegten Punkt eine
Zeile im Bericht, damit er nicht ein zweites Mal untersucht wird.

---

## D. Medianzeit neu definieren

### D-1 Befund

Die Medianzeit über **alle** Attempts vermischt zwei verschiedene Größen. Die Zeit dient
dem Vergleich mit `target_time_seconds` — „schaffe ich diesen Aufgabentyp in der
vorgesehenen Zeit". Bei einer falschen Antwort misst die Dauer, wie lange jemand
gebraucht hat, um sich zu irren. Das ist eine andere Frage.

Folge: Wer schnell falsch antwortet, verbessert seine Medianzeit. Das ist kein
Missbrauchsproblem — es gibt keinen Gegner, der Übende ist der Einzige, dem die Zahl
nützen soll. Es ist ein Definitionsproblem.

Ein Schalter zum Ein- und Ausblenden löst es nicht: Er verteidigt gegen einen Gegner, den
es nicht gibt, und teilt die Daten in zwei Regime, deren Zustand niemand im Kopf behält.

### D-2 Neue Definition

- **Grundgesamtheit:** nur Attempts mit `status = "ANSWERED"` und `isCorrect = true`.
- **Darstellung relativ zur Zielzeit**, nicht in Sekunden: der Median von
  `durationMs / (target_time_seconds · 1000)`, angezeigt als „1,3× Zielzeit".
  Absolute Sekunden sind über Aufgabentypen hinweg nicht vergleichbar.
- **Obergrenze:** Dauern über dem Zehnfachen der Zielzeit gelten als unterbrochen und
  gehen nicht in den Median ein. Sie werden separat gezählt und, sofern vorhanden, als
  „n unterbrochen" ausgewiesen.
- **Mindestzahl:** unter fünf richtigen Antworten wird nichts angezeigt. Dasselbe Prinzip
  wie bei der Erfolgsquote — ein Wert aus zwei Datenpunkten ist keine Aussage.
- **Beschriftung:** „Medianzeit bei richtigen Antworten". Die Einschränkung gehört sichtbar
  in die Oberfläche, nicht nur in den Code.

### D-3 Schnellschüsse als eigene Kennzahl

Die Umkehrung des Einwands: Eine sehr schnelle **falsche** Antwort ist nicht wertlos,
sondern ein Signal. Wer unter einem Fünftel der Zielzeit falsch antwortet, hat geraten
oder das Verfahren nicht erkannt — das ist etwas anderes als jemand, der lange gerechnet
und sich verrechnet hat.

Zähl pro Thema die falschen Antworten unter 20 % der Zielzeit und zeig sie, sobald es
mindestens drei sind. Aus dem Schlupfloch wird damit eine Information.

Beides zusammen als `D-21` aufnehmen: Warum der Median eingeschränkt ist und warum kein
Schalter gebaut wurde.

---

## E. Reihenfolge

Jeder Schritt endet mit grünen Tests und einem Commit.

**Schritt 1 — Diagnose Datum (Abschnitt C).** Nur untersuchen und berichten, noch nichts
umbauen außer offensichtlichen Beschriftungsfehlern. *→ Hier stoppen und berichten.*

**Schritt 2 — Eine Uhr (Abschnitt B).** `now` als Parameter, UTC-Terminberechnung, Tests
inklusive Zeitumstellung. D-20.

**Schritt 3 — Datumsbefunde beheben.** Was in Schritt 1 bestätigt wurde, mit je einem
Test dagegen.

**Schritt 4 — Auswahl umbauen (Abschnitt A).** Harte Sperre auf identische Instanzen,
weiche Abwertung auf Templates, Ausnahme entfernen. `SPEC.md` Abschnitt 10 anpassen.

**Schritt 5 — Faktoren messen (A-4).** Parametersuche in `distribution.test.ts`,
Ergebnis als Tabelle in `DECISIONS.md`. *→ Hier stoppen und berichten.*

**Schritt 6 — Medianzeit (Abschnitt D).** Neue Definition, Schnellschüsse, Anzeige.
D-21.

**Schritt 7 — Abschluss.** `SPEC.md`, `CLAUDE.md`, `OVERVIEW.md` nachziehen, diese Datei
löschen.

### Abnahmekriterien

- Der Anteil der verlorenen Gewichtung liegt bei N = 4 bis 8 unter 15 %, gemessen und
  in `DECISIONS.md` belegt.
- Dieselbe Aufgabe mit denselben Parametern kommt in einer Session nicht zweimal.
- Eine Aufgabe, die über die Zeitumstellung hinweg terminiert wird, hat den korrekten
  Millisekundenabstand.
- Kein Produktionscode ruft `new Date()` innerhalb einer Funktion auf, die eine
  Entscheidung trifft. Ein Test sichert die Regel ab, wie in Schritt 2 von M2a.
- Die Statistik-Seite zeigt keine Medianzeit unter fünf richtigen Antworten und
  beschriftet sie als eingeschränkt.
- Alle Tests grün, `lint`, `content:check` und `build` sauber.

---

## F. Meilensteinliste danach

**M2c — Auth.js.** Wie ursprünglich als M2b geplant. Zusätzlich bereits bekannt:
`User.email` ist `String @unique` und nicht optional, der Adapter erwartet `String?` —
eigene Migration.

**M2d — Content-Tiefe.** Vier bis fünf Templates je Themenblatt über die Schwierigkeiten
1 bis 4, damit die Gewichtung überhaupt etwas zu gewichten hat.
`kombinatorik.verteilung` hat derzeit ein einziges. Das ist Content-Arbeit ohne
Codeänderung und eignet sich als eigener, gut abgrenzbarer Meilenstein.

Reihenfolge zwischen M2c und M2d ist offen und wird nach M2b entschieden.
