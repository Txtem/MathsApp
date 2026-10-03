import { describe, expect, it } from "vitest";

import { AttemptStatusSchema } from "@/lib/api/contracts";

import { antwort, MIT_TIPPS, NOW, setupAnswerFixture, USER } from "./__testing__/answer-fixture";
import { answerAttempt } from "./answer-attempt";
import { giveUpAttempt } from "./give-up-attempt";
import { requestHint } from "./hint-attempt";

/**
 * Ein verworfener Attempt (`VOIDED`, Template geändert) ist geschlossen: Antwort-,
 * Tipp- und Aufgeben-Route lehnen ihn genauso ab wie einen beantworteten oder
 * aufgegebenen — und geben dabei nichts aus der Lösung heraus.
 */

const fixture = setupAnswerFixture();
const { deps, seedAttempt } = fixture;

describe("VOIDED", () => {
  it("ist ein gültiger Status im Zod-Schema", () => {
    expect(AttemptStatusSchema.safeParse("VOIDED").success).toBe(true);
  });

  describe.each(["ANSWERED", "SKIPPED", "VOIDED"])("ein Attempt mit Status %s", (status) => {
    it("wird beim Beantworten abgelehnt", async () => {
      const id = await seedAttempt({ status, tries: 1 });
      const outcome = await answerAttempt(deps(MIT_TIPPS), antwort(id, "720"));
      expect(outcome).toEqual({ kind: "already_answered" });
    });

    it("bekommt keinen Tipp", async () => {
      const id = await seedAttempt({ status, tries: 1 });
      const outcome = await requestHint(deps(MIT_TIPPS), { attemptId: id, userId: USER });
      expect(outcome).toEqual({ kind: "already_answered" });
    });

    it("lässt sich nicht aufgeben und verrät nichts", async () => {
      const id = await seedAttempt({ status, tries: 1, hintsUsed: 2 });
      const outcome = await giveUpAttempt(deps(MIT_TIPPS), { attemptId: id, userId: USER, now: NOW });
      expect(outcome).toEqual({ kind: "already_answered" });
      expect(JSON.stringify(outcome)).not.toContain("720");
    });

    it("bleibt dabei unverändert", async () => {
      const id = await seedAttempt({ status, tries: 1, hintsUsed: 1 });
      await answerAttempt(deps(MIT_TIPPS), antwort(id, "720"));
      await requestHint(deps(MIT_TIPPS), { attemptId: id, userId: USER });
      await giveUpAttempt(deps(MIT_TIPPS), { attemptId: id, userId: USER, now: NOW });

      const r = await fixture.prisma().attempt.findUniqueOrThrow({ where: { id } });
      expect(r).toMatchObject({ status, tries: 1, hintsUsed: 1 });
      expect(
        await fixture.prisma().topicMastery.count(),
      ).toBe(0);
    });
  });
});
