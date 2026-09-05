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
        │  DB: Attempt (Seed, templateId, templateVersion, params, expectedAnswer,
        │               dazu userId, topic und difficulty für Auswahl und Statistik)
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
955 Tests. Was sich nicht rein testen lässt — Transaktionen, doppeltes Absenden,
`@@unique` — läuft gegen eine Wegwerf-SQLite aus den echten Migrationen (D-19).

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
Compute-Funktionen und Templates als YAML, Grading für `integer`, `numeric`, `fraction`
und `choice`, KaTeX-Rendering.

**M2a — Fortschritt und Auswahl** ✅ Die App passt sich an. Sie merkt sich pro Thema,
wie es läuft (`TopicMastery`), stellt bevorzugt, was schwach ist oder ansteht, und wählt
die Schwierigkeit passend zur Erfolgsquote. `/stats` zeigt den Stand. Die Übungsrunde
heißt jetzt `PracticeSession`, weil Auth.js den Namen `Session` belegt (D-17), und
`Attempt` trägt Nutzer, Thema und Schwierigkeit selbst (D-18).

**M2b — Auswahl, Zeit und Termine** ✅ Drei Korrekturen an dem, was M2a gebaut hat. Es
gibt jetzt genau eine Uhr pro Anfrage statt Zeitstempeln aus der Datenbank (D-20), Termine
stehen relativ da statt als Kalenderdatum (D-22), und die Wiederholungsvermeidung ist
umgebaut: hart gesperrt wird nur noch die identische Aufgabe, zuletzt gestellte Templates
werden abgewertet statt ausgeschlossen (D-24, D-25). Dazu misst `content:check` den
Parameterraum jedes Templates, und die Medianzeit zählt nur richtige Antworten (D-21).
955 Tests grün.

**M2d — Content-Tiefe** ✅ Fünfzehn Templates statt zwölf, vierzehn Compute-Funktionen.
`kombinatorik.permutation` lieferte in einer Sitzung von zwanzig Aufgaben nur sieben
verschiedene und wiederholte sich ab der achten; jetzt sind es zwanzig, und das Thema deckt
die Schwierigkeiten 1 bis 4 ab. Kein Template warnt mehr wegen zu kleinem Parameterraum.
Die Zahlen vorher und nachher stehen in D-28. 1104 Tests grün.

**Damit ist die App für ihren Zweck fertig.**

## 5a. Was jetzt ansteht: benutzen

Der nächste Schritt ist kein Meilenstein. Die App kann, was sie können sollte — Aufgaben
erzeugen, richtig bewerten, sich an die Schwächen des Übenden anpassen und ehrlich sagen,
wo er steht. Sie wird jetzt ein paar Wochen zum Üben verwendet, bevor weitergebaut wird.

Der Grund ist Erfahrung: Die letzten drei guten Anforderungen kamen aus dem Üben und nicht
aus der Planung — die Datumsanzeige, die Definition der Medianzeit und der Befund, dass ein
Thema sich wiederholt. Keine davon stand vorher in einem Dokument.

**Wer neu in einen Chat kommt: bitte keinen nächsten Meilenstein vorschlagen**, solange
nicht ausdrücklich danach gefragt wird. Was gemeldet wird, kommt aus dem Gebrauch.

**Weiterhin offen, aber nicht dringend:** Keine Tests für React-Komponenten (bräuchte
jsdom + Testing Library, bewusst zurückgestellt). Es gibt keinen Login; alles läuft hinter
`getCurrentUserId()` auf einem Dummy-User — für einen einzelnen Übenden genau richtig.

**Wenn es weitergeht:** M2c — Auth.js. Ersetzt nur den Rumpf von `getCurrentUserId()`,
dazu Login-Oberfläche und Routenschutz. Bewusst nach hinten gestellt: Auth macht die App
teilbar, Content macht sie gut — und es gibt einen Nutzer.

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
- **Routen sind Adapter.** Was eine Route entscheidet, steht in einem Modul unter `lib/`,
  das seine Umgebung als Parameter bekommt — eine Route lässt sich nicht importieren und
  bliebe sonst ungetestet. Deshalb tragen nicht alle Dateien unter `lib/db` ein
  `server-only`, sondern nur die, die sich ihre Umgebung selbst holen. (D-12, D-19)
- **Die Übungsrunde heißt `PracticeSession`.** `Session` gehört Auth.js. Die URLs bleiben
  `/api/session` und `/practice/[sessionId]` — ein Pfad ist kein Modellname. (D-17)
