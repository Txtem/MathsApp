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

**Überholt durch D-26.** Die Varianz kam anders: Nicht das Template lernt abzuleiten,
sondern die Compute-Funktion verlangt weniger. Sie bekommt die Gruppengrößen und summiert
`n` selbst, statt es sich danebenschreiben zu lassen.

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

## D-23 — *Nummer nicht vergeben*

Der Nachtrag zu M2b hatte den Dedup-Schlüssel samt seiner Bedingung als `D-23` vorgesehen.
Beim Umsetzen ist er in **D-25** gelandet, und die Nummer blieb leer. Sie wird nicht
nachträglich belegt — eine später vergebene `D-23` würde in älteren Notizen etwas anderes
bedeuten als in neuen.

Wer hier nach dem Vorbehalt zu kosmetischen Parametern sucht: Er steht in D-25.

---

## D-24 — Zuletzt gestellte Templates werden abgewertet, nicht gesperrt
*2026-08-30, M2b*

`SPEC.md` Abschnitt 10 verlangte, die letzten drei `templateId`s dieser Sitzung
auszuschließen. Der Ausschluss ist ersetzt durch einen Rückschlag auf das Gewicht:
`f₁` für den Zug davor, `f₂` für zwei, `f₃` für drei Züge zurück, sonst 1. Gemessen und
gesetzt sind **0.7 / 0.9 / 0.9**.

**Anlass:** Der Ausschluss arbeitete gegen die Schwierigkeitsgewichtung derselben
Abschnitts. Gemessen in `lib/selection/distribution.test.ts`, 20 000 geseedete Ziehungen
je Poolgröße — der Anteil der Gewichtung, der verloren geht:

| Templates im Thema         |    3 |    4 |    5 |    6 |    8 |   10 |   12 |   15 |   20 |
|----------------------------|------|------|------|------|------|------|------|------|------|
| harter Ausschluss (vorher) | 76 % |100 % | 73 % | 61 % | 48 % | 33 % | 28 % | 21 % | 16 % |
| Abwertung 0.7 / 0.9 / 0.9  | 10 % | 11 % |  8 % |  9 % |  5 % |  4 % |  5 % |  3 % |  0 % |

Bei vier Templates blieb vorher **nichts** übrig: Drei gesperrte IDs lassen genau einen
Kandidaten zu, aus der Ziehung wird ein deterministischer Reihum-Durchlauf. Zwischen drei
und vier Templates sprang das Verhalten zudem von 76 % auf 100 %, weil bei dreien die
Ausnahme „alles gesperrt, Sperre fällt weg" griff und bei vieren nicht.

**Folge:** Diese Ausnahme entfällt ersatzlos. Kein Gewicht wird null, also bleibt immer
ein Kandidat — der Sonderfall hat kein Gegenstück mehr.

### Wofür die Faktoren da sind

**Methodenabwechslung** — nicht zweimal hintereinander dasselbe Verfahren, auch wenn die
Zahlen andere sind. Ausdrücklich **nicht**: dieselbe Aufgabe zweimal. Die verhindert die
harte Sperre aus D-25, und wo sie trotzdem auftritt, ist der Parameterraum die Ursache;
kein Faktor hilft dagegen.

Das ist zu betonen, weil „Wdh." in den beiden Tabellen unten Verschiedenes bedeutet: in
der synthetischen *dasselbe Template wie im Zug davor*, in der Content-Tabelle *dieselbe
Aufgabe schon einmal in dieser Sitzung*. Nur die zweite sieht der Übende überhaupt — bei
ausreichendem Parameterraum liefert dasselbe Template zweimal hintereinander zwei
verschiedene Aufgaben. Wer die Faktoren an der ersten Zahl optimiert, im Glauben, gegen
sichtbare Wiederholungen zu arbeiten, zahlt mit der Schwierigkeitssteuerung für nichts.

### Wie die Faktoren gefunden wurden

Rastersuche über 120 Kombinationen mit `f₁ ≤ f₂ ≤ f₃` aus `0.2 … 0.9`, je 20 000
geseedete Ziehungen. Gesucht war der stärkste Abschlag, unter dem der Verlust bei vier bis
acht Templates unter 15 % bleibt. Genau **fünf** Kombinationen erfüllen das, alle im
Bereich 0.7 bis 0.9; die stärkste davon ist `0.7 / 0.9 / 0.9`.

