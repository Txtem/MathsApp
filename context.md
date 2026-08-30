Ich fange mit 4a an — erst der Nachweis, dann die Umstellung.

Failure 2 ist interessant — das ist genau die Falsifikation. Erst messen.

Der Nachweis widerlegt meine Erklärung. Ich schreibe den Test auf das um, was tatsächlich gemessen ist.

4a ist widerlegt und committet. 4b halte ich für richtig — die Umstellung ist genau die Trennung aus D-12 und D-19, und die Route ist die einzige Stelle, an der Invariante 2 durchgesetzt wird. Ich setze sie um.

Jetzt die Extraktion.

Jetzt die Tests gegen die Wegwerf-Datenbank.

Das war ein Fehler in meinem Test-Helfer, nicht im Code: `deps(undefined)` löst den Default-Parameter aus.

Die Gegenprobe greift. Jetzt die `server-only`-Regel nachziehen — sie zählt Dateien auf, und das ist inzwischen falsch.

Jetzt noch die Statuscodes der umgebauten Route gegen die laufende App.

Schritt 4b steht. Weiter mit Schritt 5 — der Statistik-Seite.

Die `isDue`-Zeile ist verunglückt. Ich schreibe sie sauber.

Jetzt die DB-Schicht für die Statistik.

`/stats` ist dynamisch. Jetzt die Seite im Browser prüfen.

Die Seite stimmt. Noch ein Test für die DB-Schicht darunter.

Schritt 5 steht. Jetzt Schritt 6 — Dokumentation nachziehen.

**M2a ist abgeschlossen.** Sieben Commits, 863 Tests grün, `lint`, `content:check` und `build` laufen durch. `SPEC-M2.md` ist eingearbeitet und gelöscht.

## 4a — deine Skepsis war berechtigt, meine Erklärung war falsch

Der Test steht in [distribution.test.ts](MathsApp/lib/selection/distribution.test.ts), 20 000 geseedete Ziehungen je Fall.

**Ohne Wiederholungsvermeidung zieht `selectTemplate` exakt nach Gewicht.** Bei Zielschwierigkeit 4 und Schwierigkeiten 1 bis 5 kommen die von Hand nachgerechneten Anteile 3/31, 4/31, 6/31, 12/31, 6/31 heraus, innerhalb von vier Standardfehlern. Die Ziehfunktion ist damit aus dem Verdacht — kein Bug dort.

**Mit Vermeidung sieht es so aus:**

| Templates im Thema | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 15 | 20 |
|---|---|---|---|---|---|---|---|---|---|
| Anteil der Gewichtung, der verloren geht | 76 % | **100 %** | 73 % | 61 % | 48 % | 33 % | 28 % | 21 % | 16 % |

Meine Erklärung war „bei zwei bis drei Templates pro Thema überlagert die Vermeidung die Gewichtung" — mit der Implikation, mehr Content würde es beheben. Beides falsch. Das Maximum liegt bei **vier** Templates, und dort bleibt von der Gewichtung *nichts* übrig: Drei gemiedene IDs lassen genau einen Kandidaten zu, die Auswahl ist dann kein Ziehen mehr, sondern ein deterministischer Reihum-Durchlauf. Der Test prüft das zusätzlich direkt — ab dem vierten Zug enthält jedes Fenster von vier Aufgaben alle vier Templates. Und bei zwanzig Templates gehen immer noch 16 % verloren.

Der eigentliche Befund: **D-3 und D-4 aus Abschnitt 10 arbeiten gegeneinander.** Das ist keine Content-Frage, es ist ein Entwurfskonflikt in der SPEC. Er steht jetzt mit der Tabelle in `OVERVIEW.md` Abschnitt 7 als ungelöst und mit einem Vermerk in `SPEC.md` Abschnitt 10 — nicht die falsche Erklärung.

**Das braucht deine Entscheidung.** Ich habe die Auswahl-Logik nicht angefasst; sie tut, was Abschnitt 10 verlangt. Der naheliegende Umbau wäre, die Vermeidung als Gewichtsabschlag statt als harten Ausschluss zu bauen — ein zuletzt gestelltes Template bekäme etwa ein Fünftel seines Gewichts statt null. Damit blieben beide Eigenschaften erhalten, und der Sonderfall „alles gesperrt, Sperre fällt weg" verschwände von selbst. Das ist eine Änderung an Abschnitt 10, also deine.

## 4b — Invariante 2 ist getestet

Die Entscheidungskette steht in [answer-attempt.ts](MathsApp/lib/db/answer-attempt.ts), die Route ist auf 50 Zeilen Adapter geschrumpft. 18 Tests gegen die Wegwerf-Datenbank: unlesbare Eingabe gibt weder `expectedAnswer` noch `solutionText` heraus und lässt den Attempt offen, fremder Attempt gibt nichts preis, zweites Absenden wird abgelehnt und verändert die Statistik nicht, die geschlossene Aufgabe liefert Lösung und Lösungsweg. Gegenprobe gemacht: Gibt der `unparseable`-Zweig die Lösung heraus, fallen zwei Tests um. Die Statuscodes habe ich gegen die laufende App nachgemessen — unverändert.

Ein Nebenfund dabei: Die `server-only`-Regel in `CLAUDE.md` und `.claude/rules/api.md` zählte Ausnahmedateien auf und war seit `topic-stats.ts` falsch. Sie nennt jetzt das Kriterium statt einer Liste — `server-only` trägt, wer sich seine Umgebung selbst holt.

## Schritt 5 und 6

`/stats` zeigt je Thema Versuche, Quote gesamt, Quote der letzten zehn und den Termin, gruppiert wie die Themenauswahl. Ein Detail, das ich bewusst so entschieden habe: Die angezeigte Quote ist **nicht** `successRate` aus der Auswahl. Deren 0,5 für unerprobte Themen ist ein Steuerungswert; auf einer Statistik-Seite wäre sie schlicht gelogen. Ohne Versuche steht dort nichts.

Offen für M2b: `User.email` ist `String @unique` und nicht optional, der Auth.js-Adapter will `email String?`. Das ist eine eigene Migration.