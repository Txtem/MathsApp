import type { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Was in dieser Übungssitzung schon gestellt wurde — die Eingabe für die
 * Auswahl der nächsten Aufgabe (SPEC.md Abschnitt 10).
 *
 * Geholt werden **zwei Spalten**, nicht die Zeile: `expectedAnswer` hat in
 * einem Auswahlpfad nichts verloren. Das ist keine Frage der Menge, sondern die
 * Fortsetzung von Invariante 2 in den Code hinein — was nie geladen wird, kann
 * nicht versehentlich hinausgehen. Ein Test hält die Auswahl der Spalten fest.
 *
 * Ohne Obergrenze: Die Sperre gegen dieselbe Aufgabe gilt für die ganze Sitzung,
 * nicht für ein Fenster. Das sind zwei kurze Spalten über die Attempts einer
 * einzelnen Sitzung; sollte das je zum Problem werden, gehören die Fragetexte
 * als Hash in eine eigene Spalte und nicht in eine größere Abfrage.
 *
 * Kein `server-only`, Client als Parameter — wie die übrigen Module hier,
 * siehe D-19.
 */

export interface SessionHistory {
  /** Template-IDs der bisherigen Aufgaben, jüngste zuerst. Für die Abwertung. */
  readonly recentTemplateIds: readonly string[];
  /** Die gestellten Fragetexte. Für die Sperre gegen dieselbe Aufgabe. */
  readonly askedQuestionTexts: readonly string[];
}

export async function loadSessionHistory(
  prisma: PrismaClient,
  practiceSessionId: string,
): Promise<SessionHistory> {
  const rows = await prisma.attempt.findMany({
    where: { practiceSessionId },
    orderBy: { createdAt: "desc" },
    select: { templateId: true, questionText: true },
  });

  return {
    recentTemplateIds: rows.map((row) => row.templateId),
    askedQuestionTexts: rows.map((row) => row.questionText),
  };
}
