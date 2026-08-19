import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { type CheckCode, checkAll, checkTemplate } from "./checks";
import { readContent, readTemplateFile, readTopics } from "./read";
import { leafTopics } from "./schema";

/**
 * Gegenprobe zu jeder statischen Prüfung: ein Template, das genau daran
 * scheitert. Eine Prüfung, die nie anschlägt, ist keine Prüfung.
 */

const FIXTURES = join(process.cwd(), "lib", "content", "__fixtures__");
const topics = readTopics();

function codesOf(file: string): readonly CheckCode[] {
  const entry = readTemplateFile(join(FIXTURES, file));
  return checkTemplate(entry, topics).map((issue) => issue.code);
}

describe("Negativ-Fixtures — jede Prüfung schlägt an", () => {
  const cases: ReadonlyArray<readonly [string, CheckCode]> = [
    ["01-unknown-compute-ref.yaml", "unknown_compute_ref"],
    ["02-unknown-question-placeholder.yaml", "unknown_question_placeholder"],
    ["03-unknown-solution-placeholder.yaml", "unknown_solution_placeholder"],
    ["04-unused-param.yaml", "unused_param"],
    ["05-compute-input-mismatch.yaml", "compute_input_mismatch"],
    ["07-topic-not-leaf.yaml", "topic_not_leaf"],
    ["08-round-to-without-numeric.yaml", "round_to_without_numeric"],
    ["09-unknown-constraint-name.yaml", "unknown_constraint_name"],
    ["10-invalid-constraint.yaml", "invalid_constraint"],
  ];

  it.each(cases)("%s meldet genau %s", (file, code) => {
    expect([...new Set(codesOf(file))]).toEqual([code]);
  });

  it("erkennt doppelte IDs erst über die Sammlung", () => {
    const entries = ["06a-duplicate-id.yaml", "06b-duplicate-id.yaml"].map((file) =>
      readTemplateFile(join(FIXTURES, file)),
    );

    // Einzeln ist jede Datei in Ordnung.
    for (const entry of entries) expect(checkTemplate(entry, topics)).toEqual([]);

    const issues = checkAll(entries, topics);
    expect(issues.map((issue) => issue.code)).toEqual(["duplicate_id"]);
    expect(issues[0]?.templateId).toBe("aufg_90006");
  });

  it("nennt Datei und Template-ID im Befund", () => {
    const entry = readTemplateFile(join(FIXTURES, "01-unknown-compute-ref.yaml"));
    const issue = checkTemplate(entry, topics)[0];
    expect(issue?.source).toContain("01-unknown-compute-ref.yaml");
    expect(issue?.templateId).toBe("aufg_90001");
    expect(issue?.message).toContain("arithmetik.multiply");
  });
});

describe("Themenbaum", () => {
  it("liefert nur Blätter als gültige Template-Topics", () => {
    expect([...leafTopics(topics)].sort()).toEqual([
      "arithmetik.grundrechenarten",
      "kombinatorik.kombination",
      "kombinatorik.permutation",
      "kombinatorik.variation",
      "kombinatorik.verteilung",
      "wahrscheinlichkeit.hypergeometrisch",
    ]);
  });
});

describe("Der echte Content", () => {
  it("lädt ohne Befund", () => {
    const { templates } = readContent();
    expect(templates.length).toBeGreaterThan(0);
    expect(checkAll(
      templates.map((template) => ({ template, source: template.id })),
      topics,
    )).toEqual([]);
  });

  it("vergibt jede ID nur einmal", () => {
    const ids = readContent().templates.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
