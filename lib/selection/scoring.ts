/**
 * Die Bewertung, nach der die nächste Aufgabe ausgesucht wird
 * (SPEC.md Abschnitt 10).
 *
 * Alles hier ist rein: Eingabe sind Statistiken und Kandidaten, nie die
 * Datenbank. Die dünne DB-Schicht steht in `lib/db/topic-stats.ts`. Dieselbe
 * Trennung wie bei `components/topic-groups.ts` und aus demselben Grund — die
 * beiden bisher gefundenen Anzeigefehler lagen in ungetesteter Logik (D-16).
 */

/** So viele beantwortete Versuche gehen in die gleitende Erfolgsquote ein. */
export const RECENT_WINDOW = 10;

/** Darunter gilt ein Thema als unerprobt. */
export const MIN_ATTEMPTS_FOR_RATE = 3;

/**
 * Erfolgsquote eines unerprobten Themas. Bewusst die Mitte: weder Bevorzugung
 * noch Meidung, solange nichts über den Übenden bekannt ist.
 */
export const UNTESTED_RATE = 0.5;

/** Der Stand eines Themas, wie ihn die DB-Schicht liefert. */
export interface TopicStats {
  readonly topic: string;
  /** Richtige unter den letzten `RECENT_WINDOW` beantworteten Versuchen. */
  readonly recentCorrect: number;
  /** Anzahl dieser Versuche, höchstens `RECENT_WINDOW`. */
  readonly recentAnswered: number;
  /** `null` heißt: kein `TopicMastery`-Eintrag, also fällig. */
  readonly dueAt: Date | null;
  /** `null` heißt: noch nie gestellt. */
  readonly lastSeenAt: Date | null;
}

/**
 * Gleitende Erfolgsquote. Wenige Versuche tragen keine Aussage: Wer eine von
 * einer Aufgabe richtig hat, ist deshalb nicht zu 100 % sicher — und wer eine
 * verfehlt hat, nicht hoffnungslos.
 */
export function successRate(stats: TopicStats): number {
  if (stats.recentAnswered < MIN_ATTEMPTS_FOR_RATE) return UNTESTED_RATE;
  return stats.recentCorrect / stats.recentAnswered;
}

/** Fällig ist, was dran ist — und alles, was noch nie geübt wurde. */
export function isDue(stats: TopicStats, now: Date): boolean {
  return stats.dueAt === null || stats.dueAt.getTime() <= now.getTime();
}

/**
 * `(1 - erfolgsquote) * 2 + faelligkeitsbonus`.
 *
 * Die Schwäche wiegt doppelt so schwer wie die Fälligkeit: Ein Thema, das man
 * nicht kann, soll auch dann drankommen, wenn ein anderes gerade fällig wäre.
 */
export function topicScore(stats: TopicStats, now: Date): number {
  return (1 - successRate(stats)) * 2 + (isDue(stats, now) ? 1 : 0);
}

/**
 * Das Thema mit dem höchsten Score. Bei Gleichstand gewinnt das länger nicht
 * gestellte; ein nie gestelltes Thema gilt dabei als das älteste.
 */
export function chooseTopic(
  candidates: readonly TopicStats[],
  now: Date,
): TopicStats | undefined {
  let best: TopicStats | undefined;
  let bestScore = -Infinity;

  for (const candidate of candidates) {
    const score = topicScore(candidate, now);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
      continue;
    }
    if (score === bestScore && best !== undefined && isOlder(candidate, best)) {
      best = candidate;
    }
  }

  return best;
}

/** Nie gestellt schlägt jedes Datum; sonst entscheidet der frühere Zeitpunkt. */
function isOlder(candidate: TopicStats, current: TopicStats): boolean {
  if (candidate.lastSeenAt === null) return current.lastSeenAt !== null;
  if (current.lastSeenAt === null) return false;
  return candidate.lastSeenAt.getTime() < current.lastSeenAt.getTime();
}

/**
 * Zielschwierigkeit aus der Erfolgsquote (SPEC.md Abschnitt 10).
 *
 * Die Tabelle in der SPEC nennt die Grenzen doppelt (`0.4 – 0.7` und
 * `0.7 – 0.9`). Festgelegt ist: Die untere Grenze gehört jeweils zur höheren
 * Stufe, `0.7` ergibt also 3. Nur `> 0.9` erreicht die 4 — genau 0.9 nicht.
 */
