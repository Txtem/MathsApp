# Getroffene Entscheidungen

Bewusste Abweichungen von `SPEC.md` und Festlegungen, die die SPEC offengelassen hat.
Nicht ohne Rückfrage zurückdrehen — die Gründe stehen dabei, weil sie sonst in der
nächsten Session fehlen.

Format: fortlaufende Nummer, Datum, Meilenstein. Neue Einträge unten anhängen.

---

## D-01 — Eigener Ausdrucksparser statt `mathjs`
*2026-08-19, M0*

`SPEC.md` Abschnitt 7 nannte ursprünglich `mathjs.parse` + `evaluate`. Umgesetzt ist
stattdessen `lib/engine/expr/` (Tokenizer, rekursiver Abstiegsparser, Evaluator).

**Grund:** `mathjs` rechnet in float64, damit wäre der Vergleich ab `21!` still falsch —
das bricht die BigInt-Regel und Invariante 1. Zusätzlich hätten die `MathNode`-Typen
`as`-Casts erzwungen.

Alle inhaltlichen Vorgaben bleiben erfüllt: kein `eval`, feste Grammatik,
Funktions-Whitelist (`factorial`, `combinations`, `permutations`, `sqrt`, `abs`,
Grundrechenarten), leerer Scope bei Nutzereingaben, `unparseable` ≠ falsch.
Derselbe Parser trägt auch die Constraint-Auswertung.

**Nachtrag M1:** Der Parser wird durch D-06 auf exakte Brüche erweitert, statt `mathjs`
für `numeric`/`fraction` nachzuziehen. Die in der Ursprungsfassung offengelassene
Möglichkeit, `mathjs` doch noch zu ergänzen, ist damit erledigt.

---

## D-02 — `tsconfig.json`: `target` von ES2017 auf ES2020
*2026-08-19, M0*

Unterhalb ES2020 lehnt TypeScript `0n`-Literale ab. Da die gesamte Engine auf `BigInt`
rechnet, wäre die Alternative `BigInt(0)` an hunderten Stellen. Next.js kompiliert ohnehin
moderner; das Feld wirkt nur auf die Typprüfung.

---

## D-03 — Bei `answer_type: integer` bleibt `,` der Argumenttrenner
*2026-08-19, M0*

`combinations(10,3)` ist eine gültige Antwort, deshalb wird das Komma dort nicht zum
Dezimalpunkt. Die Grading-Tabelle ordnet die Regel `,` → `.` ohnehin nur `numeric` zu.

**Folge:** `2,5` gilt bei einer Ganzzahlfrage als „nicht lesbar", nicht als „falsch" —
was näher an der Wahrheit ist. `1,000` bleibt Tausendertrennung.

---

## D-04 — Eine unlesbare Antwort schließt den Attempt nicht
*2026-08-19, M0*

`SPEC.md` Abschnitt 8 ließ offen, was bei `parseError: "unparseable"` mit dem Attempt
passiert. Umgesetzt: Der Attempt bleibt `OPEN`, die Response enthält **kein**
`expectedAnswer` und keinen `solutionText`, der Nutzer darf es noch einmal eingeben.

**Grund:** Alles andere bräche Invariante 2 — die Lösung darf einen offenen Attempt nicht
verlassen — oder würde jemanden für einen Tippfehler die Aufgabe kosten. Ein Parse-Fehler
ist ausdrücklich nicht „falsch", genau deshalb gibt es das Feld.

---

## D-05 — Platzhalter sind `{{name}}` statt `{name}`
*M1*

M0 nutzte `{n}`. Ab M1 enthalten Aufgabentexte LaTeX, und LaTeX benutzt einfache
geschweifte Klammern als Argumentklammern: `\frac{1}{2}`, `\sqrt{2}`, `\binom{n}{k}`.

**Grund:** Ein strikter Interpolator mit einfachen Klammern liest `\frac{1}{2}` als zwei
unbekannte Platzhalter und wirft. Es gibt keine zuverlässige Heuristik, die einen
Platzhalter von einem LaTeX-Argument unterscheidet. Die Alternative wäre ein nachsichtiger
Interpolator — dann fällt aber ein Tippfehler wie `{nn}` nie auf, und die statische
Template-Prüfung verliert ihren Sinn.

Mit doppelten Klammern bleibt LaTeX unberührt und die strikte Prüfung funktioniert weiter.
Nach der Interpolation gilt die Assertion, dass kein `{{` im Ergebnis übrig ist.

