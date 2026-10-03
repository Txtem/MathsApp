import { classifyOutcome, type Outcome, type SuccessFields } from "@/lib/selection/outcome";

/**
 * Das Kreisdiagramm der vier Ausgänge auf der Statistik-Seite (SPEC.md Abschnitt 10a): Aufgegeben, Falsch, Richtig (1. Versuch), Richtig (2. Versuch).
 * Die Tipps stehen daneben, je Ausgang — sie sind eine zweite Dimension, keine
 * fünfte Kategorie.
 *
 * Rein und getestet (D-16). Die Einordnung kommt aus `classifyOutcome`, nicht
 * aus einem Nachbau: Dort und nur dort wird entschieden, was ein Ausgang ist.
 * Gezeichnet wird von Hand als SVG, ohne Diagrammbibliothek; die Geometrie
 * steht in `pieSegments`.
 */

/** Reihenfolge im Diagramm und in der Legende: die beiden Grüntöne nebeneinander. */
export const OUTCOME_ORDER: readonly Outcome[] = ["right_first", "right_second", "wrong", "gave_up"];

export const OUTCOME_LABEL: Readonly<Record<Outcome, string>> = {
  right_first: "Richtig (1. Versuch)",
  right_second: "Richtig (2. Versuch)",
  wrong: "Falsch",
  gave_up: "Aufgegeben",
};

export interface OutcomeSlice {
  readonly outcome: Outcome;
  readonly label: string;
  readonly count: number;
  /** Anteil an allen Ausgängen, 0 bis 1. */
  readonly share: number;
  /** Wie viele dieser Aufgaben mit mindestens einem Tipp gelöst wurden. */
  readonly withHints: number;
  /** Geöffnete Tipps insgesamt. */
  readonly hintsUsed: number;
}

/** Alle vier Ausgänge, auch die mit null Aufgaben. Offene und verworfene fehlen. */
export function summarizeOutcomes(attempts: readonly SuccessFields[]): readonly OutcomeSlice[] {
  const tally = new Map<Outcome, { count: number; withHints: number; hintsUsed: number }>(
    OUTCOME_ORDER.map((outcome) => [outcome, { count: 0, withHints: 0, hintsUsed: 0 }]),
  );

  for (const attempt of attempts) {
    const outcome = classifyOutcome(attempt);
    if (outcome === null) continue;
    const entry = tally.get(outcome);
    if (!entry) continue;
    entry.count++;
    entry.hintsUsed += attempt.hintsUsed;
    if (attempt.hintsUsed > 0) entry.withHints++;
  }

  const total = [...tally.values()].reduce((sum, entry) => sum + entry.count, 0);

  return OUTCOME_ORDER.map((outcome) => {
    const entry = tally.get(outcome) ?? { count: 0, withHints: 0, hintsUsed: 0 };
    return {
      outcome,
      label: OUTCOME_LABEL[outcome],
      ...entry,
      share: total === 0 ? 0 : entry.count / total,
    };
  });
}

export interface PieSegment {
  readonly key: string;
  /** SVG-Pfad (`<path d=…>`) des Segments. */
  readonly d: string;
  readonly startAngle: number;
  readonly endAngle: number;
}

/**
 * Kreissegmente für die gegebenen Werte, im Uhrzeigersinn ab zwölf Uhr.
 * Werte von null bekommen kein Segment. Ein einziger Wert füllt den ganzen
 * Kreis — als zwei Halbbögen, weil ein SVG-Bogen mit gleichem Start- und
 * Endpunkt nichts zeichnet.
 *
 * Koordinaten auf drei Nachkommastellen gerundet: genug für jede Bildschirm-
 * auflösung, und der Pfad bleibt in Tests lesbar.
 */
export function pieSegments(
  values: readonly { readonly key: string; readonly value: number }[],
  radius: number,
  center: number = radius,
): readonly PieSegment[] {
  const visible = values.filter((entry) => entry.value > 0);
  const total = visible.reduce((sum, entry) => sum + entry.value, 0);
  if (total === 0) return [];

  const point = (angle: number) =>
    `${round(center + radius * Math.sin(angle))} ${round(center - radius * Math.cos(angle))}`;

  if (visible.length === 1) {
    const only = visible[0];
    if (!only) return [];
    const d =
      `M ${point(0)} A ${radius} ${radius} 0 1 1 ${point(Math.PI)} ` +
      `A ${radius} ${radius} 0 1 1 ${point(0)} Z`;
    return [{ key: only.key, d, startAngle: 0, endAngle: 2 * Math.PI }];
  }

  let start = 0;
  return visible.map((entry) => {
    const sweep = (entry.value / total) * 2 * Math.PI;
    const end = start + sweep;
    const largeArc = sweep > Math.PI ? 1 : 0;
    const d =
      `M ${center} ${center} L ${point(start)} ` +
      `A ${radius} ${radius} 0 ${largeArc} 1 ${point(end)} Z`;
    const segment = { key: entry.key, d, startAngle: start, endAngle: end };
    start = end;
    return segment;
  });
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
