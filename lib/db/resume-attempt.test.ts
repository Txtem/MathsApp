import { describe, expect, it } from "vitest";

import { AttemptStatusSchema, NextQuestionResponseSchema } from "@/lib/api/contracts";
import { classifyOutcome } from "@/lib/selection/outcome";

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
import { loadTopicStats } from "./topic-stats";

/**
 * Weg 1 aus D-33: Neuladen. `/next` liefert den offenen Attempt
 * der Sitzung erneut aus, statt einen neuen anzulegen — gegen eine echte
 * Datenbank (D-19).
 */

const fixture = setupAnswerFixture();
const { deps, seedAttempt } = fixture;

const LATER = new Date(NOW.getTime() + 60_000);

function neuladen() {
  return resumeOpenAttempt(deps(MIT_TIPPS), {
    practiceSessionId: fixture.sessionId(),
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
      hintsTotal: 2,
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
        "Alle 6 Personen werden angeordnet. Wie viele kommen für den ersten Platz infrage?",
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
    await seedAttempt({ tries: 1, hintsUsed: 2 });

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
  // Den Versionswechsel lösen Entwickler aus, nicht der Übende. Der Attempt
  // wird geschlossen, aber nicht als Misserfolg fortgeschrieben.
  const nachher = () =>
    resumeOpenAttempt(deps(MIT_TIPPS), { practiceSessionId: fixture.sessionId(), now: LATER });

  it("verwirft einen begonnenen Attempt, wenn die Version nicht mehr passt", async () => {
    const id = await seedAttempt({ templateVersion: 2, tries: 1, hintsUsed: 1 });

    expect(await nachher()).toBeUndefined();
    const r = await zeile(id);
    expect(r).toMatchObject({ status: "VOIDED", answeredAt: LATER });
    expect(classifyOutcome({ ...r, status: AttemptStatusSchema.parse(r.status) })).toBeNull();
  });

  it("schreibt dabei keinen Fortschritt fort", async () => {
    await fixture.prisma().topicMastery.create({
      data: { userId: USER, topic: TOPIC, attempts: 3, correct: 3, intervalDays: 8 },
    });
    await seedAttempt({ templateVersion: 2, tries: 1 });

    await nachher();

    expect(
      await fixture.prisma().topicMastery.findUnique({
        where: { userId_topic: { userId: USER, topic: TOPIC } },
      }),
    ).toMatchObject({ attempts: 3, correct: 3, intervalDays: 8 });
  });

  it("taucht in der gleitenden Quote nicht auf", async () => {
    await seedAttempt({ templateVersion: 2, tries: 1 });

    await nachher();

    const [stats] = await loadTopicStats(fixture.prisma(), USER, [TOPIC]);
    expect(stats).toMatchObject({ recentClosed: 0, recentSuccess: 0, recentRight: 0 });
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
