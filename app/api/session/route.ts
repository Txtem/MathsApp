import { NextResponse } from "next/server";

import { type CreateSessionResponse, CreateSessionRequestSchema } from "@/lib/api/contracts";
import { apiError } from "@/lib/api/responses";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/client";

/**
 * POST /api/session — startet eine Übungssitzung.
 *
 * Request:  { topicFilter?: string }
 * Response: { sessionId: string }
 *
 * Die Uhr wird hier einmal gelesen und weitergereicht (D-20).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const now = new Date();

  const raw: unknown = await request.json().catch(() => ({}));
  const parsed = CreateSessionRequestSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return apiError("invalid_request", "topicFilter muss ein nicht-leerer String sein.");
  }

  const userId = await getCurrentUserId(now);

  const session = await prisma.practiceSession.create({
    data: { userId, topicFilter: parsed.data.topicFilter ?? null, startedAt: now },
    select: { id: true },
  });

  const body: CreateSessionResponse = { sessionId: session.id };
  return NextResponse.json(body, { status: 201 });
}
