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
 */
export async function POST(request: Request): Promise<NextResponse> {
  const raw: unknown = await request.json().catch(() => ({}));
  const parsed = CreateSessionRequestSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return apiError("invalid_request", "topicFilter muss ein nicht-leerer String sein.");
  }

  const userId = await getCurrentUserId();

  const session = await prisma.practiceSession.create({
    data: { userId, topicFilter: parsed.data.topicFilter ?? null },
    select: { id: true },
  });

  const body: CreateSessionResponse = { sessionId: session.id };
  return NextResponse.json(body, { status: 201 });
}
