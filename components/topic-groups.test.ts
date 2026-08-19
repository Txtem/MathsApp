import { describe, expect, it } from "vitest";

import type { TopicOffer } from "@/lib/content/schema";

import { toTopicGroups, totalTemplates } from "./topic-groups";

const offer = (
  path: string,
  label: string,
  templateCount: number,
  children: readonly TopicOffer[] = [],
): TopicOffer => ({ path, label, templateCount, children });

const tree: readonly TopicOffer[] = [
  offer("arithmetik", "Grundrechenarten", 2, [
    offer("arithmetik.grundrechenarten", "Addition und Subtraktion", 2),
  ]),
  offer("kombinatorik", "Kombinatorik", 8, [
    offer("kombinatorik.permutation", "Permutationen", 2),
    offer("kombinatorik.variation", "Variationen", 2),
    offer("kombinatorik.kombination", "Kombinationen", 3),
    offer("kombinatorik.verteilung", "Verteilungen", 1),
  ]),
  offer("wahrscheinlichkeit", "Wahrscheinlichkeitsrechnung", 2, [
    offer("wahrscheinlichkeit.hypergeometrisch", "Hypergeometrische Verteilung", 2),
  ]),
  offer("analysis", "Analysis", 0, [offer("analysis.ableitung", "Ableitungen", 0)]),
];

describe("toTopicGroups", () => {
  it("liefert eine Gruppe je Oberthema, nicht eine flache Liste", () => {
    expect(toTopicGroups(tree).map((group) => group.topic)).toEqual([
      "arithmetik",
      "kombinatorik",
      "wahrscheinlichkeit",
    ]);
  });

  it("hängt die Blätter an ihr Oberthema", () => {
    const kombinatorik = toTopicGroups(tree).find((group) => group.topic === "kombinatorik");
    expect(kombinatorik?.leaves.map((leaf) => leaf.topic)).toEqual([
      "kombinatorik.permutation",
      "kombinatorik.variation",
      "kombinatorik.kombination",
      "kombinatorik.verteilung",
    ]);
  });

  it("wiederholt ein einzelnes Blatt nicht unter seinem Oberthema", () => {
    // "Grundrechenarten > Addition und Subtraktion" wäre zweimal dasselbe.
    const arithmetik = toTopicGroups(tree).find((group) => group.topic === "arithmetik");
    expect(arithmetik?.leaves).toEqual([]);
    expect(arithmetik?.templateCount).toBe(2);
  });

  it("blendet Themen ohne Aufgaben aus", () => {
    expect(toTopicGroups(tree).some((group) => group.topic === "analysis")).toBe(false);
  });

  it("blendet leere Blätter aus, behält aber die gefüllten", () => {
    const gemischt: readonly TopicOffer[] = [
      offer("t", "Thema", 3, [
        offer("t.a", "A", 3),
        offer("t.b", "B", 0),
        offer("t.c", "C", 0),
      ]),
    ];
    const groups = toTopicGroups(gemischt);
    // Nur ein gefülltes Blatt übrig ⇒ es wird nicht noch einmal aufgeführt.
    expect(groups[0]?.leaves).toEqual([]);
  });

  it("zieht auch tiefere Ebenen als Blätter hoch, statt sie einzurücken", () => {
    const tief: readonly TopicOffer[] = [
      offer("t", "Thema", 4, [
        offer("t.a", "A", 3, [offer("t.a.x", "X", 2), offer("t.a.y", "Y", 1)]),
        offer("t.b", "B", 1),
      ]),
    ];
    expect(toTopicGroups(tief)[0]?.leaves.map((leaf) => leaf.topic)).toEqual([
      "t.a.x",
      "t.a.y",
      "t.b",
    ]);
  });

  it("behält die Reihenfolge aus dem Themenbaum", () => {
    const labels = toTopicGroups(tree).map((group) => group.label);
    expect(labels).toEqual(["Grundrechenarten", "Kombinatorik", "Wahrscheinlichkeitsrechnung"]);
  });
});

describe("totalTemplates", () => {
  it("summiert über die Oberthemen, ohne Blätter doppelt zu zählen", () => {
    expect(totalTemplates(tree)).toBe(12);
  });

  it("ist für einen leeren Baum null", () => {
    expect(totalTemplates([])).toBe(0);
  });
});
