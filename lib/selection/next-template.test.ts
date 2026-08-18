import { describe, expect, it } from "vitest";

import { devTemplates } from "@/lib/content/dev-templates";
import type { Template } from "@/lib/engine/types";

import { matchesTopic, selectTemplate } from "./next-template";

/** Nimmt immer das erste Element des Pools — macht die Auswahl im Test eindeutig. */
const first = () => 0;
/** Nimmt das letzte Element. */
const last = () => 0.999;

describe("matchesTopic", () => {
  const cases: ReadonlyArray<readonly [string, string | null | undefined, boolean]> = [
    ["arithmetik.addition", null, true],
    ["arithmetik.addition", undefined, true],
    ["arithmetik.addition", "arithmetik", true],
    ["arithmetik.addition", "arithmetik.addition", true],
    ["arithmetik.addition", "arithmetik.subtraktion", false],
    ["arithmetik.addition", "kombinatorik", false],
    // kein reiner String-Prefix: "arithmetikx" darf nicht greifen
    ["arithmetikx.addition", "arithmetik", false],
  ];

  it.each(cases)("%s mit Filter %s → %s", (topic, filter, expected) => {
    expect(matchesTopic(topic, filter)).toBe(expected);
  });
});

describe("selectTemplate", () => {
  it("zieht aus allen Templates, wenn kein Filter gesetzt ist", () => {
    expect(selectTemplate(devTemplates, {}, first)?.id).toBe("aufg_00001");
    expect(selectTemplate(devTemplates, {}, last)?.id).toBe("aufg_00002");
  });

  it("wendet den Topic-Filter an", () => {
    expect(selectTemplate(devTemplates, { topicFilter: "arithmetik.subtraktion" }, first)?.id).toBe(
      "aufg_00002",
    );
    expect(selectTemplate(devTemplates, { topicFilter: "arithmetik" }, first)?.topic).toMatch(
      /^arithmetik\./,
    );
  });

  it("gibt undefined, wenn kein Template zum Filter passt", () => {
    expect(selectTemplate(devTemplates, { topicFilter: "kombinatorik" }, first)).toBeUndefined();
    expect(selectTemplate([], {}, first)).toBeUndefined();
  });

  it("meidet die zuletzt gestellten Templates", () => {
    expect(selectTemplate(devTemplates, { recentTemplateIds: ["aufg_00001"] }, first)?.id).toBe(
      "aufg_00002",
    );
    expect(selectTemplate(devTemplates, { recentTemplateIds: ["aufg_00002"] }, first)?.id).toBe(
      "aufg_00001",
    );
  });

  it("betrachtet nur die letzten drei Wiederholungen", () => {
    const recent = ["a", "b", "c", "aufg_00001"];
    // aufg_00001 steht an vierter Stelle und wird damit nicht mehr gemieden.
    expect(selectTemplate(devTemplates, { recentTemplateIds: recent }, first)?.id).toBe(
      "aufg_00001",
    );
  });

  it("wiederholt lieber, als gar keine Aufgabe zu liefern", () => {
    const onlyOne: readonly Template[] = [devTemplates[0]];
    expect(selectTemplate(onlyOne, { recentTemplateIds: ["aufg_00001"] }, first)?.id).toBe(
      "aufg_00001",
    );
  });

  it("bleibt bei gleicher Zufallszahl bei derselben Wahl", () => {
    const a = selectTemplate(devTemplates, {}, () => 0.4);
    const b = selectTemplate(devTemplates, {}, () => 0.4);
    expect(a?.id).toBe(b?.id);
  });
});