---

## D-06 — Exakte Rationalzahlen als Wertetyp im Ausdruckskern
*M1*

`lib/engine/expr/` rechnet nicht mehr nur mit `BigInt`, sondern mit gekürzten Brüchen
(`{ num: bigint, den: bigint }`, `den > 0`).

**Grund:** Ab der hypergeometrischen Verteilung sind Ergebnisse Brüche. In float gerechnet
wäre der Vergleich wieder ungenau — genau der Grund, aus dem `mathjs` verworfen wurde
(D-01). Die konsequente Fortsetzung ist ein exakter Bruchtyp, kein Float-Rückfall.

**Folgen:** `integer` ist der Fall `den === 1n`. `fraction` fällt ohne Zusatzarbeit ab.
`numeric` vergleicht exakt statt mit Toleranz. Dezimaleingaben werden verlustfrei
überführt (`0.0177` → `177/10000`). Float bleibt ausschließlich für irrationale
Zwischenwerte (`sqrt`) und wird im Wertetyp als „nicht mehr exakt" markiert.

---

## D-07 — Kein Normalizer ohne Template, das ihn benutzt
*M1*

Die ursprüngliche M1-Beschreibung verlangte „alle Normalizer". Umgesetzt werden nur
`integer`, `numeric`, `fraction` und `choice`. `set`, `tuple` und `text` bleiben offen,
bis ein Template sie braucht.

**Grund:** Ein Normalizer ohne Aufrufer ist Spekulation über eine Anforderung, die noch
niemand gestellt hat, plus Testaufwand für Verhalten, das niemand prüft. Der `float`-
Parametertyp entfällt aus demselben Grund.

---

## D-08 — Themenpfade kommen aus `content/topics.yaml`
*M1*

`topic` war ein freies Textfeld mit Regex-Prüfung. Ab M1 muss es auf ein Blatt im
Themenbaum zeigen.

**Grund:** Ein Tippfehler wie `kombinatorik.permuation` hätte lautlos ein neues Thema
erzeugt — mit eigener Fortschrittsstatistik ab M2 und ohne dass jemand es merkt.
Der Baum liefert zusätzlich die Beschriftungen für die Themenauswahl-Seite, sodass es
keine zweite Liste gibt, die auseinanderlaufen kann.

**Folge:** Ein Template zeigt immer auf ein Blatt. Ein Session-`topicFilter` darf auf
jeder Ebene stehen und umfasst dann alle Blätter darunter.

---

## D-09 — Prozentangaben sind als Antwortformat nicht zugelassen
*M1*

Templates fragen nach dem Bruch oder nach dem auf `round_to` Stellen gerundeten
Dezimalwert, und der Aufgabentext sagt das ausdrücklich.

**Grund:** Ohne diese Festlegung ist `1.77` gegen `0.0177` nicht entscheidbar — beides
wäre je nach gemeinter Einheit richtig. Die Alternative wäre ein Einheitenfeld im
Antwortformat, das für den Nutzen zu viel Komplexität kostet.

---

## D-10 — Das Komma entscheidet sich am Kontext, nicht am `answer_type`
*M1*

`SPEC-M1.md` Abschnitt F schrieb für `numeric` schlicht `,` → `.` vor. Umgesetzt ist eine
Regel, die zwei Fälle unterscheidet:

- Enthält die Eingabe **Buchstaben**, ist sie ein Ausdruck mit Funktionsaufrufen. Kommas
  bleiben dann Argumenttrenner: `combinations(4,2)*combinations(48,4)/combinations(52,6)`.
- Sonst ist sie eine reine Zahl. Pro Zahl gilt: beide Trennerarten vorhanden ⇒ die hintere
  ist der Dezimaltrenner; ein Trenner mehrfach ⇒ Tausendertrennung, aber nur bei sauberer
  Dreiergruppierung; genau ein Trenner ⇒ Dezimaltrenner.

**Grund:** Die pauschale Regel hätte genau die Antworten zerstört, für die `numeric` in M1
gebraucht wird — die hypergeometrische Verteilung wird typischerweise als Quotient von
Binomialkoeffizienten eingegeben. Umgekehrt muss `0,0177` lesbar bleiben.

