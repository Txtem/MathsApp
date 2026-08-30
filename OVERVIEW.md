# MathsApp — Gesamtüberblick

> Orientierungsdokument. Wer neu in dieses Projekt kommt — Mensch oder Modell — liest
> zuerst diese Datei und weiß danach, worum es geht, wo das Projekt steht und welche
> Datei welche Autorität hat.
>
> Diese Datei ist **nicht normativ**. Sie beschreibt, sie schreibt nichts vor.
> Bei Widerspruch gilt `SPEC.md`.

---

## 1. Worum es geht

Eine Web-App zum Üben von Mathematik, Oberstufenniveau, Start bei Kombinatorik und
Wahrscheinlichkeitsrechnung. Kein Aufgabenkatalog, sondern ein **Generator**: Aus
versionierten Templates werden durch zufällige, validierte Parameter beliebig viele
Aufgabeninstanzen erzeugt.

Der Nutzer wählt ein Thema, bekommt eine Aufgabe, gibt eine Lösung ein, bekommt ein
Urteil. Später kommt ein Foto des Rechenwegs dazu, das transkribiert und auf Folgefehler
geprüft wird.

Der Kerngedanke, aus dem sich fast alles andere ableitet: **Die richtige Lösung wird
immer deterministisch berechnet, nie von einem Sprachmodell.** Ein LLM darf einen Text
umformulieren oder eine Handschrift lesen — es darf nie entscheiden, ob eine Antwort
richtig ist.

## 2. Wer daran arbeitet

- **Der Repo-Eigentümer** ist Programmier-Einsteiger. Er trifft die Entscheidungen,
  liest jeden Schritt nach und fragt gezielt nach, was er nicht versteht.
  Erklärungen sollen die Idee vermitteln, nicht den Code wiederholen.
- **Ein Mitstreiter** arbeitet ebenfalls im Repo.
- **Claude Code** setzt um, in kleinen Schritten, jeder mit grünen Tests und einem Commit.
- **Chat-Sessions wie diese** dienen der Architektur: Pläne, Entscheidungen,
  Fehlersuche im Entwurf, nicht das Schreiben von Produktionscode.

Arbeitsrhythmus: Ein Meilenstein wird in nummerierte Schritte zerlegt. Nach jedem Schritt
wird gelesen, gefragt und committet. Am Ende eines Meilensteins wird gestoppt und
Rückmeldung eingeholt — nicht durchgezogen.

## 3. Welche Datei was ist

| Datei | Rolle | Wann lesen |
|---|---|---|
| `OVERVIEW.md` | dieses Dokument, Orientierung | zuerst, einmal |
| `SPEC.md` | **normativ.** Architektur, Datenmodell, Template-Format, API-Verträge, Meilensteine | vor jeder Arbeit an Engine, Content, Schema oder Routen |
| `CLAUDE.md` | Arbeitsregeln für Claude Code, aktueller Stand, Stack-Fallen | wird automatisch geladen |
| `DECISIONS.md` | warum die naheliegende Variante *nicht* gewählt wurde | bevor man etwas Bestehendes umbaut |
| `.claude/rules/*.md` | pfadgebundene Regeln, laden nur bei passenden Dateien | automatisch |
| `SPEC-M<n>.md` | Arbeitsplan für einen laufenden Meilenstein, wird danach eingearbeitet und gelöscht | während des Meilensteins |

Regel bei Konflikt zwischen einer Chat-Anweisung und `SPEC.md`: nachfragen, nicht still
abweichen. Eine bewusste Abweichung wird als neuer Eintrag in `DECISIONS.md` festgehalten.

## 4. Wie das System denkt

Der Weg einer Aufgabe, von der Datei bis zum Urteil:

```
content/templates/*.yaml          Template: Wertebereiche, kein fertiger Wert
        │
        │  lib/content/  — YAML lesen, Zod-Schema, neun statische Prüfungen
        ▼
   Template-Objekt                gültig oder Ladefehler, nie halbgültig
        │
        │  lib/engine/instantiate.ts  — Seed → Parameter würfeln → Constraints
        │                                → Registry rechnet → Constraints erneut
        ▼
     Instanz                      Fragetext interpoliert, Lösung berechnet
        │
        │  DB: Attempt (Seed, templateId, templateVersion, params, expectedAnswer)
        ▼
   Aufgabe im Browser             ohne die Lösung — das ist der wichtigste Vertrag
        │
        │  lib/engine/grade/  — normalisieren, dann exakt vergleichen
        ▼
     Urteil                       richtig / falsch / nicht lesbar
```

Drei Eigenschaften dieses Ablaufs sind Absicht und keine Details:

**Die Engine ist rein.** `lib/engine` hat kein I/O — keine Datenbank, kein Netz, keine
Dateien, kein React. Templates werden ihr übergeben, nicht von ihr geladen. Deshalb ist
sie vollständig ohne Mocks testbar, und deshalb liegen dort inzwischen die meisten der
727 Tests.

