# SPEC-M2b — Restarbeiten und der Meilenstein danach

> Ergänzt `SPEC-M2b.md` und ihren Nachtrag. Wird mit ihnen zusammen in `SPEC.md`
> eingearbeitet und gelöscht. Abschnitt R betrifft M2b, Abschnitt M die Planung danach.

---

## R-1 — N-6 wird zu Schritt 5b, vor Schritt 6

Der Nachtrag hat N-6 keinem Schritt zugeordnet. Er gehört vor Schritt 6, mit zwei
Änderungen gegenüber der dortigen Fassung.

**Die Rolle hat sich verschoben.** N-6 war als Zielvorgabe für M2d gedacht. Diese Rolle
hat die Content-Messung aus Schritt 5 besser übernommen — „7 verschiedene Aufgaben von 20"
ist das Ergebnis, der Parameterraum nur sein Vorbote. Was die statische Prüfung dafür
kann, ist etwas anderes und weiterhin wertvoll: Sie fängt ein zu enges Template beim
Schreiben ab, ohne Datenbank, ohne zwanzig simulierte Sitzungen, direkt in
`npm run content:check`.

**Die Schwelle ist 20, nicht 10.** Eine Sitzung umfasst zwanzig Aufgaben. Ein Template
soll eine Sitzung allein tragen können, also ist zwanzig die begründbare Zahl. Bei zehn
hätte `aufg_00003` (Raum 6) gewarnt und `aufg_00009` (Raum 10) nicht, obwohl beide zu eng
sind.

**Umsetzung:**

- `npm run content:check` gibt je Template die Größe des Parameterraums aus: das Produkt
  der Wertebereiche, bereinigt um die von den Constraints verworfenen Kombinationen. Bei
  rein ganzzahligen Bereichen exakt aufzählbar; wo nicht, Schätzung über Stichproben und
  als solche gekennzeichnet.
- Warnung (kein Fehler) bei Raum < 20.
- Die heute bekannten Fälle werden nicht unterdrückt — sie sollen warnen. Erwartet sind
  `aufg_00004` (1), `aufg_00003` (6), `aufg_00006` (9), `aufg_00009` (10). Bleibt eine
  dieser Warnungen aus oder kommt eine unerwartete dazu, ist die Berechnung falsch.
- Negativ-Fixture nach Konvention.

---

## R-2 — Wofür die Rückschlagfaktoren da sind

**Ergänzung zu D-24, kein neuer Eintrag.**

In der synthetischen Tabelle bedeutet „Wdh." *dasselbe Template wie im Zug davor*. In der
Content-Tabelle bedeutet „Wdh." *dieselbe Aufgabe schon einmal in dieser Sitzung*. Zwei
verschiedene Größen — und seit D-25 ist nur die zweite für den Übenden sichtbar: Bei
ausreichendem Parameterraum liefert dasselbe Template zweimal hintereinander zwei
verschiedene Aufgaben.

Der Eintrag braucht deshalb einen Satz dazu, welchem Ziel `f₁ … f₃` dienen:
**Methodenabwechslung**, also nicht zweimal hintereinander dasselbe Verfahren, auch wenn
die Zahlen andere sind. Nicht: sichtbare Aufgabenwiederholung — die verhindert D-25, und
wo sie trotzdem auftritt, ist der Parameterraum die Ursache und kein Faktor hilft.

Warum das jetzt festgehalten wird: Die Tabelle in D-24 liest sich, als ginge es um
sichtbare Wiederholungen. Ohne diesen Satz optimiert jemand die Faktoren später gegen die
falsche Zahl — und zahlt dafür mit der Schwierigkeitssteuerung, die messbar teuer ist
(fünf Punkte Gewichtungsverlust je zwei bis drei Punkte weniger Wiederholung).

---

## R-3 — `recencyFactors` raus aus `SelectionInput`

Das Feld existiert nur für die Parametersuche; die Anwendung setzt es nie. Der Kommentar
sagt das, der Typ nicht.

`SelectionInput` wird aus Anfragedaten zusammengebaut. Ein Feld, das nur ein Test setzen
soll, kann irgendwann von woanders gesetzt werden, und nichts hält das auf. Dieselbe
Überlegung wie bei D-19 und D-12, nur in die andere Richtung: Dort wurde eine Abhängigkeit
zum Parameter gemacht, um sie testbar zu machen. Hier ist ein Testbedarf in einen
Anwendungstyp gewandert und gehört zurück.

**Umsetzung:** Die Gewichtung ist bereits eine reine Funktion. Sie bekommt die Faktoren
als eigenen Parameter mit Modul-Default; `selectTemplate` ruft sie ohne Argument auf. Die
Parametersuche in `distribution.test.ts` ruft die Funktion direkt. `SelectionInput`
verliert das Feld ersatzlos.

---

## R-4 — Schritt 6 und 7 unverändert

Schritt 6 (Medianzeit, Abschnitt D des Hauptdokuments, D-21) bleibt wie geplant.

