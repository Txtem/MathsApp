import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { AnswerTypeSchema, toNextQuestionResponse } from "@/lib/api/contracts";
import { apiError } from "@/lib/api/responses";
import { getTemplates } from "@/lib/content/load";
import { prisma } from "@/lib/db/client";
import { DEV_USER_ID } from "@/lib/db/dev-user";
import { instantiate } from "@/lib/engine/instantiate";
import { selectTemplate } from "@/lib/selection/next-template";

/**
 * POST /api/session/[id]/next — stellt die nächste Aufgabe.
 *
 * Die Response enthält **niemals** `expectedAnswer`. Sie wird deshalb nicht aus
 * der Attempt-Zeile gespreadet, sondern in `toNextQuestionResponse` Feld für
 * Feld aufgebaut.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;

  const session = await prisma.session.findUnique({
    where: { id },
    select: { id: true, userId: true, topicFilter: true, endedAt: true },
  });

  if (!session) return apiError("not_found", "Session existiert nicht.");
  // Steht hier schon, obwohl M0 kein Auth hat: Mit M2 wird DEV_USER_ID durch die
  // User-ID aus der Auth-Session ersetzt, die Prüfung selbst bleibt.
  if (session.userId !== DEV_USER_ID) return apiError("forbidden", "Session gehört zu einem anderen User.");
  if (session.endedAt) return apiError("invalid_request", "Session ist bereits beendet.");

  const recent = await prisma.attempt.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { templateId: true },
  });

  const template = selectTemplate(
    getTemplates(),
    {
      topicFilter: session.topicFilter,
      recentTemplateIds: recent.map((attempt) => attempt.templateId),
    },
    Math.random,
  );

  if (!template) {
    return apiError("no_template", `Kein Template für den Filter "${session.topicFilter}".`);
  }

  // Der Seed ist die einzige Zufallsquelle der Aufgabe und wird persistiert —
  // damit ist jede Instanz später exakt reproduzierbar.
  const instance = instantiate(template, randomUUID());

  const attempt = await prisma.attempt.create({
    data: {
      sessionId: session.id,
      templateId: instance.templateId,
      templateVersion: instance.templateVersion,
      seed: instance.seed,
      params: { ...instance.params },
      questionText: instance.questionText,
      expectedAnswer: instance.expectedAnswer,
      answerType: instance.answerType,
      status: "OPEN",
    },
    select: { id: true, questionText: true, answerType: true },
  });

  return NextResponse.json(
    toNextQuestionResponse(
      { ...attempt, answerType: AnswerTypeSchema.parse(attempt.answerType) },
      template,
    ),
    { status: 201 },
  );
}
