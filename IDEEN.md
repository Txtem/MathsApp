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

## Versuche, Tipps und Aufgeben

Der größte Posten. Drei Funktionen, die zusammengehören, weil alle drei dieselbe Frage
aufwerfen: Was zählt als „gekonnt"?

### Festgelegt: richtig ist richtig, im ersten wie im zweiten Anlauf

Als gekonnt zählt „richtig" — gleich ob im ersten oder im zweiten Versuch. Der zweite
Anlauf ist nicht nur ein Denkanstoß: Er fängt auch Flüchtigkeitsfehler ab, eine vertippte
Zahl bei sichtbar richtigem Gedanken. Beides zusammen ist der Grund, warum es ihn geben
soll.

**Diese Festlegung gilt für die Anzeige.** Dort stehen vier Kategorien, und die beiden
Richtig-Varianten sind **grün und getrennt** — zusammengefasst wäre die Unterscheidung
verloren, und sie wird erfasst, damit später noch etwas daran hängen kann.

Für die **Steuerung** ist damit nichts entschieden. Die Frage weiter unten bleibt offen.

### Die Darstellung, wie sie gewünscht ist

Ein Kreisdiagramm mit vier Kategorien:

- **Aufgegeben**
- **Falsch**
- **Richtig (1. Versuch)** — grün
- **Richtig (2. Versuch)** — ebenfalls grün, in einer zweiten Abstufung

Die Zahl der genutzten Tipps steht **außerhalb** des Diagramms, je Kategorie. Sie ist eine
zweite Dimension, keine fünfte Kategorie — ein Tipp kann in jeder der vier Lagen benutzt
worden sein.

Damit ist die Frage beantwortet, die vorher offen war: Eine im zweiten Anlauf richtige
Antwort wird weder zu „richtig" noch zu „falsch" gebogen, sie bekommt einen eigenen Platz.

### Was am Datenmodell hängt

`Attempt` braucht mindestens: die Zahl der Versuche (oder ein „im ersten Anlauf richtig"),
ein Kennzeichen für Aufgeben, und die Zahl genutzter Tipps.

**`SKIPPED` existiert bereits.** Der Status steht seit M0 im Modell und wurde nie benutzt.
Der Aufgeben-Knopf ist sein Abnehmer — wahrscheinlich braucht es dafür kein neues Feld,
nur die erste Verwendung eines vorhandenen.

### Die offene Frage, die vor jeder Zeile Code geklärt sein muss

Die Festlegung oben regelt die **Anzeige**. Sie regelt nicht die **Steuerung**: Welche
Kategorie zählt für die Erfolgsquote, die nach Abschnitt 10 die Themenauswahl steuert?

Zählt „richtig im zweiten Anlauf" dort als richtig, hält die App das Thema für gekonnt
und stellt es seltener — obwohl der erste Anlauf danebenging. Zählt es als falsch, fühlt
sich der zweite Versuch wertlos an.

**Die Folge ist schärfer, als sie zuerst klingt.** Die Quote steuert zwei Dinge auf
einmal. Wer fast jede Aufgabe im zweiten Anlauf trifft, bekommt eine Quote nahe 1,0 —
und damit erstens einen niedrigen Score, das Thema kommt also seltener, und zweitens nach
der Tabelle in Abschnitt 10 die Zielschwierigkeit 4. **Das schwächste Thema würde am
seltensten und zugleich am schwersten gestellt.** Genau das Gegenteil dessen, wofür die
Auswahl gebaut ist.

Naheliegend, aber nicht entschieden: Für die Anzeige vier Kategorien, für die Steuerung
nur der erste Anlauf. Dann misst die Auswahl weiterhin das, was sie immer gemessen hat,
und der zweite Versuch ist ein Lernangebot statt einer Bewertungsfrage. Aufgegeben zählt
dabei wie falsch.

Dasselbe für Tipps: Ein Versuch mit Tipp, der im ersten Anlauf richtig war — zählt er für
die Steuerung wie einer ohne? Vermutlich nicht, sonst kann man sich durch Tipps aus einem
Thema herausarbeiten, das man nicht beherrscht.

### Was noch fehlt

Tipps brauchen ein `hint`-Feld im Template und damit Inhalt für vierzehn Templates. Das
ist der größere Teil der Arbeit, nicht die Anzeige.

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
