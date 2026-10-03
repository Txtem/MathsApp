import { describe, expect, it } from "vitest";

import { NextQuestionResponseSchema } from "@/lib/api/contracts";

import {
  antwort,
  MIT_TIPPS,
  NOW,
  setupAnswerFixture,
  TOPIC,
  USER,
} from "./__testing__/answer-fixture";
import { answerAttempt } from "./answer-attempt";
import { requestHint } from "./hint-attempt";
import { resumeOpenAttempt } from "./resume-attempt";

/**
 * Weg 1 aus SPEC-M2f Schritt 4b: Neuladen. `/next` liefert den offenen Attempt
 * der Sitzung erneut aus, statt einen neuen anzulegen — gegen eine echte
 * Datenbank (D-19).
 */

const fixture = setupAnswerFixture();
const { deps, seedAttempt } = fixture;

const LATER = new Date(NOW.getTime() + 60_000);

function neuladen() {
  return resumeOpenAttempt(deps(MIT_TIPPS), {
    practiceSessionId: fixture.sessionId(),
    userId: USER,
    now: LATER,
  });
}

function zeile(id: string) {
  return fixture.prisma().attempt.findUniqueOrThrow({ where: { id } });
}

describe("resumeOpenAttempt — Neuladen", () => {
  it("gibt nichts zurück, wenn kein Attempt offen ist", async () => {
    await seedAttempt({ status: "ANSWERED" });
    await seedAttempt({ status: "SKIPPED" });

    expect(await neuladen()).toBeUndefined();
  });

  it("liefert einen unberührten offenen Attempt erneut aus", async () => {
    const id = await seedAttempt();

    expect(await neuladen()).toEqual({
      attemptId: id,
      questionText: "Auf wie viele Arten lassen sich 6 Personen anordnen?",
      answerType: "integer",
      targetTimeSeconds: 60,
      topic: TOPIC,
      difficulty: 1,
      hintsTotal: 3,
      openedHints: [],
      firstTryWrong: false,
    });
  });

  it("bringt geöffnete Tipps und den ersten Fehlversuch mit", async () => {
    const id = await seedAttempt({ tries: 1, hintsUsed: 2 });

    const response = await neuladen();

    expect(response).toMatchObject({
      attemptId: id,
      firstTryWrong: true,
      openedHints: [
        "Kommt es auf die Reihenfolge an?",
        "Für den ersten Platz gibt es 6 Möglichkeiten.",
      ],
    });
  });

  it("erhöht hintsUsed beim Neuladen nicht", async () => {
    const id = await seedAttempt({ hintsUsed: 2 });

    await neuladen();
    await neuladen();

    expect((await zeile(id)).hintsUsed).toBe(2);
  });

  it("verrät nichts aus der Lösung und hält sich an den strikten Vertrag", async () => {
    await seedAttempt({ tries: 1, hintsUsed: 3 });

    const response = await neuladen();

    expect(NextQuestionResponseSchema.safeParse(response).success).toBe(true);
    const json = JSON.stringify(response);
    expect(json).not.toContain("720");
    expect(json).not.toContain("expectedAnswer");
    expect(json).not.toContain("solutionText");
  });

  it("nimmt den jüngsten offenen Attempt der Sitzung", async () => {
    await seedAttempt({ createdAt: NOW });
    const neuer = await seedAttempt({ createdAt: LATER });

    expect((await neuladen())?.attemptId).toBe(neuer);
  });

  it("liefert keinen offenen Attempt einer anderen Sitzung aus", async () => {
    const andere = await fixture.prisma().practiceSession.create({
      data: { userId: USER, startedAt: NOW },
    });
    await seedAttempt({ practiceSessionId: andere.id, tries: 1 });

    expect(await neuladen()).toBeUndefined();
  });
});

describe("resumeOpenAttempt — Template geändert", () => {
  const nachher = () =>
    resumeOpenAttempt(deps(MIT_TIPPS), {
      practiceSessionId: fixture.sessionId(),
      userId: USER,
      now: LATER,
    });

  it("schließt einen begonnenen Attempt als aufgegeben, wenn die Version nicht mehr passt", async () => {
    const id = await seedAttempt({ templateVersion: 2, tries: 1 });

    expect(await nachher()).toBeUndefined();
    expect(await zeile(id)).toMatchObject({ status: "SKIPPED", answeredAt: LATER });
    expect(
      await fixture.prisma().topicMastery.findUnique({
        where: { userId_topic: { userId: USER, topic: TOPIC } },
      }),
    ).toMatchObject({ attempts: 1, correct: 0, intervalDays: 1 });
  });

  it("lässt einen unberührten liegen", async () => {
    const id = await seedAttempt({ templateVersion: 2 });

    expect(await nachher()).toBeUndefined();
    expect((await zeile(id)).status).toBe("OPEN");
  });
});

describe("Neuladen über den ganzen Weg", () => {
  it("führt nach dem Fehlversuch zum zweiten Versuch derselben Aufgabe zurück", async () => {
    const id = await seedAttempt();
    await answerAttempt(deps(MIT_TIPPS), antwort(id, "42"));
    await requestHint(deps(MIT_TIPPS), { attemptId: id, userId: USER });

    const response = await neuladen();
    expect(response).toMatchObject({ attemptId: id, firstTryWrong: true });
    expect(response?.openedHints).toHaveLength(1);

    // Die nächste Antwort ist der zweite Versuch und schließt.
    const zweite = await answerAttempt(deps(MIT_TIPPS), antwort(id, "720"));
    expect(zweite.kind === "answered" && zweite.response.isCorrect).toBe(true);
    expect(await zeile(id)).toMatchObject({ status: "ANSWERED", tries: 2, hintsUsed: 1 });
  });
});