Die Zahl-Regel greift **pro Zahl**, nicht auf den ganzen Ausdruck: `0.5-0.125` sind zwei
Dezimalzahlen und nicht eine Zahl mit zwei Tausenderpunkten. Passt eine Gruppierung zu
keinem Fall (`0,3,7`), bleibt sie stehen und scheitert am Parser — „nicht lesbar" ist
ehrlicher als eine geratene Zahl. D-03 (`integer` behält das Komma als Argumenttrenner)
bleibt unberührt.

---

## D-11 — `fraction` vergleicht Werte, nicht Schreibweisen
*M1*

`SPEC-M1.md` verlangt für `fraction` „Zähler und Nenner exakt". Da `Rational` immer gekürzt
ist, ist das gleichbedeutend mit Wertgleichheit: `10/24`, `5/12` und `1/3+1/12` gelten alle.
Eine exakt darstellbare Dezimaleingabe wird ebenfalls akzeptiert — `0.375` für `3/8`.

**Grund:** Der Grader prüft, ob jemand den richtigen Wert ausgerechnet hat, nicht ob er ihn
in der erwarteten Schreibweise notiert. Eine gerundete Eingabe wie `0.4167` für `5/12` ist
dagegen schlicht falsch, weil sie einen anderen Wert bezeichnet.

Wenn ein Template später auf der Bruchschreibweise bestehen soll, ist das eine
Formatprüfung im Template, keine Änderung am Vergleich.

---

## D-12 — `lib/content/read.ts` trägt kein `server-only`
*M1*

Die Konvention verlangt `import "server-only"` in allem unter `lib/content`. Umgesetzt ist
eine Zweiteilung: `read.ts` liest und prüft den Content ohne `server-only`, `load.ts` ist
der einzige aus `app/` importierte Zugang und trägt es.

**Grund:** `server-only` wirft außerhalb einer React-Server-Umgebung. Mit dem Import in
`read.ts` könnten weder `scripts/check-templates.ts` noch die Vitest-Suite den Content
laden — genau die beiden Stellen, die ihn prüfen sollen.

**Folge:** Die Regel gilt weiterhin für alles, was die Anwendung importiert. Wer aus `app/`
auf Templates zugreift, nimmt `load.ts`; `read.ts` ist für Werkzeuge.

---

## D-13 — `permutation.multiset` hat drei feste Gruppen und ein statisches Template
*M1*

Die Compute-Funktion nimmt `n`, `k1`, `k2`, `k3` statt einer Liste von Gruppengrößen. Das
zugehörige Template `aufg_00004` (MISSISSIPPI) hat ausschließlich `const`-Parameter.

**Grund:** Das Template-Format kennt weder Listen noch abgeleitete Parameter. Ein
gewürfeltes `n` müsste über ein Constraint zur Summe der Gruppen passen; die Trefferquote
läge bei rund einem Sechstel, und `MAX_TRIES = 50` würde gelegentlich scheitern — ein
Property-Test über 200 Seeds wäre dann zufällig rot. Ein statisches Template ist ehrlicher
als ein flackernder Generator.

**Wenn mehr Varianz nötig wird:** abgeleitete Parameter ins Template-Format aufnehmen
(`k3: {type: derived, expr: "n - k1 - k2"}`) — das ist dann eine eigene Entscheidung.

---

## D-14 — Registry-Einträge validieren selbst (`entry.run`)
*M1*

`ComputeEntry` hat neben `input` und `compute` eine Methode `run(params: unknown)`, die
beides verbindet. `instantiate` ruft ausschließlich `run` auf.

**Grund:** Seit M1 ist die Registry heterogen — jeder Eintrag hat einen anderen
Parametertyp. `registry[ref]` ist damit eine Vereinigung von `ComputeEntry<S>`, und eine
generische Hilfsfunktion `runCompute(entry, params)` kann `S` nicht mehr inferieren. Die
Alternative wäre ein `as`-Cast an der heikelsten Stelle des Systems gewesen. Eine
einheitliche Signatur `(params: unknown) => Rational | undefined` lässt sich dagegen auf
der Vereinigung aufrufen, und die Typsicherheit bleibt im Eintrag selbst erhalten.

---

## D-15 — `permutation.multiset` nimmt zwei bis vier Gruppen
*2026-08-20, M1*

Das Eingabeschema hat jetzt `k1` und `k2` als Pflichtfelder sowie `k3` und `k4` als
optionale. Vorher waren es genau drei Gruppen (D-13).