export function targetDifficulty(rate: number): number {
  if (rate < 0.4) return 1;
  if (rate < 0.7) return 2;
  if (rate <= 0.9) return 3;
  return 4;
}

/**
 * `1 / (1 + |difficulty - ziel|)`.
 *
 * Ein Thema ohne Template auf der Zielschwierigkeit fällt damit von selbst auf
 * die nächstliegende zurück — kein Sonderfall im Code. Das Gewicht ist nie
 * null, eine passende Aufgabe wird also nie ganz ausgeschlossen.
 */
export function templateWeight(difficulty: number, target: number): number {
  return 1 / (1 + Math.abs(difficulty - target));
}

/**
 * Rückschlag auf das Gewicht eines Templates, das in dieser Sitzung gerade
 * erst dran war — `f₁` für den Zug davor, `f₂` für zwei, `f₃` für drei.
 *
 * Vorher war das ein harter Ausschluss der letzten drei `templateId`s. Gemessen
 * hat der die Schwierigkeitsgewichtung überlagert: bei vier Templates im Thema
 * vollständig, weil dann genau ein Kandidat übrig blieb und aus der Ziehung ein
 * Reihum-Durchlauf wurde. Ein Abschlag lässt beide Eigenschaften nebeneinander
 * bestehen — und weil kein Gewicht null wird, entfällt auch der Sonderfall
 * „alles gesperrt, Sperre fällt weg". Siehe D-24.
 *
 * Die Zahlen sind gemessen, nicht geschätzt: Eine Rastersuche über 120
 * Kombinationen hat sie bestimmt, die Tabelle steht in `DECISIONS.md` D-24.
 * Es sind die **stärksten** Abschläge, unter denen der Gewichtungsverlust bei
 * vier bis acht Templates unter 15 % bleibt. Wer sie schärfer stellt, senkt die
 * Wiederholungen und verliert Gewichtung — der Tausch ist gemessen und steht
 * dort als Tabelle, damit ihn niemand blind verstellt.
 */
export const RECENCY_FACTORS: readonly number[] = [0.7, 0.9, 0.9];

/**
 * `recentTemplateIds` ist die Liste der zuletzt gestellten Templates, jüngste
 * zuerst. Doppelte Einträge sind erlaubt; es zählt die jüngste Verwendung.
 */
export function recencyFactor(
  templateId: string,
  recentTemplateIds: readonly string[],
  factors: readonly number[] = RECENCY_FACTORS,
): number {
  const zuege = recentTemplateIds.indexOf(templateId);
  if (zuege === -1 || zuege >= factors.length) return 1;
  return factors[zuege];
}

/** So viel muss die Auswahl von einem Kandidaten wissen, um ihn zu gewichten. */
export interface WeightableTemplate {
  readonly id: string;
  readonly difficulty: number;
}

/**
 * Das Gewicht jedes Kandidaten: Schwierigkeit mal Rückschlag für kürzlich
 * Gestelltes. Die ganze Gewichtung an einer Stelle, damit es keine zweite gibt.
 *
 * `factors` hat einen Modul-Default und ist **kein** Feld von `SelectionInput`.
 * Der Grund ist derselbe wie bei D-12 und D-19, nur andersherum: Dort wurde eine
 * Abhängigkeit zum Parameter gemacht, um sie testbar zu machen. Hier ist ein
 * Testbedarf beinahe in einen Anwendungstyp gewandert — und `SelectionInput`
 * wird aus Anfragedaten gebaut. Ein Feld, das nur ein Test setzen soll, wird
 * irgendwann von woanders gesetzt. Die Parametersuche in `distribution.test.ts`
 * ruft deshalb diese Funktion direkt, statt über die Auswahl zu greifen.
 *
 * Kein Gewicht wird null: Es bleibt immer ein Kandidat übrig, und deshalb gibt
 * es keinen Sonderfall „alles gesperrt" mehr (D-24).
 */
export function candidateWeights(
  candidates: readonly WeightableTemplate[],
  target: number,
  recentTemplateIds: readonly string[],
  factors: readonly number[] = RECENCY_FACTORS,
): number[] {
  return candidates.map(
    (candidate) =>
      templateWeight(candidate.difficulty, target) *
      recencyFactor(candidate.id, recentTemplateIds, factors),
  );
}
