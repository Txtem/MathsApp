import type { PrismaClient } from "@/lib/generated/prisma/client";

import { abandonOpenAttempts } from "./attempts";

/**
 * Eine neue Übungssitzung starten (SPEC-M2f, Schritt 4b).
 *
 * Vorher werden offene Attempts desselben Nutzers aus älteren Sitzungen, die
 * schon einen Versuch oder einen Tipp hatten, als aufgegeben geschlossen und
 * als Misserfolg fortgeschrieben — mit dem `now` dieser Anfrage, in derselben
 * Transaktion wie das Anlegen. Wer weggeht, hat aufgegeben.
 *
 * Ohne diesen Schritt wanderte das Schlupfloch des Neuladens nur einen Klick
 * weiter: nach dem Fehlversuch zur Themenauswahl, neue Sitzung, und der Attempt
 * bliebe dauerhaft offen. Unberührte offene Attempts bleiben, wie sie sind.
 */

export interface StartSessionInput {
  readonly userId: string;
  readonly topicFilter: string | null;
  /** Die Uhr der Anfrage. Pflicht, nicht optional — siehe D-20. */
  readonly now: Date;
}

export interface StartedSession {
  readonly sessionId: string;
  /** Wie viele offene Attempts dabei als aufgegeben geschlossen wurden. */
  readonly abandoned: number;
}

export async function startSession(
  prisma: PrismaClient,
  input: StartSessionInput,
): Promise<StartedSession> {
  return prisma.$transaction(async (tx) => {
    // Vor dem Anlegen: Alle offenen Attempts des Nutzers stammen damit aus
    // älteren Sitzungen.
    const abandoned = await abandonOpenAttempts(tx, { userId: input.userId, now: input.now });

    const session = await tx.practiceSession.create({
      data: { userId: input.userId, topicFilter: input.topicFilter, startedAt: input.now },
      select: { id: true },
    });

    return { sessionId: session.id, abandoned };
  });
}
