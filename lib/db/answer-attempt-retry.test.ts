import { describe, expect, it } from "vitest";

import { AnswerResponseSchema } from "@/lib/api/contracts";
import type { ValidatedTemplate } from "@/lib/content/schema";
import { classifyOutcome, countsAsSuccess } from "@/lib/selection/outcome";

import { antwort, TEMPLATE, TOPIC, USER, setupAnswerFixture } from "./__testing__/answer-fixture";
import { answerAttempt } from "./answer-attempt";

/**
 * Der zweite Versuch (SPEC.md Abschnitt 8). Die heikelste Änderung des Meilensteins:
 * Bis M2e schloss jede lesbare Antwort den Attempt. Jetzt bleibt er nach der
 * ersten falschen Antwort offen — und Invariante 2 verlangt, dass dann nichts
 * aus der Lösung in der Response steht.
 */

const fixture = setupAnswerFixture();
const { deps, seedAttempt } = fixture;

/** Ein Template mit `round_to`: Dann gäbe es zusätzlich `expectedRounded` zu verraten. */
const MIT_RUNDUNG = {
  ...TEMPLATE,
  compute_ref: "wahrscheinlichkeit.hypergeometrisch.genau",
  answer_type: "numeric",
  round_to: 4,
} as unknown as ValidatedTemplate;

const RETRY = { kind: "answered", response: { isCorrect: false, retry: true } };

function mastery() {
  return fixture.prisma().topicMastery.findUnique({
    where: { userId_topic: { userId: USER, topic: TOPIC } },
  });
}

function zeile(id: string) {
  return fixture.prisma().attempt.findUniqueOrThrow({ where: { id } });
}

describe("nach der ersten falschen Antwort — Invariante 2", () => {
  it("antwortet mit retry und sonst nichts", async () => {
    const id = await seedAttempt();

    const outcome = await answerAttempt(deps(), antwort(id, "42"));

    expect(outcome).toEqual(RETRY);
    if (outcome.kind !== "answered") return;
    // Kein Feld, keine Spur — nicht als Wert, nicht als Schlüssel.
    expect(Object.keys(outcome.response).sort()).toEqual(["isCorrect", "retry"]);
    expect(outcome.response).not.toHaveProperty("expectedAnswer");
    expect(outcome.response).not.toHaveProperty("solutionText");
    expect(outcome.response).not.toHaveProperty("expectedRounded");
    expect(JSON.stringify(outcome)).not.toContain("720");
  });

  it("verrät auch bei round_to weder den Bruch noch die gerundete Zahl", async () => {
    const id = await seedAttempt({ expectedAnswer: "46/91", answerType: "numeric" });

    const outcome = await answerAttempt(deps(MIT_RUNDUNG), antwort(id, "0,4"));

    expect(outcome).toEqual(RETRY);
    const json = JSON.stringify(outcome);
    for (const spur of ["46", "91", "0.5055", "0,5055", "5055"]) {
      expect(json).not.toContain(spur);
    }
  });

  it("hält sich an den strikten Response-Vertrag", async () => {
    const id = await seedAttempt();
    const outcome = await answerAttempt(deps(), antwort(id, "42"));

    if (outcome.kind !== "answered") throw new Error(`unerwartet: ${outcome.kind}`);
    expect(AnswerResponseSchema.safeParse(outcome.response).success).toBe(true);
    // Und umgekehrt: Dieselbe Response mit Lösung angehängt wäre kein gültiger
    // retry mehr — der Vertrag selbst lässt das Leck nicht zu.
    const mitLeck = { ...outcome.response, expectedAnswer: "720" };
    expect(AnswerResponseSchema.safeParse(mitLeck).success).toBe(false);
  });

  it("lässt den Attempt offen und hält die erste Antwort fest", async () => {
    const id = await seedAttempt();

    await answerAttempt(deps(), antwort(id, "42", 8000));

    expect(await zeile(id)).toMatchObject({
      status: "OPEN",
      tries: 1,
      firstAnswer: "42",
      firstDurationMs: 8000,
      userAnswer: null,
      isCorrect: null,
      durationMs: null,
      answeredAt: null,
    });
  });

  it("schreibt keinen Fortschritt — es gibt noch kein Urteil", async () => {
    const id = await seedAttempt();

    await answerAttempt(deps(), antwort(id, "42"));

    expect(await mastery()).toBeNull();
  });

  it("gibt auch danach bei unlesbarer Eingabe nichts preis und verbraucht keinen Versuch", async () => {
    const id = await seedAttempt();
    await answerAttempt(deps(), antwort(id, "42"));

    const outcome = await answerAttempt(deps(), antwort(id, "keine Ahnung"));

    expect(outcome).toEqual({
      kind: "answered",
      response: { isCorrect: false, parseError: "unparseable" },
    });
    expect(await zeile(id)).toMatchObject({ status: "OPEN", tries: 1 });
  });
});

describe("eine unlesbare Eingabe verbraucht keinen Versuch (D-04)", () => {
  it("lässt nach unlesbar noch einen ersten und einen zweiten Versuch", async () => {
    const id = await seedAttempt();

    await answerAttempt(deps(), antwort(id, "hm"));
    expect(await zeile(id)).toMatchObject({ status: "OPEN", tries: 0 });

    expect(await answerAttempt(deps(), antwort(id, "42"))).toEqual(RETRY);
  });
});