**Anlass:** ein falsches Ergebnis in `aufg_00004`. MISSISSIPPI hat vier Buchstabengruppen
(4×I, 4×S, 2×P, 1×M). Um in die drei Felder zu passen, standen im Template 5/4/2 — die
Summe stimmte, die Aufgabe nicht. Die Engine rechnete `11!/(5!·4!·2!) = 6930`, während der
angezeigte Lösungsweg die richtige Formel `11!/(4!·4!·2!·1!) = 34650` zeigte. Wer richtig
gerechnet hatte, bekam „falsch".

**Was daran lehrreich ist:** Der Fehler lag nicht im Rechenteil, sondern an einer
Formatgrenze, die ich mir selbst gesetzt hatte. Kein Test hat ihn gefunden, weil beide
Seiten dieselbe falsche Annahme teilten — die Testfälle waren aus dem Template abgeleitet
statt unabhängig nachgerechnet. Deshalb prüft die Suite jetzt konkrete Wörter mit ihren
tatsächlichen Buchstabenhäufigkeiten.

**Folgen:** `aufg_00004` steht auf `version: 2` (Änderung an `param_spec`). Ältere
Attempts behalten ihr gespeichertes Ergebnis; der Lösungsweg wird für sie nicht mehr
gerendert, weil die Version nicht mehr passt. Das ist das vorgesehene Verhalten.

---

## D-16 — Die Themenauswahl gruppiert, statt einzurücken
*2026-08-20, M1*

Die Auswahlseite zeigt je Oberthema eine Karte mit Überschrift und darin die einzelnen
Themen als Zeilen. Vorher war es eine flache Liste, deren Ebenen nur über den Einzug
unterschieden waren.

**Anlass:** Die Einrückung war unbrauchbar — `offers.flatMap(flatten)` reichte den
Array-Index als Ebene weiter (`flatMap` ruft den Callback mit `(element, index, array)`
auf), sodass jedes weitere Oberthema eine Stufe tiefer stand als das vorige. Selbst
richtig gerechnet bliebe die Darstellung schwach: Einzug allein sagt nicht, was ein Gebiet
ist und wo es endet.

**Regeln der neuen Darstellung:** Themen ohne Aufgaben werden nicht angeboten. Tiefere
Ebenen werden als Blätter hochgezogen, statt weitere Einzugsstufen einzuführen. Jedes
Oberthema führt seine Themen auf, auch wenn es nur eines ist. Die Umformung steht als reine
Funktion in `components/topic-groups.ts` und hat eigene Tests.

**Nachtrag, noch am selben Tag:** Ursprünglich unterdrückte die Darstellung ein einzelnes
Thema unter seinem Oberthema, weil beide dasselbe aussagen. In der Praxis war das
schlechter: Zwei von drei Gebieten standen ohne Unterpunkte da, und es sah aus, als fehlte
dort etwas. Einheitlichkeit schlägt hier Sparsamkeit — die Regel ist gestrichen.

---

## D-17 — Die Übungsrunde heißt `PracticeSession`, nicht `Session`
*2026-08-30, M2a*

Das Domänenmodell für eine Übungsrunde heißt im Prisma-Schema `PracticeSession`, mit
`Attempt.practiceSessionId` und `User.practiceSessions`. Die HTTP-Routen und die URLs
bleiben, wie sie sind: `POST /api/session`, `/practice/[sessionId]`, und das
Response-Feld heißt weiter `sessionId`.

**Grund:** Der Prisma-Adapter von Auth.js bringt ein eigenes Modell `Session`
(`sessionToken`, `userId`, `expires`) mit und spricht es fest als `prisma.session` an —
der Name ist nicht konfigurierbar. Prisma-Modellnamen sind im Schema eindeutig, also
kann nur das Domänenmodell ausweichen. Auch das Feld `User.sessions` musste weichen,
weil Prisma für die Auth-Relation eine Gegenseite auf `User` braucht.

**Warum die Routen nicht mitwandern:** Ein URL-Pfad ist kein Modellname. Eine
Umbenennung bis in die UI hätte den Praxis-Loop, die API-Verträge und die Tests
angefasst, ohne dass irgendetwas davon mit Auth.js kollidiert.

**Gilt auch ohne Auth-Tabelle:** Sollte sich in M2b zeigen, dass die gewählte
Auth-Strategie (z.B. JWT statt Datenbank-Sessions) gar keine `Session`-Tabelle braucht,
bleibt die Umbenennung trotzdem. Zwei Bedeutungen von „Session" im selben Projekt sind
eine Fehlerquelle, unabhängig davon, ob Prisma sie erzwingt.

