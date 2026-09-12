# Beobachtungen aus dem Üben

> Kein Aufgabendokument. Hier wird **festgehalten**, nicht entschieden und nicht
> repariert. Aus diesen Notizen entsteht die Planung des nächsten Meilensteins —
> so wie Datumsanzeige, Medianzeit und der Wiederholungsbefund entstanden sind.
>
> Regel: Beim Üben notieren und weiterüben. Wer sofort repariert, hat nach zwei Wochen
> drei Bugfixes statt fünfzehn Sitzungen Daten.

---

## So wird notiert

Eine Zeile, drei Angaben: **Datum — was passiert ist — was du erwartet hättest.**
Keine Diagnose, keine Vermutung über die Ursache. Das ist die Arbeit der nächsten
Planungsrunde, und eine mitgelieferte Vermutung engt sie ein.

Wenn es sich um eine konkrete Aufgabe dreht: den Fragetext mitkopieren und, falls
sichtbar, die Template-ID. Ohne die Aufgabe ist eine Beobachtung oft nicht mehr
nachvollziehbar.

Gut: `14.09. — "Auf wie viele Arten…24 Personen", 23! als falsch gewertet, erwartet richtig`
Unbrauchbar: `irgendwann letzte Woche stimmte was mit den Fakultäten nicht`

---

## Bewertung (höchste Priorität)

Alles, wo die App über richtig und falsch anders entschieden hat als du.

Warum das am meisten wert ist: Die Normalizer haben über vierzig Testfälle je
Antworttyp — aber geschrieben von derselben Seite, die den Normalizer geschrieben hat.
Dieselbe Konstellation wie in D-15, nur noch nicht aufgeflogen. Eine echte Eingabe ist
die unabhängige Gegenprobe, die es bisher nicht gibt.

Besonders festhalten: Schreibweisen, die abgelehnt wurden, obwohl sie üblich sind —
Tausenderpunkte, Leerzeichen, `·` statt `*`, Klammern, Brüche als Dezimalzahl, ein
Ausdruck statt einer ausgerechneten Zahl.

-

---

## Auswahl

Bekommst du, was du üben solltest?

- Ein Thema, das dauernd kommt, obwohl du es kannst
- Ein Thema, das nie kommt, obwohl du es nicht kannst
- Schwierigkeit springt oder bleibt zu lange unten
- Dieselbe Aufgabe zweimal in einer Sitzung (mit Fragetext notieren)

-

---

## Aufgabentexte und Darstellung

- Formel falsch gesetzt oder unlesbar
- Frage mehrdeutig, mehr als eine Antwort vertretbar
- Formathinweis unter dem Eingabefeld passt nicht zur Frage
- Rechtschreibung, Grammatik, holprige Formulierung

-

---

## Zeit

- Zielzeit zu knapp oder zu großzügig — bei welchem Aufgabentyp
- „Unterbrochen" gezählt, obwohl du durchgearbeitet hast
- „Sehr schnell falsch" gezählt, obwohl du gerechnet hast

-

---

## Statistik-Seite

- Zahl, die nicht zu deinem Eindruck passt
- Termin, der falsch wirkt
- **Offener Punkt aus N-3:** Zeigt die Seite einen alten Stand, wenn du mit dem
  Zurück-Knopf des Browsers dorthin gehst? Das wurde nie gemessen, weil dafür ein
  echter Browser nötig ist. Falls ja: wann, und was war veraltet.

-

---

## Fehlendes

Was du üben wolltest und nicht gefunden hast — Themen, Aufgabentypen, Darstellungen.
Auch grobe Wünsche gehören hierher; sie müssen nicht ausformuliert sein.

-

---

## Sonstiges

Alles, was in keine Kategorie passt. Lieber hier als gar nicht.

-

---

# Erledigt

Nicht gelöscht, sondern abgehakt — die Liste ist auch eine Historie. Wer wissen will,
warum etwas so ist, wie es ist, findet hier den Anlass und den Eintrag dazu.

## Erste Übungssitzungen, aufgearbeitet in M2e

Neun Beobachtungen. **Keine davon war eine falsch bewertete Antwort.** Bei den beiden
Lesefehlern blieb der Versuch nach D-04 offen und zählte nicht als falsch — die
Entscheidung hat gehalten.

| # | Beobachtung | Was daraus wurde |
|---|---|---|
| 1 | Lösungsformel ohne eingesetzte Werte | **erledigt**, M2e C-1. Compute-Funktionen liefern jetzt Anzeigewerte für den Lösungsweg (D-29). |
| 2 | „Reihenfolge" bei Variation und Permutation irreführend | **Fachurteil getroffen:** „Reihenfolge bzw. Anordnung", an vier Stellen. Drei sind geändert (`kombination_mit_wdh` Frage, `kombination_ohne_wdh` Lösung, `variation_ohne_wdh` Lösung); der Fragetext von `variation_ohne_wdh` liegt zur Entscheidung, weil er mit zwei Pluralen schwer liest. |
| 3 | Hypergeometrisch: Werte immer ähnlich groß | **kein Befund.** Zufall innerhalb der Wertebereiche. |
| 4 | Zweiter Versuch | **vertagt**, steht in `IDEEN.md`. Braucht eine Entscheidung am Datenmodell: Zählt ein im zweiten Anlauf richtiger Versuch als richtig? |
| 5 | Tipps | **vertagt**, steht in `IDEEN.md`. Dieselbe offene Frage wie beim zweiten Versuch. |
| 6 | Aufgabe nach dem Lösen nicht mehr sichtbar | **erledigt**, M2e C-3. Frage und eigene Antwort bleiben über dem Urteil stehen. |
| 7 | `\frac{69}{420}` wird nicht gelesen | **entschieden und geschlossen**, M2e C-4. Der Formathinweis nennt die akzeptierte Schreibweise; der Parser bleibt, wie er ist. LaTeX kommt nicht in die Grammatik — danach kämen `\binom`, `\cdot`, `^{}`, und sie franst aus. |
| 8 | Rundung verlangt, Bruch angezeigt | **erledigt**, M2e C-2. Bei `round_to` stehen die gerundete Zahl und der exakte Wert nebeneinander. |
| 9 | `COMBINATIONS` wird nicht erkannt | **erledigt**, M2e C-6. Funktionsnamen werden kleingeschrieben nachgeschlagen. |