**Es wird exakt gerechnet.** Der Ausdruckskern arbeitet mit gekürzten Brüchen auf
`BigInt`, nicht mit `number`. Ab `21!` wäre `number` still ungenau, und ab der
hypergeometrischen Verteilung sind Ergebnisse ohnehin Brüche. Float existiert nur für
irrationale Zwischenwerte und ist im Wertetyp als „nicht mehr exakt" markiert.

**Content ist kein Code.** Templates sind YAML, gegen ein Zod-Schema validiert.
`compute_ref` ist ein Schlüssel in einer statischen Registry — eine Whitelist, kein
Codepfad. Kein `eval`, kein dynamischer Import aus Content.

## 5. Stand

**M0 — Skelett** ✅ Next.js-Scaffold, Prisma 7 + SQLite, Engine-Kern, drei API-Routen,
Practice-Loop im Browser.

**M1 — Content-Pipeline & Kombinatorik** ✅ Platzhalter `{{name}}`, exakte Brüche,
Themenbaum, YAML-Loader mit neun statischen Prüfungen und `npm run content:check`,
zwölf Compute-Funktionen, zwölf Templates, Grading für `integer`, `numeric`, `fraction`
und `choice`, KaTeX-Rendering. 727 Tests grün.

**Offen:** Keine Tests für React-Komponenten (bräuchte jsdom + Testing Library, bewusst
zurückgestellt). Die Aufgabenauswahl ist zufällig innerhalb des Filters. Es gibt keinen
Login; alles läuft auf einem Dummy-User.

**Als Nächstes:** M2 — Fortschritt pro Thema, Auswahl nach Schwäche und Fälligkeit,
Statistik-Seite, danach Auth.

Dann M3 (LLM-Einkleidung der Aufgabentexte hinter einem Validierungs-Gate) und
M4 (Foto des Rechenwegs, Transkription, Schritt-Review). **Nicht in V1:** Python-Service,
Mehrsprachigkeit, Mobile-App, Aufgaben-Editor im Browser, Lehrerfunktionen, Gamification.

## 6. Was man wissen muss, bevor man etwas anfasst

Diese Punkte weichen von dem ab, was man sonst annehmen würde. Die vollständige Liste
steht in `CLAUDE.md`; das hier sind die, die am häufigsten überrascht haben:

- **Platzhalter sind `{{name}}`, nicht `{name}`.** Einfache geschweifte Klammern gehören
  LaTeX (`\frac{1}{2}`) und werden nie angefasst. (D-05)
- **Kein `mathjs`.** Ein eigener Tokenizer/Parser/Evaluator in `lib/engine/expr/` trägt
  sowohl die Bewertung als auch die Constraint-Auswertung. (D-01, D-06)
- **Registry-Einträge validieren sich selbst** über `entry.run(params)`. `instantiate`
  ruft nichts anderes auf. (D-14)
- **SQLite kennt keine Prisma-Enums.** `status` und `answerType` sind `String`,
  die erlaubten Werte erzwingt Zod.
- **Prisma 7** braucht einen Driver Adapter, der Client kommt aus
  `@/lib/generated/prisma/client`.
- **`content/` wird von Next.js nicht automatisch mitgebündelt** — der Ordner steht in
  `next.config.ts` unter `outputFileTracingIncludes`.

## 7. Bekannte Schwachstellen

Ehrlich benannt, damit sie nicht als Überraschung wiederkommen:

- **Die UI ist ungetestet.** Beide bisher gefundenen Anzeigefehler (D-16) lagen dort.
  Gegenmittel bisher: Darstellungslogik als reine Funktion herausziehen und diese testen
  (`components/topic-groups.ts`). Das trägt, ersetzt aber keine Komponententests.
- **Tests, die aus dem Template abgeleitet sind, prüfen nichts.** D-15 ist der Lehrfall:
  Template und Test teilten dieselbe falsche Annahme, die Suite blieb grün, das Ergebnis
  war falsch. Erwartungswerte gehören unabhängig nachgerechnet.
- **`Session` heißt wie das Session-Modell des Auth.js-Prisma-Adapters.** Muss vor dem
  Einbau von Auth aufgelöst werden.
- **Das Datenmodell trägt die Auswahl-Logik noch nicht.** `Attempt` kennt sein Topic
  nicht, und `TopicMastery` speichert nur kumulative Zähler — eine Erfolgsquote „über die
  letzten 10 Versuche" ist daraus nicht rekonstruierbar.
- **`SPEC.md` Abschnitt 4 und 6 enthalten veraltete Codebeispiele**, die
  überholten Entscheidungen widersprechen.

## 8. Wie man einen neuen Chat sinnvoll beginnt

Nützlich ist: diese Datei plus `CLAUDE.md` und `DECISIONS.md` in den Kontext geben, dazu
`SPEC.md`, wenn es um Architektur geht. Dann die eigentliche Frage — und dabei sagen, ob
Rat, ein Plan oder eine Fehlersuche gewünscht ist.

Weniger nützlich ist, ein Problem ohne diese Dokumente zu schildern: Die Hälfte der
Antwort besteht dann aus Vorschlägen, die in `DECISIONS.md` längst mit Begründung
verworfen wurden.