- **Es gibt eine Uhr pro Anfrage.** `now: Date` wird als Parameter hereingereicht;
  `new Date()` steht nur in einem Einstiegspunkt, und keine `DateTime`-Spalte hat einen
  Datenbank-Default. Ein Test über den Quelltext erzwingt das. (D-20)
- **Zahlen ohne Grundlage werden nicht angezeigt.** Erfolgsquote, Medianzeit und die
  Schnellschüsse haben je eine Mindestzahl, unter der nichts dasteht — und die Auswahl
  benutzt für unerprobte Themen einen Steuerungswert, der auf der Statistik-Seite
  ausdrücklich nicht auftaucht. (D-21)
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
- **`kombinatorik.verteilung` hat nur ein Template.** Damit trägt `aufg_00010` das Thema
  allein und kommt gemessen auf 19,5 verschiedene Aufgaben von 20 — das Kriterium ist
  erfüllt, aber es ist das schwächste Thema. Ein zweites Template dort wäre die nächste
  naheliegende Content-Arbeit. Keine Reparatur, nur eine Lücke.
- **Veraltete Zahlen nach „Zurück" sind nicht ausgeschlossen.** Beobachtet wurde, dass
  `/stats` gelegentlich alte Werte zeigt. Serverseitig ist das erledigt und belegt: Die
  Seite ist dynamisch, antwortet mit `no-store`, und eine Änderung an der Datenbank ist
  in der nächsten Antwort sichtbar — gemessen gegen den laufenden Produktions-Build.
  Für die Navigation über einen `Link` gilt dasselbe: Ein dynamisches Segment ohne
  `loading.js` wird nicht vorab geladen und nicht zwischengespeichert.
  **Nicht gemessen** ist die Wiederherstellung über den Zurück-Knopf des Browsers — die
  nimmt Next.js bewusst vom Cache aus, um Sprünge und verlorene Scrollposition zu
  vermeiden. Wenn der Effekt wiederkommt, ist das die verbliebene Erklärung, und das
  Gegenmittel heißt `router.refresh()` beim Wiederauftauchen der Seite, nicht
  `revalidatePath`. Kein Umbau auf Verdacht — ein echter Browser wäre nötig, um es
  festzustellen.

Erledigt in M2a: Die Namenskollision mit dem `Session`-Modell des Auth.js-Adapters
(D-17), das fehlende Topic auf dem `Attempt` (D-18), die veralteten Codebeispiele in
`SPEC.md` Abschnitt 4 und 6 — und Invariante 2, die seit M0 nur durch Lesen gesichert
war und jetzt in `lib/db/answer-attempt.test.ts` geprüft wird.

Erledigt in M2d: `kombinatorik.permutation` lieferte sieben verschiedene Aufgaben je
Sitzung und wiederholte sich ab der achten; jetzt sind es zwanzig. Der Weg dorthin ist
lehrreicher als die Zahl: Zwei Compute-Funktionen bekommen jetzt das Ganze und zerlegen
selbst, statt sich die Zerlegung danebenschreiben zu lassen (D-26). Genau an dieser Naht
zwischen zwei Quellen entstand D-15 — und beim Aufbau der neuen Wortliste wäre sie beinahe
wieder entstanden.

Erledigt in M2b: Der Konflikt zwischen Schwierigkeitsgewichtung und
Wiederholungsvermeidung. Der harte Ausschluss der letzten drei Templates kostete bei vier
Templates im Thema die gesamte Gewichtung; die Abwertung, die ihn abgelöst hat, kostet
noch 5 bis 11 Prozent. Die Faktoren sind gemessen, beide Tabellen stehen in D-24. Dass die
Ursache **nicht** zu wenige Templates waren, ist dabei der lehrreiche Teil: Die
naheliegende Erklärung war falsch und wurde durch eine Messung widerlegt, nicht durch ein
Argument.

## 8. Wie man einen neuen Chat sinnvoll beginnt

Nützlich ist: diese Datei plus `CLAUDE.md` und `DECISIONS.md` in den Kontext geben, dazu
`SPEC.md`, wenn es um Architektur geht. Dann die eigentliche Frage — und dabei sagen, ob
Rat, ein Plan oder eine Fehlersuche gewünscht ist.

Weniger nützlich ist, ein Problem ohne diese Dokumente zu schildern: Die Hälfte der
Antwort besteht dann aus Vorschlägen, die in `DECISIONS.md` längst mit Begründung
verworfen wurden.