describe("der zweite Versuch", () => {
  it("schließt bei richtiger Antwort und liefert die Lösung", async () => {
    const id = await seedAttempt();
    await answerAttempt(deps(), antwort(id, "42", 8000));

    const outcome = await answerAttempt(deps(), antwort(id, "720", 20_000));

    expect(outcome.kind).toBe("answered");
    if (outcome.kind !== "answered") return;
    expect(outcome.response).toMatchObject({
      isCorrect: true,
      expectedAnswer: "720",
      solutionText: "$$6! = 720$$",
    });
    // durationMs ist die Zeit bis zur letzten bewerteten Antwort.
    expect(await zeile(id)).toMatchObject({
      status: "ANSWERED",
      tries: 2,
      isCorrect: true,
      userAnswer: "720",
      firstAnswer: "42",
      firstDurationMs: 8000,
      durationMs: 20_000,
    });
  });

  it("schließt bei falscher Antwort als falsch und liefert die Lösung", async () => {
    const id = await seedAttempt();
    await answerAttempt(deps(), antwort(id, "42"));

    const outcome = await answerAttempt(deps(), antwort(id, "43"));

    expect(outcome.kind).toBe("answered");
    if (outcome.kind !== "answered") return;
    expect(outcome.response).toMatchObject({ isCorrect: false, expectedAnswer: "720" });
    expect(await zeile(id)).toMatchObject({ status: "ANSWERED", tries: 2, isCorrect: false });
  });

  it("nimmt danach keine dritte Antwort mehr an", async () => {
    const id = await seedAttempt();
    await answerAttempt(deps(), antwort(id, "42"));
    await answerAttempt(deps(), antwort(id, "43"));

    expect(await answerAttempt(deps(), antwort(id, "720"))).toEqual({ kind: "already_answered" });
  });

  it("braucht es nicht, wenn die erste Antwort sitzt", async () => {
    const id = await seedAttempt();

    const outcome = await answerAttempt(deps(), antwort(id, "720"));

    expect(outcome.kind === "answered" && outcome.response.isCorrect).toBe(true);
    expect(await zeile(id)).toMatchObject({ status: "ANSWERED", tries: 1, firstAnswer: null });
  });
});

describe("Fortschritt: Anzeige und Steuerung getrennt", () => {
  it("zählt richtig im zweiten Versuch als richtig, aber nicht als Erfolg", async () => {
    const id = await seedAttempt();
    await answerAttempt(deps(), antwort(id, "42"));
    await answerAttempt(deps(), antwort(id, "720"));

    expect(await mastery()).toMatchObject({ attempts: 1, correct: 1, intervalDays: 1 });
  });

  it("zählt richtig im ersten Versuch mit Tipp als richtig, aber nicht als Erfolg", async () => {
    const id = await seedAttempt({ hintsUsed: 1 });

    await answerAttempt(deps(), antwort(id, "720"));

    expect(await mastery()).toMatchObject({ attempts: 1, correct: 1, intervalDays: 1 });
  });

  it("zählt richtig im ersten Versuch ohne Tipp als Erfolg", async () => {
    const id = await seedAttempt();

    await answerAttempt(deps(), antwort(id, "720"));

    expect(await mastery()).toMatchObject({ attempts: 1, correct: 1, intervalDays: 2 });
  });

  it("stimmt mit countsAsSuccess auf der geschlossenen Zeile überein", async () => {
    // Der Anwendungspfad benutzt dieselbe Funktion, die outcome.test.ts prüft —
    // nicht einen Nachbau (Konvention zu Extraktionen).
    const faelle = [["720"], ["42", "720"], ["42", "43"]] as const;
    for (const antworten of faelle) {
      const id = await seedAttempt();
      for (const a of antworten) await answerAttempt(deps(), antwort(id, a));
      const r = await zeile(id);
      const fields = { status: "ANSWERED" as const, isCorrect: r.isCorrect, tries: r.tries };
      const vorher = await mastery();
      await fixture.prisma().topicMastery.deleteMany();

      expect(vorher?.intervalDays === 2).toBe(countsAsSuccess({ ...fields, hintsUsed: 0 }));
      expect(vorher?.correct === 1).toBe(classifyOutcome(fields)?.startsWith("right") === true);
    }
  });
});

describe("gleichzeitiges Absenden", () => {
  it("lässt von zwei falschen ersten Antworten nur eine als ersten Versuch gelten", async () => {
    const id = await seedAttempt();

    const results = await Promise.all([
      answerAttempt(deps(), antwort(id, "42")),
      answerAttempt(deps(), antwort(id, "43")),
    ]);

    expect(results.filter((r) => r.kind === "answered")).toHaveLength(1);
    expect(results.filter((r) => r.kind === "already_answered")).toHaveLength(1);
    expect(await zeile(id)).toMatchObject({ status: "OPEN", tries: 1 });
    expect(await mastery()).toBeNull();
  });

  it("endet bei falsch und richtig zugleich nie in einem widersprüchlichen Zustand", async () => {
    for (const reihenfolge of [
      ["42", "720"],
      ["720", "42"],
    ]) {
      const id = await seedAttempt();
      const results = await Promise.all(
        reihenfolge.map((a) => answerAttempt(deps(), antwort(id, a))),
      );
      const r = await zeile(id);

      // Genau einer kam durch. Und die Zeile erzählt eine einzige Geschichte:
      // geschlossen im ersten Versuch ohne firstAnswer, oder offen nach dem
      // ersten Fehlversuch.
      expect(results.filter((x) => x.kind === "already_answered")).toHaveLength(1);
      if (r.status === "ANSWERED") {
        expect(r).toMatchObject({ tries: 1, firstAnswer: null, isCorrect: true });
      } else {
        expect(r).toMatchObject({ status: "OPEN", tries: 1, firstAnswer: "42" });
      }
      await fixture.prisma().topicMastery.deleteMany();
    }
  });
});
