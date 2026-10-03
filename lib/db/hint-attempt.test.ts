import { describe, expect, it } from "vitest";

import { HintResponseSchema } from "@/lib/api/contracts";

import {
  ANDERER,
  MIT_TIPPS,
  setupAnswerFixture,
  TEMPLATE,
  USER,
} from "./__testing__/answer-fixture";
import { requestHint } from "./hint-attempt";

/**
 * Tipps öffnen (SPEC-M2f, D-2), gegen eine echte Datenbank (D-19): Der Zähler
 * hängt an einer bedingten Aktualisierung der Zeile.
 */

const fixture = setupAnswerFixture();
const { deps, seedAttempt } = fixture;

function tipp(attemptId: string, userId = USER) {
  return { attemptId, userId };
}

async function hintsUsed(id: string): Promise<number> {
  return (await fixture.prisma().attempt.findUniqueOrThrow({ where: { id } })).hintsUsed;
}

describe("requestHint", () => {
  it("öffnet den ersten Tipp und zählt ihn", async () => {
    const id = await seedAttempt();

    const outcome = await requestHint(deps(MIT_TIPPS), tipp(id));

    expect(outcome).toEqual({
      kind: "hint",
      response: { hint: "Kommt es auf die Reihenfolge an?", index: 0, total: 3 },
    });
    expect(await hintsUsed(id)).toBe(1);
  });

  it("öffnet die Tipps der Reihe nach, mit eingesetzten Parametern", async () => {
    const id = await seedAttempt();

    await requestHint(deps(MIT_TIPPS), tipp(id));
    const zweiter = await requestHint(deps(MIT_TIPPS), tipp(id));

    expect(zweiter).toEqual({
      kind: "hint",
      response: { hint: "Für den ersten Platz gibt es 6 Möglichkeiten.", index: 1, total: 3 },
    });
  });

  it("lehnt ab, wenn alle Tipps geöffnet sind, und ändert nichts", async () => {
    const id = await seedAttempt();
    for (let i = 0; i < 3; i++) await requestHint(deps(MIT_TIPPS), tipp(id));

    expect(await requestHint(deps(MIT_TIPPS), tipp(id))).toEqual({ kind: "no_more_hints" });
    expect(await hintsUsed(id)).toBe(3);
  });

  it("gibt bei einem Template ohne Tipps keinen", async () => {
    const id = await seedAttempt();

    expect(await requestHint(deps(TEMPLATE), tipp(id))).toEqual({ kind: "no_more_hints" });
    expect(await hintsUsed(id)).toBe(0);
  });

  it("gibt keinen Tipp zu einer anderen Template-Version", async () => {
    const id = await seedAttempt({ templateVersion: 2 });

    expect(await requestHint(deps(MIT_TIPPS), tipp(id))).toEqual({ kind: "no_more_hints" });
  });

  it("funktioniert auch im zweiten Versuch", async () => {
    const id = await seedAttempt({ tries: 1 });

    expect((await requestHint(deps(MIT_TIPPS), tipp(id))).kind).toBe("hint");
  });

  it("nur für offene Attempts", async () => {
    for (const status of ["ANSWERED", "SKIPPED"]) {
      const id = await seedAttempt({ status });
      expect(await requestHint(deps(MIT_TIPPS), tipp(id))).toEqual({ kind: "already_answered" });
      expect(await hintsUsed(id)).toBe(0);
    }
  });

  it("nur für den eigenen Nutzer", async () => {
    const id = await seedAttempt({ userId: ANDERER });

    expect(await requestHint(deps(MIT_TIPPS), tipp(id))).toEqual({ kind: "forbidden" });
    expect(await requestHint(deps(MIT_TIPPS), tipp("gibt-es-nicht"))).toEqual({
      kind: "not_found",
    });
  });

  it("verrät nichts aus der Lösung und hält sich an den strikten Vertrag", async () => {
    const id = await seedAttempt();

    for (let i = 0; i < 3; i++) {
      const outcome = await requestHint(deps(MIT_TIPPS), tipp(id));
      if (outcome.kind !== "hint") throw new Error(outcome.kind);
      expect(HintResponseSchema.safeParse(outcome.response).success).toBe(true);
      expect(JSON.stringify(outcome)).not.toContain("720");
    }
  });

  it("zählt bei zwei gleichzeitigen Klicks nur einen Tipp", async () => {
    const id = await seedAttempt();

    const results = await Promise.all([
      requestHint(deps(MIT_TIPPS), tipp(id)),
      requestHint(deps(MIT_TIPPS), tipp(id)),
    ]);

    expect(results.filter((r) => r.kind === "hint")).toHaveLength(1);
    expect(results.filter((r) => r.kind === "conflict")).toHaveLength(1);
    expect(await hintsUsed(id)).toBe(1);
  });
});