**Offen für M2b:** `User.email` ist derzeit `String @unique` und nicht optional. Der
Auth.js-Adapter erwartet `email String?`. Das ist eine eigene Migration und gehört in
die Planung von M2b, nicht hierher.

---

## D-18 — `Attempt` trägt `userId`, `topic` und `difficulty` denormalisiert
*2026-08-30, M2a*

`Attempt` speichert beim Anlegen zusätzlich den Nutzer, das Topic und die Schwierigkeit,
obwohl alle drei ableitbar wären — der Nutzer über `PracticeSession`, Topic und
Schwierigkeit über `templateId`. Dazu ein Index `@@index([userId, topic, answeredAt])`.

**Anlass:** `SPEC.md` Abschnitt 10 verlangt eine Erfolgsquote „über die letzten 10
Versuche". Aus `TopicMastery` ist die nicht rekonstruierbar — dort stehen nur kumulative
Zähler. Sie muss also aus den Attempts selbst kommen, und die Abfrage dafür lautet
„die letzten zehn beantworteten Attempts *dieses Nutzers* in *diesem Topic*".

**Warum `topic` und nicht der Umweg über das Template:** Die Statistik-Seite und die
Auswahl fragen nach Topic, nicht nach Template. Vor allem aber darf ein gelöschtes oder
umbenanntes Template die Historie nicht entwerten — wer vor drei Wochen zehn Aufgaben zur
Hypergeometrischen gerechnet hat, hat sie gerechnet, auch wenn das Template inzwischen
weg ist.

**Warum `userId` dazukam:** Im Arbeitsplan zu M2a (`SPEC-M2.md`, inzwischen eingearbeitet
und gelöscht) standen nur `topic` und `difficulty`, mit dem Index `[topic, answeredAt]`.
Der trägt die Abfrage aber nur zur Hälfte: Die
Einschränkung auf den Nutzer hängt an `PracticeSession` und käme als Join obendrauf —
bei der Auswahl vor jeder einzelnen Aufgabe und auf der Statistik-Seite für jedes Topic.
Das ist dasselbe Argument, mit dem `topic` denormalisiert wird, nur eine Ebene höher.

**Warum `difficulty`, obwohl M2a sie nicht liest:** Die Auswahl liest die Schwierigkeit
aus dem Template, die Statistik-Seite zeigt sie nicht an — in M2a hat das Feld also
keinen Abnehmer. Es steht trotzdem im Schema, weil es sich später nicht nachtragen lässt:
Ändert ein Template seine `difficulty`, ist die Schwierigkeit, gegen die tatsächlich
geübt wurde, verloren. Das ist der einzige Grund; wer das Feld unbenutzt vorfindet,
soll es deshalb nicht wegräumen.

**Preis:** Drei redundante Spalten, die beim Anlegen eines Attempts stimmen müssen. Sie
werden an genau einer Stelle gesetzt (`POST /api/session/[id]/next`) und danach nie mehr
geändert — ein Attempt ist nach dem Anlegen bis auf Antwort und Urteil unveränderlich.

**Folge für die Abfrage:** Gefiltert wird auf `status: "ANSWERED"`, nicht auf
`answeredAt != null`. Eine unlesbare Eingabe schließt den Attempt ohnehin nicht (D-04),
aber `SKIPPED` ist in `SPEC.md` vorgesehen, und ein übersprungener Attempt mit
`isCorrect: null` darf die Quote nicht verwässern.

**Migration:** Die vorhandenen Attempts in der lokalen `dev.db` wurden dabei verworfen —
Testdaten, für die es keinen sinnvollen Wert für die neuen Pflichtspalten gibt.

---

## D-19 — Datenbanknahe Tests laufen gegen eine temporäre SQLite-Datei
*2026-08-30, M2a*

`lib/db/__testing__/temp-database.ts` legt pro Test eine eigene SQLite-Datei im
Temp-Verzeichnis an, spielt die **echten** Migrationen aus `prisma/migrations/` darauf
ab und gibt einen Prisma-Client darauf zurück. Nach dem Test wird die Datei gelöscht.

