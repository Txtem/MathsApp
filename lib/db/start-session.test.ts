import { describe, expect, it } from "vitest";

import { AttemptStatusSchema } from "@/lib/api/contracts";
import { classifyOutcome } from "@/lib/selection/outcome";

import {
  ANDERER,
  antwort,
  NOW,
  setupAnswerFixture,
  TOPIC,
  USER,
} from "./__testing__/answer-fixture";
import { answerAttempt } from "./answer-attempt";
import { startSession } from "./start-session";
import { loadTopicStats } from "./topic-stats";

/**
 * Weg 2 aus D-33: eine neue Sitzung starten. Offene Attempts
 * aus älteren Sitzungen mit Versuch oder Tipp gelten als aufgegeben — gegen
 * eine echte Datenbank (D-19).
 */

const fixture = setupAnswerFixture();
const { deps, seedAttempt } = fixture;

const LATER = new Date(NOW.getTime() + 3_600_000);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function neueSitzung(userId = USER) {
  return startSession(fixture.prisma(), { userId, topicFilter: null, now: LATER });
}

function zeile(id: string) {
  return fixture.prisma().attempt.findUniqueOrThrow({ where: { id } });
}

function mastery() {
  return fixture.prisma().topicMastery.findUnique({
    where: { userId_topic: { userId: USER, topic: TOPIC } },
  });
}

describe("startSession — wer weggeht, hat aufgegeben", () => {
  it("schließt einen Attempt nach dem ersten Fehlversuch als SKIPPED, mit dem now der Anfrage", async () => {
    const id = await seedAttempt({ tries: 1 });

    const started = await neueSitzung();

    expect(started.abandoned).toBe(1);
    expect(await zeile(id)).toMatchObject({ status: "SKIPPED", answeredAt: LATER });
  });

  it("schließt einen Attempt mit geöffnetem Tipp", async () => {
    const id = await seedAttempt({ hintsUsed: 1 });

    await neueSitzung();

    expect((await zeile(id)).status).toBe("SKIPPED");
  });

  it("schreibt den Fortschritt als Misserfolg fort", async () => {
    await fixture.prisma().topicMastery.create({
      data: { userId: USER, topic: TOPIC, attempts: 2, correct: 2, intervalDays: 8 },
    });
    await seedAttempt({ tries: 1, hintsUsed: 2 });

    await neueSitzung();

    const entry = await mastery();
    expect(entry).toMatchObject({ attempts: 3, correct: 2, intervalDays: 1, lastSeenAt: LATER });
    expect(entry?.dueAt?.getTime()).toBe(LATER.getTime() + MS_PER_DAY);
  });

  it("lässt offene Attempts ohne Versuch und ohne Tipp unberührt", async () => {
    const id = await seedAttempt();

    const started = await neueSitzung();

    expect(started.abandoned).toBe(0);
    expect(await zeile(id)).toMatchObject({ status: "OPEN", answeredAt: null });
    expect(await mastery()).toBeNull();
  });

  it("rührt geschlossene Attempts nicht an", async () => {
    const beantwortet = await seedAttempt({ status: "ANSWERED", tries: 1 });

    await neueSitzung();

    expect(await zeile(beantwortet)).toMatchObject({ status: "ANSWERED", answeredAt: null });
  });

  it("rührt die Attempts eines anderen Nutzers nicht an", async () => {
    const fremd = await seedAttempt({ userId: ANDERER, tries: 1 });

    await neueSitzung();

    expect((await zeile(fremd)).status).toBe("OPEN");
  });

  it("legt die neue Sitzung mit demselben now an", async () => {
    const started = await neueSitzung();

    const session = await fixture.prisma().practiceSession.findUniqueOrThrow({
      where: { id: started.sessionId },
    });
    expect(session).toMatchObject({ userId: USER, startedAt: LATER, topicFilter: null });
  });
});

describe("Neue Sitzung über den ganzen Weg", () => {
  it("macht aus dem Fehlversuch einen aufgegebenen Attempt, der in der Quote zählt", async () => {
    const id = await seedAttempt();
    await answerAttempt(deps(), antwort(id, "42"));

    await neueSitzung();

    const r = await zeile(id);
    expect(classifyOutcome({ ...r, status: AttemptStatusSchema.parse(r.status) })).toBe(
      "gave_up",
    );
    const [stats] = await loadTopicStats(fixture.prisma(), USER, [TOPIC]);
    expect(stats).toMatchObject({ recentClosed: 1, recentSuccess: 0, recentRight: 0 });
  });
});
