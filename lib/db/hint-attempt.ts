import { AttemptStatusSchema, type HintResponse, ParamsSchema } from "@/lib/api/contracts";
import { hintCount, renderHint } from "@/lib/engine/instantiate";

import type { AnswerDeps } from "./answer-attempt";
import { currentTemplate } from "./solution";

/**
 * Den nächsten Tipp öffnen (SPEC.md Abschnitt 8) — die Entscheidungen ohne HTTP,
 * nach demselben Muster wie `answer-attempt.ts`.
 *
 * Ein Tipp gibt nichts aus der Lösung preis: Er wird nur aus den Parametern
 * gerendert, und Prüfung 11 lässt kein Template laden, dessen Tipps `result`
 * oder Anzeigewerte nennen. Deshalb darf er an einen offenen Attempt.
 */

export interface HintInput {
  readonly attemptId: string;
  /** Der Nutzer aus `getCurrentUserId()`, nicht aus dem Request-Body. */
  readonly userId: string;
}

export type HintOutcome =
  | { readonly kind: "not_found" }
  | { readonly kind: "forbidden" }
  | { readonly kind: "already_answered" }
  | { readonly kind: "no_more_hints" }
  | { readonly kind: "conflict" }
  | { readonly kind: "hint"; readonly response: HintResponse };

export async function requestHint(deps: AnswerDeps, input: HintInput): Promise<HintOutcome> {
  const attempt = await deps.prisma.attempt.findUnique({
    where: { id: input.attemptId },
    select: {
      id: true,
      userId: true,
      status: true,
      templateId: true,
      templateVersion: true,
      params: true,
      hintsUsed: true,
    },
  });

  if (!attempt) return { kind: "not_found" };
  if (attempt.userId !== input.userId) return { kind: "forbidden" };
  if (AttemptStatusSchema.parse(attempt.status) !== "OPEN") return { kind: "already_answered" };

  // Passt die Template-Version nicht mehr, gibt es keine Tipps: Ein Tipp zu
  // einer anderen Fassung der Aufgabe wäre irreführend.
  const template = currentTemplate(deps.findTemplate, attempt);
  const total = template ? hintCount(template) : 0;
  const index = attempt.hintsUsed;
  if (!template || index >= total) return { kind: "no_more_hints" };

  // Atomar: der alte Zählerstand in der Bedingung. Zwei schnelle Klicks öffnen
  // nicht zweimal denselben Tipp und zählen nicht doppelt.
  const updated = await deps.prisma.attempt.updateMany({
    where: { id: attempt.id, status: "OPEN", hintsUsed: index },
    data: { hintsUsed: index + 1 },
  });
  if (updated.count === 0) return { kind: "conflict" };

  const hint = renderHint(template, ParamsSchema.parse(attempt.params), index);
  if (hint === undefined) return { kind: "no_more_hints" };

  return { kind: "hint", response: { hint, index, total } };
}
