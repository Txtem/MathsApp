# SPEC-M2d — Content-Tiefe

> Arbeitsanweisung. Wird nach Abschluss in `SPEC.md` eingearbeitet und gelöscht.
> Übernimmt Abschnitt M aus `SPEC-M2b-Restarbeiten.md`, damit der Plan nicht mit
> jener Datei verschwindet.

---

## A. Der Befund

Aus der Content-Messung in D-24, zwanzig Sitzungen à zwanzig Aufgaben je Thema:

| Thema | Templates | verschiedene Aufgaben von 20 |
|---|---|---|
| arithmetik.grundrechenarten | 2 | 20,0 |
| kombinatorik.kombination | 3 | 20,0 |
| kombinatorik.variation | 2 | 19,1 |
| kombinatorik.verteilung | 1 | 19,6 |
| wahrscheinlichkeit.hypergeometrisch | 2 | 20,0 |
| kombinatorik.permutation | 2 | **7,0** |

Fünf von sechs Themen sind in Ordnung. Eines ist kaputt, und zwar das meistgeübte.
`kombinatorik.permutation` liefert insgesamt sieben verschiedene Aufgaben — sechs aus
`aufg_00003` und die eine aus `aufg_00004`. Ab der achten Aufgabe **muss** sich dort
etwas wiederholen.

M2d ist deshalb nicht „vier bis fünf Templates je Thema", wie die alte Meilensteinliste
sagte. Es ist eine gezielte Reparatur.

---

## B. Abnahmekriterien

1. **Jedes Thema liefert in einer Sitzung von zwanzig Aufgaben mindestens 18
   verschiedene.** Gemessen mit der Simulation aus M2b Schritt 5, Ergebnis als Tabelle in
   `DECISIONS.md`.
2. **Keine Warnung aus `content:check` mehr**, also Parameterraum ≥ 20 je Template.
3. `kombinatorik.permutation` deckt die Schwierigkeiten 1 bis 4 ab.
4. Alle Tests grün, `lint`, `content:check` und `build` sauber.

Die beiden Zahlen sind gesetzt, bevor die Arbeit beginnt, und werden nicht an das Ergebnis
angepasst. Stellt sich eine als unerreichbar heraus, ist das eine Rückfrage mit
Messwerten — keine stille Absenkung.

**Zur Beziehung der beiden Schwellen:** Die 20 gilt je Template, die 18-von-20 je Thema.
Ein Thema mit mehreren Templates addiert deren Räume und kommt mit weniger je Template
aus; ein Thema, das allein von einem Template getragen wird, braucht laut Messung rund 25.
Die Warnung bei 20 ist ein Geruch, kein Urteil — entschieden wird durch die Simulation.
Dieser Satz gehört in `content/templates/_README.md`.

---

## C. Die Arbeit

### C-1 `aufg_00004` (MISSISSIPPI), Raum 1

Wegen D-13 auf feste Gruppen verdrahtet; jede Instanz ist wörtlich dieselbe Aufgabe. Das
Template wird nach D-25 nach der ersten Verwendung gesperrt und fällt faktisch aus dem
Pool — es trägt nichts bei.

**Weg:** ein `choice`-Parameter über eine Liste von Wörtern mit Buchstabenwiederholungen.

#### Die Kopplung ist der eigentliche Blocker

Wort und Gruppengrößen müssen zusammenpassen. Ein `choice`-Parameter liefert aber einen
Skalar, und `constraints` kennen nur Zahlen — „die Häufigkeiten in {{wort}} sind 4, 4, 2, 1"
lässt sich im Template-Format nicht ausdrücken. Getrennte Parameter für Wort und Gruppen
wären in fast jedem Wurf inkonsistent, und nichts würde das bemerken.

**Vorab genehmigt, abweichend von C-4:** eine Compute-Funktion, die das Wort entgegennimmt
und die Buchstabenhäufigkeiten selbst zählt. **Nur diese eine.** Eine Lösung ohne
Compute-Änderung hätte Vorrang, wenn es sie gäbe.

Damit entfällt zugleich die Vier-Gruppen-Grenze aus D-15: Sie gilt für
`kombinatorik.permutation.multiset`, das die Gruppen einzeln entgegennimmt. Eine Funktion,
die selbst zählt, hat keine solche Grenze, und die Wortliste ist nicht mehr auf höchstens
vier verschiedene Buchstaben beschränkt.

#### Zwei Templates, nicht eines

Die Ergebnisse streuen von 6 (OTTO) bis 34650 (MISSISSIPPI). Als ein einziges Template
wäre weder die `difficulty` konsistent noch `target_time_seconds` sinnvoll — beides gälte
für beide Enden.

- **Kurze Wörter, Ergebnis bis rund 60** → Schwierigkeit 1.
- **Längere darüber** → Schwierigkeit 2 oder 3. `aufg_00004` behält seine 3.

Das ist zugleich ein Teil von C-3.

#### Ergebnisgrenzen gehören in die `constraints`

Nicht nur in die Wortauswahl. Ein später nachgetragenes Wort fiele sonst durch keine
Prüfung — mit einer Schranke auf `result` verwirft `instantiate` es, und die gezählte
Raumgröße aus `content:check` sinkt sichtbar.

#### Die Wortliste

Startpunkt, keine Vorgabe: TASSE, HALLE, ROLLE, PIZZA, SALAT, TITEL, REGEN, KAFFEE,
BANANE, NESSEL, TEETASSE, ESSEN, KOKOS, LILIE, KAKAO, WELLE, SESSEL, ANANAS, SEELE,
ARARAT, BOOT, KAMM, BALL, OBOE, OTTO, ANNA, EBBE, MAMA.

#### D-15 gilt unverändert

