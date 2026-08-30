import { describe, expect, it } from "vitest";

import { instantiate } from "@/lib/engine/instantiate";
import type { Template } from "@/lib/engine/types";

import { drawQuestion, MAX_DRAWS } from "./next-question";
import type { TopicStats } from "./scoring";

/**
 * Der ganze Weg von der Auswahl zur fertigen Aufgabe, mit der Sperre gegen
 * dieselbe Aufgabe in derselben Sitzung (D-24, D-25).
 *
 * Gezogen wird gegen echte Templates aus dem Engine-Kern, nicht gegen eine
 * Attrappe von `instantiate`: Die Sperre hängt daran, was der Generator
 * tatsächlich hervorbringt — mit einer Attrappe prüfte der Test nur, was ich
 * ohnehin annehme (D-15).
 */

const TOPIC = "kombinatorik.permutation";
const NOW = new Date("2026-08-30T12:00:00.000Z");

const stats: TopicStats = {
  topic: TOPIC,
  recentCorrect: 0,
  recentAnswered: 0,
  dueAt: null,
  lastSeenAt: null,
};

/** Viele mögliche Instanzen: a und b aus 1 bis 9. */
const VIELE: Template = {
  id: "viele",
  version: 1,
  topic: TOPIC,
  difficulty: 1,
  target_time_seconds: 30,
  compute_ref: "arithmetik.add",
  answer_type: "integer",
  param_spec: { a: { type: "int", min: 1, max: 9 }, b: { type: "int", min: 1, max: 9 } },
  constraints: [],
  question_text: "{{a}} + {{b}}",
};

/**
 * Genau eine mögliche Instanz — nur `const`-Parameter, wie `aufg_00004`
 * (MISSISSIPPI, D-13). Der Fall, in dem die Sperre nichts ausrichten kann.
 */
const EINE: Template = {
  ...VIELE,
  id: "eine",
  param_spec: { a: { type: "const", value: 2 }, b: { type: "const", value: 3 } },
};

/** Liefert der Reihe nach feste Seeds — der Zufall gehört in den Test, nicht in den Code. */
function seeds(...werte: readonly string[]): () => string {
  let i = 0;
  return () => werte[Math.min(i++, werte.length - 1)];
}

/** Nimmt immer das erste Template des Pools. */
const first = () => 0;

function zieh(
  templates: readonly Template[],
  askedQuestionTexts: readonly string[],
  nextSeed: () => string,
) {
  return drawQuestion(templates, { stats: [stats], askedQuestionTexts, now: NOW }, first, nextSeed);
}

describe("drawQuestion", () => {
  it("nimmt den ersten Wurf, wenn die Aufgabe neu ist", () => {
    const gezogen = zieh([VIELE], [], seeds("s1"));

    expect(gezogen?.draws).toBe(1);
    expect(gezogen?.repeated).toBe(false);
    expect(gezogen?.template.id).toBe("viele");
    expect(gezogen?.instance.questionText).toBe(instantiate(VIELE, "s1").questionText);
  });

  it("persistiert den Seed, mit dem tatsächlich gewürfelt wurde", () => {
    // Invariante 3: Aus Seed und Template-Version muss sich die Instanz später
    // exakt rekonstruieren lassen — auch nach einem verworfenen Wurf.
    const erste = instantiate(VIELE, "s1");
    const gezogen = zieh([VIELE], [erste.questionText], seeds("s1", "s2"));

    expect(gezogen?.instance.seed).toBe("s2");
    expect(gezogen?.instance).toEqual(instantiate(VIELE, "s2"));
  });

  it("würfelt neu, wenn die Aufgabe in dieser Sitzung schon dran war", () => {
    const erste = instantiate(VIELE, "s1");
    const zweite = instantiate(VIELE, "s2");
    // Sonst prüfte der Test nichts: Die beiden Würfe müssen sich unterscheiden.
    expect(erste.questionText).not.toBe(zweite.questionText);

    const gezogen = zieh([VIELE], [erste.questionText], seeds("s1", "s2"));

    expect(gezogen?.draws).toBe(2);
    expect(gezogen?.repeated).toBe(false);
    expect(gezogen?.instance.questionText).toBe(zweite.questionText);
  });

  it("sperrt die ganze Sitzung, nicht nur die letzten Züge", () => {
    // Der Text steht als ältester Eintrag in der Liste und sperrt trotzdem.
    const erste = instantiate(VIELE, "s1");
    const gezogen = zieh([VIELE], [erste.questionText, "irgendwas", "noch etwas"], seeds("s1", "s2"));

    expect(gezogen?.instance.questionText).not.toBe(erste.questionText);
  });

  it("gibt nach fünf Würfen auf und nimmt die Wiederholung", () => {
    // `EINE` kann nichts anderes hervorbringen. Eine wiederholte Aufgabe ist
    // besser als keine — laut scheitern gibt es hier nicht.
    const einzige = instantiate(EINE, "s1");
    const gezogen = zieh([EINE], [einzige.questionText], seeds("s1", "s2", "s3", "s4", "s5", "s6"));

    expect(gezogen?.draws).toBe(MAX_DRAWS);
    expect(gezogen?.repeated).toBe(true);
    expect(gezogen?.instance.questionText).toBe(einzige.questionText);
  });

  it("liefert auch im Aufgeben eine vollständige, gültige Instanz", () => {
    const gezogen = zieh([EINE], [instantiate(EINE, "s1").questionText], seeds("s9"));

    expect(gezogen?.instance.expectedAnswer).toBe("5");
    expect(gezogen?.instance.templateVersion).toBe(EINE.version);
    expect(gezogen?.instance.seed).toBe("s9");
  });

  it("gibt undefined, wenn kein Template zum Filter passt", () => {
    const gezogen = drawQuestion(
      [VIELE],
      { topicFilter: "arithmetik", stats: [stats], now: NOW },
      first,
      seeds("s1"),
    );

    expect(gezogen).toBeUndefined();
  });

  it("kommt ohne Vorgeschichte aus", () => {
    const gezogen = drawQuestion([VIELE], { stats: [stats], now: NOW }, first, seeds("s1"));

    expect(gezogen?.draws).toBe(1);
    expect(gezogen?.repeated).toBe(false);
  });
});