Der Tausch, gemessen bei vier bzw. acht Templates — „Wdh." ist der Anteil der Züge, die
dasselbe Template wie der Zug davor stellen:

| f₁ / f₂ / f₃    | Verlust N=4 | N=8 | Wdh. N=4 | Wdh. N=8 |
|-----------------|-------------|-----|----------|----------|
| 1 / 1 / 1 (keine Abwertung) |  1 % | −1 % | 32 % | 15 % |
| 0.9 / 0.9 / 0.9 |  5 % |  2 % | 30 % | 14 % |
| **0.7 / 0.9 / 0.9** | **11 %** | **5 %** | **26 %** | **11 %** |
| 0.6 / 0.8 / 0.9 | 16 % |  8 % | 23 % | 10 % |
| 0.5 / 0.7 / 0.9 | 20 % | 11 % | 21 % |  9 % |
| 0.2 / 0.5 / 0.8 (Startwerte) | 38 % | 19 % | 11 % |  4 % |

Zwei Dinge, die man der Tabelle ansehen muss:

**Das Messverfahren hat einen Boden.** Ohne jede Abwertung misst dieselbe Sitzung
zwischen −4 % und +2 % — das ist Rauschen bei 20 000 Ziehungen. Die 15-%-Schranke liegt
also rund dreizehn Punkte über null, nicht fünfzehn.

**Die Schranke ist teuer.** Der Tausch ist glatt und ungefähr linear: Je fünf Punkte
Gewichtungsverlust kaufen zwei bis drei Punkte weniger Wiederholung. Wer die Schranke
einhält, bekommt eine milde Abwertung — 32 % auf 26 % bei vier Templates. Wer die
Wiederholung wirklich drücken will, muss die Schranke lockern. Das ist eine Entscheidung
über das Kriterium, keine über den Code, und deshalb steht die Tabelle hier.

### Was das gegen den echten Content bedeutet

Dieselbe Messung mit den echten Templates, 20 Sitzungen à 20 Aufgaben je Thema, mit der
harten Sperre aus D-25 davor. „Wdh." ist hier der Anteil der Aufgaben, die in derselben
Sitzung schon einmal gestellt wurden:

| Thema | Templates | verschiedene Aufgaben von 20 | Wdh. | identisch direkt hintereinander |
|---|---|---|---|---|
| arithmetik.grundrechenarten | 2 | 20,0 | 0 % | 0 % |
| kombinatorik.kombination | 3 | 20,0 | 0 % | 0 % |
| kombinatorik.variation | 2 | 19,1 | 5 % | 0 % |
| kombinatorik.verteilung | 1 | 19,6 | 2 % | 0 % |
| wahrscheinlichkeit.hypergeometrisch | 2 | 20,0 | 0 % | 0 % |
| **kombinatorik.permutation** | 2 | **7,0** | **65 %** | **18 %** |

Fünf von sechs Themen wiederholen praktisch nichts. `kombinatorik.permutation` hat
überhaupt nur sieben verschiedene Aufgaben — sechs aus `aufg_00003` und die eine aus
`aufg_00004` (D-13). Ab der achten Aufgabe **muss** sich dort etwas wiederholen; keine
Wahl der Faktoren ändert das. Das ist die Zielvorgabe für M2d und kein Abnahmekriterium
für M2b.

Reproduzieren: `verlust` und `wiederholungsrate` in `lib/selection/distribution.test.ts`
über `recencyFactors` durchfahren; die Content-Zahlen entstehen aus `readContent()` und
`drawQuestion` mit geseedetem Zufall.

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

---

## D-21 — Die Medianzeit zählt nur richtige Antworten, und sie ist relativ
*2026-08-31, M2b*

Die Statistik-Seite zeigt statt „43 s von 105 s" jetzt „1,3× Zielzeit", gerechnet
ausschließlich über Attempts mit `status = "ANSWERED"` **und** `isCorrect = true`.
Dauern über dem Zehnfachen der Zielzeit gelten als unterbrochen, fließen nicht ein und
werden separat ausgewiesen. Unter fünf richtigen Antworten steht gar keine Zahl.

