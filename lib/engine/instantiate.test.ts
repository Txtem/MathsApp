import { describe, expect, it } from "vitest";

import { TemplateConfigError, TemplateUnsatisfiableError, UnknownComputeRefError } from "./errors";
import { grade } from "./grade";
import { instantiate, MAX_TRIES, renderSolution } from "./instantiate";
import type { Template } from "./types";

const addition: Template = {
  id: "aufg_00001",
  version: 1,
  topic: "arithmetik.addition",
  difficulty: 1,
  target_time_seconds: 30,
  compute_ref: "arithmetik.add",
  answer_type: "integer",
  param_spec: {
    a: { type: "int", min: 10, max: 99 },
    b: { type: "int", min: 10, max: 99 },
  },
  constraints: ["result <= 150"],
  question_text: "Was ist {a} + {b}?",
  solution_text: "{a} + {b} = {result}",
  tags: ["addition"],
};

const subtraction: Template = {
  id: "aufg_00002",
  version: 3,
  topic: "arithmetik.subtraktion",
  difficulty: 1,
  target_time_seconds: 30,
  compute_ref: "arithmetik.subtract",
  answer_type: "integer",
  param_spec: {
    a: { type: "int", min: 20, max: 99 },
    b: { type: "int", min: 1, max: 99 },
  },
  // Kein negatives Ergebnis: Das prüft, dass die zweite Constraint-Runde greift.
  constraints: ["result >= 0"],
  question_text: "Was ist {a} - {b}?",
};

const seeds = Array.from({ length: 200 }, (_, i) => `seed-${i}`);

describe.each([
  ["Addition", addition],
  ["Subtraktion", subtraction],
])("instantiate — %s über 200 Seeds", (_name, template) => {
  const instances = seeds.map((seed) => instantiate(template, seed));

  it("liefert für jeden Seed eine Instanz", () => {
    expect(instances).toHaveLength(200);
  });

  it("interpoliert jeden Platzhalter", () => {
    for (const instance of instances) {
      expect(instance.questionText).not.toMatch(/[{}]/);
      expect(instance.questionText).toMatch(/^Was ist \d+ [+-] \d+\?$/);
    }
  });

  it("hält alle Constraints ein", () => {
    for (const instance of instances) {
      const result = BigInt(instance.expectedAnswer);
      if (template.id === addition.id) expect(result).toBeLessThanOrEqual(150n);
      else expect(result).toBeGreaterThanOrEqual(0n);
    }
  });

  it("rechnet die Musterlösung korrekt", () => {
    for (const instance of instances) {
      const a = Number(instance.params.a);
      const b = Number(instance.params.b);
      const expected = template.id === addition.id ? a + b : a - b;
      expect(instance.expectedAnswer).toBe(String(expected));
    }
  });

  it("hält Parameter in ihren Wertebereichen", () => {
    for (const instance of instances) {
      for (const [key, spec] of Object.entries(template.param_spec)) {
        if (spec.type !== "int") continue;
        expect(Number(instance.params[key])).toBeGreaterThanOrEqual(spec.min);
        expect(Number(instance.params[key])).toBeLessThanOrEqual(spec.max);
      }
    }
  });

  it("übernimmt Template-ID und -Version für die Reproduzierbarkeit", () => {
    for (const instance of instances) {
      expect(instance.templateId).toBe(template.id);
      expect(instance.templateVersion).toBe(template.version);
      expect(instance.answerType).toBe("integer");
    }
  });

  it("ist deterministisch: gleicher Seed, gleiche Instanz", () => {
    for (const seed of seeds.slice(0, 50)) {
      expect(instantiate(template, seed)).toEqual(instantiate(template, seed));
    }
  });

  it("variiert über verschiedene Seeds", () => {
    const distinct = new Set(instances.map((instance) => instance.questionText));
    expect(distinct.size).toBeGreaterThan(50);
  });
});

describe("instantiate — Zusammenspiel mit grade", () => {
  it("bewertet die eigene Musterlösung als richtig", () => {
    for (const seed of seeds.slice(0, 50)) {
      const instance = instantiate(addition, seed);
      const result = grade(instance.expectedAnswer, instance.expectedAnswer, instance.answerType);
      expect(result).toEqual({ ok: true, isCorrect: true, normalized: instance.expectedAnswer });
    }
  });

  it("bewertet eine um 1 danebenliegende Antwort als falsch", () => {
    const instance = instantiate(addition, "seed-1");
    const off = String(BigInt(instance.expectedAnswer) + 1n);
    const result = grade(off, instance.expectedAnswer, instance.answerType);
    expect(result.ok && result.isCorrect).toBe(false);
  });
});

describe("instantiate — Fehlerfälle", () => {
  it("scheitert laut, wenn die Constraints unerfüllbar sind", () => {
    const impossible: Template = {
      ...addition,
      param_spec: { a: { type: "int", min: 1, max: 2 }, b: { type: "int", min: 1, max: 2 } },
      constraints: ["result > 1000"],
    };
    expect(() => instantiate(impossible, "seed")).toThrow(TemplateUnsatisfiableError);
    expect(() => instantiate(impossible, "seed")).toThrow(String(MAX_TRIES));
  });

  it("lehnt eine compute_ref außerhalb der Whitelist ab", () => {
    const unknown: Template = { ...addition, compute_ref: "arithmetik.multiply" };
    expect(() => instantiate(unknown, "seed")).toThrow(UnknownComputeRefError);
  });

  it("lehnt einen Platzhalter ohne Parameter ab", () => {
    const broken: Template = { ...addition, question_text: "Was ist {a} + {c}?" };
    expect(() => instantiate(broken, "seed")).toThrow(TemplateConfigError);
  });

  it("lehnt ein Constraint mit unbekanntem Namen ab", () => {
    const broken: Template = { ...addition, constraints: ["c >= 1"] };
    expect(() => instantiate(broken, "seed")).toThrow(TemplateConfigError);
  });

  it("verwirft Parameter, die das Compute-Schema ablehnt, statt zu werfen", () => {
    // `a` ist hier ein float — das Input-Schema der Registry verlangt Ganzzahlen,
    // jeder Wurf wird verworfen, am Ende steht der laute Fehler.
    const floats: Template = {
      ...addition,
      param_spec: { a: { type: "float", min: 1, max: 2 }, b: { type: "int", min: 1, max: 2 } },
      constraints: [],
    };
    expect(() => instantiate(floats, "seed")).toThrow(TemplateUnsatisfiableError);
  });
});

describe("renderSolution", () => {
  it("rendert den Lösungstext mit result", () => {
    const instance = instantiate(addition, "seed-7");
    const solution = renderSolution(addition, instance.params, instance.expectedAnswer);
    expect(solution).toBe(
      `${instance.params.a} + ${instance.params.b} = ${instance.expectedAnswer}`,
    );
  });

  it("gibt undefined, wenn das Template keinen Lösungstext hat", () => {
    const bare = instantiate(subtraction, "seed-7");
    expect(renderSolution(subtraction, bare.params, bare.expectedAnswer)).toBeUndefined();
  });
});
