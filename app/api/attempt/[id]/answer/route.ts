import { NextResponse } from "next/server";

import {
  AnswerRequestSchema,
  type AnswerResponse,
  AnswerTypeSchema,
  AttemptStatusSchema,
  ExpectedAnswerSchema,
  ParamsSchema,
} from "@/lib/api/contracts";
import { apiError } from "@/lib/api/responses";
import { getTemplate } from "@/lib/content/load";
import { prisma } from "@/lib/db/client";
import { DEV_USER_ID } from "@/lib/db/dev-user";
import { grade } from "@/lib/engine/grade";
import { renderSolution } from "@/lib/engine/instantiate";

/**
 * POST /api/attempt/[id]/answer — bewertet eine Antwort.
 *
 * Erst hier darf die Lösung den Server verlassen, und auch nur, nachdem der
 * Attempt auf ANSWERED gesetzt wurde. Eine nicht lesbare Eingabe lässt die
 * Aufgabe offen und gibt nichts preis (Entscheidung E-04).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;

  const raw: unknown = await request.json().catch(() => undefined);
  const body = AnswerRequestSchema.safeParse(raw);
  if (!body.success) {
    return apiError("invalid_request", "Erwartet { answer: string, durationMs: number }.");
  }

  const attempt = await prisma.attempt.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      answerType: true,
      expectedAnswer: true,
      params: true,
      templateId: true,
      templateVersion: true,
      session: { select: { userId: true } },
    },
  });

  if (!attempt) return apiError("not_found", "Attempt existiert nicht.");
  if (attempt.session.userId !== DEV_USER_ID) {
    return apiError("forbidden", "Attempt gehört zu einem anderen User.");
  }
  if (AttemptStatusSchema.parse(attempt.status) !== "OPEN") {
    return apiError("already_answered", "Dieser Attempt wurde bereits beantwortet.");
  }

  // Zod auch an der Datenbankgrenze: status und answerType sind in SQLite
  // gewöhnliche Strings, expectedAnswer ist eine Json-Spalte.
  const answerType = AnswerTypeSchema.parse(attempt.answerType);
  const expectedAnswer = ExpectedAnswerSchema.parse(attempt.expectedAnswer);

  const verdict = grade(body.data.answer, expectedAnswer, answerType);

  if (!verdict.ok) {
    const unreadable: AnswerResponse = { isCorrect: false, parseError: "unparseable" };
    return NextResponse.json(unreadable, { status: 200 });
  }

  // Atomar: Nur wer den Attempt von OPEN auf ANSWERED dreht, darf antworten.
  // Zwei gleichzeitige Absenden können so nicht beide bewertet werden.
  const closed = await prisma.attempt.updateMany({
    where: { id: attempt.id, status: "OPEN" },
    data: {
      status: "ANSWERED",
      userAnswer: body.data.answer,
      isCorrect: verdict.isCorrect,
      durationMs: body.data.durationMs,
      answeredAt: new Date(),
    },
  });

  if (closed.count === 0) {
    return apiError("already_answered", "Dieser Attempt wurde bereits beantwortet.");
  }

  const response: AnswerResponse = {
    isCorrect: verdict.isCorrect,
    expectedAnswer,
    ...buildSolution(attempt.templateId, attempt.templateVersion, attempt.params, expectedAnswer),
  };

  return NextResponse.json(response, { status: 200 });
}

/**
 * Der Lösungstext wird aus den persistierten Parametern neu gerendert. Wurde das
 * Template seit dem Stellen der Aufgabe geändert, bleibt er weg — ein Text zu
 * einer anderen Version wäre schlechter als gar keiner.
 */
function buildSolution(
  templateId: string,
  templateVersion: number,
  params: unknown,
  expectedAnswer: string,
): { solutionText?: string } {
  const template = getTemplate(templateId);
  if (!template || template.version !== templateVersion) return {};

  const parsedParams = ParamsSchema.safeParse(params);
  if (!parsedParams.success) return {};

  const solutionText = renderSolution(template, parsedParams.data, expectedAnswer);
  return solutionText === undefined ? {} : { solutionText };
}