**Anlass:** Die alte Fassung nahm alle beantworteten Attempts und vermischte damit zwei
verschiedene Größen. Die Zeit dient dem Vergleich mit `target_time_seconds` — „schaffe ich
diesen Aufgabentyp in der vorgesehenen Zeit". Bei einer falschen Antwort misst die Dauer
aber, wie lange jemand gebraucht hat, um sich zu irren. Wer schnell falsch antwortete,
verbesserte seine Medianzeit.

**Warum kein Schalter zum Ein- und Ausblenden:** Er verteidigt gegen einen Gegner, den es
nicht gibt — es gibt genau einen Nutzer, und die Zahl soll ihm nützen. Und er teilt die
Daten in zwei Regime, deren Zustand niemand im Kopf behält. Das Problem lag in der
Definition, also wurde die Definition geändert.

**Warum relativ statt in Sekunden:** Vierzig Sekunden sind bei einer Kopfrechenaufgabe
viel und bei einer hypergeometrischen Verteilung wenig. Ein Median über absolute Zeiten
verschiedener Aufgabentypen vergleicht nichts; er verschiebt sich, sobald sich die
Mischung der geübten Themen ändert.

**Warum eine Obergrenze:** Wer den Tab liegen lässt und am nächsten Tag antwortet,
erzeugt eine Dauer von Stunden. Ein einziger solcher Wert verschiebt den Median einer
kleinen Stichprobe spürbar. Das Zehnfache der Zielzeit ist großzügig genug, dass niemand
versehentlich hineinfällt. Ausgeschlossene Werte werden gezählt und angezeigt, nicht still
verworfen — sonst wundert man sich über eine Zahl, die nicht zu den erinnerten Sitzungen
passt.

**Warum eine Mindestzahl:** Dasselbe Prinzip wie bei der Erfolgsquote (`MIN_ATTEMPTS_FOR_RATE`).
Ein Median aus zwei Werten ist keine Aussage. Die Einschränkung steht in der Beschriftung
und nicht nur im Code: „Medianzeit bei richtigen Antworten".

### Schnellschüsse als eigene Kennzahl

Die Umkehrung des Einwands: Eine sehr schnelle **falsche** Antwort ist nicht wertlos,
sondern ein Signal. Wer in weniger als einem Fünftel der Zielzeit falsch antwortet, hat
geraten oder das Verfahren nicht erkannt — das ist etwas anderes als jemand, der lange
gerechnet und sich verrechnet hat.

Die Statistik-Seite zählt sie deshalb je Thema und zeigt sie ab drei Stück als
„n× geraten". Aus dem Schlupfloch der alten Definition wird damit eine Information.

Die Schwellen — Zehnfaches, ein Fünftel, fünf Antworten, drei Schnellschüsse — sind
gesetzt und nicht gemessen. Anders als bei D-24 gibt es hier nichts zu optimieren: Es
gibt keine Zielgröße, gegen die man sie prüfen könnte, nur Plausibilität. Sie stehen als
benannte Konstanten in `components/stats-rows.ts`, damit sie sich ändern lassen, ohne den
Code zu lesen.

---

## D-26 — Die Zerlegung wird abgeleitet, nicht abgeschrieben
*2026-08-31, M2d*

`kombinatorik.permutation.wort` nimmt ein Wort entgegen und zählt die
Buchstabenhäufigkeiten selbst. `aufg_00004` und `aufg_00013` würfeln nur noch das Wort.

**Der äußere Anlass** war die Kopplung: Ein `choice`-Parameter liefert einen Skalar, und
`constraints` kennen nur Zahlen — „die Häufigkeiten in MISSISSIPPI sind 4, 4, 2, 1" lässt
sich im Template-Format nicht ausdrücken. Wort und Gruppengrößen als getrennte Parameter
wären in fast jedem Wurf inkonsistent gewesen, und nichts hätte das bemerkt.

**Der eigentliche Gewinn ist ein anderer, und er ist übertragbar.** Solange die Zerlegung
von Hand danebengeschrieben wird, gibt es eine Naht zwischen zwei Quellen: die Wortlänge
aus dem Wort, die Gruppen aus der Handzählung. An genau dieser Naht entstand D-15 — im
Template standen 5/4/2 für MISSISSIPPI, die Summe stimmte, die Zerlegung nicht.

