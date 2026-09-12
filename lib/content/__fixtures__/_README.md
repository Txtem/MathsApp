# Negativ-Fixtures

Für jede statische Prüfung aus `checks.ts` ein Template, das genau daran
scheitert. Sie sind die Gegenprobe: Eine Prüfung, die nie anschlägt, ist keine
Prüfung — und ein Test der reinen Prüffunktion belegt nicht, dass der Loader sie
überhaupt aufruft.

Meist scheitert ein Fixture **nur** an seiner einen Prüfung, und der Test kann auf
Gleichheit prüfen. Wo das nicht geht, weil sich der Fall ohne einen zweiten Befund
nicht bauen lässt, prüft der Test auf Enthaltensein — so bei
`12-display-key-collision.yaml`, dessen überzähliger Parameter zwangsläufig auch
Prüfung 5 auslöst. Der Grund gehört dann in den Kopf der Fixture-Datei.

Diese Dateien liegen bewusst nicht unter `content/`, damit `npm run content:check`
sie nicht einliest.