**Anlass:** Der Arbeitsplan zu M2a verlangte für die Fortschreibung des Themenfortschritts zwei
Tests — „doppeltes Absenden zählt einmal" und „`unparseable` zählt gar nicht". Beide
prüfen kein Rechenergebnis, sondern Verhalten der Datenbank: dass `updateMany` mit der
Bedingung `status: "OPEN"` genau einmal trifft und dass die Fortschreibung an dieselbe
Transaktion gekoppelt ist. Mit einem Mock hätte der Test nur nachgespielt, was ich
ohnehin annehme — genau der Fehler aus D-15.

**Warum die echten Migrationen und kein handgeschriebenes Test-Schema:** Ein zweites
Schema würde mit dem ersten auseinanderlaufen. So fällt eine vergessene Migration im Test
auf, nicht erst beim nächsten `migrate dev`.

**Folge — Module unter `lib/db` tragen kein `server-only`, wenn sie ihre Umgebung als
Parameter bekommen:** Die Regel „`import "server-only"` in allem unter `lib/db`" ist hier
bewusst ausgesetzt, aus demselben Grund wie bei `lib/content/read.ts` (D-12). Diese Module
nehmen den Prisma-Client entgegen, statt ihn aus dem Singleton zu ziehen; sie lesen kein
`process.env` und öffnen keine Verbindung. Was nie in den Browser darf, ist
`lib/db/client.ts` — und dort steht das `server-only` weiterhin.

**Nachtrag, M2a Schritt 4b:** Dieselbe Trennung hat danach die Route
`POST /api/attempt/[id]/answer` erreicht. Ihre Entscheidungslogik steht jetzt in
`lib/db/answer-attempt.ts` und ist gegen die Wegwerf-Datenbank getestet, die Route ist
nur noch der Adapter auf Statuscodes. Damit ist Invariante 2 — `expectedAnswer` verlässt
den Server nicht, solange der Attempt offen ist — erstmals seit M0 durch Tests gedeckt
statt nur durch Lesen. Der ursprüngliche Vermerk „die Route selbst bleibt ungetestet"
ist damit erledigt.

**Preis:** Eine neue Dev-Abhängigkeit (`@types/better-sqlite3`, reine Typen) und ein
Testlauf, der Dateien anlegt. Die Suite braucht dafür rund eine Sekunde mehr.


---

## D-20 — Eine Uhr pro Anfrage, und keine in der Datenbank
*2026-08-30, M2b*

`now: Date` wird von außen hereingereicht, nie in einer Funktion geholt. Gelesen wird die
Uhr genau einmal je Anfrage, an ihrem Einstiegspunkt — im Route Handler oder in der Server
Component —, und von dort an alles weitergereicht, was einen Zeitpunkt braucht.
`@default(now())` steht in keiner `DateTime`-Spalte mehr.

**Anlass:** Zwei getrennte Befunde, die dieselbe Ursache haben.

Erstens waren `answeredAt` und `dueAt` zwei Uhrablesungen, Millisekunden auseinander,
obwohl sie denselben Vorgang beschreiben — den Moment, in dem eine Aufgabe beantwortet
wurde. Dasselbe Muster wie D-12 und D-19: Was eine Funktion sich selbst holt, ist nicht
testbar und nicht steuerbar.

Zweitens erzeugt `@default(now())` in der Migration ein `DEFAULT CURRENT_TIMESTAMP`.
Prisma füllt den Wert bei eigenen Inserts selbst und kanonisch; der SQL-Default greift
nur dort, wo an Prisma vorbei geschrieben wird — und das tut jede Migration, die eine
Spalte hinzufügt. SQLite schreibt dann `2026-08-30 18:31:27`, der Adapter dagegen
`2026-08-30T18:31:27.000+00:00`. SQLite vergleicht Text, und das Leerzeichen sortiert vor
dem `T`: Gemessen liefert `orderBy: desc` die spätere Zeile zuletzt, und ein
`gte`-Filter übersieht sie ganz (`lib/db/date-storage.test.ts`). Betroffen wäre
`Attempt.createdAt` — die Spalte, nach der `POST /api/session/[id]/next` die zuletzt
gestellten Templates sucht. In `User.createdAt` stand der Fall bereits, erzeugt von der
`RedefineTables`-Migration zu D-18.

**Umsetzung:** `now` ist Pflichtfeld in `CloseAttemptInput`, `AnswerInput` und
`SelectionInput` — kein Default-Parameter, den ein Aufrufer vergessen kann. Die Migration
`zeitstempel_ohne_sql_default` entfernt die Defaults und bringt die sieben Bestandszeilen
mit abweichender Schreibweise über `strftime` auf die kanonische Form; die 225
Zeitstempel der lokalen `dev.db` tragen danach eine einzige.

