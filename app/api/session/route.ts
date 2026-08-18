import { NextResponse } from "next/server";

import { type CreateSessionResponse, CreateSessionRequestSchema } from "@/lib/api/contracts";
import { apiError } from "@/lib/api/responses";
import { prisma } from "@/lib/db/client";
import { ensureDevUser } from "@/lib/db/dev-user";

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

  const userId = await ensureDevUser();

  const session = await prisma.session.create({
    data: { userId, topicFilter: parsed.data.topicFilter ?? null },
    select: { id: true },
  });

  const body: CreateSessionResponse = { sessionId: session.id };
  return NextResponse.json(body, { status: 201 });
}
