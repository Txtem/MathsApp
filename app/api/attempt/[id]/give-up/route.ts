import { NextResponse } from "next/server";

import { apiError } from "@/lib/api/responses";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { getTemplate } from "@/lib/content/load";
import { prisma } from "@/lib/db/client";
import { giveUpAttempt } from "@/lib/db/give-up-attempt";

/**
 * POST /api/attempt/[id]/give-up — „Lösung zeigen", also aufgeben.
 *
 * Dünner Adapter. Dass erst alle Tipps geöffnet sein müssen und dass Aufgeben
 * den Fortschritt als Misserfolg fortschreibt, steht in
 * `lib/db/give-up-attempt.ts` und `lib/db/attempts.ts`. Der Zeitstempel
 * entsteht hier einmal und trägt `answeredAt` und den neuen Termin (D-20).
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const now = new Date();

  const outcome = await giveUpAttempt(
    { prisma, findTemplate: getTemplate },
    { attemptId: id, userId: await getCurrentUserId(now), now },
  );

  switch (outcome.kind) {
    case "not_found":
      return apiError("not_found", "Attempt existiert nicht.");
    case "forbidden":
      return apiError("forbidden", "Attempt gehört zu einem anderen User.");
    case "already_answered":
      return apiError("already_answered", "Dieser Attempt ist bereits geschlossen.");
    case "hints_remaining":
      return apiError("hints_remaining", "Erst alle Tipps öffnen, dann die Lösung.");
    case "given_up":
      return NextResponse.json(outcome.response, { status: 200 });
  }
}
