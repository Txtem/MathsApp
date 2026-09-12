# SPEC-M2e — Korrekturen aus der Übungsphase

> Arbeitsanweisung. Kurzer Meilenstein zwischen zwei Übungsabschnitten, keine
> Funktionserweiterung. Wird nach Abschluss in `SPEC.md` eingearbeitet und gelöscht.
>
> **Die Übungsphase läuft weiter.** Dieser Meilenstein beseitigt Reibung, die beim
> Üben stört — er ersetzt sie nicht. Das Ziel von rund fünfzehn Sitzungen steht.

---

## A. Herkunft und Einordnung

Alle Punkte stammen aus den ersten Übungssitzungen, festgehalten in
`BEOBACHTUNGEN.md`. Die Einordnung, damit später nachvollziehbar ist, warum manches
hier steht und anderes nicht:

| # | Beobachtung | Einordnung | hier? |
|---|---|---|---|
| 1 | Lösungsformel ohne eingesetzte Werte | Entwurfslücke aus D-26 | ja, C-1 |
| 2 | „Reihenfolge" bei Variation/Permutation irreführend | Content, braucht Fachurteil | ja, C-5 |
| 3 | Hypergeometrisch: Werte immer gleich groß | Zufall, kein Befund | nein |
| 4 | Zweiter Versuch | Funktion mit Datenmodellfolgen | nein, siehe E |
| 5 | Tipps | Funktion mit Datenmodellfolgen | nein, siehe E |
| 6 | Aufgabe nach dem Lösen nicht mehr sichtbar | Defekt | ja, C-3 |
| 7 | `\frac{69}{420}` wird nicht gelesen | beabsichtigte Grenze | teilweise, C-4 |
| 8 | Rundung verlangt, Bruch angezeigt | Defekt | ja, C-2 |
| 9 | `COMBINATIONS` wird nicht erkannt | Defekt | ja, C-6 |

Bemerkenswert: Keine der neun Beobachtungen ist eine **falsch bewertete Antwort**. Bei
7 und 9 wird eine richtige Antwort nicht gelesen — nach D-04 zählt das nicht als falsch
und schließt den Versuch nicht. Die Entscheidung hat gehalten.

---

## B. Was dieser Meilenstein nicht tut

Keine neuen Compute-Funktionen, keine neuen Templates, keine neuen Themen, keine
Änderung am Datenmodell. Zeigt sich, dass ein Punkt eines davon braucht, ist das eine
Rückfrage — genau wie in M2d.

---

## C. Die Arbeit

### C-1 Lösungswege zeigen eingesetzte Werte

**Befund.** Bei den Wort-Templates zieht das Template nur `{{wort}}`; die
Buchstabenhäufigkeiten leitet `kombinatorik.permutation.wort` selbst ab (D-26). Damit
kann `solution_text` sie nicht anzeigen — die Formel steht ohne Zahlen da. Eine Formel
ohne eingesetzte Werte lehrt nichts.

D-26 war richtig. Die Folge daraus ist, dass eine Funktion, die etwas ableitet, es auch
für die Anzeige hergeben muss.

**Umsetzung.** Ein Registry-Eintrag darf neben dem Ergebnis benannte
**Anzeigewerte** liefern. Der Eintrag deklariert ihre Schlüssel statisch, damit die
Content-Prüfung ohne Ausführung arbeiten kann:

```ts
"kombinatorik.permutation.wort": {
  displayKeys: ["n", "nenner"],   // statisch deklariert
  run: (params) => ({
    result: ...,
    display: { n: "11", nenner: "1!\\cdot 4!\\cdot 4!\\cdot 2!" },
  }),
}
```

`solution_text` darf damit `{{n}}` und `{{nenner}}` benutzen. Prüfung 3 des Loaders wird
erweitert: Ein `{{x}}` in `solution_text` ist ein `param_spec`-Schlüssel, `result`
**oder** ein deklarierter `displayKey` der zugehörigen Compute-Funktion. Kollidiert ein
`displayKey` mit einem Parameternamen, ist das ein harter Ladefehler — sonst überdeckt
stillschweigend eines das andere.

`question_text` bekommt **keinen** Zugriff auf Anzeigewerte. Der Fragetext trägt den
Dedup-Schlüssel (D-25); abgeleitete Werte dort würden ihn von der Compute-Funktion
abhängig machen.

Danach die Lösungswege aller Templates durchgehen, die abgeleitete Größen benutzen, und
die Formeln mit Zahlen füllen. Als Entscheidung aufnehmen.

### C-2 Bei `round_to` beide Formen anzeigen

**Befund.** Die Aufgabe verlangt eine auf k Stellen gerundete Dezimalzahl, die Lösung
zeigt danach den exakten Bruch. Wer richtig geantwortet hat, zweifelt an sich selbst.

**Umsetzung.** Ist `round_to` gesetzt, zeigt die Lösung beides, beschriftet: die
erwartete gerundete Zahl **und** den exakten Wert als Bruch. Die gerundete zuerst — sie
ist das, wonach gefragt wurde.

### C-3 Aufgabe bleibt nach dem Beantworten sichtbar

