import {
  type AnswerResponse,
  AnswerTypeSchema,
  AttemptStatusSchema,
  ExpectedAnswerSchema,
  ParamsSchema,
} from "@/lib/api/contracts";
import type { ValidatedTemplate } from "@/lib/content/schema";
import { grade } from "@/lib/engine/grade";
import { renderSolution } from "@/lib/engine/instantiate";
import type { PrismaClient } from "@/lib/generated/prisma/client";

import { closeAttempt } from "./attempts";

/**
 * Was beim Beantworten einer Aufgabe passiert — die ganze Entscheidungskette,
 * ohne HTTP.
 *
 * Diese Funktion trägt Invariante 2: `expectedAnswer` verlässt den Server
 * nicht, solange der Attempt `OPEN` ist. Sie stand bis M2a ungetestet in der
 * Route, weil sich die Route nicht importieren lässt — `server-only` und der
 * Prisma-Singleton aus `process.env` stehen im Weg. Deshalb bekommt sie ihre
 * Umgebung jetzt als Parameter, nach demselben Muster wie `lib/content/read.ts`
 * (D-12) und `lib/db/attempts.ts` (D-19). Die Route ist nur noch der Adapter,
 * der `AnswerOutcome` auf Statuscodes abbildet.
 */

export interface AnswerDeps {
  readonly prisma: PrismaClient;
  /** In der Route `getTemplate` aus `lib/content/load` — hier hereingereicht,
   *  damit `lib/db` nicht auf `server-only`-Content angewiesen ist. */
  readonly findTemplate: (id: string) => ValidatedTemplate | undefined;
}

export interface AnswerInput {
  readonly attemptId: string;
  /** Der Nutzer aus `getCurrentUserId()`, nicht aus dem Request-Body. */
  readonly userId: string;
  readonly answer: string;
  readonly durationMs: number;
  readonly now?: Date;
}

export type AnswerOutcome =
  | { readonly kind: "not_found" }
  | { readonly kind: "forbidden" }
  | { readonly kind: "already_answered" }
  | { readonly kind: "answered"; readonly response: AnswerResponse };

/**
 * Die Antwort auf eine unlesbare Eingabe. Steht als Konstante hier, damit
 * sichtbar bleibt, was sie **nicht** enthält: weder `expectedAnswer` noch
 * `solutionText`. Der Attempt bleibt offen (D-04).
 */
const UNPARSEABLE: AnswerResponse = { isCorrect: false, parseError: "unparseable" };

export async function answerAttempt(
  deps: AnswerDeps,
  input: AnswerInput,
): Promise<AnswerOutcome> {
  const attempt = await deps.prisma.attempt.findUnique({
    where: { id: input.attemptId },
    select: {
      id: true,
      status: true,
      answerType: true,
      expectedAnswer: true,
      params: true,
      templateId: true,
      templateVersion: true,
      userId: true,
    },
  });

  if (!attempt) return { kind: "not_found" };
  if (attempt.userId !== input.userId) return { kind: "forbidden" };
  if (AttemptStatusSchema.parse(attempt.status) !== "OPEN") return { kind: "already_answered" };

  // Zod auch an der Datenbankgrenze: status und answerType sind in SQLite
  // gewöhnliche Strings, expectedAnswer ist eine Json-Spalte.
  const answerType = AnswerTypeSchema.parse(attempt.answerType);
  const expectedAnswer = ExpectedAnswerSchema.parse(attempt.expectedAnswer);

  // Das Template wird einmal geholt: Es liefert `round_to` für die Bewertung
  // und den Lösungstext. Passt die Version nicht mehr, gilt es als nicht
  // vorhanden — dann wird exakt bewertet und kein Lösungsweg gezeigt.
  const template = deps.findTemplate(attempt.templateId);
  const current = template?.version === attempt.templateVersion ? template : undefined;

  const verdict = grade(input.answer, expectedAnswer, answerType, {
    roundTo: current?.round_to,
  });

  // Vor dem Schließen: Eine unlesbare Eingabe gibt nichts preis und lässt die
  // Aufgabe offen. Hier darf kein Feld aus `attempt` in die Antwort.
  if (!verdict.ok) return { kind: "answered", response: UNPARSEABLE };

  // Atomar: Nur wer den Attempt von OPEN auf ANSWERED dreht, darf antworten,
  // und nur derselbe Aufruf schreibt den Themenfortschritt fort. Zwei
  // gleichzeitige Absenden können so weder beide bewertet werden noch doppelt
  // zählen.
  const closed = await closeAttempt(deps.prisma, {
    attemptId: attempt.id,
    userAnswer: input.answer,
    isCorrect: verdict.isCorrect,
    durationMs: input.durationMs,
    now: input.now,
  });

  if (!closed) return { kind: "already_answered" };

  return {
    kind: "answered",
    response: {
      isCorrect: verdict.isCorrect,
      expectedAnswer,
      ...buildSolution(current, attempt.params, expectedAnswer),
    },
  };
}

/**
 * Der Lösungstext wird aus den persistierten Parametern neu gerendert. Wurde das
 * Template seit dem Stellen der Aufgabe geändert, bleibt er weg — ein Text zu
 * einer anderen Version wäre schlechter als gar keiner.
 */
function buildSolution(
  template: ValidatedTemplate | undefined,
  params: unknown,
  expectedAnswer: string,
): { solutionText?: string } {
  if (!template) return {};

  const parsedParams = ParamsSchema.safeParse(params);
  if (!parsedParams.success) return {};

  const solutionText = renderSolution(template, parsedParams.data, expectedAnswer);
  return solutionText === undefined ? {} : { solutionText };
}
