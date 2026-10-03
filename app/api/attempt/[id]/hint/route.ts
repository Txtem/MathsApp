import { NextResponse } from "next/server";

import { apiError } from "@/lib/api/responses";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { getTemplate } from "@/lib/content/load";
import { prisma } from "@/lib/db/client";
import { requestHint } from "@/lib/db/hint-attempt";

/**
 * POST /api/attempt/[id]/hint — öffnet den nächsten Tipp.
 *
 * Dünner Adapter. Die Entscheidungen — eigener Attempt, offen, noch ein Tipp
 * übrig, Zähler atomar — stehen in `lib/db/hint-attempt.ts` und sind dort gegen
 * eine echte Datenbank getestet.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const now = new Date();

  const outcome = await requestHint(
    { prisma, findTemplate: getTemplate },
    { attemptId: id, userId: await getCurrentUserId(now) },
  );

  switch (outcome.kind) {
    case "not_found":
      return apiError("not_found", "Attempt existiert nicht.");
    case "forbidden":
      return apiError("forbidden", "Attempt gehört zu einem anderen User.");
    case "already_answered":
      return apiError("already_answered", "Dieser Attempt ist bereits geschlossen.");
    case "no_more_hints":
      return apiError("no_more_hints", "Alle Tipps sind bereits geöffnet.");
    case "conflict":
      return apiError("conflict", "Ein anderer Tipp wurde gerade geöffnet.");
    case "hint":
      return NextResponse.json(outcome.response, { status: 200 });
  }
}