**Abgesichert:** `lib/db/one-clock.test.ts` prüft den Quelltext — `new Date()` und
`Date.now()` ohne Argument stehen nur an Einstiegspunkten (`app/**/route.ts`,
`app/**/page.tsx`). Als Kriterium formuliert, nicht als Dateiliste, damit eine neue Route
keinen Eintrag braucht. Die eine benannte Ausnahme ist die Stoppuhr im Browser, die eine
Dauer misst und keinen Zeitpunkt. `lib/db/date-storage.test.ts` hält das Speicherformat
fest, `lib/selection/mastery.test.ts` den Terminabstand über die Zeitumstellung hinweg.

**Preis:** `getCurrentUserId(now)` hat einen Parameter bekommen, den es fachlich nicht
braucht — der Dummy-User schreibt beim Anlegen ein `createdAt`. Mit M2c verschwindet die
Funktion samt Parameter. Alle Tests, die Zeilen anlegen, setzen ihre Zeitstempel jetzt
selbst; das ist Absicht, weil ein Testdatum aus der echten Uhr dieselbe Unschärfe hätte.

---

## D-22 — Termine stehen relativ da, nicht als Datum
*2026-08-30, M2b*

Die Statistik-Seite sagt „fällig", „morgen" oder „in N Tagen". Ein Kalenderdatum steht
nirgends, auch nicht als Titel-Attribut. Die Formulierung entsteht in `dueLabel`
(`components/due-label.ts`), rein und mit `now` als Parameter.

**Anlass:** Zwei Befunde aus der Diagnose zu M2b.

Der eine war gemessen: Derselbe Datenstand, dieselbe Seite, zweimal gerendert — unter
`TZ=Europe/Berlin` stand dort 19.10.2026, unter `TZ=UTC` 18.10.2026. Der Rohwert ist
`2026-10-18T22:01:13.241Z`, und ein Kalendertag entsteht erst durch eine Zeitzone. Weil
die Seite auf dem Server gerendert wird, ist es dessen Zeitzone, nicht die des Übenden.
Eine feste Anzeige-Zeitzone würde die Abhängigkeit nur festnageln und bei der ersten
Reise falsch liegen; eine Differenz dagegen hat keine Zeitzone.

Der andere ist inhaltlich: `dueAt` ist kein Zeitpunkt, den jemand einhalten muss, sondern
das Ergebnis eines Intervalls von 1, 2, 4, 8 Tagen. Ein Datum auf den Tag genau behauptet
eine Genauigkeit, die SM-2-light nicht besitzt. Handlungsrelevant ist, ob ein Thema jetzt
ansteht — alles andere ist eine Größenordnung.

**Festlegungen:** Unter 48 Stunden heißt es „morgen", darüber `ceil(Abstand / 1 Tag)`
Tage, damit ein angebrochener Tag nicht unterschlagen wird und „in 1 Tag" nie zu „heute"
wird. Ohne Termin gilt ein Thema als fällig — es wurde nie geübt.

**Abgesichert:** `components/due-label.test.ts` prüft die Grenzen und rechnet dieselbe
Eingabe unter beiden Zeitzonen — mit einer Gegenprobe, die zeigt, dass ein Kalenderdatum
an derselben Stelle auseinanderfällt. Ohne sie wäre der Test grün, ohne etwas zu prüfen.

---

## D-24 — Zuletzt gestellte Templates werden abgewertet, nicht gesperrt
*2026-08-30, M2b*

`SPEC.md` Abschnitt 10 verlangte, die letzten drei `templateId`s dieser Sitzung
auszuschließen. Der Ausschluss ist ersetzt durch einen Rückschlag auf das Gewicht:
`f₁` für den Zug davor, `f₂` für zwei, `f₃` für drei Züge zurück, sonst 1.

**Anlass:** Der Ausschluss arbeitete gegen die Schwierigkeitsgewichtung derselben
Abschnitts. Gemessen in `lib/selection/distribution.test.ts`, 20 000 geseedete Ziehungen
je Poolgröße — der Anteil der Gewichtung, der verloren geht:

