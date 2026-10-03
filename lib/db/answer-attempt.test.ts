import { describe, expect, it } from "vitest";

import { AnswerResponseSchema } from "@/lib/api/contracts";
import type { ValidatedTemplate } from "@/lib/content/schema";

import { ANDERER, antwort, TEMPLATE, TOPIC, USER, setupAnswerFixture } from "./__testing__/answer-fixture";
import { answerAttempt, type AnswerDeps } from "./answer-attempt";

/**
 * Die Route `POST /api/attempt/[id]/answer` setzt Invariante 2 durch:
 * `expectedAnswer` verlässt den Server nicht, solange der Attempt `OPEN` ist.
 * Seit M0 war das ungetestet. Hier ist es geprüft — gegen eine echte
 * Datenbank (D-19), weil die Bedingung an der Statuszeile hängt. Der zweite
 * Versuch (M2f) hat seine eigene Datei: `answer-attempt-retry.test.ts`.
 */

const fixture = setupAnswerFixture();
const { deps, seedAttempt } = fixture;

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

    const attempt = await fixture.prisma().attempt.findUniqueOrThrow({ where: { id } });
    expect(attempt.status).toBe("OPEN");
    expect(attempt.userAnswer).toBeNull();
    expect(attempt.answeredAt).toBeNull();
  });

  it("zählt eine unlesbare Eingabe nicht in den Fortschritt", async () => {
    const id = await seedAttempt();

    await answerAttempt(deps(), antwort(id, "keine Ahnung"));

    const mastery = await fixture.prisma().topicMastery.findUnique({
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

    expect((await fixture.prisma().attempt.findUniqueOrThrow({ where: { id } })).status).toBe("OPEN");
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

  it("liefert nach der zweiten falschen Antwort die Lösung — der Attempt ist geschlossen", async () => {
    const id = await seedAttempt();
    await answerAttempt(deps(), antwort(id, "42"));

    const outcome = await answerAttempt(deps(), antwort(id, "43"));

    expect(outcome.kind).toBe("answered");
    if (outcome.kind !== "answered") return;
    expect(outcome.response).toMatchObject({ isCorrect: false, expectedAnswer: "720" });
  });

  it("schließt den Attempt und schreibt die Antwort weg", async () => {
    const id = await seedAttempt();

    await answerAttempt(deps(), antwort(id, "720"));

    const attempt = await fixture.prisma().attempt.findUniqueOrThrow({ where: { id } });
    expect(attempt.status).toBe("ANSWERED");
    expect(attempt.userAnswer).toBe("720");
    expect(attempt.isCorrect).toBe(true);
    expect(attempt.answeredAt).not.toBeNull();
  });

  it("schreibt den Themenfortschritt fort", async () => {
    const id = await seedAttempt();

    await answerAttempt(deps(), antwort(id, "720"));

    const mastery = await fixture.prisma().topicMastery.findUnique({
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

describe("answerAttempt — gerundete Musterlösung", () => {
  /**
   * Beim Üben aufgefallen: Die Aufgabe verlangt eine auf vier Stellen gerundete
   * Dezimalzahl, die Lösung zeigte danach `46/91`. Wer richtig geantwortet
   * hatte, zweifelte an sich selbst. Siehe M2e C-2.
   */
  const MIT_RUNDUNG = {
    ...TEMPLATE,
    compute_ref: "wahrscheinlichkeit.hypergeometrisch.genau",
    answer_type: "numeric",
    round_to: 4,
  } as unknown as ValidatedTemplate;

  const mitRundung = (): AnswerDeps => deps(MIT_RUNDUNG);

  it("liefert die gerundete Form neben dem exakten Wert", async () => {
    const id = await seedAttempt({ expectedAnswer: "46/91", answerType: "numeric" });

    const outcome = await answerAttempt(mitRundung(), antwort(id, "0,5055"));

    expect(outcome.kind).toBe("answered");
    if (outcome.kind !== "answered") return;
    // 46/91 = 0,50549… — auf vier Stellen 0,5055.
    expect(outcome.response).toMatchObject({
      isCorrect: true,
      expectedAnswer: "46/91",
      expectedRounded: "0.5055",
    });
  });

  it("liefert sie auch nach zwei falschen Antworten", async () => {
    const id = await seedAttempt({ expectedAnswer: "46/91", answerType: "numeric" });
    await answerAttempt(mitRundung(), antwort(id, "0,4000"));

    const outcome = await answerAttempt(mitRundung(), antwort(id, "0,4001"));

    expect(outcome.kind).toBe("answered");
    if (outcome.kind !== "answered") return;
    expect(outcome.response).toMatchObject({ isCorrect: false, expectedRounded: "0.5055" });
  });

  it("rundet mit derselben Stellenzahl, nach der auch bewertet wird", async () => {
    // Gegenprobe: Was der Grader als richtig durchgehen lässt, muss auch das
    // sein, was die Lösung anzeigt.
    const id = await seedAttempt({ expectedAnswer: "46/91", answerType: "numeric" });
    const outcome = await answerAttempt(mitRundung(), antwort(id, "0.5055"));

    expect(outcome.kind).toBe("answered");
    if (outcome.kind !== "answered") return;
    if (!("expectedRounded" in outcome.response)) throw new Error("expectedRounded fehlt");

    const zweiter = await seedAttempt({ expectedAnswer: "46/91", answerType: "numeric" });
    const nachgetippt = await answerAttempt(
      mitRundung(),
      antwort(zweiter, outcome.response.expectedRounded as string),
    );
    expect(nachgetippt.kind === "answered" && nachgetippt.response.isCorrect).toBe(true);
  });

  it("lässt das Feld weg, wenn das Template kein round_to hat", async () => {
    const id = await seedAttempt();

    const outcome = await answerAttempt(deps(), antwort(id, "720"));

    expect(outcome.kind).toBe("answered");
    if (outcome.kind !== "answered") return;
    expect(outcome.response).not.toHaveProperty("expectedRounded");
  });

  it("lässt es auch weg, wenn das Template verschwunden ist", async () => {
    // Ohne Template ist unbekannt, auf wie viele Stellen gerundet wurde.
    const id = await seedAttempt({ expectedAnswer: "46/91", answerType: "numeric" });

    const outcome = await answerAttempt(deps(null), antwort(id, "0,5055"));

    expect(outcome.kind).toBe("answered");
    if (outcome.kind !== "answered") return;
    expect(outcome.response).not.toHaveProperty("expectedRounded");
  });
});

describe("answerAttempt — doppeltes Absenden", () => {
  it("lehnt das zweite Absenden ab", async () => {
    const id = await seedAttempt();

    expect((await answerAttempt(deps(), antwort(id, "720"))).kind).toBe("answered");
    expect(await answerAttempt(deps(), antwort(id, "720"))).toEqual({ kind: "already_answered" });
  });

  it("gibt nach dem Schließen keine Lösung mehr heraus", async () => {
    const id = await seedAttempt();
    await answerAttempt(deps(), antwort(id, "42"));
    await answerAttempt(deps(), antwort(id, "43"));

    const zweite = await answerAttempt(deps(), antwort(id, "720"));

    expect(zweite).toEqual({ kind: "already_answered" });
    expect(JSON.stringify(zweite)).not.toContain("720");
  });

  it("verändert die Statistik genau einmal", async () => {
    const id = await seedAttempt();

    await answerAttempt(deps(), antwort(id, "720"));
    await answerAttempt(deps(), antwort(id, "720"));

    const mastery = await fixture.prisma().topicMastery.findUnique({
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
