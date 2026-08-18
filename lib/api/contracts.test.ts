import { describe, expect, it } from "vitest";

import type { Template } from "@/lib/engine/types";

import {
  AnswerResponseSchema,
  AnswerRequestSchema,
  AnswerTypeSchema,
  AttemptStatusSchema,
  CreateSessionRequestSchema,
  ExpectedAnswerSchema,
  ParamsSchema,
  NextQuestionResponseSchema,
  toNextQuestionResponse,
} from "./contracts";

const template: Pick<Template, "topic" | "difficulty" | "target_time_seconds"> = {
  topic: "arithmetik.addition",
  difficulty: 1,
  target_time_seconds: 30,
};

describe("toNextQuestionResponse — der wichtigste Vertrag im System", () => {
  // So kommt die Zeile aus der Datenbank: mit Lösung.
  const attemptRow = {
    id: "attempt-1",
    questionText: "Berechne: 18 + 23",
    answerType: "integer" as const,
    expectedAnswer: "41",
    seed: "seed-1",
    params: { a: 18, b: 23 },
  };

  it("gibt genau die sechs Felder aus SPEC Abschnitt 8 zurück", () => {
    expect(Object.keys(toNextQuestionResponse(attemptRow, template)).sort()).toEqual([
      "answerType",
      "attemptId",
      "difficulty",
      "questionText",
      "targetTimeSeconds",
      "topic",
    ]);
  });

  it("enthält die Lösung an keiner Stelle des JSON", () => {
    const json = JSON.stringify(toNextQuestionResponse(attemptRow, template));
    expect(json).not.toContain("expectedAnswer");
    expect(json).not.toContain("41");
    expect(json).not.toContain("seed");
  });

  it("übernimmt die Werte aus Attempt und Template", () => {
    expect(toNextQuestionResponse(attemptRow, template)).toEqual({
      attemptId: "attempt-1",
      questionText: "Berechne: 18 + 23",
      answerType: "integer",
      targetTimeSeconds: 30,
      topic: "arithmetik.addition",
      difficulty: 1,
    });
  });
});

describe("AnswerRequestSchema", () => {
  it("akzeptiert eine gültige Antwort", () => {
    expect(AnswerRequestSchema.safeParse({ answer: "41", durationMs: 12000 }).success).toBe(true);
  });

  const invalid: ReadonlyArray<readonly [string, unknown]> = [
    ["leere Antwort", { answer: "", durationMs: 1 }],
    ["fehlende Antwort", { durationMs: 1 }],
    ["fehlende Dauer", { answer: "41" }],
    ["negative Dauer", { answer: "41", durationMs: -1 }],
    ["Dauer als String", { answer: "41", durationMs: "12000" }],
    ["Dauer nicht ganzzahlig", { answer: "41", durationMs: 1.5 }],
    ["Antwort zu lang", { answer: "1".repeat(201), durationMs: 1 }],
    ["kein Objekt", "41"],
    ["undefined", undefined],
  ];

  it.each(invalid)("lehnt %s ab", (_name, value) => {
    expect(AnswerRequestSchema.safeParse(value).success).toBe(false);
  });
});

describe("CreateSessionRequestSchema", () => {
  it("erlaubt einen leeren Body", () => {
    expect(CreateSessionRequestSchema.safeParse({}).success).toBe(true);
  });

  it("erlaubt einen Topic-Filter", () => {
    const parsed = CreateSessionRequestSchema.safeParse({ topicFilter: "arithmetik" });
    expect(parsed.success && parsed.data.topicFilter).toBe("arithmetik");
  });

  it("lehnt einen leeren Filter ab", () => {
    expect(CreateSessionRequestSchema.safeParse({ topicFilter: "" }).success).toBe(false);
  });
});

describe("Schemas an der Datenbankgrenze", () => {
  it("kennt genau die drei Attempt-Status", () => {
    for (const status of ["OPEN", "ANSWERED", "SKIPPED"]) {
      expect(AttemptStatusSchema.safeParse(status).success).toBe(true);
    }
    for (const status of ["open", "PENDING", "", null]) {
      expect(AttemptStatusSchema.safeParse(status).success).toBe(false);
    }
  });

  it("kennt die answer_type-Liste aus SPEC Abschnitt 5", () => {
    expect(AnswerTypeSchema.options).toEqual([
      "numeric",
      "integer",
      "fraction",
      "set",
      "tuple",
      "text",
      "choice",
    ]);
    expect(AnswerTypeSchema.safeParse("bool").success).toBe(false);
  });

  it("verlangt die Musterlösung als nicht-leeren String", () => {
    expect(ExpectedAnswerSchema.safeParse("41").success).toBe(true);
    expect(ExpectedAnswerSchema.safeParse(41).success).toBe(false);
    expect(ExpectedAnswerSchema.safeParse("").success).toBe(false);
    expect(ExpectedAnswerSchema.safeParse(null).success).toBe(false);
  });

  it("liest params nur als flache Werte", () => {
    expect(ParamsSchema.safeParse({ a: 18, b: 23, ordered: true, label: "rot" }).success).toBe(true);
    expect(ParamsSchema.safeParse({ a: { nested: 1 } }).success).toBe(false);
    expect(ParamsSchema.safeParse({ a: null }).success).toBe(false);
    expect(ParamsSchema.safeParse("nichts").success).toBe(false);
  });
});

describe("Response-Schemas passen zu dem, was der Server baut", () => {
  it("akzeptiert die Ausgabe von toNextQuestionResponse", () => {
    const response = toNextQuestionResponse(
      { id: "a1", questionText: "Berechne: 1 + 1", answerType: "integer" },
      template,
    );
    expect(NextQuestionResponseSchema.safeParse(response).success).toBe(true);
  });

  it("kennt beide Formen der Antwort-Response", () => {
    expect(
      AnswerResponseSchema.safeParse({ isCorrect: false, parseError: "unparseable" }).success,
    ).toBe(true);
    expect(
      AnswerResponseSchema.safeParse({ isCorrect: true, expectedAnswer: "41" }).success,
    ).toBe(true);
    expect(
      AnswerResponseSchema.safeParse({
        isCorrect: false,
        expectedAnswer: "41",
        solutionText: "18 + 23 = 41",
      }).success,
    ).toBe(true);
  });

  it("lehnt eine Antwort ab, die beides mischt oder nichts sagt", () => {
    expect(AnswerResponseSchema.safeParse({ isCorrect: true }).success).toBe(false);
    expect(AnswerResponseSchema.safeParse({ parseError: "unparseable" }).success).toBe(false);
    // Eine offene Aufgabe darf keine Lösung mitschicken.
    expect(
      AnswerResponseSchema.safeParse({
        isCorrect: false,
        parseError: "unparseable",
        expectedAnswer: "41",
      }).success,
    ).toBe(false);
  });
});
