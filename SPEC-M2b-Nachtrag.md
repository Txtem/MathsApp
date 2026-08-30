# SPEC-M2b — Nachtrag nach der Diagnose

> Ergänzt `SPEC-M2b.md` nach dem Bericht zu Schritt 1. Wird zusammen mit ihr
> eingearbeitet und gelöscht. Wo etwas dem ursprünglichen Text widerspricht,
> gilt dieser Nachtrag.

---

## N-1 — Termine werden relativ angezeigt (Antwort auf die Rückfrage zu C-3)

**Entscheidung: relative Angabe, keine feste Anzeige-Zeitzone.**

Eine feste Zeitzone nagelt die Abhängigkeit fest, statt sie zu beseitigen — und wird beim
ersten Deployment auf einen fremden Server oder bei der ersten Reise falsch. Eine relative
Angabe entsteht aus der Differenz zweier Zeitpunkte, und eine Differenz hat keine
Zeitzone. Der gemessene Fehler (19.10. gegen 18.10. bei identischem Datenstand) kann damit
nicht wiederkehren.

Dazu kommt die Bedeutung von `dueAt`: Die Intervalle sind 1, 2, 4, 8 Tage bis zur
Deckelung. Ein Kalenderdatum auf den Tag genau behauptet eine Präzision, die das Verfahren
nicht besitzt. Handlungsrelevant ist genau ein Zustand — fällig oder nicht.

**Umsetzung:**

- Drei Stufen: `dueAt <= now` ⇒ „fällig"; Differenz unter 48 Stunden ⇒ „morgen";
  sonst „in N Tagen".
- `N = ceil(differenzInMs / 86_400_000)`, damit „in 1 Tag" nie zu „heute" wird.
- Kein absolutes Datum daneben, auch nicht als Titel-Attribut.
- Die Formatierung ist eine **reine Funktion** mit `now` als Parameter, in
  `components/` neben `stats-rows.ts`, mit eigenen Tests. Die Server Component ruft sie
  nur auf. Kein `Intl.DateTimeFormat` mit implizitem Gebietsschema.
- Test: Derselbe Datenstand liefert unter `TZ=Europe/Berlin` und `TZ=UTC` dieselbe
  Ausgabe. Das ist die Umkehrung der Messung, die den Fehler gefunden hat.

Nimm es als `D-22` auf — mit der Messung aus dem Bericht als Anlass.

---

## N-2 — `@default(now())` entfällt für alle `DateTime`-Spalten

**Ersetzt den letzten Punkt von B-2**, der `createdAt` beim Datenbank-Default belassen
wollte.

Der Bericht zu Kandidat 4 hat die Bedingung geklärt, unter der das erlaubt war: „solange
keine Berechnung darauf aufbaut". Sie ist verletzt — `POST /api/session/[id]/next`
sortiert nach `createdAt`, um die zuletzt gestellten Templates zu finden.

Kandidat 5 liefert die zweite Hälfte: `@default(now())` erzeugt in der Migration
`DEFAULT CURRENT_TIMESTAMP`, und SQLite schreibt damit `2026-08-30 18:31:27` — ein anderes
Textformat als die `+00:00`-Schreibweise des Adapters. SQLite vergleicht Text, und das
Leerzeichen sortiert vor dem `T`.

Heute geht das gut, weil alle `Attempt.createdAt` von der App geschrieben wurden. Der
Bericht nennt es deshalb ein Zukunftsrisiko. Es ist keins: M2c und M2d fügen beide Spalten
hinzu, und eine neue `DateTime`-Spalte mit Default füllt die Bestandszeilen über
`CURRENT_TIMESTAMP` — in einer Spalte, auf der sortiert wird.

**Umsetzung:**

- `@default(now())` aus allen `DateTime`-Spalten entfernen, Migration dazu.
- Die betroffenen Werte werden aus dem einen `now` gesetzt, das die Anfrage
  hereinreicht (B-2). Damit schreibt genau eine Stelle Zeitstempel, in genau einem Format.
- Die sieben Bestandszeilen mit abweichender Schreibweise (`Z` und Leerzeichen) in der
  Migration auf die kanonische Form bringen. Es sind zu wenige, um dafür Übungsdaten zu
  verwerfen.
- Der Test aus `date-storage.test.ts` wird erweitert: Nach der Migration existiert im
  gesamten Datenbestand genau eine Schreibweise.