Schritt 7 zieht die Dokumentation nach. Die Entscheidung, das nicht vorzuziehen, war
richtig — einmal vollständig ist besser als viermal halb. Die Checkliste für Schritt 7:

- `SPEC.md` Abschnitt 10 auf Abwertung statt Ausschluss, Abschnitt 2 auf die tatsächliche
  Next.js-Version (dort steht noch 15, `CLAUDE.md` trägt einen Next-16-Block).
- `CLAUDE.md`: Stand auf M2b, den offenen Punkt „Gewichtung ungelöst" streichen, die neuen
  Stack-Eigenheiten aufnehmen (kein `@default(now())`, `now` als Pflichtparameter).
- `OVERVIEW.md` Abschnitt 5 und 7: gelöste Punkte streichen, den offenen aus N-3
  (Back/Forward-Wiederherstellung) mit Bedingung und Gegenmittel stehen lassen, den
  Content-Befund aus Schritt 5 als neue Schwachstelle aufnehmen.
- `SPEC-M2b.md`, den Nachtrag und diese Datei löschen.

---

## M — Der nächste Meilenstein: M2d vor M2c

### M-1 Reihenfolge

**M2d (Content) wird vorgezogen, M2c (Auth) rückt dahinter.**

Auth macht die App teilbar, Content macht sie gut — und derzeit gibt es einen Nutzer.
Vor allem aber hat Schritt 5 ein messbares Ziel geliefert, das es vorher nicht gab, und
das Werkzeug dafür steht schon.

### M-2 Der Befund, aus dem M2d entsteht

Aus der Content-Messung in D-24, zwanzig Sitzungen à zwanzig Aufgaben je Thema:

| Thema | Templates | verschiedene Aufgaben von 20 |
|---|---|---|
| arithmetik.grundrechenarten | 2 | 20,0 |
| kombinatorik.kombination | 3 | 20,0 |
| kombinatorik.variation | 2 | 19,1 |
| kombinatorik.verteilung | 1 | 19,6 |
| wahrscheinlichkeit.hypergeometrisch | 2 | 20,0 |
| kombinatorik.permutation | 2 | **7,0** |

M2d ist damit **nicht** „vier bis fünf Templates je Thema", wie ursprünglich geplant. Fünf
von sechs Themen sind in Ordnung. Ein Thema ist kaputt, und zwar das meistgeübte.

### M-3 Abnahmekriterium

**Jedes Thema liefert in einer Sitzung von zwanzig Aufgaben mindestens 18 verschiedene.**
Gemessen mit der Simulation aus Schritt 5, das Ergebnis als Tabelle in `DECISIONS.md`.

Zusätzlich: keine Warnung aus R-1 mehr, also Parameterraum ≥ 20 je Template.

Beide Zahlen sind willkürlich gewählt, aber sie sind gemessen und nicht geschätzt — und
sie stehen fest, bevor die Arbeit beginnt. Das ist der Unterschied zu einem Ziel, das
hinterher an das Ergebnis angepasst wird.

### M-4 Woran gearbeitet wird

**`aufg_00004` (MISSISSIPPI, Raum 1).** Wegen D-13 auf drei feste Gruppen verdrahtet,
jede Instanz ist wörtlich dieselbe Aufgabe. Der Weg: ein `choice`-Parameter über eine
Liste von Wörtern mit Buchstabenwiederholungen, jedes mit seinen Gruppengrößen.
Vorsicht bei der Gruppenzahl — D-15 kam genau daher; die Compute-Funktion nimmt seit
D-15 zwei bis vier Gruppen, und jedes Wort in der Liste muss dazu passen. Die
Erwartungswerte für die Tests werden unabhängig nachgerechnet, nicht aus dem Template
abgeleitet.

**`aufg_00003` (Raum 6), `aufg_00006` (9), `aufg_00009` (10).** Wertebereiche weiten,
soweit die Ergebnisgrenzen in den Constraints das hergeben. Wo nicht: ein zweiter
Parameter statt eines größeren Bereichs.

**Neue Templates in `kombinatorik.permutation`**, bis das Thema über die Schwierigkeiten
1 bis 4 verteilt ist. Heute liegen dort zwei.

**Nicht Teil von M2d:** neue Compute-Funktionen, neue Themen, neue `answer_type`s. Wenn
sich beim Schreiben zeigt, dass eine davon nötig ist, ist das eine Rückfrage, kein
stiller Zusatz.

### M-5 Der Vorbehalt aus D-23

Kosmetische Parameter — ein gewürfelter Name, der die Aufgabe nicht verändert — machen
zwei mathematisch identische Aufgaben formal verschieden und entwerten `questionText` als
Dedup-Schlüssel. Die Wortliste in M-4 ist **kein** solcher Fall: Das Wort bestimmt die
Gruppengrößen und damit das Ergebnis.

Sobald ein Template einen Parameter zieht, der die Rechnung nicht berührt, ist D-23 neu zu
entscheiden. Das gehört vorher gemeldet, nicht nachher bemerkt.