Die erwarteten Ergebnisse werden **unabhängig nachgerechnet**, nicht aus dem Template
abgeleitet. D-15 entstand genau so: Template und Test teilten dieselbe falsche Annahme,
die Suite blieb grün.

`version` erhöhen — die Bedeutung ändert sich.

### C-2 Wertebereiche weiten: `aufg_00003` (6), `aufg_00006` (9), `aufg_00009` (10)

Bereiche vergrößern, soweit die Ergebnisgrenzen in den `constraints` das hergeben. Wo ein
größerer Bereich das Ergebnis unrealistisch groß werden lässt: einen zweiten Parameter
einführen statt den ersten zu strecken.

Nach jeder Änderung `content:check` — die gezählte Raumgröße ist die Kontrolle.
`version` erhöhen. Auch hier gilt: Ergebnisgrenzen in die `constraints`, nicht nur in die
gewählten Bereiche.

**`aufg_00010` (`kombinatorik.verteilung`) wurde geprüft und braucht nichts.** Es ist das
einzige Template seines Themas, also der Fall „ein Thema, ein Template", für den die
Messung rund 25 Parameterraum verlangt. Es hat 33 und kommt gemessen auf 19,5 verschiedene
Aufgaben von 20 — Abnahmekriterium B-1 ist damit erfüllt. Steht hier, damit es später
niemand für vergessen hält.

### C-3 Neue Templates in `kombinatorik.permutation`

Bis das Thema die Schwierigkeiten 1 bis 4 abdeckt.

Nach Konvention gehört zu jedem neuen Template ein Property-Test mit 200 Seeds: keine
Exception, alle Constraints erfüllt, kein Platzhalterrest im gerenderten Text.

#### Schwierigkeit 2: das Kugel-Template, genehmigt

„n Kugeln, davon k₁ rote, k₂ blaue, k₃ grüne — wie viele Anordnungen?" über
`kombinatorik.permutation.multiset`. Das deckt zugleich die Compute-Funktion wieder ab,
die seit Schritt 1 kein Template mehr hat.

**Entwurfshinweis, wichtig:** `n` wird **nicht** gewürfelt. Ein unabhängig gezogenes `n`
plus ein Constraint `k1 + k2 + k3 == n` verwirft den größten Teil der Würfe, und irgendwann
kippt ein Lauf über `MAX_TRIES` — ein Fehler, den danach niemand reproduziert. Das ist
genau die Falle aus D-13.

Stattdessen: nur die drei Gruppengrößen würfeln, `n` gar nicht als Parameter führen, die
Compute-Funktion summiert selbst. Prüfung 4 ist erfüllt, weil dann alle gewürfelten
Parameter im Fragetext vorkommen. Dasselbe Prinzip wie beim Wort — ableiten statt
abschreiben, siehe D-26.

#### Schwierigkeit 4: vermutlich eine Rückfrage

Für eine Aufgabe auf Schwierigkeit 4 in diesem Thema fehlt wahrscheinlich eine
Compute-Funktion — zyklische Anordnung `(n-1)!`, Anordnung mit Nebenbedingung, etwas in
der Richtung. Das widerspricht C-4.

**Der Widerspruch ist der des Dokuments, nicht des Umsetzenden:** B-3 verlangt eine
Abdeckung von 1 bis 4, die die Umfangsgrenze in C-4 ausschließt. B-3 bleibt trotzdem
stehen.

Wenn es so kommt: **fragen, mit Vorschlag und Formel.** Zustimmung ist wahrscheinlich, für
genau **eine** Funktion, nicht für mehrere.

### C-4 Nicht Teil von M2d

Neue Compute-Funktionen, neue Themen, neue `answer_type`s. Zeigt sich beim Schreiben, dass
eines davon nötig ist, ist das eine Rückfrage.

---

## D. Der Vorbehalt aus D-25

Kosmetische Parameter — ein gewürfelter Name, der die Aufgabe nicht verändert — machen
zwei mathematisch identische Aufgaben formal verschieden und entwerten `questionText` als
Dedup-Schlüssel.

Die Wortliste aus C-1 ist **kein** solcher Fall: Das Wort bestimmt die Gruppengrößen und
damit das Ergebnis.

Sobald ein Template einen Parameter zieht, der die Rechnung nicht berührt, ist D-25 neu zu
entscheiden. Vorher melden, nicht nachher bemerken.

---

## E. Reihenfolge

**Schritt 1 — `aufg_00004`.** Wortliste, Gruppengrößen unabhängig nachgerechnet, Tests.
*→ Hier stoppen, wenn die Vier-Gruppen-Grenze nicht reicht.*

**Schritt 2 — Bereiche weiten.** `aufg_00003`, `aufg_00006`, `aufg_00009`.

**Schritt 3 — Neue Permutations-Templates.** Bis Schwierigkeit 1 bis 4 abgedeckt ist.

**Schritt 4 — Messen.** Simulation über alle Themen, Tabelle in `DECISIONS.md`, Vergleich
mit der Ausgangstabelle aus Abschnitt A. *→ Hier stoppen und berichten.*

**Schritt 5 — Abschluss.** `SPEC.md`, `CLAUDE.md`, `OVERVIEW.md` nachziehen,
`_README.md` um den Satz aus Abschnitt B ergänzen, diese Datei löschen.

---

## F. Danach

**M2c — Auth.js.** Ersetzt den Rumpf von `getCurrentUserId()`, dazu Login-Oberfläche und
Routenschutz. Bekannte Vorarbeit: `User.email` ist `String @unique` und nicht optional,
der Auth.js-Adapter erwartet `String?` — eigene Migration. Der Parameter `now` an
`getCurrentUserId` verschwindet dabei (siehe D-20, Abschnitt „Preis").