Das gehört zu `D-20`, nicht als eigener Eintrag — es ist dieselbe Entscheidung („eine
Uhr, eine Quelle"), nur eine Ebene tiefer.

---

## N-3 — Kandidat 2 gilt als offen, nicht als widerlegt

Serverseitig ist die Sache erledigt und belegt. Die Back/Forward-Wiederherstellung wurde
nicht gemessen, weil dafür ein echter Browser nötig wäre.

Kein Umbau auf Verdacht. Stattdessen: Der Punkt bleibt in `OVERVIEW.md` Abschnitt 7 als
offene Beobachtung stehen, mit der Bedingung, unter der er zuschlägt (Navigation über
„Zurück") und dem Gegenmittel (`router.refresh()`), damit die Analyse nicht verloren geht.
Tritt der Effekt wieder auf, ist die Diagnose schon geschrieben.

---

## N-4 — Der Dedup-Schlüssel und seine Bedingung (ergänzt A-2)

`questionText` ist der richtige Schlüssel, und zwar aus einem stärkeren Grund als
Robustheit: Prüfung 4 des Content-Loaders verbietet Nicht-`const`-Parameter, die im
Fragetext nicht vorkommen. **Gleicher `questionText` heißt deshalb gleiche gewürfelte
Parameter** — das folgt aus einer erzwungenen Invariante, es ist keine Heuristik.

**Bedingung, die mitgeschrieben werden muss:** Führt M2d kosmetische Parameter ein — etwa
einen gewürfelten Namen, der die Aufgabe nicht verändert —, macht ein solcher Parameter
zwei mathematisch identische Aufgaben formal verschieden, und der Schlüssel verliert seine
Schärfe. Das ist dann kein Fehler in der Auswahl, sondern eine Folge der Content-Änderung,
und die Entscheidung ist an dieser Stelle neu zu treffen.

Nimm den Schlüssel samt Bedingung als `D-23` auf.

**Zusatz zur Abfrage:** Wenn `POST /api/session/[id]/next` die bisherigen Attempts der
Session lädt, holt sie **nur** `questionText` und `templateId` — nicht die ganze Zeile.
`expectedAnswer` hat in einem Auswahlpfad nichts verloren. Das ist keine
Performance-Frage, sondern die Fortsetzung von Invariante 2 in den Code hinein: Was nie
geladen wird, kann nicht versehentlich hinausgehen.

---

## N-5 — Die Abnahmekriterien aus A-4 werden neu gefasst

Der Bericht hat gezeigt, dass die alte Fassung an Zusagen scheitert, die der Content nicht
hergibt. Die Parameterraum-Tabelle: `aufg_00004` hat Raum 1 (nur `const`-Parameter, D-13),
`aufg_00006` hat 9, `aufg_00009` hat 10 — für eine Sitzung von zwanzig Aufgaben reicht das
nicht.

**Alte Fassung, gestrichen:**
> Dieselbe Aufgabe mit denselben Parametern kommt in einer Session nicht zweimal.
> Der Anteil unmittelbarer Wiederholungen liegt bei N ≥ 4 unter 10 %.

**Neue Fassung:**

1. **Harte Sperre, soweit möglich:** Es wird bis zu fünfmal neu gezogen, wenn der Wurf auf
   einen bereits gestellten `questionText` derselben Session fällt. Ein Template, dessen
   Parameterraum ausgeschöpft ist, liefert danach eine Wiederholung — das ist zulässig und
   wird nicht als Fehler gewertet.
2. **Gewichtungsverlust:** unter 15 % bei N = 4 bis 8, gemessen **synthetisch** mit
   Templates hinreichenden Parameterraums. Dieses Kriterium prüft die Auswahllogik und
   darf nicht am Content scheitern.
3. **Wiederholungsrate:** gemessen gegen den **echten** Content und **je Thema**
   berichtet, ohne globale Schranke. Erwartet wird, dass Themen mit kleinem
   Parameterraum sichtbar schlechter abschneiden. Das Ergebnis ist die Zielvorgabe für
   M2d, kein Abnahmekriterium für M2b.

Falls sich zeigt, dass `f₁` allein die Wiederholungsrate trägt, weil der Parameterraum zu
klein ist: Das ist ein Befund und wird so berichtet, nicht durch einen extremeren Faktor
verdeckt. Ein `f₁`, das die Gewichtung kaputtmacht, um einen Content-Mangel zu
kaschieren, wäre der schlechteste Tausch von beiden.

---

## N-6 — Parameterraum wird gemessen, nicht ausgerechnet

Die Tabelle im Bericht ist der schärfste Befund darin und verfällt beim nächsten Template.

**Umsetzung:** `npm run content:check` gibt je Template die Größe des Parameterraums aus —
das Produkt der Wertebereiche, um die von den Constraints verworfenen Kombinationen
bereinigt. Bei rein ganzzahligen Bereichen ist das exakt aufzählbar; wo nicht, genügt eine
Schätzung über Stichproben, dann aber als solche gekennzeichnet.

Zusätzlich eine Warnung (kein Fehler) bei Raum < 10, mit `aufg_00004` als bekannter
Ausnahme.

Das ist eine neue statische Prüfung; nach der Konvention gehört ein Negativ-Fixture dazu.

**Für M2d vorgemerkt, hier nur notiert:** `aufg_00004` (MISSISSIPPI) ist wegen D-13 auf
feste Gruppen verdrahtet. Der naheliegende Weg wäre ein `choice`-Parameter über eine Liste
von Wörtern mit Buchstabenwiederholungen. Nicht jetzt umsetzen — nur festhalten, damit die
Zahl 1 in der Tabelle eine Adresse hat.

---

## N-7 — Erledigt, nicht noch einmal untersuchen

- `outputFileTracingIncludes` für `/stats`: nicht nötig, das Tracing findet alle 13
  YAML-Dateien selbst. Der bestehende Eintrag für `/practice` verdoppelt das nur.
  Ob er entfernt werden soll, ist eine eigene kleine Frage — nicht in diesem Meilenstein.
- Hydration-Abweichung bei Datumsformatierung: ausgeschlossen, es gibt genau eine
  formatierende Stelle und die steht in einer Server Component.
- Genauigkeitsverlust im Adapter: widerlegt, millisekundengenau, Test vorhanden.
- `dueAt`-Beschriftung: behoben, wird durch N-1 ohnehin ersetzt.
