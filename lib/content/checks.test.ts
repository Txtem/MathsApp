import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  type CheckCode,
  checkAll,
  checkTemplate,
  errorsOf,
  MIN_PARAMETER_SPACE,
  warningsOf,
} from "./checks";
import { parameterSpace } from "./parameter-space";
import { readContent, readTemplateFile, readTopics } from "./read";
import { leafTopics } from "./schema";

/**
 * Gegenprobe zu jeder statischen Prüfung: ein Template, das genau daran
 * scheitert. Eine Prüfung, die nie anschlägt, ist keine Prüfung.
 */

const FIXTURES = join(process.cwd(), "lib", "content", "__fixtures__");
const topics = readTopics();

/** Nur die Fehler — Warnungen haben ihren eigenen Block weiter unten. */
function codesOf(file: string): readonly CheckCode[] {
  const entry = readTemplateFile(join(FIXTURES, file));
  return errorsOf(checkTemplate(entry, topics)).map((issue) => issue.code);
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

describe("Parameterraum — Warnung, kein Fehler", () => {
  const entry = readTemplateFile(join(FIXTURES, "11-small-parameter-space.yaml"));

  it("meldet einen zu engen Raum als Warnung", () => {
    const issues = checkTemplate(entry, topics);

    expect(errorsOf(issues)).toEqual([]);
    expect(warningsOf(issues).map((issue) => issue.code)).toEqual(["small_parameter_space"]);
  });

  it("nennt die gezählte Zahl und die Empfehlung", () => {
    const [warnung] = warningsOf(checkTemplate(entry, topics));
    // n läuft von 4 bis 6 — drei Kombinationen.
    expect(warnung?.message).toContain("Nur 3 ");
    expect(warnung?.message).toContain(String(MIN_PARAMETER_SPACE));
  });

  it("hält den Ladevorgang nicht an", () => {
    // Der echte Content warnt heute viermal und lädt trotzdem.
    const { templates, warnings } = readContent();
    expect(templates.length).toBeGreaterThan(0);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.every((issue) => issue.severity === "warning")).toBe(true);
  });

  it("warnt genau bei den Templates unter der Schwelle", () => {
    // Die Gegenprobe zur Zählung: Wer warnt, muss auch zu klein sein — und
    // umgekehrt. Bleibt eine Warnung aus, rechnet `parameterSpace` falsch.
    const { templates, warnings } = readContent();
    const gewarnt = new Set(warnings.map((issue) => issue.templateId));

    for (const template of templates) {
      const zuKlein = parameterSpace(template).size < MIN_PARAMETER_SPACE;
      expect(gewarnt.has(template.id)).toBe(zuKlein);
    }
  });

  it("warnt heute genau bei diesen dreien", () => {
    // Bewusst festgenagelt: Die Liste ist die Zielvorgabe für M2d.
    // Verschwindet eine Warnung, ist das eine gute Nachricht und gehört gesehen —
    // kommt eine dazu, ebenfalls. `aufg_00004` stand hier bis M2d Schritt 1 mit
    // Raum 1; seit der Wortliste sind es 27.
    const ids = readContent()
      .warnings.map((issue) => issue.templateId)
      .sort();
    expect(ids).toEqual(["aufg_00003", "aufg_00006", "aufg_00009"]);
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
  it("lädt ohne Fehler", () => {
    const { templates } = readContent();
    expect(templates.length).toBeGreaterThan(0);
    const issues = checkAll(
      templates.map((template) => ({ template, source: template.id })),
      topics,
    );
    expect(errorsOf(issues)).toEqual([]);
  });

  it("vergibt jede ID nur einmal", () => {
    const ids = readContent().templates.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
