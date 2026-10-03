import { describe, expect, it } from "vitest";

import { AttemptStatusSchema, GiveUpResponseSchema } from "@/lib/api/contracts";
import { classifyOutcome } from "@/lib/selection/outcome";

import {
  ANDERER,
  MIT_TIPPS,
  NOW,
  setupAnswerFixture,
  TEMPLATE,
  TOPIC,
  USER,
} from "./__testing__/answer-fixture";
import { giveUpAttempt } from "./give-up-attempt";
import { requestHint } from "./hint-attempt";

/**
 * Aufgeben (SPEC-M2f, D-3), gegen eine echte Datenbank (D-19).
 *
 * Abnahme: Aufgeben vor dem letzten Tipp lehnt der Server ab, nicht nur die
 * Oberfläche. Aufgeben verändert den Themenfortschritt.
 */

const fixture = setupAnswerFixture();
const { deps, seedAttempt } = fixture;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function aufgeben(attemptId: string, userId = USER) {
  return { attemptId, userId, now: NOW };
}

function mastery() {
  return fixture.prisma().topicMastery.findUnique({
    where: { userId_topic: { userId: USER, topic: TOPIC } },
  });
}

function zeile(id: string) {
  return fixture.prisma().attempt.findUniqueOrThrow({ where: { id } });
}

async function alleTipps(id: string): Promise<void> {
  for (let i = 0; i < 3; i++) await requestHint(deps(MIT_TIPPS), { attemptId: id, userId: USER });
}

describe("giveUpAttempt — erst alle Tipps", () => {
  it("lehnt Aufgeben vor dem letzten Tipp ab", async () => {
    for (const geoeffnet of [0, 1, 2]) {
      const id = await seedAttempt({ hintsUsed: geoeffnet });

      expect(await giveUpAttempt(deps(MIT_TIPPS), aufgeben(id))).toEqual({
        kind: "hints_remaining",
      });
      expect(await zeile(id)).toMatchObject({ status: "OPEN", answeredAt: null });
    }
    expect(await mastery()).toBeNull();
  });

  it("verrät bei der Ablehnung nichts aus der Lösung", async () => {
    const id = await seedAttempt({ hintsUsed: 2 });

    const outcome = await giveUpAttempt(deps(MIT_TIPPS), aufgeben(id));

    expect(JSON.stringify(outcome)).not.toContain("720");
  });

  it("erlaubt Aufgeben nach dem letzten Tipp und liefert die Lösung", async () => {
    const id = await seedAttempt();
    await alleTipps(id);

    const outcome = await giveUpAttempt(deps(MIT_TIPPS), aufgeben(id));

    expect(outcome).toEqual({
      kind: "given_up",
      response: { expectedAnswer: "720", solutionText: "$$6! = 720$$" },
    });
    if (outcome.kind !== "given_up") return;
    expect(GiveUpResponseSchema.safeParse(outcome.response).success).toBe(true);
  });

  it("erlaubt Aufgeben sofort, wenn das Template keine Tipps hat", async () => {
    const id = await seedAttempt();

    expect((await giveUpAttempt(deps(TEMPLATE), aufgeben(id))).kind).toBe("given_up");
  });
});

describe("giveUpAttempt — Zustand und Fortschritt", () => {
  it("schließt als SKIPPED mit answeredAt, ohne Urteil", async () => {
    const id = await seedAttempt({ hintsUsed: 3 });

    await giveUpAttempt(deps(MIT_TIPPS), aufgeben(id));

    const r = await zeile(id);
    expect(r).toMatchObject({ status: "SKIPPED", answeredAt: NOW, isCorrect: null });
    expect(
      classifyOutcome({ ...r, status: AttemptStatusSchema.parse(r.status) }),
    ).toBe("gave_up");
  });

  it("schreibt den Fortschritt als Misserfolg fort", async () => {
    await fixture.prisma().topicMastery.create({
      data: { userId: USER, topic: TOPIC, attempts: 4, correct: 4, intervalDays: 8 },
    });
    const id = await seedAttempt({ hintsUsed: 3 });

    await giveUpAttempt(deps(MIT_TIPPS), aufgeben(id));

    const entry = await mastery();
    expect(entry).toMatchObject({ attempts: 5, correct: 4, intervalDays: 1, lastSeenAt: NOW });
    expect(entry?.dueAt?.getTime()).toBe(NOW.getTime() + MS_PER_DAY);
  });

  it("geht auch im zweiten Versuch", async () => {
    const id = await seedAttempt({ tries: 1, hintsUsed: 3 });

    expect((await giveUpAttempt(deps(MIT_TIPPS), aufgeben(id))).kind).toBe("given_up");
    expect(await zeile(id)).toMatchObject({ status: "SKIPPED", tries: 1 });
  });

  it("lehnt einen geschlossenen Attempt ab und zählt nicht noch einmal", async () => {
    const id = await seedAttempt({ hintsUsed: 3 });
    await giveUpAttempt(deps(MIT_TIPPS), aufgeben(id));

    expect(await giveUpAttempt(deps(MIT_TIPPS), aufgeben(id))).toEqual({
      kind: "already_answered",
    });
    expect(await mastery()).toMatchObject({ attempts: 1 });
  });

  it("zählt bei gleichzeitigem Aufgeben nur einmal", async () => {
    const id = await seedAttempt({ hintsUsed: 3 });

    const results = await Promise.all([
      giveUpAttempt(deps(MIT_TIPPS), aufgeben(id)),
      giveUpAttempt(deps(MIT_TIPPS), aufgeben(id)),
    ]);

    expect(results.filter((r) => r.kind === "given_up")).toHaveLength(1);
    expect(await mastery()).toMatchObject({ attempts: 1 });
  });

  it("nur für den eigenen Nutzer", async () => {
    const id = await seedAttempt({ userId: ANDERER, hintsUsed: 3 });

    expect(await giveUpAttempt(deps(MIT_TIPPS), aufgeben(id))).toEqual({ kind: "forbidden" });
    expect(await giveUpAttempt(deps(MIT_TIPPS), aufgeben("gibt-es-nicht"))).toEqual({
      kind: "not_found",
    });
  });
});