Beim Aufbau der Wortliste ist derselbe Fehler prompt wieder passiert: Für ERDBEERE hatte
ich E3 R2 D1 B1 notiert und 3360 erwartet. Das sind sieben Buchstaben, das Wort hat acht —
die Zerlegung widersprach sich selbst, und die 3360 entstand, weil `n` aus der Wortlänge
und die Gruppen aus der Handzählung kamen. Richtig ist E4 R2 D1 B1 und damit 840.
Aufgefallen ist es nur, weil die Erwartungswerte vor dem Template unabhängig nachgerechnet
wurden.

**Die Regel, die daraus folgt:** Wo eine Compute-Funktion eine Zerlegung braucht, bekommt
sie das Ganze und zerlegt selbst — nicht die Teile, die jemand daneben aufgeschrieben hat.
Dann gibt es keine zweite Quelle, die widersprechen könnte. Das gilt beim nächsten Template
genauso: Beim Kugel-Template werden die Gruppengrößen gewürfelt und `n` **nicht** als
Parameter geführt, sondern von der Funktion summiert.

**Nebenwirkung:** Die Grenze von zwei bis vier Gruppen aus D-15 fällt weg. Sie stammt aus
der Signatur von `multisetPermutations`, das die Gruppen einzeln entgegennimmt, nicht aus
der Mathematik. Eine Funktion, die selbst zählt, ist unbeschränkt — die Wortliste enthält
deshalb auch KAROTTE und SCHIFFE mit sechs verschiedenen Buchstaben.

**Preis:** Der Lösungsweg kann die konkreten Fakultäten nicht mehr zeigen, weil die
Häufigkeiten keine Parameter sind und `solution_text` nur Parameter und `result` kennt.
Er nennt die Regel statt der Zahlen. Das ist der bewusste Tausch: ein etwas blasserer
Lösungsweg gegen eine Aufgabe, die nicht falsch sein kann.

**Damit erledigt sich D-13.** Dessen Prämisse — „das Template-Format kennt keine
abgeleiteten Parameter, also muss `n` als `const` daneben stehen" — trifft zu, führt aber
zur falschen Antwort. Nicht das Template muss ableiten können, sondern die Funktion muss
weniger verlangen.

---

## D-27 — Ein einparametriges Template weitet seinen Bereich, statt einen zweiten Parameter zu bekommen
*2026-09-06, M2d*

