import { afterEach, beforeEach } from "vitest";

import type { ValidatedTemplate } from "@/lib/content/schema";
import type { PrismaClient } from "@/lib/generated/prisma/client";

import type { AnswerDeps } from "../answer-attempt";
import { createTempDatabase, type TempDatabase } from "./temp-database";

/**
 * Gemeinsame Einrichtung der Tests zu `answerAttempt`: Wegwerf-Datenbank mit
 * zwei Nutzern und einer Sitzung, ein passendes Template, Helfer zum Anlegen
 * von Attempts. Ausgelagert, weil die Tests auf mehrere Dateien verteilt sind.
 */

export const USER = "user-1";
export const ANDERER = "user-2";
export const TOPIC = "kombinatorik.permutation";

/** Die Uhr der Anfrage — in den Tests eine Konstante (D-20). */
export const NOW = new Date("2026-08-30T12:00:00.000Z");

/** Ein Template, das zu den angelegten Attempts passt. */
export const TEMPLATE = {
  id: "aufg_00003",
  version: 1,
  topic: TOPIC,
  difficulty: 1,
  target_time_seconds: 60,
  compute_ref: "kombinatorik.permutation.factorial",
  answer_type: "integer",
  param_spec: { n: { type: "int", min: 3, max: 8 } },
  constraints: [],
  question_text: "Auf wie viele Arten lassen sich {{n}} Personen anordnen?",
  solution_text: "$${{n}}! = {{result}}$$",
} as unknown as ValidatedTemplate;

/** Dasselbe Template mit zwei Tipps (Erkennen, Ansatz); der zweite nennt einen Parameter. */
export const MIT_TIPPS = {
  ...TEMPLATE,
  hints: [
    "Kommt es auf die Reihenfolge an?",
    "Alle {{n}} Personen werden angeordnet. Wie viele kommen für den ersten Platz infrage?",
  ],
} as unknown as ValidatedTemplate;

export interface SeedOverrides {
  readonly status?: string;
  readonly templateVersion?: number;
  readonly userId?: string;
  readonly expectedAnswer?: string;
  readonly answerType?: string;
  readonly tries?: number;
  readonly hintsUsed?: number;
  /** Ohne Angabe die Sitzung der Fixture. */
  readonly practiceSessionId?: string;
  readonly createdAt?: Date;
}

export interface AnswerFixture {
  readonly prisma: () => PrismaClient;
  /**
   * Deps mit dem Standard-Template. `findTemplate` ist hier eine Attrappe.
   * `null` heißt: Es gibt kein Template mehr — nicht `undefined`, sonst greift
   * der Default-Parameter.
   */
  readonly deps: (template?: ValidatedTemplate | null) => AnswerDeps;
  readonly seedAttempt: (overrides?: SeedOverrides) => Promise<string>;
  /** Die Sitzung, in der `seedAttempt` ohne Angabe anlegt. */
  readonly sessionId: () => string;
}

/** Registriert `beforeEach`/`afterEach` für die Datei, in der es aufgerufen wird. */
export function setupAnswerFixture(): AnswerFixture {
  let database: TempDatabase;
  let sessionId: string;

  beforeEach(async () => {
    database = createTempDatabase();
    const { prisma } = database;

    await prisma.user.create({ data: { id: USER, email: "test@localhost", createdAt: NOW } });
    await prisma.user.create({
      data: { id: ANDERER, email: "anderer@localhost", createdAt: NOW },
    });
    const session = await prisma.practiceSession.create({
      data: { userId: USER, startedAt: NOW },
    });
    sessionId = session.id;
  });

  afterEach(async () => {
    await database.destroy();
  });

  return {
    prisma: () => database.prisma,
    sessionId: () => sessionId,
    deps: (template = TEMPLATE) => ({
      prisma: database.prisma,
      findTemplate: (id) => (template?.id === id ? template : undefined),
    }),
    seedAttempt: async (overrides = {}) => {
      const attempt = await database.prisma.attempt.create({
        data: {
          practiceSessionId: overrides.practiceSessionId ?? sessionId,
          templateId: TEMPLATE.id,
          templateVersion: overrides.templateVersion ?? TEMPLATE.version,
          seed: `seed-${Math.random()}`,
          params: { n: 6 },
          questionText: "Auf wie viele Arten lassen sich 6 Personen anordnen?",
          userId: overrides.userId ?? USER,
          topic: TOPIC,
          difficulty: 1,
          expectedAnswer: overrides.expectedAnswer ?? "720",
          answerType: overrides.answerType ?? "integer",
          status: overrides.status ?? "OPEN",
          tries: overrides.tries ?? 0,
          hintsUsed: overrides.hintsUsed ?? 0,
          createdAt: overrides.createdAt ?? NOW,
        },
      });
      return attempt.id;
    },
  };
}

export function antwort(attemptId: string, answer: string, durationMs = 5000) {
  return { attemptId, userId: USER, answer, durationMs, now: NOW };
}
