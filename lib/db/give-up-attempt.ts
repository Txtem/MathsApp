import {
  AttemptStatusSchema,
  ExpectedAnswerSchema,
  type GiveUpResponse,
} from "@/lib/api/contracts";
import { hintCount } from "@/lib/engine/instantiate";

import type { AnswerDeps } from "./answer-attempt";
import { giveUp } from "./attempts";
import { buildSolution, currentTemplate, roundedForm } from "./solution";

/**
 * Aufgeben (SPEC.md Abschnitt 8) — die Entscheidungen ohne HTTP.
 *
 * „Lösung zeigen" erscheint erst, wenn alle Tipps offen sind. Diese Regel setzt
 * **der Server** durch, nicht die Oberfläche: `giveUp` schließt nur, wenn
 * `hintsUsed` die Zahl der Tipps erreicht hat. Erst danach verlässt die Lösung
 * den Server.
 */

export interface GiveUpAttemptInput {
  readonly attemptId: string;
  /** Der Nutzer aus `getCurrentUserId()`, nicht aus dem Request-Body. */
  readonly userId: string;
  /** Die Uhr der Anfrage. Pflicht, nicht optional — siehe D-20. */
  readonly now: Date;
}

export type GiveUpOutcome =
  | { readonly kind: "not_found" }
  | { readonly kind: "forbidden" }
  | { readonly kind: "already_answered" }
  | { readonly kind: "hints_remaining" }
  | { readonly kind: "given_up"; readonly response: GiveUpResponse };

export async function giveUpAttempt(
  deps: AnswerDeps,
  input: GiveUpAttemptInput,
): Promise<GiveUpOutcome> {
  const attempt = await deps.prisma.attempt.findUnique({
    where: { id: input.attemptId },
    select: {
      id: true,
      userId: true,
      status: true,
      templateId: true,
      templateVersion: true,
      params: true,
      expectedAnswer: true,
    },
  });

  if (!attempt) return { kind: "not_found" };
  if (attempt.userId !== input.userId) return { kind: "forbidden" };
  if (AttemptStatusSchema.parse(attempt.status) !== "OPEN") return { kind: "already_answered" };

  // Ohne passendes Template gibt es keine Tipps (D-2), also ist „alle Tipps
  // geöffnet" sofort erfüllt — wie bei einem Template ohne Tipps.
  const template = currentTemplate(deps.findTemplate, attempt);
  const requiredHints = template ? hintCount(template) : 0;

  const closed = await giveUp(deps.prisma, {
    attemptId: attempt.id,
    requiredHints,
    now: input.now,
  });

  if (!closed) {
    // Nicht geschlossen: Entweder war jemand schneller, oder es fehlen Tipps.
    // Frisch lesen, statt aus dem alten Stand zu raten. Hier darf nichts aus
    // der Lösung in die Antwort — der Attempt kann noch offen sein.
    const fresh = await deps.prisma.attempt.findUnique({
      where: { id: attempt.id },
      select: { status: true },
    });
    return fresh?.status === "OPEN" ? { kind: "hints_remaining" } : { kind: "already_answered" };
  }

  const expectedAnswer = ExpectedAnswerSchema.parse(attempt.expectedAnswer);
  return {
    kind: "given_up",
    response: {
      expectedAnswer,
      ...roundedForm(template, expectedAnswer),
      ...buildSolution(template, attempt.params, expectedAnswer),
    },
  };
}
