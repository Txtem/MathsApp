# Ideen

> Bewertete Vorhaben, die noch keinem Meilenstein zugeordnet sind. Entstanden aus dem
> Sammelabschnitt des M2e-Arbeitsplans, damit die Entwürfe nicht mit jener Datei
> verschwanden.
>
> Abgrenzung: In `BEOBACHTUNGEN.md` steht, was beim Üben aufgefallen ist — roh, ohne
> Deutung. Hier steht, was daraus geworden ist, sobald jemand darüber nachgedacht hat.
> Was gebaut wird, steht in `SPEC.md`.
>
> Ein Eintrag ist keine Zusage. Offene Fragen bleiben offen stehen; sie sind der Grund,
> warum der Eintrag noch hier liegt und nicht in einem Meilenstein.

---

## Darstellung

- **Level und Ränge.** Noch keine Vorstellung davon, woran sich ein Level bemisst —
  Zahl der Aufgaben, Erfolgsquote, Themenabdeckung? Die Frage entscheidet, ob es
  motiviert oder nur schmückt.
- **Statistik-Seite übersichtlicher**: mehr Farbe, Verläufe über die Zeit. Ein Verlauf
  braucht Daten über Wochen — vor dem Ende der Übungsphase nicht sinnvoll.
- **„0,3× Zielzeit" liest sich schlecht.** Eine konkrete Alternative fehlt. Vorschlagen,
  wenn beim Üben eine auffällt; ohne Alternative ist der Punkt nicht entscheidbar.

---

## Content

- **Bernoulli-Ketten** als eigenes Thema. Braucht mindestens eine neue Compute-Funktion
  und einen neuen Zweig im Themenbaum.
- **Anordnungen im Kreis mit Symmetrie und Spiegelung**, über `zyklisch` hinaus — also
  Anordnungen, bei denen auch das Spiegelbild als gleich gilt: `(n−1)!/2`.
  Konzeptuell der nächste Schritt nach `aufg_00015`.
- Weitere Aufgabentypen allgemein, ohne festgelegte Richtung.

---

## Entschieden und geschlossen

**LaTeX als Eingabeschreibweise — nein.** `\frac{69}{420}` bleibt unlesbar. Der
Formathinweis unter dem Eingabefeld nennt die abgelehnte Schreibweise neben der
akzeptierten, und das reicht. Nicht wieder aufmachen, außer die Beobachtungen zeigen,
dass der Hinweis in der Praxis nicht trägt.

Begründung für später: Mit `\frac` kämen `\binom`, `\cdot` und `^{}` hinterher, und die
Grammatik des Parsers franst aus. Der Parser ist die Stelle, an der Invariante 1 hängt.

---

## Umgesetzt

**Versuche, Tipps und Aufgeben — M2f.** Der größte Posten dieser Liste, entstanden aus
den Beobachtungen 4 und 5. Wie hier entworfen: Die Anzeige zeigt vier Ausgänge als
Kreisdiagramm — Aufgegeben, Falsch, Richtig (1. Versuch), Richtig (2. Versuch), beide
Richtig-Varianten grün und getrennt —, die Tipps stehen je Ausgang daneben, und `SKIPPED`
hat mit dem Aufgeben seinen ersten Abnehmer bekommen.

Die offene Frage, die hier vor jeder Zeile Code geklärt sein musste — was zählt für die
**Steuerung**? —, ist so entschieden, wie sie hier als naheliegend vermerkt war: nur der
erste Versuch, und nur ohne Tipp; Aufgeben zählt wie falsch. Für die Anzeige gilt die
Festlegung „richtig ist richtig" unverändert. Begründung in `DECISIONS.md`, D-30; die
Tipp-Leitlinie in D-31 und `content/templates/_README.md`; Weggehen als Aufgeben in D-33.

