import { describe, expect, it } from "vitest";

import { registry } from "@/lib/engine/compute/registry";
import { fromStorageString, isInteger } from "@/lib/engine/expr/rational";
import { checkConstraints, RESULT_KEY } from "@/lib/engine/generate/constraints";
import { instantiate, renderSolution } from "@/lib/engine/instantiate";
import type { ParamValue } from "@/lib/engine/types";

import { readContent } from "./read";
import type { ValidatedTemplate } from "./schema";

/**
 * Der Property-Test über den echten Content: Jedes Template im Repo wird mit
 * 200 Seeds instanziiert. Wenn ein Template unter irgendeinem Seed scheitert,
 * ist es falsch konfiguriert — und das soll hier auffallen, nicht beim Nutzer.
 */

const { templates } = readContent();
const seeds = Array.from({ length: 200 }, (_, i) => `seed-${i}`);

function inRange(template: ValidatedTemplate, name: string, value: ParamValue): boolean {
  const spec = template.param_spec[name];
  if (!spec) return false;
  switch (spec.type) {
    case "int":
      return typeof value === "number" && Number.isInteger(value) && value >= spec.min && value <= spec.max;
    case "choice":
      return spec.values.includes(value);
    case "const":
      return value === spec.value;
  }
}

describe.each(templates.map((template) => [template.id, template] as const))(
  "%s — 200 Seeds",
  (_id, template: ValidatedTemplate) => {
    const instances = seeds.map((seed) => instantiate(template, seed));

    it("instanziiert unter jedem Seed", () => {
      expect(instances).toHaveLength(seeds.length);
    });

    it("lässt keinen Platzhalter stehen", () => {
      for (const instance of instances) {
        expect(instance.questionText).not.toContain("{{");
        expect(instance.questionText.trim()).not.toBe("");
      }
    });

    it("hält alle Constraints ein — auch die auf result", () => {
      for (const instance of instances) {
        const result = fromStorageString(instance.expectedAnswer);
        expect(result).toBeDefined();
        if (!result) continue;
        expect(
          checkConstraints(template.constraints, { ...instance.params, [RESULT_KEY]: result }),
        ).toBe(true);
      }
    });

    it("bleibt in den Wertebereichen des param_spec", () => {
      for (const instance of instances) {
        for (const [name, value] of Object.entries(instance.params)) {
          expect(inRange(template, name, value), `${name} = ${String(value)}`).toBe(true);
        }
      }
    });

    it("liefert eine Musterlösung, die zum answer_type passt", () => {
      for (const instance of instances) {
        const result = fromStorageString(instance.expectedAnswer);
        expect(result, instance.expectedAnswer).toBeDefined();
        if (!result) continue;
        if (template.answer_type === "integer") {
          expect(isInteger(result), instance.expectedAnswer).toBe(true);
        }
      }
    });

    it("rendert den Lösungsweg ohne Platzhalterrest", () => {
      if (template.solution_text === undefined) return;
      for (const instance of instances.slice(0, 25)) {
        const solution = renderSolution(template, instance.params, instance.expectedAnswer);
        expect(solution).toBeDefined();
        expect(solution).not.toContain("{{");
      }
    });

    it("ist unter demselben Seed reproduzierbar", () => {
      for (const seed of seeds.slice(0, 20)) {
        expect(instantiate(template, seed)).toEqual(instantiate(template, seed));
      }
    });
  },
);

describe("Der Content als Ganzes", () => {
  it("deckt jede Compute-Funktion mit mindestens einem Template ab", () => {
    const used = new Set(templates.map((template) => template.compute_ref));
    expect([...Object.keys(registry)].filter((ref) => !used.has(ref))).toEqual([]);
  });

  it("verteilt sich über den Themenbaum", () => {
    const topics = new Set(templates.map((template) => template.topic));
    expect(topics.size).toBeGreaterThanOrEqual(5);
  });

  it("nutzt Schwierigkeitsgrade von 1 bis 4", () => {
    const levels = new Set(templates.map((template) => template.difficulty));
    expect([...levels].sort()).toEqual([1, 2, 3, 4]);
  });

  it("erzeugt bei zufälligen Parametern auch verschiedene Aufgaben", () => {
    for (const template of templates) {
      const hasRandomParams = Object.values(template.param_spec).some(
        (spec) => spec.type !== "const",
      );
      if (!hasRandomParams) continue;
      const distinct = new Set(
        seeds.slice(0, 50).map((seed) => instantiate(template, seed).questionText),
      );
      expect(distinct.size, template.id).toBeGreaterThan(5);
    }
  });
});
