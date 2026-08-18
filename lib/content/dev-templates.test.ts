import { describe, expect, it } from "vitest";

import { isComputeRef, registry } from "@/lib/engine/compute/registry";
import { makeRng } from "@/lib/engine/generate/rng";
import { sampleParams } from "@/lib/engine/generate/sample";
import { grade } from "@/lib/engine/grade";
import { instantiate, renderSolution } from "@/lib/engine/instantiate";
import { placeholders } from "@/lib/engine/render/interpolate";
import type { AnswerType, Template } from "@/lib/engine/types";

import { devTemplates, getDevTemplate } from "./dev-templates";

const ANSWER_TYPES: readonly AnswerType[] = [
  "numeric",
  "integer",
  "fraction",
  "set",
  "tuple",
  "text",
  "choice",
];

const seeds = Array.from({ length: 200 }, (_, i) => `seed-${i}`);

/**
 * Die Prüfungen, die laut SPEC.md Abschnitt 5 beim Laden hart fehlschlagen
 * müssen. Der Loader dafür kommt in M1 — solange die Templates inline im Code
 * stehen, übernimmt diese Suite die Rolle des Build-Gates.
 */
describe.each(devTemplates.map((template) => [template.id, template] as const))(
  "%s — Template-Vertrag",
  (_id, template: Template) => {
    it("hält das Format aus dem Zod-Schema ein", () => {
      expect(template.id).toMatch(/^aufg_\d{5}$/);
      expect(template.topic).toMatch(/^[a-z]+(\.[a-z-]+)*$/);
      expect(template.version).toBeGreaterThan(0);
      expect(Number.isInteger(template.version)).toBe(true);
      expect(template.difficulty).toBeGreaterThanOrEqual(1);
      expect(template.difficulty).toBeLessThanOrEqual(5);
      expect(template.target_time_seconds).toBeGreaterThan(0);
      expect(ANSWER_TYPES).toContain(template.answer_type);
    });

    it("nennt eine compute_ref aus der Registry", () => {
      expect(isComputeRef(template.compute_ref)).toBe(true);
    });

    it("hat für jeden Platzhalter im Aufgabentext einen Parameter", () => {
      const known = new Set(Object.keys(template.param_spec));
      for (const name of placeholders(template.question_text)) {
        expect(known, `{${name}} in question_text`).toContain(name);
      }
    });

    it("verwendet jeden gewürfelten Parameter im Aufgabentext", () => {
      // Ungenutzte Zufallsparameter sind ein Template-Bug: Sie ändern die
      // Aufgabe, ohne dass man es ihr ansieht. `const` darf ungenutzt bleiben.
      const used = placeholders(template.question_text);
      for (const [name, spec] of Object.entries(template.param_spec)) {
        if (spec.type === "const") continue;
        expect(used, `Parameter ${name}`).toContain(name);
      }
    });

    it("kennt im Lösungstext nur Parameter und result", () => {
      if (template.solution_text === undefined) return;
      const allowed = new Set([...Object.keys(template.param_spec), "result"]);
      for (const name of placeholders(template.solution_text)) {
        expect(allowed, `{${name}} in solution_text`).toContain(name);
      }
    });

    it("würfelt Parameter, die das Input-Schema der Compute-Funktion akzeptiert", () => {
      expect(isComputeRef(template.compute_ref)).toBe(true);
      if (!isComputeRef(template.compute_ref)) return;
      const entry = registry[template.compute_ref];
      for (const seed of seeds.slice(0, 25)) {
        const params = sampleParams(template.param_spec, makeRng(seed));
        expect(entry.input.safeParse(params).success, JSON.stringify(params)).toBe(true);
      }
    });
  },
);

describe.each(devTemplates.map((template) => [template.id, template] as const))(
  "%s — 200 Seeds",
  (_id, template: Template) => {
    const instances = seeds.map((seed) => instantiate(template, seed));

    it("instanziiert ohne Ausnahme", () => {
      expect(instances).toHaveLength(200);
    });

    it("hält alle Constraints ein", () => {
      for (const instance of instances) {
        const result = BigInt(instance.expectedAnswer);
        if (template.id === "aufg_00001") expect(result).toBeLessThanOrEqual(100n);
        if (template.id === "aufg_00002") expect(result).toBeGreaterThanOrEqual(0n);
      }
    });

    it("hält die Parameter in ihren Wertebereichen", () => {
      for (const instance of instances) {
        for (const [name, spec] of Object.entries(template.param_spec)) {
          if (spec.type !== "int") continue;
          const value = Number(instance.params[name]);
          expect(value).toBeGreaterThanOrEqual(spec.min);
          expect(value).toBeLessThanOrEqual(spec.max);
        }
      }
    });

    it("zeigt keinen offenen Platzhalter an", () => {
      for (const instance of instances) {
        expect(instance.questionText).not.toMatch(/[{}]/);
        expect(instance.questionText).toMatch(/^Berechne: \d+ [+-] \d+$/);
      }
    });

    it("rechnet unabhängig nachvollziehbar", () => {
      for (const instance of instances) {
        const a = BigInt(Number(instance.params.a));
        const b = BigInt(Number(instance.params.b));
        const expected = template.id === "aufg_00001" ? a + b : a - b;
        expect(instance.expectedAnswer).toBe(expected.toString());
      }
    });

    it("ist reproduzierbar", () => {
      for (const seed of seeds.slice(0, 50)) {
        expect(instantiate(template, seed)).toEqual(instantiate(template, seed));
      }
    });

    it("liefert genug verschiedene Aufgaben", () => {
      const distinct = new Set(instances.map((instance) => instance.questionText));
      expect(distinct.size).toBeGreaterThan(100);
    });

    it("bewertet die eigene Musterlösung als richtig", () => {
      for (const instance of instances.slice(0, 50)) {
        expect(grade(instance.expectedAnswer, instance.expectedAnswer, instance.answerType)).toEqual(
          { ok: true, isCorrect: true, normalized: instance.expectedAnswer },
        );
      }
    });

    it("rendert einen Lösungstext ohne offenen Platzhalter", () => {
      const solution = renderSolution(template, instances[0]);
      expect(solution).toBeDefined();
      expect(solution).not.toMatch(/[{}]/);
    });
  },
);

describe("devTemplates — Sammlung", () => {
  it("enthält die zwei M0-Templates", () => {
    expect(devTemplates.map((template) => template.id)).toEqual(["aufg_00001", "aufg_00002"]);
  });

  it("vergibt jede ID nur einmal", () => {
    expect(new Set(devTemplates.map((template) => template.id)).size).toBe(devTemplates.length);
  });

  it("findet Templates über ihre ID", () => {
    expect(getDevTemplate("aufg_00001")?.topic).toBe("arithmetik.addition");
    expect(getDevTemplate("aufg_00002")?.topic).toBe("arithmetik.subtraktion");
    expect(getDevTemplate("aufg_99999")).toBeUndefined();
  });
});
