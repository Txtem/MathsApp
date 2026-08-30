import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AnswerResponseSchema } from "@/lib/api/contracts";
import type { ValidatedTemplate } from "@/lib/content/schema";
import type { PrismaClient } from "@/lib/generated/prisma/client";

import { createTempDatabase, type TempDatabase } from "./__testing__/temp-database";
import { answerAttempt, type AnswerDeps } from "./answer-attempt";

/**
 * Die Route `POST /api/attempt/[id]/answer` setzt Invariante 2 durch:
 * `expectedAnswer` verlässt den Server nicht, solange der Attempt `OPEN` ist.
 * Seit M0 war das ungetestet. Hier ist es geprüft — gegen eine echte
 * Datenbank (D-19), weil die Bedingung an der Statuszeile hängt.
 */

const USER = "user-1";
const ANDERER = "user-2";
const TOPIC = "kombinatorik.permutation";

/** Ein Template, das zu den angelegten Attempts passt. */
const TEMPLATE = {
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

let database: TempDatabase;
let prisma: PrismaClient;
let sessionId: string;

/**
 * Deps mit dem Standard-Template. `findTemplate` ist hier eine Attrappe.
 * `null` heißt: Es gibt kein Template mehr — nicht `undefined`, sonst greift
 * der Default-Parameter.
 */
function deps(template: ValidatedTemplate | null = TEMPLATE): AnswerDeps {
  return { prisma, findTemplate: (id) => (template?.id === id ? template : undefined) };
}

async function seedAttempt(
  overrides: {
    readonly status?: string;
    readonly templateVersion?: number;
    readonly userId?: string;
    readonly expectedAnswer?: string;
  } = {},
): Promise<string> {
  const attempt = await prisma.attempt.create({
    data: {
      practiceSessionId: sessionId,
      templateId: TEMPLATE.id,
      templateVersion: overrides.templateVersion ?? TEMPLATE.version,
      seed: `seed-${Math.random()}`,
      params: { n: 6 },
      questionText: "Auf wie viele Arten lassen sich 6 Personen anordnen?",
      userId: overrides.userId ?? USER,
      topic: TOPIC,
      difficulty: 1,
      expectedAnswer: overrides.expectedAnswer ?? "720",
      answerType: "integer",
      status: overrides.status ?? "OPEN",
    },
  });

  return attempt.id;
}

function antwort(attemptId: string, answer: string) {
  return { attemptId, userId: USER, answer, durationMs: 5000 };
}

beforeEach(async () => {
  database = createTempDatabase();
  prisma = database.prisma;

  await prisma.user.create({ data: { id: USER, email: "test@localhost" } });
  await prisma.user.create({ data: { id: ANDERER, email: "anderer@localhost" } });
  const session = await prisma.practiceSession.create({ data: { userId: USER } });
  sessionId = session.id;
});

afterEach(async () => {
  await database.destroy();
});

describe("answerAttempt — Invariante 2", () => {
  it("gibt bei unlesbarer Eingabe weder expectedAnswer noch solutionText preis", async () => {
    const id = await seedAttempt();

    const outcome = await answerAttempt(deps(), antwort(id, "keine Ahnung"));

    expect(outcome.kind).toBe("answered");
    if (outcome.kind !== "answered") return;

    // Kein Feld, keine Spur — nicht als Wert, nicht als Schlüssel.
    expect(outcome.response).toEqual({ isCorrect: false, parseError: "unparseable" });
    expect(Object.keys(outcome.response)).toEqual(["isCorrect", "parseError"]);
    expect(JSON.stringify(outcome.response)).not.toContain("720");
  });

  it("lässt den Attempt bei unlesbarer Eingabe offen", async () => {
    const id = await seedAttempt();

    await answerAttempt(deps(), antwort(id, "keine Ahnung"));

    const attempt = await prisma.attempt.findUniqueOrThrow({ where: { id } });
    expect(attempt.status).toBe("OPEN");
    expect(attempt.userAnswer).toBeNull();
    expect(attempt.answeredAt).toBeNull();
  });

  it("zählt eine unlesbare Eingabe nicht in den Fortschritt", async () => {
    const id = await seedAttempt();

    await answerAttempt(deps(), antwort(id, "keine Ahnung"));

    const mastery = await prisma.topicMastery.findUnique({
      where: { userId_topic: { userId: USER, topic: TOPIC } },
    });
    expect(mastery).toBeNull();
  });

  it("gibt auch nach mehreren unlesbaren Eingaben nichts preis", async () => {
    const id = await seedAttempt();

    for (const eingabe of ["hm", "vielleicht 720?", "sieben hundert zwanzig"]) {
      const outcome = await answerAttempt(deps(), antwort(id, eingabe));
      expect(outcome).toEqual({
        kind: "answered",
        response: { isCorrect: false, parseError: "unparseable" },
      });
    }

    expect((await prisma.attempt.findUniqueOrThrow({ where: { id } })).status).toBe("OPEN");
  });

  it("gibt die Lösung nicht heraus, wenn der Attempt einem anderen gehört", async () => {
    const id = await seedAttempt({ userId: ANDERER });

    const outcome = await answerAttempt(deps(), antwort(id, "720"));

    expect(outcome).toEqual({ kind: "forbidden" });
  });

  it("verrät über einen unbekannten Attempt nichts", async () => {
    expect(await answerAttempt(deps(), antwort("gibt-es-nicht", "720"))).toEqual({
      kind: "not_found",
    });
  });
});

describe("answerAttempt — beantworten", () => {
  it("liefert bei richtiger Antwort Lösung und Lösungsweg", async () => {
    const id = await seedAttempt();

    const outcome = await answerAttempt(deps(), antwort(id, "720"));

    expect(outcome.kind).toBe("answered");
    if (outcome.kind !== "answered") return;

    expect(outcome.response).toMatchObject({ isCorrect: true, expectedAnswer: "720" });
    expect(outcome.response).toHaveProperty("solutionText", "$$6! = 720$$");
  });

  it("liefert bei falscher Antwort ebenfalls die Lösung — der Attempt ist geschlossen", async () => {
    const id = await seedAttempt();

    const outcome = await answerAttempt(deps(), antwort(id, "42"));

    expect(outcome.kind).toBe("answered");
    if (outcome.kind !== "answered") return;
    expect(outcome.response).toMatchObject({ isCorrect: false, expectedAnswer: "720" });
  });

  it("schließt den Attempt und schreibt die Antwort weg", async () => {
    const id = await seedAttempt();

    await answerAttempt(deps(), antwort(id, "720"));

    const attempt = await prisma.attempt.findUniqueOrThrow({ where: { id } });
    expect(attempt.status).toBe("ANSWERED");
    expect(attempt.userAnswer).toBe("720");
    expect(attempt.isCorrect).toBe(true);
    expect(attempt.answeredAt).not.toBeNull();
  });

  it("schreibt den Themenfortschritt fort", async () => {
    const id = await seedAttempt();

    await answerAttempt(deps(), antwort(id, "720"));

    const mastery = await prisma.topicMastery.findUnique({
      where: { userId_topic: { userId: USER, topic: TOPIC } },
    });
    expect(mastery).toMatchObject({ attempts: 1, correct: 1, intervalDays: 2 });
  });

  it("lässt den Lösungsweg weg, wenn die Template-Version nicht mehr passt", async () => {
    // Das Template steht auf Version 1, der Attempt wurde mit Version 2
    // gestellt: Ein Lösungsweg zu einer anderen Version wäre irreführend.
    const id = await seedAttempt({ templateVersion: 2 });

    const outcome = await answerAttempt(deps(), antwort(id, "720"));

    expect(outcome.kind).toBe("answered");
    if (outcome.kind !== "answered") return;
    expect(outcome.response).toMatchObject({ isCorrect: true, expectedAnswer: "720" });
    expect(outcome.response).not.toHaveProperty("solutionText");
  });

  it("kommt ohne Template aus", async () => {
    const id = await seedAttempt();

    const outcome = await answerAttempt(deps(null), antwort(id, "720"));

    expect(outcome.kind).toBe("answered");
    if (outcome.kind !== "answered") return;
    expect(outcome.response).toMatchObject({ isCorrect: true, expectedAnswer: "720" });
    expect(outcome.response).not.toHaveProperty("solutionText");
  });

  it("hält sich an den Response-Vertrag", async () => {
    const id = await seedAttempt();
    const outcome = await answerAttempt(deps(), antwort(id, "720"));

    expect(outcome.kind).toBe("answered");
    if (outcome.kind !== "answered") return;
    // `strictObject`: ein unbekanntes Feld in der Antwort fällt hier auf.
    expect(AnswerResponseSchema.safeParse(outcome.response).success).toBe(true);
  });
});

describe("answerAttempt — doppeltes Absenden", () => {
  it("lehnt das zweite Absenden ab", async () => {
    const id = await seedAttempt();

    expect((await answerAttempt(deps(), antwort(id, "720"))).kind).toBe("answered");
    expect(await answerAttempt(deps(), antwort(id, "720"))).toEqual({ kind: "already_answered" });
  });

  it("gibt beim zweiten Absenden keine Lösung mehr heraus", async () => {
    const id = await seedAttempt();
    await answerAttempt(deps(), antwort(id, "42"));

    const zweite = await answerAttempt(deps(), antwort(id, "720"));

    expect(zweite).toEqual({ kind: "already_answered" });
    expect(JSON.stringify(zweite)).not.toContain("720");
  });

  it("verändert die Statistik genau einmal", async () => {
    const id = await seedAttempt();

    await answerAttempt(deps(), antwort(id, "720"));
    await answerAttempt(deps(), antwort(id, "720"));

    const mastery = await prisma.topicMastery.findUnique({
      where: { userId_topic: { userId: USER, topic: TOPIC } },
    });
    expect(mastery).toMatchObject({ attempts: 1, correct: 1 });
  });

  it("lehnt einen Attempt ab, der schon als SKIPPED markiert ist", async () => {
    const id = await seedAttempt({ status: "SKIPPED" });

    expect(await answerAttempt(deps(), antwort(id, "720"))).toEqual({ kind: "already_answered" });
  });

  it("zählt auch bei gleichzeitigem Absenden nur einmal", async () => {
    const id = await seedAttempt();

    const results = await Promise.all([
      answerAttempt(deps(), antwort(id, "720")),
      answerAttempt(deps(), antwort(id, "720")),
    ]);

    expect(results.filter((outcome) => outcome.kind === "answered")).toHaveLength(1);
    expect(results.filter((outcome) => outcome.kind === "already_answered")).toHaveLength(1);
  });
});