Fragetext und eigene Antwort stehen weiterhin auf der Seite, wenn Urteil und Lösungsweg
erscheinen. Ohne die Aufgabe daneben ist der Lösungsweg schwer nachzuvollziehen.

### C-4 Formathinweis schärfen, Parser nicht anfassen

**Befund.** `\frac{69}{420}` wird nicht gelesen. Der Ausdrucksparser hat eine feste
Grammatik, LaTeX gehört nicht dazu — das ist beabsichtigt. Der Instinkt ist trotzdem
verständlich: Wer in der Aufgabe LaTeX sieht, tippt LaTeX zurück.

**Umsetzung.** Nur der Hinweis unter dem Eingabefeld. Er nennt ausdrücklich die
akzeptierte Schreibweise für Brüche (`69/420`) und, wo passend, dass Ausdrücke wie `5!`
oder `combinations(10,3)` erlaubt sind.

**Ausdrücklich nicht:** `\frac` in die Grammatik aufnehmen. Danach kämen `\binom`,
`\cdot`, `^{}`, und die Grammatik franst aus. Tritt der Fall nach dem geschärften Hinweis
weiter auf, wird mit Beleg neu entschieden.

### C-5 „Reihenfolge" in den Aufgabentexten

**Wartet auf eine Vorgabe.** Die bessere Formulierung kommt aus dem Unterricht, nicht aus
dem Code. Liegt sie vor, werden die betroffenen Templates umformuliert und ihre `version`
erhöht — die Bedeutung ändert sich für den Übenden, auch wenn die Rechnung gleich bleibt.

Solange keine Vorgabe da ist: überspringen, nicht raten.

### C-6 Funktionsnamen buchstabenunabhängig

`COMBINATIONS(10,3)` findet die Whitelist nicht, weil buchstabengetreu verglichen wird.
Dafür gibt es keinen Grund.

**Umsetzung.** Funktionsnamen werden vor dem Nachschlagen kleingeschrieben. Die Whitelist
selbst bleibt unverändert — kleingeschrieben wird die Eingabe, nicht die Liste.

Tests: `combinations`, `COMBINATIONS`, `Combinations` und `cOmBiNaTiOnS` liefern dasselbe.
Gegenprobe: Ein Name, der nicht auf der Whitelist steht, bleibt in jeder Schreibweise
`unparseable`.

---

## D. Reihenfolge

**Schritt 1 — C-6 und C-4.** Die zwei billigsten, beide am Eingabefeld. Danach ist die
häufigste Reibung weg.

**Schritt 2 — C-2 und C-3.** Beide an der Antwortseite.

**Schritt 3 — C-1.** Anzeigewerte in der Registry, erweiterte Prüfung 3, Lösungswege
nachziehen. *→ Hier stoppen und berichten.*

**Schritt 4 — C-5**, sofern eine Vorgabe vorliegt. Sonst überspringen.

**Schritt 5 — Abschluss.** `SPEC.md`, `CLAUDE.md` nachziehen, neue Entscheidungen
eintragen, erledigte Beobachtungen in `BEOBACHTUNGEN.md` als erledigt markieren statt zu
löschen — die Liste ist auch eine Historie. Diese Datei löschen.

### Abnahme

- Eine Wort-Aufgabe zeigt im Lösungsweg die eingesetzten Zahlen, nicht nur die Formel.
- Eine Aufgabe mit `round_to` zeigt die gerundete Zahl und den exakten Bruch.
- Nach dem Beantworten stehen Aufgabe, eigene Antwort, Urteil und Lösungsweg zusammen.
- `COMBINATIONS(10,3)` wird gelesen.
- Alle Tests grün, `lint`, `content:check` und `build` sauber.

---

## E. Gesammelt, nicht vergessen

Aus den Beobachtungen, ausdrücklich **nicht** Teil dieses Meilensteins. Die Liste wächst
während der Übungsphase weiter; entschieden wird nach ihrem Ende.

**Funktionen mit Datenmodellfolgen**

- **Zweiter Versuch.** Offene Frage vor jeder Zeile Code: Zählt eine im zweiten Anlauf
  richtige Antwort für den Fortschritt als richtig? Ja bedeutet geschönte Quoten, nein
  bedeutet ein wertlos wirkender zweiter Versuch. Vermutlich braucht es eine dritte
  Kategorie — und damit ein Feld mehr auf `Attempt` und eine Anpassung der
  Mastery-Fortschreibung.
- **Tipps.** Ein `hint`-Feld im Template ist der kleine Teil. Der große: Zählt ein Versuch
  mit Tipp gleich wie einer ohne? Dieselbe Frage wie beim zweiten Versuch.

**Darstellung**

- Level und Ränge
- Statistik-Seite übersichtlicher, mehr Farbe, Verläufe
- Die Schreibweise „0,3× Zielzeit" liest sich schlecht. Eine konkrete Alternative fehlt
  noch — vorschlagen, wenn beim Üben eine auffällt.

**Content**

- Bernoulli-Ketten als eigenes Thema
- Anordnungen im Kreis mit Symmetrie und Spiegelung, über `zyklisch` hinaus
- Weitere Aufgabentypen allgemein
