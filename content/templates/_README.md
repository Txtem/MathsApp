# Templates

Eine YAML-Datei pro Aufgabenvorlage, abgelegt unter dem obersten Segment ihres
`topic`. Das Format steht in `SPEC.md`, Abschnitt 5.

Kurz das Wichtigste:

- `id` ist repoweit eindeutig und hat die Form `aufg_00042`.
- `topic` muss ein **Blatt** aus `content/topics.yaml` sein.
- Platzhalter sind `{{name}}`. Einfache Klammern gehören LaTeX.
- Mathematik steht zwischen `$…$` (inline) oder `$$…$$` (abgesetzt).
- Jeder gewürfelte Parameter muss im `question_text` vorkommen.
- `round_to` gibt es nur bei `answer_type: numeric`.
- Änderung an `param_spec`, `compute_ref`, `constraints` oder an der Bedeutung
  des `question_text` ⇒ `version` erhöhen. Reine Tippfehler nicht.

## Wie viele Aufgaben ein Template hergeben muss

`npm run content:check` gibt für jedes Template den **Parameterraum** aus: wie viele
verschiedene Aufgaben es überhaupt hervorbringen kann. Unter 20 gibt es eine Warnung.

Die Warnung ist ein Geruch, kein Urteil. Entschieden wird durch die Simulation über eine
ganze Sitzung, nicht durch die Zahl allein — die beiden messen Verschiedenes:

- **Der Parameterraum gilt je Template.** Zwanzig, weil eine Sitzung zwanzig Aufgaben
  umfasst.
- **Das Ziel gilt je Thema:** mindestens 18 verschiedene Aufgaben in einer Sitzung von
  zwanzig. Ein Thema mit mehreren Templates addiert deren Räume und kommt mit weniger je
  Template aus. Ein Thema, das allein von einem Template getragen wird, braucht laut
  Messung rund 25 — bei genau 20 kommen im Mittel nur 17,7 verschiedene heraus, weil mit
  Zurücklegen gezogen wird.

Ein Template unter der Schwelle ist also nicht automatisch falsch. Es ist ein Hinweis,
nachzusehen, ob sein Thema die Wiederholung trägt.

**Ein Thema, das allein von einem Template getragen wird, braucht rund 25.** Mit
Geschwistern reicht weniger, weil sich deren Räume addieren. Heute ist
`kombinatorik.verteilung` der einzige solche Fall: ein Template mit Raum 33, gemessen
19,5 verschiedene Aufgaben je Sitzung.

## Wenn ein Template mehr Varianz braucht

Erst prüfen, ob sich der **Wertebereich** weiten lässt, dann erst über einen zweiten
Parameter nachdenken — und dabei zwei Fallen kennen:

- **Kein kosmetischer Parameter.** Ein gewürfelter Name, der die Rechnung nicht berührt,
  macht zwei mathematisch identische Aufgaben formal verschieden und entwertet den
  Dedup-Schlüssel aus D-25. Manche Aufgaben haben genau einen Freiheitsgrad; dort ist der
  weite Bereich die richtige Antwort und nicht der Zusatzparameter (D-27).
- **Keine zwei Parameter, die zueinander passen müssen.** Wer `n` würfelt und per
  Constraint verlangt, dass die Gruppen es ergeben, verwirft die meisten Würfe und kippt
  irgendwann über `MAX_TRIES`. Was sich ableiten lässt, gehört in die Compute-Funktion:
  Sie bekommt das Wort und zählt selbst, oder die Gruppen und summiert selbst (D-26).

Große Ergebnisse sind kein Hindernis, wo die Antwort ein Ausdruck sein darf — der
Formathinweis unter dem Eingabefeld nennt `5!` ausdrücklich. Wo der Übende die Zerlegung
tatsächlich ausrechnen soll, gehört eine Schranke auf `result` in die `constraints`.

Vor dem Commit: `npm run content:check`.

Dateien, deren Name mit `_` beginnt, werden vom Loader übersprungen.
