import { NextResponse } from "next/server";

import { AnswerRequestSchema } from "@/lib/api/contracts";
import { apiError } from "@/lib/api/responses";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { getTemplate } from "@/lib/content/load";
import { answerAttempt } from "@/lib/db/answer-attempt";
import { prisma } from "@/lib/db/client";

/**
 * POST /api/attempt/[id]/answer — bewertet eine Antwort.
 *
 * Dünner Adapter: Request lesen, Uhr lesen, Nutzer ermitteln, Ergebnis auf
 * Statuscodes abbilden. Der Zeitstempel entsteht hier einmal und trägt sowohl
 * `answeredAt` als auch den neuen Termin (D-20).
 * Die Entscheidungen selbst — vor allem, dass die Lösung eine offene
 * Aufgabe nicht verlässt — stehen in `lib/db/answer-attempt.ts` und sind dort
 * gegen eine echte Datenbank getestet.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const now = new Date();

  const raw: unknown = await request.json().catch(() => undefined);
  const body = AnswerRequestSchema.safeParse(raw);
  if (!body.success) {
    return apiError("invalid_request", "Erwartet { answer: string, durationMs: number }.");
  }

  const outcome = await answerAttempt(
    { prisma, findTemplate: getTemplate },
    {
      attemptId: id,
      userId: await getCurrentUserId(now),
      answer: body.data.answer,
      durationMs: body.data.durationMs,
      now,
    },
  );

  switch (outcome.kind) {
    case "not_found":
      return apiError("not_found", "Attempt existiert nicht.");
    case "forbidden":
      return apiError("forbidden", "Attempt gehört zu einem anderen User.");
    case "already_answered":
      return apiError("already_answered", "Dieser Attempt wurde bereits beantwortet.");
    case "answered":
      return NextResponse.json(outcome.response, { status: 200 });
  }
}
