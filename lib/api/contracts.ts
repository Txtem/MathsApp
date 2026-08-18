import { z } from "zod";

import type { AnswerType, Template } from "@/lib/engine/types";

/**
 * Request- und Response-Verträge der API (SPEC.md Abschnitt 8).
 *
 * Bewusst frei von Prisma und `server-only`: Damit bleibt der wichtigste Vertrag
 * des Systems — dass `expectedAnswer` eine offene Aufgabe nicht verlässt — ohne
 * Datenbank testbar.
 */

export const AnswerTypeSchema = z.enum([
  "numeric",
  "integer",
  "fraction",
  "set",
  "tuple",
  "text",
  "choice",
]);

/** SQLite kennt keine Enums; `Attempt.status` ist ein String und wird hier erzwungen. */
export const AttemptStatusSchema = z.enum(["OPEN", "ANSWERED", "SKIPPED"]);
export type AttemptStatus = z.infer<typeof AttemptStatusSchema>;

/** Ergebnisse der Compute-Registry sind Dezimalstrings, nie `number`. */
export const ExpectedAnswerSchema = z.string().min(1);

export const CreateSessionRequestSchema = z.object({
  topicFilter: z.string().min(1).max(120).optional(),
});

export const AnswerRequestSchema = z.object({
  answer: z.string().min(1).max(200),
  durationMs: z.number().int().nonnegative().max(86_400_000),
});

export interface CreateSessionResponse {
  readonly sessionId: string;
}

export interface NextQuestionResponse {
  readonly attemptId: string;
  readonly questionText: string;
  readonly answerType: AnswerType;
  readonly targetTimeSeconds: number;
  readonly topic: string;
  readonly difficulty: number;
}

export type AnswerResponse =
  | {
      readonly isCorrect: false;
      readonly parseError: "unparseable";
    }
  | {
      readonly isCorrect: boolean;
      readonly expectedAnswer: string;
      readonly solutionText?: string;
    };

/**
 * Baut die Antwort auf `/next`. Die Felder werden **einzeln** aus Attempt und
 * Template genommen, nie per Spread: So kann kein neues Spaltenfeld — und schon
 * gar nicht `expectedAnswer` — versehentlich in die Response rutschen.
 */
export function toNextQuestionResponse(
  attempt: { readonly id: string; readonly questionText: string; readonly answerType: AnswerType },
  template: Pick<Template, "topic" | "difficulty" | "target_time_seconds">,
): NextQuestionResponse {
  return {
    attemptId: attempt.id,
    questionText: attempt.questionText,
    answerType: attempt.answerType,
    targetTimeSeconds: template.target_time_seconds,
    topic: template.topic,
    difficulty: template.difficulty,
  };
}

/** `Attempt.params` ist eine Json-Spalte — beim Lesen validiert, nicht geglaubt. */
export const ParamsSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean()]),
);

/**
 * Response-Schemas für die Gegenseite: Die Practice-Seite validiert damit, was
 * ihr der Server schickt. Zod an jeder Grenze gilt in beide Richtungen.
 *
 * Bewusst `strictObject`: Ein unbekanntes Feld in der Response ist kein Detail,
 * das man wegwerfen darf — bei `/next` wäre genau das der Lösungs-Leak. Der
 * Client soll dann laut scheitern, statt es stillschweigend zu schlucken.
 */
export const NextQuestionResponseSchema = z.strictObject({
  attemptId: z.string().min(1),
  questionText: z.string().min(1),
  answerType: AnswerTypeSchema,
  targetTimeSeconds: z.number().int().positive(),
  topic: z.string().min(1),
  difficulty: z.number().int().min(1).max(5),
});

export const AnswerResponseSchema = z.union([
  z.strictObject({
    isCorrect: z.literal(false),
    parseError: z.literal("unparseable"),
  }),
  z.strictObject({
    isCorrect: z.boolean(),
    expectedAnswer: z.string().min(1),
    solutionText: z.string().optional(),
  }),
]);

export const CreateSessionResponseSchema = z.strictObject({ sessionId: z.string().min(1) });
