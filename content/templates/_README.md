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

Vor dem Commit: `npm run content:check`.

Dateien, deren Name mit `_` beginnt, werden vom Loader übersprungen.
