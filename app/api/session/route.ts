import { NextResponse } from "next/server";

import { type CreateSessionResponse, CreateSessionRequestSchema } from "@/lib/api/contracts";
import { apiError } from "@/lib/api/responses";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/client";
import { startSession } from "@/lib/db/start-session";

/**
 * POST /api/session — startet eine Übungssitzung.
 *
 * Request:  { topicFilter?: string }
 * Response: { sessionId: string }
 *
 * Die Uhr wird hier einmal gelesen und weitergereicht (D-20). Offene Attempts
 * aus älteren Sitzungen mit Versuch oder Tipp schließt `startSession` als
 * aufgegeben — wer weggeht, hat aufgegeben (SPEC-M2f, Schritt 4b).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const now = new Date();

  const raw: unknown = await request.json().catch(() => ({}));
  const parsed = CreateSessionRequestSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return apiError("invalid_request", "topicFilter muss ein nicht-leerer String sein.");
  }

  const userId = await getCurrentUserId(now);

  const session = await startSession(prisma, {
    userId,
    topicFilter: parsed.data.topicFilter ?? null,
    now,
  });

  const body: CreateSessionResponse = { sessionId: session.sessionId };
  return NextResponse.json(body, { status: 201 });
}