| Templates im Thema        |    3 |    4 |    5 |    6 |    8 |   10 |   12 |   15 |   20 |
|---------------------------|------|------|------|------|------|------|------|------|------|
| harter Ausschluss (vorher) | 76 % |100 % | 73 % | 61 % | 48 % | 33 % | 28 % | 21 % | 16 % |
| Abwertung 0.2 / 0.5 / 0.8  | 46 % | 38 % | 24 % | 26 % | 19 % | 12 % | 13 % |  9 % |  5 % |

Bei vier Templates blieb vorher **nichts** übrig: Drei gesperrte IDs lassen genau einen
Kandidaten zu, aus der Ziehung wird ein deterministischer Reihum-Durchlauf. Zwischen drei
und vier Templates sprang das Verhalten zudem von 76 % auf 100 %, weil bei dreien die
Ausnahme „alles gesperrt, Sperre fällt weg" griff und bei vieren nicht.

**Folge:** Diese Ausnahme entfällt ersatzlos. Kein Gewicht wird null, also bleibt immer
ein Kandidat — der Sonderfall hat kein Gegenstück mehr.

**Die Faktoren sind noch die Startwerte** `0.2 / 0.5 / 0.8` aus dem Arbeitsplan. Die
Parametersuche ist ein eigener Schritt; sie ersetzt die untere Zeile der Tabelle durch die
gefundenen Werte. Wer die Zahlen hier für willkürlich hält: Sie sind es nicht, sie sind
gemessen — und ohne die Messung sähe man nicht, dass der Verlust bei kleinem Pool bleibt.
Der Rest bei drei Templates ist keine Frage der Faktoren, sondern der Content-Tiefe (M2d).

---

## D-25 — Dieselbe Aufgabe kommt nicht zweimal, erkannt am Fragetext
*2026-08-30, M2b*

Zusätzlich zur Abwertung aus D-24 gibt es eine harte Sperre — aber auf der **Instanz**,
nicht auf dem Template: Ein Wurf, dessen `questionText` in dieser `PracticeSession` schon
gestellt wurde, wird verworfen und neu gezogen, höchstens fünfmal
(`lib/selection/next-question.ts`).

**Warum die Instanz und nicht das Template:** Der Sinn des Generators ist, dass ein
Template viele Aufgaben hervorbringt. „5 Personen" und „8 Personen" sind nicht dieselbe
Aufgabe; das Verfahren zu wiederholen ist bestenfalls abwertungswürdig, nicht verboten.
Was wirklich stört, ist die identische Aufgabe.

**Warum `questionText` und nicht `(templateId, params)`:** Prüfung 4 der Content-Pipeline
verbietet Nicht-`const`-Parameter, die im Aufgabentext nicht vorkommen. Gleicher Text
heißt deshalb gleiche gewürfelte Parameter — das folgt aus einer erzwungenen Invariante,
es ist keine Heuristik. Der Text liegt außerdem fertig in der Zeile und braucht keine
kanonische Form für einen JSON-Vergleich.

**Bedingung, die mitgilt:** Führt M2d kosmetische Parameter ein — etwa einen gewürfelten
Namen, der die Aufgabe nicht verändert —, macht ein solcher Parameter zwei mathematisch
identische Aufgaben formal verschieden, und der Schlüssel verliert seine Schärfe. Das ist
dann kein Fehler in der Auswahl, sondern eine Folge der Content-Änderung, und die
Entscheidung ist an dieser Stelle neu zu treffen.

**Grenze:** Ein Template mit ausgeschöpftem Parameterraum liefert nach fünf Würfen eine
Wiederholung. `aufg_00004` (MISSISSIPPI) hat wegen D-13 genau eine Instanz — dort ist das
der Normalfall und kein Fehler. Gemessen sind die Parameterräume aller Templates: 1, 6, 9,
10, 21, 28, 33, 36, 48, 396, 6084, 6960. Bei den kleinen trägt allein `f₁` gegen die
Wiederholung; das ist eine Zielvorgabe für M2d, kein Abnahmekriterium für M2b.

**Abfrage:** Beide Mechanismen brauchen die bisherigen Attempts der Sitzung. Geladen
werden genau zwei Spalten, `templateId` und `questionText` (`lib/db/session-history.ts`).
`expectedAnswer` hat in einem Auswahlpfad nichts verloren — das ist keine
Performance-Frage, sondern die Fortsetzung von Invariante 2 in den Code hinein: Was nie
geladen wird, kann nicht versehentlich hinausgehen. Ein Test hält die Spaltenauswahl fest.