`aufg_00003` („Auf wie viele Arten können n Personen in einer Reihe angeordnet werden?")
hat seinen Bereich von `n = 4…9` auf `n = 3…24` geweitet, um über die Schwelle von 20
Parameterkombinationen zu kommen. `SPEC-M2d.md` C-2 hätte stattdessen einen zweiten
Parameter vorgesehen.

**Grund:** Eine reine Fakultät hat genau einen Freiheitsgrad. Jeder zweite Parameter wäre
eines von beidem gewesen:

- **kosmetisch** — Personen statt Bücher statt Autos. Das ändert die Rechnung nicht, macht
  aber zwei mathematisch identische Aufgaben formal verschieden und entwertet damit
  `questionText` als Dedup-Schlüssel. Genau der Fall, den D-25 als Bedingung mitschreibt.
- **eine andere Aufgabe** — „k aus n auswählen und anordnen" ist `variation.ohne_wdh` und
  gehört in ein anderes Thema.

Es gab also nichts zu wählen. Die Abwägung ist hier festgehalten, weil sie beim nächsten
einparametrigen Template wiederkommt: `teilmengen.anzahl` (2ⁿ) und
`permutation.zyklisch` ((n−1)!) sind vom selben Zuschnitt.

### Was das für die Ergebnisgrenzen bedeutet

Bei `n = 24` ist die Antwort 23-stellig. Das trägt die Engine — gerechnet wird mit
`BigInt` —, und der Formathinweis unter dem Eingabefeld nennt ausdrücklich `5!` als
zulässige Eingabe. Die Aufgabe fragt nach dem Erkennen der Regel, nicht nach dem
Ausschreiben der Ziffern.

Daraus folgt eine Trennung, die sich durch `kombinatorik.permutation` zieht und sonst wie
ein Fehler aussähe:

| Antwortform | Beispiele | Ergebnisgrenze |
|---|---|---|
| **symbolisch** — ein einziger Ausdruck genügt | `aufg_00003` (`n!`), `aufg_00015` (`(n−1)!`) | praktisch keine |
| **ausgerechnet** — die Zerlegung ist der Punkt | `aufg_00013`, `aufg_00014`, `aufg_00004` | 60 bzw. 100 000 |

Ein Deckel auf `10²⁴` neben einem auf `60` im selben Thema ist also kein Versehen. Wo die
Antwort ein Ausdruck sein darf, kostet ein großes `n` nichts; wo der Übende die Fakultäten
tatsächlich gegeneinander kürzen soll, bleibt das Ergebnis in einer Größenordnung, die man
noch hinschreiben mag.

**Angeglichen wurde trotzdem eines:** `aufg_00004` (Schwierigkeit 3) stand auf `50000` und
damit strenger als `aufg_00014` (Schwierigkeit 2) auf `100000`. Beide liegen jetzt bei
`100000` — eine schwerere Aufgabe soll nicht die kleineren Zahlen haben.

---

## D-28 — Was M2d am Content geändert hat, gemessen
*2026-09-06, M2d*

Die Zahlen, gegen die M2d geplant wurde, und die Zahlen danach. Gemessen mit derselben
Simulation wie in D-24: zwanzig Sitzungen à zwanzig Aufgaben je Thema, geseedet, über
`drawQuestion` und damit inklusive der Sperre aus D-25.

| Thema | Templates vorher → nachher | verschieden von 20, vorher | nachher |
|---|---|---|---|
| arithmetik.grundrechenarten | 2 → 2 | 20,0 | 20,0 |
| kombinatorik.kombination | 3 → 3 | 20,0 | 20,0 |
| kombinatorik.variation | 2 → 2 | 19,1 | 20,0 |
| kombinatorik.verteilung | 1 → 1 | 19,6 | 19,5 |
| wahrscheinlichkeit.hypergeometrisch | 2 → 2 | 20,0 | 20,0 |
| **kombinatorik.permutation** | **2 → 5** | **7,0** | **20,0** |

Abnahmekriterium B-1 (mindestens 18 von 20) ist überall erfüllt; das schwächste Thema ist
`kombinatorik.verteilung` mit 19,5 aus einem einzigen Template.

Die Parameterräume, aus denen das folgt — B-2 verlangt mindestens 20 je Template, und
`npm run content:check` warnt seit M2d bei keinem mehr:

| Template | vorher | nachher | wodurch |
|---|---|---|---|
| `aufg_00004` (Wörter, lang) | 1 | 27 | Wortliste statt fester Gruppen (D-26) |
| `aufg_00003` (n Personen in einer Reihe) | 6 | 22 | Bereich geweitet (D-27) |
| `aufg_00006` (Zahlenschloss) | 9 | 28 | beide Bereiche durchgehend |
| `aufg_00009` (Teilmengen) | 10 | 23 | Bereich geweitet |
| `aufg_00013` (Wörter, kurz) | — | 37 | neu |
| `aufg_00014` (Kugeln) | — | 93 | neu, Schwierigkeit 2 |
| `aufg_00015` (runder Tisch) | — | 21 | neu, Schwierigkeit 4 |

`kombinatorik.permutation` deckt damit die Schwierigkeiten 1 bis 4 ab (B-3).

**Was die Zahlen nicht sagen:** `kombinatorik.verteilung` liegt mit 19,5 knapp unter dem
Rest, weil es aus einem einzigen Template besteht. Das ist der Fall „ein Thema, ein
Template", für den `content/templates/_README.md` rund 25 Parameterraum verlangt — 33 sind
vorhanden, das Kriterium ist erfüllt. Ein zweites Template dort wäre die nächste
naheliegende Content-Arbeit, aber keine Reparatur.

Reproduzieren: `readContent()` plus `drawQuestion` mit geseedetem Zufall über alle Themen;
die Parameterräume gibt `npm run content:check` aus.

