import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { AnswerTypeSchema, toNextQuestionResponse } from "@/lib/api/contracts";
import { apiError } from "@/lib/api/responses";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { getTemplates } from "@/lib/content/load";
import { prisma } from "@/lib/db/client";
import { loadTopicStats } from "@/lib/db/topic-stats";
import { instantiate } from "@/lib/engine/instantiate";
import { AVOID_COUNT, matchesTopic, selectTemplate } from "@/lib/selection/next-template";

/**
 * POST /api/session/[id]/next — stellt die nächste Aufgabe.
 *
 * Die Response enthält **niemals** `expectedAnswer`. Sie wird deshalb nicht aus
 * der Attempt-Zeile gespreadet, sondern in `toNextQuestionResponse` Feld für
 * Feld aufgebaut.
 *
 * Die Uhr wird hier einmal gelesen: Auswahl und `createdAt` sehen denselben
 * Zeitpunkt (D-20).
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const now = new Date();
  const userId = await getCurrentUserId(now);

  const session = await prisma.practiceSession.findUnique({
    where: { id },
    select: { id: true, userId: true, topicFilter: true, endedAt: true },
  });

  if (!session) return apiError("not_found", "Session existiert nicht.");
  if (session.userId !== userId) return apiError("forbidden", "Session gehört zu einem anderen User.");
  if (session.endedAt) return apiError("invalid_request", "Session ist bereits beendet.");

  const recent = await prisma.attempt.findMany({
    where: { practiceSessionId: session.id },
    orderBy: { createdAt: "desc" },
    take: AVOID_COUNT,
    select: { templateId: true },
  });

  // Statistiken nur zu den Themen holen, die der Filter überhaupt zulässt.
  const templates = getTemplates();
  const topics = [
    ...new Set(
      templates
        .filter((candidate) => matchesTopic(candidate.topic, session.topicFilter))
        .map((candidate) => candidate.topic),
    ),
  ];

  const template = selectTemplate(
    templates,
    {
      topicFilter: session.topicFilter,
      stats: await loadTopicStats(prisma, userId, topics),
      recentTemplateIds: recent.map((attempt) => attempt.templateId),
      now,
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
      practiceSessionId: session.id,
      templateId: instance.templateId,
      templateVersion: instance.templateVersion,
      seed: instance.seed,
      params: { ...instance.params },
      questionText: instance.questionText,
      // Denormalisiert, siehe D-18: Auswahl und Statistik lesen diese Felder
      // vom Attempt, nicht über Session und Template.
      userId: session.userId,
      topic: template.topic,
      difficulty: template.difficulty,
      expectedAnswer: instance.expectedAnswer,
      answerType: instance.answerType,
      status: "OPEN",
      createdAt: now,
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
